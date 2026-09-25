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
    const {
      isPasswordResetLimited,
      recordPasswordResetRequest,
      resetRateLimiter,
    } = await import("@/lib/rate-limit")
    resetRateLimiter()

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
    const {
      isPasswordResetLimited,
      recordPasswordResetRequest,
      resetRateLimiter,
    } = await import("@/lib/rate-limit")
    resetRateLimiter()

    recordPasswordResetRequest("maria@email.com")
    recordPasswordResetRequest("maria@email.com")
    recordPasswordResetRequest("maria@email.com")
    expect(isPasswordResetLimited("maria@email.com").allowed).toBe(false)

    vi.advanceTimersByTime(60 * 60 * 1000 + 1000)
    expect(isPasswordResetLimited("maria@email.com").allowed).toBe(true)
  })

  it("normaliza o email para lowercase na chave do limite", async () => {
    const {
      isPasswordResetLimited,
      recordPasswordResetRequest,
      resetRateLimiter,
    } = await import("@/lib/rate-limit")
    resetRateLimiter()

    recordPasswordResetRequest("MARIA@EMAIL.COM")
    recordPasswordResetRequest("maria@email.com")
    recordPasswordResetRequest("Maria@Email.com")

    expect(isPasswordResetLimited("maria@email.com").allowed).toBe(false)
  })

  it("isola o limite por email (emails diferentes nao compartilham cota)", async () => {
    const {
      isPasswordResetLimited,
      recordPasswordResetRequest,
      resetRateLimiter,
    } = await import("@/lib/rate-limit")
    resetRateLimiter()

    recordPasswordResetRequest("maria@email.com")
    recordPasswordResetRequest("maria@email.com")
    recordPasswordResetRequest("maria@email.com")

    expect(isPasswordResetLimited("joao@email.com").allowed).toBe(true)
  })

  it("respeita MAX_PASSWORD_RESET_PER_EMAIL custom (1)", async () => {
    process.env.MAX_PASSWORD_RESET_PER_EMAIL = "1"
    vi.resetModules()
    const {
      isPasswordResetLimited,
      recordPasswordResetRequest,
      resetRateLimiter,
    } = await import("@/lib/rate-limit")
    resetRateLimiter()

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

describe("role-based login rate limiter (T27 — RNF-AUTH-004)", () => {
  it("USER: bloqueia apos 5 tentativas em 15min", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"))
    const { isIpLimited, recordIpAttempt, resetRateLimiter } =
      await import("@/lib/rate-limit")
    resetRateLimiter()

    for (let i = 0; i < 5; i++) {
      recordIpAttempt("10.0.0.100")
    }
    const check = isIpLimited("10.0.0.100", "USER")
    expect(check.allowed).toBe(false)
    expect(check.retryAfter).toBe(15 * 60)
  })

  it("PROFESSIONAL: mesmo limite do USER (5/15min)", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"))
    const { isIpLimited, recordIpAttempt, resetRateLimiter } =
      await import("@/lib/rate-limit")
    resetRateLimiter()

    for (let i = 0; i < 5; i++) {
      recordIpAttempt("10.0.0.104")
    }
    expect(isIpLimited("10.0.0.104", "PROFESSIONAL").allowed).toBe(false)
  })

  it("ADMIN: permite ate 19 tentativas, bloqueia na 20a em 15min", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"))
    const { isIpLimited, recordIpAttempt, resetRateLimiter } =
      await import("@/lib/rate-limit")
    resetRateLimiter()

    for (let i = 0; i < 19; i++) {
      recordIpAttempt("10.0.0.101")
    }
    const check = isIpLimited("10.0.0.101", "ADMIN")
    expect(check.allowed).toBe(true)

    recordIpAttempt("10.0.0.101")
    const checkAfter = isIpLimited("10.0.0.101", "ADMIN")
    expect(checkAfter.allowed).toBe(false)
    expect(checkAfter.retryAfter).toBe(15 * 60)
  })

  it("SUPER_ADMIN: mesmo limite do ADMIN (bloqueia na 20a)", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"))
    const { isIpLimited, recordIpAttempt, resetRateLimiter } =
      await import("@/lib/rate-limit")
    resetRateLimiter()

    for (let i = 0; i < 19; i++) {
      recordIpAttempt("10.0.0.102")
    }
    expect(isIpLimited("10.0.0.102", "SUPER_ADMIN").allowed).toBe(true)

    recordIpAttempt("10.0.0.102")
    expect(isIpLimited("10.0.0.102", "SUPER_ADMIN").allowed).toBe(false)
  })

  it("sem role: trata como USER (5/15min)", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"))
    const { isIpLimited, recordIpAttempt, resetRateLimiter } =
      await import("@/lib/rate-limit")
    resetRateLimiter()

    for (let i = 0; i < 5; i++) {
      recordIpAttempt("10.0.0.103")
    }
    expect(isIpLimited("10.0.0.103").allowed).toBe(false)
  })
})

