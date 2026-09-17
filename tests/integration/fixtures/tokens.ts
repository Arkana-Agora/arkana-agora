import { VERIFIED_EMAIL } from "./users"

const TOKEN_CHARS = "a"

export const VALID_TOKEN = TOKEN_CHARS.repeat(64)

export function verificationTokenRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "vt_1",
    identifier: VERIFIED_EMAIL,
    token: VALID_TOKEN,
    type: "EMAIL",
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    ...overrides,
  }
}

export function passwordResetTokenRow(overrides: Record<string, unknown> = {}) {
  return verificationTokenRow({
    type: "PASSWORD_RESET",
    expiresAt: new Date(Date.now() + 30 * 60 * 1000),
    ...overrides,
  })
}
