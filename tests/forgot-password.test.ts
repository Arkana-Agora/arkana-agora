import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const prismaMock = vi.hoisted(() => ({
  user: {
    findFirst: vi.fn(),
  },
  verificationToken: {
    create: vi.fn(),
  },
}))

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }))

const sendPasswordResetEmailMock = vi.hoisted(() => vi.fn())
vi.mock("@/lib/email/email", () => ({
  sendPasswordResetEmail: sendPasswordResetEmailMock,
}))

const rateLimitMock = vi.hoisted(() => ({
  isPasswordResetLimited: vi.fn(),
  recordPasswordResetRequest: vi.fn(),
}))
vi.mock("@/lib/rate-limit", () => rateLimitMock)

const activeUser = {
  id: "usr_reset1",
  name: "Maria Silva",
  email: "maria@email.com",
  isActive: true,
  deletedAt: null,
}

const suspendedUser = {
  id: "usr_reset2",
  name: "Joao",
  email: "joao@email.com",
  isActive: false,
  deletedAt: null,
}

function validBody() {
  return { email: "maria@email.com" }
}

async function callPost(body: unknown): Promise<Response> {
  const { POST } = await import("@/app/api/v1/auth/forgot-password/route")
  return POST(
    new Request("http://localhost:3000/api/v1/auth/forgot-password", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  rateLimitMock.isPasswordResetLimited.mockReturnValue({
    allowed: true,
    retryAfter: 0,
  })
  rateLimitMock.recordPasswordResetRequest.mockImplementation(() => undefined)
  sendPasswordResetEmailMock.mockResolvedValue({
    data: { id: "email_1" },
    error: null,
  })
})

afterEach(() => {
  vi.resetModules()
})

describe("POST /api/v1/auth/forgot-password (T11)", () => {
  it("cria VerificationToken PASSWORD_RESET de 64 chars com 1h e envia email, retornando 200 flat { message }", async () => {
    prismaMock.user.findFirst.mockResolvedValue(activeUser)
    prismaMock.verificationToken.create.mockResolvedValue({ id: "vt_1" })

    const res = await callPost(validBody())
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.message).toBe(
      "Se o e-mail estiver cadastrado, voce recebera instrucoes para redefinir sua senha",
    )
    expect(json.data).toBeUndefined()

    expect(prismaMock.verificationToken.create).toHaveBeenCalledTimes(1)
    const vtCreate = prismaMock.verificationToken.create.mock.calls[0]?.[0]
      ?.data as {
      identifier: string
      token: string
      type: string
      expiresAt: Date
    }
    expect(vtCreate.type).toBe("PASSWORD_RESET")
    expect(vtCreate.identifier).toBe("maria@email.com")
    expect(vtCreate.token).toHaveLength(64)
    expect(vtCreate.token).toMatch(/^[0-9a-f]{64}$/)

    const expiresAt = new Date(vtCreate.expiresAt).getTime()
    const now = Date.now()
    expect(expiresAt - now).toBeGreaterThan(59 * 60 * 1000)
    expect(expiresAt - now).toBeLessThanOrEqual(60 * 60 * 1000)

    expect(sendPasswordResetEmailMock).toHaveBeenCalledTimes(1)
    const callArgs = sendPasswordResetEmailMock.mock.calls[0] as
      [string, { resetUrl: string }] | undefined
    expect(callArgs?.[0]).toBe("maria@email.com")
    expect(callArgs?.[1]?.resetUrl).toContain("/auth/reset-password")
    expect(callArgs?.[1]?.resetUrl).not.toContain("/api/v1/auth")
  })

  it("valida email e retorna 422 VALIDATION_ERROR para email invalido", async () => {
    prismaMock.user.findFirst.mockResolvedValue(null)

    const res = await callPost({ email: "nao-e-email" })
    const json = await res.json()

    expect(res.status).toBe(422)
    expect(json.error.code).toBe("VALIDATION_ERROR")
    expect(prismaMock.user.findFirst).not.toHaveBeenCalled()
    expect(sendPasswordResetEmailMock).not.toHaveBeenCalled()
  })

  it("retorna 422 VALIDATION_ERROR quando redirectUrl nao e aceito no contrato (email-only)", async () => {
    prismaMock.user.findFirst.mockResolvedValue(null)

    const res = await callPost({
      email: "maria@email.com",
      redirectUrl: "https://evil.example",
    })
    const json = await res.json()

    expect(res.status).toBe(422)
    expect(json.error.code).toBe("VALIDATION_ERROR")
    expect(prismaMock.user.findFirst).not.toHaveBeenCalled()
  })

  it("retorna 422 VALIDATION_ERROR para corpo invalido (nao-JSON)", async () => {
    const { POST } = await import("@/app/api/v1/auth/forgot-password/route")
    const res = await POST(
      new Request("http://localhost:3000/api/v1/auth/forgot-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "nao é json",
      }),
    )
    const json = await res.json()

    expect(res.status).toBe(422)
    expect(json.error.code).toBe("VALIDATION_ERROR")
  })

  it("anti-enumeracao: email inexistente retorna 200 idêntico (flat) sem token nem email", async () => {
    prismaMock.user.findFirst.mockResolvedValue(null)

    const res = await callPost(validBody())
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.message).toBe(
      "Se o e-mail estiver cadastrado, voce recebera instrucoes para redefinir sua senha",
    )
    expect(prismaMock.verificationToken.create).not.toHaveBeenCalled()
    expect(sendPasswordResetEmailMock).not.toHaveBeenCalled()
  })

  it("equaliza o timing do no-op com delay mínimo (anti-enumeração por tempo)", async () => {
    prismaMock.user.findFirst.mockResolvedValue(null)

    const startedAt = Date.now()
    const res = await callPost(validBody())

    expect(res.status).toBe(200)
    expect(Date.now() - startedAt).toBeGreaterThanOrEqual(250)
  })

  it("anti-enumeracao: conta suspensa/inativa retorna 200 sem token nem email (no-op LGPD)", async () => {
    prismaMock.user.findFirst.mockResolvedValue(suspendedUser)

    const res = await callPost({ email: "joao@email.com" })
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.message).toBeTruthy()
    expect(prismaMock.verificationToken.create).not.toHaveBeenCalled()
    expect(sendPasswordResetEmailMock).not.toHaveBeenCalled()
  })

  it("anti-enumeracao: usuario deletado (deletedAt != null) retorna 200 sem token nem email (no-op LGPD)", async () => {
    prismaMock.user.findFirst.mockResolvedValue({
      ...suspendedUser,
      isActive: true,
      deletedAt: new Date("2026-08-01T00:00:00Z"),
    })

    const res = await callPost({ email: "joao@email.com" })
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.message).toBeTruthy()
    expect(prismaMock.verificationToken.create).not.toHaveBeenCalled()
    expect(sendPasswordResetEmailMock).not.toHaveBeenCalled()
  })

  it("anti-enumeracao: mensagens existente e inexistente sao identicas (flat { message })", async () => {
    prismaMock.user.findFirst.mockResolvedValue(activeUser)
    prismaMock.verificationToken.create.mockResolvedValue({ id: "vt_1" })
    const existingRes = await callPost(validBody())
    const existingJson = await existingRes.json()

    expect(existingRes.status).toBe(200)
    expect(Object.keys(existingJson)).toEqual(["message"])

    prismaMock.user.findFirst.mockResolvedValue(null)
    const missingRes = await callPost(validBody())
    const missingJson = await missingRes.json()

    expect(missingRes.status).toBe(200)
    expect(missingJson.message).toBe(existingJson.message)
    expect(Object.keys(existingJson)).toEqual(Object.keys(missingJson))
  })

  it("aplica limite de 3 pedidos de reset por hora por email e retorna 429 AUTH_FORGOT_RATE_LIMIT sem criar token", async () => {
    rateLimitMock.isPasswordResetLimited.mockReturnValue({
      allowed: false,
      retryAfter: 1200,
    })
    prismaMock.user.findFirst.mockResolvedValue(activeUser)
    prismaMock.verificationToken.create.mockResolvedValue({ id: "vt_1" })

    const res = await callPost(validBody())
    const json = await res.json()

    expect(res.status).toBe(429)
    expect(json.error.code).toBe("AUTH_FORGOT_RATE_LIMIT")
    expect(json.error.retryAfter).toBe(1200)
    expect(rateLimitMock.recordPasswordResetRequest).not.toHaveBeenCalled()
    expect(prismaMock.verificationToken.create).not.toHaveBeenCalled()
    expect(sendPasswordResetEmailMock).not.toHaveBeenCalled()
  })

  it("registra a tentativa no rate limit mesmo no no-op anti-enumeracao (anti-spam)", async () => {
    prismaMock.user.findFirst.mockResolvedValue(null)

    const res = await callPost(validBody())

    expect(res.status).toBe(200)
    expect(rateLimitMock.recordPasswordResetRequest).toHaveBeenCalledWith(
      "maria@email.com",
    )
  })

  it("retorna 200 com email e token persistidos quando o envio de email falha (recuperavel via novo pedido)", async () => {
    prismaMock.user.findFirst.mockResolvedValue(activeUser)
    prismaMock.verificationToken.create.mockResolvedValue({ id: "vt_1" })
    sendPasswordResetEmailMock.mockRejectedValue(new Error("provider down"))

    const res = await callPost(validBody())
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.message).toBeTruthy()
    expect(prismaMock.verificationToken.create).toHaveBeenCalledTimes(1)
  })

  it("retorna 500 INTERNAL_ERROR com meta.requestId quando persiste o token", async () => {
    prismaMock.user.findFirst.mockResolvedValue(activeUser)
    prismaMock.verificationToken.create.mockRejectedValue(new Error("db down"))

    const res = await callPost(validBody())
    const json = await res.json()

    expect(res.status).toBe(500)
    expect(json.error.code).toBe("INTERNAL_ERROR")
    expect(json.meta.requestId).toBeTruthy()
  })

  it("inclui meta.requestId nas respostas de erro (C13)", async () => {
    prismaMock.user.findFirst.mockRejectedValue(new Error("db down"))

    const res = await callPost(validBody())
    const json = await res.json()

    expect(res.status).toBe(500)
    expect(json.error.code).toBe("INTERNAL_ERROR")
    expect(typeof json.meta.requestId).toBe("string")
    expect(json.meta.requestId.length).toBeGreaterThan(0)
  })
})
