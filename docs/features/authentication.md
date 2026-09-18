# Authentication Feature — Frontend

> Canonical frontend documentation for the authentication feature.
> Last updated: 2026-09-18.

## Purpose

All user-facing authentication flows: login, registration, magic link, password reset,
email verification, and account management. Implements design §1 and §6 of SPEC-001.

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
| `src/components/auth/auth-guard.tsx` | Client-side route protection |
| `src/stores/auth-store.ts` | Zustand auth state (13 actions; generic `AuthResult<TErrorCode>` results) |
| `src/lib/api.ts` | Axios interceptor with auto-refresh |
| `src/lib/validators/auth.ts` | 13 Zod schemas |

## Current Implementation Snapshot

### Pages and Routes

| Route | Component | Protected | Description |
|-------|-----------|-----------|-------------|
| `/login` | LoginForm | No | Email/password login (page sets CSRF cookie `csrf-token`/`__Host-csrf-token`) |
| `/register` | RegisterForm | No | Account registration (page sets CSRF cookie `csrf-token`/`__Host-csrf-token`) |
| `/magic-link` | MagicLinkForm | No | Request magic link |
| `/forgot-password` | ForgotPasswordForm | No | Request password reset |
| `/reset-password` | ResetPasswordForm | No | Reset password (token from URL) |
| `/verify-email` | VerifyEmailPage | No | Email verification + resend |
| `/callback/magic-link` | MagicLinkCallback | No | Redeem magic link token |
| `/dashboard` | DashboardPage | Yes (AuthGuard) | Post-login landing |

### AuthStore (`src/stores/auth-store.ts`)

Zustand store with `persist` middleware (localStorage key: `arkana-auth`).

**State:**
- `user: StoredUser | null` — full User or PartialUser (for unverified emails)
- `isAuthenticated: boolean` — derived from `user != null && user.emailVerified`
- `isLoading: boolean` — true during async auth operations
- `error: string | null` — auto-clears after 5 seconds

**Actions:**
- `login(email, password)` — POST /api/v1/auth/login (reads CSRF cookie from `document.cookie`, sends as `x-csrf-token` header — mirrors `register()`)
- `register(data)` — POST /api/v1/auth/register (reads CSRF cookie from `document.cookie`, sends as `x-csrf-token` header)
- `sendMagicLink(email)` — POST /api/v1/auth/magic-link
- `forgotPassword(email)` — POST /api/v1/auth/forgot-password
- `resetPassword(data)` — POST /api/v1/auth/reset-password
- `verifyEmail(token)` — POST /api/v1/auth/verify-email
- `resendVerifyEmail(email)` — POST /api/v1/auth/verify-email/resend
- `verifyMagicLink(token)` — POST /api/v1/auth/magic-link/verify
- `loginWithGoogle()` — redirect to Auth.js Google OAuth
- `logout()` — POST /api/v1/auth/logout + signOut
- `deleteAccount(email)` — DELETE /api/v1/auth/account
- `refreshSession()` — POST /api/v1/auth/refresh
- `clearError()` — clear error state

**Result typing:** `sendMagicLink`/`forgotPassword`/`resetPassword`/`verifyEmail`/`resendVerifyEmail`/
`verifyMagicLink` return discriminated unions built on the generic `AuthResult<TErrorCode>`
(`{ success: true; message? }` | `{ success: false; code; message; retryAfter? }`) via the shared
`hasMessage()` / `asAuthFailure()` helpers. Every failure branch can carry `retryAfter?` when the
server returns it (429s). `login()`/`register()`/`logout()`/`deleteAccount()` remain void-returning
and set store `error` instead.

### AuthGuard (`src/components/auth/auth-guard.tsx`)

Client-side route protection:
1. Renders skeleton while checking session
2. Calls `refreshSession()` on mount (fail-closed)
3. Redirects to `/login` if not authenticated
4. Supports `requiredRole` prop for RBAC

### Axios Interceptor (`src/lib/api.ts`)

- Request interceptor: attaches `Authorization: Bearer` from Auth.js session
- Response interceptor: on 401, calls `/api/v1/auth/refresh`, retries original request once
- Concurrent 401s coalesced via shared refresh promise

## Invariants and Gotchas

1. **`isAuthenticated` is derived** — never set directly; depends on `user != null && user.emailVerified`
2. **PartialUser for unverified emails** — `login()` stores `{email, emailVerified: false}` on 401 `AUTH_EMAIL_NOT_VERIFIED` (C9)
3. **Error auto-clear** — 5s timer in store; no useEffect
4. **`emailVerified` is boolean in store** — derived from `user.emailVerified !== null` (S12 — DB column is `DateTime?`)
5. **Google OAuth bypasses verify-email** — C12: OAuth users are auto-verified
6. **Refresh uses cookie** — not Bearer; interceptor sends `credentials: "include"`
7. **Logout clears both cookies server-side** — `POST /api/v1/auth/logout` now also expires the Auth.js session cookie (`buildSessionExpireCookie`), not just the refresh cookie; the store's `signOut({ redirect: false })` remains the client-side backstop
8. **Login enforces CSRF (double-submit)** — `POST /api/v1/auth/login` validates via `validateCsrfToken` (`src/lib/csrf`) right after body validation → 403 `CSRF_TOKEN_INVALID` before any side effect (lockout/rate-limit/bcrypt/DB). The `/login` page (`src/app/(auth)/login/page.tsx`) is an async Server Component that sets the CSRF cookie (`csrf-token` dev / `__Host-csrf-token` prod, `httpOnly: false`, `sameSite: strict`, 24h) exactly like the register page; `login()` in the store reads it from `document.cookie` and sends it as `x-csrf-token`. Any direct POST to the login API (tests, scripts) must send `...csrfHeaders()`

## Safe Change Checklist for Future AI Work

- [ ] Before changing auth-store.ts, read design §5 in `.specs/001-auth/design.md`
- [ ] Before changing AuthGuard, read design §1.7
- [ ] Before adding new auth routes, check design §6 route table
- [ ] Run `npm run type-check && npm run lint && npm run test` after changes
- [ ] Update this file if components, routes, or store actions change

## Related Plans and Docs

- Plan: `docs/plans/20260901165326-modulo1-auth-plan.md`
- Spec: `.specs/001-auth/design.md` (§1 UI components, §5 Zustand state, §6 routes)
- Backend module: `docs/modules/auth.md`
- API contract: `docs/04-api/authentication.md`
- Feature overview: `docs/06-features/authentication.md`
