# Social Feature — Frontend

> Canonical frontend documentation for the social feature (feed, posts, comments,
> likes, notifications, follow, share).
> Last updated: 2026-10-19 (branch `sprint2-f3` — multi-agent code review fixes, TDD'd).

## Purpose

The social feature turns Arkana Agora into a community: an infinite, cursor-paginated
feed of posts (text / image / reading), post creation with mentions/hashtags/image
upload, likes (posts and comments), one-level nested comments, notifications with an
unread badge, follow/unfollow, and post sharing (copy link, og-image PNG download,
social intents). Realtime is delivered by a shared socket.io singleton
(`useSocket`) with a polling fallback; optimistic UI state lives in a small
**overlay-only** Zustand store (`SocialStore`) layered over React Query v5 server
state. This doc covers the **frontend** contract; the backend API contract lives in
`docs/04-api/social.md` and the product spec in `docs/06-features/social.md`.

## Source of Truth Files

| File | Role |
|------|------|
| `src/app/(app)/feed/page.tsx` | FeedPage — infinite scroll (IntersectionObserver sentinel), pull-to-refresh, "N novos posts" pill (Q27), skeleton/empty/error states, composer launcher |
| `src/app/(app)/post/[id]/error.tsx` | **Only** the error boundary exists — the PostDetailPage itself is **not implemented** (T131 planned); `ShareModal` already links to `/post/:id` |
| `src/hooks/use-feed.ts` | `useFeed(cursor)` (infinite query `["feed", cursor]` + `pendingPosts`/`flushPending`), `useFeedRealtime()` (batched `new-post` → polling flush → pill; `like-updated`/`comment-like-updated` overlay reconciliation), `useCreatePost()`, `useTrending()`, `useExploreSuggestions()`, `useSearch(q)` (q≥2), `emitPendingPost` bus, `PENDING_POSTS_CAP = 50` |
| `src/hooks/use-social.ts` | `useNotifications(cursor)` (infinite, envelope S2-18), `useUnreadCount()` (poll 60s), `useFollowList(username, side, q)` |
| `src/hooks/use-socket.ts` | Realtime singleton: connect with RS256 token (auth as function), rooms `user:`/`feed:` joined server-side at handshake, backoff 1s→30s, 30s polling fallback (`GET /social/polling/{posts,notifications}`) with per-endpoint cursors, `resetRealtimeClient()` for logout |
| `src/stores/social-store.ts` | Zustand **overlay-only** store (no `persist`): `postLikes`, `commentLikes`, `postComments` + `updatePostLike`/`updateCommentLike`/`addCommentToPost`/`clearPostOverlays`/`pruneSyncedComments`/`resetSocialOverlays` |
| `src/stores/auth-store.ts` | Calls `useSocialStore.getState().resetSocialOverlays()` in `logout()` and `deleteAccount()`, alongside `resetRealtimeClient()` |
| `src/components/social/post-card.tsx` | Post card: avatar/name, relative time, linkified content, image grid (R2 keys), reading preview, like/comment/share bar, `commentsDisabled` inert button |
| `src/components/social/comment-section.tsx` | Comments (roots + 1-level replies), composer (≤300 chars), cursor "Carregar mais", per-comment like, `pruneSyncedComments` sync effect, `comment-added` socket refetch |
| `src/components/social/post-composer.tsx` | Create-post modal: tabs Texto/Imagem/Tiragem (500/300/200), `@` mention search (debounce 300ms), `#` hashtag top-10, ≤4 images (JPEG/PNG/WebP ≤5MB) via presign + PUT to R2, audience + `commentsDisabled` |
| `src/components/social/share-modal.tsx` | Share: copy link (`/post/:id`), og-image PNG download (`GET /social/posts/:id/og-image`, optional Bearer), Web Share, X/WhatsApp/Facebook |
| `src/components/social/notifications.tsx` | `NotificationsDropdown` (bell + badge, list, per-item mark-as-read, WS `notification` → invalidate `["notifications"]`) |
| `src/components/social/notifications-provider.tsx` | Global unread-count context (polling fallback + WS), dedup by id (`SEEN_IDS_CAP = 500`) |
| `src/components/social/follow-button.tsx` | Follow toggle: optimistic update of local state + `["profile", username]` cache, revert on error, invalidate on settle; `POST /social/follow/:userId` |
| `src/components/social/followers-modal.tsx` | Followers/following list modal with search + cursor pagination (embeds `FollowButton`) |
| `src/lib/validators/social.ts` | Zod: `createPostSchema`, `createCommentSchema`/`updateCommentSchema` (shared `commentContentRefine` — rejects `[removido]` sentinel), `postImagesPresignSchema`; constants `MAX_CONTENT_BY_TYPE` (500/300/200), `MAX_POST_IMAGES = 4`, `MAX_COMMENT_CONTENT = 300`, `MAX_POST_IMAGE_BYTES = 5MB`, `EXT_BY_TYPE` |
| `src/lib/social/polling-window.ts` | Client/server shared polling constants: `POLLING_DEFAULT_SINCE_MS` (5min), `POLLING_MAX_SINCE_MS` (24h), `POLLING_TAKE` (50) |
| `src/lib/api.ts` | Axios `authApi` — Bearer injection + 401→refresh retry (see `docs/features/authentication.md`) |
| `tests/components/post-card.test.tsx` (19) | Render, linkify/escape, R2 URL resolution, like optimistic/reconcile/rollback, `viewerHasLiked` (R6), overlay precedence, `commentsDisabled` |
| `tests/components/comment-section.test.tsx` (14) | List roots+replies, R6 comment like, create optimistic, prune-on-refetch, cursor paging, reply `parentCommentId`, `comment-added` refetch (R3c), R5 out-of-contract creation/like |
| `tests/components/feed-page.test.tsx` (10) | Skeleton, list+composer bar, empty/error/retry, infinite scroll, pull-to-refresh (suppressed while composer open), pill insert with dedup |
| `tests/components/post-composer.test.tsx`, `tests/components/follow-button.test.tsx` (8), `tests/components/followers-modal.test.tsx` | Composer, follow toggle optimistic/revert, modal search/paging |
| `tests/stores/social-store.test.ts` | Overlay actions, dedup, `clearPostOverlays` (postLikes only), `pruneSyncedComments` (synced-only removal), `resetSocialOverlays`, JSON-serializability |
| `tests/hooks/use-feed.test.tsx`, `tests/hooks/use-feed-realtime.test.tsx` (7), `tests/hooks/use-social.test.tsx` | Feed pages/cursor, create+invalidate+overlay clear, batch/pill/dedup/retry/cursor-min (R1), notifications envelope, follow list |
| `tests/e2e/social-realtime.spec.ts`, `tests/integration/social-*.test.ts` | E2E realtime (post→pill, follow→badge, WS blocked→polling) + backend integration |

## Current Implementation Snapshot

### Routes

| Path | Component | Description |
|------|-----------|-------------|
| `/feed` | `FeedPage` (`src/app/(app)/feed/page.tsx`) | Protected feed — infinite scroll, pill, composer, pull-to-refresh |
| `/post/:id` | **NOT implemented** | Only `error.tsx` exists; `ShareModal` builds this canonical URL (T131 planned) — links currently 404 into the route error boundary |

The social feature has no dedicated `*.routes.ts`; it is consumed from the `(app)`
route group (`/feed`) and embedded in other surfaces (`AppHeader` bell,
`(app)/layout.tsx` provider).

### Component Tree

```
(app)/layout.tsx
└── NotificationsProvider (unread-count context: WS + polling fallback)
    └── AppHeader
        └── NotificationsDropdown (bell + badge + list + mark-as-read)

/app/feed — FeedPage
├── PostComposer (modal — tabs, mentions, hashtags, image presign upload)
├── "N novos posts" pill (pendingPosts / flushPending)
├── PostCard (per post)
│   ├── CommentSection (toggled; roots + 1-level replies + composer + likes)
│   └── ShareModal (modal — link / og-image / Web Share / intents)

FollowersModal (embeds FollowButton) — present, not yet wired to profile pages
```

### State Management

Three layers, strictly separated:

1. **React Query v5 (server state)** — infinite queries `["feed", cursor]`,
   `["comments", postId]`, `["notifications", cursor]`,
   `["follows", username, side, q]`; plain queries `["social", "trending"]`,
   `["social", "suggestions"]`, `["social", "search", q]`,
   `["notifications", "unread-count"]`, `["profile", username]`.
   Mutations parse their responses with Zod **inside `mutationFn`** (see Gotcha 1).
2. **`SocialStore` (optimistic overlays only — Zustand, no persist)** —
   - `postLikes: Record<postId, {liked, likeCount}>`
   - `commentLikes: Record<commentId, {liked, likeCount}>`
   - `postComments: Record<postId, SocialComment[]>` (optimistic new comments)
   - Deliberately holds **no** `feedPosts`, `notifications`, or `unreadCount`.
3. **Component-local state** — `likePending` / `commentLikePending` guards,
   `draft`/`replyTo`, `commentsOpen`/`shareOpen`, feed pull-to-refresh refs.

**Viewer overlay discipline (sprint2-f3, implemented):** renders read
`overlay ?? server`. Because an overlay would mask refetched server truth forever:

- `clearPostOverlays()` clears **only** `postLikes` (never `commentLikes`/
  `postComments`). It is called in `useCreatePost.onSuccess`
  **before** `await invalidateQueries(["feed"])`, so the refetch wins.
- `resetSocialOverlays()` (clears all three maps back to `initialState`) runs on
  **logout** and **account deletion** (`src/stores/auth-store.ts`), next to
  `resetRealtimeClient()` — the next session starts clean.

**Comment optimistic lifecycle:** `createMutation.onSuccess` →
`addCommentToPost(postId, comment)` (dedup by id) + clear draft + invalidate
`["comments", postId]` and `["feed"]`. A `useEffect` in `CommentSection` runs on
query success and computes `syncedIds` from `query.data.pages` (roots **and**
nested `replies`), then calls `pruneSyncedComments(postId, syncedIds)` — removing
**only** the entries the server just returned. Optimistic comments not yet in the
refetch are preserved (no flicker, no race with an in-flight POST).

**Realtime:** `useFeedRealtime()` batches `new-post` events for 300ms and resolves
them with a **single** `GET /social/polling/posts?since=` (no N+1); on failure it
re-enqueues and retries after 3s (R1). `CommentSection` listens to
`comment-added` and invalidates `["comments", postId]` only when
`event.postId === postId`. `like-updated`/`comment-like-updated` reconcile overlay
counts with the server (`liked` untouched — only `likeCount`).

### API Calls (frontend → backend)

| Consumer | HTTP | Endpoint |
|----------|------|----------|
| `useFeed` | GET | `/api/v1/social/feed?cursor=` |
| `useCreatePost` | POST | `/api/v1/social/posts` |
| `PostCard.handleLike` | POST | `/api/v1/social/posts/:id/like` → `{data: {liked, likeCount}}` |
| `CommentSection` query | GET | `/api/v1/social/posts/:id/comments?cursor=` |
| `CommentSection.createMutation` | POST | `/api/v1/social/posts/:id/comments` |
| `CommentSection.likeMutation` | POST | `/api/v1/social/comments/:id/like` |
| `useFeedRealtime` flush | GET | `/api/v1/social/polling/posts?since=&until=` |
| `useSocket` poll fallback | GET | `/api/v1/social/polling/{posts,notifications}?since=&until=` |
| `useTrending` / `useExploreSuggestions` / `useSearch` | GET | `/api/v1/social/explore/trending`, `/explore/suggestions`, `/search?q=` |
| `PostComposer` | GET/POST | `/api/v1/social/explore/hashtags`, `/social/posts/images/presign` (+ PUT to R2) |
| `useNotifications` / `useUnreadCount` | GET | `/api/v1/social/notifications` (`limit=1&unreadOnly=true` for badge) |
| `NotificationsDropdown.markAsRead` | PATCH | `/api/v1/social/notifications/:id/read` |
| `FollowButton` | POST | `/api/v1/social/follow/:userId` |
| `useFollowList` | GET | `/api/v1/users/:username/{followers,following}?q=&cursor=` |
| `ShareModal.handleDownload` | GET | `/api/v1/social/posts/:id/og-image` (optional Bearer) |

All calls go through `authApi` (Bearer + 401-refresh) except `ShareModal`'s
og-image download (plain `fetch` with optional session Bearer) and the R2 PUT
uploads.

### Realtime Events Consumed

| Event | Listener | Effect |
|-------|----------|--------|
| `new-post` | `useFeedRealtime` | Batch 300ms → one polling GET → `emitPendingPost` (dedup, cap 50) → pill |
| `like-updated` | `useFeedRealtime` | `updatePostLike(postId, undefined, newCount)` (count-only reconcile) |
| `comment-like-updated` | `useFeedRealtime` | `updateCommentLike(commentId, undefined, newCount)` |
| `comment-added` | `CommentSection` | `invalidateQueries(["comments", postId])` when `event.postId === postId` |
| `notification` | `NotificationsDropdown` / `NotificationsProvider` | Invalidate `["notifications"]`; increment dedup'd badge |

### `viewerHasLiked` (R6 — implemented)

- Server now sends `viewerHasLiked` on **feed items** and **comments**; the client
  schemas mark it **optional** (polling/trending/create endpoints don't emit it yet).
- `PostCard`: `liked = likeOverlay?.liked ?? post.viewerHasLiked ?? false`
  (overlay wins over server; server wins over `false`).
- `CommentSection.likeOf`: `storeCommentLikes[id] ?? { liked: comment.viewerHasLiked ?? false, likeCount: comment.likeCount }`.
- This **replaced the old client-only `liked` state** that started at `false` and
  desynced on refetch — do not reintroduce a client-only liked flag.

### Tests (sprint2-f3 relevant)

- `tests/stores/social-store.test.ts` — `clearPostOverlays` preserves
  `commentLikes`; `pruneSyncedComments` removes only synced ids / no-match is a
  no-op.
- `tests/components/comment-section.test.tsx` — prune-on-refetch, `comment-added`
  refetch (and non-refetch for other posts), R5 out-of-contract creation (no
  optimism, text preserved) and out-of-contract like (optimism rolled back),
  R6 comment like from server.
- `tests/components/post-card.test.tsx` — R6 `viewerHasLiked`, overlay precedence,
  fallback to `false`.
- `tests/hooks/use-feed.test.tsx` — `useCreatePost` clears overlays before
  invalidating `["feed"]`.
- `tests/components/reading-ai-panel.test.tsx` — R4 rollback on 429 / network
  error / success-keeps-message.

## Invariants and Gotchas

1. **R5 — `.parse` lives in `mutationFn`, NEVER in per-call `onSuccess` (CRITICAL).**
   Under React Query v5, the global `mutation.execute()` wraps `options.onSuccess`
   in try/catch so `options.onError` fires — but **per-call callbacks** (passed to
   `mutate(id, callbacks)` and delivered via `MutationObserver.onMutationUpdate` →
   `#notify` → `notifyManager.batch`) run **outside** that try/catch. A
   `schema.parse` throw inside a per-call `onSuccess` escapes as an unhandled
   error with **no rollback and no toast**. Always parse the response inside
   `mutationFn` and return the parsed data; keep `onSuccess`/`onError` callback
   bodies trivially safe. This is a repo-wide pattern, not local to social.
2. **`overlay ?? server` precedence** — optimistic overlays always win over server
   data at render time. Therefore any full refetch of `["feed"]` must be preceded
   by `clearPostOverlays()` (as `useCreatePost.onSuccess` does) or the stale
   overlay masks the truth forever.
3. **`clearPostOverlays` clears ONLY `postLikes`** — `commentLikes` and
   `postComments` survive it deliberately (comment overlays are pruned per-post by
   `pruneSyncedComments`, not globally). Do not "simplify" it to a full reset.
4. **`resetSocialOverlays` on session end** — `logout()` and `deleteAccount()` in
   `src/stores/auth-store.ts` must keep calling it (next to `resetRealtimeClient()`),
   otherwise the next user inherits the previous user's overlays.
5. **`pruneSyncedComments` removes only server-synced ids** — the naive "clear the
   whole list on refetch" caused optimistic flicker and test failures. Compute
   `syncedIds` from `query.data.pages` including nested `replies` before pruning.
6. **No client-only `liked` state** — liked status derives from
   `overlay ?? viewerHasLiked ?? false` (R6). Reintroducing local liked state
   desyncs on refetch.
7. **`SocialStore` is overlay-only** — never store feed posts, notifications, or
   unread counts there; they belong to React Query (or the notifications context).
   No `persist` middleware — state is ephemeral by design.
8. **Zod parse inside `queryFn`/`mutationFn`** — same escape-hatch logic applies to
   query functions; a malformed envelope must fail the query loudly, not crash a
   callback.
9. **Polling cursors never advance beyond server truth** — `advanceSinceCursor` /
   `pollingCursor` move to the *older* of client send-time and server `serverTime`
   (clock-skew safety); a full page (`>= POLLING_TAKE`) locks `since` and drains
   via `until` before advancing. Failure never advances a cursor and never drops
   a window.
10. **Socket singleton discipline** — one module-level socket with `acquire`/
    `release` refcounting, epoch-guarded connects, and server-side room joins
    (`user:`/`feed:` at handshake; client auto-join is forbidden — anti-spoof).
    `resetRealtimeClient()` tears it down on logout without touching live React
    subscriptions. A missing `NEXT_PUBLIC_WS_URL` in production disables realtime
    loudly (console.error) and relies on the 30s polling fallback.
11. **Batching is mandatory for realtime feed events** — bursts of `new-post` must
    collapse into **one** polling call per 300ms window (revisão Q); never fetch
    per event. Failed batches re-enqueue and retry after 3s (revisão R1) so the
    pill still appears without a new event.
12. **`useSearch` is gated at `q.trim().length >= 2`** — the endpoint 422s below
    that; keep the `enabled` guard.
13. **Comment nesting is 1 level** (RF-SOC-005) — the UI only offers "Responder"
    on roots; `createCommentSchema` accepts `parentCommentId` but the route
    enforces depth. The composer's `MAX_COMMENT_CONTENT` (300) mirrors the
    server; the shared `commentContentRefine` rejects the `[removido]` soft-delete
    sentinel (reserved for the DELETE route).
14. **R4 — AI panel message rollback (`src/components/ai/reading-ai-panel.tsx`,
    fixed in the same review batch):** `handleSendMessage` rolls back the
    optimistic user message (`setMessages(messages)`) on 429, on
    `!res.ok || !res.body`, and in `catch`. **`AbortError` intentionally returns
    without rollback** — `handleNewSession` resets everything and bumps
    `sessionSeqRef`, so a stale in-flight response must not touch state
    (session-id guard). Do not "fix" the AbortError branch.
15. **Image URLs in posts are R2 keys**, not absolute URLs — resolve via
    `getR2PublicUrl()` (`src/lib/r2-public-url.ts`); keys that already are
    `http(s)://` pass through. Presign enforces ≤4 images, JPEG/PNG/WebP, ≤5MB
    (client-side check; server re-validates via `HeadObject`).
16. **Pull-to-refresh is disabled while the composer modal is open** (the modal
    renders inside `<main>`, no portal) — keep the `composerOpen` guard.

## User Flows

1. **Browse feed**: `/feed` → `useFeed()` loads page 1 → scroll to sentinel →
   `fetchNextPage` (cursor) → pull-to-refresh refetches (touch only, ≥60px).
2. **Realtime pill**: other user posts → WS `new-post` → 300ms batch → one
   `GET /social/polling/posts` → "N novos posts" pill → click → `flushPending`
   inserts at top of page 1 with dedup against all loaded pages.
3. **Create post**: open `PostComposer` → pick tab → (images: presign batch + PUT
   to R2) → submit → `POST /social/posts` → `clearPostOverlays()` →
   `invalidateQueries(["feed"])` → new post appears in feed.
4. **Like a post**: heart → optimistic `updatePostLike(id, !liked, ±1)` →
   `POST .../like` → server `{liked, likeCount}` reconciles overlay → on error
   rollback + toast. Other users' likes arrive via `like-updated` (count-only).
5. **Comment**: open `CommentSection` → list loads → type + submit → optimistic
   `addCommentToPost` + draft cleared → POST → invalidate `["comments", postId]`
   (+ `["feed"]` for commentCount) → prune effect removes the synced optimistic
   entry. Another user's comment on the same post arrives via WS `comment-added` →
   refetch of that post's comments only.
6. **Reply**: "Responder" on a root → `replyTo` chip → submit sends
   `parentCommentId` → 1-level reply rendered under the root.
7. **Notifications**: bell → dropdown (list + mark-as-read); WS `notification`
   invalidates badge/list immediately; badge also polls every 60s.
8. **Logout**: `auth-store.logout()` → server revoke + `signOut` →
   `resetRealtimeClient()` + `resetSocialOverlays()` → next session starts clean.

## i18n / Translations

This feature has **no i18n** — user-facing strings are hardcoded pt-BR literals in
the components (e.g. `"Nao foi possivel curtir. Tente novamente."`,
`"Carregar mais"`, `"Comentarios"`). There are no
`public/translations/*`-equivalents for social. Any future i18n pass must touch
`post-card`, `comment-section`, `post-composer`, `share-modal`, `notifications`,
`follow-button`, `followers-modal`, and `feed/page` together.

## Known Limitations / TODOs

- **`/post/:id` page does not exist** — `ShareModal` distributes this canonical
  URL, but only `error.tsx` is implemented (T131 planned). Shared links currently
  land on the route error boundary.
- **`FollowButton`/`FollowersModal` are built and tested but not wired to any
  profile page** (per `docs/06-features/social.md`; no `useToggleFollow` hook —
  the mutation is inline in the component).
- **Polling endpoints `likes`/`comments` have no client consumer** — `use-socket`
  only polls `posts`/`notifications` (open pendency from Phase 3).
- **No WS catch-up**: events emitted while the client was offline are not
  delivered on reconnect (polling windows cover only the `since` window).
- `viewerHasLiked` is optional in `feedPostSchema` because polling/trending/
  create-post endpoints don't emit it yet — feed items from the realtime polling
  path may briefly show `liked=false` until the next full refetch.
- Post **editing/deletion UI** and comment **edit (15min)/delete UI** are not in
  these components (backend routes exist).
- Content moderation (`checkContent` on comments) is a documented backend
  follow-up (`docs/05-ai/moderation.md`).

## Safe Change Checklist for Future AI Work

- [ ] Never move a Zod `.parse` from `mutationFn`/`queryFn` into `onSuccess`/
      `onError` callbacks (Gotcha 1 — React Query v5 per-call callback escape).
- [ ] If you touch feed invalidation, keep `clearPostOverlays()` **before**
      `invalidateQueries(["feed"])` in `useCreatePost.onSuccess`, and keep
      `clearPostOverlays` scoped to `postLikes` only.
- [ ] If you touch `CommentSection` sync, keep `pruneSyncedComments` scoped to
      server-synced ids (compute from `query.data.pages` incl. replies) — a full
      clear reintroduces optimistic flicker.
- [ ] Keep `logout()`/`deleteAccount()` calling `resetSocialOverlays()` +
      `resetRealtimeClient()` together.
- [ ] Do not add client-only liked/followed state that bypasses
      `overlay ?? viewerHasLiked`.
- [ ] Realtime changes: preserve batching (300ms, one GET per window), cursor-min
      advance, re-enqueue-on-failure, and the epoch/refcount singleton discipline
      in `use-socket.ts`.
- [ ] After changes, run:
      `npx vitest run tests/stores/social-store.test.ts tests/components/comment-section.test.tsx tests/components/post-card.test.tsx tests/components/feed-page.test.tsx tests/hooks/use-feed.test.tsx tests/hooks/use-feed-realtime.test.tsx`
- [ ] Run `bun run type-check && bun run lint && bun run test` before completion.
- [ ] Update this file if components, hooks, store actions, or API contracts change.

## Related Plans and Docs

- Backend module doc: `docs/modules/social.md`
- Product spec: `docs/06-features/social.md` (Phase status, algorithm, backend detail)
- API contract: `docs/04-api/social.md`
- Execution plan: `docs/plans/20260926120000-sprint2-execution-plan.md` (T026–T088)
- Spec dir: `.specs/007-social/` (`requirements.md`, `design.md`, `tasks.md`)
- Auth/session reset behavior: `docs/features/authentication.md` (logout/delete cleanup)
- Realtime architecture: ADR-007 (socket-service), polling constants in
  `src/lib/social/polling-window.ts`
