---
title: "Single-Flight Access-Token Refresh + Skip Session Lookup on Retry"
problem_type: pattern
category: auth
components:
  - frontend
tags:
  - patterns
  - auth
  - token-refresh
  - single-flight
  - axios-interceptor
  - next-auth
  - zustand
  - 401-retry
module: auth
date: 2026-09-24
established_in: "SPRINT-1 batch (2026-09-24): concurrent 401s each fired POST /api/v1/auth/refresh, and the retry re-ran getSession() which could overwrite the freshly refreshed token — fixed by shared refreshAccessTokenOnce + TTL cache + _retry on retry; resolveAccessToken added to stop /api/auth/session storms from parallel authApi/store calls"
---

# Pattern: Single-Flight Access-Token Refresh + Skip Session Lookup on Retry

## Problem / When to Use This

Use whenever authenticated client requests can expire concurrently (dashboard bursts, parallel Zustand actions, multi-hook pages) **or** a token lookup can race with a refresh.

Without it this project saw two concrete failures:

1. **N simultaneous 401s** each called `POST /api/v1/auth/refresh`, stampeding the rotation endpoint and invalidating each other's one-time refresh cookies.
2. After a successful refresh, the axios request interceptor re-ran `getSession()` on the retry — NextAuth could still resolve the **stale** session token, overwrite the fresh `Authorization` header, and loop 401→refresh→401.
3. Many parallel `getAccessToken()` calls each calling `getSession()` storm `GET /api/auth/session`.

Answer: one shared module (`src/lib/auth-refresh.ts`) that single-flights refresh and session lookups, caches the access token for a short TTL, and marks retry requests with `_retry` so the interceptor keeps the already-fresh token.

## Source of Truth

- `src/lib/auth-refresh.ts` — `refreshAccessTokenOnce()`, `resolveAccessToken()`, access-token TTL cache, `invalidateSessionCache()`, test-only `resetAuthRefreshState()`
- `src/lib/api.ts` — axios `authApi`, request interceptor order, response 401 interceptor (`_retry` + `_retry`), `RetryableConfig`
- `src/stores/auth-store.ts` — store `getAccessToken()` / `refreshSession()` delegate to the shared module
- `tests/auth-refresh.test.ts`

## Current Implementation Snapshot

- `refreshAccessTokenOnce()` keeps one module-level `refreshInFlight` promise; concurrent callers share it; `.finally()` clears it.
- Network: `POST /api/v1/auth/refresh` with `credentials: "include"` and 15s `AbortController` timeout.
- `RefreshOutcome`: `success` | `auth_failed` (401/403/!ok — clears cache) | `network_error` | `server_error` (5xx — non-destructive) | `bad_response`.
- **`network_error` must not log the user out** (store sets a transient error, keeps `user`). Same for `server_error` (5xx is transient — keep `user`, surface the error).
- On success: `setCachedAccessToken` + `invalidateSessionCache()`. On `auth_failed`: clear both.
- Access-token cache TTL: `ACCESS_TOKEN_TTL_MS = 60_000`.
- `resolveAccessToken(loader)` single-flights session lookup (cache hit → return; else share one `sessionPromise`); a monotonic `cachedAccessTokenGeneration` (bumped on every cache write/clear) stops a slow session lookup from clobbering a token written by a refresh that landed meanwhile (stale lookup returns the newer cached token).
- Axios request interceptor order: `_retry && Authorization` → existing header → TTL cache → `resolveAccessToken(() => getSession())`.
- Axios response interceptor: 401 once → `refreshAccessTokenOnce()` → success sets **both** `Authorization: Bearer <fresh>` and `_retry: true`.
- Zustand `refreshSession()` has a **second, UI-level** single-flight (`refreshInFlight` in store) around the same network call — intentional (module = network dedupe; store = `isLoading` dedupe).

## Pattern Overview

Put **all** refresh and session-token lookups behind one client module that (a) single-flights network ops at module scope, (b) caches the access token with a short TTL, and (c) flags 401-retry requests so the request interceptor never re-resolves a possibly-stale session over a just-refreshed token. Both the axios interceptor and the Zustand store call the **same** `refreshAccessTokenOnce()`.

## Implementation Steps

### Step 1: Shared single-flight refresh module

File: `src/lib/auth-refresh.ts` (exists — reuse, do not fork)

```typescript
let refreshInFlight: Promise<RefreshOutcome> | null = null

export function refreshAccessTokenOnce(): Promise<RefreshOutcome> {
  if (!refreshInFlight) {
    refreshInFlight = performRefresh().finally(() => {
      refreshInFlight = null
    })
  }
  return refreshInFlight
}
```

- Single-flight lives at **module scope** (shared across axios, Zustand, same JS realm).
- `.finally()` must clear `refreshInFlight` — a failed refresh must not be memoized forever.
- Return discriminated `RefreshOutcome`, not a bare token.

### Step 2: Access-token TTL cache + single-flight session lookup

```typescript
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
```

- Every `getSession()` for Bearer resolution must go through `resolveAccessToken`.
- Successful refresh must `invalidateSessionCache()`.
- Export `resetAuthRefreshState()` for tests only.

### Step 3: Axios request interceptor — token attach order + skip flag

```typescript
interface RetryableConfig extends InternalAxiosRequestConfig {
  _retry?: boolean
  _retry?: boolean
}

authApi.interceptors.request.use(async (config) => {
  const skipSessionLookup = (config as RetryableConfig)._retry
  if (skipSessionLookup && config.headers.Authorization) {
    return config
  }
  const token = existing || getCachedAccessToken() || (await getAccessToken())
  if (token) {
    setCachedAccessToken(token)
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})
```

