---
title: "Race-Safe Toggle Endpoints (P2002/P2025 Re-Read + Re-Emit) — Project Pattern"
problem_type: pattern
category: backend
components:
  - backend
  - realtime
tags:
  - patterns
  - toggle
  - concurrency
  - prisma-transaction
  - p2002
  - p2025
  - idempotency
  - counters
  - realtime-emit
  - s2-19
module: social (follow / post like / comment like)
date: 2026-10-05
established_in: "Follow toggle T043 (2026-09-28, review fixes K3/I2) generalized by Phase 3 like toggles T076/T081 (2026-10-05, branch sprint2-f2.5): a double-click / timeout-retry never yields 500 — the loser re-reads the source of truth, answers a coherent 2xx, and still publishes the realtime event"
---

# Pattern: Race-Safe Toggle Endpoints (P2002/P2025 Re-Read + Re-Emit)

## Problem / When to Use This

Use whenever you add a **single-endpoint toggle** (`POST` that flips a unique pair row: follow, like, bookmark, gift-claim, save) whose read-then-write shape can be executed twice concurrently (double-click, client retry after a timeout, two tabs). The naive implementation reads `existing`, then creates or deletes inside a `$transaction` — the second request loses with `P2002` (unique violation on create) or `P2025` (row vanished on delete) and bubbles up as `500 INTERNAL_ERROR`, which makes the client retry **again** and invert the winner's state. The project's contract (clarification Q4/SC41, `docs/04-api/social.md` §toggle) is: **a race always ends in a coherent 2xx, never a 500**, and clients that subscribe over WebSocket must still converge on the real value. Three routes already implement it — `follow/[userId]`, `posts/[id]/like`, `comments/[id]/like` — and every new toggle must copy the same shape.

## Source of Truth Files

- `src/app/api/v1/social/follow/[userId]/route.ts` — the original and most complete instance (domain throws `MaxFollowingError`/`TargetUnavailableError` classified in the same catch; `readFollowCounts` re-read; `emitFollowUpdate` in the race branch)
- `src/app/api/v1/social/posts/[id]/like/route.ts` — reference instance for counters + notification dedupe + race re-emit (`emitLikeUpdated` with the fresh `likeCount`)
- `src/app/api/v1/social/comments/[id]/like/route.ts` — minimal instance (same toggle, no Notification/Versos/analytics per T081)
- `src/lib/middleware/rate-limit.ts` — `enforceSocialLimit({ limit: "like" | "comment" | "follow" })` → `rate.headers` must ride on **every** response, including 500s
- `src/jobs/counter-reconcile.ts` — daily backstop for counter drift (invariant I4 / S2-19)
- Tests: `tests/integration/social-follow.test.ts` (3 race cases incl. re-query failure), `tests/integration/social-interactions.test.ts` (post-like + comment-like race cases, `200 não espera o emit`)
- Written contract: `docs/04-api/social.md` (follow item 11, like item 7, comment-like item 5), `docs/03-database/entities.md` §Invariantes de contadores (I4)

## Current Implementation Snapshot

