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
date: 2026-10-19
established_in: "Phase 3 T076/T085 (2026-10-05, branch sprint2-f2.5): PostCard like + CommentSection create/like were wired with a Zustand overlay in `src/stores/social-store.ts` instead of mutating the `useFeed` React Query cache — 3 post-card tests + 5 social-store tests pin it. Refined in Sprint 2 multi-agent review (branch sprint2-f3, 2026-10-19): `clearPostOverlays` clears ONLY `postLikes`; `pruneSyncedComments` removes ONLY server-synced ids (incl. replies); `resetSocialOverlays` on logout/deleteAccount; `overlay ?? viewerHasLiked ?? false` precedence (R6). The old naive 'clear all comments' caused flicker/test failures."
---

# Pattern: Optimistic Viewer Overlay on the Shared Feed Cache

## Problem / When to Use This

Use when a **viewer-specific** piece of state (did *I* like this post? which comments did *I* just add? did *I* like this comment?) must render optimistically over rows that come from a **shared, refetched** cache. Two facts make the obvious approach wrong here: (1) `feedPostSchema` in `src/hooks/use-feed.ts` carries `likeCount`/`commentCount` but **no per-viewer `liked` flag** (`currentUserActions` is a documented aspirational contract, absent from `src/`), so the feed cache alone can never render "liked by me"; (2) the same cache is invalidated by other flows (`invalidateQueries({ queryKey: ["feed"] })` after a comment is created) and refreshed by realtime/polling — `setQueryData` on it for viewer state gets clobbered. The pattern is: keep the shared cache as **server truth for counters**, keep the viewer's own state in a **small Zustand overlay keyed by entity id**, layer it at render time, reconcile it from the parsed server response, and roll it back to a pre-write snapshot plus a toast on error.

## Source of Truth Files

- `src/stores/social-store.ts` — `postLikes: Record<postId, PostLikeOverlay>` + `updatePostLike`, `commentLikes: Record<commentId, CommentLikeOverlay>` + `updateCommentLike`, `postComments: Record<postId, SocialComment[]>` + `addCommentToPost` (dedup by id); `clearPostOverlays()` clears ONLY `postLikes`; `pruneSyncedComments(postId, syncedIds)` removes ONLY server-synced ids; `resetSocialOverlays()` clears all three slices; **no `persist`** — session-ephemeral by contract
- `src/components/social/post-card.tsx` — `handleLike()`: in-flight guard → optimistic write → POST → `likeResponseSchema.parse` → reconcile → rollback + `toast.error`
- `src/components/social/comment-section.tsx` — React Query `["comments", postId]` as list truth; store overlay merged by id; `onSuccess` → `invalidateQueries(["comments", postId])` + `["feed"]`; comment-like in component-local `likes` with `onError` rollback; `useEffect` on `isSuccess` calls `pruneSyncedComments(postId, syncedIds)` where `syncedIds` includes **both root comments and their replies** from `query.data.pages`
- `src/hooks/use-feed.ts` — `feedPostSchema` (now includes optional `viewerHasLiked` per R6), `feedKey`/`["feed"]` cache ownership; `useCreatePost.onSuccess` calls `clearPostOverlays()` then `invalidateQueries(["feed"])`
- `src/stores/auth-store.ts` — `logout`/`deleteAccount` call `resetSocialOverlays()`
- Tests: `tests/components/post-card.test.tsx` (`curtir otimiza no SocialStore e reconcilia com o servidor`, `falha no like reverte o overlay e mostra toast`, `descurte quando já havia sido curtido neste ciclo`), `tests/stores/social-store.test.ts` (overlay write, dedup, JSON-serializable snapshot), `tests/components/comment-section.test.tsx` (store write + reconcile + cursor paging, **prune-on-refetch**, R5 tests, R6 `viewerHasLiked`), `tests/hooks/use-feed.test.tsx` (overlay clear before invalidate)
- Written contract: `docs/06-features/social.md` (PostCard overlay note), `docs/04-api/social.md` (T076 UI note: overlay in `useSocialStore.postLikes`, rollback on error)

## Current Implementation Snapshot

