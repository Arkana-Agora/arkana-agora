import {
  createHash,
  createPrivateKey,
  createPublicKey,
  randomBytes,
  randomUUID,
} from "node:crypto"
import { SignJWT, jwtVerify } from "jose"
import { prisma } from "@/lib/prisma"
import { redis } from "@/lib/redis"
import { logger } from "@/lib/logger"

const ACCESS_TOKEN_TTL_SECONDS = Number(
  process.env.ACCESS_TOKEN_TTL_SECONDS ?? 15 * 60,
)
const REFRESH_TOKEN_TTL_DAYS = Number(process.env.REFRESH_TOKEN_TTL_DAYS ?? 30)

export class AuthTokenError extends Error {
  readonly code: string
  constructor(code: string, message: string) {
    super(`${code}: ${message}`)
    this.name = "AuthTokenError"
    this.code = code
  }
}

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex")
}

function getPrivateKey(): string {
  const key = process.env.JWT_PRIVATE_KEY
  if (!key) {
    throw new Error("JWT_PRIVATE_KEY nao configurado")
  }
  return key
}

function getPublicKey(): string {
  const key = process.env.JWT_PUBLIC_KEY
  if (!key) {
    throw new Error("JWT_PUBLIC_KEY nao configurado")
  }
  return key
}

export interface AccessTokenClaims {
  sub: string
  role: string
  plan: string
  tokenVersion: number
}

function tokenVersionCacheKey(userId: string): string {
  return `auth:tokenVersion:${userId}`
}

export async function signAccessToken(user: {
  id: string
  role: string
  plan: string
  tokenVersion: number
}): Promise<string> {
  const privateKey = getPrivateKey()
  return new SignJWT({
    role: user.role,
    plan: user.plan,
    tokenVersion: user.tokenVersion,
  })
    .setProtectedHeader({ alg: "RS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + ACCESS_TOKEN_TTL_SECONDS)
    .sign(createPrivateKey(privateKey))
}

export interface VerifiedAccess {
  userId: string
  role: string
  plan: string
  tokenVersion: number
}

export async function verifyAccessToken(
  token: string,
): Promise<VerifiedAccess> {
  let payload: {
    sub?: string
    role?: string
    plan?: string
    tokenVersion?: number
  }
  try {
    const result = await jwtVerify(token, createPublicKey(getPublicKey()), {
      algorithms: ["RS256"],
    })
    payload = result.payload as typeof payload
  } catch {
    logger.warn("[auth:token] token invalido ou expirado")
    throw new AuthTokenError("AUTH_TOKEN_INVALID", "Token invalido ou expirado")
  }

  if (
    typeof payload.sub !== "string" ||
    typeof payload.tokenVersion !== "number" ||
    !Number.isInteger(payload.tokenVersion)
  ) {
    logger.warn("[auth:token] claim tokenVersion ausente ou nao-inteira")
    throw new AuthTokenError(
      "AUTH_TOKEN_INVALID",
      "Token sem tokenVersion valida",
    )
  }

  const claims: AccessTokenClaims = {
    sub: payload.sub,
    role: payload.role ?? "USER",
    plan: payload.plan ?? "FREE",
    tokenVersion: payload.tokenVersion,
  }

  const cached = await readCachedTokenVersion(claims.sub)
  if (cached !== null) {
    if (cached !== claims.tokenVersion) {
      logger.warn(
        `[auth:token] tokenVersion divergente no cache p/ ${claims.sub}`,
      )
      throw new AuthTokenError(
        "AUTH_TOKEN_REVOKED",
        "Token revogado (tokenVersion alterado)",
      )
    }
  } else {
    await verifyTokenVersionAgainstDb(claims)
  }

  return {
    userId: claims.sub,
    role: claims.role,
    plan: claims.plan,
    tokenVersion: claims.tokenVersion,
  }
}

async function readCachedTokenVersion(userId: string): Promise<number | null> {
  if (!redis) {
    return null
  }
  try {
    const raw = await redis.get(tokenVersionCacheKey(userId))
    if (raw === null) {
      return null
    }
    const value = Number(raw)
    return Number.isInteger(value) ? value : null
  } catch {
    logger.warn("[auth:token] Redis indisponivel — usando DB como fallback")
    return null
  }
}

async function getUserWithActiveState(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      role: true,
      plan: true,
      tokenVersion: true,
      isActive: true,
      deletedAt: true,
    },
  })

  if (!user || !user.isActive || user.deletedAt !== null) {
    logger.warn("[auth:token] conta inativa ou deletada ao buscar usuario")
    throw new AuthTokenError(
      "AUTH_ACCOUNT_SUSPENDED",
      "Conta inativa ou deletada",
    )
  }

  return user
}