- Canonical order in every toggle route: `enforceCsrf` → `requireAuth` → (Zod body, if any) → `enforceSocialLimit` → lookups/gates (`POST_NOT_FOUND` via the **same** `canViewPost` predicate as GET, `SELF_LIKE` 403, `WHO_CAN_COMMENT` 403) → **one** `prisma.$transaction` → logger → analytics → `void emit*()` post-commit → `respond()`.
- Inside the transaction: `tx.<pair>.findUnique` existence check → delete+`{ decrement: 1 }` or create+`{ increment: 1 }` (counter in the **same** tx, S2-19), plus notification dedupe (`tx.notification.deleteMany({ where: pairEquals })` before `create`), plus `earnVersos(..., tx)` (throws → whole tx rolls back when no `UserProfile`).
- **Result variables (`liked`, `likeCount`, `createdNotification`, `earnedAmount`, `following`, `followingCount`, …) are declared at route scope with `let`, outside the `$transaction` callback** — this is load-bearing: declaring them inside the callback produced a `ReferenceError` on every follow toggle in Phase 1 and 500'd the endpoint.
- Catch block is **nested**: outer `try` → `if (error instanceof Prisma.PrismaClientKnownRequestError && (code === "P2002" || code === "P2025"))` → inner re-read → `respond()`; inner `catch (handlerError)` (re-read itself failed) → logged `"[<route>] falha no handler de erro de corrida"` → `apiError("INTERNAL_ERROR", ..., 500, undefined, rate.headers)` — always JSON with `rate.headers`, never HTML.
- Race branch re-reads **two things**: the pair row (`link != null` → `liked`/`following`) **and** the fresh counter (`post.likeCount`, `readFollowCounts`, `comment.likeCount`), then answers with those values (follow: `201` when `following`, `200` otherwise; likes: `200 { data: { liked, likeCount } }`).
- Race branch **still emits** the realtime event with the fresh value (`emitLikeUpdated`, `emitCommentLikeUpdated`, `emitFollowUpdate`) but **never** re-creates the notification — the tx winner owns it ("a requisição vencedora cuida da notification").
- The handler does not infer which constraint failed: a P2002 could come from the pair row, from `FollowReward`, or from any future unique — the re-read is the only safe classification.
- Tests pin the contract: `corrida P2002 re-ler a fonte de verdade e responde com o estado real` asserts **200 + body + `emitLikeUpdated` called with the fresh count**; `falha na re-query do handler de corrida devolve 500 JSON (I2)`.

## Planned / Optional Extensions (NOT implemented yet)

- A shared `togglePair({ pairWhere, onInsert, onRemove })` helper — today all three routes hand-roll the same ~60 lines; extract only when a **4th** toggle appears, and keep the per-route gates (visibility, self-action, privacy) outside it.
- Client-side consumption of `like-updated`/`comment-like-updated` (the polling fallback `GET /social/polling/likes` exists but no hook reads it yet).

## Pattern Overview

Keep the toggle in **one** `$transaction` with the counter mutation, hoist the response variables to route scope, and treat `P2002`/`P2025` as "somebody else won — ask the database what actually happened": re-read the pair row and the counter, respond with that state (coherent 2xx), and publish the realtime event anyway so other clients converge. Anything that is not a race gets a JSON 500 with `rate.headers`.

## Implementation Steps

### Step 1: Route-scope result variables + shared `respond()`

[File: `src/app/api/v1/social/<entity>/[id]/<toggle>/route.ts`]

```typescript
let liked = false
let likeCount = 0
let createdNotification = null as { id: string; type: string; message: string; data: unknown } | null

const respond = () =>
  Response.json({ data: { liked, likeCount } }, { headers: rate.headers })
const internal = () =>
  apiError("INTERNAL_ERROR", "Erro interno", reqId, 500, undefined, rate.headers)
```

Key points:
- **Never** declare these inside the `$transaction` callback — they are read by the catch block after the tx rolled back (Phase 1 bug: `ReferenceError` → 500 on 100% of follow toggles).
- `respond()` and `internal()` are the only two exits both paths share; `rate.headers` is on both.

### Step 2: Gates before the transaction (uniform errors)

```typescript
const post = await prisma.post.findUnique({ where: { id: postId }, select: { /* viewer-visible fields */ } })
if (!post || !(await canViewPost(post, auth.userId))) {
  return apiError("POST_NOT_FOUND", "Publicacao nao encontrada", reqId, 404, undefined, rate.headers)
}
if (post.authorId === auth.userId) {
  return apiError("SELF_LIKE", "Nao e possivel curtir a propria publicacao", reqId, 403, undefined, rate.headers)
}
```

Key points:
- Visibility must reuse the **same predicate as the GET route** (`canViewPost`) — a write path that 404s on fewer cases than the read path is an existence oracle (Q28/anti-timing).
- Order: CSRF → auth → body → rate limit → gates. Rate limit before lookups keeps a hammered account from probing existence.

