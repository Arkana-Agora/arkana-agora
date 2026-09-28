# Observability Requirement Quality Checklist — Sprint 2 Execution Plan

> Plan: `docs/plans/20260926120000-sprint2-execution-plan.md`
> Style: "unit tests for requirements writing" — not implementation tests.
> Domains: observability

## Items

- [ ] CHK001 Is the PostHog event list specified with properties per event (post_create, like, comment, follow, gift_send, horoscope_view, gift_claim_daily, versos_earned, post_limit_hit, csrf_failure)? [Completeness]
- [ ] CHK002 Is consent-first analytics gating required for every new event (no event fired before consent), citing the existing gate pattern? [Consistency]
- [ ] CHK003 Is structured logging required for every new endpoint (Pino, `requestId`, no secrets) — or only cited as an existing pattern? [Completeness]
- [ ] CHK004 Is the error code taxonomy enumerated and consistent across new endpoints (`VALIDATION_ERROR`, `CSRF_TOKEN_INVALID`, `SELF_LIKE`, `COMMENTS_DISABLED`, 429 codes)? [Consistency]
- [ ] CHK005 Are NFR targets stated with measurement methods: P95 <500ms overall, feed <300ms (1000 following), WS <100ms, upload <8s P95, horoscope page <800ms, Kin <1ms? [Measurability]
- [ ] CHK006 Is the measurement tooling specified for those NFRs (bench tests under `tests/bench/`, Chrome DevTools, or manual)? [Gap]
- [ ] CHK007 Are cron job outcomes required to be logged (horoscope generation 04:00, notifications hourly, feed cache 5min) with success/failure counts? [Completeness]
- [ ] CHK008 Is failure alerting/handling specified for BullMQ retries exhausted and cron crashes (log only vs retry vs dead-letter)? [Gap]
- [ ] CHK009 Is rate-limit hit observability specified — is `post_limit_hit` emitted for each limited endpoint or only posts? [Clarity]
- [ ] CHK010 Are WebSocket operational metrics specified (connected clients, reconnect rate, emit failures) for the standalone service? [Gap]
- [ ] CHK011 Is the ContentReport moderation queue observable (report counts by status, pending count) or deferred to the admin dashboard (Sprint 3)? [Completeness]
- [ ] CHK012 Are coverage thresholds (unit ≥80%, integration ≥70%) tied to a named tool (`npm run test:coverage`) and scope (new code vs whole repo)? [Measurability]
- [ ] CHK013 Is the E2E threshold (≥10 critical paths) tied to named spec files (social-flows, horoscopes-flow, realtime, full-flow)? [Measurability]
- [ ] CHK014 Is the `requestId` propagation requirement specified for errors returned from new endpoints (client-visible correlation)? [Consistency]
- [ ] CHK015 Are gift/Versos economy anomalies specified for observability (negative balance impossible, streak reset events, claim double-attempt)? [Edge Case]
- [ ] CHK016 Is it specified whether upload failures (presign vs PUT) are distinguishable in logs/metrics? [Gap]
- [ ] CHK017 Is the availability check job (T145) specified with its success signal (explicit log when content IS present vs silent) and is `horoscope_missing` consent-gated like CHK002? [Gap]
- [ ] CHK018 Is the error-code taxonomy (CHK004) extended with `SELF_GIFT`, `ALREADY_CLAIMED`, `AI_DAILY_LIMIT_REACHED`, `INSUFFICIENT_VERSOS`? [Consistency]
- [ ] CHK019 Is rate-limiter fail-open observable as specified (Q26): `rate_limiter_bypass` event fired exactly once per bypassed request, and is the Prisma daily-count fallback distinguishable from the Redis path in logs? [Gap]
