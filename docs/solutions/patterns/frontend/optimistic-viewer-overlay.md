---
title: "Optimistic Viewer Overlay on the Shared Feed Cache — Project Pattern"
problem_type: pattern
category: frontend
components:
  - frontend
tags:
  - patterns
  - optimistic-update
  - zustand
  - react-query
  - rollback
  - reconcile
  - viewer-state
  - social
  - feed
module: social feed (post likes, comments)
date: 2026-10-05
established_in: "Phase 3 T076/T085 (2026-10-05, branch sprint2-f2.5): PostCard like + CommentSection create/like were wired with a Zustand overlay in `src/stores/social-store.ts` instead of mutating the `useFeed` React Query cache — 3 post-card tests + 5 social-store tests pin it"
---

# Pattern: Optimistic Viewer Overlay on the Shared Feed Cache

## Problem / When to Use This

Use when a **viewer-specific** piece of state (did *I* like this post? which comments did *I* just add?) must render optimistically over rows that come from a **shared, refetched** cache. Two facts make the obvious approach wrong here: (1) `feedPostSchema` in `src/hooks/use-feed.ts` carries `likeCount`/`commentCount` but **no per-viewer `liked` flag** (`currentUserActions` is a documented aspirational contract, absent from `src/`), so the feed cache alone can never render "liked by me"; (2) the same cache is invalidated by other flows (`invalidateQueries({ queryKey: ["feed"] })` after a comment is created) and refreshed by realtime/polling — `setQueryData` on it for viewer state gets clobbered. The pattern is: keep the shared cache as **server truth for counters**, keep the viewer's own state in a **small Zustand overlay keyed by entity id**, layer it at render time, reconcile it from the parsed server response, and roll it back to a pre-write snapshot plus a toast on error.

## Source of Truth Files

- `src/stores/social-store.ts` — `postLikes: Record<postId, PostLikeOverlay>` + `updatePostLike`, `postComments: Record<postId, SocialComment[]>` + `addCommentToPost` (dedup by id); **no `persist`** — session-ephemeral by contract
- `src/components/social/post-card.tsx` — `handleLike()`: in-flight guard → optimistic write → POST → `likeResponseSchema.parse` → reconcile → rollback + `toast.error`
- `src/components/social/comment-section.tsx` — React Query `["comments", postId]` as list truth; store overlay merged by id; `onSuccess` → `invalidateQueries(["comments", postId])` + `["feed"]`; comment-like in component-local `likes` with `onError` rollback
- `src/hooks/use-feed.ts` — `feedPostSchema` (no viewer field), `feedKey`/`["feed"]` cache ownership
- Tests: `tests/components/post-card.test.tsx` (`curtir otimiza no SocialStore e reconcilia com o servidor`, `falha no like reverte o overlay e mostra toast`, `descurte quando já havia sido curtido neste ciclo`), `tests/stores/social-store.test.ts` (overlay write, dedup, JSON-serializable snapshot), `tests/components/comment-section.test.tsx` (store write + reconcile + cursor paging)
- Written contract: `docs/06-features/social.md` (PostCard overlay note), `docs/04-api/social.md` (T076 UI note: overlay in `useSocialStore.postLikes`, rollback on error)

## Current Implementation Snapshot

- Overlay shape: `{ liked: boolean, likeCount: number }` per `postId`; setter `updatePostLike(postId, liked, likeCount)` replaces the whole entry (no partial merge — simpler rollback).
- Render-time layering in `PostCard`:
  `const likeOverlay = useSocialStore((s) => s.postLikes[post.id])` → `liked = likeOverlay?.liked ?? false`, `likeCount = likeOverlay?.likeCount ?? post.likeCount` — server value is the **fallback when there is no overlay**; once the viewer interacts, the overlay is authoritative for the session (nothing resets it today).
