// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import bcrypt from "bcryptjs"
import { mirrorTokenVersion } from "@/services/token-service"

const prismaMock = vi.hoisted(() => ({
  user: {
    findFirst: vi.fn(),
    updateMany: vi.fn(),
  },
  $transaction: vi.fn(),
}))

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }))

const tokenServiceMock = vi.hoisted(() => ({
  mirrorTokenVersion: vi.fn<typeof mirrorTokenVersion>(),
}))

vi.mock("@/services/token-service", () => tokenServiceMock)

const rateLimitMock = vi.hoisted(() => ({
  isPasswordResetLimited: vi.fn(),
  recordPasswordResetRequest: vi.fn(),
}))
vi.mock("@/lib/rate-limit", () => ({
  isPasswordResetLimited: rateLimitMock.isPasswordResetLimited,
  recordPasswordResetRequest: rateLimitMock.recordPasswordResetRequest,
}))

const TEST_EMAIL = "maria@email.com"
const TEST_PASSWORD = "SenhaSecreta123!"
const TEST_HASH = bcrypt.hashSync(TEST_PASSWORD, 10)

function softDeletedUserRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "usr_restore1",
    email: TEST_EMAIL,
    isActive: false,
    deletedAt: new Date(Date.now() - 5 * 86_400_000),
    passwordHash: TEST_HASH,
    ...overrides,
  }
}

const SUCCESS_MESSAGE =
  "Se a conta estava na janela de restauracao, o acesso foi restabelecido"

async function callPost(body: unknown): Promise<Response> {
  const { POST } = await import("@/app/api/v1/auth/restore-account/route")
  return POST(
    new Request("http://localhost:3000/api/v1/auth/restore-account", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  rateLimitMock.isPasswordResetLimited.mockReturnValue({
    allowed: true,
    retryAfter: 0,
  })
  prismaMock.user.findFirst.mockResolvedValue(softDeletedUserRow())
  prismaMock.user.updateMany.mockResolvedValue({ count: 1 })
  prismaMock.$transaction.mockImplementation(
    async (cb: (tx: typeof prismaMock) => unknown) => cb(prismaMock),
  )
  tokenServiceMock.mirrorTokenVersion.mockResolvedValue(undefined)
})

afterEach(() => {
  vi.resetModules()
})

describe("POST /api/v1/auth/restore-account — integration (T29)", () => {
  it("fluxo completo: valida body → rate limit → busca user → bcrypt → updateMany + transaction → mirror → 200", async () => {
    const res = await callPost({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
    })
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.message).toBe(SUCCESS_MESSAGE)
    expect(res.headers.get("cache-control")).toBe("no-store")

    expect(prismaMock.user.findFirst).toHaveBeenCalled()
    expect(prismaMock.user.updateMany).toHaveBeenCalled()
  })

  it("retorna 200 anti-enumeracao quando email não existe (não expõe)", async () => {
    prismaMock.user.findFirst.mockResolvedValue(null)

    const res = await callPost({
      email: "unknown@email.com",
      password: TEST_PASSWORD,
    })
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.message).toBe(SUCCESS_MESSAGE)
  })

  it("retorna 200 anti-enumeracao quando senha está incorreta", async () => {
    prismaMock.user.findFirst.mockResolvedValue(softDeletedUserRow())

    const res = await callPost({ email: TEST_EMAIL, password: "WrongPass123!" })
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.message).toBe(SUCCESS_MESSAGE)
  })

  it("retorna 429 quando rate limit é atingido", async () => {
    rateLimitMock.isPasswordResetLimited.mockReturnValue({
      allowed: false,
      retryAfter: 60,
    })

    const res = await callPost({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
    })
    const json = await res.json()

    expect(res.status).toBe(429)
    expect(json.error.code).toBe("AUTH_RATE_LIMITED")
    expect(json.error.retryAfter).toBe(60)
  })

  it("retorna 422 quando body é invalido", async () => {
    const res = await callPost({ email: "not-an-email" })
    const json = await res.json()

    expect(res.status).toBe(422)
    expect(json.error.code).toBe("VALIDATION_ERROR")
  })

  it("retorna 422 quando body está vazio", async () => {
    const res = await callPost({})
    expect(res.status).toBe(422)
  })
})
