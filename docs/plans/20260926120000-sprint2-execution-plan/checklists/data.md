# Data Requirement Quality Checklist — Sprint 2 Execution Plan

> Plan: `docs/plans/20260926120000-sprint2-execution-plan.md`
> Style: "unit tests for requirements writing" — not implementation tests.
> Domains: data

## Items

- [ ] CHK001 For each new model (Follow, Post, Comment, PostLike, PostHashtag, CommentLike, Gift, Notification, HoroscopeContent, HoroscopeEntry, HoroscopeLog, HoroscopeNotification, ContentReport), is the query pattern that motivates each index documented? [Completeness]
- [ ] CHK002 Is the counter-update requirement specified (`Post.likeCount`, `Post.commentCount`, `Comment.likeCount`) — transactional with the write, per the derived-field-invalidation pattern? [Consistency]
- [ ] CHK003 Is the race behavior specified for concurrent like/unlike and comment/delete — can counters drift, and is a recount/reconciliation needed? [Edge Case]
- [ ] CHK004 Is the storage format of `Post.imageUrls` decided and specified (R2 keys vs full public URLs) — and is it consistent with what T051 validates and T059 renders? [Clarity]
- [ ] CHK005 Is the Versos balance source of truth specified (stored field vs derived ledger) and is it defined for `recipientEarnsHalf` edge cases? [Gap]
- [ ] CHK006 Is the migration strategy specified for the three batches — ordering, rollback, and whether existing data is affected (all models are new)? [Dependencies]
- [ ] CHK007 Is `HoroscopeContent` dedup semantics specified relative to `@@unique([type, signId, element, period, date])` — race between cron batch runs? [Edge Case]
- [ ] CHK008 Is the 30-day TTL/replacement policy for `HoroscopeContent` specified (delete, overwrite, or append)? [Completeness]
- [ ] CHK009 Are enum/domain values specified: `Post.type`, `Post.audience`, `Notification.type`, `ContentReport.targetType`/`reason`, `UserPlan` — with allowed values enumerated? [Completeness]
- [ ] CHK010 Is the soft-delete representation specified for comments (`content="[removido]"`) and does it affect `commentCount` and nested replies? [Consistency]
- [ ] CHK011 Is `UserProfile.privacy` JSON treated as schemaless — is validation on write specified (allowed keys/values) since it is now a security-relevant source (S2-14/S2-15)? [Completeness]
- [ ] CHK012 Is the Notification retention/cleanup requirement specified (are read notifications ever purged)? [Gap]
- [ ] CHK013 Is cursor pagination stability specified — do list queries order by `(createdAt, id)` to avoid duplicates/skips across pages? [Edge Case]
- [ ] CHK014 Is the feed materialized view requirement specified: what is stored, refresh cadence (5min), staleness bound, and fallback when cache is cold? [Measurability]
- [ ] CHK015 Is seed data completeness specified — do the seeds cover all lookup data the algorithms and UIs depend on (12 signs, CNY table, 260 kins, 6 gifts, blocked words)? [Coverage]
- [ ] CHK016 Is the compatibility matrix declared single-source (code, SC7) — and is any DB copy explicitly prohibited to avoid drift? [Consistency]
- [ ] CHK017 Is `maxFollowing` enforcement specified as a pre-write check within the same transaction as the Follow insert? [Edge Case]
- [ ] CHK018 Are the performance index requirements mapped to the NFR (feed query <300ms for 1000 following) with a verification method? [Measurability]
