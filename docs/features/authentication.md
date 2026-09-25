# Authentication Feature — Frontend

> Canonical frontend documentation for the authentication feature.
> Last updated: 2026-09-24.

## Purpose

All user-facing authentication flows: login, registration, magic link, password reset,
email verification, and account management. Implements design §1 and §6 of SPEC-001.
This feature also owns the **LGPD analytics consent UI** (consent banner + consent-gated
PostHog boot) and the client/server CSRF double-submit contract used by login/register.

## Source of Truth Files

| File | Role |
|------|------|
| `src/app/(auth)/layout.tsx` | Shared auth layout (50/50 split, Framer Motion) |
| `src/app/(auth)/login/login-form.tsx` | Email/password login form |
| `src/app/(auth)/register/register-form.tsx` | Registration form with password strength |
| `src/app/(auth)/magic-link/magic-link-form.tsx` | Magic link request form |
| `src/app/(auth)/forgot-password/forgot-password-form.tsx` | Password reset request form |
| `src/app/(auth)/reset-password/reset-password-form.tsx` | Password reset form (token-based) |
| `src/app/(auth)/verify-email/verify-email-form.tsx` | Email verification + resend |
| `src/app/(auth)/callback/magic-link/page.tsx` | Magic link callback (token redemption) |
| `src/app/(auth)/login/page.tsx` | Login page — mounts `AuthSessionBridge` + `LoginForm` inside `<Suspense fallback={null}>` (required for `useSearchParams`); `LoginFormCard` was removed (Card lives in server HTML) |
| `src/components/auth/auth-guard.tsx` | Client-side route protection (post-mount session validation) |
| `src/components/auth/logout-button.tsx` | Client logout button — `useAuthStore.logout()` then navigate to `/login` (dashboard uses this, **not** a server-action `signOut`) |
| `src/app/(app)/dashboard/page.tsx` | Dashboard — renders `<LogoutButton />` |
| `src/proxy.ts` | Edge middleware — redirects unauthenticated protected routes to `/login?callbackUrl=<pathname>` |
| `src/hooks/use-safe-callback-url.ts` | Shared same-origin `?callbackUrl=` rules — pure `isSafeCallbackPath()` (leading `/`, percent-decode with malformed→reject, WHATWG origin equality) + `useSafeCallbackUrl`, `AuthSessionBridge` (stashes valid param, clears stale stash), `consumeStoredCallbackUrl` |
| `src/lib/auth-refresh.ts` | Single-flight refresh + access-token cache used by `refreshSession()`/`logout()` (`refreshAccessTokenOnce`, `clearCachedAccessToken`, `invalidateSessionCache`) |
| `src/stores/auth-store.ts` | Zustand auth state (13 actions; generic `AuthResult<TErrorCode>` results); `login()`/`register()` are the sole callers of `ensureCsrfCookie()` before POST |
| `src/lib/api.ts` | Axios interceptor with auto-refresh |
| `src/lib/validators/auth.ts` | 13 Zod schemas |
| `src/lib/csrf-client.ts` | Browser-only `ensureCsrfCookie()` — the single writer of the CSRF cookie (idempotent, SSR-safe `""`) |
| `src/lib/csrf-cookie-name.ts` | Centralized CSRF cookie name (`csrfCookieName()`: `csrf-token` dev / `__Host-csrf-token` prod) + `generateCsrfToken()` (32 random bytes → 64-hex) |
| `src/lib/csrf.ts` | Server `validateCsrfToken(request)` — double-submit check via `timingSafeEqual` on UTF-8 byte buffers (byte-length pre-check) |
| `src/auth/auth.config.ts` | Auth.js v5 config + production hard guard (`AUTH_URL` https + `AUTH_SECRET` required, fails fast at module load) |
| `src/lib/analytics.ts` | Consent-gated PostHog init/track + `setAnalyticsConsent()` (localStorage key `analytics-consent` — exported as `ANALYTICS_CONSENT_STORAGE_KEY`, imported by the banner) |
| `src/components/analytics/consent-banner.tsx` | LGPD analytics consent dialog (`applyConsent` → `setAnalyticsConsent`) |
| `src/components/providers.tsx` | App shell — boots analytics via dynamic `initAnalyticsWithConsent()`, mounts `AnalyticsConsentBanner` |
| `tests/csrf-client.test.ts`, `tests/analytics.test.ts` (11), `tests/auth-config.test.ts` | Contract tests for CSRF client/server round-trip, analytics guards, auth-config production guard |
| `tests/login-form.test.tsx` (21), `tests/consent-banner.test.tsx` (5), `tests/auth-guard.test.tsx` (7) | LoginForm submit/redirect/error mapping + Google `callbackUrl` + mount-only session-redirect guard; consent dialog hydrate/no-reload/dismiss-without-persist; AuthGuard post-mount validation |
| `tests/safe-callback-url.test.ts` (29), `tests/auth-helpers.test.ts` (5), `tests/components/logout-button.test.tsx` (4) | Open-redirect bypass matrix + AuthSessionBridge stash lifecycle; `maskEmail` LGPD masking; LogoutButton pending/navigate lifecycle |

