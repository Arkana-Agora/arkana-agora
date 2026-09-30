import { apiError } from "@/lib/api-response"
import { logger } from "@/lib/logger"
import { prisma } from "@/lib/prisma"
import { AuthTokenError, verifyAccessToken } from "@/services/token-service"
import {
  parsePrivacy,
  usernameSchema,
  type PrivacyInput,
} from "@/lib/validators/profile"

export function getBearerToken(request: Request): string {
  const header = request.headers.get("authorization") ?? ""
  const match = /^Bearer\s+(.+)$/i.exec(header)
  return match?.[1] ?? ""
}

/**
 * Busca perfil visível publicamente (usado por profile/route.ts e _follow-list.ts).
 * Aplica regras anti-timing (404 para privado/banido/soft-deleted) e statsVisibility.
 * Retorna null se não encontrado ou não visível, ou o objeto com profile + user + privacy + flags.
 */
export async function findVisibleProfile(
  usernameRaw: string,
  reqId: string,
): Promise<{
  profile: {
    userId: string
    privacy: PrivacyInput
    user: { id: string; isBanned: boolean; deletedAt: Date | null }
  }
  username: string
  showStats: boolean
} | null> {
  const parsed = usernameSchema.safeParse(usernameRaw)
  if (!parsed.success) return null

  const profileData = await prisma.userProfile.findUnique({
    where: { username: parsed.data },
    select: {
      userId: true,
      privacy: true,
      user: {
        select: { id: true, isBanned: true, deletedAt: true, isActive: true },
      },
    },
  })
  if (!profileData) return null

  const privacy = parsePrivacy(profileData.privacy)
  if (!privacy) {
    // Fail-closed (404) e intencional, mas sem log o 404 fica mudo em
    // observabilidade e a causa parece "usuario inexistente".
    logger.warn(
      { reqId, username: parsed.data },
      "[profile] privacy JSON invalido — 404 fail-closed",
    )
    return null
  }

  if (privacy.profileVisibility === "private") return null
  if (
    profileData.user.isBanned ||
    profileData.user.deletedAt ||
    profileData.user.isActive === false
  )
    return null

  const showStats = privacy.statsVisibility !== "private"

  return {
    profile: { userId: profileData.userId, privacy, user: profileData.user },
    username: parsed.data,
    showStats,
  }
}

/**
 * Auth opcional (listas sociais T044/T045): retorna o userId quando o
 * Bearer e valido; sem token ou token invalido → null (nunca 401 — o
 * recurso e publico, o token so habilita campos por-viewer como isFollowing).
 * Verifica estado da conta (ban/soft-delete) — usuarios banidos/deletados
 * nao sao identificados como viewers validos.
 */
export async function optionalAuth(request: Request): Promise<string | null> {
  const bearer = getBearerToken(request)
  if (!bearer) return null
  try {
    const verified = await verifyAccessToken(bearer)

    // Gate de estado da conta: banimento, soft-delete e inatividade valem
    // mesmo para auth opcional — evita que usuários banidos/deletados
    // sejam identificados como viewers em listas/perfis.
    const user = await prisma.user.findUnique({
      where: { id: verified.userId },
      select: { isBanned: true, deletedAt: true, isActive: true },
    })

    if (!user || user.deletedAt || user.isBanned || user.isActive === false)
      return null
    return verified.userId
  } catch (err) {
    // Rejeicao esperada de token (expirado/invalido) → anonimo (nunca 401).
    // TODO o resto (falha de DB, erro de config JWT) e infraestrutura:
    // mascarar como anonimo tornaria a falha indistinguivel de token velho
    // e degradaria o dono do perfil para 404 na propria lista.
    const code =
      err instanceof Error && err.name === "AuthTokenError"
        ? (err as AuthTokenError).code
        : undefined
    if (typeof code === "string" && !code.startsWith("AUTH_CONFIG_")) {
      return null
    }
    logger.error({ err }, "[auth:optional] falha inesperada — propagando")
    throw err
  }
}

