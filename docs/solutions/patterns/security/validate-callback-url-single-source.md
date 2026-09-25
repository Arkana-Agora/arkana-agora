---
title: "Single-Source Same-Origin callbackUrl Validation (isSafeCallbackPath) — Project Pattern"
problem_type: pattern
category: security
components:
  - frontend
tags:
  - patterns
  - security
  - open-redirect
  - callback-url
  - next-auth
  - sessionstorage
  - bypass-matrix
  - auth
module: auth
date: 2026-09-24
established_in: "SPRINT-1 batch 4 (2026-09-24): LoginForm inlined its own safeCallbackPath(), the hook had a second copy and consumeStoredCallbackUrl a third, weaker one — three divergent validators over a redirect sink; consolidated into one pure isSafeCallbackPath() with a 29-case bypass matrix"
---

# Pattern: Single-Source Same-Origin `callbackUrl` Validation (`isSafeCallbackPath`)

## Problem / When to Use This

Post-login redirect targets (`?callbackUrl=`) reach **four different sinks**: `router.push`/`router.replace` after email login, the already-authenticated mount redirect, `signIn("google", { callbackUrl })`, and a `sessionStorage` stash consumed later by the magic-link callback. Before batch 4 each sink validated with its own copy of the rules — `login-form.tsx` inlined `safeCallbackPath()`, `useSafeCallbackUrl()` had a second implementation, and `consumeStoredCallbackUrl()` had a third, weaker one (`startsWith("/") && !startsWith("//")`, which accepts `/\evil.com`). One divergent copy is an open redirect, and the naive rule set misses most modern bypasses:

- `//evil.com` (protocol-relative), `/\evil.com` (backslash authority)
- `/%0a/evil.com`, `/%0d/`, `/%5c` (percent-encoded — a downstream decode-then-reparse turns them into `/\n/evil.com`)
- `javascript:alert(1)`, relative `dashboard`, malformed `/%zz`

Reach for this whenever a URL/query parameter (or a persisted value derived from one) will be handed to a navigation sink: `router.*`, `signIn()`, `window.location`, `<Link href>`, or a stash that a later flow reads.

## Source of Truth Files

- `src/hooks/use-safe-callback-url.ts` — **the only** validator: `isSafeCallbackPath()`, `useSafeCallbackUrl()`, `AuthSessionBridge`, `consumeStoredCallbackUrl()`
- `src/app/(auth)/login/login-form.tsx` — `useSafeCallbackUrl() ?? "/dashboard"` feeds email success, mount-only redirect and Google `signIn`
- `src/app/(auth)/login/page.tsx` — mounts `AuthSessionBridge` + `LoginForm` inside `<Suspense>`
- `src/app/(auth)/callback/magic-link/page.tsx` — `router.push(consumeStoredCallbackUrl())`
- `src/proxy.ts` — writes `?callbackUrl=<pathname>` on redirect (server-generated, but still validated client-side because users can craft the query)
- Entry points to read first: `src/hooks/use-safe-callback-url.ts`, then `tests/safe-callback-url.test.ts`

## Current Implementation Snapshot

```typescript
const SAME_ORIGIN_BASE = "https://same-origin.invalid"

export function isSafeCallbackPath(raw: string | null | undefined): raw is string {
  if (!raw || !raw.startsWith("/")) return false          // relative + scheme URLs out
  let decoded: string
  try {
    decoded = decodeURIComponent(raw)                     // malformed "%" → reject, never partial
  } catch {
    return false
  }
  try {
    return new URL(decoded, SAME_ORIGIN_BASE).origin === SAME_ORIGIN_BASE
  } catch {
    return false
  }
}
```

- **All four sinks call it**: `useSafeCallbackUrl()` (hook), `AuthSessionBridge` (stash write), `consumeStoredCallbackUrl()` (stash read), `LoginForm` (via the hook → `router.*` + `signIn("google", { callbackUrl })`).
- Validation runs on the **percent-decoded** string, resolution is WHATWG (`new URL`), and success is **origin equality** against a fixed dummy base — so authority injection is rejected regardless of sink semantics, and the code is SSR/test-safe (no `window.location` dependency).
- The validator returns a **type predicate over the raw string**; callers navigate with the *raw* value (`searchParams.get()`), never the decoded one — decoding is used only to decide.
- `AuthSessionBridge`: valid param → `sessionStorage.setItem("auth-callback-url", …)`; **absent or unsafe param → `sessionStorage.removeItem(...)`** (a stash from an abandoned attempt must not redirect a later login).
- `consumeStoredCallbackUrl(fallback = "/dashboard")`: removes the stash **first** (single-shot, even when invalid), then validates, else returns the fallback.
- `LoginForm` falls back with `?? "/dashboard"`; the already-authenticated effect is **mount-only** and redirects only when `refreshSession()` returns `ok` (server round-trip), never on the persisted flag alone.

