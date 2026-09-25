---
title: "Consume Rate-Limit Quota Before the User Lookup — Project Pattern"
problem_type: pattern
category: security
components:
  - backend
tags:
  - patterns
  - security
  - anti-enumeration
  - rate-limit
  - enumeration-oracle
  - ip-limit
  - auth
module: auth
date: 2026-09-24
established_in: "SPRINT-1 batch 4 (2026-09-24): verify-email/resend recorded its per-email counter only inside the success path and resend/forgot-password had no per-IP limiter — requests for nonexistent emails never consumed quota, so the 429 itself became an account-existence oracle"
---

# Pattern: Consume Rate-Limit Quota Before the User Lookup

## Problem / When to Use This

Any auth endpoint that returns a uniform 200 for "email not registered" (magic-link, forgot-password, verify-email resend, register) **also** returns a 429 when a limiter trips. If the counter is only incremented when the account exists or the action actually happened, then:

- requests against **existing** accounts eventually return 429;
- requests against **non-existing** accounts never do;

and the mere presence of the 429 — plus its `retryAfter` — is a perfect account-existence oracle that completely defeats the uniform body, the `cache-control: no-store` header and the timing floor. This was the real defect in `POST /api/v1/auth/verify-email/resend` before batch 4: `recordVerifyEmailResend()` sat *after* token creation, i.e. only on the success path, so the 1/min per-email limit could only ever fire for real, unverified accounts.

Reach for this whenever you add (or review) a rate-limited endpoint that must not reveal whether an email/account exists — and whenever you add a per-IP dimension on top of a per-email one.

## Source of Truth Files

