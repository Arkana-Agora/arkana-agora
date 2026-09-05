import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const prismaMock = vi.hoisted(() => ({
  $transaction: vi.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
  user: {
    findFirst: vi.fn(),
    update: vi.fn(),
  },
  verificationToken: {
    findUnique: vi.fn(),
    create: vi.fn(),
    deleteMany: vi.fn(),
  },
}))

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }))

const tokenServiceMock = vi.hoisted(() => ({
  bumpTokenVersion: vi.fn(),
}))
vi.mock("@/services/token-service", () => tokenServiceMock)

const sendVerificationEmailMock = vi.hoisted(() => vi.fn())
vi.mock("@/lib/email/email", () => ({
  sendVerificationEmail: sendVerificationEmailMock,
}))

const validToken = "a".repeat(64)
const verifiedEmail = "maria@email.com"

function validTokenRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "vt_1",
    identifier: verifiedEmail,
    token: validToken,
    type: "EMAIL",
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    ...overrides,
  }
}

function activeUserRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "usr_verify1",
    isActive: true,
    deletedAt: null,
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  prismaMock.verificationToken.findUnique.mockResolvedValue(validTokenRow())
  prismaMock.verificationToken.deleteMany.mockResolvedValue({ count: 1 })
  prismaMock.user.findFirst.mockResolvedValue(activeUserRow())
  prismaMock.user.update.mockResolvedValue({
    id: "usr_verify1",
    email: verifiedEmail,
    emailVerified: new Date(),
  })
  tokenServiceMock.bumpTokenVersion.mockResolvedValue(undefined)
})

afterEach(() => {
  vi.resetModules()
})

