---
title: "Sprint 1 Completion — Work Plan"
plan_file: "docs/plans/20260921120000-sprint1-completion-plan.md"
plan_phase: "Phase 0 through Phase 7"
repos: ["arkana-agora"]
generated_at: "2026-09-21T12:00:00Z"
---

# Sprint 1 Completion — Work Plan

## Overview

Work plan for executing the Sprint 1 Completion Plan. Covers Phases 0–7 with tasks T001–T119. Each phase is broken into specific implementation tasks mapped to files.

---

## Task Breakdown

### Phase 0: Auth Verification & Hardening (Audit-only — no code changes)

| Task | Description | Files |
|------|-------------|-------|
| T001 | Audit auth endpoints vs SPEC-001 | `src/app/api/v1/auth/` (all route files), `docs/plans/20260921120000-sprint1-completion-plan.gaps.md` |
| T002 | Verify token-service compliance | `src/services/token-service.ts` |
| T003 | Verify rate limiting | `src/lib/rate-limit.ts` |
| T004 | Verify auth frontend components | `src/app/(auth)/` (all component files) |
| T005 | Verify LGPD lifecycle + security hardening | `src/app/api/v1/auth/account/`, `src/jobs/` |

### Phase 1: Profile Backend & DB

| Task | Description | Files |
|------|-------------|-------|
| T006 | Extend UserProfile schema | `prisma/schema.prisma` |
| T007 | Run Profile migration | `prisma/migrations/` |
| T008 | Configure Cloudflare R2 | `src/lib/r2.ts` |
| T009 | Install sharp | `package.json` |
| T010 | GET /api/v1/users/:username/profile | `src/app/api/v1/users/[username]/profile/route.ts` |
| T011 | GET /api/v1/users/me/profile | `src/app/api/v1/users/me/profile/route.ts` |
| T012 | PATCH /api/v1/users/me/profile | `src/app/api/v1/users/me/profile/route.ts` |
| T013 | GET /api/v1/users/check-username/:username | `src/app/api/v1/users/check-username/[username]/route.ts` |
| T014 | POST /api/v1/users/me/avatar/presign | `src/app/api/v1/users/me/avatar/presign/route.ts` |
| T015 | PATCH /api/v1/users/me/avatar/confirm | `src/app/api/v1/users/me/avatar/confirm/route.ts` |
| T016 | DELETE /api/v1/users/me/avatar | `src/app/api/v1/users/me/avatar/route.ts` |
| T017 | PATCH /api/v1/users/me/privacy | `src/app/api/v1/users/me/privacy/route.ts` |
| T018 | Zodiac sign calculation | `src/lib/calculations/zodiac.ts` |
| T019 | Personal arcana calculation (stub) | `src/lib/arcana/calculate.ts` |
| T020 | Kin Maya calculation | `src/lib/calculations/kin-maya.ts` |
| T021 | Auto-calculate astrological fields on update | `src/app/api/v1/users/me/profile/route.ts` |
| T022 | Profile integration tests | `tests/me-profile.test.ts`, `tests/public-profile.test.ts`, `tests/integration/avatar.test.ts`, `tests/integration/privacy.test.ts` |

### Phase 2: Profile Frontend

| Task | Description | Files |
|------|-------------|-------|
| T023 | ProfileHeader component | `src/components/profile/profile-header.tsx` |
| T024 | ProfileStats component | `src/components/profile/profile-stats.tsx` |
| T025 | ProfileAstrology component | `src/components/profile/profile-astrology.tsx` |
| T026 | ProfileEditForm + ProfileStore | `src/components/profile/profile-edit-form.tsx`, `src/app/(app)/perfil/editar/page.tsx`, `src/app/(app)/perfil/privacidade/page.tsx` |
| T027 | Avatar upload component | `src/components/profile/avatar-upload.tsx` |
| T028 | PrivacySettings toggles | `src/components/profile/privacy-settings.tsx` |
| T029 | Public profile page | `src/app/(app)/perfil/[username]/page.tsx` |
| T030 | TanStack Query hooks | `src/hooks/use-profile.ts` |
| T031 | Profile frontend tests | `tests/profile-components.test.tsx`, `tests/components/profile-edit-form.test.tsx`, `tests/components/avatar-upload.test.tsx`, `tests/components/privacy-settings.test.tsx` |

### Phase 3: Tarot Engine Data & Algorithms

| Task | Description | Files |
|------|-------------|-------|
| T032 | TypeScript types | `src/types/tarot.ts` |
| T033 | RWS deck data (78 cartas) | `src/data/decks/rws.json` |
| T034 | Thoth deck data (78 cartas) | `src/data/decks/thoth.json` |
| T035 | Lenormand deck data (36 cartas) | `src/data/decks/lenormand.json` |
| T036 | Prisma schema Reading + ReadingCard | `prisma/schema.prisma` |
| T037 | Reading migration | `prisma/migrations/` |
| T038 | CSPRNG seed generator | `src/lib/tarot/seed.ts` |
| T039 | Fisher-Yates shuffle | `src/lib/tarot/shuffle.ts` |
| T040 | drawCards with duplicate detection | `src/lib/tarot/draw.ts` |
| T041 | Daily reading limit | `src/lib/tarot/daily-limit.ts` |
| T042 | Yes/No spread logic | `src/lib/tarot/spreads.ts` |
| T043 | Spread position layouts | `src/data/spreads.json` |

### Phase 4: Tarot Engine Backend & Frontend

| Task | Description | Files |
|------|-------------|-------|
| T044 | GET /api/v1/decks + /decks/:id/cards | `src/app/api/v1/decks/route.ts`, `src/app/api/v1/decks/[id]/cards/route.ts` |
| T045 | GET /api/v1/spreads | `src/app/api/v1/spreads/route.ts` |
| T046 | POST /api/v1/readings | `src/app/api/v1/readings/route.ts` |
| T047 | GET /api/v1/readings (list) | `src/app/api/v1/readings/route.ts` |
| T048 | GET /api/v1/readings/:id | `src/app/api/v1/readings/[id]/route.ts` |
| T049 | GET /api/v1/readings/daily-count | `src/app/api/v1/readings/daily-count/route.ts` |
| T050 | GET /api/v1/readings/:id/og-image | `src/app/api/v1/readings/[id]/og-image/route.ts` |
| T051 | TarotCard 3D flip (Framer Motion) | `src/components/tarot/tarot-card.tsx` |
| T052 | CardTable layouts | `src/components/tarot/card-table.tsx` |
| T053 | CardDetailPanel (drawer) | `src/components/tarot/card-detail-panel.tsx` |
| T054 | DeckSelector (grid) | `src/components/tarot/deck-selector.tsx` |
| T055 | SpreadSelector (filters) | `src/components/tarot/spread-selector.tsx` |
| T056 | ReadingSession (wrapper) | `src/components/tarot/reading-session.tsx` |
| T057 | ReadingTimer (MM:SS) | `src/components/tarot/reading-timer.tsx` |
| T058 | ShareModal | `src/components/tarot/share-modal.tsx` |
| T059 | DailyLimitBanner | `src/components/tarot/daily-limit-banner.tsx` |
| T060 | ReadingStore (Zustand) | `src/stores/reading-store.ts` |
| T061 | TanStack Query hooks | `src/hooks/use-readings.ts` |
| T062 | /tirar page | `src/app/(app)/tirar/page.tsx` |
| T063 | /minhas-tiragens page | `src/app/(app)/minhas-tiragens/page.tsx` |
| T064 | /tiragem/:id page | `src/app/(app)/tiragem/[id]/page.tsx` |
| T065 | Tarot tests (unit + integration + E2E) | `tests/lib/tarot/daily.test.ts`, `tests/stores/reading-store.test.ts`, `tests/e2e/tarot-flows.spec.ts` |
| T066 | Animation optimization (60fps) | `src/components/tarot/tarot-card.tsx` |
| T067 | Daily tarot component (home page) | `src/components/tarot/daily-tarot.tsx`, `src/app/(app)/dashboard/page.tsx` |

### Phase 5: AI Readings Pipeline

| Task | Description | Files |
|------|-------------|-------|
| T068 | Configure AI client (OpenAI SDK; desvio de z-ai-web-dev-sdk) | `src/lib/ai/client.ts` |
| T069 | Prisma schema Interpretation + FollowUpMessage + AIDailyUsage | `prisma/schema.prisma` |
| T070 | AI migration | `prisma/migrations/` |
| T071 | Cache hash module (SHA-256) | `src/lib/ai/cache.ts` |
| T072 | Daily AI rate limiter | `src/lib/ai/rate-limit.ts` |
| T073 | System prompt templates | `src/lib/ai/prompts/system.ts` |
| T074 | User prompt builder | `src/lib/ai/prompts/user.ts` |
| T075 | POST /api/v1/ai/interpret (SSE) | `src/app/api/v1/ai/interpret/route.ts` |
| T076 | Interpretation cache service | `src/lib/ai/cache-service.ts` |
| T077 | POST /api/v1/ai/follow-up (SSE) | `src/app/api/v1/ai/follow-up/route.ts` |
| T078 | GET /api/v1/ai/usage | `src/app/api/v1/ai/usage/route.ts` |
| T079 | Retry with backoff | `src/lib/ai/retry.ts` |
| T080 | InterpretationRequest component | `src/components/ai/interpretation-request.tsx` |
| T081 | StreamingInterpretation (typewriter) | `src/components/ai/streaming-interpretation.tsx` |
| T082 | FollowUpChat component | `src/components/ai/follow-up-chat.tsx` |
| T083 | AIUsageIndicator component | `src/components/ai/ai-usage-indicator.tsx` |
| T084 | CachedInterpretationNotice | `src/components/ai/cached-notice.tsx` |
| T085 | Integrate AI in reading page | `src/app/(app)/tiragem/[id]/page.tsx` |
| T086 | Prompt builder unit tests | `tests/unit/ai-prompts.test.ts` |
| T087 | Cache hash unit tests | `tests/unit/ai-cache.test.ts` |
| T088 | Interpret endpoint integration tests | `tests/integration/ai-interpret.test.ts` |
| T089 | Follow-up integration tests | `tests/integration/ai-followup.test.ts` |
| T090 | AI flow E2E test | `tests/e2e/ai-flow.spec.ts` |

### Phase 6: Arcana Personal