describe("verify-email resend rate limiter (T27 — 1/min por email)", () => {
  it("permite 1 pedido por minuto por email", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"))
    const {
      isVerifyEmailResendLimited,
      recordVerifyEmailResend,
      resetRateLimiter,
    } = await import("@/lib/rate-limit")
    resetRateLimiter()

    expect(isVerifyEmailResendLimited("user@email.com").allowed).toBe(true)
    recordVerifyEmailResend("user@email.com")
    const check = isVerifyEmailResendLimited("user@email.com")
    expect(check.allowed).toBe(false)
    expect(check.retryAfter).toBe(60)
  })

  it("expira apos 1 min e volta a permitir", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"))
    const {
      isVerifyEmailResendLimited,
      recordVerifyEmailResend,
      resetRateLimiter,
    } = await import("@/lib/rate-limit")
    resetRateLimiter()

    recordVerifyEmailResend("user@email.com")
    expect(isVerifyEmailResendLimited("user@email.com").allowed).toBe(false)

    vi.advanceTimersByTime(60 * 1000 + 1000)
    expect(isVerifyEmailResendLimited("user@email.com").allowed).toBe(true)
  })

  it("normaliza email para lowercase", async () => {
    const {
      isVerifyEmailResendLimited,
      recordVerifyEmailResend,
      resetRateLimiter,
    } = await import("@/lib/rate-limit")
    resetRateLimiter()

    recordVerifyEmailResend("USER@EMAIL.COM")
    expect(isVerifyEmailResendLimited("user@email.com").allowed).toBe(false)
  })

  it("isola por email", async () => {
    const {
      isVerifyEmailResendLimited,
      recordVerifyEmailResend,
      resetRateLimiter,
    } = await import("@/lib/rate-limit")
    resetRateLimiter()

    recordVerifyEmailResend("a@email.com")
    expect(isVerifyEmailResendLimited("b@email.com").allowed).toBe(true)
  })
})

describe("register IP rate limiter (T27 — 3/IP/h)", () => {
  it("permite 3 registros por IP por hora", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"))
    const { isRegisterIpLimited, recordRegisterIpAttempt, resetRateLimiter } =
      await import("@/lib/rate-limit")
    resetRateLimiter()

    recordRegisterIpAttempt("10.0.0.10")
    recordRegisterIpAttempt("10.0.0.10")
    recordRegisterIpAttempt("10.0.0.10")
    const check = isRegisterIpLimited("10.0.0.10")
    expect(check.allowed).toBe(false)
    expect(check.retryAfter).toBe(60 * 60)
  })

  it("expira apos 1h", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"))
    const { isRegisterIpLimited, recordRegisterIpAttempt, resetRateLimiter } =
      await import("@/lib/rate-limit")
    resetRateLimiter()

    recordRegisterIpAttempt("10.0.0.10")
    recordRegisterIpAttempt("10.0.0.10")
    recordRegisterIpAttempt("10.0.0.10")
    expect(isRegisterIpLimited("10.0.0.10").allowed).toBe(false)

    vi.advanceTimersByTime(60 * 60 * 1000 + 1000)
    expect(isRegisterIpLimited("10.0.0.10").allowed).toBe(true)
  })

  it("isola por IP", async () => {
    const { isRegisterIpLimited, recordRegisterIpAttempt, resetRateLimiter } =
      await import("@/lib/rate-limit")
    resetRateLimiter()

    recordRegisterIpAttempt("10.0.0.10")
    recordRegisterIpAttempt("10.0.0.10")
    recordRegisterIpAttempt("10.0.0.10")
    expect(isRegisterIpLimited("10.0.0.11").allowed).toBe(true)
  })
})