## Current Implementation Snapshot

### Pages and Routes

| Route | Component | Protected | Description |
|-------|-----------|-----------|-------------|
| `/login` | LoginForm (page wraps in Suspense) | No | Email/password login; reads safe same-origin `?callbackUrl=` (default `/dashboard`); auth-store sets CSRF cookie `csrf-token`/`__Host-csrf-token` via `ensureCsrfCookie()` before POST |
| `/register` | RegisterForm | No | Account registration (auth-store sets CSRF cookie `csrf-token`/`__Host-csrf-token` via `ensureCsrfCookie()` before POST) |
| `/magic-link` | MagicLinkForm | No | Request magic link |
| `/forgot-password` | ForgotPasswordForm | No | Request password reset |
| `/reset-password` | ResetPasswordForm | No | Reset password (token from URL) |
| `/verify-email` | VerifyEmailPage | No | Email verification + resend |
| `/callback/magic-link` | MagicLinkCallback | No | Redeem magic link token |
| `/dashboard` | DashboardPage | Yes (proxy + `(app)` layout guard) | Post-login landing; renders client `<LogoutButton />` |

### Login redirect / `callbackUrl` (`login-form.tsx` + `login/page.tsx`)

- `src/app/(auth)/login/page.tsx` mounts `AuthSessionBridge` + `LoginForm` inside `<Suspense fallback={null}>` — required because both call `useSearchParams()`.
- **Safe callback validation** — single source: `isSafeCallbackPath(raw)` in `src/hooks/use-safe-callback-url.ts` (used by `useSafeCallbackUrl`, `AuthSessionBridge`, `consumeStoredCallbackUrl`, and `LoginForm`):
  - must be non-empty and start with `/` (rejects `//host`, `/\evil.com`, scheme URLs like `javascript:...`)
  - percent-DECODED input must parse same-origin under WHATWG `new URL(decoded, base)` (rejects `/%0a/`, `/%5c`, malformed `%zz`, control-char authorities)
  - invalid/missing → fallback **`/dashboard`**
- `src/proxy.ts` populates `?callbackUrl=` with `request.nextUrl.pathname` when redirecting unauthenticated requests to `/login` (matcher: `dashboard`, `perfil`, `tirar`, `tiragem`, `minhas-tiragens`, `meu-arcano`).
- **Already authenticated**: mount-only effect calls store `refreshSession()` and `router.replace(callbackUrl)` **only when the server round-trip succeeds** (`ok`) — no client-trust redirect loop; `onSubmit` keeps `push` + `refresh`.
- **Email/password success**: `router.push(callbackUrl)` then `router.refresh()`.
- **Google**: `handleGoogleSignIn` → `signIn("google", { callbackUrl })` — the **same validated callback**, not a hardcoded `/dashboard`. `NEXT_REDIRECT` rejections are swallowed; other errors → "Erro ao entrar com Google".
- Note: store action `loginWithGoogle(callbackUrl = "/dashboard")` takes the redirect target as an optional parameter (LoginForm does not use it — it calls `signIn` directly).
- **Server-side Google profile sync** (2026-09-25): `events.signIn` in `src/auth/auth.config.ts` back-fills `User.name`/`displayName` (from `profile.name`) and `User.avatar` (from `profile.picture`) **only when empty** — the minimal adapter did not copy these, so OAuth accounts had no name/avatar and no Personal Arcana could be computed. The handler is fully `try/catch`d (a throw would abort session creation after a successful auth). `birthDate` is **not** synced — Google's `openid email profile` scope does not return it (People API would be needed, out of scope).

