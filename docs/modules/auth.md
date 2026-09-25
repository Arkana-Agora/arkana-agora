# Auth Module — Backend

> Canonical backend documentation for the authentication and authorization module.
> Last updated: 2026-09-24.

## Purpose

Implements the complete authentication and authorization system for Arkana Agora:
email/password registration and login, magic link, OAuth (Google), password reset,
email verification, refresh token rotation with reuse detection, and LGPD account lifecycle.

## Source of Truth Files

| File | Role |
|------|------|
| `src/services/token-service.ts` | JWT signing, token rotation, reuse detection, session management |
| `src/app/api/v1/auth/_helpers.ts` | Shared route helpers (error/success envelopes, cookie builders incl. Auth.js session bridge, timing equalization, `maskEmail()` PII masking for auth logs, request parsing) |
| `src/app/api/v1/auth/*/route.ts` | API route handlers (12 endpoints) |
| `src/lib/rate-limit.ts` | In-memory rate limiter with sliding window |
| `src/lib/validators/auth.ts` | 13 Zod schemas for all auth inputs |
| `src/lib/csrf.ts`, `src/lib/csrf-client.ts`, `src/lib/csrf-cookie-name.ts` | CSRF double-submit trio: server `validateCsrfToken` (`timingSafeEqual`, byte-length), browser cookie writer (`ensureCsrfCookie`), shared cookie name/token generation |
| `src/lib/redis.ts` | Redis singleton (tokenVersion cache, optional) |
| `src/lib/auth-refresh.ts` | Client single-flight refresh (`refreshAccessTokenOnce`), shared access-token cache (60s TTL), session-lookup dedup (`resolveAccessToken`) |
| `src/lib/api.ts` | Axios `authApi` client: Bearer injection + 401→refresh retry **without** re-reading session (`_retry` — stale-token race fix) |
| `src/auth/auth.config.ts` | Auth.js v5 edge config (Google OAuth + EmailProvider) + `events.signIn` (non-destructive Google profile enrichment: `name`/`displayName`/`avatar`, only-when-empty) + production env hard guard (`AUTH_URL` https + `AUTH_SECRET` required, fails fast at module load, no secret values logged) |
| `src/auth/prisma-adapter.ts` | Minimal Auth.js Prisma adapter |
| `prisma/schema.prisma` | User, Session, VerificationToken models |

## Current Implementation Snapshot

