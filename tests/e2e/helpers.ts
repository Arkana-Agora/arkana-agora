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

declare global {
  var __e2ePrisma: PrismaClient | undefined
}