- `handleLike()` captures `const previous = { liked, likeCount }` **before** the optimistic write, guards re-entry with `likePending`, writes the flipped state, POSTs `/social/posts/${id}/like`, then `likeResponseSchema.parse(res.data).data` → `updatePostLike(...)` (reconcile); `catch` → `updatePostLike(post.id, previous.liked, previous.likeCount)` + `toast.error("Nao foi possivel curtir. Tente novamente.")`; `finally` clears `likePending`.
- Server truth is always re-derived from the **response body**, never from the optimistic guess (`{ data: { liked, likeCount } }`, zod-parsed).
- Comment creation: `useMutation` `onSuccess` → `addCommentToPost(postId, comment)` (store, dedup by `id`) → clear draft → `invalidateQueries({ queryKey: ["comments", postId] })` + `["feed"]`. `CommentSection` merges: store roots not present in the query pages first, then query roots (`roots = [...storeRoots.filter(not in queryIds), ...queryRoots]`), same for `repliesFor()`.
- Comment likes use the same discipline in **component-local** state: `handleLike` computes `optimistic`, `setLikes(...)`, then `likeMutation.mutate(commentId, { onError: (_e, id) => setLikes(prev => ({ ...prev, [id]: current })) })`, and `onSuccess` overwrites with the server's `{ liked, likeCount }`.
- Store invariants: JSON-serializable only (test round-trips through `JSON.parse(JSON.stringify(...))`), no `Date`/functions, no `feedPosts` key (the feed list belongs to `useFeed` — `addPostToFeed` only delegates to the pending-posts queue via `emitPendingPost`).
- UI contract: liked state is exposed as `aria-pressed` and the count is inside the accessible name (`aria-label={`Curtir, ${likeCount} curtidas`}`), so tests assert a single regex on the button name.

## Planned / Optional Extensions (NOT implemented yet)

- Seeding/clearing the overlay from the feed payload if the API ever emits `currentUserActions.liked` per viewer (today it does not — see `docs/04-api/social.md` §feed item noting the aspirational contract).
- Consuming the `like-updated` / `comment-like-updated` realtime events to refresh `post.likeCount` in the feed cache; note that once that lands, the overlay's `likeCount` will win over a newer server count for other users' likes — either re-reconcile the overlay from the event or scope the overlay to `liked` only and read the count from the cache.

## Pattern Overview

Split state by ownership: the React Query cache holds **shared server truth** (counters, lists) and is free to refetch/invalidate; a **small id-keyed Zustand overlay** holds the viewer's own flags, is written optimistically, reconciled from the parsed response, and rolled back from a captured snapshot on error. The component renders `overlay ?? server`.

## Implementation Steps

### Step 1: Add the overlay slice to the social store (no persistence)

[File: `src/stores/social-store.ts`]

```typescript
export interface PostLikeOverlay {
  liked: boolean
  likeCount: number
}

interface SocialState {
  unreadCount: number
  notifications: SocialNotification[]
  /** Overlay por postId — o feed em si é dos hooks useFeed (NÃO feedPosts). */
  postLikes: Record<string, PostLikeOverlay>
  postComments: Record<string, SocialComment[]>
}

updatePostLike: (postId, liked, likeCount) =>
  set((state) => ({
    postLikes: { ...state.postLikes, [postId]: { liked, likeCount } },
  })),
```

Key points:
- **No `persist` middleware** — overlays are session-ephemeral; a persisted `liked: true` for a post the user later unliked from another tab is a lie that survives logout.
- Keep entries JSON-serializable (`tests/stores/social-store.test.ts` round-trips them).
- Never put the feed list in this store — `useFeed` owns `["feed", cursor]`; the store comment says exactly that.

### Step 2: Layer at render time with the server value as fallback

[File: `src/components/social/post-card.tsx`]

```typescript
const likeOverlay = useSocialStore((state) => state.postLikes[post.id])
const updatePostLike = useSocialStore((state) => state.updatePostLike)

const liked = likeOverlay?.liked ?? false
const likeCount = likeOverlay?.likeCount ?? post.likeCount
```

Key points:
- Selector must be per-id (`s.postLikes[post.id]`) — subscribing to the whole map re-renders every card on any like.
- Fallback chain is the whole point: first paint (no overlay) = server truth; after interaction = overlay.

### Step 3: Optimistic write → POST → reconcile → rollback

[File: `src/components/social/post-card.tsx`]