## Planned / Optional Extensions (If Applicable)

- **Not implemented:** a server-side equivalent in `src/proxy.ts` (re-validate `callbackUrl` before writing it, or reject crafted values at the edge). Today the edge only *produces* the param; client validation is the sole gate.

## Pattern Overview

Make redirect-target validation a **pure, dependency-free function in one file**, and force every navigation sink — including the `sessionStorage` stash hand-off — to go through it. Pair it with a **bypass-matrix table test** so each new bypass class is one row, not one incident.

## Implementation Steps

### Step 1: One pure validator

File: `src/hooks/use-safe-callback-url.ts` (exists — reuse, do not fork)

```typescript
// leading "/" → decode (malformed ⇒ reject) → WHATWG origin equality
export function isSafeCallbackPath(raw: string | null | undefined): raw is string
```

Key points:
- Three gates, in this order: non-empty + leading `/` → `decodeURIComponent` with `catch → false` → `new URL(decoded, SAME_ORIGIN_BASE).origin === SAME_ORIGIN_BASE`.
- Fixed base (`https://same-origin.invalid`), never `window.location.origin` (SSR/test determinism).
- Return `raw`, not `decoded` — the sinks navigate with the original value.

### Step 2: Hook wrapper for `useSearchParams` consumers

```typescript
export function useSafeCallbackUrl(): string | null {
  const searchParams = useSearchParams()
  const raw = searchParams.get("callbackUrl")
  return isSafeCallbackPath(raw) ? raw : null
}
```

- `LoginForm`: `const callbackUrl = useSafeCallbackUrl() ?? "/dashboard"` — use that one variable for email success, mount redirect **and** `signIn("google", { callbackUrl })`.

### Step 3: Stash lifecycle in `AuthSessionBridge`

```typescript
useEffect(() => {
  if (callbackUrl) {
    sessionStorage.setItem("auth-callback-url", callbackUrl)
  } else {
    // sem (valido) ?callbackUrl — descarta stash de tentativa abandonada
    sessionStorage.removeItem("auth-callback-url")
  }
}, [callbackUrl])
```

Key points: **write only validated values; clear on absence** — the `else` branch is what stops an abandoned attempt from redirecting a subsequent login.

### Step 4: Single-shot consume

```typescript
export function consumeStoredCallbackUrl(fallback = "/dashboard"): string {
  try {
    const stored = sessionStorage.getItem("auth-callback-url")
    sessionStorage.removeItem("auth-callback-url")   // consume BEFORE validating
    if (isSafeCallbackPath(stored)) return stored
  } catch { /* sessionStorage unavailable */ }
  return fallback
}
```

Used by `magic-link/page.tsx`: `router.push(consumeStoredCallbackUrl())`.

### Step 5: Suspense boundary

`src/app/(auth)/login/page.tsx` must keep `<Suspense>` around **both** `AuthSessionBridge` and `LoginForm` (both call `useSearchParams()`); `verify-email/page.tsx` and `callback/magic-link/page.tsx` wrap their `useSearchParams` consumers the same way.

### Step 6: Bypass-matrix tests

`tests/safe-callback-url.test.ts` — table-driven:

```typescript
it.each(["/dashboard", "/", "/tiragem?deck=rws", "/minhas-tiragens?page=2", "/perfil"])
  ("accepts same-origin path %s", (value) => { expect(isSafeCallbackPath(value)).toBe(true) })

it.each([
  ["protocol-relative", "//evil.com"],
  ["backslash authority", "/\\evil.com"],
  ["literal LF authority", "/\n/evil.com"],
  ["encoded LF (decode-then-reparse)", "/%0a/evil.com"],
  ["encoded backslash", "/%5cevil.com"],
  ["scheme URL", "javascript:alert(1)"],
  ["relative path", "dashboard"],
  ["malformed percent-encoding", "/%zz"],
])("rejects %s", (_label, value) => { expect(isSafeCallbackPath(value)).toBe(false) })
```

