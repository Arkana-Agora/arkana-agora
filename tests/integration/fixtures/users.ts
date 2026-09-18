export const VERIFIED_EMAIL = "maria@email.com"

export interface ActiveUserRow {
  id: string
  email: string
  isActive: boolean
  deletedAt: Date | null
  emailVerified: Date | null
}

export function activeUserRow(
  overrides: Partial<ActiveUserRow> = {},
): ActiveUserRow {
  return {
    id: "usr_1",
    email: VERIFIED_EMAIL,
    isActive: true,
    deletedAt: null,
    emailVerified: new Date("2026-01-01T00:00:00Z"),
    ...overrides,
  }
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
