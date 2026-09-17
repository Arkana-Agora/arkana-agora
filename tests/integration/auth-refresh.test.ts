// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { rotateRefresh } from "@/services/token-service"
import { createTokenError } from "./helpers/errors"

const tokenServiceMock = vi.hoisted(() => ({
  rotateRefresh: vi.fn<typeof rotateRefresh>(),
}))

vi.mock("@/services/token-service", () => tokenServiceMock)

vi.mock("next-auth/jwt", () => ({
  encode: vi.fn().mockResolvedValue("mocked-session-token"),
}))

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
  process.env.AUTH_SECRET = "test-secret"
  tokenServiceMock.rotateRefresh.mockResolvedValue({
    accessToken: "access.jwt.token",
    refreshToken: "new-refresh-token",
    expiresIn: 900,
    user: {
      id: "usr_1",
      name: "Alice",
      email: "alice@example.com",
      displayName: null,
      avatar: null,
      role: "USER",
      plan: "FREE",
      emailVerified: true,
    },
  })
})

afterEach(() => {
  delete process.env.AUTH_SECRET
  vi.resetModules()
})

describe("POST /api/v1/auth/refresh — rotation/reuse integration (T29)", () => {
  it("fluxo completo: extrai cookie → rotaciona token → seta novo cookie + Auth.js session → 200", async () => {
    const res = await callPost("old-refresh-token")
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.accessToken).toBe("access.jwt.token")
    expect(json.expiresIn).toBe(900)
    expect(json.refreshToken).toBeUndefined()
    expect(json.user).toEqual({
      id: "usr_1",
      name: "Alice",
      email: "alice@example.com",
      displayName: null,
      avatar: null,
      role: "USER",
      plan: "FREE",
      emailVerified: true,
    })

    const setCookie = res.headers.get("set-cookie") ?? ""
    expect(setCookie).toContain("refreshToken=new-refresh-token")
    expect(setCookie).toContain("HttpOnly")
    expect(setCookie).toContain("SameSite=Strict")
    expect(setCookie).toContain("Path=/api/v1/auth")

    expect(tokenServiceMock.rotateRefresh).toHaveBeenCalledWith(
      "old-refresh-token",
    )
  })

  it("retorna 401 quando cookie de refresh está ausente", async () => {
    const res = await callPost(null)
    const json = await res.json()

    expect(res.status).toBe(401)
    expect(json.error.code).toBe("AUTH_REFRESH_TOKEN_INVALID")
  })

  it("retorna 401 quando refresh token é invalido", async () => {
    tokenServiceMock.rotateRefresh.mockRejectedValue(
      createTokenError("AUTH_REFRESH_TOKEN_INVALID"),
    )

    const res = await callPost("bad-token")
    const json = await res.json()

    expect(res.status).toBe(401)
    expect(json.error.code).toBe("AUTH_REFRESH_TOKEN_INVALID")
  })

  it("retorna 401 quando refresh token foi reusado (família comprometida)", async () => {
    tokenServiceMock.rotateRefresh.mockRejectedValue(
      createTokenError("AUTH_REFRESH_TOKEN_REVOKED"),
    )

    const res = await callPost("reused-token")
    const json = await res.json()

    expect(res.status).toBe(401)
    expect(json.error.code).toBe("AUTH_REFRESH_TOKEN_REVOKED")
  })

  it("retorna 401 quando refresh token expirou", async () => {
    tokenServiceMock.rotateRefresh.mockRejectedValue(
      createTokenError("AUTH_REFRESH_TOKEN_EXPIRED"),
    )

    const res = await callPost("expired-token")
    const json = await res.json()

    expect(res.status).toBe(401)
    expect(json.error.code).toBe("AUTH_REFRESH_TOKEN_EXPIRED")
  })

  it("retorna 403 quando conta está suspensa", async () => {
    tokenServiceMock.rotateRefresh.mockRejectedValue(
      createTokenError("AUTH_ACCOUNT_SUSPENDED"),
    )

    const res = await callPost("token-for-suspended")
    const json = await res.json()

    expect(res.status).toBe(403)
    expect(json.error.code).toBe("AUTH_ACCOUNT_SUSPENDED")
  })

  it("retorna cache-control: no-store", async () => {
    const res = await callPost("old-refresh-token")
    expect(res.headers.get("cache-control")).toBe("no-store")
  })
})