- Order is a correctness property: **skip flag → explicit header → TTL cache → session lookup**.
- Skip branch only short-circuits when `Authorization` is **also** present.

### Step 4: Axios response interceptor — 401 → single-flight refresh → flagged retry

```typescript
if (!originalRequest || error.response?.status !== 401) return Promise.reject(error)
if (originalRequest._retry) return Promise.reject(error)
originalRequest._retry = true

const outcome = await refreshAccessTokenOnce()
if (outcome.kind !== "success") return Promise.reject(error)

originalRequest._retry = true
originalRequest.headers.Authorization = `Bearer ${outcome.accessToken}`
return authApi(originalRequest)
```

- Retry exactly once (`_retry`).
- Always `refreshAccessTokenOnce()`, never a bespoke `fetch(REFRESH_URL)`.
- Set **both** `Authorization` and `_retry` together.

### Step 5: Zustand store delegates (UI single-flight only)

- `getAccessToken()` → `resolveAccessToken(...)`.
- `refreshSession()` keeps store-level `refreshInFlight` for `isLoading`, but network call is `await refreshAccessTokenOnce()`; on `network_error` **and `server_error`** do **not** clear the user.

### Step 6: Tests

File: `tests/auth-refresh.test.ts`

- Concurrent `refreshAccessTokenOnce()` → exactly one `fetch`.
- TTL / `auth_failed` cache clear.
- `resolveAccessToken` concurrent callers share one loader.
- 5xx → `server_error` (no body parse; caches and logged-in user kept).
- Generation guard: a refresh landing during an in-flight session lookup wins (stale lookup result never clobbers the newer token).
- `resetAuthRefreshState()` in `beforeEach` + `afterEach`.

## Complete Example

Dashboard fires three `authApi.get(...)` after the access token expired:

1. Miss cache → one shared `getSession()` via `resolveAccessToken`.
2. All three 401 → each sets `_retry` → all await the **same** `refreshAccessTokenOnce()` → one `POST /api/v1/auth/refresh`.
3. Success → cache fresh token + invalidate session cache; each request gets fresh `Authorization` + `_retry`.
4. Retries hit the skip branch → keep fresh token → 200s. No session storm, no refresh stampede, no 401 loop.

## Project-Specific Constraints

- [ ] **One refresh entry point:** only `refreshAccessTokenOnce()` may call `POST /api/v1/auth/refresh`.
- [ ] **One session entry point:** only `resolveAccessToken()` may call `getSession()` for Bearer resolution.
- [ ] Access-token cache TTL stays 60s; refresh timeout stays 15s.
- [ ] Retry must carry **both** `Authorization: Bearer <fresh>` and `_retry: true`.
- [ ] `network_error` and `server_error` must **not** clear `user`/`isAuthenticated` — only `auth_failed`, `bad_response` and explicit logout do.
- [ ] `resetAuthRefreshState()` is test-only.
- [ ] `invalidateSessionCache()` runs on refresh terminal outcomes and logout/delete cache clears.
- [ ] Every token-cache write must go through `setCachedAccessToken`/`clearCachedAccessToken` (they bump the generation); a loader that captured an older generation must never write.
- [ ] `sessionPromise` self-clear must compare identity (`if (sessionPromise === load)`), not just null it — otherwise a late `.finally()` could drop a newer single-flight entry.
- [ ] Cover new paths in `tests/auth-refresh.test.ts`.

## Anti-Patterns (What NOT to Do)

- ❌ Direct `fetch("/api/v1/auth/refresh")` from interceptor/store/component.
- ❌ Re-run `getSession()` on 401 retry without `_retry`.
- ❌ Set `_retry` without `Authorization`, or vice versa.
- ❌ Drop `.finally(() => { refreshInFlight = null })`.
- ❌ Drop the `_retry` once-guard or success check (unbounded refresh loops).
- ❌ Treat `network_error` (or `server_error`) as logout.
- ❌ Fork a second token cache outside `auth-refresh.ts`.
- ❌ Writing `cachedAccessToken` directly from a session loader (or any "resolve later" callback) without a generation/staleness check.
- ❌ Replacing the generation counter with a timestamp comparison (`sessionResolvedAt` was removed for exactly this reason — timestamps race; a monotonic counter does not).
- ❌ Persist the access token to `localStorage` (memory + httpOnly cookies only).

## Related Patterns / Docs

- `docs/features/authentication.md` §Axios Interceptor / §AuthGuard / §LogoutButton
- `docs/solutions/patterns/auth/set-csrf-cookie-client-side.md`
- `docs/solutions/patterns/security/auth-uniform-response-timing-equalization.md`
- `tests/auth-refresh.test.ts`, `tests/api.test.ts`, `tests/auth-store.test.ts`

## Safe Change Checklist for Future AI Work

1. New authenticated call path → `authApi` (raw `fetch` must use `resolveAccessToken` / `refreshAccessTokenOnce`).
2. New retry flag → update `RetryableConfig` and keep interceptor order: skip → header → cache → session.
3. `RefreshOutcome` shape change → handle in **both** `api.ts` and `refreshSession()`.
4. Extend `tests/auth-refresh.test.ts` with `resetAuthRefreshState()` hooks.
5. Verify: `npx vitest run tests/auth-refresh.test.ts`; grep `fetch("/api/v1/auth/refresh")` outside `auth-refresh.ts` empty; grep raw `getSession()` outside loaders empty.
