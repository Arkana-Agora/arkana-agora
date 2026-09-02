import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const prismaMock = vi.hoisted(() => ({
  user: {
    findFirst: vi.fn(),
  },
}))

const tokenServiceMock = vi.hoisted(() => ({
  signAccessToken: vi.fn(),
  createRefreshSession: vi.fn(),
}))

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }))
vi.mock("@/services/token-service", () => tokenServiceMock)

const bcryptMock = vi.hoisted(() => ({ compare: vi.fn() }))
vi.mock("bcryptjs", () => ({
  __esModule: true,
  default: { compare: bcryptMock.compare },
}))

const { resetRateLimiter } = await import("@/lib/rate-limit")

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
}

function validBody() {
  return { email: "maria@email.com", password: "SenhaForte123!" }
}

async function callPost(body: unknown, ip = "127.0.0.1"): Promise<Response> {
  const { POST } = await import("@/app/api/v1/auth/login/route")
  return POST(
    new Request("http://localhost:3000/api/v1/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": ip },
      body: JSON.stringify(body),
    }),
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  resetRateLimiter()
  tokenServiceMock.signAccessToken.mockResolvedValue("access.jwt.token")
  tokenServiceMock.createRefreshSession.mockResolvedValue({
    rawToken: "refresh-raw-token",
    tokenHash: "h".repeat(64),
    familyId: "fam_1",
    tokenId: "tok_1",
    expiresAt: new Date(),
  })
  // by default no user found → invalid credentials
  prismaMock.user.findFirst.mockResolvedValue(null)
})

afterEach(() => {
  vi.resetModules()
})

describe("POST /api/v1/auth/login (T7)", () => {
  it("retorna 200 com accessToken e user, e seta cookie refreshToken httpOnly", async () => {
    prismaMock.user.findFirst.mockResolvedValue(activeUser)
    bcryptMock.compare.mockResolvedValue(true)

    const res = await callPost(validBody())
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.accessToken).toBe("access.jwt.token")
    expect(json.user).toEqual({
      id: "usr_1",
      name: "Maria Silva",
      displayName: "Maria Silva",
      email: "maria@email.com",
      role: "USER",
      plan: "FREE",
      avatar: null,
    })
    expect(json.refreshToken).toBeUndefined()
    const setCookie = res.headers.get("set-cookie") ?? ""
    expect(setCookie).toContain("refreshToken=refresh-raw-token")
    expect(setCookie).toContain("HttpOnly")
    expect(setCookie).toContain("Path=/api/v1/auth")
    expect(tokenServiceMock.createRefreshSession).toHaveBeenCalledWith(
      "usr_1",
      expect.objectContaining({ ip: "127.0.0.1" }),
    )
  })

  it("busca usuario por email incluindo passwordHash para comparar", async () => {
    prismaMock.user.findFirst.mockResolvedValue(activeUser)
    bcryptMock.compare.mockResolvedValue(true)

    await callPost(validBody())

    expect(prismaMock.user.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { email: "maria@email.com" },
        select: expect.objectContaining({ passwordHash: true }),
      }),
    )
  })

  it("rejeita senha incorreta com 401 AUTH_INVALID_CREDENTIALS", async () => {
    prismaMock.user.findFirst.mockResolvedValue(activeUser)
    bcryptMock.compare.mockResolvedValue(false)

    const res = await callPost(validBody())
    const json = await res.json()

    expect(res.status).toBe(401)
    expect(json.error.code).toBe("AUTH_INVALID_CREDENTIALS")
    expect(tokenServiceMock.signAccessToken).not.toHaveBeenCalled()
  })

  it("retorna 401 AUTH_INVALID_CREDENTIALS para email inexistente (anti-enumeracao)", async () => {
    prismaMock.user.findFirst.mockResolvedValue(null)

    const res = await callPost(validBody())
    const json = await res.json()

    expect(res.status).toBe(401)
    expect(json.error.code).toBe("AUTH_INVALID_CREDENTIALS")
  })

  it("retorna 401 AUTH_EMAIL_NOT_VERIFIED para credencial valida com email nao verificado", async () => {
    prismaMock.user.findFirst.mockResolvedValue({
      ...activeUser,
      emailVerified: null,
    })
    bcryptMock.compare.mockResolvedValue(true)

    const res = await callPost(validBody())
    const json = await res.json()

    expect(res.status).toBe(401)
    expect(json.error.code).toBe("AUTH_EMAIL_NOT_VERIFIED")
    expect(tokenServiceMock.signAccessToken).not.toHaveBeenCalled()
  })

  it("retorna 403 AUTH_ACCOUNT_LOCKED (retryAfter 900) apos 5 falhas consecutivas", async () => {
    prismaMock.user.findFirst.mockResolvedValue(activeUser)
    bcryptMock.compare.mockResolvedValue(false)

    for (let i = 0; i < 5; i++) {
      const res = await callPost(validBody())
      expect(res.status).toBe(401)
    }

    const res = await callPost(validBody())
    const json = await res.json()
    expect(res.status).toBe(403)
    expect(json.error.code).toBe("AUTH_ACCOUNT_LOCKED")
    expect(json.error.retryAfter).toBe(900)
    // lockout check nao executa bcrypt nem emite token
    expect(bcryptMock.compare).toHaveBeenCalledTimes(5)
  })

  it("retorna 403 AUTH_ACCOUNT_SUSPENDED para conta inativa/deletada", async () => {
    prismaMock.user.findFirst.mockResolvedValue({
      ...activeUser,
      isActive: false,
      deletedAt: new Date(),
    })

    const res = await callPost(validBody())
    const json = await res.json()

    expect(res.status).toBe(403)
    expect(json.error.code).toBe("AUTH_ACCOUNT_SUSPENDED")
  })

  it("retorna 429 quando o limite de IP e atingido", async () => {
    bcryptMock.compare.mockResolvedValue(false)

    for (let i = 0; i < 5; i++) {
      await callPost({ email: `u${i}@email.com`, password: "x" }, "10.0.0.1")
    }

    const res = await callPost(validBody(), "10.0.0.1")
    expect(res.status).toBe(429)
  })

  it("retorna 422 VALIDATION_ERROR para corpo invalido", async () => {
    const res = await callPost({ email: "nao-email", password: "" })
    const json = await res.json()

    expect(res.status).toBe(422)
    expect(json.error.code).toBe("VALIDATION_ERROR")
    expect(json.error.details).toBeTruthy()
    expect(prismaMock.user.findFirst).not.toHaveBeenCalled()
  })

  it("retorna 422 VALIDATION_ERROR para JSON malformado", async () => {
    const { POST } = await import("@/app/api/v1/auth/login/route")
    const res = await POST(
      new Request("http://localhost:3000/api/v1/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{nao json",
      }),
    )
    const json = await res.json()

    expect(res.status).toBe(422)
    expect(json.error.code).toBe("VALIDATION_ERROR")
  })

  it("reset do contador de falhas apos login bem-sucedido", async () => {
    prismaMock.user.findFirst.mockResolvedValue(null)
    bcryptMock.compare.mockResolvedValue(false)

    await callPost(validBody()) // 1 falha

    prismaMock.user.findFirst.mockResolvedValue(activeUser)
    bcryptMock.compare.mockResolvedValue(true)
    const ok = await callPost(validBody())
    expect(ok.status).toBe(200)

    // nova tentativa errada depois do sucesso volta a ser 401, nao lockout
    prismaMock.user.findFirst.mockResolvedValue(activeUser)
    bcryptMock.compare.mockResolvedValue(false)
    const again = await callPost(validBody())
    expect(again.status).toBe(401)
  })
})
