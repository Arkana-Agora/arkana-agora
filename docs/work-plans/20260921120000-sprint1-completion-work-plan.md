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
| T022 | Profile integration tests | `tests/integration/profile.test.ts` |

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
| T031 | Profile frontend tests | `tests/integration/profile-frontend.test.ts` |

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
| T065 | Tarot tests (unit + integration + E2E) | `tests/integration/tarot.test.ts`, `tests/e2e/tarot-flows.spec.ts` |
| T066 | Animation optimization (60fps) | `src/components/tarot/tarot-card.tsx` |
| T067 | Daily tarot component (home page) | `src/components/tarot/daily-tarot.tsx`, `src/app/(app)/page.tsx` |

### Phase 5: AI Readings Pipeline

| Task | Description | Files |
|------|-------------|-------|
| T068 | Configure z-ai-web-dev-sdk | `src/lib/ai/client.ts` |
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
| T105 | Arcana integration + E2E tests | `tests/integration/arcana.test.ts`, `tests/e2e/arcana.spec.ts` |

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
| T119 | Polish daily tarot layout on home page | `src/app/(app)/page.tsx` |

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
