# Auth Uniform Response with Timing Equalization

> **Category**: security / auth
> **Pattern Type**: Implementation pattern
> **Related**: `.specs/001-auth/design.md`, `docs/04-api/authentication.md`, `src/app/api/v1/auth/verify-email/resend/route.ts`

## Problem

Returning a uniform 200 response body for non-existent accounts is not enough to prevent email enumeration. Response **timing** is a second side-channel: a no-op path that returns in 1–5ms while the real path takes 100ms–1s+ (DB lookups + email send) lets an attacker distinguish "email not registered" from "email registered" purely by measuring latency. This applies to every auth endpoint that must not reveal account existence: magic-link, forgot-password, and verify-email resend.

## Solution

Add a **timing floor** to the no-op branch: before returning the uniform 200, `await equalizeNoopTiming()`, which sleeps for a fixed `NOOP_EQUALIZE_MS = 250`. This is a **floor** ("piso de duração"), not exact equalization — the no-op must never be *faster* than the real path. It is deliberately redundant with the uniform-200 body (belt and suspenders): each mitigation closes a different channel.

## Key Elements

### 1. The Helper (constant + function)

```typescript
const NOOP_EQUALIZE_MS = 250;

async function equalizeNoopTiming(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, NOOP_EQUALIZE_MS));
}
```

**Gotcha:** The constant and helper are duplicated per route file (magic-link, forgot-password, verify-email/resend). Do not extract a shared util yet — the project convention is self-contained route files; a shared module is only justified when a 4th route appears.

### 2. Wiring into the No-Op Branch

```typescript
// No-op branch — account does not exist / inactive / already verified
await equalizeNoopTiming();
return NextResponse.json({ message: SUCCESS_MESSAGE }, { status: 200 });
```

**Gotcha:** The delay must be awaited **before** the return, inside the no-op branch only. Never apply it to the success path (it would slow every legitimate request for no security benefit).

### 3. Testing the Timing Floor

```typescript
const start = Date.now();
const res = await request('/api/v1/auth/verify-email/resend').post({
  email: 'nao-cadastrado@example.com',
});
const elapsedMs = Date.now() - start;

expect(res.status).toBe(200);
expect(elapsedMs).toBeGreaterThanOrEqual(240); // floor 250ms, tolerance for CI jitter
```

**Gotcha:** Assert `>= 240`, not `>= 250` — a hard 250ms assertion is flaky under CI timer resolution. The test must also assert the uniform 200 body, so the timing check can never pass on a non-uniform response.

## When to Use

- Any new auth endpoint that must not reveal whether an email/account exists (magic-link, forgot-password, verify-email resend, and future siblings)
- Any endpoint returning a uniform 200 for "not found" where the real path does meaningful work (DB + email send)
- Reviewing existing auth routes: check that the no-op branch has BOTH a uniform body AND a timing floor

## Related Patterns

- **Soft-Delete with LGPD 30-Day Window**: uniform 200 for deleted accounts (body-level anti-enumeration) — this pattern adds the timing layer
- **ProviderId Normalization Convention**: sibling security/auth pattern in the same directory

## Gotchas

1. **Floor, not exact equalization**: Never describe or implement this as "equalizing" the response time. The design doc explicitly says "piso de duração, não equalização exata" — the no-op must be at least as slow as the real path, not identical.

2. **Belt and suspenders**: The timing floor is redundant with the uniform-200 body by design. Removing either one re-opens an enumeration channel. Both must be present.

3. **Rate limiting is separate**: The 1/min-per-email limit (RNF-AUTH-004) is a distinct mitigation deferred to T27 (Redis rate limiting). Do not conflate it with this pattern or block on it.

4. **Success path untouched**: Only the no-op branch sleeps. Adding the delay to the success path degrades UX without security benefit.

5. **Test tolerance**: Use `>= 240` in assertions. A `>= 250` assertion fails intermittently on CI.

## Sources

- `.specs/001-auth/design.md` (lines 227, 242 — "piso de 250ms no no-op", rate limit deferred to T27)
- `docs/04-api/authentication.md` (lines 300–301, 551 — "delay mínimo de 250ms (equalizeNoopTiming) — piso de duração")
- `docs/plans/20260901165326-modulo1-auth-plan.md` (T9, T11, T30 — implementation history)
- `src/app/api/v1/auth/magic-link/route.ts` (lines 18–22 — first implementation)
- `src/app/api/v1/auth/forgot-password/route.ts` (lines 19–23 — precedent)
- `src/app/api/v1/auth/verify-email/resend/route.ts` (lines 14–18 — latest implementation)
- `tests/verify-email.test.ts` (lines 351–358 — timing floor test, `elapsedMs >= 240`)