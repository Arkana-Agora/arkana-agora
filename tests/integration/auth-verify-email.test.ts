// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { activeUserRow, VERIFIED_EMAIL } from "./fixtures/users"
import { VALID_TOKEN, verificationTokenRow } from "./fixtures/tokens"

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

beforeEach(() => {
  vi.clearAllMocks()
  prismaMock.verificationToken.findUnique.mockResolvedValue(
    verificationTokenRow(),
  )
  prismaMock.verificationToken.deleteMany.mockResolvedValue({ count: 1 })
  prismaMock.user.findFirst.mockResolvedValue(
    activeUserRow({ id: "usr_verify1" }),
  )
  prismaMock.user.update.mockResolvedValue({
    id: "usr_verify1",
    email: VERIFIED_EMAIL,
    emailVerified: new Date(),
  })
  tokenServiceMock.bumpTokenVersion.mockResolvedValue(undefined)
  sendVerificationEmailMock.mockResolvedValue({ data: { id: "em_1" } })
})

afterEach(() => {
  vi.resetModules()
})

describe("POST /api/v1/auth/verify-email — integration (T29)", () => {
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

  it("fluxo completo: valida token → busca user → marca emailVerified → bump tokenVersion → delete token → 200", async () => {
    const res = await callPost({ token: VALID_TOKEN })
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.message).toContain("sucesso")

    expect(prismaMock.verificationToken.findUnique).toHaveBeenCalledWith({
      where: { token: VALID_TOKEN },
    })
    expect(prismaMock.user.findFirst).toHaveBeenCalled()
    expect(tokenServiceMock.bumpTokenVersion).toHaveBeenCalledWith(
      "usr_verify1",
    )

    const cacheControl = res.headers.get("cache-control")
    expect(cacheControl).toBe("no-store")
  })

  it("retorna 401 quando token não existe", async () => {
    prismaMock.verificationToken.findUnique.mockResolvedValue(null)

    const res = await callPost({ token: "nonexistent" })
    const json = await res.json()

    expect(res.status).toBe(401)
    expect(json.error.code).toBe("AUTH_EMAIL_VERIFY_INVALID")
  })

  it("retorna 410 quando token está expirado", async () => {
    prismaMock.verificationToken.findUnique.mockResolvedValue(
      verificationTokenRow({ expiresAt: new Date(Date.now() - 60_000) }),
    )

    const res = await callPost({ token: VALID_TOKEN })
    const json = await res.json()

    expect(res.status).toBe(410)
    expect(json.error.code).toBe("AUTH_EMAIL_VERIFY_EXPIRED")
  })

  it("retorna 422 quando body não contém token", async () => {
    const res = await callPost({})
    expect(res.status).toBe(422)
  })

  it("retorna 401 quando token já foi utilizado (single-use)", async () => {
    prismaMock.verificationToken.deleteMany.mockResolvedValue({ count: 0 })

    const res = await callPost({ token: VALID_TOKEN })
    const json = await res.json()

    expect(res.status).toBe(401)
    expect(json.error.code).toBe("AUTH_EMAIL_VERIFY_INVALID")
  })

  it("retorna 401 quando token é de outro tipo (cross-contamination)", async () => {
    prismaMock.verificationToken.findUnique.mockResolvedValue(
      verificationTokenRow({ type: "PASSWORD_RESET" }),
    )

    const res = await callPost({ token: VALID_TOKEN })
    const json = await res.json()

    expect(res.status).toBe(401)
    expect(json.error.code).toBe("AUTH_EMAIL_VERIFY_INVALID")
  })

  it("retorna 401 quando usuário está inativo/deletado", async () => {
    prismaMock.user.findFirst.mockResolvedValue(
      activeUserRow({ id: "usr_verify1", isActive: false }),
    )

    const res = await callPost({ token: VALID_TOKEN })
    const json = await res.json()

    expect(res.status).toBe(401)
    expect(json.error.code).toBe("AUTH_EMAIL_VERIFY_INVALID")
  })
})

describe("POST /api/v1/auth/verify-email/resend — integration (T29)", () => {
  async function callResend(body: unknown): Promise<Response> {
    const { POST } = await import("@/app/api/v1/auth/verify-email/resend/route")
    return POST(
      new Request("http://localhost:3000/api/v1/auth/verify-email/resend", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      }),
    )
  }

  it("fluxo completo: busca user não verificado → cria novo token → envia email → 200", async () => {
    prismaMock.user.findFirst.mockResolvedValue({
      id: "usr_1",
      email: "maria@email.com",
      emailVerified: null,
      isActive: true,
      deletedAt: null,
    })

    const res = await callResend({ email: "maria@email.com" })
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.message).toContain("verificacao")
    expect(prismaMock.verificationToken.create).toHaveBeenCalled()
    expect(sendVerificationEmailMock).toHaveBeenCalled()
  })

  it("retorna 200 anti-enumeracao quando email não existe", async () => {
    prismaMock.user.findFirst.mockResolvedValue(null)

    const res = await callResend({ email: "unknown@email.com" })
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.message).toContain("verificacao")
  })
})
