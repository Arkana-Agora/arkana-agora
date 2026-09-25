import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { resetAuthRefreshState } from "@/lib/auth-refresh"

const getSessionMock = vi.fn()

vi.mock("next-auth/react", () => ({
  get getSession() {
    return getSessionMock
  },
}))

function mockFetchWithRefresh(
  options: {
    refreshOk?: boolean
    refreshData?: unknown
    resourceHandler?: (callIndex: number) => {
      ok: boolean
      status: number
      data: unknown
    }
  } = {},
): void {
  const {
    refreshOk = true,
    refreshData = { accessToken: "new-token" },
    resourceHandler,
  } = options
  let resourceCallCount = 0

  vi.stubGlobal(
    "fetch",
    vi.fn().mockImplementation((url: string) => {
      if (String(url).includes("/api/v1/auth/refresh")) {
        return Promise.resolve({
          ok: refreshOk,
          status: refreshOk ? 200 : 401,
          json: () => Promise.resolve(refreshData),
          headers: new Headers({ "content-type": "application/json" }),
        })
      }
      const idx = resourceCallCount++
      if (resourceHandler) {
        const res = resourceHandler(idx)
        return Promise.resolve({
          ok: res.ok,
          status: res.status,
          json: () => Promise.resolve(res.data),
          headers: new Headers({ "content-type": "application/json" }),
        })
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ ok: true }),
        headers: new Headers({ "content-type": "application/json" }),
      })
    }),
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  resetAuthRefreshState()
  getSessionMock.mockResolvedValue({
    accessToken: "valid-access-token",
    user: { id: "usr_1" },
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
  resetAuthRefreshState()
})

