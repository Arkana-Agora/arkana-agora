import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import bcrypt from "bcryptjs"
import { mirrorTokenVersion } from "@/services/token-service"
import { restoreAccount } from "@/services/account-service"

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
  mirrorTokenVersionWithRetry: vi.fn(),
}))

vi.mock("@/services/token-service", () => tokenServiceMock)

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

describe("POST /api/v1/auth/restore-account (T17)", () => {
  it("restaura conta dentro da janela com email+senha validos: 200 { message } + claim atomico + mirror", async () => {
    const res = await callPost({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
    })
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.message).toBe(SUCCESS_MESSAGE)
    expect(json.meta).toBeUndefined()
    expect(res.headers.get("cache-control")).toBe("no-store")

    expect(prismaMock.user.findFirst).toHaveBeenCalledWith({
      where: { email: TEST_EMAIL },
      select: expect.objectContaining({
        id: true,
        email: true,
        isActive: true,
        deletedAt: true,
        passwordHash: true,
      }),
    })

    expect(prismaMock.user.updateMany).toHaveBeenCalledTimes(1)
    const args = prismaMock.user.updateMany.mock.calls[0]![0]
    expect(args.where).toEqual({
      id: "usr_restore1",
      email: TEST_EMAIL,
      isActive: false,
      deletedAt: { not: null, gte: expect.any(Date) },
    })
    expect(args.data).toEqual({
      isActive: true,
      deletedAt: null,
      tokenVersion: { increment: 1 },
    })
  })

  it("normaliza o email para minusculas na consulta (S7)", async () => {
    const res = await callPost({
      email: "Maria@Email.com",
      password: TEST_PASSWORD,
    })

    expect(res.status).toBe(200)
    expect(prismaMock.user.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { email: TEST_EMAIL } }),
    )
  })

  it("anti-enumeracao: senha incorreta retorna 200 com a MESMA mensagem e nao altera nada", async () => {
    const res = await callPost({
      email: TEST_EMAIL,
      password: "SenhaErrada123!",
    })
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.message).toBe(SUCCESS_MESSAGE)
    expect(prismaMock.user.updateMany).not.toHaveBeenCalled()
    expect(tokenServiceMock.mirrorTokenVersion).not.toHaveBeenCalled()
  })

  it("anti-enumeracao: email inexistente retorna 200 com a MESMA mensagem", async () => {
    prismaMock.user.findFirst.mockResolvedValue(null)

    const res = await callPost({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
    })
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.message).toBe(SUCCESS_MESSAGE)
    expect(prismaMock.user.updateMany).not.toHaveBeenCalled()
  })

  it("anti-enumeracao: hard delete ja anonimizou a conta (email mudou) — busca nao encontra, 200 no-op idem", async () => {
    prismaMock.user.findFirst.mockResolvedValue(null)

    const res = await callPost({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
    })
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.message).toBe(SUCCESS_MESSAGE)
    expect(prismaMock.user.updateMany).not.toHaveBeenCalled()
  })

  it("anti-enumeracao: conta ativa (nunca deletada) com senha correta e 200 no-op idem", async () => {
    prismaMock.user.findFirst.mockResolvedValue(
      softDeletedUserRow({ isActive: true, deletedAt: null }),
    )

    const res = await callPost({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
    })
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.message).toBe(SUCCESS_MESSAGE)
    expect(prismaMock.user.updateMany).not.toHaveBeenCalled()
  })

  it("anti-enumeracao: isActive=false sem deletedAt (desativacao nao-LGPD) com senha correta e 200 no-op idem", async () => {
    prismaMock.user.findFirst.mockResolvedValue(
      softDeletedUserRow({ deletedAt: null }),
    )

    const res = await callPost({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
    })
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.message).toBe(SUCCESS_MESSAGE)
    expect(prismaMock.user.updateMany).not.toHaveBeenCalled()
  })

  it("anti-enumeracao: conta OAuth-only (passwordHash null) responde 200 no-op idem", async () => {
    prismaMock.user.findFirst.mockResolvedValue(
      softDeletedUserRow({ passwordHash: null }),
    )

    const res = await callPost({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
    })
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.message).toBe(SUCCESS_MESSAGE)
    expect(prismaMock.user.updateMany).not.toHaveBeenCalled()
  })

  it("anti-enumeracao: no-op aplica piso de tempo (>= 240ms)", async () => {
    const startedAt = Date.now()
    const res = await callPost({
      email: TEST_EMAIL,
      password: "SenhaErrada123!",
    })
    const elapsedMs = Date.now() - startedAt

    expect(res.status).toBe(200)
    expect(elapsedMs).toBeGreaterThanOrEqual(240)
    expect(elapsedMs).toBeLessThanOrEqual(1500) // Reasonable upper bound
  })

  it("rejeita com 400 AUTH_RESTORE_WINDOW_EXPIRED quando o dono prova posse mas a janela de 30 dias expirou", async () => {
    prismaMock.user.findFirst.mockResolvedValue(
      softDeletedUserRow({ deletedAt: new Date(Date.now() - 31 * 86_400_000) }),
    )

    const res = await callPost({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
    })
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error.code).toBe("AUTH_RESTORE_WINDOW_EXPIRED")
    expect(typeof json.meta.requestId).toBe("string")
    expect(prismaMock.user.updateMany).not.toHaveBeenCalled()
    expect(json.message).not.toBe(SUCCESS_MESSAGE)
  })

  it("conta restaurada em paralelo (claim count 0): 200 no-op idem e mirror nao roda", async () => {
    prismaMock.user.updateMany.mockResolvedValue({ count: 0 })

    const res = await callPost({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
    })
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.message).toBe(SUCCESS_MESSAGE)
    expect(tokenServiceMock.mirrorTokenVersion).not.toHaveBeenCalled()
  })

  it("a abstencao = restauracao real no no-op concorrente nao conta como sucesso separado (mesma mensagem e header)", async () => {
    const success = await callPost({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
    })
    const wrongPassword = await callPost({
      email: TEST_EMAIL,
      password: "SenhaErrada123!",
    })

    const successBody = await success.json()
    const wrongBody = await wrongPassword.json()

    expect(successBody).toEqual(wrongBody)
    expect(success.headers.get("cache-control")).toBe("no-store")
    expect(wrongPassword.headers.get("cache-control")).toBe("no-store")
  })

  it("retorna 422 VALIDATION_ERROR (com details) quando email e senha estao ausentes", async () => {
    const res = await callPost({})
    const json = await res.json()

    expect(res.status).toBe(422)
    expect(json.error.code).toBe("VALIDATION_ERROR")
    expect(json.error.details).toBeTruthy()
    expect(prismaMock.user.findFirst).not.toHaveBeenCalled()
  })

  it("retorna 422 VALIDATION_ERROR para campos extras (schema .strict)", async () => {
    const res = await callPost({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
      extra: true,
    })
    const json = await res.json()

    expect(res.status).toBe(422)
    expect(json.error.code).toBe("VALIDATION_ERROR")
    expect(prismaMock.user.findFirst).not.toHaveBeenCalled()
  })

  it("retorna 422 VALIDATION_ERROR para senha vazia", async () => {
    const res = await callPost({ email: TEST_EMAIL, password: "" })
    const json = await res.json()

    expect(res.status).toBe(422)
    expect(json.error.code).toBe("VALIDATION_ERROR")
    expect(prismaMock.user.findFirst).not.toHaveBeenCalled()
  })

  it("retorna 422 VALIDATION_ERROR para corpo nao-JSON", async () => {
    const res = await callPost("nao é json")
    const json = await res.json()

    expect(res.status).toBe(422)
    expect(json.error.code).toBe("VALIDATION_ERROR")
    expect(prismaMock.user.findFirst).not.toHaveBeenCalled()
  })

  it("retorna 200 quando a consulta de usuario falha (erro nao exposto)", async () => {
    prismaMock.user.findFirst.mockRejectedValue(new Error("db down"))

    const res = await callPost({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
    })
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.message).toBe(SUCCESS_MESSAGE)
    expect(prismaMock.user.updateMany).not.toHaveBeenCalled()
  })

  it("retorna 200 quando a transacao de restauracao falha (erro nao exposto)", async () => {
    prismaMock.user.updateMany.mockRejectedValue(new Error("tx fail"))

    const res = await callPost({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
    })
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.message).toBe(SUCCESS_MESSAGE)
  })
})