### Step 3: One transaction: existence check + mutation + counter (+ notification)

```typescript
const pairWhere = { postId_userId: { postId, userId: auth.userId } }

await prisma.$transaction(async (tx) => {
  const existing = await tx.postLike.findUnique({ where: pairWhere, select: { id: true } })

  if (existing) {
    await tx.postLike.delete({ where: pairWhere })
    const updated = await tx.post.update({
      where: { id: postId },
      data: { likeCount: { decrement: 1 } },
      select: { likeCount: true },
    })
    likeCount = updated.likeCount        // hoisted `let`
    liked = false
    await tx.notification.deleteMany({ where: notifWhere })   // anti-flood
  } else {
    await tx.postLike.create({ data: { postId, userId: auth.userId } })
    const updated = await tx.post.update({
      where: { id: postId },
      data: { likeCount: { increment: 1 } },
      select: { likeCount: true },
    })
    likeCount = updated.likeCount
    liked = true
    await tx.notification.deleteMany({ where: notifWhere })
    createdNotification = await tx.notification.create({ data: { /* ... */ } })
    const earned = await earnVersos(auth.userId, VersosSource.Like, tx)
    if (earned === null) throw new Error("like requires UserProfile")  // rollback, no orphan marker
    earnedAmount = earned
  }
})
```

Key points:
- Existence check **inside** the tx (the outside pre-read, when present, exists only to order gates — e.g. unfollow must never be blocked by `whoCanFollow`).
- Counter `{ increment/decrement }` lives in the **same** tx as the pair row (S2-19/I4); the daily `counter-reconcile` cron is the backstop, not the excuse.
- `earnVersos(...) === null` **throws** — a reward marker must never commit without payment.

### Step 4: Post-commit, fire-and-forget, then respond

```typescript
logger.info({ reqId, userId: auth.userId, postId, liked, likeCount }, "[like] toggle")
trackLike(postId)
if (earnedAmount !== null) trackVersosEarned(VersosSource.Like, earnedAmount)

void emitLikeUpdated({ postId, newCount: likeCount })
if (liked && createdNotification !== null) {
  void emitNotification({ userId: post.authorId, notification: createdNotification })
}
return respond()
```

Key points:
- `void` + `Promise`-swallowing emitters: the 200 must not wait on the bus (pinned by `200 não espera o emit (fire-and-forget)`).

### Step 5: The race branch in the catch

```typescript
} catch (error) {
  try {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      (error.code === "P2002" || error.code === "P2025")
    ) {
      const link = await prisma.postLike.findUnique({
        where: { postId_userId: { postId, userId: auth.userId } },
        select: { id: true },
      })
      const fresh = await prisma.post.findUnique({
        where: { id: postId },
        select: { likeCount: true },
      })
      liked = link != null
      likeCount = fresh?.likeCount ?? 0
      logger.info({ reqId, userId: auth.userId, postId, code: error.code, liked },
        "[like] corrida resolvida pela fonte de verdade")
      void emitLikeUpdated({ postId, newCount: likeCount })   // STILL emit
      return respond()
    }
    logger.error({ err: error, reqId }, "[like] erro interno")
    return internal()
  } catch (handlerError) {
    logger.error({ err: handlerError, reqId }, "[like] falha no handler de erro de corrida")
    return internal()
  }
}
```

Key points:
- **Re-read, never infer**: which unique constraint fired is unknowable (pair row, reward marker, future index) — only the database state matters.
- Re-read **both** the pair row and the counter, then answer with them; the client's next render must be correct, not "close".
- **Still emit** with the fresh count — a client that lost the race would otherwise keep a stale count until the next refetch. Do **not** emit the notification: the winner's tx already persisted it.
- Inner `try/catch` is mandatory: if the re-query throws, return `500` **JSON with `rate.headers`** (a raw throw escapes as an HTML error page).

### Step 6: Pin it with TDD

