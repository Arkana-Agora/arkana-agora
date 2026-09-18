# Auth Uniform Response with Timing Equalization

> **Category**: security / auth
> **Pattern Type**: Implementation pattern
> **Related**: `.specs/001-auth/design.md`, `docs/04-api/authentication.md`, `src/app/api/v1/auth/verify-email/resend/route.ts`

## Problem

Returning a uniform 200 response body for non-existent accounts is not enough to prevent email enumeration. Response **timing** is a second side-channel: a no-op path that returns in 1–5ms while the real path takes 100ms–1s+ (DB lookups + email send) lets an attacker distinguish "email not registered" from "email registered" purely by measuring latency. This applies to every auth endpoint that must not reveal account existence: magic-link, forgot-password, and verify-email resend.

## Solution

Add a **timing floor** to both success and no-op branches: `await equalizeNoopTiming()`, which sleeps for a jittered 240–400ms (`NOOP_JITTER_MIN_MS = 240`, `NOOP_JITTER_MAX_MS = 400`). This is a **floor** ("piso de duração"), not exact equalization — the paths must never be *faster* than the real work. It is deliberately redundant with the uniform-200 body (belt and suspenders): each mitigation closes a different channel. Since the auth remediation, the floor is applied unconditionally to prevent timing oracles on the success path.

> **Centralized since the auth remediation (2026-09-18):** `equalizeNoopTiming()` and
> `successResponse()` live in `src/app/api/v1/auth/_helpers.ts` and are shared by all auth routes
> (magic-link, forgot-password, verify-email/resend, account, restore-account, login
> user-not-found). The historical per-route duplication described in the gotcha below is gone.

## Key Elements

### 1. The Helper (constant + function)

```typescript
const NOOP_EQUALIZE_MS = 250; // legacy constant — still exported but unused
const NOOP_JITTER_MIN_MS = 240;
const NOOP_JITTER_MAX_MS = 400;

async function equalizeNoopTiming(): Promise<void> {
  const jitter = Math.floor(
    Math.random() * (NOOP_JITTER_MAX_MS - NOOP_JITTER_MIN_MS) +
      NOOP_JITTER_MIN_MS,
  )
  await new Promise((resolve) => setTimeout(resolve, jitter));
}
```

**Gotcha (historical):** The constant and helper were duplicated per route file (magic-link, forgot-password, verify-email/resend, account) until the auth remediation consolidated them into `src/app/api/v1/auth/_helpers.ts` (2026-09-18). Do NOT reintroduce per-route copies — import `equalizeNoopTiming`/`successResponse` from `../_helpers` (or `../../_helpers` for nested routes).

### 2. Wiring into the No-Op Branch

```typescript
// No-op branch — account does not exist / inactive / already verified
await equalizeNoopTiming();
return NextResponse.json({ message: SUCCESS_MESSAGE }, { status: 200 });
```

**Gotcha:** The delay must be awaited **before** the return, on **both** success and no-op branches (unconditional since auth remediation). Previously it was only on the no-op branch, which created a timing oracle on the success path.

### 2.5 Response Headers as a Third Channel (T15)

Returning the same body and timing is still not enough: **response headers are observable too**. The account route (T15) initially set `Cache-Control: no-store` only on the success 200, so a client could distinguish "account exists + email match" from "no-op" purely by the header — defeating the identical-200 contract. Build the 200 through a shared `successResponse()` helper used by BOTH paths (now in `src/app/api/v1/auth/_helpers.ts`):

```typescript
// src/app/api/v1/auth/_helpers.ts — success ALWAYS sets cache-control: no-store
export function successResponse(body: Record<string, unknown>): Response {
  const response = NextResponse.json(body, { status: 200 })
  response.headers.set("cache-control", "no-store")
  return response
}
```

Test both paths for header equality (`tests/account-delete.test.ts`): assert `success.headers.get("cache-control") === mismatch.headers.get("cache-control") === "no-store"` — the header-equality assertion is what catches a future regression.

### 3. Testing the Timing Floor