Plus stash lifecycle: stash valid → cleared when param absent → cleared when param unsafe; tampered stored value falls back to `/dashboard`.

## Complete Example

1. `src/proxy.ts` redirects an unauthenticated `/tiragem/rws` request → `/login?callbackUrl=%2Ftiragem%2Frws`.
2. `AuthSessionBridge` validates it → `sessionStorage["auth-callback-url"] = "/tiragem/rws"`.
3. User submits → `router.push(callbackUrl)` + `router.refresh()`; Google path sends the **same** validated string to `signIn("google", { callbackUrl })`.
4. Magic-link flow (different page) → `router.push(consumeStoredCallbackUrl())` → validates again, consumes the stash, falls back to `/dashboard`.
5. Crafted `?callbackUrl=//evil.com` → validator fails → no stash, no navigation, `/dashboard` everywhere.

## Project-Specific Constraints

- [ ] **Never hand-roll a second validator** — every navigation sink imports `isSafeCallbackPath` / `useSafeCallbackUrl` / `consumeStoredCallbackUrl` from `src/hooks/use-safe-callback-url.ts`.
- [ ] Fallback is always `/dashboard`; an unsafe or missing target never errors, it degrades.
- [ ] Return the **raw** value from the predicate; never navigate with the decoded string.
- [ ] `AuthSessionBridge` must keep the `else → removeItem` branch; `consumeStoredCallbackUrl` must remove before validating.
- [ ] `<Suspense>` must wrap every `useSearchParams()` consumer (`login`, `magic-link` callback, `verify-email` pages).
- [ ] `src/proxy.ts` is the only producer of `?callbackUrl=` in normal flow (pathname only) — but treat the query as attacker-controlled anyway.
- [ ] Already-authenticated redirect is mount-only and requires `refreshSession() === ok` — never redirect on the persisted `isAuthenticated` flag alone (that looped `/login ↔ /dashboard`).

## Anti-Patterns (What NOT to Do)

- ❌ `startsWith("/") && !startsWith("//")` as the whole rule — accepts `/\evil.com` and `/%5cevil.com`.
- ❌ Checking the *encoded* string with string heuristics instead of decoding first and comparing WHATWG origins.
- ❌ Validating in the login form only, while `AuthSessionBridge`/`consumeStoredCallbackUrl`/`signIn` keep their own copies (the pre-fix state).
- ❌ Stashing an unvalidated `callbackUrl` into `sessionStorage`, or leaving a stale stash behind when the param is absent.
- ❌ Passing `searchParams.get("callbackUrl")` straight into `router.push`/`router.replace`/`signIn`.
- ❌ Using `window.location.origin` as the resolution base (environment-dependent; breaks in SSR/tests).
- ❌ Adding a `useSearchParams()` consumer outside a `<Suspense>` boundary.
- ❌ "Fixing" an unsafe value by silently normalizing it (strip `//`, decode in place) — reject and fall back instead.

## Related Patterns / Docs

- `docs/features/authentication.md` §Login redirect / `callbackUrl` + invariant 13 (single-source rule)
- `docs/06-features/authentication.md` (LoginForm T19 — `callbackUrl` seguro same-origin)
- `docs/solutions/patterns/auth/single-flight-token-refresh.md` (the mount-only `refreshSession()` guard this pairs with)
- `docs/work-plans/20260921120000-sprint1-completion-work-plan.md` (origin: three divergent validators)
- Tests: `tests/safe-callback-url.test.ts` (29), `tests/login-form.test.tsx` (21)

## Safe Change Checklist for Future AI Work

1. New redirect sink → import `isSafeCallbackPath()` (or the hook); never inline rules.
2. New bypass class discovered → add one row to the `it.each` matrix in `tests/safe-callback-url.test.ts`.
3. Change stash behavior → update `AuthSessionBridge` (write/clear) **and** `consumeStoredCallbackUrl` (consume/fallback) together.
4. Add/remove a `useSearchParams()` consumer → adjust the page's `<Suspense>` boundary.
5. Verify: `npx vitest run tests/safe-callback-url.test.ts tests/login-form.test.tsx`; grep `callbackUrl` in `src/` — every sink must route through `@/hooks/use-safe-callback-url`.
