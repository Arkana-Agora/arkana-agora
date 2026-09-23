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