```typescript
const start = Date.now();
const res = await request('/api/v1/auth/verify-email/resend').post({
  email: 'nao-cadastrado@example.com',
});
const elapsedMs = Date.now() - start;

expect(res.status).toBe(200);
expect(elapsedMs).toBeGreaterThanOrEqual(240); // floor 240ms (jittered 240–400ms), tolerance for CI jitter
```

**Gotcha:** Assert `>= 240`, not `>= 250` — the jittered floor starts at 240ms, and a hard 250ms assertion fails intermittently under CI timer resolution. The test must also assert the uniform 200 body, so the timing check can never pass on a non-uniform response.

## When to Use

- Any new auth endpoint that must not reveal whether an email/account exists (magic-link, forgot-password, verify-email resend, account delete, and future siblings)
- Any endpoint returning a uniform 200 for "not found" where the real path does meaningful work (DB + email send)
- Reviewing existing auth routes: check that both success and no-op branches have a uniform body, a timing floor, AND uniform headers (`cache-control: no-store` on every 200)

## Related Patterns

- **Soft-Delete with LGPD 30-Day Window**: uniform 200 for deleted accounts (body-level anti-enumeration) — this pattern adds the timing layer
- **Atomic Account Lifecycle Invalidation**: single-transaction credential invalidation (`softDeleteAccount`) — the success/no-op paths of the account route that this pattern protects
- **ProviderId Normalization Convention**: sibling security/auth pattern in the same directory

## Gotchas

1. **Floor, not exact equalization**: Never describe or implement this as "equalizing" the response time. The design doc explicitly says "piso de duração, não equalização exata" — the no-op must be at least as slow as the real path, not identical.

2. **Belt and suspenders**: The timing floor is redundant with the uniform-200 body by design. Removing either one re-opens an enumeration channel. Both must be present.

3. **Rate limiting is separate**: The 1/min-per-email limit (RNF-AUTH-004) is a distinct mitigation implemented in T27 (`src/lib/rate-limit.ts`). Do not conflate it with this pattern.

4. **Timing floor applied unconditionally**: Both success and no-op paths sleep via `equalizeNoopTiming()`. Previously only the no-op branch slept, which leaked a timing oracle on the success path. The jitter (240–400ms) makes the floor harder to distinguish from real work latency.

5. **Test tolerance**: Use `>= 240` in assertions. The jittered floor starts at 240ms; a `>= 250` assertion fails intermittently on CI.

6. **Headers are a channel too**: equalize `cache-control: no-store` on every 200 (success AND no-op). A header present only on the success path leaks account state. Use a shared `successResponse()` helper.

7. **Timing floor is a floor**: the jittered 240–400ms is likely *shorter* than the real path (transaction + email). The authenticated caller eliminates the enumeration risk here; tighten only if uniform-timing becomes a hard requirement.

## Sources

- `.specs/001-auth/design.md` (lines 227, 242 — "piso de 250ms no no-op"; rate limit implemented in T27)
- `docs/04-api/authentication.md` (auth route contracts — "delay mínimo de 240–400ms (equalizeNoopTiming) — piso de duração"; T15 section — header equality on 200s)
- `docs/plans/20260901165326-modulo1-auth-plan.md` (T9, T11, T30, T15 — implementation history)
- `src/app/api/v1/auth/_helpers.ts` (central home of `equalizeNoopTiming`/`successResponse` since the 2026-09-18 auth remediation; jittered 240–400ms since the hardening remediation)
- `src/app/api/v1/auth/magic-link/route.ts` (first implementation)
- `src/app/api/v1/auth/forgot-password/route.ts` (precedent)
- `src/app/api/v1/auth/verify-email/resend/route.ts` (precedent)
- `src/app/api/v1/auth/account/route.ts` (T15 — `successResponse()` on both paths)
- `src/app/api/v1/auth/restore-account/route.ts` (T17 — `successResponse()` on both paths)
- `tests/verify-email.test.ts` (lines 351–358 — timing floor test, `elapsedMs >= 240`)
- `tests/account-delete.test.ts` (T15 — timing-floor test + header-equality test)