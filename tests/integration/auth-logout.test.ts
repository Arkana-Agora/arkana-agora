// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  verifyAccessToken,
  revokeRefreshSession,
  revokeAllSessions,
} from "@/services/token-service"
import { createTokenError } from "./helpers/errors"
import { verifiedJwtPayload } from "./fixtures/users"

const tokenServiceMock = vi.hoisted(() => ({
  verifyAccessToken: vi.fn<typeof verifyAccessToken>(),
  revokeRefreshSession: vi.fn<typeof revokeRefreshSession>(),
  revokeAllSessions: vi.fn<typeof revokeAllSessions>(),
}))

vi.mock("@/services/token-service", () => tokenServiceMock)

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
  tokenServiceMock.verifyAccessToken.mockResolvedValue(verifiedJwtPayload())
  tokenServiceMock.revokeRefreshSession.mockResolvedValue(undefined)
  tokenServiceMock.revokeAllSessions.mockResolvedValue(undefined)
})

afterEach(() => {
  vi.resetModules()
})

describe("POST /api/v1/auth/logout — integration (T29)", () => {
  it("fluxo completo: valida bearer → revoga sessão → limpa cookie → 200", async () => {
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
    expect(setCookie).toContain("HttpOnly")
    expect(setCookie).toContain("authjs.session-token=")
  })

  it("retorna 401 quando bearer está ausente", async () => {
    const res = await callLogout({})
    const json = await res.json()

    expect(res.status).toBe(401)
    expect(json.error.code).toBe("AUTH_TOKEN_INVALID")
  })

  it("retorna 401 quando token de acesso é invalido", async () => {
    tokenServiceMock.verifyAccessToken.mockRejectedValue(
      createTokenError("AUTH_TOKEN_INVALID"),
    )

    const res = await callLogout({ bearer: "bad-token" })
    const json = await res.json()

    expect(res.status).toBe(401)
    expect(json.error.code).toBe("AUTH_TOKEN_INVALID")
  })

  it("retorna 403 quando conta está suspensa", async () => {
    tokenServiceMock.verifyAccessToken.mockRejectedValue(
      createTokenError("AUTH_ACCOUNT_SUSPENDED"),
    )

    const res = await callLogout({ bearer: "token-for-suspended" })
    const json = await res.json()

    expect(res.status).toBe(403)
    expect(json.error.code).toBe("AUTH_ACCOUNT_SUSPENDED")
  })

  it("suporte a allDevices: chama revokeAllSessions quando body.allDevices=true", async () => {
    const res = await callLogout({
      bearer: "access.jwt",
      cookie: "rt-token",
      body: { allDevices: true },
    })

    expect(res.status).toBe(200)
    expect(tokenServiceMock.revokeAllSessions).toHaveBeenCalledWith("usr_1")
    expect(tokenServiceMock.revokeRefreshSession).not.toHaveBeenCalled()
  })

  it("retorna cache-control: no-store", async () => {
    const res = await callLogout({ bearer: "access.jwt", cookie: "rt-token" })
    expect(res.headers.get("cache-control")).toBe("no-store")
  })
})