### AuthStore (`src/stores/auth-store.ts`)

Zustand store with `persist` middleware (localStorage key: `arkana-auth`).

**State:**
- `user: StoredUser | null` — full User or PartialUser (for unverified emails)
- `isAuthenticated: boolean` — derived from `user != null && user.emailVerified`
- `isLoading: boolean` — true during async auth operations
- `error: string | null` — auto-clears after 5 seconds

**Actions:**
- `login(email, password)` — POST /api/v1/auth/login (`ensureCsrfCookie()` ensures cookie, sends value as `x-csrf-token` header — mirrors `register()`)
- `register(data)` — POST /api/v1/auth/register (`ensureCsrfCookie()` ensures cookie, sends value as `x-csrf-token` header); success is **201 `{ message }` only** (anti-enumeration — no 409, no auto-login)
- `sendMagicLink(email)` — POST /api/v1/auth/magic-link
- `forgotPassword(email)` — POST /api/v1/auth/forgot-password
- `resetPassword(data)` — POST /api/v1/auth/reset-password
- `verifyEmail(token)` — POST /api/v1/auth/verify-email
- `resendVerifyEmail(email)` — POST /api/v1/auth/verify-email/resend
- `verifyMagicLink(token)` — POST /api/v1/auth/magic-link/verify
- `loginWithGoogle(callbackUrl?)` — redirect to Auth.js Google OAuth (optional `callbackUrl`, default `/dashboard`; LoginForm does not use it — it calls `signIn` directly)
- `logout()` — best-effort `POST /api/v1/auth/logout` (Bearer) + `signOut({ redirect: false })` + clear `user`/`isAuthenticated` + `resetAuthApiSessionCache()` (auth-refresh caches) + `resetUser()` (PostHog identity reset, consent-aware) + delete Cache Storage keys starting `arkana-agora-`
- `deleteAccount(email)` — DELETE /api/v1/auth/account (same local cleanup as `logout()`: `resetAuthApiSessionCache()` + `resetUser()`)
- `refreshSession()` — delegates to shared `refreshAccessTokenOnce()` (`src/lib/auth-refresh.ts`); store-level `refreshInFlight` only dedupes `isLoading`; on success with `data.user` updates the stored user; success with only `accessToken` **keeps** the current user; `network_error` **and `server_error` (5xx)** keep the user (transient/non-destructive); `auth_failed`/`bad_response` clear `user`; returns boolean
- `clearError()` — clear error state

**Result typing:** `sendMagicLink`/`forgotPassword`/`resetPassword`/`verifyEmail`/`resendVerifyEmail`/
`verifyMagicLink` return discriminated unions built on the generic `AuthResult<TErrorCode>`
(`{ success: true; message? }` | `{ success: false; code; message; retryAfter? }`) via the shared
`hasMessage()` / `asAuthFailure()` helpers. Every failure branch can carry `retryAfter?` when the
server returns it (429s). `login()`/`register()`/`logout()`/`deleteAccount()` remain void-returning
and set store `error` instead.

### AuthGuard (`src/components/auth/auth-guard.tsx`)

Client-side route protection (`"use client"`), matching `src/components/auth/auth-guard.tsx`:

