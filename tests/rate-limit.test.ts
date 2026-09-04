import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

beforeEach(() => {
  vi.resetModules()
})

afterEach(() => {
  vi.useRealTimers()
  delete process.env.MAX_PASSWORD_RESET_PER_EMAIL
})

describe("password reset rate limiter (T11 — unidade, módulo real)", () => {
  it("permite 3 pedidos por hora por email e bloqueia o 4o com retryAfter de 1h", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"))
    const { isPasswordResetLimited, recordPasswordResetRequest } =
      await import("@/lib/rate-limit")

    expect(isPasswordResetLimited("maria@email.com").allowed).toBe(true)
    recordPasswordResetRequest("maria@email.com")
    expect(isPasswordResetLimited("maria@email.com").allowed).toBe(true)
    recordPasswordResetRequest("maria@email.com")
    expect(isPasswordResetLimited("maria@email.com").allowed).toBe(true)
    recordPasswordResetRequest("maria@email.com")

    const check = isPasswordResetLimited("maria@email.com")
    expect(check.allowed).toBe(false)
    expect(check.retryAfter).toBe(60 * 60)
  })

  it("expira a janela de 1h e volta a permitir novos pedidos", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"))
    const { isPasswordResetLimited, recordPasswordResetRequest } =
      await import("@/lib/rate-limit")

    recordPasswordResetRequest("maria@email.com")
    recordPasswordResetRequest("maria@email.com")
    recordPasswordResetRequest("maria@email.com")
    expect(isPasswordResetLimited("maria@email.com").allowed).toBe(false)

    vi.advanceTimersByTime(60 * 60 * 1000 + 1000)
    expect(isPasswordResetLimited("maria@email.com").allowed).toBe(true)
  })

  it("normaliza o email para lowercase na chave do limite", async () => {
    const { isPasswordResetLimited, recordPasswordResetRequest } =
      await import("@/lib/rate-limit")

    recordPasswordResetRequest("MARIA@EMAIL.COM")
    recordPasswordResetRequest("maria@email.com")
    recordPasswordResetRequest("Maria@Email.com")

    expect(isPasswordResetLimited("maria@email.com").allowed).toBe(false)
  })

  it("isola o limite por email (emails diferentes nao compartilham cota)", async () => {
    const { isPasswordResetLimited, recordPasswordResetRequest } =
      await import("@/lib/rate-limit")

    recordPasswordResetRequest("maria@email.com")
    recordPasswordResetRequest("maria@email.com")
    recordPasswordResetRequest("maria@email.com")

    expect(isPasswordResetLimited("joao@email.com").allowed).toBe(true)
  })

  it("respeita MAX_PASSWORD_RESET_PER_EMAIL custom (1)", async () => {
    process.env.MAX_PASSWORD_RESET_PER_EMAIL = "1"
    vi.resetModules()
    const { isPasswordResetLimited, recordPasswordResetRequest } =
      await import("@/lib/rate-limit")

    recordPasswordResetRequest("maria@email.com")
    expect(isPasswordResetLimited("maria@email.com").allowed).toBe(false)
  })

  it("lanca na carga do modulo para MAX_PASSWORD_RESET_PER_EMAIL invalido", async () => {
    for (const bad of ["0", "-1", "abc"]) {
      process.env.MAX_PASSWORD_RESET_PER_EMAIL = bad
      vi.resetModules()
      await expect(import("@/lib/rate-limit")).rejects.toThrow(
        `Invalid MAX_PASSWORD_RESET_PER_EMAIL: ${bad}`,
      )
      delete process.env.MAX_PASSWORD_RESET_PER_EMAIL
    }
  })
})
