import { APIRequestContext } from "@playwright/test"
import { PrismaClient } from "@prisma/client"

export const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000"
export const TEST_PASSWORD = "Test@12345678"

const globalPrisma = globalThis.__e2ePrisma ?? new PrismaClient()
if (process.env.NODE_ENV !== "production") globalThis.__e2ePrisma = globalPrisma
export const prisma = globalPrisma

export function generateCsrfToken(): string {
  const array = new Uint8Array(32)
  crypto.getRandomValues(array)
  return Array.from(array, (b) => b.toString(16).padStart(2, "0")).join("")
}

export function csrfHeaders(): { headers: Record<string, string> } {
  const token = generateCsrfToken()
  return {
    headers: {
      "x-csrf-token": token,
      Cookie: `csrf-token=${token}`,
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
  if (existing) return

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

  const vt = await prisma.verificationToken.findFirst({
    where: { identifier: email, type: "EMAIL" },
    orderBy: { expiresAt: "desc" },
  })
  if (vt) {
    await request.post(`${BASE_URL}/api/v1/auth/verify-email`, {
      data: { token: vt.token },
    })
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
