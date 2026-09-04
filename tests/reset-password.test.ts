import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import bcrypt from "bcryptjs"

const prismaMock = vi.hoisted(() => ({
  user: {
    findFirst: vi.fn(),
    update: vi.fn(),
  },
  verificationToken: {
    findUnique: vi.fn(),
    deleteMany: vi.fn(),
  },
}))

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }))

const tokenServiceMock = vi.hoisted(() => ({
  revokeAllSessions: vi.fn(),
}))
vi.mock("@/services/token-service", () => tokenServiceMock)

const validToken = "b".repeat(64)
const validPassword = "SenhaForte123!"

function validTokenRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "vt_1",
    identifier: "maria@email.com",
    token: validToken,
    type: "PASSWORD_RESET",
    expiresAt: new Date(Date.now() + 30 * 60 * 1000),
    ...overrides,
  }
}

function activeUserRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "usr_reset1",
    isActive: true,
    deletedAt: null,
    ...overrides,
  }
}

async function callPost(
  body: unknown,
  extraHeaders: Record<string, string> = {},
): Promise<Response> {
  const { POST } = await import("@/app/api/v1/auth/reset-password/route")
  return POST(
    new Request("http://localhost:3000/api/v1/auth/reset-password", {
      method: "POST",
      headers: { "content-type": "application/json", ...extraHeaders },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  prismaMock.verificationToken.findUnique.mockResolvedValue(validTokenRow())
  prismaMock.verificationToken.deleteMany.mockResolvedValue({ count: 1 })
  prismaMock.user.findFirst.mockResolvedValue(activeUserRow())
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

describe("POST /api/v1/auth/reset-password (T12)", () => {
  it("redefine a senha com bcrypt custo 12, invalida sessoes e retorna 200 flat { message }", async () => {
    const res = await callPost({
      token: validToken,
      password: validPassword,
      passwordConfirmation: validPassword,
    })
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.message).toBe("Senha redefinida com sucesso")

    expect(prismaMock.verificationToken.findUnique).toHaveBeenCalledWith({
      where: { token: validToken },
    })
    expect(prismaMock.verificationToken.deleteMany).toHaveBeenCalled()

    expect(prismaMock.user.update).toHaveBeenCalledTimes(1)
    const data = prismaMock.user.update.mock.calls[0]![0].data
    expect(data.passwordHash).not.toBe(validPassword)
    expect(data.passwordHash).toMatch(/^\$2[aby]\$12\$/)
    expect(bcrypt.compareSync(validPassword, data.passwordHash)).toBe(true)

    expect(tokenServiceMock.revokeAllSessions).toHaveBeenCalledWith(
      "usr_reset1",
    )

    const revokeOrder =
      tokenServiceMock.revokeAllSessions.mock.invocationCallOrder[0]!
    const updateOrder = prismaMock.user.update.mock.invocationCallOrder[0]!
    expect(revokeOrder).toBeLessThan(updateOrder)
  })

  it("valida token e retorna 422 VALIDATION_ERROR para corpo sem campos", async () => {
    const res = await callPost({})
    const json = await res.json()

    expect(res.status).toBe(422)
    expect(json.error.code).toBe("VALIDATION_ERROR")
    expect(prismaMock.verificationToken.findUnique).not.toHaveBeenCalled()
  })

  it("retorna 422 VALIDATION_ERROR para senha fraca (mesmas regras do cadastro)", async () => {
    const res = await callPost({
      token: validToken,
      password: "abc",
      passwordConfirmation: "abc",
    })
    const json = await res.json()

    expect(res.status).toBe(422)
    expect(json.error.code).toBe("VALIDATION_ERROR")
    expect(json.error.details).toBeTruthy()
    expect(prismaMock.verificationToken.findUnique).not.toHaveBeenCalled()
  })

  it("retorna 422 VALIDATION_ERROR quando passwordConfirmation difere", async () => {
    const res = await callPost({
      token: validToken,
      password: validPassword,
      passwordConfirmation: "OutraSenha123!",
    })
    const json = await res.json()

    expect(res.status).toBe(422)
    expect(json.error.code).toBe("VALIDATION_ERROR")
    expect(json.error.details).toBeTruthy()
  })

  it("retorna 422 VALIDATION_ERROR para token acima do tamanho maximo (256)", async () => {
    const res = await callPost({
      token: "c".repeat(257),
      password: validPassword,
      passwordConfirmation: validPassword,
    })
    const json = await res.json()

    expect(res.status).toBe(422)
    expect(json.error.code).toBe("VALIDATION_ERROR")
    expect(prismaMock.verificationToken.findUnique).not.toHaveBeenCalled()
  })

  it("retorna 422 VALIDATION_ERROR para campos extras (schema .strict)", async () => {
    const res = await callPost({
      token: validToken,
      password: validPassword,
      passwordConfirmation: validPassword,
      extra: true,
    })
    const json = await res.json()

    expect(res.status).toBe(422)
    expect(json.error.code).toBe("VALIDATION_ERROR")
    expect(prismaMock.verificationToken.findUnique).not.toHaveBeenCalled()
  })

  it("retorna 422 VALIDATION_ERROR para corpo nao-JSON", async () => {
    const res = await callPost("nao é json")
    const json = await res.json()

    expect(res.status).toBe(422)
    expect(json.error.code).toBe("VALIDATION_ERROR")
  })

  it("retorna 401 AUTH_RESET_TOKEN_INVALID quando token nao existe", async () => {
    prismaMock.verificationToken.findUnique.mockResolvedValue(null)

    const res = await callPost({
      token: "nao-existe",
      password: validPassword,
      passwordConfirmation: validPassword,
    })
    const json = await res.json()

    expect(res.status).toBe(401)
    expect(json.error.code).toBe("AUTH_RESET_TOKEN_INVALID")
    expect(prismaMock.user.update).not.toHaveBeenCalled()
    expect(prismaMock.verificationToken.deleteMany).not.toHaveBeenCalled()
  })

  it("retorna 401 AUTH_RESET_TOKEN_INVALID quando tipo nao e PASSWORD_RESET", async () => {
    prismaMock.verificationToken.findUnique.mockResolvedValue(
      validTokenRow({ type: "EMAIL" }),
    )

    const res = await callPost({
      token: validToken,
      password: validPassword,
      passwordConfirmation: validPassword,
    })
    const json = await res.json()

    expect(res.status).toBe(401)
    expect(json.error.code).toBe("AUTH_RESET_TOKEN_INVALID")
    expect(prismaMock.user.update).not.toHaveBeenCalled()
  })

  it("retorna 410 AUTH_RESET_TOKEN_EXPIRED para token expirado (1h)", async () => {
    prismaMock.verificationToken.findUnique.mockResolvedValue(
      validTokenRow({ expiresAt: new Date(Date.now() - 60 * 1000) }),
    )

    const res = await callPost({
      token: validToken,
      password: validPassword,
      passwordConfirmation: validPassword,
    })
    const json = await res.json()

    expect(res.status).toBe(410)
    expect(json.error.code).toBe("AUTH_RESET_TOKEN_EXPIRED")
    expect(prismaMock.verificationToken.deleteMany).toHaveBeenCalled()
    expect(prismaMock.user.update).not.toHaveBeenCalled()
  })

  it("retorna 401 AUTH_RESET_TOKEN_INVALID quando token ja usado (single-use, deleteMany count 0)", async () => {
    prismaMock.verificationToken.deleteMany.mockResolvedValue({ count: 0 })

    const res = await callPost({
      token: validToken,
      password: validPassword,
      passwordConfirmation: validPassword,
    })
    const json = await res.json()

    expect(res.status).toBe(401)
    expect(json.error.code).toBe("AUTH_RESET_TOKEN_INVALID")
    expect(prismaMock.user.update).not.toHaveBeenCalled()
  })

  it("LGPD: nao redefine senha de usuario isActive=false mesmo com token vigente (401, token deletado)", async () => {
    prismaMock.user.findFirst.mockResolvedValue(
      activeUserRow({ isActive: false }),
    )

    const res = await callPost({
      token: validToken,
      password: validPassword,
      passwordConfirmation: validPassword,
    })
    const json = await res.json()

    expect(res.status).toBe(401)
    expect(json.error.code).toBe("AUTH_RESET_TOKEN_INVALID")
    expect(prismaMock.verificationToken.deleteMany).toHaveBeenCalled()
    expect(prismaMock.user.update).not.toHaveBeenCalled()
  })

  it("LGPD: nao redefine senha de usuario deletado (deletedAt != null) mesmo com token vigente (401)", async () => {
    prismaMock.user.findFirst.mockResolvedValue(
      activeUserRow({ deletedAt: new Date("2026-08-01T00:00:00Z") }),
    )

    const res = await callPost({
      token: validToken,
      password: validPassword,
      passwordConfirmation: validPassword,
    })
    const json = await res.json()

    expect(res.status).toBe(401)
    expect(json.error.code).toBe("AUTH_RESET_TOKEN_INVALID")
    expect(prismaMock.verificationToken.deleteMany).toHaveBeenCalled()
    expect(prismaMock.user.update).not.toHaveBeenCalled()
  })

  it("retorna 500 INTERNAL_ERROR com meta.requestId em erro de banco", async () => {
    prismaMock.verificationToken.findUnique.mockRejectedValue(
      new Error("db down"),
    )

    const res = await callPost({
      token: validToken,
      password: validPassword,
      passwordConfirmation: validPassword,
    })
    const json = await res.json()

    expect(res.status).toBe(500)
    expect(json.error.code).toBe("INTERNAL_ERROR")
    expect(json.meta.requestId).toBeTruthy()
  })

  it("inclui meta.requestId nas respostas de erro (C13)", async () => {
    prismaMock.verificationToken.findUnique.mockResolvedValue(null)

    const res = await callPost({
      token: validToken,
      password: validPassword,
      passwordConfirmation: validPassword,
    })
    const json = await res.json()

    expect(res.status).toBe(401)
    expect(typeof json.meta.requestId).toBe("string")
    expect(json.meta.requestId.length).toBeGreaterThan(0)
  })
})