async function verifyTokenVersionAgainstDb(
  claims: AccessTokenClaims,
): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: claims.sub },
    select: { tokenVersion: true, isActive: true, deletedAt: true, role: true },
  })

  if (
    !user ||
    user.tokenVersion !== claims.tokenVersion ||
    !user.isActive ||
    user.deletedAt !== null
  ) {
    logger.warn(
      `[auth:token] DB rejeitou token p/ ${claims.sub} (versao/flags)`,
    )
    throw new AuthTokenError(
      "AUTH_TOKEN_REVOKED",
      "Token revogado (DB: versao ou flags)",
    )
  }
}

export interface NewSession {
  rawToken: string
  tokenHash: string
  familyId: string
  tokenId: string
  expiresAt: Date
}

export async function createRefreshSession(
  userId: string,
  { userAgent, ip }: { userAgent?: string; ip?: string },
): Promise<NewSession> {
  const rawToken = randomBytes(32).toString("base64url")
  const tokenHash = sha256(rawToken)
  const familyId = randomUUID()
  const tokenId = randomUUID()
  const expiresAt = new Date(
    Date.now() + REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
  )

  await prisma.session.create({
    data: {
      userId,
      tokenHash,
      familyId,
      tokenId,
      userAgent: userAgent ?? null,
      ipAddress: ip ?? null,
      expiresAt,
    },
  })

  return { rawToken, tokenHash, familyId, tokenId, expiresAt }
}

async function revokeFamily(familyId: string): Promise<void> {
  await prisma.session.updateMany({
    where: { familyId },
    data: { revokedAt: new Date() },
  })
}

export interface RotationResult {
  accessToken: string
  refreshToken: string
  expiresIn: number
}

export async function rotateRefresh(rawToken: string): Promise<RotationResult> {
  const tokenHash = sha256(rawToken)
  const session = await prisma.session.findUnique({ where: { tokenHash } })

  if (!session) {
    logger.warn("[auth:refresh] token refresh inexistente")
    throw new AuthTokenError(
      "AUTH_REFRESH_TOKEN_INVALID",
      "Refresh token invalido",
    )
  }

  // Reuso: verificar replacedByTokenId ANTES de revokedAt (senão o replay nunca alcança o branch de reuso)
  if (session.replacedByTokenId !== null) {
    logger.warn(
      `[auth:refresh] REUSO detectado familia=${session.familyId} — revogando familia`,
    )
    await revokeFamily(session.familyId)
    throw new AuthTokenError(
      "AUTH_REFRESH_TOKEN_REVOKED",
      "Refresh token ja utilizado (reuso)",
    )
  }

  if (session.revokedAt !== null) {
    throw new AuthTokenError(
      "AUTH_REFRESH_TOKEN_REVOKED",
      "Refresh token revogado",
    )
  }

  if (session.expiresAt.getTime() < Date.now()) {
    throw new AuthTokenError(
      "AUTH_REFRESH_TOKEN_EXPIRED",
      "Refresh token expirado",
    )
  }

  const user = await getUserWithActiveState(session.userId)

  if (!user) {
    logger.warn("[auth:refresh] conta removida ao tentar refresh token")
    throw new AuthTokenError(
      "AUTH_ACCOUNT_SUSPENDED",
      "Conta inativa ou deletada",
    )
  }

  const newRaw = randomBytes(32).toString("base64url")
  const newTokenHash = sha256(newRaw)
  const newTokenId = randomUUID()
  const now = new Date()
  const newExpiresAt = new Date(
    Date.now() + REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
  )

  // Rotação condicional anti-race: só marca se ainda não foi substituído
  const { count } = await prisma.session.updateMany({
    where: { id: session.id, replacedByTokenId: null },
    data: { replacedByTokenId: newTokenId, revokedAt: now },
  })
  if (count !== 1) {
    logger.warn(
      `[auth:refresh] rotacao condicional falhou familia=${session.familyId} — reuso`,
    )
    await revokeFamily(session.familyId)
    throw new AuthTokenError(
      "AUTH_REFRESH_TOKEN_REVOKED",
      "Refresh token ja rotacionado (reuso)",
    )
  }

  await prisma.session.create({
    data: {
      userId: user.id,
      tokenHash: newTokenHash,
      familyId: session.familyId,
      tokenId: newTokenId,
      userAgent: session.userAgent,
      ipAddress: session.ipAddress,
      expiresAt: newExpiresAt,
    },
  })

  const accessToken = await signAccessToken({
    id: user.id,
    role: user.role,
    plan: user.plan,
    tokenVersion: user.tokenVersion,
  })

  return {
    accessToken,
    refreshToken: newRaw,
    expiresIn: ACCESS_TOKEN_TTL_SECONDS,
  }
}