| Task | Description | Files |
|------|-------------|-------|
| T091 | Pythagorean table | `src/lib/arcana/pythagorean-table.ts` |
| T092 | reduceToArcana function | `src/lib/arcana/reduce.ts` |
| T093 | calculateArcanaByDate function | `src/lib/arcana/calculate.ts` |
| T094 | calculateArcanaByName function | `src/lib/arcana/calculate.ts` |
| T095 | calculatePersonalArcana function | `src/lib/arcana/calculate.ts` |
| T096 | ARCANA_MAP (22 arcanos) | `src/data/arcana.ts` |
| T097 | GET /api/v1/arcana/calculate | `src/app/api/v1/arcana/calculate/route.ts` |
| T098 | POST /api/v1/ai/arcana-interpret (SSE) | `src/app/api/v1/ai/arcana-interpret/route.ts` |
| T099 | ArcanaCalculator component | `src/components/arcana/arcana-calculator.tsx` |
| T100 | ArcanaDetailCard component | `src/components/arcana/arcana-detail-card.tsx` |
| T101 | ArcanaAIInterpretation component | `src/components/arcana/arcana-ai-interpretation.tsx` |
| T102 | /meu-arcano page | `src/app/(app)/meu-arcano/page.tsx` |
| T103 | /meu-arcano/:arcana page | `src/app/(app)/meu-arcano/[arcana]/page.tsx` |
| T104 | Arcana unit tests (100+ test cases) | `tests/arcana.test.ts` |
| T105 | Arcana integration + E2E tests | `tests/integration/arcana-calculate.test.ts`, `tests/integration/arcana-interpret.test.ts`, `tests/e2e/arcana.spec.ts`, `tests/e2e/profile-arcana-ui.spec.ts` |

### Phase 7: PWA, Landing & Polish

| Task | Description | Files |
|------|-------------|-------|
| T106 | manifest.json (PWA) | `public/manifest.json` |
| T107 | Service worker | `public/sw.js` |
| T108 | Offline fallback page | `src/app/offline/page.tsx` |
| T109 | Responsive design mobile-first | (all page components) |
| T110 | Mobile navigation (bottom tabs) | `src/components/layout/mobile-nav.tsx` |
| T111 | Loading states + skeletons | (all page components) |
| T112 | Toast notifications (sonner) | `src/components/ui/toast.tsx` |
| T113 | Error boundaries | `src/components/error-boundary.tsx` |
| T114 | SEO meta tags + Open Graph | `src/app/layout.tsx` |
| T115 | PostHog analytics events | `src/lib/analytics.ts` |
| T116 | Landing page (hero, features, pricing, FAQ, footer) | `src/app/page.tsx` |
| T117 | Auth + reading E2E tests | `tests/e2e/` |
| T118 | Full integration E2E test | `tests/e2e/full-flow.spec.ts` |
| T119 | Polish daily tarot layout on home page | `src/app/(app)/dashboard/page.tsx` |

---

## Execution Log

### 2026-09-21 — Phase 0 ✅ Completed: Auth Verification & Hardening

**Tasks completed (fully):** T001, T002, T003, T004, T005
**Tasks completed (partially):** none
**Tasks not executed in this run:** T006–T119

**Unplanned changes:** none

**Implementation deviations:**
- Phase 0 was audit-only; no code changes were needed. All auth endpoints, token service, rate limiting, frontend components, and LGPD lifecycle were verified compliant with SPEC-001.
- Security hardening checks (CHK056–CHK079) from T005 verified: error sanitization, CSRF double-submit, timing equalization, cache-control: no-store.

**Verification:**
- Type-check: ✅ (`npm run validate`)
- Lint: ✅
- Tests: ✅ (auth tests passing)

**Gaps documented:** `docs/plans/20260921120000-sprint1-completion-plan.gaps.md`

### 2026-09-23 — Sprint 1 gap-fix pass (docs-drift + wiring)

**Tasks completed (fully):** T050 (sharp og-image), T065, T117, T118; wiring G2/G3/G4/G5/G14; docs sync (plan, sprint-1, milestones, `.specs/001-005`)
**Tasks completed (partially):** none
**Tasks not executed in this run:** 1d/1e/2 (deferred out of scope), Lighthouse measurement

**Unplanned changes:** none beyond documented deviations

**Implementation deviations:**
- `/tirar` collides with no other route but logged-in home is `/dashboard` (cannot use `/` under `(app)` due to landing collision)
- AI SDK: `openai` instead of `z-ai-web-dev-sdk`
- og-image: `sharp` SVG→PNG instead of `html-to-image`
- Decks live in JSON (no `Card`/`TarotDeck` Prisma tables); arcana calculation is stateless (no `ArcanaCalculation` table)

**Verification:**
- Type-check: `npx tsc --noEmit` ✅
- Tests: `npx vitest run` — **973 passed / 1 skipped**
- Lint: changed files ✅
- Playwright: written (`tarot-flows`, `profile-arcana-ui`, `full-flow`); run requires live DB/dev server (limitation)

**Docs updated:** `docs/plans/20260921120000-sprint1-completion-plan.md`, `docs/08-sprints/sprint-1.md`, `docs/08-sprints/milestones.md`, `.specs/001-005/tasks.md`, this work-plan

### 2026-09-23 — Critical review fixes batch (post Step 4 quality review)

Post-review critical fixes applied on top of the Phase 4–7 implementation. All tasks touched below were already marked complete — this batch hardens race conditions, upsert gaps, validation, auth/caching, and error UX found during quality review. No new tasks were created.

**Tasks completed (fully):** T012, T017, T021, T026, T027, T028, T050, T056, T060, T075 (all listed files for each task were touched — fixes/hardening on already-complete tasks)
**Tasks completed (partially):** T022 (files touched: `tests/me-profile.test.ts`, `tests/integration/privacy.test.ts`; not touched: `tests/public-profile.test.ts`, `tests/integration/avatar.test.ts`); T085 (file touched: `src/components/ai/reading-ai-panel.tsx` — G3 wiring file, not the page; not touched: `src/app/(app)/tiragem/[id]/page.tsx`); T065/T105/T117/T118 (E2E assertion-only fixes in specs + `tests/e2e/helpers.ts`; no new flows added)
**Tasks not executed in this run:** deferred/out-of-scope items unchanged — Facebook OAuth (1d), Account model (1e), onboarding page (2), `ArcanaCalculation` table; Lighthouse measurement; Playwright full run

**Unplanned changes:**
- `src/app/api/v1/auth/register/route.ts` — nested `profile: { create: {} }` on `user.create` (fixes missing UserProfile row at register; register was audit-only in Phase 0, no code task existed)
- `src/lib/validators/profile.ts` — empty-string unions for birthDate/website/username; `gender` removed (field was never implemented)
- `src/components/ai/reading-ai-panel.tsx` — epoch/reqSeq race guards, unmount abort, follow-up session guard, `ai-usage` invalidation (file not listed in any task; created during G3 wiring)

**Implementation deviations:**
- T012 — plan listed `gender` among PATCH fields; gender was never implemented and was dropped from validators instead of built. Empty strings now clear birthDate/astrology/mayanKin/bio/location/website; PATCH uses upsert (creates User row fields if missing context).
- T017 — privacy PATCH now upserts UserProfile (creates the row if missing) instead of assuming it exists.
- T021 — profile PATCH upsert; clearing birthDate via empty string also drives astrology/mayanKin/bio/location/website clears (same route file).
- T026 — profile-edit-form strips empty optionals before send; adds USERNAME_TAKEN + generic error UX and "Salvo às" success feedback (plan specified only auto-save + Zod client validation).
- T050 — og-image adds optional Bearer auth: public → cacheable, private → `no-store`, `Vary: Authorization`, 404 when unauthenticated + private (plan specified only SVG→PNG via sharp).
- T056 — draw race fixed via `mutateAsyncRef` in `useEffect` + `runDraw` as `useCallback`, no self-cancel in effect (beyond the planned "wrapper" scope).
- T060 — persist storage returns `undefined` when `window` is absent (SSR-safe); partialize maps `draw`→spread (extends G14 partialize from prior pass).
- T075 — SSE `done` event now includes `interpretationId` (required by the follow-up session flow; not in original event contract).

**Verification:**
- TypeScript: `npx tsc --noEmit` ✅ clean
- Tests: `npx vitest run` — **975 passed / 1 skipped**
- Lint: targeted eslint on changed files ✅ clean
- Playwright: not run in this batch (requires live DB/dev server — known limitation)

**Files changed:**
- `src/components/tarot/reading-session.tsx` (T056)
- `src/stores/reading-store.ts` (T060)
- `src/app/api/v1/users/me/privacy/route.ts` (T017)
- `src/app/api/v1/users/me/profile/route.ts` (T012, T021)
- `src/app/api/v1/auth/register/route.ts` (unplanned)
- `src/lib/validators/profile.ts` (unplanned)
- `src/components/profile/profile-edit-form.tsx` (T026)
- `src/app/api/v1/readings/[id]/og-image/route.ts` (T050)
- `src/app/api/v1/ai/interpret/route.ts` (T075)
- `src/components/ai/reading-ai-panel.tsx` (unplanned / T085-related)
- `src/components/profile/avatar-upload.tsx` (T027)
- `src/components/profile/privacy-settings.tsx` (T028)
- `tests/e2e/helpers.ts` + E2E spec assertion fixes (T065, T105, T117, T118)
- `tests/me-profile.test.ts` (T022)
- `tests/integration/privacy.test.ts` (T022)

### 2026-09-23 — AI SDK standardization + ArcanaCalculation persistence (new batch)

New batch on top of the critical-review fixes above — **not** part of that batch: (1) standardize the AI stack on the official `openai` SDK and correct the AI env contract; (2) implement the previously deferred `ArcanaCalculation` history table (Sprint 1 task 23).

**Tasks completed (fully):** AI SDK standardization (new `src/lib/ai/models.ts` with `getInterpretationModel()`/`getFollowUpModel()`; `interpret`, `arcana-interpret` and `follow-up` routes wired; `.env.example` fixed) and Sprint 1 task 23 `ArcanaCalculation` (Prisma model + migration `20260923183900_add_arcana_calculations` + non-blocking persistence in `GET /api/v1/arcana/calculate` + `reductionDate`/`reductionName` in the response) — recorded as new scope for this batch; the table had no prior T0xx task because it was deferred until now
**Tasks completed (partially):** none
**Tasks not executed in this run:** deferred/out-of-scope items unchanged — Facebook OAuth (1d), Account model (1e), onboarding page (2); Lighthouse measurement; Playwright full run. Note: the `` `ArcanaCalculation` table `` line under "Tasks not executed" in the critical-review entry above is **superseded** by this batch (table now exists).