```typescript
const [likePending, setLikePending] = useState(false)

async function handleLike() {
  if (likePending) return
  const previous = { liked, likeCount }          // snapshot BEFORE writing
  setLikePending(true)
  updatePostLike(post.id, !liked, liked ? likeCount - 1 : likeCount + 1)   // optimistic
  try {
    const res = await authApi.post(`/social/posts/${post.id}/like`)
    const data = likeResponseSchema.parse(res.data).data
    updatePostLike(post.id, data.liked, data.likeCount)                    // reconcile
  } catch {
    updatePostLike(post.id, previous.liked, previous.likeCount)            // rollback
    toast.error("Nao foi possivel curtir. Tente novamente.")
  } finally {
    setLikePending(false)
  }
}
```

Key points:
- Snapshot the **previous** overlay entry, not `post.likeCount` — otherwise you roll back to a stale server value when the overlay already differed.
- Reconcile from the **zod-parsed response**; the response is the source of truth for both `liked` and `likeCount` (the server may answer `liked: true, likeCount: 6` when a concurrent request already incremented).
- `likePending` blocks double-click from firing two toggles (the server would just toggle back).
- `finally` must always release the guard; error UI is a `sonner` `toast.error`, no inline error state on the card.

### Step 4: Merge overlay lists with the query cache (dedup by id)

[File: `src/components/social/comment-section.tsx`]

```typescript
const queryRoots = (query.data?.pages ?? []).flatMap((page) => page.comments)
const storeRoots = storeComments.filter((c) => !c.parentCommentId)
const queryRootIds = new Set(queryRoots.map((c) => c.id))
const roots = [...storeRoots.filter((c) => !queryRootIds.has(c.id)), ...queryRoots]
```

- On create success: `addCommentToPost(postId, comment)` → `invalidateQueries({ queryKey: ["comments", postId] })` → `invalidateQueries({ queryKey: ["feed"] })`.
- `addCommentToPost` itself no-ops when `list.some((item) => item.id === comment.id)` — refetch landing twice can't duplicate rows.

Key points:
- Store rows are **extras**: query rows win when ids collide, so a refetched (possibly edited/trimmed) version replaces the optimistic one.
- Invalidation is what eventually folds the optimistic row into the server list; the overlay is the bridge across the refetch gap.

### Step 5: Component-local variant for view-scoped state

[File: `src/components/social/comment-section.tsx`]

```typescript
function handleLike(comment: SocialComment) {
  const current = likeOf(comment)                                   // overlay ?? comment.likeCount
  const optimistic = { liked: !current.liked,
    likeCount: current.liked ? current.likeCount - 1 : current.likeCount + 1 }
  setLikes((prev) => ({ ...prev, [comment.id]: optimistic }))
  likeMutation.mutate(comment.id, {
    onError: (_error, commentId) => setLikes((prev) => ({ ...prev, [commentId]: current })),
  })
}
```

Key points:
- Same three moves (optimistic → server reconcile in `onSuccess` → rollback in `onError`), just scoped to component state because only this section renders comment likes.
- Use the mutation's per-call `onError` callback (it receives the variables) instead of a separate try/catch.

### Step 6: Pin it with tests

- `tests/components/post-card.test.tsx` — assert the **optimistic** state synchronously after the click (`Curtir, 4 curtidas` + `aria-pressed=true` + store entry), then rollback on rejection (store entry back to `{ liked: false, likeCount: 3 }` + `toast.error`), then two sequential toggles reconciling from the response.
- `tests/stores/social-store.test.ts` — overlay write/overwrite per id, `addCommentToPost` dedup, JSON-serializability.
- `tests/components/comment-section.test.tsx` — comment appears immediately (store) + input cleared; like reconciles count from the response.

## Complete Example

New "bookmark" affordance on the card, following the same five steps:

```typescript
// 1) src/stores/social-store.ts
postBookmarks: Record<string, boolean>
setPostBookmark: (postId: string, bookmarked: boolean) =>
  set((s) => ({ postBookmarks: { ...s.postBookmarks, [postId]: bookmarked } })),

// 2) post-card.tsx
const bookmarked = useSocialStore((s) => s.postBookmarks[post.id]) ?? false

// 3) handleBookmark()
const previous = bookmarked
setPostBookmark(post.id, !bookmarked)                     // optimistic
try {
  const res = await authApi.post(`/social/posts/${post.id}/bookmark`)
  setPostBookmark(post.id, bookmarkResponseSchema.parse(res.data).data.bookmarked)  // reconcile
} catch {
  setPostBookmark(post.id, previous)                       // rollback
  toast.error("Nao foi possivel salvar. Tente novamente.")
}
```

