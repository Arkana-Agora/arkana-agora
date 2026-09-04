import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const prismaMock = vi.hoisted(() => ({
  user: {
    findFirst: vi.fn(),
  },
  verificationToken: {
    findUnique: vi.fn(),
    deleteMany: vi.fn(),
  },
}))

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }))

const tokenServiceMock = vi.hoisted(() => ({
  signAccessToken: vi.fn(),
  createRefreshSession: vi.fn(),
}))
vi.mock("@/services/token-service", () => tokenServiceMock)

const activeUser = {
  id: "usr_verify1",
  name: "Maria Silva",
  email: "maria@email.com",
  displayName: "Maria Silva",
  role: "USER",
  plan: "FREE",
  avatar: null,
  isActive: true,
  deletedAt: null,
  tokenVersion: 0,
}

const validToken = "a".repeat(64)

function validTokenRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "vt_1",
    identifier: "maria@email.com",
    token: validToken,
    type: "MAGIC_LINK",
    expiresAt: new Date(Date.now() + 5 * 60 * 1000),
    createdAt: new Date(Date.now() - 10 * 60 * 1000),
    ...overrides,
  }
}

async function callPost(
  body: unknown,
  extraHeaders: Record<string, string> = {},
): Promise<Response> {
  const { POST } = await import("@/app/api/v1/auth/magic-link/verify/route")
  return POST(
    new Request("http://localhost:3000/api/v1/auth/magic-link/verify", {
      method: "POST",
      headers: { "content-type": "application/json", ...extraHeaders },
      body: JSON.stringify(body),
    }),
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  prismaMock.verificationToken.findUnique.mockResolvedValue(validTokenRow())
  prismaMock.verificationToken.deleteMany.mockResolvedValue({ count: 1 })
  prismaMock.user.findFirst.mockResolvedValue(activeUser)
  tokenServiceMock.signAccessToken.mockResolvedValue("access.jwt.token")
  tokenServiceMock.createRefreshSession.mockResolvedValue({
    rawToken: "refresh_raw",
    tokenHash: "hash",
    familyId: "fam_1",
    tokenId: "tok_1",
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  })
})

afterEach(() => {
  vi.resetModules()
})

