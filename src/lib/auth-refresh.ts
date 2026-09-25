"use client"

const REFRESH_URL = "/api/v1/auth/refresh"
const REFRESH_TIMEOUT_MS = 15_000
const ACCESS_TOKEN_TTL_MS = 60_000

export type RefreshOutcome =
  | {
      kind: "success"
      accessToken: string
      data: Record<string, unknown>
    }
  | { kind: "auth_failed"; data?: unknown }
  | { kind: "server_error"; data?: unknown }
  | { kind: "network_error" }
  | { kind: "bad_response" }

let refreshInFlight: Promise<RefreshOutcome> | null = null
let cachedAccessToken: string | null = null
let cachedAccessTokenAt = 0
// Monotonic generation: bumped on every cache write/clear so a slow session
// lookup cannot clobber a token written by a refresh that finished later.
let cachedAccessTokenGeneration = 0
let sessionPromise: Promise<string | null> | null = null

export function getCachedAccessToken(): string | null {
  if (!cachedAccessToken) return null
  if (Date.now() - cachedAccessTokenAt > ACCESS_TOKEN_TTL_MS) {
    cachedAccessToken = null
    return null
  }
  return cachedAccessToken
}

export function setCachedAccessToken(token: string | null) {
  cachedAccessToken = token
  cachedAccessTokenAt = token ? Date.now() : 0
  cachedAccessTokenGeneration += 1
}

export function clearCachedAccessToken() {
  cachedAccessToken = null
  cachedAccessTokenAt = 0
  cachedAccessTokenGeneration += 1
}

export function invalidateSessionCache() {
  sessionPromise = null
}

async function performRefresh(): Promise<RefreshOutcome> {
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), REFRESH_TIMEOUT_MS)

    const res = await fetch(REFRESH_URL, {
      method: "POST",
      credentials: "include",
      signal: controller.signal,
    })
    clearTimeout(timeoutId)

    if (res.status >= 500) {
      // Transient server failure: keep the session and caches (and skip body
      // parsing — a 5xx error page is not JSON). Treating a 5xx as
      // auth_failed/bad_response logged users out on blips of our own backend.
      return { kind: "server_error" }
    }

    let data: unknown
    try {
      data = await res.json()
    } catch {
      return { kind: "bad_response" }
    }

    if (
      res.ok &&
      data &&
      typeof data === "object" &&
      "accessToken" in data &&
      typeof data.accessToken === "string"
    ) {
      setCachedAccessToken(data.accessToken)
      invalidateSessionCache()
      return {
        kind: "success",
        accessToken: data.accessToken,
        data: data as Record<string, unknown>,
      }
    }

    if (res.status === 401 || res.status === 403 || !res.ok) {
      clearCachedAccessToken()
      invalidateSessionCache()
      return { kind: "auth_failed", data }
    }

    return { kind: "bad_response" }
  } catch {
    return { kind: "network_error" }
  }
}

export function refreshAccessTokenOnce(): Promise<RefreshOutcome> {
  if (!refreshInFlight) {
    refreshInFlight = performRefresh().finally(() => {
      refreshInFlight = null
    })
  }
  return refreshInFlight
}

type SessionLoader = () => Promise<string | null>

/**
 * Single-flight + short TTL around session access-token lookup so N parallel
 * authApi calls do not fan out to GET /api/auth/session.
 */
export async function resolveAccessToken(
  loadFromSession: SessionLoader,
): Promise<string | null> {
  const cached = getCachedAccessToken()
  if (cached) return cached

  if (sessionPromise) return sessionPromise

  const generation = cachedAccessTokenGeneration
  const load = loadFromSession()
    .then((token) => {
      if (!token) return null
      if (generation === cachedAccessTokenGeneration) {
        setCachedAccessToken(token)
        return token
      }
      // A refresh landed while the session lookup was in flight — its token
      // is newer; never clobber it with the stale value.
      return getCachedAccessToken() ?? token
    })
    .finally(() => {
      if (sessionPromise === load) sessionPromise = null
    })

  sessionPromise = load
  return load
}

/** Test-only: wipe module-level singleflight + caches between cases. */
export function resetAuthRefreshState() {
  refreshInFlight = null
  cachedAccessToken = null
  cachedAccessTokenAt = 0
  sessionPromise = null
  // cachedAccessTokenGeneration is intentionally NOT reset: it is only ever
  // compared at lookup time against a snapshot; writers already bump it.
}
