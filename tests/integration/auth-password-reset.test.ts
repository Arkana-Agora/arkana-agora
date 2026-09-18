// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { activeUserRow } from "./fixtures/users"
import { VALID_TOKEN, passwordResetTokenRow } from "./fixtures/tokens"

const prismaMock = vi.hoisted(() => ({
  user: {
    findFirst: vi.fn(),
    update: vi.fn(),
  },
  verificationToken: {
    create: vi.fn(),
    findUnique: vi.fn(),
    deleteMany: vi.fn(),
  },
}))

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }))

const sendPasswordResetEmailMock = vi.hoisted(() => vi.fn())
vi.mock("@/lib/email/email", () => ({
  sendPasswordResetEmail: sendPasswordResetEmailMock,
}))

const tokenServiceMock = vi.hoisted(() => ({
  revokeAllSessions: vi.fn(),
}))
vi.mock("@/services/token-service", () => tokenServiceMock)

const rateLimitMock = vi.hoisted(() => ({
  isPasswordResetLimited: vi.fn(),
  recordPasswordResetRequest: vi.fn(),
}))
vi.mock("@/lib/rate-limit", () => rateLimitMock)

const validPassword = "SenhaForte123!"

beforeEach(() => {
  vi.clearAllMocks()
  rateLimitMock.isPasswordResetLimited.mockReturnValue({
    allowed: true,
    retryAfter: 0,
  })
  rateLimitMock.recordPasswordResetRequest.mockImplementation(() => undefined)
  prismaMock.user.findFirst.mockResolvedValue(
    activeUserRow({ id: "usr_reset1" }),
  )
  prismaMock.verificationToken.create.mockResolvedValue({ id: "vt_1" })
  sendPasswordResetEmailMock.mockResolvedValue({ data: { id: "em_1" } })
  prismaMock.verificationToken.findUnique.mockResolvedValue(
    passwordResetTokenRow(),
  )
  prismaMock.verificationToken.deleteMany.mockResolvedValue({ count: 1 })
  prismaMock.user.update.mockResolvedValue({
    id: "usr_reset1",
    email: "maria@email.com",
    tokenVersion: 1,
  })
  tokenServiceMock.revokeAllSessions.mockResolvedValue(undefined)
})

afterEach(() => {
  vi.resetModules()
})

describe("POST /api/v1/auth/forgot-password — integration (T29)", () => {
  async function callForgot(body: unknown): Promise<Response> {
    const { POST } = await import("@/app/api/v1/auth/forgot-password/route")
    return POST(
      new Request("http://localhost:3000/api/v1/auth/forgot-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      }),
    )
  }

  it("fluxo completo: valida body → rate limit → busca user → cria token → envia email → 200", async () => {
    const res = await callForgot({ email: "maria@email.com" })
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.message).toBeTruthy()
    expect(prismaMock.user.findFirst).toHaveBeenCalled()
    expect(prismaMock.verificationToken.create).toHaveBeenCalled()
    expect(sendPasswordResetEmailMock).toHaveBeenCalled()
    expect(rateLimitMock.recordPasswordResetRequest).toHaveBeenCalledWith(
      "maria@email.com",
    )
  })

  it("retorna 200 anti-enumeracao quando email não existe", async () => {
    prismaMock.user.findFirst.mockResolvedValue(null)

    const res = await callForgot({ email: "unknown@email.com" })
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.message).toBeTruthy()
    expect(prismaMock.verificationToken.create).not.toHaveBeenCalled()
  })

  it("retorna 429 quando rate limit é atingido", async () => {
    rateLimitMock.isPasswordResetLimited.mockReturnValue({
      allowed: false,
      retryAfter: 90,
    })

    const res = await callForgot({ email: "maria@email.com" })
    const json = await res.json()

    expect(res.status).toBe(429)
    expect(json.error.retryAfter).toBe(90)
  })
})

describe("POST /api/v1/auth/reset-password — integration (T29)", () => {
  async function callReset(body: unknown): Promise<Response> {
    const { POST } = await import("@/app/api/v1/auth/reset-password/route")
    return POST(
      new Request("http://localhost:3000/api/v1/auth/reset-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      }),
    )
  }

  it("fluxo completo: valida token → redefini senha → revoga sessões → 200", async () => {
    const res = await callReset({
      token: VALID_TOKEN,
      password: validPassword,
      passwordConfirmation: validPassword,
    })
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.message).toContain("sucesso")
    expect(prismaMock.user.update).toHaveBeenCalled()
    expect(tokenServiceMock.revokeAllSessions).toHaveBeenCalled()
    expect(prismaMock.verificationToken.deleteMany).toHaveBeenCalled()
  })

  it("retorna 401 quando token não existe", async () => {
    prismaMock.verificationToken.findUnique.mockResolvedValue(null)

    const res = await callReset({
      token: "nonexistent",
      password: validPassword,
      passwordConfirmation: validPassword,
    })
    const json = await res.json()

    expect(res.status).toBe(401)
    expect(json.error.code).toBe("AUTH_RESET_TOKEN_INVALID")
  })

  it("retorna 410 quando token está expirado", async () => {
    prismaMock.verificationToken.findUnique.mockResolvedValue(
      passwordResetTokenRow({ expiresAt: new Date(Date.now() - 60_000) }),
    )

    const res = await callReset({
      token: VALID_TOKEN,
      password: validPassword,
      passwordConfirmation: validPassword,
    })
    const json = await res.json()

    expect(res.status).toBe(410)
    expect(json.error.code).toBe("AUTH_RESET_TOKEN_EXPIRED")
  })

  it("retorna 422 quando senhas não conferem", async () => {
    const res = await callReset({
      token: VALID_TOKEN,
      password: validPassword,
      passwordConfirmation: "DifferentPassword123!",
    })
    const json = await res.json()

    expect(res.status).toBe(422)
    expect(json.error.code).toBe("VALIDATION_ERROR")
  })

  it("retorna 401 quando token já foi utilizado (single-use)", async () => {
    prismaMock.verificationToken.deleteMany.mockResolvedValue({ count: 0 })

    const res = await callReset({
      token: VALID_TOKEN,
      password: validPassword,
      passwordConfirmation: validPassword,
    })
    const json = await res.json()

    expect(res.status).toBe(401)
    expect(json.error.code).toBe("AUTH_RESET_TOKEN_INVALID")
  })

  it("retorna 401 quando token é de outro tipo (cross-contamination)", async () => {
    prismaMock.verificationToken.findUnique.mockResolvedValue(
      passwordResetTokenRow({ type: "EMAIL" }),
    )

    const res = await callReset({
      token: VALID_TOKEN,
      password: validPassword,
      passwordConfirmation: validPassword,
    })
    const json = await res.json()

    expect(res.status).toBe(401)
    expect(json.error.code).toBe("AUTH_RESET_TOKEN_INVALID")
  })

  it("retorna 401 quando usuário está inativo/deletado", async () => {
    prismaMock.user.findFirst.mockResolvedValue({
      id: "usr_reset1",
      email: "maria@email.com",
      isActive: false,
      deletedAt: null,
    })

    const res = await callReset({
      token: VALID_TOKEN,
      password: validPassword,
      passwordConfirmation: validPassword,
    })
    const json = await res.json()

    expect(res.status).toBe(401)
    expect(json.error.code).toBe("AUTH_RESET_TOKEN_INVALID")
  })
})