describe("POST /api/v1/auth/verify-email (T30)", () => {
  async function callPost(body: unknown): Promise<Response> {
    const { POST } = await import("@/app/api/v1/auth/verify-email/route")
    return POST(
      new Request("http://localhost:3000/api/v1/auth/verify-email", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: typeof body === "string" ? body : JSON.stringify(body),
      }),
    )
  }

  it("verifica o email: marca emailVerified, bump tokenVersion e retorna 200 flat { message } sem cache", async () => {
    const res = await callPost({ token: validToken })
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(res.headers.get("cache-control")).toBe("no-store")
    expect(json.message).toBe("Email verificado com sucesso")

    expect(prismaMock.verificationToken.findUnique).toHaveBeenCalledWith({
      where: { token: validToken },
    })
    expect(prismaMock.verificationToken.deleteMany).toHaveBeenCalled()

    expect(prismaMock.user.update).toHaveBeenCalledTimes(1)
    const data = prismaMock.user.update.mock.calls[0]![0].data
    expect(data.emailVerified).toBeInstanceOf(Date)
    expect(typeof data.emailVerified.getTime()).toBe("number")

    expect(tokenServiceMock.bumpTokenVersion).toHaveBeenCalledWith(
      "usr_verify1",
    )

    const bumpOrder =
      tokenServiceMock.bumpTokenVersion.mock.invocationCallOrder[0]!
    const updateOrder = prismaMock.user.update.mock.invocationCallOrder[0]!
    expect(bumpOrder).toBeLessThan(updateOrder)
  })

  it("valida token e retorna 422 VALIDATION_ERROR para corpo sem campos", async () => {
    const res = await callPost({})
    const json = await res.json()

    expect(res.status).toBe(422)
    expect(json.error.code).toBe("VALIDATION_ERROR")
    expect(prismaMock.verificationToken.findUnique).not.toHaveBeenCalled()
  })

  it("retorna 422 VALIDATION_ERROR para token acima do tamanho maximo (256)", async () => {
    const res = await callPost({ token: "c".repeat(257) })
    const json = await res.json()

    expect(res.status).toBe(422)
    expect(json.error.code).toBe("VALIDATION_ERROR")
    expect(prismaMock.verificationToken.findUnique).not.toHaveBeenCalled()
  })

  it("retorna 422 VALIDATION_ERROR para campos extras (schema .strict)", async () => {
    const res = await callPost({ token: validToken, extra: true })
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

  it("retorna 401 AUTH_EMAIL_VERIFY_INVALID quando token nao existe", async () => {
    prismaMock.verificationToken.findUnique.mockResolvedValue(null)

    const res = await callPost({ token: "nao-existe" })
    const json = await res.json()

    expect(res.status).toBe(401)
    expect(json.error.code).toBe("AUTH_EMAIL_VERIFY_INVALID")
    expect(prismaMock.user.update).not.toHaveBeenCalled()
    expect(prismaMock.verificationToken.deleteMany).not.toHaveBeenCalled()
  })

  it("retorna 401 AUTH_EMAIL_VERIFY_INVALID quando tipo nao e EMAIL", async () => {
    prismaMock.verificationToken.findUnique.mockResolvedValue(
      validTokenRow({ type: "PASSWORD_RESET" }),
    )

    const res = await callPost({ token: validToken })
    const json = await res.json()

    expect(res.status).toBe(401)
    expect(json.error.code).toBe("AUTH_EMAIL_VERIFY_INVALID")
    expect(prismaMock.user.update).not.toHaveBeenCalled()
  })

  it("retorna 410 AUTH_EMAIL_VERIFY_EXPIRED para token expirado (24h) e remove o token", async () => {
    prismaMock.verificationToken.findUnique.mockResolvedValue(
      validTokenRow({ expiresAt: new Date(Date.now() - 60 * 1000) }),
    )

    const res = await callPost({ token: validToken })
    const json = await res.json()

    expect(res.status).toBe(410)
    expect(json.error.code).toBe("AUTH_EMAIL_VERIFY_EXPIRED")
    expect(prismaMock.verificationToken.deleteMany).toHaveBeenCalled()
    expect(prismaMock.user.update).not.toHaveBeenCalled()
  })

  it("retorna 401 AUTH_EMAIL_VERIFY_INVALID quando token ja usado (single-use, deleteMany count 0)", async () => {
    prismaMock.verificationToken.deleteMany.mockResolvedValue({ count: 0 })

    const res = await callPost({ token: validToken })
    const json = await res.json()

    expect(res.status).toBe(401)
    expect(json.error.code).toBe("AUTH_EMAIL_VERIFY_INVALID")
    expect(prismaMock.user.update).not.toHaveBeenCalled()
  })

  it("LGPD: nao verifica email de usuario isActive=false mesmo com token vigente (401, token deletado)", async () => {
    prismaMock.user.findFirst.mockResolvedValue(
      activeUserRow({ isActive: false }),
    )

    const res = await callPost({ token: validToken })
    const json = await res.json()

    expect(res.status).toBe(401)
    expect(json.error.code).toBe("AUTH_EMAIL_VERIFY_INVALID")
    expect(prismaMock.verificationToken.deleteMany).toHaveBeenCalled()
    expect(prismaMock.user.update).not.toHaveBeenCalled()
  })

  it("LGPD: nao verifica email de usuario deletado (deletedAt != null) mesmo com token vigente (401)", async () => {
    prismaMock.user.findFirst.mockResolvedValue(
      activeUserRow({ deletedAt: new Date("2026-08-01T00:00:00Z") }),
    )

    const res = await callPost({ token: validToken })
    const json = await res.json()

    expect(res.status).toBe(401)
    expect(json.error.code).toBe("AUTH_EMAIL_VERIFY_INVALID")
    expect(prismaMock.verificationToken.deleteMany).toHaveBeenCalled()
    expect(prismaMock.user.update).not.toHaveBeenCalled()
  })

  it("LGPD: token de usuario inexistente (identifier sem user) e consumido com 401", async () => {
    prismaMock.user.findFirst.mockResolvedValue(null)

    const res = await callPost({ token: validToken })
    const json = await res.json()

    expect(res.status).toBe(401)
    expect(json.error.code).toBe("AUTH_EMAIL_VERIFY_INVALID")
    expect(prismaMock.verificationToken.deleteMany).toHaveBeenCalled()
    expect(prismaMock.user.update).not.toHaveBeenCalled()
  })

  it("race: em duas requisicoes concorrentes so uma vence o single-use (1x200 + 1x401)", async () => {
    prismaMock.verificationToken.deleteMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 })

    const [a, b] = await Promise.all([
      callPost({ token: validToken }),
      callPost({ token: validToken }),
    ])

    const statuses = [a.status, b.status].sort()
    expect(statuses).toEqual([200, 401])
    expect(prismaMock.user.update).toHaveBeenCalledTimes(1)
    expect(tokenServiceMock.bumpTokenVersion).toHaveBeenCalledTimes(1)
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

describe("POST /api/v1/auth/verify-email/resend (T30)", () => {
  async function callPost(body: unknown): Promise<Response> {
    const { POST } = await import("@/app/api/v1/auth/verify-email/resend/route")
    return POST(
      new Request("http://localhost:3000/api/v1/auth/verify-email/resend", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: typeof body === "string" ? body : JSON.stringify(body),
      }),
    )
  }

  function unverifiedUserRow(overrides: Record<string, unknown> = {}) {
    return {
      id: "usr_verify1",
      emailVerified: null,
      isActive: true,
      deletedAt: null,
      ...overrides,
    }
  }

  beforeEach(() => {
    prismaMock.user.findFirst.mockResolvedValue(unverifiedUserRow())
    prismaMock.verificationToken.create.mockResolvedValue({ id: "vt_2" })
    sendVerificationEmailMock.mockResolvedValue({
      data: { id: "email_2" },
      error: null,
    })
  })

  it("gera novo token EMAIL de 24h substituindo o anterior e reenvia o email (200 flat)", async () => {
    const res = await callPost({ email: verifiedEmail })
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(res.headers.get("cache-control")).toBe("no-store")
    expect(json.message).toBe("Email de verificacao enviado")

    expect(prismaMock.verificationToken.deleteMany).toHaveBeenCalledWith({
      where: { identifier: verifiedEmail, type: "EMAIL" },
    })

    expect(prismaMock.verificationToken.create).toHaveBeenCalledTimes(1)
    const createArgs = prismaMock.verificationToken.create.mock.calls[0]![0]
    expect(createArgs.data.type).toBe("EMAIL")
    expect(createArgs.data.identifier).toBe(verifiedEmail)
    expect(createArgs.data.token).toMatch(/^[0-9a-f]{64}$/)
    const lifetimeMs = createArgs.data.expiresAt.getTime() - Date.now()
    expect(lifetimeMs).toBeGreaterThan(23 * 60 * 60 * 1000)
    expect(lifetimeMs).toBeLessThanOrEqual(24 * 60 * 60 * 1000)

    expect(sendVerificationEmailMock).toHaveBeenCalledTimes(1)
    const url = sendVerificationEmailMock.mock.calls[0]![1].verificationUrl
    expect(url).toContain("/auth/verify-email?token=")
    expect(url).toContain(createArgs.data.token)
  })

  it("nao reenvia para usuario ja verificado e retorna 200 identico (anti-enumeracao)", async () => {
    prismaMock.user.findFirst.mockResolvedValue(
      unverifiedUserRow({ emailVerified: new Date() }),
    )

    const res = await callPost({ email: verifiedEmail })
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.message).toBe("Email de verificacao enviado")
    expect(prismaMock.verificationToken.create).not.toHaveBeenCalled()
    expect(sendVerificationEmailMock).not.toHaveBeenCalled()
  })

  it("no-op 200 identico para email nao cadastrado (anti-enumeracao, with timing floor)", async () => {
    prismaMock.user.findFirst.mockResolvedValue(null)

    const startedAt = Date.now()
    const res = await callPost({ email: "naoexiste@email.com" })
    const elapsedMs = Date.now() - startedAt
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.message).toBe("Email de verificacao enviado")
    expect(prismaMock.verificationToken.create).not.toHaveBeenCalled()
    expect(sendVerificationEmailMock).not.toHaveBeenCalled()
    expect(elapsedMs).toBeGreaterThanOrEqual(240)
  })

  it("no-op 200 identico para usuario inativo/deletado (janela LGPD, anti-enumeracao)", async () => {
    prismaMock.user.findFirst.mockResolvedValue(
      unverifiedUserRow({ isActive: false, deletedAt: new Date() }),
    )

    const res = await callPost({ email: verifiedEmail })
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.message).toBe("Email de verificacao enviado")
    expect(prismaMock.verificationToken.create).not.toHaveBeenCalled()
    expect(sendVerificationEmailMock).not.toHaveBeenCalled()
  })

  it("retorna 422 VALIDATION_ERROR para email invalido", async () => {
    const res = await callPost({ email: "nao-e-email" })
    const json = await res.json()

    expect(res.status).toBe(422)
    expect(json.error.code).toBe("VALIDATION_ERROR")
    expect(prismaMock.user.findFirst).not.toHaveBeenCalled()
  })

  it("retorna 422 VALIDATION_ERROR para corpo sem email / nao-JSON", async () => {
    const res = await callPost("nao é json")
    const json = await res.json()

    expect(res.status).toBe(422)
    expect(json.error.code).toBe("VALIDATION_ERROR")
    expect(prismaMock.user.findFirst).not.toHaveBeenCalled()
  })

  it("retorna 200 mesmo se o envio do email falhar (token persistido, precedente register)", async () => {
    sendVerificationEmailMock.mockRejectedValue(new Error("smtp down"))

    const res = await callPost({ email: verifiedEmail })
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.message).toBe("Email de verificacao enviado")
    expect(prismaMock.verificationToken.create).toHaveBeenCalledTimes(1)
  })

  it("retorna 500 INTERNAL_ERROR com meta.requestId em erro de banco", async () => {
    prismaMock.user.findFirst.mockRejectedValue(new Error("db down"))

    const res = await callPost({ email: verifiedEmail })
    const json = await res.json()

    expect(res.status).toBe(500)
    expect(json.error.code).toBe("INTERNAL_ERROR")
    expect(json.meta.requestId).toBeTruthy()
  })
})
