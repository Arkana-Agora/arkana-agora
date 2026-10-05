import "dotenv/config"
import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"
import type { APIRequestContext } from "@playwright/test"
import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "@prisma/client"

import {
  csrfCookieName,
  generateCsrfToken,
} from "../../src/lib/csrf-cookie-name"
import { resolveE2eDatabaseUrl } from "./database-url"

export const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000"
export const TEST_PASSWORD = "Test@12345678"

// Prisma 7 exige driver adapter (padrão de src/lib/prisma.ts) — o client
// crue quebra qualquer spec que importe os helpers.
// Guard do Crítico 9: o .env.local (banco local, mesma precedência do
// Next) é a fonte, e resolveE2eDatabaseUrl recusa host remoto — specs
// destrutivas (cleanupUser, deleteMany) nunca tocam o banco do .env.
const envLocalPath = resolve(process.cwd(), ".env.local")
process.env.DATABASE_URL = resolveE2eDatabaseUrl({
  envLocalContent: existsSync(envLocalPath)
    ? readFileSync(envLocalPath, "utf8")
    : undefined,
  envDatabaseUrl: process.env.DATABASE_URL,
})

const globalPrisma =
  globalThis.__e2ePrisma ??
  new PrismaClient({
    adapter: new PrismaPg({
      connectionString: process.env.DATABASE_URL,
    }),
  })
if (process.env.NODE_ENV !== "production") globalThis.__e2ePrisma = globalPrisma
export const prisma = globalPrisma

export function csrfHeaders(): { headers: Record<string, string> } {
  const token = generateCsrfToken()
  return {
    headers: {
      "x-csrf-token": token,
      Cookie: `${csrfCookieName()}=${token}`,
    },
  }
}

export async function getTokenByEmail(
  email: string,
  type: string,
): Promise<string> {
  const vt = await prisma.verificationToken.findFirst({
    where: {
      identifier: email,
      type: type as "EMAIL" | "MAGIC_LINK" | "PASSWORD_RESET",
    },
    orderBy: { expiresAt: "desc" },
  })
  if (!vt) throw new Error(`No ${type} token found for ${email}`)
  return vt.token
}

export async function registerUser(
  request: APIRequestContext,
  email: string,
  name: string,
): Promise<void> {
  const existing = await prisma.user.findFirst({ where: { email } })
  if (!existing) {
    await request.post(`${BASE_URL}/api/v1/auth/register`, {
      ...csrfHeaders(),
      data: {
        name,
        email,
        password: TEST_PASSWORD,
        passwordConfirmation: TEST_PASSWORD,
        acceptTerms: true,
      },
    })
  }

  // Garante email verificado — register pode ter sido bloqueado por rate
  // limit (429) ou o usuário ter ficado órfão de runs anteriores.
  const user = await prisma.user.findFirst({ where: { email } })
  if (user && !user.emailVerified) {
    const vt = await prisma.verificationToken.findFirst({
      where: { identifier: email, type: "EMAIL" },
      orderBy: { expiresAt: "desc" },
    })
    if (vt) {
      await request.post(`${BASE_URL}/api/v1/auth/verify-email`, {
        data: { token: vt.token },
      })
    }
    const after = await prisma.user.findFirst({
      where: { email },
      select: { emailVerified: true },
    })
    if (!after?.emailVerified) {
      // Fallback de fixture: token já consumido/expirado — marca direto no
      // banco (apenas setup de teste; o fluxo real de verify é coberto por
      // specs dedicadas de auth).
      await prisma.user.update({
        where: { id: user.id },
        data: { emailVerified: new Date() },
      })
    }
  }
}

export async function cleanupUser(email: string): Promise<void> {
  await prisma.verificationToken.deleteMany({ where: { identifier: email } })
  await prisma.user.deleteMany({ where: { email } })
}

export async function login(
  request: APIRequestContext,
  email: string,
  password: string,
) {
  const response = await request.post(`${BASE_URL}/api/v1/auth/login`, {
    ...csrfHeaders(),
    data: { email, password },
  })
  return response
}

export interface AttachedSession {
  accessToken: string
  cookies: string
}

export async function attachSession(
  request: APIRequestContext,
  email: string,
  password: string = TEST_PASSWORD,
): Promise<AttachedSession> {
  const response = await login(request, email, password)
  if (response.status() !== 200) {
    throw new Error(
      `attachSession failed for ${email}: ${response.status()} ${await response.text()}`,
    )
  }
  const body = (await response.json()) as {
    accessToken: string
    user?: { id?: string }
  }

  const setCookie = response.headers()["set-cookie"] ?? ""
  const refreshMatch = setCookie.match(/refreshToken=([^;]+)/)
  const csrfMatch = setCookie.match(/csrf-token=([^;]+)/)
  const parts: string[] = []
  if (refreshMatch) parts.push(`refreshToken=${refreshMatch[1]}`)
  if (csrfMatch) parts.push(`csrf-token=${csrfMatch[1]}`)

  return { accessToken: body.accessToken, cookies: parts.join("; ") }
}

export async function ensureProfile(
  userId: string,
  overrides: {
    username?: string
    bio?: string | null
    privacy?: Record<string, unknown>
  } = {},
): Promise<void> {
  const data: Record<string, unknown> = {}
  if (overrides.username !== undefined) data.username = overrides.username
  if (overrides.bio !== undefined) data.bio = overrides.bio
  if (overrides.privacy !== undefined) data.privacy = overrides.privacy

  await prisma.userProfile.upsert({
    where: { userId },
    create: {
      userId,
      username: overrides.username ?? `user_${userId.slice(-8)}`,
      bio: overrides.bio ?? null,
      privacy: (overrides.privacy as object | undefined) ?? {},
    },
    update: data,
  })
}

export async function getUserByEmail(email: string) {
  return prisma.user.findFirst({ where: { email } })
}

declare global {
  var __e2ePrisma: PrismaClient | undefined
}