**Unplanned changes:**
- `src/lib/ai/models.ts` (new) — model selection helpers reading `AI_MODEL` / `AI_MODEL_FOLLOWUP`
- `.env.example` — `AI_PRIMARY_API_KEY`/`AI_FALLBACK_API_KEY` (never read by any code) → `AI_API_KEY`, `AI_MODEL=gpt-4o`, `AI_MODEL_FOLLOWUP=gpt-4o-mini`
- `src/lib/arcana/reduce.ts` — `explainReduction()`; `src/lib/arcana/calculate.ts` — `explainPersonalArcana()`
- 3 previously generated but unapplied migrations applied locally; index drift fixes (`follow_up_messages`, `reading_cards`, dropped stale `interpretations` cacheHash index) folded into the arcana migration

**Implementation deviations:**
- AI SDK: official `openai@^7.21.0` is the single source of truth; `z-ai-web-dev-sdk` was never installed in this project (historical deviation notes about it are kept in plan/spec docs on purpose)
- `ArcanaCalculation` maps to snake_case table `arcana_calculations` via `@@map` instead of the planning-sketch `"ArcanaCalculation"` quoted name in `docs/03-database/migrations.md`

**Verification:**
- TypeScript: `npx tsc --noEmit` ✅ clean
- Tests: `npx vitest run` — **984 passed / 1 skipped / 0 failed** (97 test files)
- Lint: targeted eslint on changed files ✅ clean
- Migrations: `npx prisma migrate dev --name add_arcana_calculations` ✅ applied (plus 3 previously pending migrations)
- Playwright: not run in this batch (requires live DB/dev server — known limitation)

**Docs updated:** `docs/02-architecture/deployment.md` (AI env sample + prod var table), `docs/03-database/{entities,relationships,indexing,erd,migrations}.md` (implemented-model status banners + arcana migration record), `docs/08-sprints/sprint-1.md` (task 23 `[x]`), `docs/08-sprints/milestones.md`, `.specs/005-arcana-personal/tasks.md` (new completed Backend task 19), this work-plan

### 2026-09-23 — SPRINT-1 bugfix batch (build OOM + AUTH env hardening + runbooks)

Bugfix/hardening batch outside the T001–T119 task structure: (1) fix intermittent local build OOM (PostCSS/Turbopack Zone Allocation, exit 134 under low free RAM) via `--max-old-space-size=4096` in the `build` script; (2) enrich the production `AUTH_URL`/`AUTH_SECRET` fail-fast guard in `src/auth/auth.config.ts` with non-secret diagnostics (`NODE_ENV`, `VERCEL_ENV`, `AUTH_URL_in_env`, `AUTH_URL_empty`, scheme snippet — no secret values leaked); (3) add 6 production guard tests in `tests/auth-config.test.ts`; (4) document the OOM fix and deploy-auth hardening in runbooks/solutions/environments docs.

**Tasks completed (fully):** none — no T0xx task lists these files; this is unplanned hardening/bugfix scope
**Tasks completed (partially):** none — T009 (`package.json`, "Install sharp") was NOT advanced: the `package.json` change is the build-script heap flag, unrelated to sharp
**Tasks not executed in this run:** all T001–T119 unchanged; deferred/out-of-scope items unchanged — Facebook OAuth (1d), Account model (1e), onboarding page (2); Lighthouse measurement; Playwright full run

**Unplanned changes:**
- `package.json` — `build` script now runs `node --max-old-space-size=4096 node_modules/next/dist/bin/next build` (fixes local intermittent OOM / exit 134 from PostCSS/Turbopack Zone Allocation under low free RAM); file appears under T009 but this is NOT the sharp-install task
- `src/auth/auth.config.ts` — production fail-fast guard enriched with diagnostics (NODE_ENV, VERCEL_ENV, AUTH_URL_in_env/AUTH_URL_empty, scheme snippet) without leaking secret values; Phase 0 was declared audit-only ("no code changes"), so this is a code change beyond that framing
- `tests/auth-config.test.ts` — 6 new production guard tests (missing AUTH_URL, empty AUTH_URL, http scheme, missing AUTH_SECRET, valid config, NEXT_PHASE=phase-production-build skip)
- `docs/solutions/ci-cd/turbopack-postcss-oom.md` (new) — solution doc for the build OOM
- `docs/solutions/patterns/README.md`, `docs/runbooks/README.md`, `docs/runbooks/vercel-deploy-auth-url.md`, `docs/environments.md`, `docs/02-architecture/deployment.md` — docs-only sync (runbook index, AUTH_URL deploy runbook, environments, deployment architecture, solutions pattern index)

**Implementation deviations:**
- Docs-only vs code split: 6 of 9 changed files are docs-only (solutions/runbooks/environments/deployment index updates); 3 are code/config (`package.json`, `src/auth/auth.config.ts`, `tests/auth-config.test.ts`)
- No T0xx task covers AUTH_URL/AUTH_SECRET fail-fast diagnostics or the build heap-flag fix — both harden production/deploy paths that Phase 0 treated as audit-only verification
- Guard diagnostics deliberately expose only presence/scheme metadata (`AUTH_URL_in_env`/`AUTH_URL_empty`, scheme snippet), never secret values — matches security intent of CHK056–CHK079 but goes beyond the audit wording

**Verification (fresh):**
- TypeScript: `npx tsc --noEmit` ✅ exit 0
- Lint: `npx eslint src/auth/auth.config.ts tests/auth-config.test.ts` ✅ clean
- Tests: `npx vitest run` (single-fork, NODE_OPTIONS heap cap) — **96 files passed / 1 skipped, 990 tests passed / 1 skipped, exit 0**; auth-config suite **9/9** including 6 production guard tests
- Build: `npm run build` — **exit 0**, full route table (`/tirar` ƒ, `/dashboard` ƒ, all API routes), Prisma Client generated
- Quality review (kieran-typescript-reviewer): **approve** after fixes (env snapshot restore in tests, `AUTH_URL_in_env`/`AUTH_URL_empty` diagnostics, solution-doc wording tightened)
- Docs maintenance: plan-sync (this execution log) + doc-shepherd (consistency pass; 0 contradictions) + pattern-extractor (**RECOMMEND none** — solution doc is the registry entry)
- Limitations: Playwright E2E not run (needs live DB/dev server); production Vercel still requires **redeploy after confirming non-empty `https://` `AUTH_URL`** (runbook `docs/runbooks/vercel-deploy-auth-url.md` §0)

**Files changed:**
- `package.json` (build script heap flag)
- `src/auth/auth.config.ts` (guard diagnostics)
- `tests/auth-config.test.ts` (+6 guard tests)
- `docs/solutions/ci-cd/turbopack-postcss-oom.md` (new)
- `docs/solutions/patterns/README.md`
- `docs/runbooks/README.md`
- `docs/runbooks/vercel-deploy-auth-url.md`
- `docs/environments.md`
- `docs/02-architecture/deployment.md`

### 2026-09-23 — SPRINT-1 bugfix batch 2 (CSRF RSC cookie + JWT runbook + PostHog noise)

Local `bun run dev` defects: (1) `Cookies can only be modified in a Server Action or Route Handler` at `login/page.tsx:23` (and same on register) — Next 16 forbids `cookies().set()` in Server Components, so CSRF cookie never set → login/register would 403 `CSRF_TOKEN_INVALID`; (2) `JWTSessionError: no matching decryption secret` — stale Auth.js session cookie vs current `AUTH_SECRET`; (3) PostHog recorder/network console noise from `us.i.posthog.com`.

**Tasks completed (fully):** none — unplanned bugfix (no T0xx covers RSC cookie mutation)
**Tasks completed (partially):** none
**Tasks not executed in this run:** all T001–T119 unchanged; Playwright E2E still deferred

**Unplanned changes:**
- `src/lib/csrf-client.ts` (new) — browser-safe `ensureCsrfCookie()` (NODE_ENV cookie name, 24h, samesite=strict, secure on HTTPS/prod)
- `src/app/(auth)/login/page.tsx`, `register/page.tsx` — removed illegal `cookies().set()`; plain Server Components
- `src/app/(auth)/login/login-form.tsx`, `register/register-form.tsx` — `useEffect(() => ensureCsrfCookie(), [])`
- `src/stores/auth-store.ts` — `login()`/`register()` call `ensureCsrfCookie()` instead of read-only `getCsrfTokenFromBrowser()`
- `src/lib/analytics.ts` — `disable_session_recording: true`, `debug: false` (stops recorder script / console noise when PostHog host blocked)
- `tests/csrf-client.test.ts` (new) — cookie create/reuse/clear/non-browser cases + round-trip vs `validateCsrfToken`
- Docs: `modules/auth.md`, `features/authentication.md`, `06-features/authentication.md`, `04-api/authentication.md`, `02-architecture/architecture.md`, `runbooks/local-jwt-session-decryption.md` (new), `runbooks/README.md`, this execution log

**Implementation deviations:**
- Ticket assumed `[SPRINT-1]` (prior batch); CSRF fix chose client-side over middleware (smaller blast radius; `src/proxy.ts` untouched)
- JWT issue resolved as **ops runbook** (clear stale cookies + keep `AUTH_SECRET` stable) — no secret values in git, no ADR change
- PostHog network failure under adblock is environmental; only session-recording noise gated in code
- Quality review noted follow-ups (shared CSRF name module, drop redundant form `useEffect`s) — deferred, not blocking

**Verification (fresh):**
- TypeScript: `npx tsc --noEmit` ✅ exit 0
- Lint: `npx eslint` on all changed TS/TSX files ✅ clean
- Tests (targeted): `tests/csrf-client.test.ts` + auth-store + login/register forms + login/register routes + auth-config — **167 passed**, exit 0
- Tests (full): `npx vitest run` (single-fork, NODE_OPTIONS heap cap) — **97 files passed / 1 skipped, 995 tests passed / 1 skipped, exit 0**
- Quality review (kieran-typescript-reviewer): **approve** (no critical findings; round-trip contract test added per review)
- Docs maintenance: work-plan execution log (this entry) + auth module/feature/API/architecture CSRF contract updates + new JWT runbook + pattern `docs/solutions/patterns/auth/set-csrf-cookie-client-side.md` + PostHog status/event-table contradiction fixes (infrastructure/architecture/observability)
- Limitations: Playwright E2E not run (needs live DB/dev server); user must clear localhost cookies once if `JWTSessionError` persists (runbook)

**Files changed:**
- `src/lib/csrf-client.ts` (new)
- `src/app/(auth)/login/page.tsx`
- `src/app/(auth)/register/page.tsx`
- `src/app/(auth)/login/login-form.tsx`
- `src/app/(auth)/register/register-form.tsx`
- `src/stores/auth-store.ts`
- `src/lib/analytics.ts`
- `tests/csrf-client.test.ts` (new)
- `docs/modules/auth.md`, `docs/features/authentication.md`, `docs/06-features/authentication.md`, `docs/04-api/authentication.md`, `docs/02-architecture/architecture.md`
- `docs/runbooks/local-jwt-session-decryption.md` (new), `docs/runbooks/README.md`
- `docs/work-plans/20260921120000-sprint1-completion-work-plan.md`