### API Endpoints (all under `/api/v1/auth/`)

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/register` | POST | None + CSRF | Create account with email/password — returns **201 `{ message }` only** (anti-enumeration: no user object, no auto-login); double-submit: cookie `csrf-token`/`__Host-csrf-token` + header `x-csrf-token` |
| `/login` | POST | None + CSRF | Authenticate with email/password (double-submit: cookie `csrf-token`/`__Host-csrf-token` + header `x-csrf-token`) |
| `/refresh` | POST | Cookie | Cookie-based rotation of refresh token, issue new access — client **single-flights** concurrent refreshes (`refreshAccessTokenOnce`) |
| `/logout` | POST | Bearer (required) | Verify access token, then **revoke the refresh session from the cookie** (or all sessions with `allDevices: true` + `tokenVersion` bump); always clears refresh + Auth.js session cookies |
| `/magic-link` | POST | None | Send magic link email |
| `/magic-link/verify` | POST | None | Redeem magic link token |
| `/forgot-password` | POST | None | Send password reset email |
| `/reset-password` | POST | None | Reset password with token |
| `/verify-email` | POST | None | Verify email with token |
| `/verify-email/resend` | POST | None | Resend verification email |
| `/account` | DELETE | Bearer | Soft-delete account (LGPD) |
| `/restore-account` | POST | None | Restore account within 30-day window |

> **There is NO `GET /api/v1/auth/me`** — that route does not exist (`src/app/api/v1/auth/` has no `me` directory; calling it returns 404). The authenticated profile is **`GET /api/v1/users/me/profile`** (users module — `src/app/api/v1/users/me/profile/route.ts`, Bearer auth via `requireAuth`, contract in `docs/04-api/users.md`).

### Token Service (`src/services/token-service.ts`)

Core functions:
- `signAccessToken(user)` — RS256 JWT, 15min, claims: `{sub, role, plan, tokenVersion}`
- `verifyAccessToken(token)` — validates RS256 + tokenVersion against Redis/DB
- `createRefreshSession(userId, {userAgent, ip})` — creates Session with SHA-256 hash
- `rotateRefresh(rawToken)` — transactional rotation (interactive `prisma.$transaction`; the conditional `updateMany` revalidates `revokedAt: null` AND `expiresAt > now` atomically, closing the rotation-vs-revocation race) + family-based reuse detection; `signAccessToken` runs BEFORE the transaction so a signing failure never commits the rotation
- `bumpTokenVersion(userId)` — atomic increment for immediate revocation
- `revokeRefreshSession(rawToken, userId)` — revoke single session
- `revokeAllSessions(userId)` — revoke all sessions + bump tokenVersion
- `softDeleteAccount(userId)` — LGPD soft delete with session revocation

### Rate Limiting (`src/lib/rate-limit.ts`)

| Endpoint | Limit | Window | Key |
|----------|-------|--------|-----|
| Login (USER) | 5 attempts | 15min | IP + email |
| Login (ADMIN) | 20 attempts | 15min | IP + email |
| Register | 3 per email, 3 per IP | 15min, 1h | Email + IP |
| Magic link | 3 per email | 1h | Email |
| Magic link IP | 3 per IP | 1h | IP |
| Forgot password | 3 per email | 1h | Email |
| Forgot password IP | 5 per IP | 60min | IP |
| Verify email resend | 1 per email | 1min | Email |
| Verify email resend IP | 5 per IP | 60min | IP |

### Shared Helpers (`src/app/api/v1/auth/_helpers.ts`)

All auth routes (login, refresh, magic-link, magic-link/verify, logout, forgot-password,
reset-password, account, verify-email/resend, restore-account) are consolidated onto these
shared helpers:
- `errorResponse(reqId, status, body)` — standardized error envelope (`{ error, meta.requestId }`)
- `successResponse(body)` — 200 envelope; ALWAYS sets `cache-control: no-store` (no option to disable)
- `equalizeNoopTiming()` — jittered 240–400ms timing floor for anti-enumeration branches (no param)
- `isSecure(request?)` — prefers `x-forwarded-proto` (TLS-terminating proxy hardening), falls back to the request URL protocol, then `NODE_ENV=production`
- `buildAuthCookie(rawToken, request?)` — refresh cookie: HttpOnly, SameSite=Strict, `Secure` via `isSecure`
- `buildExpireCookie(request?)` — clears refresh cookie (`Max-Age=0`)
- `buildSessionExpireCookie(request)` — expires the Auth.js session cookie (`authjs.session-token` / `__Secure-` variant) — used by logout (ADR-011)
- `mintAuthJsSessionCookie(request, { userId, accessToken, refreshToken })` — mints the Auth.js session cookie via `next-auth/jwt` `encode`; fail-fast if `AUTH_SECRET` missing (ADR-011)
- `getIp(request)` — client IP: in non-production, trusts only `x-real-ip` (spoofable `x-forwarded-for` ignored); in production, trusts leftmost `x-forwarded-for` (Vercel/ALB), falls back to `x-real-ip`
- `getRefreshToken(request)` — parses refreshToken from cookie
- `getBearerToken(request)` — parses Bearer from Authorization header
- `getBaseUrl()` — AUTH_URL or NEXT_PUBLIC_APP_URL

### Client-Side Token Lifecycle (`src/lib/auth-refresh.ts`, `src/lib/api.ts`)

- **Single-flight refresh** — `refreshAccessTokenOnce()` dedupes concurrent `POST /api/v1/auth/refresh` calls into **one** network request via the module-level `refreshInFlight` promise (tested in `tests/auth-refresh.test.ts`).
- **401 retry — stale-token race fix** — the `authApi` response interceptor on 401 sets `_retry`, awaits the shared `refreshAccessTokenOnce()` (no second refresh), sets `_retry = true` plus the freshly issued `Authorization` header, and retries the original request. The request interceptor honors `_retry` and therefore does **not** re-read the Auth.js session via `getSession()` — re-reading could return the stale pre-refresh token and defeat the retry.
- **Access-token cache** — 60s TTL cache + single-flight session lookup (`resolveAccessToken`) so N parallel `authApi` calls do not fan out to `GET /api/auth/session`.
- **`authStreamFetch` (fix 2026-09-25)** — authenticated fetch for non-JSON responses (SSE streaming) in `src/lib/api.ts`. Reuses the same single-flight refresh flow as `authApi` without duplicating token injection. Key features:
  - Path validation: throws if path doesn't start with `/api/`
  - Sets `Accept: text/event-stream` header for SSE
  - Defensive `headers.set` with fallback to bracket notation for AxiosHeaders/plain object compatibility
  - Single-flight refresh via shared `refreshAccessTokenOnce()`
  - Used by `/meu-arcano` page for AI interpretation streaming (`POST /api/v1/ai/arcana-interpret`)

## Invariants and Gotchas

1. **Two magic link flows exist intentionally** — Auth.js EmailProvider (`/api/auth/callback/email`) and REST (`/api/v1/auth/magic-link`). Do not merge them (ADR-010 §3, S3).
2. **Refresh cookie `Secure` flag** — via `isSecure(request)`: prefers `x-forwarded-proto` (so TLS-terminating proxies do not silently downgrade the `Secure` attribute), falls back to the request URL protocol, then `NODE_ENV=production`. Dev uses HTTP without Secure.
3. **Auth.js session bridge** — login, refresh and magic-link/verify mint an Auth.js session cookie (`mintAuthJsSessionCookie`, fail-fast if `AUTH_SECRET` missing) so dashboard guards recognize credentials/magic-link login; logout expires it via `buildSessionExpireCookie` (ADR-011).
4. **CSRF double-submit on register and login** — `POST /api/v1/auth/register` and `POST /api/v1/auth/login` validate via `validateCsrfToken` (`src/lib/csrf`): cookie `csrf-token` (dev) / `__Host-csrf-token` (prod) must match header `x-csrf-token`; failure → 403 `CSRF_TOKEN_INVALID` before any side effect. The cookie is set **client-side** via `ensureCsrfCookie()` (`src/lib/csrf-client.ts`) from the store's `login()`/`register()` immediately before POST (form mount `useEffect` warm-up removed as redundant) — **not** from Server Components (`cookies().set()` is illegal in RSC on Next.js App Router). Cookie name/token come from the shared `csrfCookieName()`/`generateCsrfToken()` in `src/lib/csrf-cookie-name.ts` (single source for client/server/E2E) and `validateCsrfToken` compares with `timingSafeEqual` on UTF-8 byte buffers (byte-length pre-check, not string `.length`). `httpOnly: false`, `sameSite: strict`, 24h. E2E helpers send `...csrfHeaders()`. Other cookie-using routes (refresh, logout, magic-link/verify) do NOT validate CSRF (Bearer/cookie-only, no state-changing cross-site risk per design §7.1).
5. **`emailVerified` is `DateTime?`** — not boolean. Frontend derives `boolean` as `user.emailVerified !== null` (S12).
6. **Anti-enumeration** — forgot-password, magic-link, register, verify-email/resend return identical responses for existing and non-existing emails; login's user-not-found branch, the register duplicate-email branch, and the account/restore-account no-ops apply the jittered 240–400ms `equalizeNoopTiming()` floor. Since the auth remediation, the timing floor is applied unconditionally (both success and no-op paths) to prevent timing oracles on the success path.
7. **In-memory rate limiter** — not suitable for serverless/edge (documented TODO for Redis-backed replacement).
8. **`tokenVersion` source of truth** — `User.tokenVersion` column in DB. Redis is cache-only (C4).
9. **`rotateRefresh` is transactional** — rotation runs in an interactive `prisma.$transaction`; the conditional `updateMany` revalidates `revokedAt: null` AND `expiresAt > now` atomically (closes the rotation-vs-revocation race); `signAccessToken` runs BEFORE the transaction so a signing failure never commits the rotation.
10. **Production env hard guard in `auth.config.ts`** — at module load, when `NODE_ENV === "production"` **and** `NEXT_PHASE !== "phase-production-build"`, the config throws fast if `AUTH_URL` is missing, or not an https URL **with a well-formed `scheme://authority` origin** (raw-format regex `AUTH_URL_ORIGIN_RE` — the WHATWG parser normalizes malformed inputs like `https:/evil.com` and `https:\\evil.com` into valid-looking hosts, so scheme alone is not enough), or carries **userinfo credentials** (`username`/`password`) or **query/fragment** (which would corrupt concatenated magic-link URLs). The guard also rejects a missing `AUTH_SECRET` (prevents host-header poisoning of magic links and secret-less operation). Error text carries diagnostics only — env presence flags (`AUTH_URL_in_env`/`AUTH_URL_empty`), URL scheme, `VERCEL_ENV` — **never secret values**. The build phase is exempt via `NEXT_PHASE=phase-production-build`. Covered by `tests/auth-config.test.ts` (11 guard cases + 3 provider-contract cases).
11. **No rate limit on `reset-password`** — `src/app/api/v1/auth/reset-password/route.ts` does not use `src/lib/rate-limit.ts` (verified 2026-09-24: no limiter imports, no 429 in its contract, no rate-limit test in `tests/reset-password.test.ts`). Brute-force is mitigated by the single-use 1h `PASSWORD_RESET` token. Rate limiting on the flow lives on **issuance** (`forgot-password`: 3/h per email + 5/h per IP). Do not document a reset-route limiter as implemented.
12. **PII in auth logs** — auth routes mask e-mail identifiers in warning/error logs via `maskEmail()` (`src/app/api/v1/auth/_helpers.ts`, e.g. register/login/restore-account rate-limit and error logs). New auth logs must mask e-mails the same way instead of logging `normalizedEmail` raw.
13. **`events.signIn` enriches Google profile non-destructively** — `src/auth/auth.config.ts` runs an `events.signIn` for `account.provider === "google"` that back-fills `User.name`/`displayName` from `profile.name` and `User.avatar` from `profile.picture` **only when the current field is empty**; it never overwrites user-edited values and skips the `update` entirely when nothing changes. The whole handler is wrapped in `try/catch` and only logs `warn` — a `throw` here would abort session creation *after* authentication already succeeded, so enrichment must never fail a login. **`birthDate` is NOT synced**: Google's `openid email profile` scope does not return it, so `birthDate`/`astrologicalSign`/`mayanKin`/`personalArcana` stay null until the user fills the date in `/perfil/editar`. Pulling it would require the Google People API (`contacts.readonly` + extra consent) — out of MVP scope, needs a new ADR.

