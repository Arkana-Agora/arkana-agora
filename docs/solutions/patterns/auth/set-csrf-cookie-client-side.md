---
title: "Set CSRF Cookie Client-Side (Never in RSC) — Project Pattern"
problem_type: pattern
category: auth
components:
  - frontend
  - backend
tags:
  - patterns
  - csrf
  - double-submit
  - nextjs-app-router
  - rsc
  - cookies
  - auth
module: auth
date: 2026-09-23
established_in: "Sprint-1 bugfix batch 2 (2026-09-23): login/register pages illegally called cookies().set() in Server Components, Next 16 threw 'Cookies can only be modified in a Server Action or Route Handler', CSRF cookie never set → login/register would 403 CSRF_TOKEN_INVALID"
---

# Pattern: Set CSRF Cookie Client-Side (Never in RSC)

## Problem / When to Use This

Reach for this pattern whenever a cookie-based endpoint in this project needs the double-submit CSRF cookie (`csrf-token` / `__Host-csrf-token`) to exist before a browser `POST`, or when a new page/flow must guarantee the cookie is present. Next.js 16 App Router **forbids** `cookies().set()` inside Server Components (`page.tsx`) — it throws `Cookies can only be modified in a Server Action or Route Handler`, the cookie is silently never set, and the subsequent `POST /api/v1/auth/*` fails with 403 `CSRF_TOKEN_INVALID`. This bit the login/register pages on 2026-09-23. The project's established answer: set the cookie from the **browser** via `ensureCsrfCookie()` (`src/lib/csrf-client.ts`) called from the Zustand store immediately before the `POST` — the store call is the single writer in app code (form mount `useEffect` warm-up was removed as redundant) — not from RSC, not (currently) from middleware.

## Source of Truth Files

- `src/lib/csrf-cookie-name.ts` — shared dependency-free `csrfCookieName()` + `generateCsrfToken()` (single source for client/server/E2E)
- `src/lib/csrf-client.ts` — browser-safe `ensureCsrfCookie()` (the only place the cookie is written today)
- `src/lib/csrf.ts` — server-side `validateCsrfToken(request)` (double-submit validation, `timingSafeEqual` on UTF-8 byte lengths)
- `src/stores/auth-store.ts` — `login()` / `register()` call `ensureCsrfCookie()` and send `x-csrf-token` before `fetch`
- `src/app/api/v1/auth/login/route.ts`, `src/app/api/v1/auth/register/route.ts` — validation entry points (403 `CSRF_TOKEN_INVALID` before side effects)
- Entry points to read first: `src/lib/csrf-cookie-name.ts`, then `src/lib/csrf-client.ts`, then `src/lib/csrf.ts`, then `src/stores/auth-store.ts` (`login`/`register`)

## Current Implementation Snapshot

- Cookie **written only client-side** by `ensureCsrfCookie()` in `src/lib/csrf-client.ts` (`"use client"`): name from `csrfCookieName()` = `csrf-token` (dev) / `__Host-csrf-token` (`NODE_ENV === "production"`), value = 32 random bytes hex (64 chars), `path=/`, `max-age=86400` (24h), `samesite=strict`, `secure` appended on prod **or** when `window.location.protocol === "https:"`.
- `ensureCsrfCookie()` is **idempotent** (returns existing cookie value if present) and **SSR-safe** (returns `""` when `typeof window === "undefined"`).
- The **store is authoritative**: `login()` and `register()` do `const csrfToken = ensureCsrfCookie()` immediately before `fetch`, then send header `"x-csrf-token": csrfToken` alongside the cookie the browser attaches automatically (double-submit). Mount `useEffect` warm-up was removed (redundant with the store call).
- `src/app/(auth)/login/page.tsx` and `register/page.tsx` are **plain Server Components** — the illegal `cookies().set()` calls were removed; they only render metadata + `<LoginForm />` / `<RegisterForm />`.
- Server validation: `validateCsrfToken(request)` in `src/lib/csrf.ts` reads cookie by the shared `csrfCookieName()` and compares to `x-csrf-token` with `timingSafeEqual` on **UTF-8 byte buffers** (string `.length` pre-check would throw `RangeError` on multi-byte pairs) → 403 `CSRF_TOKEN_INVALID`.
- Tests: `tests/csrf-client.test.ts` covers create / reuse / clear / non-browser `""` / round-trip vs `validateCsrfToken`; E2E/direct POSTs must attach `...csrfHeaders()` from `tests/e2e/helpers.ts` (same token in `Cookie` and `x-csrf-token`; cookie name derived from `NODE_ENV`).
- Scope: only `POST /api/v1/auth/login` and `POST /api/v1/auth/register` validate CSRF today. Refresh, logout, magic-link, verify do **not** (Bearer/cookie-only, per design §7.1) — do not conflate.
- Middleware (`src/proxy.ts`, matcher `/dashboard/:path*`, `/perfil/:path*`, `/tirar`, `/tiragem/:path*`, `/minhas-tiragens`, `/meu-arcano/:path*`) was deliberately left untouched for CSRF (smaller blast radius); it only redirects unauthenticated users to `/login?callbackUrl=`.

