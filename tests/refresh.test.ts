import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { rotateRefresh } from "@/services/token-service"

const tokenServiceMock = vi.hoisted(() => ({
  rotateRefresh: vi.fn<typeof rotateRefresh>(),
}))

vi.mock("@/services/token-service", () => tokenServiceMock)

function refreshTokenError(code: string): Error {
  const err = new Error(`${code}: teste`)
  err.name = "AuthTokenError"
  ;(err as { code?: string }).code = code
  return err
}

async function callPost(cookie: string | null): Promise<Response> {
  const { POST } = await import("@/app/api/v1/auth/refresh/route")
  const headers = cookie ? { cookie: `refreshToken=${cookie}` } : {}
  return POST(
    new Request("http://localhost:3000/api/v1/auth/refresh", {
      method: "POST",
      headers,
    }),
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  tokenServiceMock.rotateRefresh.mockResolvedValue({
    accessToken: "access.jwt.token",
    refreshToken: "new-refresh-token",
    expiresIn: 900,
  })
})

afterEach(() => {
  vi.resetModules()
})

describe("POST /api/v1/auth/refresh (T13)", () => {
  it("retorna 200 com accessToken e expiresIn, e seta cookie refreshToken rotacionado", async () => {
    const res = await callPost("old-refresh-token")
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.accessToken).toBe("access.jwt.token")
    expect(json.expiresIn).toBe(900)
    expect(json.refreshToken).toBeUndefined()

    const setCookie = res.headers.get("set-cookie") ?? ""
    expect(setCookie).toContain("refreshToken=new-refresh-token")
    expect(setCookie).toContain("HttpOnly")
    expect(setCookie).toContain("SameSite=Strict")
    expect(setCookie).toContain("Path=/api/v1/auth")

    expect(tokenServiceMock.rotateRefresh).toHaveBeenCalledWith(
      "old-refresh-token",
    )
  })

  it("passa 401 AUTH_REFRESH_TOKEN_INVALID quando o token nao existe", async () => {
    tokenServiceMock.rotateRefresh.mockRejectedValue(
      refreshTokenError("AUTH_REFRESH_TOKEN_INVALID"),
    )

    const res = await callPost("bad-token")
    const json = await res.json()

    expect(res.status).toBe(401)
    expect(json.error.code).toBe("AUTH_REFRESH_TOKEN_INVALID")
    expect(json.meta.requestId).toBeTruthy()
  })

  it("passa 401 AUTH_REFRESH_TOKEN_EXPIRED quando o token expirou", async () => {
    tokenServiceMock.rotateRefresh.mockRejectedValue(
      refreshTokenError("AUTH_REFRESH_TOKEN_EXPIRED"),
    )

    const res = await callPost("expired-token")
    const json = await res.json()

    expect(res.status).toBe(401)
    expect(json.error.code).toBe("AUTH_REFRESH_TOKEN_EXPIRED")
  })

  it("passa 401 AUTH_REFRESH_TOKEN_REVOKED em reuso (familia revogada)", async () => {
    tokenServiceMock.rotateRefresh.mockRejectedValue(
      refreshTokenError("AUTH_REFRESH_TOKEN_REVOKED"),
    )

    const res = await callPost("reused-token")
    const json = await res.json()

    expect(res.status).toBe(401)
    expect(json.error.code).toBe("AUTH_REFRESH_TOKEN_REVOKED")
  })

  it("passa 403 AUTH_ACCOUNT_SUSPENDED para conta inativa/deletada", async () => {
    tokenServiceMock.rotateRefresh.mockRejectedValue(
      refreshTokenError("AUTH_ACCOUNT_SUSPENDED"),
    )

    const res = await callPost("token")
    const json = await res.json()

    expect(res.status).toBe(403)
    expect(json.error.code).toBe("AUTH_ACCOUNT_SUSPENDED")
  })

  it("passa 500 INTERNAL_ERROR para codigo AuthTokenError desconhecido (sem vazar o codigo)", async () => {
    tokenServiceMock.rotateRefresh.mockRejectedValue(
      refreshTokenError("AUTH_UNKNOWN_CODE"),
    )

    const res = await callPost("token")
    const json = await res.json()

    expect(res.status).toBe(500)
    expect(json.error.code).toBe("INTERNAL_ERROR")
    expect(json.error.code).not.toBe("AUTH_UNKNOWN_CODE")
  })

  it("retorna 401 AUTH_REFRESH_TOKEN_INVALID quando o cookie de refresh esta ausente", async () => {
    const res = await callPost(null)
    const json = await res.json()

    expect(res.status).toBe(401)
    expect(json.error.code).toBe("AUTH_REFRESH_TOKEN_INVALID")
    expect(tokenServiceMock.rotateRefresh).not.toHaveBeenCalled()
  })

  it("retorna 500 INTERNAL_ERROR (com meta.requestId) para erro inesperado", async () => {
    tokenServiceMock.rotateRefresh.mockRejectedValue(new Error("db down"))

    const res = await callPost("token")
    const json = await res.json()

    expect(res.status).toBe(500)
    expect(json.error.code).toBe("INTERNAL_ERROR")
    expect(json.meta.requestId).toBeTruthy()
  })

  it("nao expoe o token no corpo da resposta de erro (C13)", async () => {
    tokenServiceMock.rotateRefresh.mockRejectedValue(
      refreshTokenError("AUTH_REFRESH_TOKEN_INVALID"),
    )

    const res = await callPost("secret-token")
    const json = await res.json()
    const body = JSON.stringify(json)

    expect(body).not.toContain("secret-token")
    expect(body).not.toContain("new-refresh-token")
  })
})
