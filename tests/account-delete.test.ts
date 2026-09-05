import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { softDeleteAccount, verifyAccessToken } from "@/services/token-service"

const tokenServiceMock = vi.hoisted(() => ({
  verifyAccessToken: vi.fn<typeof verifyAccessToken>(),
  softDeleteAccount: vi.fn<typeof softDeleteAccount>(),
}))

vi.mock("@/services/token-service", () => tokenServiceMock)

const prismaMock = vi.hoisted(() => ({
  user: {
    findUnique: vi.fn(),
  },
}))

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }))

const sendAccountDeletionEmailMock = vi.hoisted(() => vi.fn())
vi.mock("@/lib/email/email", () => ({
  sendAccountDeletionEmail: sendAccountDeletionEmailMock,
}))

const DELETION_MESSAGE =
  "Conta marcada para exclusao. Voce tem 30 dias para reverter."

function tokenError(code: string): Error {
  const err = new Error(`${code}: teste`)
  err.name = "AuthTokenError"
  ;(err as { code?: string }).code = code
  return err
}

const verifiedUser = {
  userId: "usr_1",
  role: "USER",
  plan: "FREE",
  tokenVersion: 1,
}

function userRow(overrides: Record<string, unknown> = {}) {
  return { id: "usr_1", email: "maria@email.com", ...overrides }
}

async function callDelete(options: {
  bearer?: string
  body?: unknown
}): Promise<Response> {
  const { DELETE } = await import("@/app/api/v1/auth/account/route")
  const headers: Record<string, string> = {}
  if (options.bearer) {
    headers.authorization = `Bearer ${options.bearer}`
  }
  const init: RequestInit = { method: "DELETE", headers }
  if (options.body !== undefined) {
    init.body = JSON.stringify(options.body)
  }
  return DELETE(new Request("http://localhost:3000/api/v1/auth/account", init))
}

beforeEach(() => {
  vi.clearAllMocks()
  tokenServiceMock.verifyAccessToken.mockResolvedValue(verifiedUser)
  tokenServiceMock.softDeleteAccount.mockResolvedValue(undefined)
  prismaMock.user.findUnique.mockResolvedValue(userRow())
  sendAccountDeletionEmailMock.mockResolvedValue({ data: { id: "em_1" } })
})

afterEach(() => {
  vi.resetModules()
})