- `src/app/api/v1/auth/verify-email/resend/route.ts` — canonical fixed ordering (check IP → record IP → check email → record email → lookup)
- `src/app/api/v1/auth/forgot-password/route.ts`, `src/app/api/v1/auth/magic-link/route.ts` — same ordering, same 429 codes
- `src/app/api/v1/auth/register/route.ts` — variant that records *after* the lookup but **unconditionally on both branches** (see constraint #3)
- `src/lib/rate-limit.ts` — in-memory limiters: `is*Limited()` / `record*()` pairs, `resetRateLimiter()` (test-only), env `MAX_PASSWORD_RESET_IP_ATTEMPTS`, `MAX_VERIFY_EMAIL_RESEND_IP_ATTEMPTS`, `MAX_PASSWORD_RESET_PER_EMAIL`
- `src/app/api/v1/auth/_helpers.ts` — `getIp()` (leftmost `x-forwarded-for` hop), `equalizeNoopTiming()`, `errorResponse()`
- Entry points to read first: `verify-email/resend/route.ts`, then `rate-limit.ts`

## Current Implementation Snapshot

- Fixed order in every anti-enumeration auth route, immediately after Zod validation:

```typescript
// 1. IP dimension — anonymous/outer, cheapest, no email needed
const ipLimit = isVerifyEmailResendIpLimited(ip)
if (!ipLimit.allowed) return ip429(ipLimit.retryAfter)      // returns BEFORE any email counter
recordVerifyEmailResendIpAttempt(ip)                        // recorded before the lookup

// 2. Per-email dimension
const resendLimit = isVerifyEmailResendLimited(normalizedEmail)
if (!resendLimit.allowed) return email429(resendLimit.retryAfter)
recordVerifyEmailResend(normalizedEmail)                    // recorded before the lookup

// 3. Lookup LAST — the DB never sees over-quota requests
const user = await prisma.user.findFirst({ where: { email: { equals, mode: "insensitive" } } })
```

- In-code comment that pins the rationale (in `verify-email/resend/route.ts` — do not delete): `// Registra antes do lookup: senao o 429 (so para conta existente/nao verificada) viraria um oraculo de enumeracao — igual magic-link e forgot-password.`
- Both dimensions answer with the **same** error code per route (`AUTH_FORGOT_RATE_LIMIT` for forgot-password email+IP, `AUTH_RATE_LIMITED` for resend email+IP, `AUTH_MAGIC_LINK_RATE_LIMIT` for magic-link email+IP) plus `Retry-After` header — no `AUTH_*_IP_RATE_LIMIT` variant.
- IP limiter is checked **before** the email limiter, and when it trips the email limiter is not even consulted (test asserts `isPasswordResetLimited` not called) — one over-quota IP cannot burn a victim address's per-email quota.
- Store is in-memory per instance; IP comes from the leftmost `x-forwarded-for` hop (trusted only behind the proxy/edge). Known limitation, documented in `docs/07-security/security.md`.

## Pattern Overview

**Quota consumption must be independent of account existence.** Check and *record* every relevant dimension before touching the database, in a fixed outer→inner order (IP → email → lookup), so an attacker cannot distinguish "registered" from "not registered" by whether a 429 ever appears — and so over-quota requests are rejected without a DB round-trip.

## Implementation Steps

### Step 1: Add the limiter pair in `src/lib/rate-limit.ts`

```typescript
const MAX_X_IP_ATTEMPTS = validatedEnvNumber(process.env.MAX_X_IP_ATTEMPTS, 5, "MAX_X_IP_ATTEMPTS")

export function isXLimited(ip: string): RateCheck {
  const now = Date.now()
  const entry = prune(`x:ip:${ip}`, now)
  if (entry && entry.count >= MAX_X_IP_ATTEMPTS) {
    return { allowed: false, retryAfter: Math.max(1, Math.ceil((entry.resetAt - now) / 1000)) }
  }
  return { allowed: true, retryAfter: 0 }
}
export function recordXAttempt(ip: string): void {
  record(`x:ip:${ip}`, Date.now(), WINDOW_MS)
}
```

Key points:
- Always ship `is*` + `record*` as a pair; the route owns the ordering.
- Defaults come from `validatedEnvNumber` (invalid env throws at module load).
- Export nothing else; `resetRateLimiter()` stays test-only.

### Step 2: Wire the fixed order in the route (before any `findFirst`)

File: `src/app/api/v1/auth/<route>/route.ts`

```typescript
const ipLimit = isXIpLimited(ip)
if (!ipLimit.allowed) {
  const res = errorResponse(reqId, 429, {
    error: { code: "AUTH_RATE_LIMITED", message: "…", retryAfter: ipLimit.retryAfter },
  })
  res.headers.set("Retry-After", String(ipLimit.retryAfter))
  return res
}
recordXIpAttempt(ip)

const limit = isXLimited(normalizedEmail)
if (!limit.allowed) { /* same 429 shape, same code */ return res }
recordX(normalizedEmail)          // ← before prisma.user.findFirst, always

const user = await prisma.user.findFirst({ /* … */ })
```

Key points:
- `record*` goes **before** `findFirst`, never inside the success branch, never inside `if (user)` / after a `$transaction`.
- Reuse the route's existing 429 code for **both** dimensions.
- Keep `equalizeNoopTiming()` + uniform 200 on the lookup outcome — this pattern complements, never replaces, `auth-uniform-response-timing-equalization`.

### Step 3: Document the limit

Add rows to `docs/07-security/security.md` (table + bullet per dimension: window, env var, where it is recorded).

### Step 4: Tests that pin the ordering

- Quota consumed on the no-op path:

```typescript
it("registra a tentativa no rate limit mesmo no no-op anti-enumeracao", async () => {
  prismaMock.user.findFirst.mockResolvedValue(null)
  expect((await callPost({ email: "naoexiste@email.com" })).status).toBe(200)
  // sem registro no caminho no-op, o 429 so existiria para contas reais
  const second = await callPost({ email: "naoexiste@email.com" })
  expect(second.status).toBe(429)
})
```

- Rejected before the DB: the 6th IP request asserts `prismaMock.user.findFirst` was called **5 times**, not 6.
- IP short-circuits the email limiter: `expect(rateLimitMock.isPasswordResetLimited).not.toHaveBeenCalled()` and `findFirst` not called.

## Project-Specific Constraints

- [ ] Order is fixed: validate body → IP check → **record IP** → email check → **record email** → `findFirst` → uniform response.
- [ ] `record*` must execute for every request that passed the checks — existing, nonexistent, inactive and LGPD-deleted accounts consume quota identically.
- [ ] One 429 code per route for both dimensions (`AUTH_FORGOT_RATE_LIMIT`, `AUTH_RATE_LIMITED`, `AUTH_MAGIC_LINK_RATE_LIMIT`) + `Retry-After` header + `retryAfter` in the body; do not invent `AUTH_*_IP_RATE_LIMIT`.
- [ ] `register` is the documented variant: it records **after** the lookup but outside the `if/else`, so both branches consume quota — it must never move inside the `if (!existing)` branch.
- [ ] IP comes from `getIp()` (leftmost `x-forwarded-for` hop) — never parse the header yourself.
- [ ] Keep the timing floor + uniform body + `cache-control: no-store` intact: this pattern closes the *429* channel only.
- [ ] Limits table in `docs/07-security/security.md` must be updated in the same change.

## Anti-Patterns (What NOT to Do)

- ❌ Calling `recordX(...)` after `findFirst`, after `$transaction`, or inside the success branch (the exact `verify-email/resend` bug — it makes 429 a "this account exists" signal).
- ❌ Recording only when the email is actually sent / the token actually created.
- ❌ Checking the email dimension first, or recording the email counter when the IP limit already tripped.
- ❌ Returning different codes/bodies for "IP limited" vs "email limited".
- ❌ Skipping the per-IP limiter because "we already have a per-email one" — per-email limits do not stop one IP spraying thousands of addresses.
- ❌ Deleting the `// Registra antes do lookup…` comment — it is the only in-code explanation of a non-obvious security property.
- ❌ Conflating this with the timing floor (`equalizeNoopTiming`) or the uniform 200 body — different channels, all three mandatory.

## Verification (Tests That Pin This Pattern)

| Test | File | What it forbids |
|------|------|-----------------|
| `registra a tentativa no rate limit mesmo no no-op anti-enumeracao` | `tests/verify-email.test.ts` | success-only recording (429 oracle) |
| `aplica limite de 5 por IP por hora e retorna 429 com Retry-After` | `tests/verify-email.test.ts` | recording/looking up over-quota requests |
| `aplica limite por IP e retorna 429 AUTH_FORGOT_RATE_LIMIT sem checar o limite por email` | `tests/forgot-password.test.ts` | email limiter running when IP already tripped |
| `registra a tentativa no rate limit mesmo no no-op anti-enumeracao (anti-spam)` | `tests/forgot-password.test.ts` | no-op branch skipping the counter |
| `permite 5 … bloqueia o 6o` / `expira apos 1h` / `isola por IP` | `tests/rate-limit.test.ts` | window, expiry and key-isolation regressions |

Run: `npx vitest run tests/verify-email.test.ts tests/forgot-password.test.ts tests/rate-limit.test.ts`

## Related Patterns / Docs

- `docs/solutions/patterns/security/auth-uniform-response-timing-equalization.md` — body/timing/header channels; it explicitly declares rate limiting a *separate* mitigation (this doc is that missing half)
- `docs/07-security/security.md` (rate-limit table + per-dimension bullets)
- `docs/04-api/authentication.md` (`POST /auth/verify-email/resend`, forgot-password contracts)
- `docs/solutions/patterns/security/atomic-account-lifecycle-invalidation.md` (LGPD no-op paths this protects)

## Safe Change Checklist for Future AI Work

1. New anti-enumeration endpoint → add `is*`/`record*` pair in `src/lib/rate-limit.ts`.
2. Route: validate body → IP check/record → email check/record → **then** `findFirst`.
3. Reuse one 429 code for both dimensions; set `Retry-After` + `retryAfter`.
4. Tests: no-op-path-records, `findFirst` call-count, IP-short-circuits-email.
5. Sync `docs/07-security/security.md` table + `docs/04-api/<route>.md`; run the three test files above + `npm run type-check && npm run lint`.
