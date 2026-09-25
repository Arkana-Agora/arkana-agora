// @vitest-environment node
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

const rateLimitMock = vi.hoisted(() => ({
  isRegisterIpLimited: vi.fn(),
  isRegisterLimited: vi.fn(),
  recordRegisterAttempt: vi.fn(),
  recordRegisterIpAttempt: vi.fn(),
}))
vi.mock("@/lib/rate-limit", () => ({
  isRegisterIpLimited: rateLimitMock.isRegisterIpLimited,
  isRegisterLimited: rateLimitMock.isRegisterLimited,
  recordRegisterAttempt: rateLimitMock.recordRegisterAttempt,
  recordRegisterIpAttempt: rateLimitMock.recordRegisterIpAttempt,
}))

const csrfMock = vi.hoisted(() => ({ validateCsrfToken: vi.fn() }))
vi.mock("@/lib/csrf", () => csrfMock)

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
      headers: {
        "content-type": "application/json",
        "x-forwarded-for": "127.0.0.1",
        "x-real-ip": "127.0.0.1",
      },
      body: JSON.stringify(body),
    }),
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  rateLimitMock.isRegisterIpLimited.mockReturnValue({
    allowed: true,
    retryAfter: 0,
  })
  rateLimitMock.isRegisterLimited.mockReturnValue({
    allowed: true,
    retryAfter: 0,
  })
  rateLimitMock.recordRegisterAttempt.mockImplementation(() => undefined)
  rateLimitMock.recordRegisterIpAttempt.mockImplementation(() => undefined)
  csrfMock.validateCsrfToken.mockReturnValue(true)
  prismaMock.user.findFirst.mockResolvedValue(null)
  prismaMock.user.create.mockResolvedValue(createdUser)
  prismaMock.verificationToken.create.mockResolvedValue({ id: "vt_1" })
  sendVerificationEmailMock.mockResolvedValue({ data: { id: "em_1" } })
})

afterEach(() => {
  vi.resetModules()
})

describe("POST /api/v1/auth/register — integration (T29)", () => {
  it("fluxo completo: valida body → CSRF → check rate limit → cria user + token → envia email → retorna 201", async () => {
    const res = await callPost(validBody())
    const json = await res.json()

    expect(res.status).toBe(201)
    expect(json.message).toContain("verificacao")

    expect(rateLimitMock.isRegisterIpLimited).toHaveBeenCalledWith("127.0.0.1")
    expect(rateLimitMock.isRegisterLimited).toHaveBeenCalledWith(
      "maria@email.com",
    )
    expect(csrfMock.validateCsrfToken).toHaveBeenCalled()
    expect(prismaMock.user.findFirst).toHaveBeenCalledWith({
      where: { email: { equals: "maria@email.com", mode: "insensitive" } },
      select: { id: true },
    })
    expect(prismaMock.$transaction).toHaveBeenCalled()
    expect(prismaMock.verificationToken.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          identifier: "maria@email.com",
          type: "EMAIL",
        }),
      }),
    )
    expect(sendVerificationEmailMock).toHaveBeenCalledWith(
      "maria@email.com",
      expect.objectContaining({
        verificationUrl: expect.stringContaining("/verify-email?token="),
      }),
    )
    expect(rateLimitMock.recordRegisterAttempt).toHaveBeenCalledWith(
      "maria@email.com",
    )
    expect(rateLimitMock.recordRegisterIpAttempt).toHaveBeenCalledWith(
      "127.0.0.1",
    )
  })

  it("retorna 201 anti-enumeracao quando email ja existe (não expõe existência)", async () => {
    prismaMock.user.findFirst.mockResolvedValue({ id: "usr_existing" })

    const res = await callPost(validBody())
    const json = await res.json()

    expect(res.status).toBe(201)
    expect(json.message).toContain("verificacao")
    expect(prismaMock.user.create).not.toHaveBeenCalled()
    expect(prismaMock.verificationToken.create).not.toHaveBeenCalled()
  })

  it("retorna 422 quando body é invalido", async () => {
    const res = await callPost({ name: "M" })
    const json = await res.json()

    expect(res.status).toBe(422)
    expect(json.error.code).toBe("VALIDATION_ERROR")
  })

  it("retorna 429 quando IP é limitado", async () => {
    rateLimitMock.isRegisterIpLimited.mockReturnValue({
      allowed: false,
      retryAfter: 60,
    })

    const res = await callPost(validBody())
    const json = await res.json()

    expect(res.status).toBe(429)
    expect(json.error.code).toBe("AUTH_RATE_LIMITED")
    expect(json.error.retryAfter).toBe(60)
  })

  it("retorna 403 quando CSRF é invalido (antes de qualquer rate-limit/bcrypt/DB)", async () => {
    csrfMock.validateCsrfToken.mockReturnValue(false)

    const res = await callPost(validBody())
    const json = await res.json()

    expect(res.status).toBe(403)
    expect(json.error.code).toBe("CSRF_TOKEN_INVALID")
    expect(rateLimitMock.isRegisterIpLimited).not.toHaveBeenCalled()
    expect(rateLimitMock.isRegisterLimited).not.toHaveBeenCalled()
    expect(prismaMock.user.findFirst).not.toHaveBeenCalled()
  })

  it("retorna 201 mesmo quando email falha (anti-enumeracao por erro)", async () => {
    sendVerificationEmailMock.mockRejectedValue(new Error("SMTP down"))

    const res = await callPost(validBody())
    expect(res.status).toBe(201)
  })

  it("retorna 201 em caso de corrida P2002 (unique violation)", async () => {
    const p2002Error = Object.assign(new Error("Unique constraint"), {
      code: "P2002",
    })
    prismaMock.$transaction.mockRejectedValueOnce(p2002Error)

    const res = await callPost(validBody())
    expect(res.status).toBe(201)
  })
})
