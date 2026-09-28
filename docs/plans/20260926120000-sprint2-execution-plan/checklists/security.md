# Security Requirement Quality Checklist — Sprint 2 Execution Plan

> Plan: `docs/plans/20260926120000-sprint2-execution-plan.md`
> Style: "unit tests for requirements writing" — not implementation tests.
> Domains: security

## Items

- [ ] CHK001 Is authentication required explicitly for every new endpoint, with the visitante/public decision (S2-13) applied consistently to APIs as well as pages? [Completeness]
- [ ] CHK002 Is CSRF coverage specified for all state-changing methods (follow, post, like, comment, comment-like, report, gift, claim-daily, notification settings, presign)? [Completeness]
- [ ] CHK003 Are authorization rules specified for owner-only operations (comment edit 15min window, comment delete, post `commentsDisabled` writer)? [Completeness]
- [ ] CHK004 Are visibility/authorization checks required on every read path (feed, search, post detail, og-image, polling, comments) to prevent private-content leakage via `audience`/`profileVisibility`? [Coverage]
- [ ] CHK005 Is it specified whether `og-image` URLs are unguessable/protected — can a followers-only post's OG image be fetched by a non-follower? [Edge Case]
- [ ] CHK006 Is upload abuse prevention specified: declared content-type trust, whether bytes are re-validated after PUT, presign expiry, and who may presign (authenticated only)? [Edge Case]
- [ ] CHK007 Are rate limits specified as anti-abuse controls for all write endpoints, including follow (20/min) and upload — and whether limits are per-user and/or per-IP? [Measurability]
- [ ] CHK008 Is banned-user (`isBanned`) enforcement specified for all write endpoints (posts, comments, likes, gifts, follows) — blocked or read-only? [Gap]
- [ ] CHK009 Is WebSocket authentication specified: JWT validation at handshake, rejection behavior, and what happens when the token is revoked/expired mid-session? [Completeness]
- [ ] CHK010 Is self-gift prohibited or permitted (gift to oneself) — and is gifting to a blocked/private-profile user specified? [Edge Case]
- [ ] CHK011 Are moderation outcomes specified: does `checkContent` block the post, flag it, or shadow-hide — and is the user informed? [Clarity]
- [ ] CHK012 Is the notification data payload (`data Json`) prevented from leaking private fields (e.g. private profile data of the actor)? [Edge Case]
- [ ] CHK013 Is sensitive-data logging (Pino redact) and timing equalization (`equalizeNoopTiming`) required for the new endpoints, or only cited as existing patterns? [Consistency]
- [ ] CHK014 Is presigned URL expiry (300s in `src/lib/r2.ts`) stated as a requirement, and are uploaded object permissions (public-read via `R2_PUBLIC_URL`) specified for post images? [Completeness]
- [ ] CHK015 Is the `ContentReport` flow specified with reporter identity protection (target author cannot see reporter)? [Gap]
- [ ] CHK016 Is soft-deleted comment behavior specified regarding visibility to mentioned/notification recipients (`[removido]`)? [Consistency]
- [ ] CHK017 Are privacy JSON fields (`profileVisibility`, `whoCanComment`, `whoCanFollow`) specified with allowed values and validation on write? [Completeness]
- [ ] CHK018 Is the anti-self-like rule (RF-SOC-004) and anti-self-follow rule specified with the exact error semantics (which status/code)? [Measurability]
