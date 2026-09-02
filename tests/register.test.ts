import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const prismaMock = vi.hoisted(() => ({
  user: {
    create: vi.fn(),
    findFirst: vi.fn(),
  },
  verificationToken: {
    create: vi.fn(),
  },
  $transaction: vi.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
}))

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }))

const sendVerificationEmailMock = vi.hoisted(() => vi.fn())
vi.mock("@/lib/email/email", () => ({
  sendVerificationEmail: sendVerificationEmailMock,
}))

const createdUser = {
  id: "usr_reg1",
  name: "Maria Silva",
  email: "maria@email.com",
  emailVerified: null,
  passwordHash: "$2a$12$abcdefghijklmnopqrstuv",
  role: "USER",
  plan: "FREE",
  provider: "EMAIL",
  providerId: "maria@email.com",
  isActive: true,
  deletedAt: null,
}

function validBody() {
  return {
    name: "Maria Silva",
    email: "maria@email.com",
    password: "SenhaForte123!",
    passwordConfirmation: "SenhaForte123!",
    acceptTerms: true,
  }
}

async function callPost(body: unknown): Promise<Response> {
  const { POST } = await import("@/app/api/v1/auth/register/route")
  return POST(
    new Request("http://localhost:3000/api/v1/auth/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  sendVerificationEmailMock.mockResolvedValue({
    data: { id: "email_1" },
    error: null,
  })
})

afterEach(() => {
  vi.resetModules()
})

