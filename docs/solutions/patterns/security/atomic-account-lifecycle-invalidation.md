# Atomic Account Lifecycle Invalidation

> **Category**: security / auth
> **Pattern Type**: Implementation pattern
> **Related**: `src/services/token-service.ts`, `src/app/api/v1/auth/account/route.ts`, `tests/token-service.test.ts`, `tests/account-delete.test.ts`

## Problem / When to Use This

Any operation that must **invalidate all of a user's credentials AND change account state** (soft-delete, logout-all, password reset, future suspension or forced re-auth) must do so in ONE atomic unit. Doing it as three separate awaits — `user.update(...)`, then `bumpTokenVersion()`, then `revokeAllSessions()` — leaves a window where the account is in the new state but old access tokens still validate (the Redis verification path in `verifyAccessToken` checks only `tokenVersion`, so the account stays reachable up to the access-token TTL), and a mid-sequence failure returns a misleading 500 while the account is already half-changed. Reach for this pattern whenever you add a new "kill this user's access" operation to `src/services/token-service.ts`.

## Source of Truth Files

- `src/services/token-service.ts` — `softDeleteAccount` and `revokeAllSessions`: the two implemented instances of the shape
- `src/app/api/v1/auth/account/route.ts` — route wiring: `verifyAccessToken` + ONE service call + anti-enumeration no-op
- `tests/token-service.test.ts` — `describe("token service T15 - softDeleteAccount")` and `describe("token service T7a - revokeAllSessions")`: the `$transaction` mock shape
- `tests/account-delete.test.ts` — route-level tests incl. header-equality and timing-floor assertions

## Current Implementation Snapshot

- `softDeleteAccount(userId)` runs ONE `prisma.$transaction`: `session.updateMany({ where: { userId }, data: { revokedAt: new Date() } })` + `user.update({ where: { id: userId }, data: { isActive: false, deletedAt: new Date(), tokenVersion: { increment: 1 } } })`.
- After commit, the new `tokenVersion` is mirrored to Redis **best-effort** (`auth:tokenVersion:${userId}`, `EX ACCESS_TOKEN_TTL_SECONDS`, try/catch → warn only). DB remains the source of truth.
- `revokeAllSessions(userId)` uses the identical shape (session revoke + single `tokenVersion` increment), minus the `isActive`/`deletedAt` flags.
- The route (`DELETE /api/v1/auth/account`) calls only `verifyAccessToken(bearer)` + `softDeleteAccount(userId)`; the anti-enumeration no-op returns the identical 200 body, `cache-control: no-store` header, and 250ms timing floor.
- The email send (`sendAccountDeletionEmail`) runs AFTER the transaction; its failure is logged and swallowed — the client still gets 200 (deletion already applied).

## Planned / Optional Extensions (If Applicable)

- A future `suspendAccount(userId)` would follow the same shape with `isActive: false` but `deletedAt` untouched (no LGPD window).
- A future "force re-auth on role/plan change" would use the `revokeAllSessions` variant (no state flags).
- These are NOT implemented — do not assume they exist.

## Pattern Overview

Put every credential-invalidating write (session revoke + user state + `tokenVersion` increment) inside a single `prisma.$transaction`, then mirror the fresh `tokenVersion` to Redis after commit as a best-effort, never-fatal step. Routes call exactly one service function; the service owns atomicity, ordering, and the Redis mirror.

## Implementation Steps

### Step 1: Add the service function in `src/services/token-service.ts`

```typescript
export async function softDeleteAccount(userId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.session.updateMany({
      where: { userId },
      data: { revokedAt: new Date() },
    })
    await tx.user.update({
      where: { id: userId },
      data: {
        isActive: false,
        deletedAt: new Date(),
        tokenVersion: { increment: 1 },
      },
    })
  })

  if (redis) {
    try {
      const fresh = await prisma.user.findUnique({
        where: { id: userId },
        select: { tokenVersion: true },
      })
      if (fresh) {
        await redis.set(
          tokenVersionCacheKey(userId),
          String(fresh.tokenVersion),
          "EX",
          ACCESS_TOKEN_TTL_SECONDS,
        )
      }
    } catch {
      logger.warn("[auth:account] falha ao espelhar tokenVersion no Redis")
    }
  }
}
```

Key points:
- **Exactly ONE `tokenVersion: { increment: 1 }`** per operation. Never combine `bumpTokenVersion` + `revokeAllSessions` in one flow — that drifts the version by +2.
- The Redis mirror reads the fresh value AFTER the transaction commits (a `findUnique` outside the tx), so it never reads a rolled-back value.
- Redis mirror is best-effort: wrap in try/catch, log a warning, never throw. `verifyAccessToken` falls back to the DB when Redis is unavailable, so the DB is the arbiter.
- Session revoke uses `updateMany` (all sessions), not `update` (single session).

### Step 2: Wire the route to call ONE service function

[File: `src/app/api/v1/auth/account/route.ts`]

```typescript
const verified = await verifyAccessToken(bearer)   // throws AuthTokenError
userId = verified.userId
// ... body validation ...
const user = await prisma.user.findUnique({
  where: { id: userId },
  select: { email: true },
})
if (user === null || user.email !== email) {
  await equalizeNoopTiming()          // 250ms floor
  return successResponse()            // identical body + cache-control: no-store
}
await softDeleteAccount(userId)       // ONE call — atomicity lives in the service
```