describe("POST /api/v1/auth/magic-link/verify (T10)", () => {
  it("redime token MAGIC_LINK (single-use) e retorna 200 { accessToken, user } + Set-Cookie", async () => {
    const res = await callPost({ token: validToken })
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.accessToken).toBe("access.jwt.token")
    expect(json.user.id).toBe("usr_verify1")
    expect(json.user.email).toBe("maria@email.com")

    expect(prismaMock.verificationToken.findUnique).toHaveBeenCalledWith({
      where: { token: validToken },
    })
    expect(prismaMock.verificationToken.deleteMany).toHaveBeenCalledTimes(1)
    expect(tokenServiceMock.signAccessToken).toHaveBeenCalledTimes(1)
    expect(tokenServiceMock.createRefreshSession).toHaveBeenCalledTimes(1)
    expect(tokenServiceMock.createRefreshSession).toHaveBeenCalledWith(
      "usr_verify1",
      expect.any(Object),
    )

    const setCookie = res.headers.get("set-cookie")
    expect(setCookie).toBeTruthy()
    expect(setCookie).toContain("refreshToken=refresh_raw")
    expect(setCookie).toContain("HttpOnly")
    expect(setCookie).toContain("Path=/api/v1/auth")
    expect(setCookie).toContain("SameSite=Strict")
    expect(setCookie).toContain("Max-Age=2592000")
  })

  it("valida token e retorna 422 VALIDATION_ERROR para corpo sem token", async () => {
    const res = await callPost({})
    const json = await res.json()

    expect(res.status).toBe(422)
    expect(json.error.code).toBe("VALIDATION_ERROR")
    expect(prismaMock.verificationToken.findUnique).not.toHaveBeenCalled()
  })

  it("retorna 422 VALIDATION_ERROR para token vazio", async () => {
    const res = await callPost({ token: "" })
    const json = await res.json()

    expect(res.status).toBe(422)
    expect(json.error.code).toBe("VALIDATION_ERROR")
  })

  it("retorna 422 VALIDATION_ERROR para corpo invalido (nao-JSON)", async () => {
    const { POST } = await import("@/app/api/v1/auth/magic-link/verify/route")
    const res = await POST(
      new Request("http://localhost:3000/api/v1/auth/magic-link/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "nao é json",
      }),
    )
    const json = await res.json()

    expect(res.status).toBe(422)
    expect(json.error.code).toBe("VALIDATION_ERROR")
  })

  it("retorna 401 AUTH_MAGIC_TOKEN_INVALID quando token nao existe", async () => {
    prismaMock.verificationToken.findUnique.mockResolvedValue(null)

    const res = await callPost({ token: "nao-existe" })
    const json = await res.json()

    expect(res.status).toBe(401)
    expect(json.error.code).toBe("AUTH_MAGIC_TOKEN_INVALID")
    expect(tokenServiceMock.signAccessToken).not.toHaveBeenCalled()
    expect(prismaMock.verificationToken.deleteMany).not.toHaveBeenCalled()
  })

  it("retorna 401 AUTH_MAGIC_TOKEN_INVALID quando tipo nao e MAGIC_LINK", async () => {
    prismaMock.verificationToken.findUnique.mockResolvedValue(
      validTokenRow({ type: "EMAIL" }),
    )

    const res = await callPost({ token: validToken })
    const json = await res.json()

    expect(res.status).toBe(401)
    expect(json.error.code).toBe("AUTH_MAGIC_TOKEN_INVALID")
    expect(tokenServiceMock.signAccessToken).not.toHaveBeenCalled()
  })

  it("retorna 410 AUTH_MAGIC_TOKEN_EXPIRED para token expirado (15 min)", async () => {
    prismaMock.verificationToken.findUnique.mockResolvedValue(
      validTokenRow({ expiresAt: new Date(Date.now() - 60 * 1000) }),
    )

    const res = await callPost({ token: validToken })
    const json = await res.json()

    expect(res.status).toBe(410)
    expect(json.error.code).toBe("AUTH_MAGIC_TOKEN_EXPIRED")
    expect(tokenServiceMock.signAccessToken).not.toHaveBeenCalled()
    expect(prismaMock.verificationToken.deleteMany).toHaveBeenCalled()
  })

  it("retorna 401 AUTH_MAGIC_TOKEN_INVALID quando token ja usado (single-use, deleteMany count 0)", async () => {
    prismaMock.verificationToken.deleteMany.mockResolvedValue({ count: 0 })

    const res = await callPost({ token: validToken })
    const json = await res.json()

    expect(res.status).toBe(401)
    expect(json.error.code).toBe("AUTH_MAGIC_TOKEN_INVALID")
    expect(tokenServiceMock.signAccessToken).not.toHaveBeenCalled()
    expect(prismaMock.verificationToken.deleteMany).toHaveBeenCalledTimes(1)
  })

  it("LGPD: nao re-autentica usuario isActive=false mesmo com token vigente (401 sem acesso)", async () => {
    prismaMock.user.findFirst.mockResolvedValue({
      ...activeUser,
      isActive: false,
    })

    const res = await callPost({ token: validToken })
    const json = await res.json()

    expect(res.status).toBe(401)
    expect(json.error.code).toBe("AUTH_MAGIC_TOKEN_INVALID")
    expect(tokenServiceMock.signAccessToken).not.toHaveBeenCalled()
    expect(prismaMock.verificationToken.deleteMany).toHaveBeenCalled()
  })

  it("LGPD: nao re-autentica usuario deletado (deletedAt != null) mesmo com token vigente (401)", async () => {
    prismaMock.user.findFirst.mockResolvedValue({
      ...activeUser,
      deletedAt: new Date("2026-08-01T00:00:00Z"),
    })

    const res = await callPost({ token: validToken })
    const json = await res.json()

    expect(res.status).toBe(401)
    expect(json.error.code).toBe("AUTH_MAGIC_TOKEN_INVALID")
    expect(tokenServiceMock.signAccessToken).not.toHaveBeenCalled()
    expect(prismaMock.verificationToken.deleteMany).toHaveBeenCalled()
  })

  it("retorna 401 AUTH_MAGIC_TOKEN_INVALID quando usuario por identifier nao encontrado", async () => {
    prismaMock.user.findFirst.mockResolvedValue(null)

    const res = await callPost({ token: validToken })
    const json = await res.json()

    expect(res.status).toBe(401)
    expect(json.error.code).toBe("AUTH_MAGIC_TOKEN_INVALID")
    expect(tokenServiceMock.signAccessToken).not.toHaveBeenCalled()
  })

  it("passa ip e userAgent para createRefreshSession", async () => {
    await callPost(
      { token: validToken },
      { "x-forwarded-for": "203.0.113.7", "user-agent": "TestAgent/1.0" },
    )

    expect(tokenServiceMock.createRefreshSession).toHaveBeenCalledWith(
      "usr_verify1",
      { ip: "203.0.113.7", userAgent: "TestAgent/1.0" },
    )
  })

  it("retorna 500 INTERNAL_ERROR com meta.requestId em erro de banco", async () => {
    prismaMock.verificationToken.findUnique.mockRejectedValue(
      new Error("db down"),
    )

    const res = await callPost({ token: validToken })
    const json = await res.json()

    expect(res.status).toBe(500)
    expect(json.error.code).toBe("INTERNAL_ERROR")
    expect(json.meta.requestId).toBeTruthy()
  })

  it("inclui meta.requestId nas respostas de erro (C13)", async () => {
    prismaMock.verificationToken.findUnique.mockResolvedValue(null)

    const res = await callPost({ token: validToken })
    const json = await res.json()

    expect(res.status).toBe(401)
    expect(typeof json.meta.requestId).toBe("string")
    expect(json.meta.requestId.length).toBeGreaterThan(0)
  })
})