describe("restoreAccount service", () => {
  const TEST_EMAIL = "test@example.com"
  const TEST_PASSWORD = "Senha123!"
  const HASHED_PASSWORD = bcrypt.hashSync(TEST_PASSWORD, 10)

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("restaura conta com sucesso", async () => {
    const softDeletedUser = {
      id: "user-1",
      email: TEST_EMAIL,
      isActive: false,
      deletedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), // 10 days ago
      passwordHash: HASHED_PASSWORD,
    }

    vi.spyOn(prismaMock.user, "findFirst").mockResolvedValue(softDeletedUser)
    vi.spyOn(prismaMock.user, "updateMany").mockResolvedValue({ count: 1 })

    const result = await restoreAccount(
      TEST_EMAIL,
      TEST_PASSWORD,
      "req-123",
      "127.0.0.1",
      "Mozilla/5.0",
    )

    expect(result.success).toBe(true)
    expect(prismaMock.user.updateMany).toHaveBeenCalledWith({
      where: {
        id: "user-1",
        email: TEST_EMAIL,
        isActive: false,
        deletedAt: { not: null, gte: expect.any(Date) },
      },
      data: {
        isActive: true,
        deletedAt: null,
        tokenVersion: { increment: 1 },
      },
    })
  })

  it("falha com janela expirada", async () => {
    const oldDeletedUser = {
      id: "user-1",
      email: TEST_EMAIL,
      isActive: false,
      deletedAt: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000), // 40 days ago
      passwordHash: HASHED_PASSWORD,
    }

    vi.spyOn(prismaMock.user, "findFirst").mockResolvedValue(oldDeletedUser)

    const result = await restoreAccount(
      TEST_EMAIL,
      TEST_PASSWORD,
      "req-123",
      "127.0.0.1",
      "Mozilla/5.0",
    )

    expect(result.success).toBe(false)
    expect(result.error?.code).toBe("AUTH_RESTORE_WINDOW_EXPIRED")
  })
})