1. Starts **unverified** (`checked = false`): server and first client render both show a `role="status"` skeleton (`aria-label="Verificando sessao"`) — avoids hydration mismatch; persisted state is not trusted yet.
2. **Post-mount** `useEffect` (runs once — guarded by `checked` + a cancellation flag): calls `refreshSession()` (auth-store single-flight), then sets `checked = true` when it settles.
3. After the check: if `!isAuthenticated` or `!passesRole(user, requiredRole)` → `router.replace("/login")` and render `null` (children never flash).
4. Renders `children` only when `checked && isAuthenticated && role passes`.
5. Optional `requiredRole?: UserRole` (`"USER" | "PROFESSIONAL" | "ADMIN"`) for RBAC — `passesRole` requires `user != null && "role" in user && user.role === requiredRole` (a `PartialUser` never satisfies a required role).

### Logout — dashboard `LogoutButton` (`src/components/auth/logout-button.tsx`)

- Dashboard (`src/app/(app)/dashboard/page.tsx`) renders the client `<LogoutButton />` — **not** a server-action `signOut` (the old server action left the refresh family valid and localStorage populated).
- Click → `pending` disables the button ("Saindo...") → `useAuthStore.logout()` → in `finally`: `router.replace("/login")` + `router.refresh()`.
- Store `logout()` sequence:
  1. Resolve access token (`getSession()` via shared cache in `src/lib/auth-refresh.ts`); if present, `POST /api/v1/auth/logout` with `Authorization: Bearer` (server-side revoke; network errors swallowed — best-effort)
  2. `signOut({ redirect: false })` (clear Auth.js session cookie; failure swallowed — best-effort)
  3. Clear store: `user: null`, `isAuthenticated: false`, `isLoading: false`
  4. `resetAuthApiSessionCache()` (= `clearCachedAccessToken()` + `invalidateSessionCache()`, `src/lib/auth-refresh.ts`) + `resetUser()` (PostHog identity reset; re-asserts opt-out when consent is revoked)
  5. Delete Cache Storage entries whose name starts with `arkana-agora-` (if `caches` is available)

### Axios Interceptor (`src/lib/api.ts`)

- Request interceptor token order: `_retry` (retry keeps fresh token) → existing `Authorization` header → 60s access-token cache (`getCachedAccessToken`) → `resolveAccessToken(() => getSession())` (shared single-flight session lookup)
- Response interceptor: on 401 once (`_retry`), awaits shared `refreshAccessTokenOnce()` (`src/lib/auth-refresh.ts`); on success sets `Authorization: Bearer <fresh>` **and** `_retry = true`, then re-issues — never re-runs `getSession()` over a just-refreshed token
- Concurrent 401s coalesce into **one** `POST /api/v1/auth/refresh` (module-level single-flight)
- On logout/delete: `resetAuthApiSessionCache()` / store clears `clearCachedAccessToken()` + `invalidateSessionCache()`

### CSRF Cookie Flow (client-only)

- `src/app/(auth)/login/page.tsx` and `register/page.tsx` are **plain Server Components** — no cookie code (`cookies().set()` is illegal in RSC on Next.js App Router; removed 2026-09-23).
- `LoginForm`/`RegisterForm` do **not** warm the cookie on mount (the mount `useEffect(() => ensureCsrfCookie(), [])` was removed as redundant).
- The **store is authoritative**: `login()`/`register()` run `const csrfToken = ensureCsrfCookie()` immediately before `fetch` and send header `x-csrf-token`; the browser attaches the cookie automatically (double-submit).
- `ensureCsrfCookie()` (`src/lib/csrf-client.ts`) is idempotent (reuses an existing value), SSR-safe (`""` when `window` is undefined), and writes `path=/`, `max-age=86400` (24h), `samesite=strict`, plus `secure` on production **or** an `https:` page.
- Cookie **name and token generation are centralized** in `src/lib/csrf-cookie-name.ts` (`csrfCookieName()`: `csrf-token` dev / `__Host-csrf-token` prod; `generateCsrfToken()`: 32 random bytes → 64-char hex) — client, server and E2E must import/mirror this single source.
- Server side, `validateCsrfToken()` (`src/lib/csrf.ts`) reads the cookie by the shared name and compares it to `x-csrf-token` with `timingSafeEqual` on UTF-8 **byte** buffers (byte-length pre-check, not string `.length`) → 403 `CSRF_TOKEN_INVALID`.