describe("authApi — Axios instance (T26)", () => {
  it("exports an Axios instance with correct defaults", async () => {
    const { default: authApi } = await import("@/lib/api")
    expect(authApi).toBeDefined()
    expect(typeof authApi.interceptors.request.use).toBe("function")
    expect(typeof authApi.interceptors.response.use).toBe("function")
  })

  it("has baseURL configured to /api/v1", async () => {
    const { default: authApi } = await import("@/lib/api")
    expect(authApi.defaults.baseURL).toBe("/api/v1")
  })

  it("request interceptor adds Authorization: Bearer header and resolves full URL", async () => {
    getSessionMock.mockResolvedValue({
      accessToken: "my-test-token",
      user: { id: "usr_1" },
    })
    mockFetchWithRefresh()

    const { default: authApi } = await import("@/lib/api")
    await authApi.get("/users/me/profile")

    const fetchCall = vi.mocked(globalThis.fetch).mock.calls[0]!
    const headers = fetchCall[1]?.headers as Record<string, string>
    expect(headers["Authorization"]).toBe("Bearer my-test-token")
    expect(String(fetchCall[0])).toBe(
      "http://localhost:3000/api/v1/users/me/profile",
    )
  })

  it("request interceptor omits Authorization when no token", async () => {
    getSessionMock.mockResolvedValue(null)
    mockFetchWithRefresh()

    const { default: authApi } = await import("@/lib/api")
    await authApi.get("/public-endpoint")

    const fetchCall = vi.mocked(globalThis.fetch).mock.calls[0]!
    const headers = fetchCall[1]?.headers as Record<string, string>
    expect(headers["Authorization"]).toBeUndefined()
    expect(String(fetchCall[0])).toBe(
      "http://localhost:3000/api/v1/public-endpoint",
    )
  })

  it("honors an explicit Authorization header without leaking it to later calls", async () => {
    getSessionMock.mockResolvedValue({
      accessToken: "session-token",
      user: { id: "usr_1" },
    })
    mockFetchWithRefresh()

    const { default: authApi } = await import("@/lib/api")

    await authApi.get("/users/me/profile", {
      headers: { Authorization: "Bearer caller-provided-token" },
    })
    await authApi.get("/users/me/profile")

    const headerOf = (i: number) => {
      const headers = vi.mocked(globalThis.fetch).mock.calls[i]?.[1]
        ?.headers as Record<string, string> | undefined
      return headers?.["Authorization"] ?? headers?.["authorization"]
    }

    expect(headerOf(0)).toBe("Bearer caller-provided-token")
    expect(headerOf(1)).toBe("Bearer session-token")
  })

  it("honors a lowercase authorization header (AxiosHeaders normalizes casing)", async () => {
    getSessionMock.mockResolvedValue({
      accessToken: "session-token",
      user: { id: "usr_1" },
    })
    mockFetchWithRefresh()

    const { default: authApi } = await import("@/lib/api")

    await authApi.get("/users/me/profile", {
      headers: { authorization: "Bearer lowercase-caller-token" },
    })

    const headers = vi.mocked(globalThis.fetch).mock.calls[0]?.[1]?.headers as
      Record<string, string> | undefined
    expect(headers?.["Authorization"] ?? headers?.["authorization"]).toBe(
      "Bearer lowercase-caller-token",
    )
  })

  it("response interceptor retries on 401 after refresh", async () => {
    let resourceCallCount = 0
    getSessionMock.mockImplementation(() => {
      resourceCallCount++
      if (resourceCallCount <= 1) {
        return Promise.resolve({ accessToken: "old-token" })
      }
      return Promise.resolve({ accessToken: "refreshed-token" })
    })

    mockFetchWithRefresh({
      resourceHandler: (idx) => {
        if (idx === 0) {
          return {
            ok: false,
            status: 401,
            data: { error: { code: "AUTH_TOKEN_EXPIRED" } },
          }
        }
        return { ok: true, status: 200, data: { result: "ok" } }
      },
    })

    const { default: authApi } = await import("@/lib/api")
    const response = await authApi.get("/protected-resource")

    expect(response.status).toBe(200)
    const calls = vi.mocked(globalThis.fetch).mock.calls
    expect(calls.length).toBe(3)
    expect(String(calls[0]?.[0])).toBe(
      "http://localhost:3000/api/v1/protected-resource",
    )
    expect(String(calls[2]?.[0])).toBe(
      "http://localhost:3000/api/v1/protected-resource",
    )
    const retryHeaders = calls[2]?.[1]?.headers as
      Record<string, string> | undefined
    expect(
      retryHeaders?.["Authorization"] ?? retryHeaders?.["authorization"],
    ).toBe("Bearer new-token")
  })

  it("does not loop on persistent 401 (refresh fails)", async () => {
    getSessionMock.mockResolvedValue({ accessToken: "expired-token" })

    mockFetchWithRefresh({
      refreshOk: false,
      refreshData: { error: { code: "AUTH_REFRESH_TOKEN_INVALID" } },
      resourceHandler: () => ({
        ok: false,
        status: 401,
        data: { error: { code: "AUTH_TOKEN_EXPIRED" } },
      }),
    })

    const { default: authApi } = await import("@/lib/api")

    await expect(authApi.get("/protected-resource")).rejects.toThrow()
    const calls = vi.mocked(globalThis.fetch).mock.calls
    const refreshCalls = calls.filter((c) =>
      String(c[0]).includes("/api/v1/auth/refresh"),
    )
    expect(refreshCalls.length).toBe(1)
  })

  it("propagates non-401 errors without refresh attempt", async () => {
    getSessionMock.mockResolvedValue({ accessToken: "valid-token" })
    mockFetchWithRefresh({
      resourceHandler: () => ({
        ok: false,
        status: 500,
        data: { error: { code: "INTERNAL_ERROR" } },
      }),
    })

    const { default: authApi } = await import("@/lib/api")

    await expect(authApi.get("/something")).rejects.toThrow()
    const calls = vi.mocked(globalThis.fetch).mock.calls
    const refreshCalls = calls.filter((c) =>
      String(c[0]).includes("/api/v1/auth/refresh"),
    )
    expect(refreshCalls.length).toBe(0)
  })

  it("concurrent 401s trigger only one refresh", async () => {
    let resourceCallCount = 0
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string) => {
        if (String(url).includes("/api/v1/auth/refresh")) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve({ accessToken: "new-token" }),
            headers: new Headers({ "content-type": "application/json" }),
          })
        }
        resourceCallCount++
        if (resourceCallCount <= 2) {
          return Promise.resolve({
            ok: false,
            status: 401,
            json: () =>
              Promise.resolve({ error: { code: "AUTH_TOKEN_EXPIRED" } }),
            headers: new Headers(),
          })
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ data: "ok" }),
          headers: new Headers({ "content-type": "application/json" }),
        })
      }),
    )

    getSessionMock.mockResolvedValue({ accessToken: "token" })

    const { default: authApi } = await import("@/lib/api")

    await Promise.all([
      authApi.get("/a").catch(() => null),
      authApi.get("/b").catch(() => null),
    ])

    const calls = vi.mocked(globalThis.fetch).mock.calls
    const refreshCalls = calls.filter((c) =>
      String(c[0]).includes("/api/v1/auth/refresh"),
    )
    expect(refreshCalls.length).toBe(1)
  })

  it("rejects with original error when refresh fails (no retry without token)", async () => {
    getSessionMock.mockResolvedValue({ accessToken: "expired-token" })

    mockFetchWithRefresh({
      refreshOk: false,
      refreshData: { error: { code: "AUTH_REFRESH_TOKEN_INVALID" } },
      resourceHandler: () => ({
        ok: false,
        status: 401,
        data: { error: { code: "AUTH_TOKEN_EXPIRED" } },
      }),
    })

    const { default: authApi } = await import("@/lib/api")

    await expect(authApi.get("/protected-resource")).rejects.toThrow()
    const calls = vi.mocked(globalThis.fetch).mock.calls
    const resourceCalls = calls.filter(
      (c) => !String(c[0]).includes("/api/v1/auth/refresh"),
    )
    expect(resourceCalls.length).toBe(1)
  })
})