[Files: `tests/integration/social-follow.test.ts`, `tests/integration/social-interactions.test.ts`]

```typescript
it("corrida P2002 re-ler a fonte de verdade e responde com o estado real", async () => {
  prismaMock.postLike.create.mockRejectedValue(prismaError("P2002"))
  prismaMock.postLike.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: "pl_1" })
  prismaMock.post.findUnique.mockResolvedValueOnce(visiblePost).mockResolvedValueOnce({ likeCount: 6 })

  const res = await callLike("post_1")
  expect(res.status).toBe(200)
  expect((await res.json()).data).toEqual({ liked: true, likeCount: 6 })
  expect(emittersMock.emitLikeUpdated).toHaveBeenCalledWith({ postId: "post_1", newCount: 6 })
})
```

Required cases for every new toggle: (1) P2002 → coherent 2xx with the re-read state **and** the event emitted; (2) P2025 → coherent 2xx for the other direction; (3) re-read failure → 500 JSON **with** `rate.headers`; (4) success path emits once and the response does not await it.

## Complete Example

Adding a bookmark toggle `POST /api/v1/social/posts/[id]/bookmark`:

```typescript
export const dynamic = "force-dynamic"

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const reqId = newReqId()
  const csrfError = enforceCsrf(request, reqId)
  if (csrfError) return csrfError
  const auth = await requireAuth(request, reqId)
  if (auth instanceof Response) return auth
  const { id: postId } = await params
  const rate = await enforceSocialLimit({ limit: "like", userId: auth.userId, reqId })
  if (!rate.allowed) return rate.response

  let bookmarked = false          // route scope — read by the catch
  const respond = () => Response.json({ data: { bookmarked } }, { headers: rate.headers })
  const internal = () => apiError("INTERNAL_ERROR", "Erro interno", reqId, 500, undefined, rate.headers)

  try {
    const post = await prisma.post.findUnique({ where: { id: postId }, select: { id: true, authorId: true, audience: true, isHidden: true, author: { select: POST_DETAIL_AUTHOR_SELECT } } })
    if (!post || !(await canViewPost(post, auth.userId))) {
      return apiError("POST_NOT_FOUND", "Publicacao nao encontrada", reqId, 404, undefined, rate.headers)
    }
    const pairWhere = { postId_userId: { postId, userId: auth.userId } }
    await prisma.$transaction(async (tx) => {
      const existing = await tx.postBookmark.findUnique({ where: pairWhere, select: { id: true } })
      if (existing) { await tx.postBookmark.delete({ where: pairWhere }); bookmarked = false }
      else { await tx.postBookmark.create({ data: { postId, userId: auth.userId } }); bookmarked = true }
    })
    void emitBookmarkUpdated({ postId, bookmarked })     // fire-and-forget
    return respond()
  } catch (error) {
    try {
      if (error instanceof Prisma.PrismaClientKnownRequestError && (error.code === "P2002" || error.code === "P2025")) {
        const link = await prisma.postBookmark.findUnique({ where: { postId_userId: { postId, userId: auth.userId } }, select: { id: true } })
        bookmarked = link != null
        void emitBookmarkUpdated({ postId, bookmarked })  // race still emits
        return respond()
      }
      logger.error({ err: error, reqId }, "[bookmark] erro interno")
      return internal()
    } catch (handlerError) {
      logger.error({ err: handlerError, reqId }, "[bookmark] falha no handler de erro de corrida")
      return internal()
    }
  }
}
```

## Project-Specific Constraints