describe("POST /api/v1/auth/register (T6)", () => {
  it("cria usuário e retorna 201 com user e message, sem auto-login", async () => {
    prismaMock.user.findFirst.mockResolvedValue(null)
    prismaMock.user.create.mockResolvedValue(createdUser)
    prismaMock.verificationToken.create.mockResolvedValue({ id: "vt_1" })

    const res = await callPost(validBody())
    const json = await res.json()

    expect(res.status).toBe(201)
    expect(json.user).toEqual({
      id: "usr_reg1",
      name: "Maria Silva",
      email: "maria@email.com",
      emailVerified: null,
    })
    expect(json.message).toBeTruthy()
    expect(json.accessToken).toBeUndefined()
    expect(json.user.passwordHash).toBeUndefined()
  })

  it("persiste usuario com role USER, plan FREE, provider EMAIL e providerId lowercase", async () => {
    prismaMock.user.findFirst.mockResolvedValue(null)
    prismaMock.user.create.mockResolvedValue(createdUser)
    prismaMock.verificationToken.create.mockResolvedValue({ id: "vt_1" })

    await callPost({ ...validBody(), email: "Maria@Email.com" })

    const createCall = prismaMock.user.create.mock.calls[0]?.[0]?.data
    expect(createCall.role).toBe("USER")
    expect(createCall.plan).toBe("FREE")
    expect(createCall.provider).toBe("EMAIL")
    expect(createCall.providerId).toBe("maria@email.com")
    expect(createCall.email).toBe("maria@email.com")
    expect(createCall.passwordHash).toBeTruthy()
    expect(createCall.passwordHash).not.toBe(validBody().password)
  })

  it("hasheia a senha com bcrypt (nao armazena em texto plano)", async () => {
    prismaMock.user.findFirst.mockResolvedValue(null)
    prismaMock.user.create.mockResolvedValue(createdUser)
    prismaMock.verificationToken.create.mockResolvedValue({ id: "vt_1" })

    await callPost(validBody())

    const hash = prismaMock.user.create.mock.calls[0]?.[0]?.data.passwordHash
    expect(hash).toMatch(/^\$2[aby]\$\d+/)
  })

  it("cria VerificationToken type EMAIL com 24h de validade e envia email", async () => {
    prismaMock.user.findFirst.mockResolvedValue(null)
    prismaMock.user.create.mockResolvedValue(createdUser)
    prismaMock.verificationToken.create.mockResolvedValue({ id: "vt_1" })

    await callPost(validBody())

    expect(prismaMock.verificationToken.create).toHaveBeenCalled()
    const vtCreate =
      prismaMock.verificationToken.create.mock.calls[0]?.[0]?.data
    expect(vtCreate.type).toBe("EMAIL")
    expect(vtCreate.identifier).toBe("maria@email.com")
    const expiresAt = new Date(vtCreate.expiresAt).getTime()
    expect(expiresAt - Date.now()).toBeGreaterThan(23 * 60 * 60 * 1000)
    expect(expiresAt - Date.now()).toBeLessThanOrEqual(24 * 60 * 60 * 1000)

    expect(sendVerificationEmailMock).toHaveBeenCalledTimes(1)
    const callArgs = sendVerificationEmailMock.mock.calls[0] as
      [string, { verificationUrl: string }] | undefined
    const to = callArgs?.[0]
    const { verificationUrl } = callArgs?.[1] ?? {}
    expect(to).toBe("maria@email.com")
    expect(verificationUrl).toContain("/auth/verify-email")
    expect(verificationUrl).not.toContain("/api/v1/auth/verify-email")
  })

  it("retorna 409 AUTH_EMAIL_ALREADY_EXISTS quando email ja existe", async () => {
    prismaMock.user.findFirst.mockResolvedValue(createdUser)

    const res = await callPost(validBody())
    const json = await res.json()

    expect(res.status).toBe(409)
    expect(json.error.code).toBe("AUTH_EMAIL_ALREADY_EXISTS")
    expect(prismaMock.user.create).not.toHaveBeenCalled()
    expect(sendVerificationEmailMock).not.toHaveBeenCalled()
  })

  it("retorna 409 AUTH_EMAIL_ALREADY_EXISTS quando email ja cadastrado (case-insensitive)", async () => {
    prismaMock.user.findFirst.mockResolvedValue(createdUser)

    const res = await callPost({ ...validBody(), email: "MARIA@EMAIL.COM" })
    const json = await res.json()

    expect(res.status).toBe(409)
    expect(json.error.code).toBe("AUTH_EMAIL_ALREADY_EXISTS")
  })

  it("retorna 422 VALIDATION_ERROR para senha fraca (sem maiuscula)", async () => {
    prismaMock.user.findFirst.mockResolvedValue(null)

    const res = await callPost({
      ...validBody(),
      password: "senhaforte123!",
      passwordConfirmation: "senhaforte123!",
    })
    const json = await res.json()

    expect(res.status).toBe(422)
    expect(json.error.code).toBe("VALIDATION_ERROR")
    expect(prismaMock.user.create).not.toHaveBeenCalled()
  })

  it("retorna 422 VALIDATION_ERROR quando confirmacao nao confere", async () => {
    prismaMock.user.findFirst.mockResolvedValue(null)

    const res = await callPost({
      ...validBody(),
      passwordConfirmation: "OutraSenha123!",
    })
    const json = await res.json()

    expect(res.status).toBe(422)
    expect(json.error.code).toBe("VALIDATION_ERROR")
    expect(prismaMock.user.create).not.toHaveBeenCalled()
  })

  it("retorna 422 VALIDATION_ERROR sem acceptTerms", async () => {
    prismaMock.user.findFirst.mockResolvedValue(null)

    const res = await callPost({ ...validBody(), acceptTerms: false })
    const json = await res.json()

    expect(res.status).toBe(422)
    expect(json.error.code).toBe("VALIDATION_ERROR")
    expect(prismaMock.user.create).not.toHaveBeenCalled()
  })

  it("retorna 422 VALIDATION_ERROR para nome curto demais", async () => {
    prismaMock.user.findFirst.mockResolvedValue(null)

    const res = await callPost({ ...validBody(), name: "A" })
    const json = await res.json()

    expect(res.status).toBe(422)
    expect(json.error.code).toBe("VALIDATION_ERROR")
    expect(prismaMock.user.create).not.toHaveBeenCalled()
  })

  it("grava usuario e token em uma unica transacao", async () => {
    prismaMock.user.findFirst.mockResolvedValue(null)
    prismaMock.user.create.mockResolvedValue(createdUser)
    prismaMock.verificationToken.create.mockResolvedValue({ id: "vt_1" })

    await callPost(validBody())

    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1)
    const ops = prismaMock.$transaction.mock.calls[0]?.[0] as unknown[]
    expect(ops).toHaveLength(2)
    expect(prismaMock.user.create).toHaveBeenCalledTimes(1)
    expect(prismaMock.verificationToken.create).toHaveBeenCalledTimes(1)
  })

  it("retorna 409 AUTH_EMAIL_ALREADY_EXISTS na corrida P2002 do user.create", async () => {
    prismaMock.user.findFirst.mockResolvedValue(null)
    prismaMock.user.create.mockRejectedValue({
      code: "P2002",
      message: "Unique",
    })

    const res = await callPost(validBody())
    const json = await res.json()

    expect(res.status).toBe(409)
    expect(json.error.code).toBe("AUTH_EMAIL_ALREADY_EXISTS")
  })

  it("retorna 500 INTERNAL_ERROR com meta.requestId quando a token falha", async () => {
    prismaMock.user.findFirst.mockResolvedValue(null)
    prismaMock.user.create.mockResolvedValue(createdUser)
    prismaMock.verificationToken.create.mockRejectedValue(new Error("db down"))

    const res = await callPost(validBody())
    const json = await res.json()

    expect(res.status).toBe(500)
    expect(json.error.code).toBe("INTERNAL_ERROR")
    expect(json.meta.requestId).toBeTruthy()
  })

  it("inclui meta.requestId nas respostas de erro (C13)", async () => {
    prismaMock.user.findFirst.mockResolvedValue(null)
    prismaMock.user.create.mockRejectedValue(new Error("db down"))

    const res = await callPost(validBody())
    const json = await res.json()

    expect(res.status).toBe(500)
    expect(typeof json.meta.requestId).toBe("string")
    expect(json.meta.requestId.length).toBeGreaterThan(0)
  })

  it("retorna 201 com conta persistida quando o email de verificacao falha (recuperavel via resend T30)", async () => {
    prismaMock.user.findFirst.mockResolvedValue(null)
    prismaMock.user.create.mockResolvedValue(createdUser)
    prismaMock.verificationToken.create.mockResolvedValue({ id: "vt_1" })
    sendVerificationEmailMock.mockRejectedValue(new Error("provider down"))

    const res = await callPost(validBody())
    const json = await res.json()

    expect(res.status).toBe(201)
    expect(json.user.id).toBe("usr_reg1")
    expect(prismaMock.user.create).toHaveBeenCalledTimes(1)
    expect(prismaMock.verificationToken.create).toHaveBeenCalledTimes(1)
  })
})
