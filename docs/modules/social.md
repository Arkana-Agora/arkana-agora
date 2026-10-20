# Social Module — Backend

> Canonical backend documentation for the social domain (feed, posts, comments, likes, follows, notifications, explore/search, realtime fallback).
> Last updated: 2026-10-19 (branch `sprint2-f3` — multi-agent review fixes C-1/C-2 + R1–R9, all TDD'd).

## Purpose

Owns the entire in-app social network of Arkana Agora: following users, creating posts (text / image / reading share), a personalized 4-tier feed with Redis materialization, likes and comments (1-level nesting) with Versos rewards, in-app notifications with read state, Explore/search discovery, OG images for shared links, and a REST polling fallback for the WebSocket realtime layer. It also owns the social rate-limit buckets, the soft-delete ("tombstone") semantics for comments, and the counter reconciliation job that repairs `likeCount`/`commentCount` drift caused by `ON DELETE CASCADE`.

## Source of Truth Files

| File | Role |
|------|------|
| `src/app/api/v1/social/**/route.ts` | 21 route files / 24 handlers (see API Endpoints) |
| `src/lib/social/limits.ts` | Single house of social rate limits: `SocialLimit` union, `WINDOW_MS`, `FIXED_LIMITS`, `POST_LIMIT_BY_TIER`, atomic Lua sliding-window/fixed-UTC-day check + Prisma fallback + fail-open bypass |
| `src/lib/middleware/rate-limit.ts` | `enforceSocialLimit()` — wraps `checkSocialLimit`, adds `X-RateLimit-*`/`Retry-After` headers and the 429 `RATE_LIMITED` envelope |
| `src/lib/middleware/csrf.ts` | `enforceCsrf()` — double-submit token check for all social write routes |
| `src/lib/validators/social.ts` | Zod schemas: `createPostSchema`, `postImagesPresignSchema`, `createCommentSchema`, `updateCommentSchema` (+ shared `commentContentRefine`), `MAX_CONTENT_BY_TYPE`, `EXT_BY_TYPE` |
| `src/lib/social/comments.ts` | `COMMENT_AUTHOR_SELECT` + `REMOVED_COMMENT_CONTENT = "[removido]"` (soft-delete sentinel — single source) |
| `src/lib/social/post-visibility.ts` | `canViewPost` (uniform 404 predicate, S2-15/Q28), `postIsGated`, `POST_DETAIL_AUTHOR_SELECT`, `toPublicPost` |
| `src/lib/social/privacy.ts` | `canFollow` / `canComment` — `UserProfile.privacy.whoCanFollow` / `whoCanComment`, fail-closed on invalid JSON |
| `src/lib/social/feed-algorithm.ts` | `getFeed` (4-tier ranking S2-5), `encodeFeedCursor`/`decodeFeedCursor` (base64url keyset `(createdAt, id)` + pinned `include`), `FEED_*_LIMIT`, `POST_INCLUDE` |
| `src/lib/feed-cache.ts` | Redis feed materialization (>1000 following, TTL 5min), `refreshFeedCache` |
| `src/lib/social/viewer-likes.ts` | `viewerLikedPostIds` / `viewerLikedCommentIds` — per-request enrichment of `viewerHasLiked` (review R6) |
| `src/lib/social/explore.ts`, `search.ts`, `follow-lists.ts`, `mentions.ts`, `versos.ts`, `gifts.ts`, `post-preview.ts`, `polling-window.ts`, `relative-time.ts` | Explore/search queries, follow lists + `readFollowCounts`, hashtag/mention parsing, Versos earnings, gift catalog (route pending), realtime preview truncation, polling window constants |
| `src/app/api/v1/social/polling/polling-utils.ts` | `guardPolling` (auth → `polling` rate → `since`/`until`), shared polling headers/constants |
| `src/jobs/counter-reconcile.ts` | Daily 04:00 UTC cron repairing `Post.likeCount`/`commentCount` and `Comment.likeCount` via raw SQL (tombstone-aware, parameterized) |
| `src/stores/social-store.ts` | Client-only Zustand overlays: `postLikes`, `commentLikes`, `postComments`, optimistic helpers |
| `socket-service/src/emitters.ts` | Typed realtime emitters (`emitNewPost`, `emitLikeUpdated`, `emitCommentAdded`, `emitCommentLikeUpdated`, `emitFollowUpdate`, `emitNotification`) — imported by routes, fire-and-forget post-commit |
| `prisma/schema.prisma` | `Post`, `Comment`, `PostLike`, `CommentLike`, `PostHashtag`, `Follow`, reward markers, `Gift`, `Notification`, `ContentReport` |

## Current Implementation Snapshot

### API Endpoints (all under `/api/v1/social/`)

| Method | Path | Auth | CSRF | Rate bucket | Description |
|--------|------|------|------|-------------|-------------|
| `POST` | `/follow/:userId` | Bearer | ✅ | `follow` 20/min | Toggle follow (201 following / 200 unfollow); `maxFollowing` under `FOR UPDATE`; Versos +5 first time per pair (`FollowReward`); notification dedupe/anti-flood |
| `POST` | `/posts` | Bearer | ✅ | `post` 10/dia FREE, 50/dia PLUS | Create post (text ≤500 / image ≤300 + ≤4 images / reading ≤200); moderation `checkContent` → 403 `CONTENT_BLOCKED`; `HeadObject` 5MB guard; hashtags → `PostHashtag`; Versos +10 for reading posts |
| `GET` | `/feed` | Bearer | — | — | Personalized feed; Redis cached page served whole (limit applies only to live path); `viewerHasLiked` enriched on both paths |
| `GET` | `/posts/:id` | Bearer | — | — | Post detail + comments preview (10 roots + 10 replies, tombstone + inactive-author filtered); **no `viewerHasLiked` here** |
| `GET` | `/posts/:id/og-image` | **optionalAuth** | — | — | PNG 1200×630; public posts cacheable (`s-maxage=86400`), gated → `private, no-store`, invisible → uniform 404 |
| `POST` | `/posts/images/presign` | Bearer | ✅ | `upload` 20/dia | Presigns ≤4 R2 keys `posts/{userId}/{ts}-{i}.{ext}` (jpeg/png/webp); size checked later at post creation |
| `POST` | `/posts/:id/like` | Bearer | ✅ | `like` 100/min | Toggle like; auto-like → 403 `SELF_LIKE`; `Post.likeCount` in same tx; notification dedupe + removal on unlike; Versos +1 guarded by `PostLikeReward` |
| `POST` | `/posts/:id/comments` | Bearer | ✅ | `comment` 30/min | Create comment/reply (1 level); gates `COMMENTS_DISABLED` / `WHO_CAN_COMMENT`; invalid/tombstoned parent → uniform 422; `commentCount` +1 in same tx; Versos +2 first time per post (`CommentReward`) |
| `GET` | `/posts/:id/comments` | Bearer | — | — | Paginated roots + replies (default 10 / max 50, keyset cursor); `viewerHasLiked` on roots **and** replies |
| `PATCH` | `/comments/:id` | Bearer | ✅ | `comment` 30/min | Edit own comment within 15min → else 403 `COMMENT_EDIT_EXPIRED`; tombstoned → 404 |
| `DELETE` | `/comments/:id` | Bearer | ✅ | `comment` 30/min | Soft delete (content → `[removido]`), race-safe conditional `updateMany`, `commentCount` −1 in same tx; second delete → uniform 404 |
| `POST` | `/comments/:id/like` | Bearer | ✅ | `like` 100/min | Toggle comment like; `Comment.likeCount` in tx; **no** notification/Versos/analytics (T081 spec) |
| `GET` | `/notifications` | Bearer | — | — | Keyset list + filters `isRead`/`unreadOnly` (`unreadOnly` prevails); `unreadCount` always present |
| `PATCH` | `/notifications/:id/read` | Bearer | ✅ | `notification` 60/min | Mark one as read (idempotent; ownership in `where` → uniform 404) |
| `PATCH` | `/notifications/read-all` | Bearer | ✅ | `notification` 60/min | Mark all unread as read → `{ updated: count }` |
| `GET` | `/polling/posts` | Bearer | — | `polling` 60/min | REST fallback: posts from followed users since `since` |
| `GET` | `/polling/likes` | Bearer | — | `polling` 60/min | REST fallback: likes received on own posts (metadata only, RF-SOC-004) |
| `GET` | `/polling/comments` | Bearer | — | `polling` 60/min | REST fallback: comments received on own posts (tombstone + inactive-author filtered) |
| `GET` | `/polling/notifications` | Bearer | — | `polling` 60/min | REST fallback: notifications since `since` + `unreadCount` |

> **Auth note:** there is no global guard — every route calls `requireAuth` (or `optionalAuth` for og-image) explicitly. All 13 write routes run `enforceCsrf` first. There is **no** `GET /social/comments/:id` (hence `comment:{id}` realtime rooms are denied fail-closed) and **no** `DELETE /social/posts/:id` (planned).

### Rate limits (`src/lib/social/limits.ts`)

| Bucket | Limit | Window | Notes |
|--------|-------|--------|-------|
| `post` | FREE 10 / PLUS 50 | fixed UTC day | tier from viewer's `subscriptionTier`; Prisma fallback counts `Post` rows |
| `like` | 100 | sliding minute | shared by post-like and comment-like routes |
| `comment` | 30 | sliding minute | create + edit + delete |
| `follow` | 20 | sliding minute | |
| `gift` | 10 | fixed UTC day | **bucket defined; no route consumes it yet** (POST /gifts = T120, planned); Prisma fallback counts `Gift` rows |
| `upload` | 20 | fixed UTC day | **no backing table** — Redis only; Prisma fallback logs `rate_limiter_bypass` (decision S2-10) |
| `polling` | 60 | sliding minute | **shared window across all 4 polling routes** (key `rl:polling:<userId>`) — covers ~2 tabs of 30s polling with margin |
| `notification` | 60 | sliding minute | **shared window across `:id/read` + `read-all`** (review R7a — these two writes previously had no bucket) |

Mechanics: atomic Lua sorted-set script (prune + count + add + TTL in one round-trip — no check-then-act race, review I3); daily buckets use a **fixed UTC day** (identical to the Prisma fallback window); fail-open when Redis is down/unconfigured with logged `rate_limiter_bypass` (daily `post`/`gift` fall back to Prisma counts first); attempt-vs-row semantics (Redis counts approved attempts, Prisma counts persisted rows — accepted divergence, arch INFO-3). Headers and the 429 body derive from `check.max` via `enforceSocialLimit` — never hardcode limits elsewhere.

### Canonical request order (mutations)

`CSRF → auth → body/Zod → rate limit → business lookups → transaction → response → post-commit fire-and-forget emits`

Rate limiting deliberately runs **before** target/post lookups (anti-oracle pattern). Reads: `auth → query Zod → lookup` (no bucket, except polling which uses `guardPolling`: auth → `polling` rate → `since`/`until`).

### Key entities

- **`Post`** — `type` (text/image/reading), `content`, `imageUrls[]`, `readingId?`, `audience` (public/followers), `likeCount`, `commentCount`, `commentsDisabled`, `isHidden` (moderation). Creation does **not** write counters (defaults 0 — S2-19).
- **`Comment`** — `content` (sentinel `[removido]` = soft-deleted), `parentCommentId?` (max 1 nesting level), `likeCount`. Row is preserved on delete to keep parent/reply links.
- **`PostLike` / `CommentLike`** — unique `(postId|commentId, userId)`; anonymous likes (RF-SOC-004 — no liker lists ever).
- **`Follow`** — unique `(followerId, followingId)`; counts via `readFollowCounts()` (banned/soft-deleted excluded everywhere — SC39).
- **Reward markers** (one per pair, never deleted — farming protection): `PostLikeReward`, `CommentReward`, `FollowReward`. **`CommentLikeReward` is a RESERVED model**: the migration exists but comment-like (T081) intentionally pays no Versos and never populates it.
- **`Notification`** — `type` (`like`/`comment`/`follow`), `message`, `data` (Json), `isRead`; created inside the action's transaction, emitted post-commit.
- **`Gift`** — model + fixed catalog (`src/lib/social/gifts.ts`, 6 items priced in Versos) exist; **send route not implemented** (T120).
- **`PostHashtag`** — lowercase canonical tags written in the post-creation transaction.
- **`ContentReport`** — model exists (polymorphic `targetType`/`targetId`); no report endpoints in this module (admin territory; hard-delete job cleans rows).

### Realtime integration

Routes emit fire-and-forget **after commit** via `socket-service/src/emitters.ts` (zod-validated payloads, never throw): `new-post`, `like-updated`, `comment-added`, `comment-like-updated`, `follow-update`, `notification` (`gift-received` is defined in the event map but has no producer yet). The 4 polling routes are the REST fallback when the WS is down (`guardPolling`, `POLLING_TAKE = 50`, `since` clamped to 24h, optional `until` for backlog drain).

## Business Rules

1. **Uniform 404 anti-enumeration (Q28)** — invisible posts (nonexistent / `isHidden` / banned / soft-deleted / inactive author / gated without follow) always yield the same `POST_NOT_FOUND` 404 via the single `canViewPost` predicate (shared by detail, og-image, comments, like routes). Same for comments (`COMMENT_NOT_FOUND`) and notifications (`NOTIFICATION_NOT_FOUND`).
2. **Invalid parent comment → uniform 422** — replying to a parent that is nonexistent, from another post, itself a reply, **or tombstoned (`[removido]`)** returns the identical 422 `VALIDATION_ERROR` "Comentario pai invalido". A tombstoned parent is invisible in every read; accepting replies would create permanently invisible orphan comments that inflate `commentCount` (the reconcile job would count them).
3. **Soft-delete sentinel is reserved** — `commentContentRefine` (shared by `createCommentSchema` and `updateCommentSchema`) rejects a content that is exactly `[removido]` ("Conteudo reservado") — users cannot fabricate their own removal. Empty/whitespace and >300 chars are also rejected (PT-BR messages).
4. **Race-safe comment DELETE** — inside the transaction, a conditional `tx.comment.updateMany({ where: { id, authorId, content: { not: REMOVED_COMMENT_CONTENT } } })` flips the row; `count === 0` → 404 and **no decrement**. Two concurrent DELETEs decrement exactly once (prevents negative/drifted `commentCount` until the cron).
5. **Counters move in the same transaction** (S2-19) — `commentCount` +1 on create / −1 on delete; `likeCount` ±1 on like toggles. Toggle race handlers (P2002/P2025) never guess which constraint failed: they re-read the source of truth and answer accordingly.
6. **`commentCount` predicate must match the reconcile SQL** — live reads and `runCounterReconcileJob` both count `content <> '[removido]'` (the job uses the parameterized `${REMOVED_COMMENT_CONTENT}` constant, not a hardcoded literal). Changing the tombstone semantics requires changing both in lockstep or the cron will fight the app.
7. **Versos anti-farming via markers** — Like +1, Comment +2, Follow +5 (once per pair via `*Reward` markers, never removed on the reverse action), Reading +10. `earnVersos` returning `null` (no `UserProfile`) **aborts the whole transaction** (K2) so a marker never exists without payment.
8. **`canFollow`/`canComment` are fail-closed** — invalid privacy JSON → denied with distinct reason; follow direction is decided *before* the privacy gate (unfollow/revocation is never blocked by a target who flipped to "nobody", review I1).
9. **Notification anti-flood** — like/follow notifications dedupe the pair (`deleteMany` before `create`) and are removed on the reverse action; comment notifications go to the post author and, for replies, the parent author — never to the commenter; if parent author == post author, only the reply-message notification is sent.
10. **Feed cache hit serves the whole materialized page** — the cached `nextCursor` is the algorithm's pivot (with pinned `include`); re-encoding by the last ranked item duplicated/skipped posts (review C1). `limit` applies only to the live path.
11. **`viewerHasLiked` is enriched per request, never cached** — `toFeedItems()` (feed, cached **and** live paths) and the comments GET (roots + replies) run one batched `IN (...)` query through `viewer-likes.ts`. Baking it into the materialized cache would go stale on every like.
12. **Comment-like race branch skips the emit when the comment vanished** — on P2002/P2025 the handler re-reads; if `fresh == null` (comment deleted concurrently) it still answers with the real state but **does not** call `emitCommentLikeUpdated` (it would publish `postId: ""` for a nonexistent item).
13. **Edit window** — own-comment edit only within 15 minutes of `createdAt` (403 `COMMENT_EDIT_EXPIRED`); soft delete has **no** window.
14. **Image key trust boundary** — post creation validates every `imageUrls` key against `^posts/{userId}/\d+-[0-3]\.(jpg|png|webp)$` and runs `HeadObject` rejecting >5MB — the presigned URL alone is never trusted (S2-12).
15. **Moderation applies to posts only** — `checkContent` blocks post creation (403 + `flaggedWords`); comments are **not** moderated (open decision, documented in `docs/04-api/social.md` §Moderação).

## Invariants and Gotchas

- **Never edit an already-applied migration.** `CommentLikeReward` is a RESERVED model — migration applied, table empty by design; wiring Versos into comment-like is a product decision, not a bug fix.
- **`REMOVED_COMMENT_CONTENT` is a cross-cutting contract.** It must stay consistent across: validator rejection, parent guard, GET comments filters, post-detail preview filter, polling/comments filter, comment-like lookup, race-safe DELETE predicate, and the reconcile SQL. A drift in any one produces "two truths" (comment visible in one surface, hidden in another) or permanent counter drift.
- **Post-detail comments preview does NOT include `viewerHasLiked`** — only the dedicated `GET /posts/:id/comments` (and feed items) enrich it. Client code must not assume the field on the detail payload.
- **Rate-limit order is security-relevant** — moving the `enforceSocialLimit` call after lookups would reintroduce the user-enumeration timing oracle the anti-oracle pattern prevents.
- **Daily windows are fixed UTC days, not rolling 24h** — Redis and the Prisma fallback must agree on the window or limits double under Redis failure.
- **`upload` (and minute buckets) bypass with a logged warn when Redis is unavailable** — accepted per decision S2-10; do not "fix" by returning 503.
- **Realtime emits are post-commit and fire-and-forget** — the HTTP response never waits on the bus; emitters swallow errors. The 201/200 truth is the DB, not the bus.
- **Emitted payload for notification events comes from the created row** (id/type/message/data) — never re-derived after commit (review V5).
- **`tryRefund` ordering (sibling work on this branch, AI module — not social)** — quota refunds are invoked only on failure/abort paths after the error is confirmed, never after success (`src/app/api/v1/ai/_helpers.ts`). Listed here because it shipped on the same review branch; social has no refund concept (rate-limit tokens are consumed at check time, attempt-vs-row).
- **`src/lib/social/pagination.ts` was deleted** (dead code, zero importers) — pagination helpers live in `feed-algorithm.ts` (`encodeFeedCursor`/`decodeFeedCursor`); do not resurrect a second cursor implementation.
- **Cursor contract** — invalid cursor → **empty page, not 422** (client self-heals; feed contract T026). The same base64url `(createdAt, id)` cursor format is reused by comments and notifications.
- **`unreadOnly=true` overrides `isRead`** on `GET /notifications` (stricter alias wins).

## Notification Events

Database `Notification` rows created inside transactions + realtime `notification` events emitted post-commit to room `user:{recipientId}`:

- **`type: "like"`** — user A likes user B's post. Recipient: post author (≠ self). Deleted on unlike; recreated with dedupe on re-like.
- **`type: "comment"`** — user A comments on B's post ("comentou no seu post") or replies to B's comment ("respondeu ao seu comentário"). Recipients: post author and (for replies) parent-comment author; never the commenter; deduped when they are the same person.
- **`type: "follow"`** — user A starts following B ("começou a seguir você"). Recipient: target. Removed on unfollow.

Realtime-only events (no DB row): `new-post`, `like-updated`, `comment-like-updated`, `follow-update`.
Defined-but-unemitted: `gift-received` (awaiting T120).

## External Integrations

- **Cloudflare R2** (`src/lib/r2.ts`) — presigned PUT URLs for post images (`generatePresignedUrl`) and `headObjectSize` (5MB guard at post creation).
- **Redis** (`src/lib/redis.ts`) — rate-limit sorted sets (Lua), feed materialization cache, and the event-bus transport consumed by `socket-service` (publish via emitters).
- **`socket-service`** (separate process, port 3003) — routes import `@socket/src/emitters` (Next.js-only boundary; the Docker image never loads this file).
- **`@vercel/og` + `sharp`** (`src/lib/og-image.ts`) — OG PNG rendering (server-only; sharp primary, vercel/og fallback).
- Local word-list moderation (`src/lib/moderation.ts`) — no external API; zero-width/NFKC normalization before matching.

## Planned / Upcoming Contract (If Applicable)

Explicitly **not implemented** — do not document as done:

- `POST /social/gifts` (T120, Phase 7) — catalog (`gifts.ts`) + `Gift` model + `gift` rate bucket + `gift-received` event already exist; the route and E2E scenario are `test.fixme`.
- `DELETE /social/posts/:id` — `posts/[id]/route.ts` has only `GET` today.
- Push notifications (Sprint 3) — MVP is in-app only.
- `checkContent` for comments — open moderation decision.
- Client consumers for `polling/likes` and `polling/comments` — routes exist, `use-socket.ts` only consumes `posts`/`notifications`.

## Known Limitations / TODOs

- `comment:{id}` realtime rooms are **denied fail-closed** — no `GET /social/comments/:id` exists for `verifyRoomAccess` to validate; comment realtime updates flow via room `post:{postId}`.
- Realtime events emitted while a client is offline have **no catch-up** after reconnect (polling masks most of it).
- `read-all` has no UI button yet; polling fallback can burst up to 50 invalidations/refetches (pending badge unification, T132).
- Upload-limit bypass when Redis is down is intentional (S2-10) — logged, not enforced.
- Attempt-vs-row rate semantics can diverge for actions that fail after the check (accepted; documented in limits.ts).
- `GET /social/notifications` has no dedicated rate bucket (reads unbucketed by rule; only the two writes are covered by `notification`).
- Post images bytes are not revalidated at presign (Content-Length there measures the JSON); the 5MB guard is the `HeadObject` at creation — a large object uploaded and never posted lingers in R2 until lifecycle rules apply.

## Safe Change Checklist for Future AI Work

1. **Changing any limit** → edit `src/lib/social/limits.ts` (`WINDOW_MS` / `FIXED_LIMITS` / `POST_LIMIT_BY_TIER`) **and** `tests/social-limits.test.ts`; never hardcode the number in a route — headers/429 derive from `check.max` via `enforceSocialLimit`. Adding a new bucket = extend the `SocialLimit` union + both records + call sites (mirror how `notification` was added in R7a).
2. **Adding a social mutation route** → follow the canonical order `CSRF → auth → Zod → rate → lookup → tx → emit-after-commit`; pick an existing bucket if the action class matches (like/comment/follow) before inventing one.
3. **Touching comment soft-delete** → change `REMOVED_COMMENT_CONTENT` (single source in `src/lib/social/comments.ts`) and verify **all** tombstone consumers stay in lockstep: validator `commentContentRefine`, parent guard in `posts/[id]/comments`, GET filters, post-detail preview, polling/comments, comment-like lookup, DELETE predicate, and `src/jobs/counter-reconcile.ts`. The `content <> '[removido]'` predicate must remain identical between live reads and reconcile SQL.
4. **Adding `viewerHasLiked` to a new surface** → use `viewerLikedPostIds`/`viewerLikedCommentIds` (one batched query per page) **outside** any cache layer; never persist the flag into the feed materialization.
5. **Changing realtime payloads** → update `RealtimeEventMap` + `realtimeEventSchemas` in `socket-service/src/emitters.ts` together (typed map + zod validation); race/re-read branches must never emit with empty/undefined foreign keys (see comment-like `fresh == null` guard).
6. **Schema changes** → `prisma migrate dev` (generate + apply; never hand-edit applied migrations, never edit the reserved `CommentLikeReward` retroactively); remember `ON DELETE CASCADE` bypasses app code — counters drift and only `counter-reconcile` repairs them, so keep its predicates in sync.
7. **Gates before merge** — `tsc --noEmit` · `eslint .` · `prettier --check .` · `bun run test` · relevant Playwright (`tests/e2e/social-realtime.spec.ts`); then update `docs/04-api/social.md`, `docs/06-features/social.md`, and this file.

## Related Plans and Docs

- Plan: `docs/plans/20260926120000-sprint2-execution-plan.md` (+ `.clarifications.md`) — T026–T089, T120/T147
- Spec: `.specs/007-social/`
- API contract: `docs/04-api/social.md`
- Frontend feature doc: `docs/features/social.md`
- Feature spec: `docs/06-features/social.md`, `docs/06-features/notifications.md`
- Security: `docs/07-security/security.md` (canonical CSRF route list; rate-limit-before-lookup pattern in `docs/solutions/patterns/security/`)
- Database: `docs/03-database/entities.md` (invariant I4 — counter reconciliation)
- Tests: `tests/integration/{social-follow,social-feed,social-explore,social-interactions,polling}.test.ts`, `tests/{social-limits,social-privacy,feed-algorithm,counter-reconcile}.test.ts`, `tests/e2e/social-realtime.spec.ts`
