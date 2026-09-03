import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  verifyAccessToken,
  revokeRefreshSession,
  revokeAllSessions,
} from "@/services/token-service"

const tokenServiceMock = vi.hoisted(() => ({
  verifyAccessToken: vi.fn<typeof verifyAccessToken>(),
  revokeRefreshSession: vi.fn<typeof revokeRefreshSession>(),
  revokeAllSessions: vi.fn<typeof revokeAllSessions>(),
}))

vi.mock("@/services/token-service", () => tokenServiceMock)

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

async function callLogout(options: {
  bearer?: string
  cookie?: string
  body?: unknown
}): Promise<Response> {
  const { POST } = await import("@/app/api/v1/auth/logout/route")
  const headers: Record<string, string> = {}
  if (options.bearer) {
    headers.authorization = `Bearer ${options.bearer}`
  }
  if (options.cookie) {
    headers.cookie = `refreshToken=${options.cookie}`
  }
  const body =
    options.body !== undefined ? JSON.stringify(options.body) : undefined

  const init: RequestInit = { method: "POST", headers }
  if (body !== undefined) {
    init.body = body
  }

  return POST(new Request("http://localhost:3000/api/v1/auth/logout", init))
}

beforeEach(() => {
  vi.clearAllMocks()
  tokenServiceMock.verifyAccessToken.mockResolvedValue(verifiedUser)
  tokenServiceMock.revokeRefreshSession.mockResolvedValue(undefined)
  tokenServiceMock.revokeAllSessions.mockResolvedValue(undefined)
})

afterEach(() => {
  vi.resetModules()
})

describe("POST /api/v1/auth/logout (T14)", () => {
  it("revoga a sessao do refresh cookie e limpa o cookie com 200", async () => {
    const res = await callLogout({ bearer: "access.jwt", cookie: "rt-token" })
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.message).toBeTruthy()
    expect(tokenServiceMock.verifyAccessToken).toHaveBeenCalledWith(
      "access.jwt",
    )
    expect(tokenServiceMock.revokeRefreshSession).toHaveBeenCalledWith(
      "rt-token",
      "usr_1",
    )

    const setCookie = res.headers.get("set-cookie") ?? ""
    expect(setCookie).toContain("refreshToken=")
    expect(setCookie).toContain("Max-Age=0")
    expect(setCookie).toContain("Path=/api/v1/auth")
  })

  it("passa 200 e limpa o cookie quando nao ha refresh cookie (idempotente)", async () => {
    const res = await callLogout({ bearer: "access.jwt" })
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.message).toBeTruthy()
    expect(tokenServiceMock.revokeRefreshSession).not.toHaveBeenCalled()
    expect(tokenServiceMock.revokeAllSessions).not.toHaveBeenCalled()
    const setCookie = res.headers.get("set-cookie") ?? ""
    expect(setCookie).toContain("Max-Age=0")
  })

  it("com allDevices=true revoga todas as sessoes do usuario (ignorando o refresh do device)", async () => {
    const res = await callLogout({
      bearer: "access.jwt",
      cookie: "rt-token",
      body: { allDevices: true },
    })
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.message).toBeTruthy()
    expect(tokenServiceMock.revokeAllSessions).toHaveBeenCalledWith("usr_1")
    expect(tokenServiceMock.revokeRefreshSession).not.toHaveBeenCalled()
    const setCookie = res.headers.get("set-cookie") ?? ""
    expect(setCookie).toContain("Max-Age=0")
  })

  it("trata allDevices nao-booleano como false (revoga so o device)", async () => {
    const res = await callLogout({
      bearer: "access.jwt",
      cookie: "rt-token",
      body: { allDevices: "sim" },
    })

    expect(res.status).toBe(200)
    expect(tokenServiceMock.revokeRefreshSession).toHaveBeenCalledWith(
      "rt-token",
      "usr_1",
    )
    expect(tokenServiceMock.revokeAllSessions).not.toHaveBeenCalled()
  })

  it("passa 401 AUTH_TOKEN_INVALID quando o header Authorization esta ausente", async () => {
    const res = await callLogout({})
    const json = await res.json()

    expect(res.status).toBe(401)
    expect(json.error.code).toBe("AUTH_TOKEN_INVALID")
    expect(json.meta.requestId).toBeTruthy()
    expect(tokenServiceMock.revokeRefreshSession).not.toHaveBeenCalled()
    expect(tokenServiceMock.revokeAllSessions).not.toHaveBeenCalled()
  })

  it("passa 401 AUTH_TOKEN_REVOKED quando verifyAccessToken lanca AuthTokenError", async () => {
    tokenServiceMock.verifyAccessToken.mockRejectedValue(
      tokenError("AUTH_TOKEN_REVOKED"),
    )

    const res = await callLogout({ bearer: "access.jwt" })
    const json = await res.json()

    expect(res.status).toBe(401)
    expect(json.error.code).toBe("AUTH_TOKEN_REVOKED")
    expect(tokenServiceMock.revokeRefreshSession).not.toHaveBeenCalled()
  })

  it("passa 403 AUTH_ACCOUNT_SUSPENDED para conta inativa/deletada", async () => {
    tokenServiceMock.verifyAccessToken.mockRejectedValue(
      tokenError("AUTH_ACCOUNT_SUSPENDED"),
    )

    const res = await callLogout({ bearer: "access.jwt" })
    const json = await res.json()

    expect(res.status).toBe(403)
    expect(json.error.code).toBe("AUTH_ACCOUNT_SUSPENDED")
  })

  it("passa 500 INTERNAL_ERROR para erro desconhecido na validacao do token", async () => {
    tokenServiceMock.verifyAccessToken.mockRejectedValue(
      tokenError("SOME_UNKNOWN_CODE"),
    )

    const res = await callLogout({ bearer: "access.jwt" })
    const json = await res.json()

    expect(res.status).toBe(500)
    expect(json.error.code).toBe("INTERNAL_ERROR")
    expect(json.meta.requestId).toBeTruthy()
  })

  it("passa 500 INTERNAL_ERROR (com meta.requestId) para erro generico na validacao do token", async () => {
    tokenServiceMock.verifyAccessToken.mockRejectedValue(new Error("boom"))

    const res = await callLogout({ bearer: "access.jwt" })
    const json = await res.json()

    expect(res.status).toBe(500)
    expect(json.error.code).toBe("INTERNAL_ERROR")
    expect(json.meta.requestId).toBeTruthy()
  })

  it("passa 500 INTERNAL_ERROR (com meta.requestId) para erro inesperado na revogacao", async () => {
    tokenServiceMock.revokeRefreshSession.mockRejectedValue(
      new Error("db down"),
    )

    const res = await callLogout({ bearer: "access.jwt", cookie: "rt" })
    const json = await res.json()

    expect(res.status).toBe(500)
    expect(json.error.code).toBe("INTERNAL_ERROR")
    expect(json.meta.requestId).toBeTruthy()
  })

  it("nao expoe tokens no corpo da resposta (C13)", async () => {
    const res = await callLogout({
      bearer: "secret-access",
      cookie: "secret-refresh",
    })
    const json = await res.json()
    const body = JSON.stringify(json)

    expect(body).not.toContain("secret-access")
    expect(body).not.toContain("secret-refresh")
  })
})
