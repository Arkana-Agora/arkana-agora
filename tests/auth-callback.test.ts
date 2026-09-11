import { beforeEach, describe, expect, it, vi } from "vitest"
import { finalizeAuthResponse } from "@/auth/auth-callback"

vi.mock("next-auth/jwt", () => ({
  getToken: vi.fn(),
}))

import { getToken } from "next-auth/jwt"

const mockedGetToken = getToken as ReturnType<typeof vi.fn>

const SECRET = "test-secret-for-auth-callback-0123456789"

function redirectResponse({
  location,
  sessionCookie,
  extraCookies = [],
}: {
  location: string
  sessionCookie: { name: string; value: string; secure: boolean } | null
  extraCookies?: string[]
}): Response {
  const headers = new Headers()
  headers.set("location", location)
  if (sessionCookie) {
    headers.append(
      "set-cookie",
      `${sessionCookie.name}=${sessionCookie.value}; Path=/; HttpOnly${sessionCookie.secure ? "; Secure" : ""}`,
    )
  }
  for (const cookie of extraCookies) {
    headers.append("set-cookie", cookie)
  }
  return new Response(null, { status: 302, headers })
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe("finalizeAuthResponse — custom JWT emission no callback OAuth/magic link", () => {
  it("ignora respostas sem redirect (ex.: GET /api/auth/session 200)", async () => {
    const response = new Response(JSON.stringify({ user: { id: "usr_1" } }), {
      status: 200,
      headers: { "content-type": "application/json" },
    })

    const result = await finalizeAuthResponse(response, SECRET)

    expect(result.status).toBe(200)
    expect(result.headers.get("set-cookie")).toBeNull()
  })

  it("não reescreve redirect para /login (fluxo de página de sign-in pelo callbackUrl)", async () => {
    const response = redirectResponse({
      location: "/login?callbackUrl=%2Fdashboard",
      sessionCookie: {
        name: "authjs.session-token",
        value: "any",
        secure: false,
      },
    })

    const result = await finalizeAuthResponse(response, SECRET)

    expect(result.headers.get("location")).toBe(
      "/login?callbackUrl=%2Fdashboard",
    )
    expect(
      result.headers
        .getSetCookie()
        .some((cookie) => cookie.startsWith("refreshToken=")),
    ).toBe(false)
  })

  it("sem cookie de sessão no Set-Cookie, resposta permanece inalterada", async () => {
    const response = redirectResponse({
      location: "/",
      sessionCookie: null,
    })

    const result = await finalizeAuthResponse(response, SECRET)

    expect(result.headers.get("location")).toBe("/")
    expect(result.headers.get("set-cookie")).toBeNull()
  })

  it("sessão sem customAuth: resposta permanece inalterada", async () => {
    mockedGetToken.mockResolvedValue({ sub: "usr_1", userId: "usr_1" })

    const response = redirectResponse({
      location: "/",
      sessionCookie: {
        name: "authjs.session-token",
        value: "any",
        secure: false,
      },
    })

    const result = await finalizeAuthResponse(response, SECRET)

    expect(result.headers.get("location")).toBe("/")
    expect(
      result.headers
        .getSetCookie()
        .some((cookie) => cookie.startsWith("refreshToken=")),
    ).toBe(false)
  })

  it("com customAuth válido: seta cookie refreshToken httpOnly e redireciona p/ /dashboard sem tokens na URL", async () => {
    mockedGetToken.mockResolvedValue({
      sub: "usr_1",
      userId: "usr_1",
      customAuth: {
        accessToken: "at_oauth1",
        refreshToken: "rt_oauth1",
      },
    })

    const response = redirectResponse({
      location: "/",
      sessionCookie: {
        name: "authjs.session-token",
        value: "any",
        secure: false,
      },
    })

    const result = await finalizeAuthResponse(response, SECRET)

    const setCookies = result.headers.getSetCookie()
    const refreshCookie = setCookies.find((cookie) =>
      cookie.startsWith("refreshToken="),
    )
    expect(refreshCookie).toBeDefined()
    expect(refreshCookie).toContain("refreshToken=rt_oauth1")
    expect(refreshCookie).toContain("Path=/api/v1/auth")
    expect(refreshCookie).toContain("HttpOnly")
    expect(refreshCookie).toContain("Secure")
    expect(refreshCookie).toContain("SameSite=Strict")
    expect(refreshCookie).toContain("Max-Age=2592000")

    const location = result.headers.get("location")
    expect(location).toBe("/dashboard")
    expect(location).not.toContain("accessToken")
    expect(location).not.toContain("refreshToken")
    expect(location).not.toContain("=")
  })

  it("mantém o cookie de sessão do Auth.js quando adiciona o refreshToken (não o remove)", async () => {
    mockedGetToken.mockResolvedValue({
      sub: "usr_1",
      userId: "usr_1",
      customAuth: {
        accessToken: "at_oauth1",
        refreshToken: "rt_oauth1",
      },
    })

    const response = redirectResponse({
      location: "/",
      sessionCookie: {
        name: "authjs.session-token",
        value: "any",
        secure: false,
      },
    })

    const result = await finalizeAuthResponse(response, SECRET)

    const setCookies = result.headers.getSetCookie()
    expect(
      setCookies.some((cookie) => cookie.startsWith("authjs.session-token=")),
    ).toBe(true)
    expect(
      setCookies.some((cookie) => cookie.startsWith("refreshToken=")),
    ).toBe(true)
  })

  it("suporta cookie secure (https): __Secure-authjs.session-token decodificada", async () => {
    mockedGetToken.mockResolvedValue({
      sub: "usr_2",
      userId: "usr_2",
      customAuth: { accessToken: "at_s", refreshToken: "rt_s" },
    })

    const response = redirectResponse({
      location: "/",
      sessionCookie: {
        name: "__Secure-authjs.session-token",
        value: "any",
        secure: true,
      },
    })

    const result = await finalizeAuthResponse(response, SECRET)

    const setCookies = result.headers.getSetCookie()
    expect(
      setCookies.some((cookie) => cookie.startsWith("refreshToken=rt_s")),
    ).toBe(true)
    expect(result.headers.get("location")).toBe("/dashboard")
  })

  it("reconstrói cookie de sessão fracionado (chunks authjs.session-token.N)", async () => {
    mockedGetToken.mockResolvedValue({
      sub: "usr_3",
      userId: "usr_3",
      customAuth: { accessToken: "at_c", refreshToken: "rt_c" },
    })

    const response = redirectResponse({
      location: "/",
      sessionCookie: {
        name: "authjs.session-token",
        value: "any",
        secure: false,
      },
    })

    const result = await finalizeAuthResponse(response, SECRET)

    expect(
      result.headers
        .getSetCookie()
        .some((cookie) => cookie.startsWith("refreshToken=rt_c")),
    ).toBe(true)
    expect(result.headers.get("location")).toBe("/dashboard")
  })
})
