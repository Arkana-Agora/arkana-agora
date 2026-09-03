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

const activeUser = {
  id: "usr_magic1",
  name: "Maria Silva",
  email: "maria@email.com",
  emailVerified: new Date("2026-01-01T00:00:00Z"),
  isActive: true,
  deletedAt: null,
}

const unverifiedUser = {
  id: "usr_magic2",
  name: "Joao",
  email: "joao@email.com",
  emailVerified: null,
  isActive: true,
  deletedAt: null,
}

const suspendedUser = {
  id: "usr_magic3",
  name: "Ana",
  email: "ana@email.com",
  emailVerified: new Date("2026-01-01T00:00:00Z"),
  isActive: false,
  deletedAt: null,
}

function validBody() {
  return { email: "maria@email.com" }
}

async function callPost(body: unknown): Promise<Response> {
  const { POST } = await import("@/app/api/v1/auth/magic-link/route")
  return POST(
    new Request("http://localhost:3000/api/v1/auth/magic-link", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  )
}

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
  sendMagicLinkEmailMock.mockResolvedValue({
    data: { id: "email_1" },
    error: null,
  })
})

afterEach(() => {
  vi.resetModules()
})

describe("POST /api/v1/auth/magic-link (T9)", () => {
  it("cria VerificationToken MAGIC_LINK de 64 chars com 15min e envia email, retornando 200 flat { message }", async () => {
    prismaMock.user.findFirst.mockResolvedValue(activeUser)
    prismaMock.verificationToken.create.mockResolvedValue({ id: "vt_1" })

    const res = await callPost(validBody())
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.message).toBeTruthy()
    expect(json.data).toBeUndefined()

    expect(prismaMock.verificationToken.create).toHaveBeenCalledTimes(1)
    const vtCreate = prismaMock.verificationToken.create.mock.calls[0]?.[0]
      ?.data as {
      identifier: string
      token: string
      type: string
      expiresAt: Date
    }
    expect(vtCreate.type).toBe("MAGIC_LINK")
    expect(vtCreate.identifier).toBe("maria@email.com")
    expect(vtCreate.token).toHaveLength(64)
    expect(vtCreate.token).toMatch(/^[0-9a-f]{64}$/)

    const expiresAt = new Date(vtCreate.expiresAt).getTime()
    const now = Date.now()
    expect(expiresAt - now).toBeGreaterThan(14 * 60 * 1000)
    expect(expiresAt - now).toBeLessThanOrEqual(15 * 60 * 1000)

    expect(sendMagicLinkEmailMock).toHaveBeenCalledTimes(1)
    const callArgs = sendMagicLinkEmailMock.mock.calls[0] as
      [string, { url: string }] | undefined
    expect(callArgs?.[0]).toBe("maria@email.com")
    expect(callArgs?.[1]?.url).toContain("/auth/login")
    expect(callArgs?.[1]?.url).not.toContain("/api/v1/auth")
  })

  it("valida email e retorna 422 VALIDATION_ERROR para email invalido", async () => {
    prismaMock.user.findFirst.mockResolvedValue(null)

    const res = await callPost({ email: "nao-e-email" })
    const json = await res.json()

    expect(res.status).toBe(422)
    expect(json.error.code).toBe("VALIDATION_ERROR")
    expect(prismaMock.user.findFirst).not.toHaveBeenCalled()
    expect(sendMagicLinkEmailMock).not.toHaveBeenCalled()
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
  })

  it("retorna 422 VALIDATION_ERROR para corpo invalido (nao-JSON)", async () => {
    const { POST } = await import("@/app/api/v1/auth/magic-link/route")
    const res = await POST(
      new Request("http://localhost:3000/api/v1/auth/magic-link", {
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
    expect(json.message).toBeTruthy()
    expect(prismaMock.verificationToken.create).not.toHaveBeenCalled()
    expect(sendMagicLinkEmailMock).not.toHaveBeenCalled()
  })

  it("anti-enumeracao: email nao verificado retorna 200 sem token nem email (no-op)", async () => {
    prismaMock.user.findFirst.mockResolvedValue(unverifiedUser)

    const res = await callPost({ email: "joao@email.com" })
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.message).toBeTruthy()
    expect(prismaMock.verificationToken.create).not.toHaveBeenCalled()
    expect(sendMagicLinkEmailMock).not.toHaveBeenCalled()
  })

  it("anti-enumeracao: conta suspensa/inativa retorna 200 sem token nem email (no-op)", async () => {
    prismaMock.user.findFirst.mockResolvedValue(suspendedUser)

    const res = await callPost({ email: "ana@email.com" })
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.message).toBeTruthy()
    expect(prismaMock.verificationToken.create).not.toHaveBeenCalled()
    expect(sendMagicLinkEmailMock).not.toHaveBeenCalled()
  })

  it("respostas anti-enumeracao sao identicas entre email existente e inexistente", async () => {
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

  it("aplica limite de 3 magic links por hora por email e retorna 429 AUTH_MAGIC_LINK_RATE_LIMIT sem enviar", async () => {
    rateLimitMock.isMagicLinkLimited.mockReturnValue({
      allowed: false,
      retryAfter: 1200,
    })
    prismaMock.user.findFirst.mockResolvedValue(activeUser)
    prismaMock.verificationToken.create.mockResolvedValue({ id: "vt_1" })

    const res = await callPost(validBody())
    const json = await res.json()

    expect(res.status).toBe(429)
    expect(json.error.code).toBe("AUTH_MAGIC_LINK_RATE_LIMIT")
    expect(json.error.retryAfter).toBe(1200)
    expect(prismaMock.verificationToken.create).not.toHaveBeenCalled()
    expect(sendMagicLinkEmailMock).not.toHaveBeenCalled()
  })

  it("aplica limite por IP (anti-enumeracao) e retorna 429 AUTH_MAGIC_LINK_RATE_LIMIT sem enviar", async () => {
    rateLimitMock.isMagicLinkIpLimited.mockReturnValue({
      allowed: false,
      retryAfter: 900,
    })
    prismaMock.user.findFirst.mockResolvedValue(activeUser)
    prismaMock.verificationToken.create.mockResolvedValue({ id: "vt_1" })

    const res = await callPost(validBody())
    const json = await res.json()

    expect(res.status).toBe(429)
    expect(json.error.code).toBe("AUTH_MAGIC_LINK_RATE_LIMIT")
    expect(json.error.retryAfter).toBe(900)
    expect(rateLimitMock.recordMagicLinkIpAttempt).not.toHaveBeenCalled()
    expect(prismaMock.verificationToken.create).not.toHaveBeenCalled()
    expect(sendMagicLinkEmailMock).not.toHaveBeenCalled()
  })

  it("retorna 200 com email persistido quando o envio de email falha (recuperavel solicitando novo link)", async () => {
    prismaMock.user.findFirst.mockResolvedValue(activeUser)
    prismaMock.verificationToken.create.mockResolvedValue({ id: "vt_1" })
    sendMagicLinkEmailMock.mockRejectedValue(new Error("provider down"))

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
    expect(typeof json.meta.requestId).toBe("string")
    expect(json.meta.requestId.length).toBeGreaterThan(0)
  })
})
