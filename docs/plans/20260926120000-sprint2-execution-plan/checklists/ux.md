# UX Requirement Quality Checklist — Sprint 2 Execution Plan

> Plan: `docs/plans/20260926120000-sprint2-execution-plan.md`
> Style: "unit tests for requirements writing" — not implementation tests.
> Domains: ux

## Items

- [ ] CHK001 Are loading, empty, and error states specified for every new page (Feed, Explore, Search, Horóscopos ×3, History, Notifications, Gifts, Post detail)? [Completeness]
- [ ] CHK002 Is the empty-state copy/CTA specified for each empty scenario (no following → explore fallback, zero public posts, no notifications, no gifts history)? [Coverage]
- [ ] CHK003 Are optimistic update rules specified for like, follow, and comment — what updates immediately, and what happens on server failure (rollback)? [Completeness]
- [ ] CHK004 Is the real-time UX specified — does a new post slide in (RF-SOC-002 animation), does the like counter animate, and what happens when WebSocket is down (polling UX, 30s delay indication)? [Clarity]
- [ ] CHK005 Is the upload UX specified: multi-select up to 4, per-file progress, and user-facing rejection messages for >5MB and non JPEG/PNG/WebP? [Edge Case]
- [ ] CHK006 Is the UX for a post with `commentsDisabled` specified (input hidden vs disabled with explanation)? [Edge Case]
- [ ] CHK007 Are character limits surfaced in the UI (composer 500/300/200 by type, comment 300) with counter behavior at the limit? [Measurability]
- [ ] CHK008 Is the unread badge behavior specified: increments in real time, clears on mark-all-read, survives refresh? [Completeness]
- [ ] CHK009 Are the three acceptance flows' navigation paths specified (how the user reaches `/feed`, `/explorar`, `/horoscopos/*` from login) consistent with the auth-gated decision S2-13? [Consistency]
- [ ] CHK010 Is responsive behavior specified (mobile-first, bottom tabs, desktop drawer per T140) with measurable breakpoints or a cited design reference? [Measurability]
- [ ] CHK011 Are relative timestamps, mention/hashtag click behavior, and hashtag dropdown (top 10) interactions specified per RF-SOC-002/003? [Completeness]
- [ ] CHK012 Is the share flow specified (ShareModal: copy link, download PNG, Web Share API) including which post types are shareable? [Coverage]
- [ ] CHK013 Is the follow-button state model specified (not-following / following hover "Deixar de seguir" / pending) per RF-SOC-001? [Clarity]
- [ ] CHK014 Is the notifications page vs dropdown relationship specified (mark-as-read from either, does the other sync)? [Consistency]
- [ ] CHK015 Is the horoscope interpretation streaming UX specified (progress indication, mid-stream error, partial content)? [Edge Case]
- [ ] CHK016 Are the E2E critical paths enumerated for AC-15 (≥10), or is "10 critical paths" left undefined? [Measurability]
- [ ] CHK017 Is the gift send confirmation/animation sequence specified (balance update timing, recipient display per RF-SOC-006)? [Completeness]
- [ ] CHK018 Is offline/PWA behavior for the new social pages specified, or explicitly out of scope (Sprint 1 shipped a PWA)? [Gap]