### Analytics Consent UI (PostHog, LGPD)

- **Boot**: `src/components/providers.tsx` dynamically imports `@/lib/analytics` and calls `initAnalyticsWithConsent()` in a mount effect (dynamic import avoids SSR issues); `AnalyticsConsentBanner` is rendered app-wide inside the provider tree.
- **Guard chain inside `initAnalytics()`** (order matters): SSR / already-`initialized` early-return → `NODE_ENV === "development"` early-return → consent check (`localStorage["analytics-consent"] === "true"`) → missing-key `console.warn("[Analytics] PostHog key not configured")` + return → `posthog.init(...)` with pinned options `disable_session_recording: true`, `capture_dead_clicks: false`, `autocapture: false` (local pins defeat PostHog remote-config re-enabling them) → `initialized = true`.
- **Consent enforced at use sites**: `track*`/`setUserProperties` no-op unless `initialized && hasConsent()`.
- **Banner** (`src/components/analytics/consent-banner.tsx`): `useSyncExternalStore` over `storage` + custom `arkana-consent` events; auto-opens while no decision is stored, otherwise collapses to a "Preferências de Analytics" button; **hydrates** the switch from stored consent when reopened; `applyConsent(value)` → `setAnalyticsConsent(value)` → dispatch `arkana-consent` → close dialog — **no page reload** (grant runs `initAnalytics()` inside `setAnalyticsConsent(true)`); **dismiss** (Escape, backdrop click, close button) only closes the dialog and **persists nothing**.
- **Grant**: `setAnalyticsConsent(true)` writes `"true"`, calls `initAnalytics()` if needed, then `posthog.opt_in_capturing({ captureEventName: false })` (no `$opt_in` event; idempotent — re-grant after revoke works in place). **Revoke**: writes `"false"`, then `resetUser()` (`posthog.reset()` **first** — it deletes the persisted SDK consent key `__ph_opt_in_out_*`) and **then** `posthog.opt_out_capturing()` (re-assert, otherwise the reset silently re-enables auto-capture). `resetUser()` itself re-asserts the opt-out when consent is revoked (logout path).
- The banner must always go through `setAnalyticsConsent()` — never raw `localStorage.setItem` for the consent key.

### Auth Config Production Guard (`src/auth/auth.config.ts`)

- At module load, when `NODE_ENV === "production"` **and** `NEXT_PHASE !== "phase-production-build"`, the config throws fast if: `AUTH_URL` is missing, the `AUTH_URL` URL scheme (via `new URL(...).protocol`) is not `https:`, or `AUTH_SECRET` is missing (host-header-poisoning and secret-less operation are prevented before any request is served).
- Error messages carry diagnostics only — env presence flags (`AUTH_URL_in_env`/`AUTH_URL_empty`), URL scheme (`got scheme=...`), `VERCEL_ENV` — **never secret values**.
- `NEXT_PHASE=phase-production-build` exempts the guard so production builds can run without runtime env.
- Covered by `tests/auth-config.test.ts`.

### Tests