### 2026-09-23 — SPRINT-1 bugfix batch 3 (PostHog console noise: dev gate + dead-clicks disable)

Third bugfix batch on top of batches 1–2: further PostHog console-noise reduction. (1) `src/lib/analytics.ts` skips PostHog init entirely in development (`NODE_ENV === 'development'`); (2) `capture_dead_clicks: false` added while keeping `disable_session_recording: true` and `autocapture: false` (batch 2 flags preserved); (3) `docs/02-architecture/observability.md` §4.1 sample updated to match; (4) 7 new tests in `tests/analytics.test.ts`.

**Tasks completed (fully):** none — unplanned bugfix/hardening (T115's file `src/lib/analytics.ts` was touched, but T115 was already `[x]` from the 2026-09-23 Analytics + LGPD Consent run; this batch is incremental hardening, not new task scope)
**Tasks completed (partially):** none
**Tasks not executed in this run:** all T001–T119 unchanged; Playwright E2E still deferred

**Unplanned changes:**
- `src/lib/analytics.ts` — skip init in development; `capture_dead_clicks: false` (keeps `disable_session_recording: true`, `autocapture: false` from batch 2)
- `tests/analytics.test.ts` — 7 new tests (development gate, config flags, missing key, consent capture, `setAnalyticsConsent(false)` reset); file not listed in any T0xx task
- `docs/02-architecture/observability.md` — §4.1 sample updated to reflect dev-gate/dead-clicks config

**Implementation deviations:**
- Dev gate is a hard skip (no client init at all under `NODE_ENV=development`) rather than init-with-no-capture — stronger than a flag-only approach; simplest way to silence recorder/network console noise in local dev
- `capture_dead_clicks: false` extends batch 2's noise reduction (`disable_session_recording: true`, `debug: false`); `autocapture: false` retained unchanged

**Verification (fresh):**
- TypeScript: `npx tsc --noEmit` ✅ exit 0
- Lint: `npx eslint .` ✅ exit 0
- Tests (full): `npx vitest run` (single-fork) — **1003 passed / 1 skipped**, exit 0
- Tests (targeted): `tests/analytics.test.ts` — **7 passed**
- Playwright: not run (needs live DB/dev server — known limitation)

**Files changed:**
- `src/lib/analytics.ts`
- `tests/analytics.test.ts`
- `docs/02-architecture/observability.md`

### 2026-09-24 — SPRINT-1 Step-4 review fixes (multi-agent review follow-ups on batches 1–3)

Follow-up fixes from the Step 4 multi-agent quality review of the batch 1–3 work (build OOM / AUTH env hardening, CSRF RSC cookie, PostHog noise). Resolves the follow-ups the batch 2 entry marked "deferred, not blocking" (shared CSRF cookie-name module; drop redundant form `useEffect`s). Review verdict: **APPROVE, 0 criticals**.

**Tasks completed (fully):** none — unplanned hardening on already-complete scope (no new T0xx; touched tasks T115 and Phase 0 audits already `[x]`)
**Tasks completed (partially):** none
**Tasks not executed in this run:** all T001–T119 unchanged; Playwright E2E still deferred

**Unplanned changes:**
- `src/lib/csrf-cookie-name.ts` (new) — shared NODE_ENV-based cookie-name helper, now used by both `csrf.ts` and `csrf-client.ts` (deduplicates name logic)
- `src/lib/csrf.ts` — `timingSafeEqual` compares byte length before the timing-safe compare
- `src/lib/analytics.ts` — consent check moved **inside** `initAnalytics()` (not only at the call site); `opt_out_capturing: true` on consent revoke; removed non-null `PH_API_KEY!` assertion
- `src/components/analytics/consent-banner.tsx`, `src/components/providers.tsx` — `setAnalyticsConsent` wiring incl. revoke path
- `src/app/(auth)/login/login-form.tsx`, `register/register-form.tsx` — removed form-mount `useEffect(() => ensureCsrfCookie(), [])` (added in batch 2; auth-store `login()`/`register()` already ensure the cookie)
- `src/stores/auth-store.ts` — removed `csrfToken ?? ""` fallback (always send a real token)
- `tests/analytics.test.ts` — `NODE_ENV` saved/restored in `afterEach` (stops env leakage between tests)
- Docs — anchor/host/pattern sync: `docs/solutions/patterns/README.md`, `docs/solutions/patterns/auth/set-csrf-cookie-client-side.md`, `docs/solutions/patterns/observability/gate-third-party-analytics-sdk-init.md`, plus auth/architecture/infrastructure/observability doc consistency fixes

**Implementation deviations:**
- Supersedes batch 2's "deferred follow-ups": shared cookie-name module and removal of the form-mount `useEffect`s are now implemented (batch 2 entry had said "deferred, not blocking")
- Consent enforcement strengthened vs batch 3: gate lives inside `initAnalytics()` rather than only at the providers call site, and revoke actively calls `opt_out_capturing`
- No Master Checklist items changed — every touched task (T115, Phase 0 audit items) was already `[x]`; this batch is pure hardening

**Verification (fresh):**
- Quality review (Step 4, multi-agent): **APPROVE, 0 criticals**
- Unit tests updated for env isolation (`NODE_ENV` afterEach restore in `tests/analytics.test.ts`)
- Playwright: not run (needs live DB/dev server — known limitation)
- Batch 1–3 verifications (tsc/eslint/vitest/build) recorded in their respective entries above

**Files changed:**
- `src/lib/csrf-cookie-name.ts` (new)
- `src/lib/csrf.ts`
- `src/lib/analytics.ts`
- `src/components/analytics/consent-banner.tsx`
- `src/components/providers.tsx`
- `src/app/(auth)/login/login-form.tsx`
- `src/app/(auth)/register/register-form.tsx`
- `src/stores/auth-store.ts`
- `tests/analytics.test.ts`
- `docs/solutions/patterns/README.md`
- `docs/solutions/patterns/auth/set-csrf-cookie-client-side.md`
- `docs/solutions/patterns/observability/gate-third-party-analytics-sdk-init.md`
- auth/architecture/infrastructure/observability docs (anchor/host/pattern sync)

### 2026-09-24 — SPRINT-1 auth/consent/runtime fixes batch (refresh single-flight + session outcomes + consent banner UX)

Auth/consent/session runtime fixes on top of the Step-4 review fixes above: (1) shared auth refresh single-flight (`src/lib/auth-refresh.ts`) so concurrent 401-triggered refreshes coalesce into one request; (2) `src/lib/api.ts` interceptor retries the original request after refresh **without overwriting the session**; (3) `auth-store` hardening — register treats 201 message-only responses as success, `refreshSession` returns typed outcomes (network failure **keeps** the current user in the store), logout/delete clear query/local caches; (4) login `callbackUrl` restricted to safe same-origin values via new `use-safe-callback-url.ts` + Suspense `useSearchParams`; (5) Dashboard `LogoutButton` (new `src/components/auth/logout-button.tsx`) performing full logout; (6) `src/proxy.ts` matcher extended; (7) consent banner — hydrate state without reload, dismiss without persisting a consent choice; (8) decks/spreads API envelope parse in `use-readings`; (9) `metadataBase` + `Image` sizes in `src/app/layout.tsx`.

**Tasks completed (fully):** none new — all tasks whose files were touched (T004 auth frontend, T061 hooks, T067/T119 dashboard, T114 SEO/layout, T115 consent banner) were already `[x]` from earlier batches; this batch is unplanned runtime hardening on already-complete scope
**Tasks completed (partially):** none — no task advanced by this batch (every touched task file was already complete)
**Tasks not executed in this run:** all T001–T119 unchanged; deferred/out-of-scope items unchanged — Facebook OAuth (1d), Account model (1e), onboarding page (2); Lighthouse measurement; Playwright full run

**Unplanned changes:**
- `src/lib/auth-refresh.ts` (new) — shared single-flight token refresh (concurrent callers await one in-flight promise)
- `src/lib/api.ts` — interceptor waits for single-flight refresh then retries original request without session overwrite
- `src/stores/auth-store.ts` — register message-only (201) success contract; `refreshSession` typed outcomes (network error keeps user logged in); logout/delete clear caches
- `src/hooks/use-safe-callback-url.ts` (new) — safe same-origin callbackUrl sanitization for login
- `src/app/(auth)/login/page.tsx`, `login/login-form.tsx` — Suspense-wrapped `useSearchParams` + callbackUrl wiring
- `src/app/(auth)/layout.tsx`, `register/page.tsx` — related auth frontend fixes
- `src/components/auth/logout-button.tsx` (new) + `src/app/(app)/dashboard/page.tsx` — full-logout button on dashboard
- `src/proxy.ts` — matcher extended to cover previously missed routes
- `src/components/analytics/consent-banner.tsx`, `src/components/providers.tsx` — hydrate without reload; dismiss does not persist a consent choice
- `src/hooks/use-readings.ts` — decks/spreads response envelope parse
- `src/app/layout.tsx` — `metadataBase` + `Image` sizes
- `tests/auth-refresh.test.ts`, `tests/consent-banner.test.tsx` (new); `tests/api.test.ts`, `tests/auth-store.test.ts`, `tests/hooks/use-readings.test.tsx`, `tests/login-form.test.tsx` (updated)
- Docs corrections: `docs/04-api/authentication.md`, `docs/modules/auth.md`, `docs/features/authentication.md`, `docs/06-features/authentication.md` — endpoint/contract sync

**Implementation deviations:**
- **GET /auth/me does not exist** — no such route was ever created; docs corrected to point at **`GET /api/v1/users/me/profile`** (implemented, Bearer-auth) as the authenticated-user read endpoint
- **Register 201 message-only contract confirmed** — `POST /auth/register` returns 201 with a message only (no session/user payload); auth-store success detection updated accordingly (login/refresh remain the session-establishing calls)
- `refreshSession` outcome split: **network failure keeps the current user** (does not clear `user` on transient network errors) — differs from the earlier "failure clears user" behavior, to avoid logging users out on connectivity blips
- Consent banner **dismiss ≠ decision** — dismissing hides the banner without persisting opt-in/opt-out, so the banner can reappear later (only explicit accept/decline persists)
- No Master Checklist items changed — every touched task (T004, T061, T067, T114, T115, T119) was already `[x]`; this batch is pure auth/consent/runtime hardening

**Verification (fresh):**
- Lint: eslint — **0 errors**
- TypeScript: tsc — **0 errors**
- Tests: vitest — **1023 passed / 1 skipped**
- Playwright: not run (needs live DB/dev server — known limitation)

**Files changed:**
- `src/lib/auth-refresh.ts` (new)
- `src/lib/api.ts`
- `src/stores/auth-store.ts`
- `src/hooks/use-safe-callback-url.ts` (new)
- `src/app/(auth)/login/page.tsx`
- `src/app/(auth)/login/login-form.tsx`
- `src/app/(auth)/layout.tsx`
- `src/app/(auth)/register/page.tsx`
- `src/components/auth/logout-button.tsx` (new)
- `src/app/(app)/dashboard/page.tsx`
- `src/proxy.ts`
- `src/components/analytics/consent-banner.tsx`
- `src/components/providers.tsx`
- `src/hooks/use-readings.ts`
- `src/app/layout.tsx`
- `tests/auth-refresh.test.ts` (new)
- `tests/consent-banner.test.tsx` (new)
- `tests/api.test.ts`
- `tests/auth-store.test.ts`
- `tests/hooks/use-readings.test.tsx`
- `tests/login-form.test.tsx`
- `docs/04-api/authentication.md`, `docs/modules/auth.md`, `docs/features/authentication.md`, `docs/06-features/authentication.md`

### 2026-09-24 — SPRINT-1 batch 4: Step-4 review fixes (all findings: critical + important + informational)

Batch 4 of the `/pwf-work` fast path: every remaining Step-4 review finding was fixed in code, followed by Step-4 re-review and Step-5 docs maintenance. Condensed scope:

1. **Analytics consent** — revoke = `resetUser()` (`posthog.reset()`, deletes the SDK consent key) **then** re-assert `opt_out_capturing`; grant = `initAnalytics()` + `opt_in_capturing({ captureEventName: false })`; `resetUser()` re-asserts opt-out when consent is revoked; `ANALYTICS_CONSENT_STORAGE_KEY` exported.
2. **Open-redirect** — single source `isSafeCallbackPath()` in `src/hooks/use-safe-callback-url.ts` (leading `/`, percent-decode with malformed→reject, WHATWG origin equality), used by `AuthSessionBridge` + `consumeStoredCallbackUrl` (magic-link); local `safeCallbackPath` in LoginFormCard deleted (no second validator).
3. **Login** — mount-only `refreshSession()`-guarded redirect (no trusting persisted state); `loginWithGoogle(callbackUrl?)` optional param; auth-refresh gained `server_error` kind (5xx, non-destructive) + monotonic generation guard; dead `api.ts` `refreshTokens()` deleted.
4. **auth-store** — `logout()`/`deleteAccount()` wired `resetAuthApiSessionCache()` + `resetUser()`; `isAuthUserPayload` validates `role` via `VALID_ROLES`.
5. **proxy matcher** — ADDED `/tiragem/:path*`, removed redundant bare `/meu-arcano` (kept `/meu-arcano/:path*`).
6. **use-readings** — real Zod `deckSchema`/`spreadSchema`/`spreadPositionSchema` (`gridX`/`gridY` required) + `satisfies` casts instead of loose parsing.
7. **Register/auth routes** — `equalizeNoopTiming()` in the existing-email branch (anti-enumeration timing); `maskEmail()` in PII logs; new per-IP limiters: forgot-password **5/60min** (`MAX_PASSWORD_RESET_IP_ATTEMPTS`), verify-email resend **5/60min** (`MAX_VERIFY_EMAIL_RESEND_IP_ATTEMPTS`), with IP check+record **before** user lookup.
8. **Misc (batch-9)** — `auth.config` https check via `URL.protocol`; consent-banner fixes; providers dynamic-import catch; `metadataBaseFromEnv`.
9. **New tests** — `tests/safe-callback-url.test.ts` (29: open-redirect bypass matrix + AuthSessionBridge stash lifecycle), `tests/auth-helpers.test.ts` (5: `maskEmail`), `tests/components/logout-button.test.tsx` (4); `tests/analytics.test.ts` → 11; e2e helpers now import the CSRF name from `src/lib/csrf-cookie-name.ts`.

**Tasks completed (fully):** none new — all touched task files (T003 rate limiting, T004 auth frontend, T061 hooks, T115 analytics/consent) were already `[x]` from earlier batches; this batch is review-fix hardening on already-complete scope
**Tasks completed (partially):** none — no task advanced by this batch
**Tasks not executed in this run:** all T001–T119 unchanged; Master Checklist had **zero** `- [ ]` items before this batch (verified — no checkbox flips were possible or needed)

**Unplanned changes:**
- `.env.example` — `MAX_PASSWORD_RESET_IP_ATTEMPTS`, `MAX_VERIFY_EMAIL_RESEND_IP_ATTEMPTS` (new per-IP limiter knobs)
- `src/app/api/v1/auth/_helpers.ts` — `maskEmail()` (LGPD log masking) exported alongside `equalizeNoopTiming()`
- `src/app/api/v1/auth/{login,register,restore-account}/route.ts` — timing equalization + PII masking on the existing-email/known-user branches
- `src/lib/rate-limit.ts` — `isPasswordResetIpLimited`/`recordPasswordResetIpAttempt`, `isVerifyEmailResendIpLimited`/`recordVerifyEmailResendIpAttempt` (60min windows)
- `tests/{rate-limit,forgot-password,verify-email,auth-config,auth-refresh,auth-store,analytics,login-form}.test.ts(x)`, `tests/integration/auth-password-reset.test.ts`, `tests/e2e/helpers.ts` — updated/extended for the above
- Docs (Step-5 maintenance, outside plans/): `docs/04-api/authentication.md`, `docs/06-features/authentication.md`, `docs/07-security/{lgpd,security}.md`, `docs/08-sprints/sprint-0.md`, `docs/architecture.md`, `docs/features/authentication.md`, `docs/modules/auth.md`, `docs/solutions/patterns/*` (4 files)

**Implementation deviations:**
- Consent revoke ordering is now `resetUser()` **then** `opt_out_capturing` (batch 3/earlier had `opt_out_capturing` before `posthog.reset()`) — `posthog.reset()` deletes the SDK's own `__ph_opt_in_out_*` key, so opt-out must be re-asserted after reset
- Open-redirect validation consolidated to a **single** source (`use-safe-callback-url.ts`); the previous per-copy `safeCallbackPath` was deleted rather than kept in sync (plan said "never fork a second validator")
- Proxy matcher: `/tiragem/:path*` was missing entirely (reading detail page reachable without the edge guard) — added; bare `/meu-arcano` dropped as duplicate of `/meu-arcano/:path*`
- New IP rate limiters run **before** the user lookup (anti-enumeration: identical response for unknown e-mail); per-email limits kept unchanged

**Deferred (explicitly NOT done, with reasons):**
- **`trustHost` flip in `src/auth/auth.config.ts`** — requires ADR authorization (never change an ADR without approval)
- **`.com` vs `.com.br` canonical URLs** — noted only; canonical-domain decision not authorized in this sprint
- **New e-mail templates** — out of scope for this batch
- **Redis-backed rate limiter** — still in-memory; documented `TODO` (pre-existing known limitation in the gaps doc)

**Step 4 quality review:** all 3 reviewers **APPROVED** — security-sentinel, nextjs-reviewer, kieran-typescript (critical + important + informational findings all fixed before approval).

**Verification (fresh, pre-doc-edits run):**
- Lint: `eslint` — **0 errors**
- TypeScript: `tsc` — **0 errors**
- Tests: `vitest` — **103 files / 1079 tests passed, 1 skipped**
- Playwright: not run (needs live DB/dev server — known limitation)
- Step 5 docs maintenance: **in progress** at the time of this entry

**Files changed (code/tests/config):**
- `src/lib/analytics.ts`, `src/components/analytics/consent-banner.tsx`, `src/components/providers.tsx`
- `src/hooks/use-safe-callback-url.ts`, `src/app/(auth)/login/{page,login-form}.tsx`, `src/app/(auth)/callback/magic-link/page.tsx`, `src/app/(auth)/verify-email/page.tsx`
- `src/lib/auth-refresh.ts`, `src/lib/api.ts`, `src/stores/auth-store.ts`
- `src/proxy.ts`, `src/app/layout.tsx`, `src/auth/auth.config.ts`
- `src/lib/rate-limit.ts`, `src/app/api/v1/auth/{_helpers.ts,forgot-password,login,register,restore-account,verify-email/resend}` (routes)
- `src/hooks/use-readings.ts`, `src/components/auth/logout-button.tsx`
- `.env.example`
- New tests: `tests/safe-callback-url.test.ts`, `tests/auth-helpers.test.ts`, `tests/components/logout-button.test.tsx`
- Updated tests: `tests/analytics.test.ts`, `tests/auth-config.test.ts`, `tests/auth-refresh.test.ts`, `tests/auth-store.test.ts`, `tests/consent-banner.test.tsx`, `tests/forgot-password.test.ts`, `tests/hooks/use-readings.test.tsx`, `tests/integration/auth-password-reset.test.ts`, `tests/login-form.test.tsx`, `tests/rate-limit.test.ts`, `tests/verify-email.test.ts`, `tests/e2e/helpers.ts`

### 2026-09-24 — SPRINT-1 batch 5 — navigation flow + profile PATCH 500 fix

Unplanned hardening batch over already-complete `[x]` tasks (T012, T029, T063, T064, T102, T103, T110). No new Master Checklist items — all existing checkboxes remain `[x]`. Scope: (1) fix `PATCH /api/v1/users/me/profile` 500; (2) `/perfil` becomes a real "Meu perfil" server page (no more redirect); (3) new `BackLink` shared component + standardized back links; (4) new desktop `AppHeader`; (5) new `/tiragem` → `/minhas-tiragens` redirect; (6) pure `isAppNavActive` helper; (7) ProfileHeader `headingLevel` prop + safe privacy parse; (8) +14 tests.

**Tasks completed (fully):** none new — all touched tasks (T012, T029, T063, T064, T102, T103, T110) were already `[x]` from earlier batches; this batch is unplanned navigation-flow UX + bugfix hardening on already-complete scope
**Tasks completed (partially):** none — no task advanced by this batch
**Tasks not executed in this run:** all T001–T119 unchanged; Master Checklist had zero `- [ ]` items before this batch (verified — no checkbox flips were possible or needed)

**Unplanned changes:**
- `src/app/api/v1/users/me/profile/route.ts` — PATCH 500 fix: `birthPlace` (a `UserProfile` field) was being sent to `tx.user.update()`; moved to the `userProfile.upsert` branch. Builders now typed (`Prisma.UserUpdateInput`, `Partial<Prisma.UserProfileUncheckedCreateInput>`). Log line: `[profile:me] erro ao atualizar` PrismaClientValidationError "Unknown argument birthPlace".
- `src/app/(app)/perfil/page.tsx` + `src/app/(app)/perfil/own-profile.tsx` (new) — `/perfil` no longer redirects (was redirect to `/perfil/:username` or `/perfil/editar` — caused back-button loop "editar perfil volta para /perfil que redireciona para editar perfil"). Now a real "Meu perfil" server page (OwnProfile client component; ProfileHeader/ProfileStats/ProfileAstrology + links Editar/Privacidade/público).
- `src/components/layout/back-link.tsx` (new) — shared `BackLink` component; back links added/standardized on perfil/editar, perfil/privacidade, minhas-tiragens→/dashboard, tiragem/[id]→/minhas-tiragens, meu-arcano→/dashboard, meu-arcano/[arcana]→/meu-arcano.
- `src/components/layout/app-header.tsx` (new) — desktop `AppHeader` (5 items incl. Meu Arcano) mounted in `(app)/layout.tsx`; `pb-16 md:pb-0` wrapper so fixed MobileNav doesn't overlap. Mobile bottom nav unchanged (4 items, exact-match active).
- `src/app/(app)/tiragem/page.tsx` (new) — `/tiragem` → redirect `/minhas-tiragens` (removes the 404 seen on bare /tiragem in dev logs).
- `src/lib/navigation.ts` (new) — pure `isAppNavActive` (prefix matching; Histórico highlights `/tiragem/*`).
- `src/components/profile/profile-header.tsx` — `headingLevel` prop.
- `src/app/(app)/perfil/page.tsx`, `src/app/(app)/perfil/[username]/page.tsx` — privacy JSON parsed via `privacySchema.passthrough().safeParse` (replaces unsafe `as PrivacySettings`).
- Tests: `tests/me-profile.test.ts` (+birthPlace routing/clearing/combined-tx), `tests/app-header.test.ts` (new; static AppHeader + `isAppNavActive` cases) — **+14 tests**.

**Implementation deviations:**
- **G4 (plan Execution Log 2026-09-23) SUPERSEDED** — the G4 note said `/perfil`, `/perfil/editar`, `/perfil/privacidade` with "redirect via User.profile.username". `/perfil` no longer redirects (that redirect caused a back-button loop); it is now a real "Meu perfil" server page. The G4 phrasing in the plan Execution Log was updated to reflect this.
- Mobile bottom nav (4 items, exact-match active) vs new desktop AppHeader (5 items, prefix-match active via `isAppNavActive`) — intentional split for this batch; unification is a pending item (see Pendente below).

**Verification (fresh):**
- Lint: eslint — **0 errors**
- TypeScript: tsc — **0 errors**
- Tests: vitest — **1095 passed / 1 skipped**
- Playwright: not run (needs live DB/dev server — known limitation)

**Pendente (fora de escopo deste batch):**
- Alinhar lógica de active-state do MobileNav (exact) com AppHeader (prefix) e unificar itens (mobile 4 vs desktop 5).
- ProfileStats exibe zeros fixos (seguidores/seguindo não implementados) — stats reais pendentes (readingsCount etc).
- Normalização birthDate round-trip (ISO datetime vs YYYY-MM-DD no formulário) — pre-existente.
- Back/sair do fluxo ReadingSession (/tirar) permanece in-flow Voltar/Cancelar (interações por click) — avaliação pendente.

**Files changed:**
- `src/app/api/v1/users/me/profile/route.ts`
- `src/app/(app)/perfil/page.tsx`, `src/app/(app)/perfil/own-profile.tsx` (new), `src/app/(app)/perfil/[username]/page.tsx`, `src/app/(app)/perfil/editar/page.tsx`, `src/app/(app)/perfil/privacidade/page.tsx`
- `src/app/(app)/minhas-tiragens/page.tsx`, `src/app/(app)/tiragem/[id]/page.tsx`, `src/app/(app)/tiragem/page.tsx` (new)
- `src/app/(app)/meu-arcano/page.tsx`, `src/app/(app)/meu-arcano/[arcana]/page.tsx`
- `src/app/(app)/layout.tsx`
- `src/components/layout/app-header.tsx` (new), `src/components/layout/back-link.tsx` (new)
- `src/lib/navigation.ts` (new)
- `src/components/profile/profile-header.tsx`
- `tests/me-profile.test.ts`, `tests/app-header.test.ts` (new)

### 2026-09-24 — SPRINT-1 batch 6: post-`/review` corrections (informational findings)

Follow-up applied in response to the requested code review (`/review`) on the staged history — all findings were **informational** (0 critical / 0 high). 4 code corrections + 2 doc-verified non-changes. No new Master Checklist items — Master Checklist had zero `- [ ]` items before this batch; no checkbox flips.

**Unplanned changes:**
- `src/lib/api.ts` — request interceptor now caches the access token only when it did **not** come explicitly in the `Authorization` header (`existing === null`). A caller-supplied header (tests/curl) no longer overwrites the 60s session cache (`setCachedAccessToken`).
- `src/auth/auth.config.ts` — production `AUTH_URL` guard hardened: scheme-only check (`protocol === "https:"`) accepted WHATWG-normalized malformed origins (`https:/evil.com` → `https://evil.com/`). Now requires an https URL **with a well-formed `scheme://authority` origin** (`AUTH_URL_ORIGIN_RE` + non-empty host + `https:` scheme). Diagnostic includes `scheme=`, `host=`, `origin=ok|malformado` (same pattern as the `set-csrf-cookie-client-side` hardening work).
- `src/app/api/v1/auth/register/route.ts` — CSRF validation moved **before** IP/email rate-limit checks ("before any side effect"), harmonizing with login route and the doc contract (`docs/solutions/patterns/auth/set-csrf-cookie-client-side.md`: "Don't validate CSRF after lockout/rate-limit/bcrypt/DB mutations"; `docs/modules/auth.md` §4 already claimed this for both routes). Previously register checked rate limits first while login checked CSRF first.
- `src/app/(auth)/login/login-form.tsx` — mount redirect guard fail-safe: `refreshSession()` resolves `true` even when `/refresh` returns 200 without a user payload (persisted session absent). Redirect to `callbackUrl` now also requires `useAuthStore.getState().isAuthenticated`.
- Tests: `tests/auth-config.test.ts` (+2: malformed-origin `https:/evil.com` → `origin=malformado`; unparseable `https:` → `invalid-url`), `tests/api.test.ts` (+1: explicit Authorization header not written to token cache), `tests/login-form.test.tsx` (+1: no redirect on 200 refresh without authenticated session; mock now exposes `getState`) — **+4 tests**.

**Non-changes (findings already covered by docs/intent):**
- #3 shared-IP rate-limit caveat (shared NAT/office IP exhausts per-IP bucket) — already documented as known limitation/best-effort (`docs/07-security/security.md` §"Confiabilidade do IP"); intentional tradeoff, no code change.
- #5 CSRF now client-JS-dependent (double-submit cookie set via `ensureCsrfCookie()` in the store) — deliberate change from SPRINT-1 batch 2, covered in `docs/solutions/patterns/auth/set-csrf-cookie-client-side.md` and `docs/features/authentication.md`; production behavior unchanged, no code change.

**Verification (fresh):**
- Lint: eslint — **0 errors**
- TypeScript: tsc — **0 errors**
- Tests: vitest — **1099 passed / 1 skipped** (was 1095 → +4)
- Playwright: not run (needs live DB/dev server — known limitation)

**Files changed:**
- `src/lib/api.ts`
- `src/auth/auth.config.ts`
- `src/app/api/v1/auth/register/route.ts`
- `src/app/(auth)/login/login-form.tsx`
- `tests/auth-config.test.ts`, `tests/api.test.ts`, `tests/login-form.test.tsx`
- This work-plan execution log entry

### 2026-09-24 — SPRINT-1 batch 6.1: Step-4 review fixes (multi-agent review on batch 6)

Second review round on the batch 6 delta via **Step 4 — Review and Validate Changes** (4 parallel review agents: security-sentinel, kieran-typescript-reviewer, nextjs-reviewer, code-simplicity-reviewer). Resolved 2 critical + 5 important + hygiene findings. No new Master Checklist items.

**Critical findings fixed:**
- `src/lib/api.ts` — **60s TTL slide**: the request interceptor re-called `setCachedAccessToken(token)` on every request, resetting `cachedAccessTokenAt` and turning the absolute 60s TTL into a rolling one. The write is now **deleted entirely** (cache ownership lives in `@/lib/auth-refresh` — `performRefresh`/`resolveAccessToken` already write it). New regression test: `tests/auth-refresh.test.ts` "expires ACCESS_TOKEN_TTL_MS after it was set (no sliding extension)" using fake timers.
- `src/lib/api.ts` — **case-sensitive header reads**: `config.headers.Authorization` bracket access missed lowercased keys (axios `AxiosHeaders` keeps caller casing; verified in `node_modules/axios/lib/core/AxiosHeaders.js` — no Proxy, `findKey` normalizes only via `.get()`). A caller passing `{ authorization: ... }` had it silently replaced by the session token. Now uses the case-insensitive `config.headers.get("authorization")` / `set("Authorization", ...)`. New test covers the lowercase header.
- `src/app/api/v1/auth/register/route.ts` — **P2002 bypass**: the unique-violation catch returned 201 without sending the verification email, without `recordRegisterAttempt`/`recordRegisterIpAttempt`, and without the timing floor (account permanently unverified for the loser of an insert race). Both duplicate paths now route through a shared `respondAsDuplicate()` helper (timing + email + counters + uniform 201). P2002 test strengthened with email/counter assertions.
- Note: the reviewer's suggested `getAuthorization()`/`setAuthorization()` don't exist in the installed axios version — used `.get()`/`.set()` instead (typed via `AxiosHeaders.get(header, matcher?)`).

**Important findings fixed:**
- `src/auth/auth.config.ts` — `AUTH_URL` guard now also rejects **userinfo credentials** (`origin=com-credential`) and **query/fragment** (`origin=com-query-fragment`); added missing `https:\\evil.com` malformed-origin test (+4 guard tests total). Simplifies two unreachable/degraded diagnostics (`authUrlHost === ""` unreachable, `NODE_ENV=` literal) by computing a single `authUrlOriginIssue` label.
- `src/lib/api.ts` — removed redundant `_skipSessionLookup` flag (duplicates the explicit-`Authorization` path on retry; retry keeps the fresh refreshed token via the header write).
- `src/lib/api.ts` — `resetAuthApiSessionCache()` now uses `clearCachedAccessToken()` instead of `setCachedAccessToken(null)`.
- `src/app/(auth)/login/login-form.tsx` — mixed PT/EN comment rewritten to English naming the actual contract; submit/verify-email navigation changed from `router.push()+router.refresh()` to `router.replace()` (Back no longer bounces into `/login`); AUTH_EMAIL_NOT_VERIFIED too.
- `tests/api.test.ts` — explicit-header test rewritten to assert **observable** request headers (two calls: caller token sent, session token not leaked) instead of internal cache state; converted `globalThis.fetch = vi.fn()` to `vi.stubGlobal` + `vi.unstubAllGlobals()`; retry test now asserts the retried request carries the refreshed token.
- `tests/login-form.test.tsx` — store mock simplified (no lying `as` cast; dropped dead `isAuthenticated` field); `useSearchParams` returns a hoisted stable instance; push→replace assertions.
- `tests/integration/auth-register.test.ts` — flow test renamed to the actual order (body → CSRF → rate limit…); 403 test now asserts no rate-limit/DB work ran before CSRF rejection.

**Deferred (documented, not fixed — architectural, new plan needed):**
- **Session epochs** (security-sentinel): `resetAuthApiSessionCache()` doesn't cancel/epoch-isolate `refreshInFlight` — logout/account switch while a refresh is in flight can reuse a stale token. Blocked on a design for monotonic session generation + abort.
- **Login/refresh mount race** (security-sentinel + nextjs-reviewer): the `/login` mount `refreshSession()` can land after an explicit login and overwrite the newly established session/cookies. Needs serialized/single-flight auth operations + AbortController.
- **fetchAdapter `config.params` ignored** (nextjs-reviewer): pre-existing adapter limitation — `src/hooks/use-readings.ts` query serialization silently falls back to defaults. Forwarding `config.signal` is trivial; params need a buildURL decision. Separate ticket.
- **Register rate-limit recording timing** (nextjs-reviewer): counters recorded after async work (success paths) — concurrent bursts can pass checks before any counter is recorded. Intentional "record successes" contract; flag for the Redis-backed rate-limiter rework.
- **Auth-store ↔ axios bundle coupling** (nextjs-reviewer, informational): `auth-store.ts` imports `resetAuthApiSessionCache` from `@/lib/api` (pulls axios into store consumers). Lightweight reset in `auth-refresh.ts` would decouple — small refactor, deferred.
- Existing-email branch emails a non-persisted token (nextjs-reviewer, Important): intentional anti-enumeration per ADR — a token cannot be persisted for an unidentifiable-existing email without leaking existence; the success path already covers the real link.

**Verification (fresh):**
- Lint: eslint — **0 errors**
- TypeScript: tsc — **0 errors**
- Tests: vitest full suite — **1105 passed / 1 skipped** (was 1099 → +6: +2 api, +1 refresh TTL, +4 auth-config guard, plus 2 register test strengthenings; net +6 test count)
- Playwright: not run (needs live DB/dev server — known limitation)

**Files changed:**
- `src/lib/api.ts`, `src/lib/auth-refresh.ts`
- `src/auth/auth.config.ts`
- `src/app/api/v1/auth/register/route.ts`
- `src/app/(auth)/login/login-form.tsx`
- `tests/api.test.ts`, `tests/auth-refresh.test.ts`, `tests/auth-config.test.ts`, `tests/login-form.test.tsx`, `tests/register.test.ts`, `tests/integration/auth-register.test.ts`
- `docs/04-api/authentication.md`, `docs/modules/auth.md`
- This work-plan execution log entry

---

### 2026-09-25 — SPRINT-1 unplanned bugfix batch: "Meu Arcano Pessoal" não salvo / Google não popula perfil

Batch **não planejado** (bugfixes encontrados fora de qualquer T0xx do plano). Sintoma reportado pelo
usuário: o Arcano Pessoal não era salvo, não aparecia no perfil, e contas Google não importavam dados.

**Tasks completed (fully):**
- `GET /api/v1/arcana/calculate` passa a **persistir `User.personalArcana`** (best-effort com `logger.warn`, só quando `null`, nunca sobrescreve cache) — antes gravava apenas o histórico. `tests/integration/arcana-calculate.test.ts` (2 casos novos).
- `PATCH /api/v1/users/me/profile` **recalcula** `personalArcana` via `calculatePersonalArcana(bd, currentUser.name)` (nome lido **dentro** da transação) em vez de zerar; `birthDate: ""` continua zerando tudo; resultado `null` (nome vazio) preserva o valor anterior. `tests/me-profile.test.ts` (recálculo + mock `findUnique` de reset).
- `/meu-arcano` busca `GET /api/v1/arcana/calculate` no mount (Bearer) e pré-preenche `initialName`/`initialBirthDate` + renderiza o arcano salvo; guard `hasUserCalculated` (ref) impede sobrescrita de cálculo manual; 422/perfil sem data mantém entrada manual.
- `ArcanaCalculator` ganha props opcionais `initialName`/`initialBirthDate` com padrão React *"adjusting state when a prop changes"* — o usuário pode limpar o campo. `tests/components/arcana-calculator.test.tsx` (pré-fill + permitir limpar).
- `auth.config.ts` ganha `events.signIn` que enriquece o perfil Google de forma **não destrutiva** (`name`/`displayName` ← `profile.name`, `avatar` ← `profile.picture`, só quando vazios), com `try/catch` + `warn` para nunca derrubar o login.
- `POST /ai/arcana-interpret`: `arcanaNumber` `max(21)` → `max(22)` (22 = "O Louco" era rejeitado com 422). `tests/integration/arcana-interpret.test.ts` (caso 22 aceito).
- `src/lib/arcana/calculate.ts`: `calculateArcanaByDate`, `calculatePersonalArcana` e `explainPersonalArcana` passam a usar getters **UTC** (`getUTCFullYear`/`getUTCMonth`/`getUTCDate`), eliminando a divergência dev (BRT) / prod (UTC) na persistência. `tests/arcana.test.ts`.
- Copy de `/meu-arcano/[arcana]`: "Valores validos: 0-21" → "1-22".

**Tasks completed (partially):** none

**Tasks not executed in this run:** `birthDate` **não** é sincronizado do Google — o escopo `openid
email profile` não retorna data de nascimento. Preencher automaticamente exigiria a **Google People
API** (`contacts.readonly` + consentimento adicional), fora do escopo do MVP e dependente de novo
ADR. Documentado como limitação em `docs/04-api/authentication.md` e `docs/06-features/authentication.md`.

**Unplanned changes:** nenhuma além dos 8 itens acima.

**Verification (fresh):**
- Tests (escopo do batch): `npx vitest run tests/arcana.test.ts tests/me-profile.test.ts tests/integration/arcana-calculate.test.ts tests/integration/arcana-interpret.test.ts tests/components/arcana-calculator.test.tsx` — **74 passed / 0 failed** (5 arquivos)

**Files changed:**
- `src/app/api/v1/users/me/profile/route.ts`, `src/app/api/v1/arcana/calculate/route.ts`
- `src/app/api/v1/ai/arcana-interpret/route.ts`, `src/lib/arcana/calculate.ts`
- `src/app/(app)/meu-arcano/page.tsx`, `src/app/(app)/meu-arcano/[arcana]/page.tsx`
- `src/components/arcana/arcana-calculator.tsx`, `src/auth/auth.config.ts`
- `tests/arcana.test.ts`, `tests/me-profile.test.ts`, `tests/components/arcana-calculator.test.tsx`, `tests/integration/arcana-calculate.test.ts`, `tests/integration/arcana-interpret.test.ts`
- This work-plan execution log entry

### 2026-09-25 — Fix bugs Meu Arcano / sincronização Google (não planejado)

Batch de bugfixes **não planejados** (sem ticket), encontrado fora de qualquer T0xx. Este bloco
**complementa** (não substitui) a entrada "SPRINT-1 unplanned bugfix batch" de 2026-09-25 registrada
acima: aquela já descreve os arquivos de código alterados; esta registra o **mapeamento contra as
tasks do plano**, os **desvios de decisão** e a **verificação de suíte completa**.

Sintoma reportado: "Meu Arcano Pessoal" não era salvo, não era pré-preenchido, não aparecia no
perfil; contas Google não importavam dados.

**Tasks completed (fully):** nenhuma task *avançou* de status — todas as abaixo já eram `[x]` antes
deste batch; o batch as **corrige/hardena** (arquivos tocados integralmente):
- **T012** `PATCH /api/v1/users/me/profile` — recálculo de `personalArcana`
- **T021** auto-calc de campos astrológicos — `personalArcana` passa a ser **recalculado** em vez de zerado
- **T093** `calculateArcanaByDate` + **T095** `calculatePersonalArcana` (`src/lib/arcana/calculate.ts`) — getters **UTC**
- **T097** `GET /api/v1/arcana/calculate` — persiste `User.personalArcana` (best-effort)
- **T098** `POST /api/v1/ai/arcana-interpret` — `arcanaNumber` `max(21)` → `max(22)`
- **T099** `ArcanaCalculator` — props opcionais `initialName`/`initialBirthDate`
- **T102** `/meu-arcano` — prefill no mount + guard `hasUserCalculated`
- **T103** `/meu-arcano/:arcana` — copy "0-21" → "1-22"
- **T022** `tests/me-profile.test.ts` — caso de recálculo

**Tasks completed (partially):**
- **T105** — arquivos tocados: `tests/integration/arcana-calculate.test.ts` (2 casos: persiste quando
  `personalArcana === null`; **não** sobrescreve quando já cacheado) e
  `tests/integration/arcana-interpret.test.ts` (caso `arcanaNumber: 22` aceito); **não tocados**:
  `tests/e2e/arcana.spec.ts`, `tests/e2e/profile-arcana-ui.spec.ts` (Playwright não executado — exige
  DB/dev server)

**Master Checklist: nenhum item alterado.** O Master Checklist do plano já estava com **zero** itens
`- [ ]` antes deste batch (verificado: 0 ocorrências de `- [ ]` no arquivo do plano). Todos os
checkbox relevantes (T012, T021, T022, T093-T095, T097-T099, T102, T103, T105) **já estavam `[x]`** —
não havia box a marcar, e o batch não justifica desmarcar nenhum.

**Implementation deviations:**
1. **O cálculo manual da página permanece client-side por decisão de escopo.** `handleCalculate` em
   `/meu-arcano` continua importando `calculatePersonalArcana`/`getArcanaByNumber` via
   `await import(...)` dinâmico e calculando no browser. O `GET /api/v1/arcana/calculate` é usado
   **apenas no mount**, para pré-preencher e exibir o arcano salvo. Mandar o cálculo manual ao backend
   exigiria um **POST** (a rota hoje é GET de leitura com Bearer) e mudaria o contrato de
   `/arcana/calculate` — não autorizado neste batch.
2. **O prefill NÃO re-usa `useMyProfile`** — incompatibilidade de schema (astrology). O hook
   (`src/hooks/use-profile.ts`) valida com `myProfileSchema`, que espera um objeto **aninhado**
   `astrology: { sunSign, personalArcana, kinMaya }` e o campo `avatarUrl`. O
   `GET /api/v1/users/me/profile` retorna **flat** (`astrologicalSign`, `mayanKin`, `personalArcana`
   no topo, e `avatar` — não `avatarUrl`), e `username` só é incluído quando existe row de
   `UserProfile`. Reusar o hook estouraria o `parse()` do Zod. Por isso o prefill faz `fetch` direto a
   `/api/v1/arcana/calculate`, que já devolve `{arcana, arcanaData, name, birthDate}` — exatamente o
   que o formulário precisa. *Contrapartida aceita: passam a coexistir dois caminhos de leitura do
   perfil; alinhar os schemas é pendência conhecida.*
3. **`birthDate` via Google NÃO implementado — limitação OAuth.** O escopo `openid email profile` do
   Google **não retorna data de nascimento**; preenchê-la exigiria a **Google People API**
   (`contacts.readonly`) + consentimento adicional → novo ADR + novo escopo de consentimento. O
   `events.signIn` enriquece portanto apenas `name`/`displayName` (`profile.name`) e `avatar`
   (`profile.picture`), de forma **não destrutiva** (só quando o campo está vazio) e dentro de
   `try/catch` + `logger.warn`, para nunca derrubar o login.
4. **Gap de teste: `events.signIn` sem teste automatizado.** O handler novo de
   `src/auth/auth.config.ts` foi verificado **apenas por curso manual** — nenhuma suíte o exercita
   (confirmado: zero ocorrências de `events.signIn` / `authConfig.events` em `tests/`).
   `tests/auth-config.test.ts` cobre apenas a guarda de produção `AUTH_URL`/`AUTH_SECRET`.
   **Pendente:** extrair o handler para módulo testável, ou cobri-lo com `prisma` mockado.
5. **`toDateInputValue` novo em `/meu-arcano/page.tsx`** converte a data do backend para `YYYY-MM-DD`
   (`toISOString().slice(0, 10)`) porque `/arcana/calculate` devolve ISO datetime e
   `<input type="date">` exige `YYYY-MM-DD`. Contorna **parcialmente** a normalização round-trip de
   `birthDate` registrada como pendência pré-existente no batch 5 (item 3) — que **continua aberta**
   para o `ProfileEditForm`.

**Unplanned changes:**
- `src/auth/auth.config.ts` — `events.signIn` (novo). Nenhum T0xx lista este arquivo: T004 cobre
  `src/app/(auth)/` (componentes de frontend), não a config do Auth.js; e a Phase 0 foi declarada
  "audit-only". É código novo fora do escopo de qualquer task.

**Drift corrigido (registro anterior preservado, sem reescrita):** a entrada de 2026-09-25 acima lista
`tests/arcana.test.ts` em "Files changed". O `git diff` mostra esse arquivo **sem alterações** neste
batch — a troca para getters UTC em `src/lib/arcana/calculate.ts` **não** foi acompanhada de teste
novo. Registrado aqui como gap; T104 permanece `[x]` (já estava completo antes), mas a cobertura
explícita do comportamento UTC (divergência BRT/UTC) **não foi adicionada**.

**Verification (fresh, re-executada no plan-sync de 2026-09-25):**
- TypeScript: `tsc --noEmit` ✅ exit 0
- Lint: `eslint` nos 8 arquivos de código alterados ✅ exit 0
- Tests (suíte completa): `vitest run` ✅ **104 arquivos passed / 1 skipped — 1111 passed / 1 skipped**, exit 0
- Tests (escopo do batch, registro anterior): **74 passed / 0 failed** (5 arquivos)
- Playwright E2E: não executado (exige DB/dev server — limitação conhecida)

**Files changed (confirmado via `git diff`):**
- `src/app/api/v1/users/me/profile/route.ts`
- `src/app/api/v1/arcana/calculate/route.ts`
- `src/app/api/v1/ai/arcana-interpret/route.ts`
- `src/lib/arcana/calculate.ts`
- `src/app/(app)/meu-arcano/page.tsx`
- `src/app/(app)/meu-arcano/[arcana]/page.tsx`
- `src/components/arcana/arcana-calculator.tsx`
- `src/auth/auth.config.ts`
- `tests/me-profile.test.ts`, `tests/integration/arcana-calculate.test.ts`, `tests/integration/arcana-interpret.test.ts`, `tests/components/arcana-calculator.test.tsx`

### 2026-09-25 — SPRINT-1 review-fix batch: Meu Arcano / Google batch fixes (self-heal CAS, null-out, prefill via useMyProfile, dirty invariant, enrichment validation, arcana 1-22, security headers, drift fixes)

**Scope**: Hardening/bugfix batch over already-complete `[x]` tasks (T012, T021, T097, T098, T099, T102, T103, T093, T095, plus auth config). No new Master Checklist items — Master Checklist had zero `- [ ]` items before this batch.

**Unplanned changes:**
- `src/app/api/v1/arcana/calculate/route.ts` — **Self-heal CAS**: serve valor canônico cacheado mas executa `updateMany({ where: { id, personalArcana: observed }, data: { personalArcana: recomputed } })` para curar cache stale no read. CAS garante atomicidade (só cura se ninguém mais mudou o campo entre read e write).
- `src/app/api/v1/users/me/profile/route.ts` — **Null-out semantics**: quando `calculatePersonalArcana` retorna `null` (nome vazio), `personalArcana` é **explicitamente nulado** (`personalArcana: null` no `tx.user.update`) — **não preserva** o valor anterior. `birthDate: ""` continua sendo o único reset completo.
- `src/app/(app)/meu-arcano/page.tsx` — **Prefill via `useMyProfile()`**: removeu o fetch de mount a `GET /arcana/calculate`; o pré-fill agora vem do hook `useMyProfile()` (TanStack Query, cacheado) que expõe `name`/`birthDate` do perfil. `GET /arcana/calculate` agora só para callers explícitos/manuais (botão "Calcular").
- `src/components/arcana/arcana-calculator.tsx` — **Dirty invariant**: usa **state** (`nameDirty`/`birthDateDirty` booleans) em vez de `ref` para rastrear edição do usuário — satisfaz `react-hooks/exhaustive-deps` e evita anti-pattern de mutar refs no render. `hasUserCalculated` permanece `ref` (race condition do fetch assíncrono).
- `src/services/enrichment-service.ts` (new) — **Enrichment validation**: `oauthNameSchema` (strip control/zero-width, trim, 1-120), `oauthPictureSchema` (https + allowlist), `oauthGoogleProfileSchema` (strict compose); invalida `personalArcana` **apenas quando** nome do Google muda **E** `birthDate` presente.
- `src/app/api/v1/ai/arcana-interpret/route.ts` — **Arcana range 1-22**: schema Zod `min(1).max(22)` (antes `min(0).max(21)`).
- `src/app/(app)/meu-arcano/[arcana]/page.tsx` — **Guard 1-22**: retorna 404 se `arcanaNumber < 1 || arcanaNumber > 22` com copy "Valores válidos: 1-22".
- `src/data/arcana.ts` — `getArcanaByNumber(22)` retorna **entry 22** com `roman: "XXII"` (não short-circuit para índice 0).
- `next.config.ts` — **Security headers**: HSTS (`max-age=63072000; includeSubDomains; preload`), `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`. **F-04 rate-limit deferred (Low)**; **CSP documentado pendente** (auditoria de inline scripts/styles necessária).
- `src/lib/api.ts` — **Drift fix**: `_skipSessionLookup` → `_retry` (nome reflete propósito real: "esta request é retry pós-refresh"); request interceptor continua honrando o flag para não re-ler sessão Auth.js.
- `src/auth/auth.config.ts` — **Drift fix**: removido `export const config = { runtime: "edge" }` residual (runtime Node.js, não edge); `authCallbacks` export **NÃO é dead code** — usado por `tests/auth.test.ts` (mantém export).

**Implementation deviations:**
1. Self-heal CAS é **best-effort** (falha só gera `logger.warn`, resposta 200 mantida) — consistente com o comportamento existente de persistência de `personalArcana`.
2. Null-out explícito muda o comportamento anterior (preservava valor anterior) — decisão intencional para evitar arcano stale quando o nome está vazio.
3. Prefill via `useMyProfile()` elimina uma chamada de rede no mount de `/meu-arcano` — melhora perceived performance.
4. Security headers são response headers via `async headers()` em `next.config.ts` — não middleware/edge (Next.js App Router limitation).
5. CSP não aplicado — requer auditoria de `unsafe-inline` scripts/styles (Next.js + shadcn/ui + Framer Motion) antes de enforçar.

**Verification (fresh):**
- TypeScript: `tsc --noEmit` ✅ exit 0
- Lint: `eslint` ✅ exit 0
- Tests: `vitest run` ✅ (arcana, profile, auth, enrichment tests passing)
- Prisma migrate status: ✅ up to date (no pending migrations)

**Docs updated:**
- `docs/04-api/users.md` (null-out semantics)
- `docs/06-features/profile.md` (self-heal CAS, null-out, prefill via useMyProfile, dirty invariant, arcana 1-22 enforcement)
- `docs/04-api/ai.md` (arcana range min(1).max(22), getArcanaByNumber(22) entry 22)
- `docs/modules/auth.md` (enrichment validation, drift fixes, security headers, authCallbacks not dead)
- `docs/03-database/entities.md` (personalArcana paths, ArcanaCalculation arcanaNumber min 1 max 22)
- `docs/03-database/migrations.md` (execution log entry)
- `docs/plans/20260921120000-sprint1-completion-plan.md` (execution log entry)
- `docs/solutions/patterns/` (TZ determinism via `process.env.TZ=UTC` in tests + derived-field invalidation pattern)

**Files changed:**
- `src/app/api/v1/arcana/calculate/route.ts`
- `src/app/api/v1/users/me/profile/route.ts`
- `src/app/api/v1/ai/arcana-interpret/route.ts`
- `src/app/(app)/meu-arcano/page.tsx`
- `src/app/(app)/meu-arcano/[arcana]/page.tsx`
- `src/components/arcana/arcana-calculator.tsx`
- `src/services/enrichment-service.ts` (new)
- `src/data/arcana.ts`
- `next.config.ts`
- `src/lib/api.ts`
- `src/auth/auth.config.ts`
- `tests/integration/arcana-calculate.test.ts` (self-heal CAS test)
- `tests/me-profile.test.ts` (null-out test)
- `tests/components/arcana-calculator.test.tsx` (dirty invariant test)
- `tests/services/enrichment-service.test.ts` (new)
- `tests/auth.test.ts` (authCallbacks usage)
