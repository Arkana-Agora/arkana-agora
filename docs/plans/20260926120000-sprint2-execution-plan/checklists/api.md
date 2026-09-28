# API Requirement Quality Checklist — Sprint 2 Execution Plan

> Plan: `docs/plans/20260926120000-sprint2-execution-plan.md`
> Style: "unit tests for requirements writing" — not implementation tests.
> Domains: api

## Items

- [ ] CHK001 Are error response requirements specified for every new endpoint across all failure classes (401 unauthenticated, 403 CSRF/authz, 404 not-found vs not-visible, 409 conflict, 422 validation, 429 rate limit)? [Completeness]
- [ ] CHK002 Is the error body contract (`error.code`, `error.message`, `meta.requestId`) required for every new endpoint, or is the existing `apiError` convention explicitly cited as sufficient? [Consistency]
- [ ] CHK003 Is the cursor pagination contract specified for every list endpoint (feed, comments, followers, following, notifications, history, search, polling) — cursor encoding, ordering key, `nextCursor: null` termination? [Completeness]
- [ ] CHK004 Is the rate-limit response contract specified for every limited endpoint (follow, post, like, comment, gift, upload): status 429, `Retry-After`, `X-RateLimit-Remaining`, friendly message? [Measurability]
- [ ] CHK005 Is the set of limited endpoints exhaustive and mapped to the S2-10 numbers (posts 10/50, likes 100/min, comments 30/min, follow 20/min, gifts 10/dia, upload 4/post)? [Consistency]
- [ ] CHK006 Are the visibility rules (`Post.audience`, `UserProfile.privacy.profileVisibility`, `isHidden`) specified per read endpoint (feed, search, detail, og-image, polling) with identical semantics? [Consistency]
- [ ] CHK007 Is the difference between "404 not found" and "403/404 hidden by visibility" specified, including anti-enumeration intent? [Clarity]
- [ ] CHK008 Is the WebSocket event contract specified — event names, payload schemas, and target room for each of `post:new`, `like-updated`, `comment-added`, `comment-like-updated`, `follow-update`, `gift-received`, `notification`? [Completeness]
- [ ] CHK009 Is the polling fallback contract specified (`?since=` timestamp format, delta semantics, ordering, auth) for all four polling endpoints? [Completeness]
- [ ] CHK010 Is the image presign contract complete: max 4 items, allowed MIME list, 5MB limit, key format `posts/{userId}/…`, URL expiry, and what the client PUTs vs what POST /posts validates? [Completeness]
- [ ] CHK011 Is idempotency specified for high-risk writes (gift send double-submit, claim-daily retry, follow toggle) — what happens on duplicate submission? [Edge Case]
- [ ] CHK012 Is the notification type enumeration specified (`LIKE`, `COMMENT`, `REPLY`, `FOLLOW`, `GIFT`, `HOROSCOPE`) with the `data Json` payload shape per type? [Completeness]
- [ ] CHK013 Are auth requirements enumerated per endpoint (Bearer-required vs public) and consistent with the decision S2-13 (MVP autenticado)? [Consistency]
- [ ] CHK014 Is the SSE contract for `POST /api/v1/ai/horoscope-interpret` specified (event stream format, error mid-stream behavior, client reconnect)? [Gap]
- [ ] CHK015 Is the route naming deviation from `.specs/007-social/design.md` (`/api/v1/social/*` prefix, S2-16) recorded so reviewers do not treat it as a spec violation? [Consistency]
- [ ] CHK016 Are method-level CSRF requirements specified for every state-changing endpoint (POST/PATCH/DELETE), including which error code is returned? [Completeness]
- [ ] CHK017 Is the unfollow/re-follow behavior specified — does re-following re-notify, and is it counted against the follow rate limit? [Edge Case]
- [ ] CHK018 Is the horoscope `my-horoscope` aggregation contract specified (response shape, per-system absence/null handling, period semantics)? [Clarity]