| File | Covers |
|------|--------|
| `tests/csrf-client.test.ts` | `ensureCsrfCookie()` create/reuse/clear, `""` outside the browser, dev cookie name, client→server round-trip (`validateCsrfToken === true`) |
| `tests/analytics.test.ts` (11) | dev gate, consent gate, pinned init options, missing key, track no-op/capture, consent grant/revoke order (`reset` before `opt_out`), revoke→re-grant, `resetUser` consent re-assert |
| `tests/login-form.test.tsx` (21) | rendering, password toggle, client validation, submit success (default `/dashboard`) + error mapping, Google `signIn` with dynamic `callbackUrl`, mount-only session-redirect guard (redirects only when `refreshSession()` returns `ok`) |
| `tests/consent-banner.test.tsx` (5) | auto-open without a stored decision, persist reject/accept **without reload**, hydrate switch on reopen, Escape/backdrop dismiss persists nothing |
| `tests/auth-guard.test.tsx` (7) | post-mount `refreshSession` validation, skeleton while checking, `/login` redirect on fail/role mismatch, single refresh call |
| `tests/auth-config.test.ts` | provider contract (email always, google conditional, 15-min `maxAge`) + production `AUTH_URL`/`AUTH_SECRET` guard incl. `NEXT_PHASE` build exemption |
| `tests/safe-callback-url.test.ts` (29) | open-redirect bypass matrix (protocol-relative, backslashes, control chars, encoded variants, schemes, malformed `%`), `consumeStoredCallbackUrl` fallbacks, `AuthSessionBridge` stash lifecycle |
| `tests/auth-helpers.test.ts` (5) | `maskEmail` LGPD masking (short-local contract: ≥1 char always hidden) |
| `tests/components/logout-button.test.tsx` (4) | render/pending "Saindo...", navigate on success, navigate on logout rejection |

## Invariants and Gotchas

1. **`isAuthenticated` is derived** — never set directly; depends on `user != null && user.emailVerified`
2. **PartialUser for unverified emails** — `login()` stores `{email, emailVerified: false}` on 401 `AUTH_EMAIL_NOT_VERIFIED` (C9)
3. **Error auto-clear** — 5s timer in store; no useEffect
4. **`emailVerified` is boolean in store** — derived from `user.emailVerified !== null` (S12 — DB column is `DateTime?`)
5. **Google OAuth bypasses verify-email** — C12: OAuth users are auto-verified
6. **Refresh uses cookie** — not Bearer; interceptor sends `credentials: "include"`
7. **Logout clears both cookies server-side** — `POST /api/v1/auth/logout` now also expires the Auth.js session cookie (`buildSessionExpireCookie`), not just the refresh cookie; the store's `signOut({ redirect: false })` remains the client-side backstop. The dashboard uses the client `LogoutButton` → `useAuthStore.logout()` (revoke + signOut + clear caches), **not** a server-action `signOut`
8. **Login enforces CSRF (double-submit)** — `POST /api/v1/auth/login` validates via `validateCsrfToken` (`src/lib/csrf`) right after body validation → 403 `CSRF_TOKEN_INVALID` before any side effect (lockout/rate-limit/bcrypt/DB). The CSRF cookie is set **client-side** by `ensureCsrfCookie()` (`src/lib/csrf-client.ts`) from `login()` in the store immediately before POST (`csrf-token` dev / `__Host-csrf-token` prod, `httpOnly: false`, `sameSite: strict`, 24h; form mount `useEffect` warm-up was removed as redundant) — Server Components cannot call `cookies().set()` on Next.js App Router. The store sends the cookie value as `x-csrf-token`. Any direct POST to the login API (tests, scripts) must send `...csrfHeaders()`
9. **CSRF name/token single source** — cookie name and token generation always come from `src/lib/csrf-cookie-name.ts` (`csrfCookieName()`/`generateCsrfToken()`); never fork a second name/generator (client, server and E2E must agree or double-submit breaks). Server comparison stays `timingSafeEqual` on UTF-8 byte buffers — never `===` or string `.length` pre-checks
10. **Analytics consent key & guard order** — storage key is exactly `analytics-consent` (`"true"`/`"false"`, shared by `analytics.ts` and the banner); `initAnalytics()` guard order must stay SSR/idempotency → development → consent → missing key → `posthog.init` → `initialized`; loaders `disable_session_recording: true`/`capture_dead_clicks: false`/`autocapture: false` are pinned **locally** (PostHog remote config can re-enable them); consent changes go through `setAnalyticsConsent()` only (revoke → `resetUser()` **then** `opt_out_capturing()` — order matters because `posthog.reset()` deletes the SDK consent key; grant → `initAnalytics()` if needed then `opt_in_capturing({ captureEventName: false })`; apply does **not** reload the page, dismiss persists nothing)
11. **Auth config production guard fails fast** — `src/auth/auth.config.ts` throws at load in production when `AUTH_URL` (https) or `AUTH_SECRET` is missing (`NEXT_PHASE=phase-production-build` exempt); error text carries presence/scheme/`VERCEL_ENV` diagnostics only, never secret values
12. **Never `cookies().set()` in an RSC** — login/register pages stay plain Server Components; the only CSRF cookie writer in app code is `ensureCsrfCookie()`, called at action time (store) before any CSRF-checked POST
13. **`callbackUrl` must stay same-origin** — single source of truth is `isSafeCallbackPath()` in `src/hooks/use-safe-callback-url.ts` (leading `/`, percent-decode with malformed→reject, WHATWG origin equality — never hand-roll a second copy); default `/dashboard`; used for email success, the mount-only already-authenticated redirect, `AuthSessionBridge` stash validation, and Google `signIn` — never pass an unvalidated query value to `router.*`/`signIn`
14. **Login page needs Suspense** — `AuthSessionBridge` and `LoginForm` call `useSearchParams()`; `src/app/(auth)/login/page.tsx` must keep a `<Suspense>` boundary around them (Next.js App Router requirement)
15. **JWT keypair breaks all tokens if either key is missing** — `verifyAccessToken` (`src/services/token-service.ts`) reads/parses `JWT_PUBLIC_KEY` OUTSIDE the `jwtVerify` try (since 2026-09-24). A missing/unparsable public key throws `AuthTokenError("AUTH_CONFIG_INVALID_PUBLIC_KEY")` → mapped to HTTP **500**, never 401. Before this fix, the missing key was swallowed by the catch and every token (login- and refresh-issued alike) failed as `AUTH_TOKEN_INVALID`, producing the 401 → refresh → retry loops / login flicker signature. `requireAuth` (`src/app/api/v1/users/_helpers.ts`) maps `AUTH_CONFIG_*` → 500; logout/account routes already answer 500 for unknown AuthTokenError codes. Keep `JWT_PRIVATE_KEY` + `JWT_PUBLIC_KEY` set together per environment (runbook `docs/runbooks/jwt-public-key-missing-all-401.md`).
16. **Google `events.signIn` must stay non-destructive and never throw** — it writes `name`/`displayName`/`avatar` only when the current value is empty (never overwrites user edits) and is wrapped in `try/catch` with a `warn` log. Do not let enrichment failures propagate: `events` runs after authentication, so a `throw` would cost the user a successful login. `birthDate` is intentionally absent (not in the `openid email profile` scope).

