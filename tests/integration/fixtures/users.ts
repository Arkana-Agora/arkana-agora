import type { Prisma } from "@prisma/client"

export const VERIFIED_EMAIL = "maria@email.com"

export function activeUserRow(
  overrides: Record<string, unknown> = {},
): Prisma.UserGetPayload<{
  select: {
    id: true
    email: true
    isActive: true
    deletedAt: true
    emailVerified: true
  }
}> {
  return {
    id: "usr_1",
    email: VERIFIED_EMAIL,
    isActive: true,
    deletedAt: null,
    emailVerified: new Date("2026-01-01T00:00:00Z"),
    ...overrides,
  } as never
}

export function verifiedJwtPayload() {
  return {
    userId: "usr_1",
    role: "USER",
    plan: "FREE",
    tokenVersion: 1,
  }
}

export function fullActiveUserRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "usr_1",
    name: "Maria Silva",
    displayName: "Maria Silva",
    email: VERIFIED_EMAIL,
    passwordHash: "$2a$12$hash",
    role: "USER",
    plan: "FREE",
    avatar: null,
    isActive: true,
    deletedAt: null,
    emailVerified: new Date("2026-01-01T00:00:00Z"),
    tokenVersion: 0,
    ...overrides,
  }
}