- [ ] Order is fixed: `enforceCsrf` → `requireAuth` → body/Zod → `enforceSocialLimit` → gates → 1 `$transaction` → logger/analytics → `void emit*()` → respond.
- [ ] Every response (success, 403/404, 500, race) carries `rate.headers`; errors go through `apiError(...)` so the body is JSON, never the framework's HTML page.
- [ ] Result variables are declared at **route scope**; the `$transaction` callback only assigns to them.
- [ ] Counter mutations (`Post.likeCount`, `Post.commentCount`, `Comment.likeCount`) happen in the **same** `$transaction` as the pair row (S2-19); drift is a cron concern (`src/jobs/counter-reconcile.ts`), not an excuse to skip the tx.
- [ ] `earnVersos(..., tx) === null` → `throw` inside the tx (no reward marker without payment); re-follow/re-like must not pay twice (marker/dedupe inside the tx).
- [ ] Race branch: re-read pair row **and** counter, respond 2xx with them, **and** re-emit the realtime event with the fresh value; never emit the `notification` from the race branch.
- [ ] Only `P2002`/`P2025` enter the race branch; everything else → `internal()`; a failing re-read → `internal()` inside the inner catch.
- [ ] 404 gates reuse the read-path predicate (`canViewPost` / `findVisibleProfile`) so write and read leak identical information.
- [ ] Post-commit emits are `void`ed and payload comes from the row created inside the tx (no re-derivation).
- [ ] Each toggle ships with the four test cases listed in Step 6.

## Anti-Patterns (What NOT to Do)

- ❌ Letting `P2002`/`P2025` escape as `500` — the client retries and inverts the winner's state.
- ❌ Guessing which constraint failed (`if (error.meta?.target?.includes("post_likes"))`) — unknowable and wrong the day a second unique exists.
- ❌ Returning 2xx from the race branch with the **pre-race** counter (`likeCount + 1`) instead of re-reading it.
- ❌ Skipping the emit in the race branch — the loser's socket clients keep the stale count.
- ❌ Emitting `notification` from the race branch — the winning tx already created it (duplicate notification).
- ❌ Declaring `liked`/`likeCount`/`createdNotification` inside the `$transaction` callback (hoisting bug → `ReferenceError` → 500 on every request).
- ❌ Dropping the inner `try/catch` — a failed re-read then escapes as an HTML 500 without `rate.headers`.
- ❌ Moving the counter update to "after commit, best effort" — S2-19 requires it inside the tx (reconciliation cron exists for cascade drift only).
- ❌ A second unique-toggle implementation that skips `enforceCsrf` or the rate bucket.

## Related Patterns / Docs

- `docs/04-api/social.md` — follow item 11, like item 7, comment-like item 5 (the written race contract)
- `docs/03-database/entities.md` §Invariantes de contadores (I4) — why the counter is in the tx **and** reconciled by cron
- `docs/solutions/patterns/security/rate-limit-before-user-lookup.md` — sibling ordering rule (cheap gate before observable work)
- `docs/solutions/patterns/backend/r2-head-object-size-precheck.md` — same "gate → validate → mutate → respond" route discipline
- `docs/solutions/patterns/testing/e2e-realtime-harness.md` — how to prove the emitted event reaches a browser

## Safe Change Checklist for Future AI Work

1. New toggle route → copy Step 1–5 from `src/app/api/v1/social/posts/[id]/like/route.ts` (hoisted vars, gates, one tx, race re-read + re-emit, nested catch).
2. Counter touched? → increment/decrement inside the same tx; if a new counter column is added, register it in `src/jobs/counter-reconcile.ts` and `docs/03-database/entities.md` I4.
3. New realtime event → add it to `socket-service` event allowlist (`src/hooks/use-socket.ts` map) and emit it from **both** the success path and the race branch.
4. Tests → add the four race/success cases to `tests/integration/<feature>.test.ts` using the `prismaError("P2002"|"P2025")` helper pattern.
5. Docs → `docs/04-api/<feature>.md` gets the same "corrida P2002/P2025 → re-querida da fonte de verdade → 2xx coerente + emit" line.
6. Verification → `bun run test tests/integration/social-follow.test.ts tests/integration/social-interactions.test.ts` (always via the `test` **script** — it carries `--max-old-space-size=4096`, see `docs/solutions/ci-cd/turbopack-postcss-oom.md`), then `bun run type-check` and `bun run lint`.