## Safe Change Checklist for Future AI Work

- [ ] Before changing auth-store.ts, read design §5 in `.specs/001-auth/design.md`
- [ ] Before changing AuthGuard, read design §1.7 — keep post-mount `refreshSession()` validation and `/login` redirect
- [ ] Before adding new auth routes, check design §6 route table
- [ ] Keep `isSafeCallbackPath()`/`useSafeCallbackUrl()` rules in sync (single source — never fork a second validator); keep the login page Suspense boundary (covers `AuthSessionBridge` + `LoginForm`)
- [ ] After CSRF/analytics/auth-config changes, run `npx vitest run tests/csrf-client.test.ts tests/analytics.test.ts tests/auth-config.test.ts`
- [ ] After login/logout/consent/callback changes, run `npx vitest run tests/login-form.test.tsx tests/consent-banner.test.tsx tests/auth-guard.test.tsx tests/safe-callback-url.test.ts tests/auth-helpers.test.ts tests/components/logout-button.test.tsx`
- [ ] Run `npm run type-check && npm run lint && npm run test` after changes
- [ ] Update this file if components, routes, or store actions change

## Related Plans and Docs

- Plan: `docs/plans/20260901165326-modulo1-auth-plan.md`
- Spec: `.specs/001-auth/design.md` (§1 UI components, §5 Zustand state, §6 routes)
- Backend module: `docs/modules/auth.md`
- API contract: `docs/04-api/authentication.md`
- Feature overview: `docs/06-features/authentication.md`
