# Auth Module — Backend

> Canonical backend documentation for the authentication and authorization module.
> Last updated: 2026-09-18.

## Purpose

Implements the complete authentication and authorization system for Arkana Agora:
email/password registration and login, magic link, OAuth (Google), password reset,
email verification, refresh token rotation with reuse detection, and LGPD account lifecycle.

## Source of Truth Files

| File | Role |
|------|------|
| `src/services/token-service.ts` | JWT signing, token rotation, reuse detection, session management |
| `src/app/api/v1/auth/_helpers.ts` | Shared route helpers (error/success envelopes, cookie builders incl. Auth.js session bridge, timing equalization, request parsing) |
| `src/app/api/v1/auth/*/route.ts` | API route handlers (10 endpoints) |
| `src/lib/rate-limit.ts` | In-memory rate limiter with sliding window |
| `src/lib/validators/auth.ts` | 13 Zod schemas for all auth inputs |
| `src/lib/redis.ts` | Redis singleton (tokenVersion cache, optional) |
| `src/auth/auth.config.ts` | Auth.js v5 edge config (Google OAuth + EmailProvider) |
| `src/auth/prisma-adapter.ts` | Minimal Auth.js Prisma adapter |
| `prisma/schema.prisma` | User, Session, VerificationToken models |

## Current Implementation Snapshot

### API Endpoints (all under `/api/v1/auth/`)

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/register` | POST | None + CSRF | Create account with email/password (double-submit: cookie `csrf-token`/`__Host-csrf-token` + header `x-csrf-token`) |
| `/login` | POST | None + CSRF | Authenticate with email/password (double-submit: cookie `csrf-token`/`__Host-csrf-token` + header `x-csrf-token`) |
| `/refresh` | POST | Cookie | Rotate refresh token, issue new access |
| `/logout` | POST | Bearer | Revoke session, clear cookies |
| `/magic-link` | POST | None | Send magic link email |
| `/magic-link/verify` | POST | None | Redeem magic link token |
| `/forgot-password` | POST | None | Send password reset email |
| `/reset-password` | POST | None | Reset password with token |
| `/verify-email` | POST | None | Verify email with token |
| `/verify-email/resend` | POST | None | Resend verification email |
| `/account` | DELETE | Bearer | Soft-delete account (LGPD) |
| `/restore-account` | POST | None | Restore account within 30-day window |

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
| Verify email resend | 1 per email | 1min | Email |

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

## Invariants and Gotchas

1. **Two magic link flows exist intentionally** — Auth.js EmailProvider (`/api/auth/callback/email`) and REST (`/api/v1/auth/magic-link`). Do not merge them (ADR-010 §3, S3).
2. **Refresh cookie `Secure` flag** — via `isSecure(request)`: prefers `x-forwarded-proto` (so TLS-terminating proxies do not silently downgrade the `Secure` attribute), falls back to the request URL protocol, then `NODE_ENV=production`. Dev uses HTTP without Secure.
3. **Auth.js session bridge** — login, refresh and magic-link/verify mint an Auth.js session cookie (`mintAuthJsSessionCookie`, fail-fast if `AUTH_SECRET` missing) so dashboard guards recognize credentials/magic-link login; logout expires it via `buildSessionExpireCookie` (ADR-011).
4. **CSRF double-submit on register and login** — `POST /api/v1/auth/register` and `POST /api/v1/auth/login` validate via `validateCsrfToken` (`src/lib/csrf`): cookie `csrf-token` (dev) / `__Host-csrf-token` (prod) must match header `x-csrf-token`; failure → 403 `CSRF_TOKEN_INVALID` before any side effect. The cookie is set by the `(auth)` pages (`login/page.tsx`, `register/page.tsx` — async Server Components, `httpOnly: false`, `sameSite: strict`, 24h). The store's `login()`/`register()` read it from `document.cookie`; E2E helpers send `...csrfHeaders()`. Other cookie-using routes (refresh, logout, magic-link/verify) do NOT validate CSRF (Bearer/cookie-only, no state-changing cross-site risk per design §7.1).
5. **`emailVerified` is `DateTime?`** — not boolean. Frontend derives `boolean` as `user.emailVerified !== null` (S12).
6. **Anti-enumeration** — forgot-password, magic-link, register, verify-email/resend return identical responses for existing and non-existing emails; login's user-not-found branch and the account/restore-account no-ops apply the jittered 240–400ms `equalizeNoopTiming()` floor. Since the auth remediation, the timing floor is applied unconditionally (both success and no-op paths) to prevent timing oracles on the success path.
7. **In-memory rate limiter** — not suitable for serverless/edge (documented TODO for Redis-backed replacement).
8. **`tokenVersion` source of truth** — `User.tokenVersion` column in DB. Redis is cache-only (C4).
9. **`rotateRefresh` is transactional** — rotation runs in an interactive `prisma.$transaction`; the conditional `updateMany` revalidates `revokedAt: null` AND `expiresAt > now` atomically (closes the rotation-vs-revocation race); `signAccessToken` runs BEFORE the transaction so a signing failure never commits the rotation.

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
