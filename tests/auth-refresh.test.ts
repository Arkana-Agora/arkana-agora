import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  getCachedAccessToken,
  refreshAccessTokenOnce,
  resetAuthRefreshState,
  resolveAccessToken,
  setCachedAccessToken,
} from "@/lib/auth-refresh"

function jsonRes(body: unknown, ok = true, status = ok ? 200 : 400): Response {
  return {
    ok,
    status,
    json: () => Promise.resolve(body),
  } as unknown as Response
}

describe("auth-refresh", () => {
  beforeEach(() => {
    resetAuthRefreshState()
    vi.clearAllMocks()
  })

  afterEach(() => {
    resetAuthRefreshState()
  })

  describe("refreshAccessTokenOnce", () => {
    it("returns success and caches the new access token", async () => {
      global.fetch = vi
        .fn()
        .mockResolvedValue(
          jsonRes({ accessToken: "fresh-token", expiresIn: 900 }),
        )

      const outcome = await refreshAccessTokenOnce()

      expect(outcome.kind).toBe("success")
      if (outcome.kind === "success") {
        expect(outcome.accessToken).toBe("fresh-token")
      }
      expect(getCachedAccessToken()).toBe("fresh-token")
      expect(global.fetch).toHaveBeenCalledTimes(1)
    })

    it("single-flights concurrent refresh calls into one network request", async () => {
      let resolveFetch!: (r: Response) => void
      global.fetch = vi.fn().mockReturnValue(
        new Promise<Response>((r) => {
          resolveFetch = r
        }),
      )

      const a = refreshAccessTokenOnce()
      const b = refreshAccessTokenOnce()
      expect(global.fetch).toHaveBeenCalledTimes(1)

      resolveFetch(jsonRes({ accessToken: "shared-token" }))
      const [oa, ob] = await Promise.all([a, b])

      expect(oa.kind).toBe("success")
      expect(ob.kind).toBe("success")
      expect(global.fetch).toHaveBeenCalledTimes(1)
    })

    it("maps 401 to auth_failed and clears the token cache", async () => {
      setCachedAccessToken("stale")
      global.fetch = vi
        .fn()
        .mockResolvedValue(
          jsonRes(
            { error: { code: "AUTH_REFRESH_TOKEN_INVALID" } },
            false,
            401,
          ),
        )

      const outcome = await refreshAccessTokenOnce()

      expect(outcome.kind).toBe("auth_failed")
      expect(getCachedAccessToken()).toBeNull()
    })

    it("maps TypeError to network_error", async () => {
      global.fetch = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"))

      const outcome = await refreshAccessTokenOnce()
      expect(outcome.kind).toBe("network_error")
    })

    it("maps 5xx to server_error without touching the caches", async () => {
      setCachedAccessToken("still-valid")
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        // 5xx error pages are HTML — body parsing must be skipped entirely.
        json: () => Promise.reject(new SyntaxError("Unexpected token <")),
      } as unknown as Response)

      const outcome = await refreshAccessTokenOnce()

      expect(outcome.kind).toBe("server_error")
      expect(getCachedAccessToken()).toBe("still-valid")
    })

    it("maps non-JSON 200 body to bad_response", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.reject(new SyntaxError("Unexpected token")),
      } as unknown as Response)

      const outcome = await refreshAccessTokenOnce()
      expect(outcome.kind).toBe("bad_response")
    })

    it("maps 200 without accessToken to bad_response", async () => {
      global.fetch = vi.fn().mockResolvedValue(jsonRes({}))

      const outcome = await refreshAccessTokenOnce()
      expect(outcome.kind).toBe("bad_response")
    })
  })

  describe("resolveAccessToken", () => {
    it("returns cached token without calling the loader", async () => {
      setCachedAccessToken("cached-token")
      const loader = vi.fn().mockResolvedValue("other")

      const token = await resolveAccessToken(loader)

      expect(token).toBe("cached-token")
      expect(loader).not.toHaveBeenCalled()
    })

    it("single-flights concurrent session lookups", async () => {
      let resolveLoader!: (t: string | null) => void
      const loader = vi.fn().mockReturnValue(
        new Promise<string | null>((r) => {
          resolveLoader = r
        }),
      )

      const a = resolveAccessToken(loader)
      const b = resolveAccessToken(loader)
      expect(loader).toHaveBeenCalledTimes(1)

      resolveLoader("session-token")
      expect(await a).toBe("session-token")
      expect(await b).toBe("session-token")
      expect(getCachedAccessToken()).toBe("session-token")
    })

    it("returns null from loader without caching", async () => {
      const loader = vi.fn().mockResolvedValue(null)

      const token = await resolveAccessToken(loader)

      expect(token).toBeNull()
      expect(getCachedAccessToken()).toBeNull()
    })

    it("never lets a slow session lookup clobber a newer token", async () => {
      let resolveLoader!: (t: string | null) => void
      const loader = vi.fn().mockReturnValue(
        new Promise<string | null>((r) => {
          resolveLoader = r
        }),
      )

      const pending = resolveAccessToken(loader)
      // A refresh completes while the session lookup is still in flight.
      setCachedAccessToken("fresh-from-refresh")
      resolveLoader("stale-session-token")

      const result = await pending

      expect(result).toBe("fresh-from-refresh")
      expect(getCachedAccessToken()).toBe("fresh-from-refresh")
    })

    it("clears the single-flight entry after the lookup settles", async () => {
      const first = vi.fn().mockResolvedValue(null)
      await resolveAccessToken(first)
      expect(first).toHaveBeenCalledTimes(1)

      const second = vi.fn().mockResolvedValue("second")
      await resolveAccessToken(second)
      expect(second).toHaveBeenCalledTimes(1)
    })
  })

  describe("access token cache TTL", () => {
    it("expires ACCESS_TOKEN_TTL_MS after it was set (no sliding extension)", async () => {
      vi.useFakeTimers()
      try {
        setCachedAccessToken("ttl-token")
        expect(getCachedAccessToken()).toBe("ttl-token")

        vi.advanceTimersByTime(59_000)
        expect(getCachedAccessToken()).toBe("ttl-token")

        vi.advanceTimersByTime(2_000)
        expect(getCachedAccessToken()).toBeNull()
      } finally {
        vi.useRealTimers()
      }
    })
  })
})