describe("DELETE /api/v1/auth/account (T15)", () => {
  it("passa 401 AUTH_TOKEN_INVALID quando o header Authorization esta ausente", async () => {
    const res = await callDelete({ body: { email: "maria@email.com" } })
    const json = await res.json()

    expect(res.status).toBe(401)
    expect(json.error.code).toBe("AUTH_TOKEN_INVALID")
    expect(tokenServiceMock.softDeleteAccount).not.toHaveBeenCalled()
  })

  it("passa 401 AUTH_TOKEN_REVOKED quando verifyAccessToken lanca AuthTokenError", async () => {
    tokenServiceMock.verifyAccessToken.mockRejectedValue(
      tokenError("AUTH_TOKEN_REVOKED"),
    )

    const res = await callDelete({ bearer: "access.jwt" })
    const json = await res.json()

    expect(res.status).toBe(401)
    expect(json.error.code).toBe("AUTH_TOKEN_REVOKED")
  })

  it("passa 403 AUTH_ACCOUNT_SUSPENDED para conta inativa/deletada", async () => {
    tokenServiceMock.verifyAccessToken.mockRejectedValue(
      tokenError("AUTH_ACCOUNT_SUSPENDED"),
    )

    const res = await callDelete({ bearer: "access.jwt" })
    const json = await res.json()

    expect(res.status).toBe(403)
    expect(json.error.code).toBe("AUTH_ACCOUNT_SUSPENDED")
  })

  it("passa 500 INTERNAL_ERROR (com meta.requestId) para erro generico na validacao", async () => {
    tokenServiceMock.verifyAccessToken.mockRejectedValue(new Error("boom"))

    const res = await callDelete({ bearer: "access.jwt" })
    const json = await res.json()

    expect(res.status).toBe(500)
    expect(json.error.code).toBe("INTERNAL_ERROR")
    expect(json.meta.requestId).toBeTruthy()
  })

  it("passa 422 VALIDATION_ERROR quando o corpo nao e JSON valido", async () => {
    const { DELETE } = await import("@/app/api/v1/auth/account/route")
    const res = await DELETE(
      new Request("http://localhost:3000/api/v1/auth/account", {
        method: "DELETE",
        headers: { authorization: "Bearer access.jwt" },
        body: "nao-json",
      }),
    )
    const json = await res.json()

    expect(res.status).toBe(422)
    expect(json.error.code).toBe("VALIDATION_ERROR")
    expect(tokenServiceMock.softDeleteAccount).not.toHaveBeenCalled()
  })

  it("passa 422 VALIDATION_ERROR (com details) quando o email esta ausente", async () => {
    const res = await callDelete({ bearer: "access.jwt", body: {} })
    const json = await res.json()

    expect(res.status).toBe(422)
    expect(json.error.code).toBe("VALIDATION_ERROR")
    expect(json.error.details).toBeTruthy()
    expect(tokenServiceMock.softDeleteAccount).not.toHaveBeenCalled()
  })

  it("anti-enumeracao: email divergente do logado retorna 200 com a MESMA mensagem e nada e alterado", async () => {
    const res = await callDelete({
      bearer: "access.jwt",
      body: { email: "outra@email.com" },
    })
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.message).toBe(DELETION_MESSAGE)
    expect(tokenServiceMock.softDeleteAccount).not.toHaveBeenCalled()
    expect(sendAccountDeletionEmailMock).not.toHaveBeenCalled()
    expect(res.headers.get("cache-control")).toBe("no-store")
  })

  it("anti-enumeracao: email divergente apenas na caixa tambem nao deleta (comparacao identica)", async () => {
    const res = await callDelete({
      bearer: "access.jwt",
      body: { email: "Maria@Email.com" },
    })
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.message).toBe(DELETION_MESSAGE)
    expect(tokenServiceMock.softDeleteAccount).not.toHaveBeenCalled()
    expect(sendAccountDeletionEmailMock).not.toHaveBeenCalled()
  })

  it("anti-enumeracao: usuario inexistente retorna 200 com a MESMA mensagem", async () => {
    prismaMock.user.findUnique.mockResolvedValue(null)

    const res = await callDelete({
      bearer: "access.jwt",
      body: { email: "maria@email.com" },
    })
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.message).toBe(DELETION_MESSAGE)
    expect(tokenServiceMock.softDeleteAccount).not.toHaveBeenCalled()
    expect(sendAccountDeletionEmailMock).not.toHaveBeenCalled()
  })

  it("anti-enumeracao: no-op aplica o piso de tempo (>= 240ms) para nao vazar timing", async () => {
    const startedAt = Date.now()
    const res = await callDelete({
      bearer: "access.jwt",
      body: { email: "outra@email.com" },
    })
    const elapsedMs = Date.now() - startedAt

    expect(res.status).toBe(200)
    expect(elapsedMs).toBeGreaterThanOrEqual(240)
  })

  it("soft delete: email identico aplica softDeleteAccount atomico, revoga, avisa e retorna 200 idem", async () => {
    const res = await callDelete({
      bearer: "access.jwt",
      body: { email: "maria@email.com" },
    })
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.message).toBe(DELETION_MESSAGE)

    expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
      where: { id: "usr_1" },
      select: { email: true },
    })
    expect(tokenServiceMock.softDeleteAccount).toHaveBeenCalledWith("usr_1")
    expect(sendAccountDeletionEmailMock).toHaveBeenCalledWith(
      "maria@email.com",
      { deleteAfterDays: 30 },
    )

    expect(res.headers.get("cache-control")).toBe("no-store")
  })

  it("mesma mensagem e mesmo header (cache-control) entre sucesso e email divergente", async () => {
    const success = await callDelete({
      bearer: "access.jwt",
      body: { email: "maria@email.com" },
    })
    const mismatch = await callDelete({
      bearer: "access.jwt",
      body: { email: "outra@email.com" },
    })

    const successBody = await success.json()
    const mismatchBody = await mismatch.json()

    expect(successBody).toEqual(mismatchBody)
    expect(success.headers.get("cache-control")).toBe("no-store")
    expect(mismatch.headers.get("cache-control")).toBe("no-store")
  })

  it("falha do email de confirmacao nao altera a resposta 200 (delecao ja aplicada)", async () => {
    sendAccountDeletionEmailMock.mockRejectedValue(new Error("smtp down"))

    const res = await callDelete({
      bearer: "access.jwt",
      body: { email: "maria@email.com" },
    })
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.message).toBe(DELETION_MESSAGE)
    expect(tokenServiceMock.softDeleteAccount).toHaveBeenCalledWith("usr_1")
  })

  it("passa 500 INTERNAL_ERROR quando o soft delete (transacao atomica) falha", async () => {
    tokenServiceMock.softDeleteAccount.mockRejectedValue(new Error("db down"))

    const res = await callDelete({
      bearer: "access.jwt",
      body: { email: "maria@email.com" },
    })
    const json = await res.json()

    expect(res.status).toBe(500)
    expect(json.error.code).toBe("INTERNAL_ERROR")
    expect(json.meta.requestId).toBeTruthy()
  })

  it("passa 500 INTERNAL_ERROR quando a consulta de confirmacao falha", async () => {
    prismaMock.user.findUnique.mockRejectedValue(new Error("db down"))

    const res = await callDelete({
      bearer: "access.jwt",
      body: { email: "maria@email.com" },
    })
    const json = await res.json()

    expect(res.status).toBe(500)
    expect(json.error.code).toBe("INTERNAL_ERROR")
    expect(json.meta.requestId).toBeTruthy()
  })

  it("nao expoe tokens no corpo da resposta (C13)", async () => {
    const res = await callDelete({
      bearer: "secret-access",
      body: { email: "maria@email.com" },
    })
    const body = JSON.stringify(await res.json())

    expect(body).not.toContain("secret-access")
  })
})
