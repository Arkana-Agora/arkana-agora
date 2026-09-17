// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { softDeleteAccount, verifyAccessToken } from "@/services/token-service"
import { createTokenError } from "./helpers/errors"
import { VERIFIED_EMAIL, verifiedJwtPayload } from "./fixtures/users"

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
  tokenServiceMock.verifyAccessToken.mockResolvedValue(verifiedJwtPayload())
  tokenServiceMock.softDeleteAccount.mockResolvedValue(undefined)
  prismaMock.user.findUnique.mockResolvedValue({
    id: "usr_1",
    email: VERIFIED_EMAIL,
  })
  sendAccountDeletionEmailMock.mockResolvedValue({ data: { id: "em_1" } })
})

afterEach(() => {
  vi.resetModules()
})

describe("DELETE /api/v1/auth/account — soft delete integration (T29)", () => {
  it("fluxo completo: valida bearer → busca user → compara email → soft delete → envia email → 200", async () => {
    const res = await callDelete({
      bearer: "access.jwt",
      body: { email: "maria@email.com" },
    })
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.message).toBe(DELETION_MESSAGE)

    expect(tokenServiceMock.verifyAccessToken).toHaveBeenCalledWith(
      "access.jwt",
    )
    expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
      where: { id: "usr_1" },
      select: { email: true },
    })
    expect(tokenServiceMock.softDeleteAccount).toHaveBeenCalledWith("usr_1")
    expect(sendAccountDeletionEmailMock).toHaveBeenCalledWith(
      "maria@email.com",
      expect.objectContaining({ deleteAfterDays: 30 }),
    )

    const cacheControl = res.headers.get("cache-control")
    expect(cacheControl).toBe("no-store")
  })

  it("retorna 200 anti-enumeracao quando email não confere (não expõe erro)", async () => {
    const res = await callDelete({
      bearer: "access.jwt",
      body: { email: "wrong@email.com" },
    })
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.message).toBe(DELETION_MESSAGE)
    expect(tokenServiceMock.softDeleteAccount).not.toHaveBeenCalled()
  })

  it("retorna 401 quando bearer está ausente", async () => {
    const res = await callDelete({ body: { email: "maria@email.com" } })
    const json = await res.json()

    expect(res.status).toBe(401)
    expect(json.error.code).toBe("AUTH_TOKEN_INVALID")
    expect(tokenServiceMock.softDeleteAccount).not.toHaveBeenCalled()
  })

  it("retorna 401 quando token é invalido", async () => {
    tokenServiceMock.verifyAccessToken.mockRejectedValue(
      createTokenError("AUTH_TOKEN_INVALID"),
    )

    const res = await callDelete({
      bearer: "bad-token",
      body: { email: "maria@email.com" },
    })
    const json = await res.json()

    expect(res.status).toBe(401)
    expect(json.error.code).toBe("AUTH_TOKEN_INVALID")
    expect(tokenServiceMock.softDeleteAccount).not.toHaveBeenCalled()
  })

  it("retorna 422 quando body não contém email", async () => {
    const res = await callDelete({
      bearer: "access.jwt",
      body: {},
    })
    const json = await res.json()

    expect(res.status).toBe(422)
    expect(json.error.code).toBe("VALIDATION_ERROR")
    expect(tokenServiceMock.softDeleteAccount).not.toHaveBeenCalled()
  })

  it("retorna 422 quando body está malformado", async () => {
    const { DELETE } = await import("@/app/api/v1/auth/account/route")
    const res = await DELETE(
      new Request("http://localhost:3000/api/v1/auth/account", {
        method: "DELETE",
        headers: { authorization: "Bearer access.jwt" },
        body: "not-json",
      }),
    )
    expect(res.status).toBe(422)
  })
})