## Project-Specific Constraints

- [ ] The feed/list cache (`["feed", cursor]`, `["comments", postId]`) is mutated only through React Query APIs (`invalidateQueries`, `setQueryData` for **server** rows) — viewer flags never go in it.
- [ ] Overlay lives in `src/stores/social-store.ts`, keyed by entity id, JSON-serializable, **without** `persist`.
- [ ] Render fallback chain is always `overlay ?? server`; the server value must remain reachable (don't default to the optimistic value).
- [ ] Optimistic write is followed by reconcile from the **parsed** response (`z.object({ data: ... })`), and rollback restores a snapshot captured **before** the optimistic write.
- [ ] Every optimistic mutation has an in-flight guard (`likePending` / `createMutation.isPending`) and a user-visible failure signal (`toast.error` from `sonner`).
- [ ] Overlay writes go through store actions (`updatePostLike`, `addCommentToPost`) — never `useSocialStore.setState` from components except for the documented `notifications` mirror.
- [ ] List merge dedups by `id` (query rows win) so a refetch cannot double-render or resurrect an optimistic row.
- [ ] New viewer flags must also be reflected in the accessible name/`aria-pressed` (tests and E2E address buttons by name).
- [ ] Tests cover the three states: optimistic (pre-response), reconciled (server response), rolled back (rejected response).

## Anti-Patterns (What NOT to Do)

- ❌ `queryClient.setQueryData(["feed", ...], …)` to flip `liked`/count — the cache is refetched and invalidated by other flows, and its rows carry no viewer dimension.
- ❌ Deriving the optimistic count from the server value captured **after** the write (no snapshot → wrong rollback).
- ❌ Treating the optimistic guess as final — always overwrite with the response body (the server's count may differ from `±1`).
- ❌ Putting non-JSON values (`Date`, functions) in the store, or adding `persist` to `useSocialStore`.
- ❌ A `useEffect` fetch to keep the overlay warm — the overlay is written only by user actions.
- ❌ Storing the whole feed in the social store (`feedPosts`) — `addPostToFeed` exists only to delegate to `emitPendingPost`; `useFeed` owns the list.
- ❌ Skipping rollback on error (leaving a heart filled for a like the server rejected) or showing the failure without a toast.
- ❌ Re-firing the request while one is in flight (double-click → server toggles twice → state inverts).

## Related Patterns / Docs

- `docs/06-features/social.md` — PostCard overlay + rollback note (written contract)
- `docs/04-api/social.md` §T076 — UI wiring note and the `currentUserActions` divergence (why the client keeps its own viewer state)
- `docs/solutions/patterns/backend/race-safe-toggle-re-read.md` — the server half: what the reconciling response actually contains
- `src/components/social/follow-button.tsx` — contrast case: a **single-entity** cache (`["profile", username]`) where TanStack `onMutate`/`onError`/`onSettled` optimistic mutation *is* the right tool (no shared list, no viewer-less payload)
- `tests/stores/social-store.test.ts`, `tests/components/post-card.test.tsx` — the contract tests

## Safe Change Checklist for Future AI Work

1. New viewer-specific flag → add the slice + action in `src/stores/social-store.ts` (id-keyed, no persist), then wire render fallback in the consuming component.
2. Follow the four-move sequence in the handler: snapshot → optimistic write → POST + zod parse → reconcile / rollback + toast.
3. If the flag must survive child unmount or be read by more than one component → store overlay; if it is view-scoped → component-local state with the mutation's `onError`.
4. Add the three test states (optimistic / reconciled / rolled back) in `tests/components/<component>.test.tsx` and the store assertions in `tests/stores/social-store.test.ts`.
5. Docs: `docs/06-features/social.md` and `docs/04-api/social.md` get a one-line note when a new overlay appears.
6. Verification → `bun run test tests/components/post-card.test.tsx tests/stores/social-store.test.ts tests/components/comment-section.test.tsx` (through the `test` script — memory flag, see `docs/solutions/ci-cd/turbopack-postcss-oom.md`), then `bun run type-check` and `bun run lint`.