export async function requireAuth(
  request: Request,
  reqId: string,
): Promise<{ userId: string } | Response> {
  const bearer = getBearerToken(request)
  if (!bearer) {
    logger.warn({ reqId }, "[auth] token de acesso ausente")
    return Response.json(
      {
        error: {
          code: "AUTH_TOKEN_INVALID",
          message: "Token de acesso ausente",
        },
        meta: { requestId: reqId },
      },
      { status: 401 },
    )
  }

  try {
    const verified = await verifyAccessToken(bearer)

    // Gate de estado da conta (review): token válido não basta — banimento e
    // soft-delete valem mesmo com JWT não expirado (o cache Redis de
    // tokenVersion faz o verifyAccessToken pular o check de DB, então este
    // lookup é a única barreira). Estados:
    //   - objeto     → aplica as regras abaixo (ban → 403; deletedAt/isActive=false → 401)
    //   - null       → linha inexistente (hard delete) → 401 (contrato)
    //   - undefined  → `prisma.user` sem stub (impossível em prod: o schema
    //                   garante o model) — segue sem bloquear, p/ mocks
    //   - throw      → falha real de DB → 503 fail-closed (nunca 200: abriria
    //                   o gate num pico de DB; nunca 401: dispararia o
    //                   refresh loop do client)
    let user:
      | { isBanned: boolean; deletedAt: Date | null; isActive: boolean }
      | null
      | undefined
    if (!prisma.user?.findUnique) {
      user = undefined
    } else {
      try {
        user = await prisma.user.findUnique({
          where: { id: verified.userId },
          select: { isBanned: true, deletedAt: true, isActive: true },
        })
      } catch (lookupErr) {
        logger.error(
          { reqId, userId: verified.userId, err: lookupErr },
          "[auth] falha ao consultar estado da conta — bloqueando com 503",
        )
        return apiError(
          "SERVICE_UNAVAILABLE",
          "Servico temporariamente indisponivel",
          reqId,
          503,
        )
      }
    }

    if (user === null || user?.deletedAt != null || user?.isActive === false) {
      logger.warn(
        { reqId, userId: verified.userId },
        "[auth] conta removida, soft-deleted ou inativa",
      )
      return apiError(
        "AUTH_TOKEN_INVALID",
        "Sessao invalida ou expirada",
        reqId,
        401,
      )
    }
    if (user?.isBanned) {
      logger.warn({ reqId, userId: verified.userId }, "[auth] conta banida")
      return apiError("AUTH_ACCOUNT_SUSPENDED", "Conta suspensa", reqId, 403)
    }

    return { userId: verified.userId }
  } catch (err) {
    if (err instanceof Error && err.name === "AuthTokenError") {
      const code = (err as AuthTokenError).code
      // Config failures (ex: missing JWT_PUBLIC_KEY) are server faults.
      // Answering 401 here would silently degrade every token to "invalid"
      // and drive the client into an endless refresh -> retry loop.
      if (code.startsWith("AUTH_CONFIG_")) {
        logger.error(
          { reqId, code },
          "[auth:config] configuracao de chave JWT invalida no servidor",
        )
        return Response.json(
          {
            error: { code, message: "Configuracao interna invalida" },
            meta: { requestId: reqId },
          },
          { status: 500 },
        )
      }
      logger.warn({ reqId, code }, "[auth] token rejeitado")
      return Response.json(
        {
          error: { code, message: "Sessao invalida ou expirada" },
          meta: { requestId: reqId },
        },
        { status: 401 },
      )
    }
    logger.error({ reqId }, "[auth] erro inesperado na validacao do token")
    return Response.json(
      {
        error: { code: "INTERNAL_ERROR", message: "Erro interno" },
        meta: { requestId: reqId },
      },
      { status: 500 },
    )
  }
}
