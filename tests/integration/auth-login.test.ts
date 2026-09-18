// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { fullActiveUserRow } from "./fixtures/users"

const prismaMock = vi.hoisted(() => ({
  user: {
    findFirst: vi.fn(),
  },
}))

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }))

const tokenServiceMock = vi.hoisted(() => ({
  signAccessToken: vi.fn(),
  createRefreshSession: vi.fn(),
}))

vi.mock("@/services/token-service", () => tokenServiceMock)

const bcryptMock = vi.hoisted(() => ({ compare: vi.fn() }))
vi.mock("bcryptjs", () => ({
  __esModule: true,
  default: { compare: bcryptMock.compare },
}))

const rateLimitMock = vi.hoisted(() => ({
  isAccountLocked: vi.fn(),
  isIpLimited: vi.fn(),
  recordLoginFailure: vi.fn(),
  recordIpAttempt: vi.fn(),
  resetLoginFailures: vi.fn(),
}))
vi.mock("@/lib/rate-limit", () => ({
  resetRateLimiter: vi.fn(),
  ...rateLimitMock,
}))

function validBody() {
  return { email: "maria@email.com", password: "SenhaForte123!" }
}

async function callPost(body: unknown, ip = "127.0.0.1"): Promise<Response> {
  const { POST } = await import("@/app/api/v1/auth/login/route")
  return POST(
    new Request("http://localhost:3000/api/v1/auth/login", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-forwarded-for": ip,
        "x-real-ip": ip,
        "x-csrf-token": "test-csrf-token",
        cookie: "csrf-token=test-csrf-token",
      },
      body: JSON.stringify(body),
    }),
  )
}

beforeEach(() => {
  process.env.AUTH_SECRET = "test-secret"
  vi.clearAllMocks()
  rateLimitMock.isAccountLocked.mockReturnValue({
    allowed: true,
    retryAfter: 0,
  })
  rateLimitMock.isIpLimited.mockReturnValue({ allowed: true, retryAfter: 0 })
  rateLimitMock.recordLoginFailure.mockImplementation(() => undefined)
  rateLimitMock.recordIpAttempt.mockImplementation(() => undefined)
  tokenServiceMock.signAccessToken.mockResolvedValue("access.jwt.token")
  tokenServiceMock.createRefreshSession.mockResolvedValue({
    rawToken: "refresh-raw-token",
    tokenHash: "h".repeat(64),
    familyId: "fam_1",
    tokenId: "tok_1",
    expiresAt: new Date(),
  })
  prismaMock.user.findFirst.mockResolvedValue(null)
})

afterEach(() => {
  delete process.env.AUTH_SECRET
  vi.resetModules()
})

describe("POST /api/v1/auth/login — integration (T29)", () => {
  it("fluxo completo: valida body → check lockout → busca user → bcrypt → JWT + refresh → 200", async () => {
    prismaMock.user.findFirst.mockResolvedValue(fullActiveUserRow())
    bcryptMock.compare.mockResolvedValue(true)

    const res = await callPost(validBody())
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.accessToken).toBe("access.jwt.token")
    expect(json.user).toEqual({
      id: "usr_1",
      name: "Maria Silva",
      email: "maria@email.com",
      displayName: "Maria Silva",
      role: "USER",
      plan: "FREE",
      avatar: null,
    })

    const cookies = res.headers.get("set-cookie") ?? ""
    expect(cookies).toContain("refreshToken=refresh-raw-token")
    expect(cookies).toContain("HttpOnly")
    expect(cookies).toContain("SameSite=Strict")
    expect(cookies).toContain("Path=/api/v1/auth")

    expect(tokenServiceMock.signAccessToken).toHaveBeenCalledWith(
      expect.objectContaining({ id: "usr_1", email: "maria@email.com" }),
    )
    expect(tokenServiceMock.createRefreshSession).toHaveBeenCalledWith(
      "usr_1",
      expect.objectContaining({ ip: "127.0.0.1" }),
    )
  })

  it("retorna 401 quando email não existe", async () => {
    const res = await callPost(validBody())
    const json = await res.json()

    expect(res.status).toBe(401)
    expect(json.error.code).toBe("AUTH_INVALID_CREDENTIALS")
    expect(tokenServiceMock.signAccessToken).not.toHaveBeenCalled()
  })

  it("retorna 401 quando senha está incorreta", async () => {
    prismaMock.user.findFirst.mockResolvedValue(fullActiveUserRow())
    bcryptMock.compare.mockResolvedValue(false)

    const res = await callPost(validBody())
    const json = await res.json()

    expect(res.status).toBe(401)
    expect(json.error.code).toBe("AUTH_INVALID_CREDENTIALS")
  })

  it("retorna 401 AUTH_EMAIL_NOT_VERIFIED quando email não foi verificado", async () => {
    prismaMock.user.findFirst.mockResolvedValue({
      ...fullActiveUserRow(),
      emailVerified: null,
    })
    bcryptMock.compare.mockResolvedValue(true)

    const res = await callPost(validBody())
    const json = await res.json()

    expect(res.status).toBe(401)
    expect(json.error.code).toBe("AUTH_EMAIL_NOT_VERIFIED")
  })

  it("retorna 403 AUTH_ACCOUNT_SUSPENDED quando conta está inativa", async () => {
    prismaMock.user.findFirst.mockResolvedValue({
      ...fullActiveUserRow(),
      isActive: false,
    })

    const res = await callPost(validBody())
    const json = await res.json()

    expect(res.status).toBe(403)
    expect(json.error.code).toBe("AUTH_ACCOUNT_SUSPENDED")
  })

  it("retorna 403 AUTH_ACCOUNT_SUSPENDED quando deletedAt não é null", async () => {
    prismaMock.user.findFirst.mockResolvedValue({
      ...fullActiveUserRow(),
      deletedAt: new Date(),
    })

    const res = await callPost(validBody())
    const json = await res.json()

    expect(res.status).toBe(403)
    expect(json.error.code).toBe("AUTH_ACCOUNT_SUSPENDED")
  })

  it("retorna 422 quando body é invalido", async () => {
    const res = await callPost({ email: "not-an-email" })
    const json = await res.json()

    expect(res.status).toBe(422)
    expect(json.error.code).toBe("VALIDATION_ERROR")
  })

  it("retorna 422 quando body é JSON invalido", async () => {
    const { POST } = await import("@/app/api/v1/auth/login/route")
    const res = await POST(
      new Request("http://localhost:3000/api/v1/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "invalid json",
      }),
    )
    expect(res.status).toBe(422)
  })

  it("retorna 403 AUTH_ACCOUNT_LOCKED quando conta está bloqueada por tentativas", async () => {
    rateLimitMock.isAccountLocked.mockReturnValue({
      allowed: false,
      retryAfter: 60,
    })

    const res = await callPost(validBody())
    const json = await res.json()

    expect(res.status).toBe(403)
    expect(json.error.code).toBe("AUTH_ACCOUNT_LOCKED")
    expect(json.error.retryAfter).toBe(60)
    expect(rateLimitMock.recordLoginFailure).not.toHaveBeenCalled()
  })

  it("retorna 429 AUTH_RATE_LIMITED quando IP excede limite", async () => {
    rateLimitMock.isIpLimited.mockReturnValue({
      allowed: false,
      retryAfter: 45,
    })

    const res = await callPost(validBody(), "10.0.0.1")
    const json = await res.json()

    expect(res.status).toBe(429)
    expect(json.error.code).toBe("AUTH_RATE_LIMITED")
    expect(json.error.retryAfter).toBe(45)
  })
})
