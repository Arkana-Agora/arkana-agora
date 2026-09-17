// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { fullActiveUserRow } from "./fixtures/users"
import { VALID_TOKEN, verificationTokenRow } from "./fixtures/tokens"

const prismaMock = vi.hoisted(() => ({
  user: {
    findFirst: vi.fn(),
  },
  verificationToken: {
    create: vi.fn(),
    findUnique: vi.fn(),
    deleteMany: vi.fn(),
  },
}))

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }))

const sendMagicLinkEmailMock = vi.hoisted(() => vi.fn())
vi.mock("@/lib/email/email", () => ({
  sendMagicLinkEmail: sendMagicLinkEmailMock,
}))

const rateLimitMock = vi.hoisted(() => ({
  isMagicLinkLimited: vi.fn(),
  recordMagicLinkRequest: vi.fn(),
  isMagicLinkIpLimited: vi.fn(),
  recordMagicLinkIpAttempt: vi.fn(),
}))
vi.mock("@/lib/rate-limit", () => rateLimitMock)

const tokenServiceMock = vi.hoisted(() => ({
  signAccessToken: vi.fn(),
  createRefreshSession: vi.fn(),
}))
vi.mock("@/services/token-service", () => tokenServiceMock)

beforeEach(() => {
  vi.clearAllMocks()
  rateLimitMock.isMagicLinkLimited.mockReturnValue({
    allowed: true,
    retryAfter: 0,
  })
  rateLimitMock.recordMagicLinkRequest.mockImplementation(() => undefined)
  rateLimitMock.isMagicLinkIpLimited.mockReturnValue({
    allowed: true,
    retryAfter: 0,
  })
  rateLimitMock.recordMagicLinkIpAttempt.mockImplementation(() => undefined)
  prismaMock.user.findFirst.mockResolvedValue(
    fullActiveUserRow({ id: "usr_magic1" }),
  )
  prismaMock.verificationToken.create.mockResolvedValue({ id: "vt_1" })
  sendMagicLinkEmailMock.mockResolvedValue({ data: { id: "em_1" } })
  prismaMock.verificationToken.findUnique.mockResolvedValue(
    verificationTokenRow({
      type: "MAGIC_LINK",
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      createdAt: new Date(Date.now() - 10 * 60 * 1000),
    }),
  )
  prismaMock.verificationToken.deleteMany.mockResolvedValue({ count: 1 })
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

describe("POST /api/v1/auth/magic-link — integration (T29)", () => {
  async function callMagicLink(body: unknown): Promise<Response> {
    const { POST } = await import("@/app/api/v1/auth/magic-link/route")
    return POST(
      new Request("http://localhost:3000/api/v1/auth/magic-link", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      }),
    )
  }

  it("fluxo completo: valida body → rate limit → busca user → cria token → envia email → 200", async () => {
    const res = await callMagicLink({ email: "maria@email.com" })
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.message).toContain("Magic link")
    expect(prismaMock.verificationToken.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          identifier: "maria@email.com",
          type: "MAGIC_LINK",
        }),
      }),
    )
    expect(sendMagicLinkEmailMock).toHaveBeenCalledWith(
      "maria@email.com",
      expect.objectContaining({
        url: expect.stringContaining("/auth/login?token="),
      }),
    )
  })

  it("retorna 200 anti-enumeracao quando email não existe", async () => {
    prismaMock.user.findFirst.mockResolvedValue(null)

    const res = await callMagicLink({ email: "unknown@email.com" })
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.message).toContain("Magic link")
    expect(prismaMock.verificationToken.create).not.toHaveBeenCalled()
  })

  it("retorna 429 quando rate limit é atingido", async () => {
    rateLimitMock.isMagicLinkLimited.mockReturnValue({
      allowed: false,
      retryAfter: 120,
    })

    const res = await callMagicLink({ email: "maria@email.com" })
    const json = await res.json()

    expect(res.status).toBe(429)
    expect(json.error.retryAfter).toBe(120)
  })
})

describe("POST /api/v1/auth/magic-link/verify — integration (T29)", () => {
  async function callVerify(body: unknown): Promise<Response> {
    const { POST } = await import("@/app/api/v1/auth/magic-link/verify/route")
    return POST(
      new Request("http://localhost:3000/api/v1/auth/magic-link/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      }),
    )
  }

  it("fluxo completo: valida token → busca user → emite JWT + refresh → 200", async () => {
    const res = await callVerify({ token: VALID_TOKEN })
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.accessToken).toBe("access.jwt.token")
    expect(json.user).toEqual(
      expect.objectContaining({
        id: "usr_magic1",
        email: "maria@email.com",
      }),
    )
    expect(prismaMock.verificationToken.deleteMany).toHaveBeenCalled()
  })

  it("retorna 401 quando token não existe", async () => {
    prismaMock.verificationToken.findUnique.mockResolvedValue(null)

    const res = await callVerify({ token: "nonexistent" })
    const json = await res.json()

    expect(res.status).toBe(401)
    expect(json.error.code).toBe("AUTH_MAGIC_TOKEN_INVALID")
  })

  it("retorna 410 quando token está expirado", async () => {
    prismaMock.verificationToken.findUnique.mockResolvedValue(
      verificationTokenRow({
        type: "MAGIC_LINK",
        expiresAt: new Date(Date.now() - 60_000),
        createdAt: new Date(Date.now() - 10 * 60 * 1000),
      }),
    )

    const res = await callVerify({ token: VALID_TOKEN })
    const json = await res.json()

    expect(res.status).toBe(410)
    expect(json.error.code).toBe("AUTH_MAGIC_TOKEN_EXPIRED")
  })

  it("retorna 422 quando body não contém token", async () => {
    const res = await callVerify({})
    expect(res.status).toBe(422)
  })

  it("retorna 401 quando token já foi utilizado (single-use)", async () => {
    prismaMock.verificationToken.deleteMany.mockResolvedValue({ count: 0 })

    const res = await callVerify({ token: VALID_TOKEN })
    const json = await res.json()

    expect(res.status).toBe(401)
    expect(json.error.code).toBe("AUTH_MAGIC_TOKEN_INVALID")
  })

  it("retorna 401 quando token é de outro tipo (cross-contamination)", async () => {
    prismaMock.verificationToken.findUnique.mockResolvedValue(
      verificationTokenRow({ type: "EMAIL" }),
    )

    const res = await callVerify({ token: VALID_TOKEN })
    const json = await res.json()

    expect(res.status).toBe(401)
    expect(json.error.code).toBe("AUTH_MAGIC_TOKEN_INVALID")
  })

  it("retorna 401 quando usuário está inativo/deletado", async () => {
    prismaMock.user.findFirst.mockResolvedValue({
      id: "usr_magic1",
      email: "maria@email.com",
      isActive: false,
      deletedAt: null,
    })

    const res = await callVerify({ token: VALID_TOKEN })
    const json = await res.json()

    expect(res.status).toBe(401)
    expect(json.error.code).toBe("AUTH_MAGIC_TOKEN_INVALID")
  })
})