describe("password-reset IP rate limiter (5/IP/h)", () => {
  it("permite 5 pedidos por IP por hora e bloqueia o 6o", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"))
    const {
      isPasswordResetIpLimited,
      recordPasswordResetIpAttempt,
      resetRateLimiter,
    } = await import("@/lib/rate-limit")
    resetRateLimiter()

    for (let i = 0; i < 5; i++) {
      expect(isPasswordResetIpLimited("10.0.0.20").allowed).toBe(true)
      recordPasswordResetIpAttempt("10.0.0.20")
    }
    const check = isPasswordResetIpLimited("10.0.0.20")
    expect(check.allowed).toBe(false)
    expect(check.retryAfter).toBe(60 * 60)
  })

  it("expira apos 1h", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"))
    const {
      isPasswordResetIpLimited,
      recordPasswordResetIpAttempt,
      resetRateLimiter,
    } = await import("@/lib/rate-limit")
    resetRateLimiter()

    for (let i = 0; i < 5; i++) recordPasswordResetIpAttempt("10.0.0.20")
    expect(isPasswordResetIpLimited("10.0.0.20").allowed).toBe(false)

    vi.advanceTimersByTime(60 * 60 * 1000 + 1000)
    expect(isPasswordResetIpLimited("10.0.0.20").allowed).toBe(true)
  })

  it("isola por IP", async () => {
    const {
      isPasswordResetIpLimited,
      recordPasswordResetIpAttempt,
      resetRateLimiter,
    } = await import("@/lib/rate-limit")
    resetRateLimiter()

    for (let i = 0; i < 5; i++) recordPasswordResetIpAttempt("10.0.0.20")
    expect(isPasswordResetIpLimited("10.0.0.21").allowed).toBe(true)
  })
})

describe("verify-email resend IP rate limiter (5/IP/h)", () => {
  it("permite 5 pedidos por IP por hora e bloqueia o 6o", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"))
    const {
      isVerifyEmailResendIpLimited,
      recordVerifyEmailResendIpAttempt,
      resetRateLimiter,
    } = await import("@/lib/rate-limit")
    resetRateLimiter()

    for (let i = 0; i < 5; i++) {
      expect(isVerifyEmailResendIpLimited("10.0.0.30").allowed).toBe(true)
      recordVerifyEmailResendIpAttempt("10.0.0.30")
    }
    const check = isVerifyEmailResendIpLimited("10.0.0.30")
    expect(check.allowed).toBe(false)
    expect(check.retryAfter).toBe(60 * 60)
  })

  it("expira apos 1h", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"))
    const {
      isVerifyEmailResendIpLimited,
      recordVerifyEmailResendIpAttempt,
      resetRateLimiter,
    } = await import("@/lib/rate-limit")
    resetRateLimiter()

    for (let i = 0; i < 5; i++) recordVerifyEmailResendIpAttempt("10.0.0.30")
    expect(isVerifyEmailResendIpLimited("10.0.0.30").allowed).toBe(false)

    vi.advanceTimersByTime(60 * 60 * 1000 + 1000)
    expect(isVerifyEmailResendIpLimited("10.0.0.30").allowed).toBe(true)
  })

  it("isola por IP", async () => {
    const {
      isVerifyEmailResendIpLimited,
      recordVerifyEmailResendIpAttempt,
      resetRateLimiter,
    } = await import("@/lib/rate-limit")
    resetRateLimiter()

    for (let i = 0; i < 5; i++) recordVerifyEmailResendIpAttempt("10.0.0.30")
    expect(isVerifyEmailResendIpLimited("10.0.0.31").allowed).toBe(true)
  })
})