export async function bumpTokenVersion(userId: string): Promise<void> {
  const updated = await prisma.user.update({
    where: { id: userId },
    data: { tokenVersion: { increment: 1 } },
    select: { tokenVersion: true },
  })

  if (redis) {
    try {
      await redis.set(
        tokenVersionCacheKey(userId),
        String(updated.tokenVersion),
        "EX",
        ACCESS_TOKEN_TTL_SECONDS,
      )
    } catch {
      logger.warn("[auth:token] falha ao espelhar tokenVersion no Redis")
    }
  }

  logger.info(`[auth:token] tokenVersion bumped p/ ${userId}`)
}

export async function revokeRefreshSession(
  rawToken: string,
  expectedUserId: string,
): Promise<void> {
  const tokenHash = sha256(rawToken)
  const session = await prisma.session.findUnique({ where: { tokenHash } })

  if (!session || session.revokedAt !== null) {
    return
  }

  if (session.userId !== expectedUserId) {
    logger.warn(
      "[auth:logout] tentativa de revogar sessao de outro usuario — ignorada",
    )
    return
  }

  await prisma.session.update({
    where: { id: session.id },
    data: { revokedAt: new Date() },
  })
}

export async function revokeAllSessions(userId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.session.updateMany({
      where: { userId },
      data: { revokedAt: new Date() },
    })
    await tx.user.update({
      where: { id: userId },
      data: { tokenVersion: { increment: 1 } },
    })
  })

  if (redis) {
    try {
      const fresh = await prisma.user.findUnique({
        where: { id: userId },
        select: { tokenVersion: true },
      })
      if (fresh) {
        await redis.set(
          tokenVersionCacheKey(userId),
          String(fresh.tokenVersion),
          "EX",
          ACCESS_TOKEN_TTL_SECONDS,
        )
      }
    } catch {
      logger.warn("[auth:logout] falha ao espelhar tokenVersion no Redis")
    }
  }

  logger.info(`[auth:logout] todas as sessoes revogadas p/ ${userId}`)
}

export async function softDeleteAccount(userId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.session.updateMany({
      where: { userId },
      data: { revokedAt: new Date() },
    })
    await tx.user.update({
      where: { id: userId },
      data: {
        isActive: false,
        deletedAt: new Date(),
        tokenVersion: { increment: 1 },
      },
    })
  })

  if (redis) {
    try {
      const fresh = await prisma.user.findUnique({
        where: { id: userId },
        select: { tokenVersion: true },
      })
      if (fresh) {
        await redis.set(
          tokenVersionCacheKey(userId),
          String(fresh.tokenVersion),
          "EX",
          ACCESS_TOKEN_TTL_SECONDS,
        )
      }
    } catch {
      logger.warn(
        "[auth:account] falha ao espelhar tokenVersion no Redis pos soft delete",
      )
    }
  }

  logger.info(`[auth:account] conta soft-deletada (LGPD) p/ ${userId}`)
}