## Planned / Optional Extensions (If Applicable)

- **Alternative (not implemented):** set the cookie server-side from a **Route Handler** or from **`src/proxy.ts`** (Next 16's middleware equivalent) — both are legal `cookie()` mutation contexts. The sprint-1 work plan explicitly chose client-side over middleware; revisit only with a reason, and keep the cookie attributes identical.
- Possibly extend `validateCsrfToken` to additional cookie-based state-changing routes if design §7.1 changes.

## Pattern Overview

Never mutate cookies from a Next.js App Router Server Component. For double-submit CSRF, write the non-httpOnly cookie from the browser through `ensureCsrfCookie()` (guaranteed in the store right before `POST`; no form mount warm-up) and validate cookie-vs-header server-side in the Route Handler before any side effect. The client helper is idempotent and returns the token so the caller can echo it as `x-csrf-token`.

## Implementation Steps

### Step 1: Client helper (source of the only cookie write)

File: `src/lib/csrf-client.ts` (exists — reuse, do not fork)

Key points:
- Must stay `"use client"` — it touches `document.cookie`.
- Cookie name **must** come from shared `csrfCookieName()` in `src/lib/csrf-cookie-name.ts` (single source for client/server/E2E; `__Host-` prefix in prod requires `Secure`, `Path=/`, no `Domain`).
- `httpOnly` must be **absent/false**: the browser JS has to read the value back to echo it in the header.
- Returns `""` outside the browser — store callers only run in the browser so they always get a string.

### Step 2: Store guarantees + echoes the token right before POST

File: `src/stores/auth-store.ts` (inside `login` / `register`)

```typescript
const csrfToken = ensureCsrfCookie()
const res = await fetch("/api/v1/auth/login", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "x-csrf-token": csrfToken,
  },
  body: JSON.stringify({ email, password }),
})
```

Key points:
- The store call **guarantees** the cookie exists at request time (idempotent). Form mount `useEffect` warm-up was removed as redundant.
- The page (`page.tsx`) stays a pure Server Component: metadata + layout + `<LoginForm />`, **zero** cookie APIs.
- Header name is exactly `x-csrf-token`; the browser attaches the cookie automatically on same-origin `fetch`.
- Any new cookie-authenticated state-changing action in the store must repeat this two-liner (`ensureCsrfCookie()` + header).

### Step 3: Validate server-side before any side effect

File: `src/app/api/v1/auth/login/route.ts` (same shape in `register/route.ts`)

```typescript
if (!validateCsrfToken(request)) {
  return errorResponse(reqId, 403, {
    error: { code: "CSRF_TOKEN_INVALID", message: "Token CSRF invalido" },
  })
}
```

Key points:
- `validateCsrfToken` uses `timingSafeEqual` (constant-time) — do not replace with `===`.
- Ordering is a security property: validation **before** any observable side effect, otherwise the 403 path leaks timing/state.
- Error contract is fixed: HTTP 403, `code: "CSRF_TOKEN_INVALID"`.

### Step 4: Tests and E2E callers

- Unit: `tests/csrf-client.test.ts` — cookie create/reuse/clear, `""` when no `window`, and round-trip `ensureCsrfCookie()` → `validateCsrfToken(new Request(...)) === true`.
- E2E / scripts / curl hitting login or register **directly** must send both halves of the pair via `...csrfHeaders()` from `tests/e2e/helpers.ts`.

## Project-Specific Constraints

- [ ] **Never call `cookies().set()` (or any cookie mutation) in a Server Component / `page.tsx`** — Next 16 App Router throws `Cookies can only be modified in a Server Action or Route Handler`.
- [ ] The **only** writer of the CSRF cookie in app code is `ensureCsrfCookie()` in `src/lib/csrf-client.ts`; cookie name comes from shared `csrfCookieName()` in `src/lib/csrf-cookie-name.ts` (client/server/E2E must all import or mirror that single source).
- [ ] Attributes fixed: `httpOnly` **off**, `sameSite=strict`, `path=/`, `max-age=86400` (24h), `secure` on prod or HTTPS.
- [ ] Store is authoritative: every CSRF-checked `fetch` from `auth-store.ts` calls `ensureCsrfCookie()` immediately before the request and sends `x-csrf-token`.
- [ ] Server check is `validateCsrfToken(request)` (`timingSafeEqual` on UTF-8 **byte** lengths) in the Route Handler, **after** body validation, **before** any side effect; failure = 403 `CSRF_TOKEN_INVALID`.
- [ ] Direct callers (Playwright specs, scripts, load tests) must send `...csrfHeaders()` from `tests/e2e/helpers.ts`.
- [ ] Scope is currently login + register only; refresh/logout/magic-link/verify intentionally skip CSRF per design §7.1.
- [ ] Middleware `src/proxy.ts` handles `/dashboard/:path*` auth redirects only — do not silently start mutating cookies there.

## Anti-Patterns (What NOT to Do)

- ❌ Don't call `cookies().set()` in `page.tsx` or any RSC — it throws and the cookie never lands (the exact 2026-09-23 bug).
- ❌ Don't set the CSRF cookie with `httpOnly: true` — client JS couldn't read it to echo `x-csrf-token`.
- ❌ Don't rely only on a form `useEffect` — the store call before `fetch` is mandatory.
- ❌ Don't validate CSRF **after** lockout/rate-limit/bcrypt/DB mutations.
- ❌ Don't compare tokens with `===` or with string `.length` pre-checks — use `validateCsrfToken`'s `timingSafeEqual` on Buffers.
- ❌ Don't hardcode `csrf-token` in new code — use shared `csrfCookieName()` (prod expects `__Host-csrf-token`).
- ❌ Don't fork a second `ensureCsrfCookie` — reuse `src/lib/csrf-client.ts`.

## Related Patterns / Docs

- `docs/modules/auth.md` §4 (CSRF double-submit contract)
- `docs/features/authentication.md` §8 (login CSRF flow + `csrfHeaders()` requirement)
- `docs/02-architecture/architecture.md` (security/CSRF bullet, 2026-09-23 client-side note)
- `docs/work-plans/20260921120000-sprint1-completion-work-plan.md` (bug origin)
- `docs/solutions/patterns/security/auth-uniform-response-timing-equalization.md` (validation-before-side-effects discipline)

## Safe Change Checklist for Future AI Work

1. New CSRF-protected route: call `validateCsrfToken(request)` right after body parsing, 403 before side effects.
2. New browser `POST`: `ensureCsrfCookie()` + `"x-csrf-token"` header from the store/caller right before `fetch` — no form `useEffect` warm-up (the store call is authoritative).
3. Keep `csrf-client.ts` and `csrf.ts` cookie names in sync; update `tests/csrf-client.test.ts` and `tests/e2e/helpers.ts`.
4. Never introduce cookie writes in `page.tsx`; use Route Handler or `src/proxy.ts` if server-side write is truly needed.
5. Verify: `npx vitest run tests/csrf-client.test.ts` (round-trip green); grep for `cookies().set` in `src/app/**/page.tsx` must stay empty.