14. **Enrichment service validation (fix 2026-09-25)** — `src/services/enrichment-service.ts` valida o perfil do Google com schemas Zod estritos antes de aplicar:
    - `oauthNameSchema`: strip de control chars/zero-width, `trim()`, `min(1).max(120)` — rejeita nomes vazios ou só whitespace.
    - `oauthPictureSchema`: exige `https://` + allowlist de domínios conhecidos (Google, Gravatar, etc.) — rejeita `http://` e domínios desconhecidos.
    - `oauthGoogleProfileSchema`: compose estrito dos dois acima + `email` (email válido) + `sub` (string non-empty).
    - **Invalidation condicional**: `personalArcana` é invalidado (setado `null`) **apenas quando** o nome do Google muda **E** `birthDate` está presente no usuário. Se não há `birthDate`, o arcano não é tocado (não há base para recalcular). Isso evita nulagem espúria em contas OAuth sem data de nascimento.

15. **Drift fixes: naming & edge config (fix 2026-09-25)**:
    - **`_skipSessionLookup` → `_retry`** em `src/lib/api.ts`: o flag no interceptor de resposta (401 retry) foi renomeado para refletir o propósito real — sinaliza "esta request é um retry pós-refresh", não "pular lookup de sessão". O request interceptor continua honrando o flag para **não** re-ler a sessão Auth.js (evitaria o token stale).
    - **"Edge config" drift**: `src/auth/auth.config.ts` tinha `export const config = { runtime: "edge" }` residual de experimentação — removido. O módulo roda em Node.js runtime (necessário para `crypto.subtle`/`jose` e Prisma). O export `authCallbacks` **NÃO é dead code** — é usado por `tests/auth.test.ts` (importa `authCallbacks` para testar o handler `events.signIn` isoladamente). **Manter o export**.

