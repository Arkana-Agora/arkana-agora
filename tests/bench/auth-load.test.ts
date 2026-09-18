// @vitest-environment node
/**
 * T32 — Teste de carga leve (NFR RNF-AUTH-001)
 *
 * Mede P95 de latência das 4 operações críticas de auth com dependências mocked.
 * Critério de aceite: P95 < 500ms em carga normal.
 *
 * Método: executa cada endpoint N vezes, coleta tempos, calcula P95.
 * Nota: com mocks, a latência real é ~0ms. O objetivo é estabelecer
 * a infra de benchmarking e ter um regression test para performance.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const ITERATIONS = 100

function p95(times: number[]): number {
  const sorted = [...times].sort((a, b) => a - b)
  const idx = Math.ceil(sorted.length * 0.95) - 1
  return sorted[idx] as number
}

async function measureP95(
  fn: () => Promise<unknown>,
  n: number,
): Promise<number> {
  const times: number[] = []
  for (let i = 0; i < n; i++) {
    const start = performance.now()
    await fn()
    times.push(performance.now() - start)
  }
  return p95(times)
}

describe("T32 — NFR RNF-AUTH-001: P95 < 500ms", () => {
  // ── Shared mocks ────────────────────────────────────────────────────────
  const prismaMock = vi.hoisted(() => ({
    user: { findFirst: vi.fn(), create: vi.fn() },
    verificationToken: { create: vi.fn() },
    $transaction: vi.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
  }))
  const tokenServiceMock = vi.hoisted(() => ({
    signAccessToken: vi.fn(),
    createRefreshSession: vi.fn(),
    rotateRefresh: vi.fn(),
    verifyAccessToken: vi.fn(),
    revokeRefreshSession: vi.fn(),
    revokeAllSessions: vi.fn(),
  }))
  const bcryptMock = vi.hoisted(() => ({ compare: vi.fn() }))
  const rateLimitMock = vi.hoisted(() => ({
    isAccountLocked: vi.fn(),
    isIpLimited: vi.fn(),
    recordLoginFailure: vi.fn(),
    recordIpAttempt: vi.fn(),
    resetLoginFailures: vi.fn(),
    resetRateLimiter: vi.fn(),
    isRegisterIpLimited: vi.fn(),
    isRegisterLimited: vi.fn(),
    recordRegisterAttempt: vi.fn(),
    recordRegisterIpAttempt: vi.fn(),
  }))
  const emailMock = vi.hoisted(() => vi.fn())
  const csrfMock = vi.hoisted(() => ({ validateCsrfToken: vi.fn() }))

  vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }))
  vi.mock("@/services/token-service", () => tokenServiceMock)
  vi.mock("bcryptjs", () => ({
    __esModule: true,
    default: { compare: bcryptMock.compare },
  }))
  vi.mock("@/lib/rate-limit", () => rateLimitMock)
  vi.mock("@/lib/email/email", () => ({
    sendVerificationEmail: emailMock,
    sendMagicLinkEmail: emailMock,
    sendPasswordResetEmail: emailMock,
    sendAccountDeletionEmail: emailMock,
  }))
  vi.mock("@/lib/csrf", () => csrfMock)
  vi.mock("next-auth/jwt", () => ({
    encode: vi.fn().mockResolvedValue("mocked-session-token"),
  }))

  const activeUser = {
    id: "usr_1",
    name: "Maria Silva",
    displayName: "Maria Silva",
    email: "maria@email.com",
    passwordHash: "$2a$12$hash",
    role: "USER",
    plan: "FREE",
    avatar: null,
    isActive: true,
    deletedAt: null,
    emailVerified: new Date(),
    tokenVersion: 0,
  }

  beforeEach(() => {
    process.env.AUTH_SECRET = "test-secret"
    vi.clearAllMocks()

    // Login/register defaults
    rateLimitMock.isAccountLocked.mockReturnValue({
      allowed: true,
      retryAfter: 0,
    })
    rateLimitMock.isIpLimited.mockReturnValue({ allowed: true, retryAfter: 0 })
    rateLimitMock.recordLoginFailure.mockImplementation(() => undefined)
    rateLimitMock.recordIpAttempt.mockImplementation(() => undefined)
    rateLimitMock.isRegisterIpLimited.mockReturnValue({
      allowed: true,
      retryAfter: 0,
    })
    rateLimitMock.isRegisterLimited.mockReturnValue({
      allowed: true,
      retryAfter: 0,
    })
    rateLimitMock.recordRegisterAttempt.mockImplementation(() => undefined)
    rateLimitMock.recordRegisterIpAttempt.mockImplementation(() => undefined)
    csrfMock.validateCsrfToken.mockReturnValue(true)
    prismaMock.user.findFirst.mockResolvedValue(activeUser)
    prismaMock.user.create.mockResolvedValue({
      ...activeUser,
      emailVerified: null,
      provider: "EMAIL",
      providerId: "maria@email.com",
    })
    prismaMock.verificationToken.create.mockResolvedValue({ id: "vt_1" })
    emailMock.mockResolvedValue({ data: { id: "em_1" } })

    // Token service defaults
    tokenServiceMock.signAccessToken.mockResolvedValue("access.jwt.token")
    tokenServiceMock.createRefreshSession.mockResolvedValue({
      rawToken: "refresh-raw-token",
      tokenHash: "h".repeat(64),
      familyId: "fam_1",
      tokenId: "tok_1",
      expiresAt: new Date(),
    })
    tokenServiceMock.rotateRefresh.mockResolvedValue({
      accessToken: "access.jwt.token",
      refreshToken: "new-refresh-token",
      expiresIn: 900,
      user: {
        id: "usr_1",
        name: "Alice",
        email: "alice@example.com",
        displayName: null,
        avatar: null,
        role: "USER",
        plan: "FREE",
        emailVerified: true,
      },
    })
    tokenServiceMock.verifyAccessToken.mockResolvedValue({
      userId: "usr_1",
      role: "USER",
      plan: "FREE",
      tokenVersion: 1,
    })
    tokenServiceMock.revokeRefreshSession.mockResolvedValue(undefined)
    tokenServiceMock.revokeAllSessions.mockResolvedValue(undefined)

    // bcrypt
    bcryptMock.compare.mockResolvedValue(true)
  })

  afterEach(() => {
    delete process.env.AUTH_SECRET
    vi.resetModules()
  })

  // ── Login ───────────────────────────────────────────────────────────────
  it(`login P95 < 500ms (${ITERATIONS} iteracoes)`, async () => {
    const { POST } = await import("@/app/api/v1/auth/login/route")
    const body = JSON.stringify({
      email: "maria@email.com",
      password: "SenhaForte123!",
    })

    const p95Time = await measureP95(async () => {
      await POST(
        new Request("http://localhost:3000/api/v1/auth/login", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-forwarded-for": "127.0.0.1",
          },
          body,
        }),
      )
    }, ITERATIONS)

    expect(p95Time).toBeLessThan(500)
  })

  // ── Register ────────────────────────────────────────────────────────────
  it(`register P95 < 500ms (${ITERATIONS} iteracoes)`, async () => {
    prismaMock.user.findFirst.mockResolvedValue(null)
    const { POST } = await import("@/app/api/v1/auth/register/route")
    const body = JSON.stringify({
      name: "Maria Silva",
      email: "maria@email.com",
      password: "SenhaForte123!",
      passwordConfirmation: "SenhaForte123!",
      acceptTerms: true,
    })

    const p95Time = await measureP95(async () => {
      await POST(
        new Request("http://localhost:3000/api/v1/auth/register", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-forwarded-for": "127.0.0.1",
          },
          body,
        }),
      )
    }, ITERATIONS)

    expect(p95Time).toBeLessThan(500)
  })

  // ── Refresh ─────────────────────────────────────────────────────────────
  it(`refresh P95 < 500ms (${ITERATIONS} iteracoes)`, async () => {
    const { POST } = await import("@/app/api/v1/auth/refresh/route")

    const p95Time = await measureP95(async () => {
      await POST(
        new Request("http://localhost:3000/api/v1/auth/refresh", {
          method: "POST",
          headers: { cookie: "refreshToken=old-refresh-token" },
        }),
      )
    }, ITERATIONS)

    expect(p95Time).toBeLessThan(500)
  })

  // ── Logout ──────────────────────────────────────────────────────────────
  it(`logout P95 < 500ms (${ITERATIONS} iteracoes)`, async () => {
    const { POST } = await import("@/app/api/v1/auth/logout/route")

    const p95Time = await measureP95(async () => {
      await POST(
        new Request("http://localhost:3000/api/v1/auth/logout", {
          method: "POST",
          headers: {
            authorization: "Bearer access.jwt",
            cookie: "refreshToken=rt-token",
          },
        }),
      )
    }, ITERATIONS)

    expect(p95Time).toBeLessThan(500)
  })
})