Key points:
- The route must NOT re-implement the transaction. If you find yourself calling `prisma.user.update` + `bumpTokenVersion` + `revokeAllSessions` in a route, you are re-creating the bug this pattern fixes.
- The anti-enumeration no-op must equalize **all three channels**: identical 200 body, `cache-control: no-store` header, and the 250ms timing floor (see `auth-uniform-response-timing-equalization.md`).

### Step 3: Test the transaction shape

[File: `tests/token-service.test.ts`]

```typescript
prismaMock.$transaction.mockImplementation(
  async (cb: (tx: unknown) => unknown) =>
    cb({ session: prismaMock.session, user: prismaMock.user }),
)

await softDeleteAccount("usr_1")

expect(prismaMock.$transaction).toHaveBeenCalledTimes(1)
expect(prismaMock.session.updateMany).toHaveBeenCalledWith(
  expect.objectContaining({
    where: { userId: "usr_1" },
    data: expect.objectContaining({ revokedAt: expect.anything() }),
  }),
)
expect(prismaMock.user.update).toHaveBeenCalledWith(
  expect.objectContaining({
    where: { id: "usr_1" },
    data: {
      isActive: false,
      deletedAt: expect.any(Date),
      tokenVersion: { increment: 1 },
    },
  }),
)
expect(redisMock.set).toHaveBeenCalledWith(
  "auth:tokenVersion:usr_1",
  "6",
  "EX",
  expect.any(Number),
)
```

Key points:
- The `$transaction` mock must pass a fake `tx` object exposing `session` and `user` — otherwise the callback receives `undefined` and the inner calls fail.
- Assert `toHaveBeenCalledTimes(1)` on `$transaction` — this is what proves atomicity (no partial-state window).
- At the route level (`tests/account-delete.test.ts`), also assert the header-equality test: `success.headers.get("cache-control")` equals `mismatch.headers.get("cache-control")` (both `no-store`).

## Complete Example

Adding a hypothetical `suspendAccount(userId)` (planned, not implemented):

```typescript
export async function suspendAccount(userId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.session.updateMany({
      where: { userId },
      data: { revokedAt: new Date() },
    })
    await tx.user.update({
      where: { id: userId },
      data: { isActive: false, tokenVersion: { increment: 1 } }, // no deletedAt
    })
  })
  // ...same best-effort Redis mirror as softDeleteAccount...
}
```

Route: `verifyAccessToken` → check state → `await suspendAccount(userId)` → uniform 200. Same test shape as Step 3.

## Project-Specific Constraints

- [ ] `tokenVersion` source of truth is the `User` column; Redis (`auth:tokenVersion:${userId}`) is only a mirrored cache with TTL = `ACCESS_TOKEN_TTL_SECONDS` (15 min). Never treat Redis as the arbiter.
- [ ] Redis mirror must be best-effort: try/catch + `logger.warn`, never throw. `verifyAccessToken` is fail-closed and falls back to the DB.
- [ ] Exactly one `tokenVersion: { increment: 1 }` per lifecycle operation — a double bump silently invalidates nothing extra but desyncs the version counter.
- [ ] Soft-delete sets `isActive: false` AND `deletedAt: new Date()` together; `verifyAccessToken`'s DB fallback rejects on either flag.
- [ ] Session revocation uses `updateMany({ where: { userId }, data: { revokedAt: new Date() } })` — all sessions, not one.
- [ ] Route anti-enumeration no-op must equalize body + `cache-control: no-store` header + 250ms timing floor (`equalizeNoopTiming`, assert `elapsedMs >= 240` in tests).
- [ ] Post-transaction side effects (e.g. confirmation email) must not change the client response: log and swallow failures, return 200.
- [ ] Tests: mock `$transaction` with `cb({ session: prismaMock.session, user: prismaMock.user })`; assert `$transaction` called exactly once.

## Anti-Patterns (What NOT to Do)

- ❌ Don't run `user.update` → `bumpTokenVersion` → `revokeAllSessions` as three separate awaits in a route — partial state + misleading 500 + tokens valid up to TTL.
- ❌ Don't call `bumpTokenVersion` AND `revokeAllSessions` in the same flow — double increment (+2).
- ❌ Don't put the Redis mirror inside the `$transaction` — Redis is not transactional with Postgres; mirror after commit, best-effort.
- ❌ Don't throw when the Redis mirror fails — the DB is the source of truth; a Redis failure must not roll back a committed soft-delete.
- ❌ Don't return 500 when the post-commit email fails — the deletion is already applied; log and return the uniform 200.
- ❌ Don't let the no-op anti-enumeration path omit `cache-control: no-store` — headers are a third observable channel (body, timing, headers).

## Related Patterns / Docs

- `docs/solutions/patterns/security/soft-delete-gdpr-window.md` — data-model semantics (`deletedAt`/`isActive`/30-day window); this pattern adds the concrete atomic invalidation shape.
- `docs/solutions/patterns/security/auth-uniform-response-timing-equalization.md` — route-layer anti-enumeration (body + timing + headers).
- `docs/04-api/authentication.md` — API contract for the atomic soft delete.

## Safe Change Checklist for Future AI Work

1. Add/modify the lifecycle function in `src/services/token-service.ts` (transaction + Redis mirror).
2. Update the route to call `verifyAccessToken` + the single service function; keep the no-op branch's body/header/timing equalization.
3. Update `tests/token-service.test.ts` (transaction mock, single `$transaction` call, single increment, Redis mirror) and the route test file (header equality, timing floor).
4. Verify: `tsc --noEmit` + run the affected vitest files; confirm no migration is needed (no schema change).