16. **Security headers em `next.config.ts` (fix 2026-09-25)** — headers de resposta adicionados via `async headers()`:
    - `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload` (HSTS)
    - `X-Content-Type-Options: nosniff`
    - `Referrer-Policy: strict-origin-when-cross-origin`
    - **F-04 rate-limit deferred (Low)** — rate limiting de API via middleware/edge não implementado; documentado como pendente de prioridade baixa.
    - **CSP documentado pendente** — Content-Security-Policy não aplicado ainda; requer auditoria de inline scripts/styles (Next.js App Router + shadcn/ui + Framer Motion) antes de enforçar. Documentado em `docs/solutions/patterns/security/` como item futuro.

## Safe Change Checklist for Future AI Work

- [ ] Before changing token-service.ts, read ADR-009 Gate B and ADR-010
- [ ] Before changing rate-limit.ts limits, check `docs/07-security/permissions.md`
- [ ] Before changing Zod schemas, check `docs/04-api/authentication.md` for contract
- [ ] Never delete `docs/plans/*.md` or `docs/solutions/*.md`
- [ ] Run `npm run type-check && npm run lint && npm run test` after changes
- [ ] Update this file if endpoints, functions, or invariants change

## Related Plans and Docs

- Plan: `docs/plans/20260901165326-modulo1-auth-plan.md`
- Spec: `.specs/001-auth/requirements.md`, `.specs/001-auth/design.md`
- ADRs: `docs/decisions/2026-08-12-authjs-v5-adapter-minimo.md` (ADR-010), `docs/decisions/2026-09-11-authjs-session-bridge-login-route.md` (ADR-011)
- API contract: `docs/04-api/authentication.md`
- Feature spec: `docs/06-features/authentication.md`
- Patterns: `docs/solutions/patterns/security/` (4 auth-related patterns)