- Overlay shapes:
  - `PostLikeOverlay: { liked: boolean, likeCount: number }` per `postId`; setter `updatePostLike(postId, liked, likeCount)` replaces the whole entry (no partial merge — simpler rollback).
  - `CommentLikeOverlay: { liked: boolean, likeCount: number }` per `commentId`; setter `updateCommentLike(commentId, liked, likeCount)`.
  - `SocialComment` includes optional `viewerHasLiked?: boolean | undefined` (R6: server now sends it; optimistic comments don't have it).
- Render-time layering in `PostCard`:
  `const likeOverlay = useSocialStore((s) => s.postLikes[post.id])` → `liked = likeOverlay?.liked ?? post.viewerHasLiked ?? false`, `likeCount = likeOverlay?.likeCount ?? post.likeCount` — server value is the **fallback when there is no overlay**; once the viewer interacts, the overlay is authoritative for the session (nothing resets it except `clearPostOverlays` on feed refetch or `resetSocialOverlays` on logout).
- `handleLike()` captures `const previous = { liked, likeCount }` **before** the optimistic write, guards re-entry with `likePending`, writes the flipped state, POSTs `/social/posts/${id}/like`, then `likeResponseSchema.parse(res.data).data` → `updatePostLike(...)` (reconcile); `catch` → `updatePostLike(post.id, previous.liked, previous.likeCount)` + `toast.error("Nao foi possivel curtir. Tente novamente.")`; `finally` clears `likePending`.
- Server truth is always re-derived from the **response body**, never from the optimistic guess (`{ data: { liked, likeCount } }`, zod-parsed).
- Comment creation: `useMutation` `onSuccess` → `addCommentToPost(postId, comment)` (store, dedup by `id`) → clear draft → `invalidateQueries({ queryKey: ["comments", postId] })` + `["feed"]`. `CommentSection` merges: store roots not present in the query pages first, then query roots (`roots = [...storeRoots.filter(not in queryIds), ...queryRoots]`), same for `repliesFor()`.
- **Prune on refetch** (`CommentSection`): `useEffect` on `isSuccess` computes `syncedIds` from **all pages** including **replies** (`page.comments.flatMap(c => [c.id, ...(c.replies ?? []).map(r => r.id)])`) and calls `pruneSyncedComments(postId, syncedIds)`. This removes ONLY comments the server has confirmed; optimistic comments still in flight (or created after the refetch started) are preserved — no flicker, no race with a POST in flight.
- Comment likes use the same discipline in **component-local** state: `handleLike` computes `optimistic`, `setLikes(...)`, then `likeMutation.mutate(commentId, { onSuccess: data => updateCommentLike(...), onError: () => rollback + toast, onSettled: clear pending })`.
- **R6 precedence for comment likes**: `storeCommentLikes[comment.id] ?? { liked: comment.viewerHasLiked ?? false, likeCount: comment.likeCount }` — server `viewerHasLiked` is the base when no overlay exists; overlay wins after interaction.
- `clearPostOverlays()` clears **only** `postLikes` (not `commentLikes`, not `postComments`). Called by `useCreatePost.onSuccess` before `invalidateQueries(["feed"])` so the feed refetch's server `viewerHasLiked`/`likeCount` wins.
- `resetSocialOverlays()` clears **all three slices** (`postLikes`, `commentLikes`, `postComments`). Called by `auth-store.ts` `logout` and `deleteAccount`.
- Store invariants: JSON-serializable only (test round-trips through `JSON.parse(JSON.stringify(...))`), no `Date`/functions, no `feedPosts` key (the feed list belongs to `useFeed` — `addPostToFeed` only delegates to the pending-posts queue via `emitPendingPost`).
- UI contract: liked state is exposed as `aria-pressed` and the count is inside the accessible name (`aria-label={`Curtir, ${likeCount} curtidas`}`), so tests assert a single regex on the button name.

## Planned / Optional Extensions (NOT implemented yet)

- Seeding/clearing the overlay from the feed payload if the API ever emits `currentUserActions.liked` per viewer (today it does not — see `docs/04-api/social.md` §feed item noting the aspirational contract).
- Consuming the `like-updated` / `comment-like-updated` realtime events to refresh `post.likeCount` in the feed cache; note that once that lands, the overlay's `likeCount` will win over a newer server count for other users' likes — either re-reconcile the overlay from the event or scope the overlay to `liked` only and read the count from the cache.

## Pattern Overview

Split state by ownership: the React Query cache holds **shared server truth** (counters, lists) and is free to refetch/invalidate; a **small id-keyed Zustand overlay** holds the viewer's own flags, is written optimistically, reconciled from the parsed response, and rolled back from a captured snapshot on error. The component renders `overlay ?? server`. On feed refetch, `clearPostOverlays()` clears only post-like overlays so server `viewerHasLiked` wins. On comments refetch, `pruneSyncedComments()` removes only server-confirmed comments (roots + replies) from the optimistic list. On logout/account deletion, `resetSocialOverlays()` clears everything.

## Implementation Steps

### Step 1: Add the overlay slices to the social store (no persistence)

[File: `src/stores/social-store.ts`]

```typescript
export interface PostLikeOverlay {
  liked: boolean
  likeCount: number
}

export interface CommentLikeOverlay {
  liked: boolean
  likeCount: number
}

export interface SocialComment {
  id: string
  postId: string
  content: string
  likeCount: number
  viewerHasLiked?: boolean | undefined  // R6: server sends it; optimistic comments don't
  parentCommentId: string | null
  createdAt: string
  author: { id: string; name: string; displayName: string | null; avatar: string | null }
  replies?: SocialComment[]
}

interface SocialState {
  unreadCount: number
  notifications: SocialNotification[]
  /** Overlay por postId — o feed em si é dos hooks useFeed (NÃO feedPosts). */
  postLikes: Record<string, PostLikeOverlay>
  /** Overlay de like de comentário por commentId. */
  commentLikes: Record<string, CommentLikeOverlay>
  /** Comentários novos por postId (dedup por id) — base da CommentSection. */
  postComments: Record<string, SocialComment[]>
}

interface SocialActions {
  updatePostLike: (
    postId: string,
    liked: boolean | undefined,
    likeCount: number,
  ) => void
  updateCommentLike: (
    commentId: string,
    liked: boolean | undefined,
    likeCount: number,
  ) => void
  addCommentToPost: (postId: string, comment: SocialComment) => void
  /**
   * Limpa o overlay de likes de posts — chamado quando `["feed"]`
   * refetcha, para a verdade do servidor (contadores/liked) vencer o
   * `overlay ?? server`.
   */
  clearPostOverlays: () => void
  /**
   * Remove da lista otimista de UM post os comentários que o refetch de
   * `["comments", postId]` já trouxe do servidor (agora redundantes — o dedup
   * de render já os esconde, mas a lista cresceria sem limite). Comentários
   * otimistas ainda ausentes do refetch são preservados, então não há flicker
   * nem corrida com um POST em voo.
   */
  pruneSyncedComments: (postId: string, syncedIds: string[]) => void
  /** Limpa todos os overlays — chamado no logout/deleteAccount. */
  resetSocialOverlays: () => void
}

const initialState: SocialState = {
  postLikes: {},
  commentLikes: {},
  postComments: {},
}

export const useSocialStore = create<SocialState & SocialActions>()((set) => ({
  ...initialState,

  updatePostLike: (
    postId: string,
    liked: boolean | undefined,
    likeCount: number,
  ) =>
    set((state: SocialState) => ({
      postLikes: {
        ...state.postLikes,
        [postId]: {
          liked: liked ?? state.postLikes[postId]?.liked ?? false,
          likeCount,
        },
      },
    })),

  updateCommentLike: (
    commentId: string,
    liked: boolean | undefined,
    likeCount: number,
  ) =>
    set((state: SocialState) => ({
      commentLikes: {
        ...state.commentLikes,
        [commentId]: {
          liked: liked ?? state.commentLikes[commentId]?.liked ?? false,
          likeCount,
        },
      },
    })),

  addCommentToPost: (postId: string, comment: SocialComment) =>
    set((state: SocialState) => {
      const list = state.postComments[postId] ?? []
      if (list.some((item: SocialComment) => item.id === comment.id))
        return state
      return {
        postComments: {
          ...state.postComments,
          [postId]: [...list, comment],
        },
      }
    }),

  clearPostOverlays: () => set(() => ({ postLikes: {} })),

  pruneSyncedComments: (postId: string, syncedIds: string[]) =>
    set((state: SocialState) => {
      const current = state.postComments[postId]
      if (!current || current.length === 0) return state
      const synced = new Set(syncedIds)
      const remaining = current.filter(
        (comment: SocialComment) => !synced.has(comment.id),
      )
      if (remaining.length === current.length) return state
      return {
        postComments: { ...state.postComments, [postId]: remaining },
      }
    }),

  resetSocialOverlays: () => set(() => ({ ...initialState })),
}))
```

Key points:
- **No `persist` middleware** — overlays are session-ephemeral; a persisted `liked: true` for a post the user later unliked from another tab is a lie that survives logout.
- Keep entries JSON-serializable (`tests/stores/social-store.test.ts` round-trips them).
- Never put the feed list in this store — `useFeed` owns `["feed", cursor]`; the store comment says exactly that.
- `clearPostOverlays` targets **only** `postLikes` — `commentLikes` and `postComments` survive a feed refetch (they belong to different query keys).
- `pruneSyncedComments` receives `syncedIds` computed from **all pages including replies** — this is the precise set the server has confirmed.
- `resetSocialOverlays` restores `initialState` (all three slices).

### Step 2: Layer at render time with the server value as fallback

[File: `src/components/social/post-card.tsx`]

```typescript
const likeOverlay = useSocialStore((state) => state.postLikes[post.id])
const updatePostLike = useSocialStore((state) => state.updatePostLike)

// R6: server now sends viewerHasLiked; overlay wins when present
const liked = likeOverlay?.liked ?? post.viewerHasLiked ?? false
const likeCount = likeOverlay?.likeCount ?? post.likeCount
```

[File: `src/components/social/comment-section.tsx`]

```typescript
function likeOf(comment: SocialComment) {
  return (
    storeCommentLikes[comment.id] ?? {
      // R6: base vem do servidor (viewerHasLiked), não de false
      liked: comment.viewerHasLiked ?? false,
      likeCount: comment.likeCount,
    }
  )
}
```

Key points:
- Selector must be per-id (`s.postLikes[post.id]`) — subscribing to the whole map re-renders every card on any like.
- Fallback chain is the whole point: first paint (no overlay) = server truth (`viewerHasLiked` if present, else `false`); after interaction = overlay.
- For comments, the server `viewerHasLiked` is the base (R6); overlay wins after the viewer interacts.

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

### Step 4: Merge overlay lists with the query cache (dedup by id) + prune on refetch

[File: `src/components/social/comment-section.tsx`]

```typescript
const queryRoots = (query.data?.pages ?? []).flatMap((page) => page.comments)
const storeRoots = storeComments.filter((c) => !c.parentCommentId)
const queryRootIds = new Set(queryRoots.map((c) => c.id))
const roots = [...storeRoots.filter((c) => !queryRootIds.has(c.id)), ...queryRoots]

function repliesFor(root: SocialComment): SocialComment[] {
  const queryReplies = root.replies ?? []
  const queryReplyIds = new Set(queryReplies.map((reply) => reply.id))
  const extras = storeReplies.filter(
    (reply) =>
      reply.parentCommentId === root.id && !queryReplyIds.has(reply.id),
  )
  return [...extras, ...queryReplies]
}

// Prune on refetch success: remove ONLY server-synced ids (roots + replies)
useEffect(() => {
  if (!isSuccess) return
  const syncedIds = (queryData?.pages ?? []).flatMap((page) => [
    ...page.comments.map((comment) => comment.id),
    ...page.comments.flatMap((reply) =>
      (reply.replies ?? []).map((child) => child.id),
    ),
  ])
  if (syncedIds.length > 0) pruneSyncedComments(postId, syncedIds)
}, [isSuccess, queryData, postId, pruneSyncedComments])
```

- On create success: `addCommentToPost(postId, comment)` → `invalidateQueries({ queryKey: ["comments", postId] })` → `invalidateQueries({ queryKey: ["feed"] })`.
- `addCommentToPost` itself no-ops when `list.some((item) => item.id === comment.id)` — refetch landing twice can't duplicate rows.
- **Prune effect**: runs on `isSuccess` (after refetch), computes `syncedIds` from **all loaded pages including replies**, calls `pruneSyncedComments`. Optimistic comments not yet on the server (or created after the refetch started) are preserved — no flicker, no race.

Key points:
- Store rows are **extras**: query rows win when ids collide, so a refetched (possibly edited/trimmed) version replaces the optimistic one.
- Invalidation is what eventually folds the optimistic row into the server list; the overlay is the bridge across the refetch gap.
- Pruning prevents unbounded growth of the optimistic list while preserving in-flight comments.

### Step 5: Component-local variant for view-scoped state (comment likes)

[File: `src/components/social/comment-section.tsx`]

```typescript
function handleLike(comment: SocialComment) {
  if (commentLikePending.has(comment.id)) return
  const current = likeOf(comment)                                   // overlay ?? viewerHasLiked ?? false
  const optimistic = { liked: !current.liked,
    likeCount: current.liked ? current.likeCount - 1 : current.likeCount + 1 }
  setCommentLikePending((prev) => new Set(prev).add(comment.id))
  updateCommentLike(comment.id, optimistic.liked, optimistic.likeCount)
  likeMutation.mutate(comment.id, {
    onSuccess: (data) => {
      updateCommentLike(comment.id, data.liked, data.likeCount)
    },
    onError: () => {
      updateCommentLike(comment.id, current.liked, current.likeCount)
      toast.error("Nao foi possivel curtir o comentario. Tente novamente.")
    },
    onSettled: () => {
      setCommentLikePending((prev) => {
        const next = new Set(prev)
        next.delete(comment.id)
        return next
      })
    },
  })
}
```

Key points:
- Same three moves (optimistic → server reconcile in `onSuccess` → rollback in `onError`), just scoped to component state because only this section renders comment likes.
- Use the mutation's per-call `onSuccess`/`onError`/`onSettled` callbacks (they receive the variables) instead of a separate try/catch.
- `onSettled` always clears the in-flight guard.

### Step 6: Clear post-like overlays before feed invalidation

[File: `src/hooks/use-feed.ts`]

```typescript
export function useCreatePost() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: CreatePostInput) => {
      const res = await authApi.post("/social/posts", input)
      const parsed = z
        .object({ data: z.object({ post: feedPostSchema }) })
        .parse(res.data)
      return parsed.data.post
    },
    onSuccess: async () => {
      // O refetch do feed volta com a verdade do servidor; o overlay otimista
      // (`overlay ?? server`) a mascararia para sempre — limpa antes de
      // invalidar para o refetch vencer.
      useSocialStore.getState().clearPostOverlays()
      await queryClient.invalidateQueries({ queryKey: ["feed"] })
    },
  })
}
```

Key points:
- `clearPostOverlays()` runs **before** `invalidateQueries` so the refetch's server `viewerHasLiked`/`likeCount` is not masked by a stale overlay.
- Only `postLikes` is cleared — `commentLikes` and `postComments` belong to different query keys and are unaffected.

### Step 7: Reset all overlays on logout / account deletion

[File: `src/stores/auth-store.ts`]

```typescript
logout: async () => {
  // ... signOut, resetAuthApiSessionCache, resetRealtimeClient ...
  useSocialStore.getState().resetSocialOverlays()
  resetUser()
  // ...
},

deleteAccount: async (email: string) => {
  // ... DELETE /api/v1/auth/account, signOut ...
  useSocialStore.getState().resetSocialOverlays()
  resetUser()
  // ...
},
```

Key points:
- `resetSocialOverlays()` clears **all three slices** (`postLikes`, `commentLikes`, `postComments`).
- Called after server-side cleanup but before local state wipe — ensures no stale viewer state survives a session end.

### Step 8: Pin it with tests

- `tests/components/post-card.test.tsx` — assert the **optimistic** state synchronously after the click (`Curtir, 4 curtidas` + `aria-pressed=true` + store entry), then rollback on rejection (store entry back to `{ liked: false, likeCount: 3 }` + `toast.error`), then two sequential toggles reconciling from the response.
- `tests/stores/social-store.test.ts` — overlay write/overwrite per id, `addCommentToPost` dedup, JSON-serializability.
- `tests/components/comment-section.test.tsx` — comment appears immediately (store) + input cleared; like reconciles count from the response; **prune-on-refetch** test seeds store with a synced + an unsynced comment, refetches, asserts only the unsynced remains; **R6** test asserts `viewerHasLiked: true` renders `aria-pressed="true"` without overlay; **R5** tests assert malformed response triggers rollback + toast + text preserved.
- `tests/hooks/use-feed.test.tsx` — `clearPostOverlays` before invalidate: seeds `postLikes`, calls `useCreatePost`, asserts `postLikes` is empty after success.

## Complete Example

New "bookmark" affordance on the card, following the same steps:

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

// 4) If bookmark must survive feed refetch, decide: clear on feed invalidate?
//    If yes, add to clearPostOverlays or a new clearBookmarks().
//    If no, leave it (like commentLikes/postComments).
```

## Project-Specific Constraints

- [ ] The feed/list cache (`["feed", cursor]`, `["comments", postId]`) is mutated only through React Query APIs (`invalidateQueries`, `setQueryData` for **server** rows) — viewer flags never go in it.
- [ ] Overlay lives in `src/stores/social-store.ts`, keyed by entity id, JSON-serializable, **without** `persist`.
- [ ] Render fallback chain is always `overlay ?? server`; the server value must remain reachable (don't default to the optimistic value).
- [ ] **R6**: For comments, base is `comment.viewerHasLiked ?? false`; for posts, base is `post.viewerHasLiked ?? false` (when server sends it).
- [ ] Optimistic write is followed by reconcile from the **parsed** response (`z.object({ data: ... })`), and rollback restores a snapshot captured **before** the optimistic write.
- [ ] Every optimistic mutation has an in-flight guard (`likePending` / `createMutation.isPending` / `commentLikePending`) and a user-visible failure signal (`toast.error` from `sonner`).
- [ ] Overlay writes go through store actions (`updatePostLike`, `updateCommentLike`, `addCommentToPost`) — never `useSocialStore.setState` from components except for the documented `notifications` mirror.
- [ ] List merge dedups by `id` (query rows win) so a refetch cannot double-render or resurrect an optimistic row.
- [ ] **Prune on refetch**: `pruneSyncedComments(postId, syncedIds)` where `syncedIds` includes **roots and replies** from all loaded pages. Called in a `useEffect` gated by `isSuccess`.
- [ ] **Clear post overlays on feed invalidate**: `clearPostOverlays()` (only `postLikes`) called **before** `invalidateQueries(["feed"])`.
- [ ] **Reset all overlays on session end**: `resetSocialOverlays()` called by `logout` and `deleteAccount` in `auth-store.ts`.
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
- ❌ **Old naive pattern**: `clearPostOverlays` clearing `postComments`/`commentLikes` — causes flicker and loses in-flight comments.
- ❌ **Old naive pattern**: `pruneSyncedComments` using only root comment ids — misses replies, leaves stale entries.
- ❌ **Old naive pattern**: Using `false` as the base for `viewerHasLiked` when server sends it (R6) — shows wrong initial state for comments the viewer already liked.

## Related Patterns / Docs

- `docs/06-features/social.md` — PostCard overlay + rollback note (written contract)
- `docs/04-api/social.md` §T076 — UI wiring note and the `currentUserActions` divergence (why the client keeps its own viewer state)
- `docs/solutions/patterns/backend/race-safe-toggle-re-read.md` — the server half: what the reconciling response actually contains
- `src/components/social/follow-button.tsx` — contrast case: a **single-entity** cache (`["profile", username]`) where TanStack `onMutate`/`onError`/`onSettled` optimistic mutation *is* the right tool (no shared list, no viewer-less payload)
- `tests/stores/social-store.test.ts`, `tests/components/post-card.test.tsx`, `tests/components/comment-section.test.tsx`, `tests/hooks/use-feed.test.tsx` — the contract tests

## Safe Change Checklist for Future AI Work

1. New viewer-specific flag → add the slice + action in `src/stores/social-store.ts` (id-keyed, no persist), then wire render fallback in the consuming component.
2. Follow the four-move sequence in the handler: snapshot → optimistic write → POST + zod parse → reconcile / rollback + toast.
3. If the flag must survive child unmount or be read by more than one component → store overlay; if it is view-scoped → component-local state with the mutation's `onError`.
4. Add the three test states (optimistic / reconciled / rolled back) in `tests/components/<component>.test.tsx` and the store assertions in `tests/stores/social-store.test.ts`.
5. For comment lists: add a prune test (seed synced + unsynced, refetch, assert only unsynced remains).
6. For post likes: add a `clearPostOverlays` test (seed overlay, trigger feed invalidate, assert overlay cleared).
7. For session end: verify `resetSocialOverlays` is called in `logout`/`deleteAccount`.
8. Docs: `docs/06-features/social.md` and `docs/04-api/social.md` get a one-line note when a new overlay appears.
9. Verification → `bun run test tests/components/post-card.test.tsx tests/stores/social-store.test.ts tests/components/comment-section.test.tsx tests/hooks/use-feed.test.tsx` (through the `test` script — memory flag, see `docs/solutions/ci-cd/turbopack-postcss-oom.md`), then `bun run type-check` and `bun run lint`.