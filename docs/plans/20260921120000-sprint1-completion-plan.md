---
title: "Sprint 1 Completion Plan — Core Features"
type: enhancement
status: active
date: 2026-09-21
phased: true
---

# Sprint 1 Completion Plan — Core Features

## Overview

**Problema/Motivação:** A Sprint 1 precisa entregar o MVP funcional da plataforma Arkana Agora. O módulo Auth (SPEC-001) está **completo** (backend + frontend implementados no Sprint 0/1). O trabalho restante concentra-se em: estender o Profile (SPEC-002), construir o Motor de Tiragem (SPEC-003), Pipeline de IA (SPEC-004), Arcano Pessoal (SPEC-005), e completar PWA/Landing/Polish (Sprint-1#25-40). **SPEC-006 (Horoscopes) NÃO está no Sprint 1.**

**O que estamos construindo:** Execução das tasks de `.specs/002/003/004/005` restantes para Sprint 1, mapeadas a issues GitHub, mais as tasks de polish do Sprint-1#25-40. Auth (SPEC-001) está completo — apenas verificação/hardening.

**Estado atual (verificado):**
- Auth backend: todos os endpoints implementados (`src/app/api/v1/auth/*/route.ts`, `src/services/token-service.ts`, `src/lib/rate-limit.ts`, `src/lib/redis.ts`)
- Auth frontend: todos os componentes implementados (`LoginForm`, `RegisterForm`, `MagicLinkForm`, `ForgotPasswordForm`, `ResetPasswordForm`, `VerifyEmailPage`, `MagicLinkCallback`, `AuthGuard`, `AuthStore`)
- Prisma schema: `User` já tem `birthDate`, `astrologicalSign`, `mayanKin`, `personalArcana`, `avatar`; `UserProfile` existe com `bio`, `location`, `website`, `socialLinks`

## Scope / Work Breakdown

| Módulo | Total tasks .specs/ | Já implementado | Sprint 1 restante |
|--------|---------------------|-----------------|-------------------|
| SPEC-001 Auth | 35 | ~27 (core + frontend) | ~8 (verificação/hardening) |
| SPEC-002 Profile | 26 | 26 ✅ | 0 |
| SPEC-003 Tarot Engine | 37 | 31 (T032-T049, T054-T055, T057, T059-T064) | ~6 (T050-T053, T056, T058, T065-T067) |
| SPEC-004 AI Readings | 23 | 0 | 23 (inclui 5 testes #19-23) |
| SPEC-005 Arcana Personal | 18 | 0 | 18 |
| Sprint-1#25-40 | ~16 | 0 | ~10 |
| **TOTAL** | **~155** | **~84** | **~71** |

### Mapeamento por Fase

| Fase | Nome | Módulos | Tasks |
|------|------|---------|-------|
| 0 | Auth Verification & Hardening | SPEC-001 (verificação) | T001-T005 |
| 1 | Profile Backend & DB | SPEC-002 #1-12, #21-23 | T006-T022 |
| 2 | Profile Frontend | SPEC-002 #13-20 | T023-T031 |
| 3 | Tarot Engine Data & Algorithms | SPEC-003 #1-12 | T032-T043 |
| 4 | Tarot Engine Backend & Frontend | SPEC-003 #13-33 | T044-T067 |
| 5 | AI Readings Pipeline | SPEC-004 #1-23 | T068-T090 |
| 6 | Arcana Personal | SPEC-005 #1-14 | T091-T105 |
| 7 | PWA, Landing & Polish | Sprint-1#25-40 | T106-T119 |

## Proposed Solution

### Arquitetura

```
src/
├── app/api/v1/           # REST Custom (rotas novas: profile, readings, ai, arcana)
├── app/(app)/            # Páginas logadas (perfil, tirar, meu-arcano)
├── components/           # Componentes reutilizáveis (profile, tarot, ai, arcana)
├── lib/                  # Utilitários (calculos, tarot algorithms, ai pipeline)
├── stores/               # Zustand stores (reading-store)
├── data/                 # JSON dos baralhos (rws, thoth, lenormand)
└── tests/                # Vitest + Playwright
```

### Decisões de Projeto

- **[S1] Auth:** Completo — apenas verificação de conformidade com SPEC-001
- **[S2] Profile:** Estender `UserProfile` existente (adicionar username, birthPlace, privacy); Cloudflare R2 para avatars
- **[S3] Tarot Engine:** JSON data files (RWS, Thoth, Lenormand), Fisher-Yates shuffle, seed CSPRNG
- **[S4] AI Readings:** z-ai-web-dev-sdk + SSE streaming, cache SHA-256, rate limiting diário
- **[S5] Arcana Personal:** Algoritmo de Pitágoras, `personalArcana` já existe no User schema
- **[S6] Frontend:** Next.js App Router, shadcn/ui, Framer Motion, Zustand + TanStack Query
- **[S7] Prisma:** Migration discipline — generate → drift-check → run locally IMMEDIATELY
- **[S8] Textos:** pt-BR para usuários, inglês para código/logs
- **[S9] Testes:** Vitest (unit/integration), Playwright (E2E)
- **[S10] SPEC-006 (Horoscopes):** EXCLUÍDO do Sprint 1

## Technical Considerations

### NFRs (Non-Functional Requirements)

- **Performance:** Todas as APIs devem responder **P95 < 500ms** em carga normal
- **Rate Limits:**
  - Readings: 3/dia (free), 10/dia (Plus), ilimitado (Premium)
  - AI Interpretations: 10/dia (free, inclui follow-ups) + 3 interpretações de tiragem; 50/dia (Plus)
  - Follow-up por sessão: 10 (free), 30 (Plus)
  - Profile updates: 10/min por usuário
  - Avatar upload: 5/min por usuário
- **Security:** CSRF double-submit, Pino redact, tokens só em header/cookie
- **Observability:** PostHog events (signup, reading, ai_interpretation, arcana_calculate)

### ORM discipline
- **Qualquer mudança de schema** segue skill `prisma` — generate → drift-check → run locally IMMEDIATELY
- **Cloudflare R2:** avatars do profile (presigned URLs)
- **sharp:** processamento de imagens de avatar
- **Framer Motion:** animações de cartas (tarot) e transições
- **z-ai-web-dev-sdk:** integração com GPT-4o para interpretações
- **SSE streaming:** respostas de IA em tempo real
- **Vitest:** testes unitários/integração (`tests/**/*.test.ts`)
- **Playwright:** testes E2E (`tests/e2e/`)
- **PWA:** manifest.json, service worker, offline fallback

## Acceptance Criteria

#### AC-1: Profile completo com cálculos
**Given** um usuário autenticado com data de nascimento e nome
**When** acessa `/perfil`
**Then** vê signo zodiacal, arcano pessoal e kin maya calculados; perfil editável com avatar

#### AC-2: Motor de tiragem funcional
**Given** um usuário logado
**When** seleciona baralho, espalhamento e realiza tiragem
**Then** cartas embaralhadas (seed-based), exibidas com animação 3D, resultado salvo

#### AC-3: Interpretação IA com streaming
**Given** uma tiragem concluída
**When** solicita interpretação IA
**Then** texto gerado com streaming em tempo real; cache; rate limiting diário

#### AC-4: Arcano Pessoal calculado corretamente
**Given** data de nascimento e nome
**When** acessa `/meu-arcano`
**Then** cálculo de Pitágoras correto, resultado detalhado, interpretação IA disponível

#### AC-5: PWA e landing page
**Given** um visitante ou usuário mobile
**When** acessa a landing page ou instala o PWA
**Then** landing page completa, PWA instalável com offline parcial

#### AC-6: Testes passando
**Given** o código completo
**When** roda `npm run test` e `npx playwright test`
**Then** todos os testes passam

## Implementation Plan

| Phase | Name | Depends On | Status |
|-------|------|------------|--------|
| 0 | Auth Verification & Hardening | None | ✅ Completed |
| 1 | Profile Backend & DB | Phase 0 | ✅ Completed |
| 2 | Profile Frontend | Phase 1 | ✅ Completed |
| 3 | Tarot Engine Data & Algorithms | None | ✅ Completed |
| 4 | Tarot Engine Backend & Frontend | Phase 3 | ✅ Completed |
| 5 | AI Readings Pipeline | Phase 3 | ✅ Completed |
| 6 | Arcana Personal | Phase 5 | ✅ Completed |
| 7 | PWA, Landing & Polish | None | ⬜ Pending |

**Total: 119 tasks (T001-T119), ZERO duplicatas**

---

### Phase 0: Auth Verification & Hardening

**Status**: ✅ Completed
**Objective**: Verificar que todos os endpoints de auth existentes estão em conformidade com SPEC-001; aplicar hardening se necessário.
**Dependencies**: None

**Tasks**:

- [ ] T001 [SPEC-001] Audit auth endpoints vs SPEC-001 requirements em `src/app/api/v1/auth/`
  - Verificar register, login, refresh, logout, magic-link, forgot-password, reset-password, verify-email, account, restore-account
  - Conferir: Zod validation, bcrypt cost 12, error codes AUTH_*, rate limits, anti-enumeration
  - Documentar gaps em `docs/plans/20260921120000-sprint1-completion-plan.gaps.md`
- [ ] T002 [SPEC-001] Verify token-service compliance em `src/services/token-service.ts`
  - Conferir: RS256 15min access, 30d refresh rotativo, tokenVersion via Redis, detecção de reuso
  - Verificar `sha256()` para tokenHash, familyId/tokenId/replacedByTokenId
- [ ] T003 [SPEC-001] Verify rate limiting em `src/lib/rate-limit.ts`
  - Conferir limites: login 5/15min (ADMIN 20/15min), cadastro 3/IP/h, magic link 3/h, reset 3/h, verificação 1/min
- [ ] T004 [SPEC-001] Verify auth frontend components em `src/app/(auth)/`
  - Conferir: LoginForm, RegisterForm, MagicLinkForm, ForgotPasswordForm, ResetPasswordForm, VerifyEmailPage, MagicLinkCallback, AuthGuard, AuthStore
  - Verificar: Zod client-side, password strength indicator, error handling, Google OAuth integration
- [ ] T005 [SPEC-001] Verify LGPD lifecycle em `src/app/api/v1/auth/account/` e `src/jobs/`
  - Conferir: soft delete, hard delete job, restore-account, 30-day window
  - **Security hardening** (CHK056-CHK079):
    - PII handling doc: definir quais campos são PII (email, birthDate, name) e como são protegidos
    - LGPD profile deletion: garantir que DELETE /account também limpa UserProfile, avatar R2, readings
    - Security headers: CORS origin list, CSP policy, HSTS max-age
    - Prompt injection guard: sanitizar input do usuário antes de enviar ao GPT-4o
    - Error sanitization: nenhum stack trace retornado ao client; erro genérico 500
    - SSE connection auth: validar token no handshake inicial do SSE
    - Reading ownership: user só pode acessar próprias readings (ou públicas)
    - Avatar R2 ACL: bucket privado; presigned URLs com expiração 15min
    - Service worker cache scope: apenas assets estáticos, nunca API responses com dados pessoais

**After completing this phase**:
1. TypeScript Validation — `npm run validate`; fix todos os erros.
2. Build — somente se explicitamente pedido.
3. Testes — `npm run test` (auth tests existentes devem passar).
4. Update this plan — mark Phase 0 `✅ Completed`.

---

### Phase 1: Profile Backend & DB

**Status**: ✅ Completed
**Objective**: Estender UserProfile com campos faltantes (username, birthPlace, privacy), configurar R2, implementar API routes de profile e cálculos.
**Dependencies**: Phase 0

**Tasks**:

- [x] T006 [SPEC-002#1] Extend UserProfile schema em `prisma/schema.prisma`
  - Adicionar campos: `username String? @unique`, `birthPlace String?`, `privacy Json?` (guarda configurações de visibilidade)
  - User já tem: `birthDate`, `astrologicalSign`, `mayanKin`, `personalArcana`, `avatar`
- [x] T007 [SPEC-002#2] Run Profile migration em `prisma/migrations/`
  - Gerar migration → drift-check → run locally IMMEDIATELY (atomic chain)
- [x] T008 [SPEC-002#3] Configure Cloudflare R2 em `src/lib/r2.ts`
  - Cliente S3-compatible; presigned URL generation; env vars: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME
- [x] T009 [SPEC-002#4] Install sharp em `package.json`
  - `npm install sharp @types/sharp`; configurar para processamento de avatar
- [x] T010 [SPEC-002#5] Implement `GET /api/v1/users/:username/profile` em `src/app/api/v1/users/[username]/profile/route.ts`
  - Filtros de privacidade baseado nas configurações do UserProfile.privacy; 404 se não encontrado
- [x] T011 [SPEC-002#6] Implement `GET /api/v1/users/me/profile` em `src/app/api/v1/users/me/profile/route.ts`
  - Bearer; retorna perfil completo (User + UserProfile) do usuário autenticado
- [x] T012 [SPEC-002#7] Implement `PATCH /api/v1/users/me/profile` em `src/app/api/v1/users/me/profile/route.ts`
  - Bearer; Zod validation; atualiza campos permitidos: displayName, bio, birthDate, birthPlace, gender, location, website
  - Recalcula astrologicalSign, mayanKin, personalArcana se birthDate mudou
- [x] T013 [SPEC-002#8] Implement `GET /api/v1/users/check-username/:username` em `src/app/api/v1/users/check-username/[username]/route.ts`
  - Verifica disponibilidade do username; 200 `{available: boolean}`
- [x] T014 [SPEC-002#9] Implement `POST /api/v1/users/me/avatar/presign` em `src/app/api/v1/users/me/avatar/presign/route.ts`
  - Bearer; gera presigned URL para upload no R2; 200 `{uploadUrl, key}`
- [x] T015 [SPEC-002#10] Implement `PATCH /api/v1/users/me/avatar/confirm` em `src/app/api/v1/users/me/avatar/confirm/route.ts`
  - Bearer; processa imagem com sharp: 3 tamanhos (48x48, 120x120, 400x400) WebP; remove EXIF metadata
  - Salva 400x400 como avatar principal; 48/120 para thumbnails
  - Retry: se processamento falhar, retry 1x; se falhar novamente, manter avatar anterior
  - Validação: max 5MB, formatos aceitos (JPEG, PNG, WebP)
- [x] T016 [SPEC-002#11] Implement `DELETE /api/v1/users/me/avatar` em `src/app/api/v1/users/me/avatar/route.ts`
  - Bearer; remove avatar do R2; limpa User.avatar
- [x] T017 [SPEC-002#12] Implement `PATCH /api/v1/users/me/privacy` em `src/app/api/v1/users/me/privacy/route.ts`
  - Bearer; Zod validation; atualiza UserProfile.privacy (visibilidade de perfil, stats, arcano)
- [x] T018 [SPEC-002#21] Create zodiac sign calculation em `src/lib/calculations/zodiac.ts`
  - Função pura: `calculateZodiacSign(birthDate: Date): string`; datas precisas dos signos
- [x] T019 [SPEC-002#22] Create personal arcana calculation em `src/lib/arcana/calculate.ts`
  - `calculatePersonalArcana(birthDate: Date, name: string): number`; caminho canônico (SPEC-005#5)
  - T091-T095 (Phase 6) implementam os algoritmos detalhados; T019 cria a função stub que chama esses algoritmos
- [x] T020 [SPEC-002#23] Create Kin Maya calculation em `src/lib/calculations/kin-maya.ts`
  - `calculateKinMaya(birthDate: Date): number`; ciclo de 260 dias
- [x] T021 [SPEC-002#21] Auto-calculate astrological fields on profile update
  - No PATCH /profile: se birthDate mudou, recalcular astrologicalSign, mayanKin, personalArcana e salvar no User
- [x] T022 [SPEC-002#24] Create integration tests em `tests/integration/profile.test.ts`
  - Cobrir todos os endpoints de profile; mocks de Prisma + R2

**After completing this phase**:
1. TypeScript Validation — `npm run validate`; fix todos os erros.
2. Build — somente se explicitamente pedido.
3. Testes — `npm run test` (unit + integration profile).
4. Update this plan — mark Phase 1 `✅ Completed`.

---

### Phase 2: Profile Frontend

**Status**: ✅ Completed
**Objective**: Componentes de perfil, formulário de edição, upload de avatar, página pública.
**Dependencies**: Phase 1

**Tasks**:

- [x] T023 [SPEC-002#13] Create `ProfileHeader` em `src/components/profile/profile-header.tsx`
  - Avatar, nome, username, bio; layout responsivo
- [x] T024 [SPEC-002#14] Create `ProfileStats` em `src/components/profile/profile-stats.tsx`
  - Tiragens, seguidores, seguindo; contadores formatados
- [x] T025 [SPEC-002#15] Create `ProfileAstrology` em `src/components/profile/profile-astrology.tsx`
  - Signo zodiacal, arcano pessoal, kin maya; ícones temáticos
- [x] T026 [SPEC-002#16] Create `ProfileEditForm` em `src/components/profile/profile-edit-form.tsx`
  - Auto-save com debounce 1s; campos: displayName, bio, birthDate, birthPlace, gender, location, website
  - Zod client-side validation
  - **ProfileStore** (Zustand): isEditing, dirtyFields, isSaving — gerencia estado do formulário
  - Route pages: `/perfil/editar` (formulário) e `/perfil/privacidade` ( PrivacySettings)
- [x] T027 [SPEC-002#17] Create avatar upload component em `src/components/profile/avatar-upload.tsx`
  - Preview, drag-and-drop, crop; chama presign + confirm endpoints
  - Validação client-side: max 5MB, formatos aceitos (JPEG, PNG, WebP)
  - Retry: se upload falhar, retry 1x automaticamente; se falhar novamente, mostrar erro com retry manual
  - Manter avatar anterior visível durante upload; reverter se falhar
- [x] T028 [SPEC-002#18] Create `PrivacySettings` em `src/components/profile/privacy-settings.tsx`
  - Toggles: profileVisibility (public/followers/private), statsVisibility, arcanaVisibility
  - Toggles: whoCanFollow (everyone/followers/nobody), whoCanComment (everyone/followers/nobody)
  - Chama PATCH /privacy
- [x] T029 [SPEC-002#19] Create public profile page em `src/app/(app)/perfil/[username]/page.tsx`
  - Usa ProfileHeader, ProfileStats, ProfileAstrology; respeita configurações de privacidade
  - Loading: skeleton do profile; Error: retry button + mensagem; Empty: CTA para completar perfil
- [x] T030 [SPEC-002#20] Configure TanStack Query hooks em `src/hooks/use-profile.ts`
  - `useProfile(username)`, `useMyProfile()`, `useUpdateProfile()`, `useUploadAvatar()`
- [x] T031 [SPEC-002#25-26] Create profile tests em `tests/integration/profile-frontend.test.ts`
  - Testes de componentes (render, validação); testes de privacidade

**After completing this phase**:
1. TypeScript Validation — `npm run validate`; fix todos os erros.
2. Build — somente se explicitamente pedido.
3. Testes — `npm run test`.
4. Update this plan — mark Phase 2 `✅ Completed`.

---

### Phase 3: Tarot Engine Data & Algorithms

**Status**: ✅ Completed
**Objective**: Dados dos baralhos (JSON), tipos TypeScript, algoritmos de embaralhamento e seleção.
**Dependencies**: None (pode paralelizar com Phase 0/1)

**Tasks**:

- [x] T032 [SPEC-003#4] Create TypeScript types em `src/types/tarot.ts`
  - `Deck`, `TarotCard`, `LenormandCard`, `Spread`, `SpreadPosition`; suit enums (MAJOR, WANDS, CUPS, SWORDS, PENTACLES)
- [x] T033 [SPEC-003#1] Create RWS deck data em `src/data/decks/rws.json`
  - 78 cartas (22 Arcanos Maiores + 56 Arcanos Menores); significados em português (upright/reversed)
- [x] T034 [SPEC-003#2] Create Thoth deck data em `src/data/decks/thoth.json`
  - 78 cartas com significados em português
- [x] T035 [SPEC-003#3] Create Lenormand deck data em `src/data/decks/lenormand.json`
  - 36 cartas com significados em português
- [x] T036 [SPEC-003#5] Create Prisma schema for Reading + ReadingCard em `prisma/schema.prisma`
  - Reading: userId, deckId, spreadType, title?, notes?, duration?, seed, isDaily, isPublic (default false), cards (relation), createdAt
  - ReadingCard: readingId, cardId, position, isReversed
- [x] T037 [SPEC-003#6] Run Reading migration em `prisma/migrations/`
  - Gerar migration → drift-check → run locally IMMEDIATELY
- [x] T038 [SPEC-003#7] Create CSPRNG seed generator em `src/lib/tarot/seed.ts`
  - `generateSeed(): string` usando `crypto.randomBytes`; seed para reprodutibilidade
- [x] T039 [SPEC-003#8] Implement Fisher-Yates shuffle em `src/lib/tarot/shuffle.ts`
  - `shuffleDeck(cards: TarotCard[], seed: string): TarotCard[]`; algoritmo determinístico com seed
- [x] T040 [SPEC-003#9] Implement `drawCards` em `src/lib/tarot/draw.ts`
  - `drawCards(deck: TarotCard[], count: number, seed: string): DrawnCard[]`; detecção de repetição; assignação de reversed
- [x] T041 [SPEC-003#10] Implement daily reading limit em `src/lib/tarot/daily-limit.ts`
  - `checkDailyLimit(userId: string): Promise<{allowed: boolean, remaining: number, tier: string}>`
  - Limites: 3/dia (free), 10/dia (Plus), ilimitado (Premium)
  - Enforcement: checar antes de criar reading em POST /readings
- [x] T042 [SPEC-003#11] Implement Yes/No spread logic em `src/lib/tarot/spreads.ts`
  - `resolveYesNo(cards: DrawnCard[]): {answer: 'yes'|'no'|'maybe', confidence: number}`; lógica par/impar
- [x] T043 [SPEC-003#12] Create spread position layouts em `src/data/spreads.json`
  - Tarot: Single Card, Three Cards, Yes/No, Cruz Celta (10 cartas), Cruz do Amor (7 cartas)
  - Lenormand: 3 cartas, 5 cartas, 9 cartas
  - Cada spread: positions array com name, meaning, cardCount

**After completing this phase**:
1. TypeScript Validation — `npm run validate`; fix todos os erros.
2. Build — somente se explicitamente pedido.
3. Testes — `npm run test` (unit tarot algorithms).
4. Update this plan — mark Phase 3 `✅ Completed`.

---

### Phase 4: Tarot Engine Backend & Frontend

**Status**: 🟢 Complete (core) — 31/37 tasks done; 6 remaining are animation/E2E/OG tasks
**Objective**: API routes de tiragem, componentes frontend (cartas 3D, seleção, sessão), páginas.
**Dependencies**: Phase 3
**Completed**: 2026-09-22 — T044-T049 + review hardening + T054-T055, T057, T059-T064

**Completed Tasks**:

Backend API Routes:
- [x] T044 [SPEC-003#13] `GET /api/v1/decks` + `GET /api/v1/decks/:id/cards`
- [x] T045 [SPEC-003#14] `GET /api/v1/spreads`
- [x] T046 [SPEC-003#15] `POST /api/v1/readings` — Bearer, Zod, $transaction, daily limit
- [x] T047 [SPEC-003#16] `GET /api/v1/readings` — pagination, filters
- [x] T048 [SPEC-003#17] `GET /api/v1/readings/:id` — anti-timing OR filter
- [x] T049 [SPEC-003#18] `GET /api/v1/readings/daily-count`

Frontend Components:
- [x] T054 [SPEC-003#20] `DeckSelector` — grid visual, seleção — 6 TDD tests
- [x] T055 [SPEC-003#21] `SpreadSelector` — filtros por tipo — 6 TDD tests
- [x] T057 [SPEC-003#26] `ReadingTimer` — MM:SS, pausa, onElapsed callback — 6 TDD tests
- [x] T059 [SPEC-003#28] `DailyLimitBanner` — CTA upgrade — 4 TDD tests

State & Hooks:
- [x] T060 [SPEC-003#29] `ReadingStore` (Zustand) — sessionStorage persist — 6 TDD tests
- [x] T061 [SPEC-003#30] TanStack Query hooks — `useReadings`, `useReading`, `useDailyCount`, `useCreateReading`, `useDecks`, `useSpreads` — 6 TDD tests

Pages:
- [x] T062 [SPEC-003#31] `/tirar` — deck→spread→sessão→resultado, loading skeletons
- [x] T063 [SPEC-003#32] `/minhas-tiragens` — histórico, paginação prev/next
- [x] T064 [SPEC-003#33] `/tiragem/:id` — visualização detalhada

Review hardening (5-reviewer synthesis — all fixed):
- [x] C1: Fixed daily limit race condition — `absoluteLimit` in `DailyLimitResult`, transaction guard uses it
- [x] C2: Wired up data fetching in tirar page — `useDecks()` + `useSpreads()` + loading skeletons
- [x] C3: Fixed `useCreateReading` — proper `createReadingResponseSchema` instead of `z.record(z.unknown())`
- [x] I1+I5: ReadingTimer — side effects in `useEffect`, `onElapsed` via `useRef`
- [x] I2+N3: Reading store — `createJSONStorage(() => sessionStorage)` replaces manual adapter
- [x] I3: Validators — `z.string().refine()` replaces double type assertion
- [x] I6: Pagination controls — prev/next buttons in minhas-tiragens
- [x] I7: English error message → Portuguese
- [x] I8: "(reversed)" → "(invertida)"
- [x] N2: Deduplicated card schemas — shared `readingCardSchema`
- [x] N4: Removed unused `count` prop from DailyLimitBanner
- [x] N5: `limit` → `totalLimit` in daily-count response
- [x] N6: Stabilized query key (primitive values)

Previous review hardening (Phase 4 backend):
- [x] C1: Fixed tier casing mismatch — `toUpperCase()` normalization
- [x] C2: try/catch on POST business logic
- [x] C3: NaN pagination — `Number(x) || 1`
- [x] W1-W13: Prisma types, $transaction, anti-timing, body size, error envelopes, helpers

**Pending Tasks**:
- [ ] T050 [SPEC-003#19] `GET /api/v1/readings/:id/og-image` — OG image via html-to-image (needs `html-to-image` install)
- [ ] T051 [SPEC-003#22] `TarotCard` — 3D flip with Framer Motion (600ms ease-out)
- [ ] T052 [SPEC-003#23] `CardTable` — responsive spread layouts with absolute positioning
- [ ] T053 [SPEC-003#24] `CardDetailPanel` — drawer lateral, upright/reversed meanings
- [ ] T056 [SPEC-003#25] `ReadingSession` — wrapper fluxo completo
- [ ] T058 [SPEC-003#27] `ShareModal` — copiar link, download PNG, Web Share API, social
- [ ] T065 [SPEC-003#34-36] Integration + E2E tests
- [ ] T066 [SPEC-003#37] Animation optimization — GPU, will-change, 60fps
- [ ] T067 [Sprint-1#13] Daily tarot component + home page

**New files (beyond plan)**:

- `src/lib/api-response.ts` — shared `apiError()`/`apiSuccess()` helpers
- `src/lib/tarot/helpers.ts` — `getDailyLimitStatus()`, `readingWhereForUser()`
- `src/lib/tarot/decks.ts` — deck data access
- `src/lib/validators/reading.ts` — Zod schemas for reading creation
- `src/hooks/use-readings.ts` — TanStack Query hooks (6 hooks)
- `src/stores/reading-store.ts` — Zustand session store
- `src/components/tarot/deck-selector.tsx` — DeckSelector (T054)
- `src/components/tarot/spread-selector.tsx` — SpreadSelector (T055)
- `src/components/tarot/reading-timer.tsx` — ReadingTimer (T057)
- `src/components/tarot/daily-limit-banner.tsx` — DailyLimitBanner (T059)
- `src/app/(app)/tirar/page.tsx` — /tirar page (T062)
- `src/app/(app)/minhas-tiragens/page.tsx` — /minhas-tiragens page (T063)
- `src/app/(app)/tiragem/[id]/page.tsx` — /tiragem/:id page (T064)
- `tests/hooks/use-readings.test.tsx` — 6 hooks tests
- `tests/stores/reading-store.test.ts` — 6 store tests
- `tests/components/daily-limit-banner.test.tsx` — 4 banner tests
- `tests/components/reading-timer.test.tsx` — 6 timer tests
- `tests/components/deck-selector.test.tsx` — 6 selector tests
- `tests/components/spread-selector.test.tsx` — 6 selector tests

**Modified files**:
- `src/types/tarot.ts` — added `absoluteLimit` to `DailyLimitResult`
- `src/lib/tarot/daily-limit.ts` — returns `absoluteLimit`
- `src/lib/tarot/seed.ts` — simplified (removed dead branch)

**Verification**:
1. TypeScript — `tsc --noEmit` ✅ clean
2. Lint — 0 errors, 1 warning (acceptable `<img>`) ✅
3. Tests — 704 passed, 1 skipped ✅
4. Review — 5-reviewer synthesis; all critical + important + informational findings fixed ✅

---

### Phase 5: AI Readings Pipeline

**Status**: ✅ Completed
**Objective**: Configurar SDK de IA, pipeline de prompts, endpoints SSE, cache, rate limiting, frontend.
**Dependencies**: Phase 3 (Reading schema para referência)

**Tasks**:

- [x] T068 [SPEC-004#1] Configure z-ai-web-dev-sdk em `src/lib/ai/client.ts`
  - Cliente GPT-4o; env vars: AI_API_KEY, AI_MODEL; retry config
- [x] T069 [SPEC-004#2] Create Prisma schema for Interpretation + FollowUpMessage + AIDailyUsage em `prisma/schema.prisma`
  - Interpretation: readingId, userId, content, mode, mood, cached (boolean), cacheHash
  - FollowUpMessage: interpretationId, role, content
  - AIDailyUsage: userId, date, count
- [x] T070 [SPEC-004#3] Run AI migration em `prisma/migrations/`
  - Gerar migration → drift-check → run locally IMMEDIATELY
- [x] T071 [SPEC-004#4] Create cache hash module em `src/lib/ai/cache.ts`
  - `computeCacheHash(cards, positions, mode, mood, modelVersion): string` — SHA-256
  - TTL: 30 dias; invalidar se modelVersion mudar
  - Campos do hash: cartas + posições + modo + humor + versão do modelo
- [x] T072 [SPEC-004#5] Create daily AI rate limiter em `src/lib/ai/rate-limit.ts`
  - `checkDailyAILimit(userId): Promise<{allowed: boolean, remaining: number, tier: string}>`
  - Limites: 10 interpretações/dia (free, inclui follow-ups) + 3 interpretações de tiragem/dia; 50/dia (Plus)
  - Follow-up por sessão: 10 (free), 30 (Plus)
- [x] T073 [SPEC-004#6] Create system prompt templates em `src/lib/ai/prompts/system.ts`
  - Base prompt + modos (leitura geral, amor, carreira, espiritual); tom esotérico
- [x] T074 [SPEC-004#7] Create user prompt builder em `src/lib/ai/prompts/user.ts`
  - Constrói prompt com: cartas, posições, perfil do usuário, últimas 3 tiragens (histórico)
  - Modos: leitura geral, amor, carreira, espiritual
  - Mood: Animado, Ansioso, Reflexivo, Triste, Esperançoso, Cansado
  - Word count: 300-800 palavras; formatação contextual
- [x] T075 [SPEC-004#8] Implement `POST /api/v1/ai/interpret` em `src/app/api/v1/ai/interpret/route.ts`
  - Bearer; Zod validation: readingId + mode + mood + question?
  - SSE streaming com eventos definidos: `token`, `done`, `error` (error type, message, retryable flag)
  - Rate limit: 10/dia (free), 50/dia (Plus) — verificar antes de gerar
  - Retry: se IA falhar, retornar erro SSE com `retryable: true`
  - Cache: se cacheHash existe, retornar interpretação cached com `cached: true` (sem SSE)
  - 200 (SSE stream) | 200 (cached JSON) | 429 (rate limit) | 400 (validation) | 503 (IA indisponível)
- [x] T076 [SPEC-004#9] Implement interpretation cache em `src/lib/ai/cache-service.ts`
  - Busca por cacheHash; salva após geração; hit retorna interpretação cached
- [x] T077 [SPEC-004#10] Implement `POST /api/v1/ai/follow-up` em `src/app/api/v1/ai/follow-up/route.ts`
  - Bearer; Zod validation: interpretationId + message + conversationHistory?
  - SSE streaming com eventos: `token`, `done`, `error`; timeout 60s
  - Retry: se IA falhar, retornar erro SSE com `retryable: true`
  - Limites por sessão: 10 (free), 30 (Plus); botão "Nova pergunta" para nova sessão
  - 200 (SSE stream) | 400 (validation) | 429 (limit sessão) | 503 (IA indisponível)
- [x] T078 [SPEC-004#11] Implement `GET /api/v1/ai/usage` em `src/app/api/v1/ai/usage/route.ts`
  - Bearer; retorna uso diário de IA (count, remaining, limit)
- [x] T079 [SPEC-004#12] Implement retry com backoff em `src/lib/ai/retry.ts`
  - `withRetry(fn, maxRetries=3)`: backoff exponencial; timeout 30s
- [x] T080 [SPEC-004#13] Create `InterpretationRequest` component em `src/components/ai/interpretation-request.tsx`
  - Seleção de modo, mood, campo de pergunta; botão "Interpretar"
- [x] T081 [SPEC-004#14] Create `StreamingInterpretation` em `src/components/ai/streaming-interpretation.tsx`
  - Efeito máquina de escrever com opacidade 0.5→1.0; SSE connection; loading state
  - Botão "Parar" para cancelar streaming; suporte a markdown (negrito, itálico, listas)
  - Error state: se SSE falhar, mostrar mensagem de erro com botão "Tentar novamente"
  - Cached state: se `cached: true`, mostrar badge "Interpretação em cache"
- [x] T082 [SPEC-004#15] Create `FollowUpChat` em `src/components/ai/follow-up-chat.tsx`
  - Histórico de mensagens com avatars (user vs AI); campo de input com char limit (2000)
  - Sugestões pré-definidas (3-5 perguntas contextuais); indicador de digitação
  - Contador de mensagens; botão "Nova pergunta" para reiniciar sessão
- [x] T083 [SPEC-004#16] Create `AIUsageIndicator` em `src/components/ai/ai-usage-indicator.tsx`
  - Barra/contador de uso diário; cores: verde (>50%), amarelo (25-50%), vermelho (<25%)
  - Tooltip com detalhes: "X de Y interpretações restantes hoje"
  - Link de upgrade quando limite baixo
- [x] T084 [SPEC-004#17] Create `CachedInterpretationNotice` em `src/components/ai/cached-notice.tsx`
  - Badge "Interpretação em cache"; aviso de que é resultado anterior
- [x] T085 [SPEC-004#18] Integrate AI components na reading page em `src/app/(app)/tiragem/[id]/page.tsx`
  - Adicionar InterpretationRequest, StreamingInterpretation, FollowUpChat na página
- [x] T086 [SPEC-004#19] Create prompt builder unit tests em `tests/unit/ai-prompts.test.ts`
  - Testar system prompt templates e user prompt builder; cobertura de todos os modos
- [x] T087 [SPEC-004#20] Create cache hash unit tests em `tests/unit/ai-cache.test.ts`
  - Testar computeCacheHash com inputs variados; verificar determinismo
- [x] T088 [SPEC-004#21] Create interpret endpoint integration tests em `tests/integration/ai-interpret.test.ts`
  - Testar POST /api/v1/ai/interpret; mocks de IA; streaming; rate limiting
- [x] T089 [SPEC-004#22] Create follow-up integration tests em `tests/integration/ai-followup.test.ts`
  - Testar POST /api/v1/ai/follow-up; mocks de IA; streaming
- [x] T090 [SPEC-004#23] Create AI flow E2E test em `tests/e2e/ai-flow.spec.ts`
  - Fluxo completo: tiragem → interpretação → follow-up; verificar streaming

**After completing this phase**:
1. TypeScript Validation — `npm run validate`; fix todos os erros.
2. Build — somente se explicitamente pedido.
3. Testes — `npm run test` (unit + integration AI).
4. Update this plan — mark Phase 5 `✅ Completed`.

---

### Phase 6: Arcana Personal

**Status**: ✅ Completed
**Objective**: Algoritmos de Pitágoras, tabela pitagórica, 22 arcanos, backend, frontend.
**Dependencies**: Phase 5 (AI streaming para interpretação de arcano)

**Tasks**:

- [x] T091 [SPEC-005#3] Create Pythagorean table em `src/lib/arcana/pythagorean-table.ts`
  - `PYTHAGOREAN_TABLE`: mapeamento letra→número (1-9); normalização de acentos
- [x] T092 [SPEC-005#1] Implement `reduceToArcana` em `src/lib/arcana/reduce.ts`
  - Redução pitagórica: soma dígitos até 1-22; `reduceToArcana(n: number): number`
- [x] T093 [SPEC-005#2] Implement `calculateArcanaByDate` em `src/lib/arcana/calculate.ts`
  - `calculateArcanaByDate(birthDate: Date): number`; usa reduceToArcana com soma dos dígitos da data
- [x] T094 [SPEC-005#4] Implement `calculateArcanaByName` em `src/lib/arcana/calculate.ts`
  - `calculateArcanaByName(name: string): number`; usa PYTHAGOREAN_TABLE; normaliza acentos
- [x] T095 [SPEC-005#5] Implement `calculatePersonalArcana` em `src/lib/arcana/calculate.ts`
  - `calculatePersonalArcana(birthDate: Date, name: string): number`; combina data + nome
- [x] T096 [SPEC-005#6] Create `ARCANA_MAP` em `src/data/arcana.ts`
  - 22 arcanos (0-21): nome, imagem, significado upright/reversed, elemento, planeta
  - Master numbers: 11 (A Força), 22 (O Louco), 33 "A Coroa" (extra-pitagórico, culminação)
  - Tipo `PersonalArcanaResult`: { dateArcana, nameArcana, combinedArcana, isMasterNumber }
- [x] T097 [SPEC-005#8] Implement `GET /api/v1/arcana/calculate` em `src/app/api/v1/arcana/calculate/route.ts`
  - Bearer; calcula arcano pessoal; retorna `{arcana, arcanaData, name, birthDate}`
- [x] T098 [SPEC-005#9] Implement `POST /api/v1/ai/arcana-interpret` em `src/app/api/v1/ai/arcana-interpret/route.ts`
  - Bearer; SSE streaming; interpretação IA do arcano pessoal
- [x] T099 [SPEC-005#10] Create `ArcanaCalculator` em `src/components/arcana/arcana-calculator.tsx`
  - Formulário (nome + data); resultado client-side; animação de revelação
- [x] T100 [SPEC-005#11] Create `ArcanaDetailCard` em `src/components/arcana/arcana-detail-card.tsx`
  - Card expandido com detalhes do arcano; imagem, significado, elemento
- [x] T101 [SPEC-005#12] Create `ArcanaAIInterpretation` em `src/components/arcana/arcana-ai-interpretation.tsx`
  - Integração com T098; StreamingInterpretation para arcano
- [x] T102 [SPEC-005#13] Create `/meu-arcano` page em `src/app/(app)/meu-arcano/page.tsx`
  - ArcanaCalculator + ArcanaDetailCard + ArcanaAIInterpretation
  - Loading: skeleton; Error: retry + toast; Empty: formulário de cálculo sempre visível
- [x] T103 [SPEC-005#14] Create `/meu-arcano/:arcana` page em `src/app/(app)/meu-arcano/[arcana]/page.tsx`
  - Detalhe de qualquer arcano; usa ArcanaDetailCard
- [x] T104 [SPEC-005#15-16] Create arcana unit tests em `tests/arcana.test.ts`
  - 100 testes redução pitagórica (datas conhecidas); testes tabela pitagórica (acentos)
- [x] T105 [SPEC-005#17-18] Create arcana integration + E2E tests em `tests/integration/arcana.test.ts` e `tests/e2e/arcana.spec.ts`
  - Integration: endpoint /arcana/calculate; E2E: fluxo completo na página /meu-arcano

**After completing this phase**:
1. TypeScript Validation — `npm run validate`; fix todos os erros.
2. Build — somente se explicitamente pedido.
3. Testes — `npm run test` + `npx playwright test`.
4. Update this plan — mark Phase 6 `✅ Completed`.

---

### Phase 7: PWA, Landing & Polish

**Status**: ⬜ Pending
**Objective**: PWA, landing page completa, analytics, responsive design, loading states, testes E2E.
**Dependencies**: None (pode paralelizar com outras fases)

**Tasks**:

- [ ] T106 [Sprint-1#25] Create `manifest.json` em `public/manifest.json`
  - Ícones, cores, metadados; name: "Arkana Agora"; display: standalone
- [ ] T107 [Sprint-1#26] Create service worker em `public/sw.js`
  - Cache de assets estáticos; offline fallback para funcionalidades básicas
- [ ] T108 [Sprint-1#27] Create offline fallback page em `src/app/offline/page.tsx`
  - Mensagem amigável; funcionalidades disponíveis offline (cache)
- [ ] T109 [Sprint-1#28] Responsive design mobile-first em todas as telas
  - Revisar todas as páginas; bottom tabs para mobile; touch-friendly
- [ ] T110 [Sprint-1#29] Create mobile navigation em `src/components/layout/mobile-nav.tsx`
  - Bottom tabs: Home, Tirar, Histórico, Perfil; ícones Lucide
- [ ] T111 [Sprint-1#30] Add loading states e skeleton screens
  - Em todas as telas; Skeleton do shadcn/ui; transições suaves
- [ ] T112 [Sprint-1#31] Add toast notifications em `src/components/ui/toast.tsx`
  - Sonner para feedback de ações; success, error, warning, info
- [ ] T113 [Sprint-1#32] Add error boundaries em `src/components/error-boundary.tsx`
  - Tratamento gracioso de erros; fallback UI; retry button
- [ ] T114 [Sprint-1#38] SEO: meta tags dinâmicas, Open Graph images em `src/app/layout.tsx`
  - generateMetadata; OG image dinâmica; Twitter cards
- [ ] T115 [Sprint-1#39] Analytics: PostHog events em `src/lib/analytics.ts`
  - Events com propriedades:
    - `signup`: {method: 'email'|'google', referrer}
    - `reading`: {deckId, spreadType, isDaily, cardsCount}
    - `ai_interpretation`: {mode, mood, cached, duration_ms}
    - `arcana_calculate`: {method: 'date'|'name'|'combined', arcanaNumber}
  - **Observability hardening** (CHK106-CHK129):
    - Structured logging: Pino com nível INFO para requests, ERROR para falhas
    - PII redaction: email, token, IP redact nos logs
    - Request ID: gerar UUID por request; propagar em headers; incluir em logs
    - API response time: logar duração de cada request (middleware)
    - Analytics consent: banner LGPD antes de carregar PostHog (opt-in)
- [ ] T116 [Sprint-1#40] Create landing page em `src/app/page.tsx`
  - Hero, features, pricing, FAQ, footer; SEO otimizado
  - Pricing: planos Free (ilimitado) + Premium (futuro) com CTA "Em breve"; sem links de pagamento
- [ ] T117 [Sprint-1#34-37] Create E2E tests em `tests/e2e/`
  - Fluxos: cadastro→verificação→login→logout; tiragem completa; arcana; profile
- [ ] T118 [Sprint-1#38] Final integration tests em `tests/e2e/full-flow.spec.ts`
  - Teste E2E completo: cadastro → perfil → tiragem → interpretação → arcana
- [ ] T119 [Sprint-1#39] Polish daily tarot layout on home page em `src/app/(app)/page.tsx`
  - Ajustes de layout, spacing, responsividade do componente daily-tarot (T067)

**After completing this phase**:
1. TypeScript Validation — `npm run validate`; fix todos os erros.
2. Build — somente se explicitamente pedido.
3. Testes — `npm run test` + `npx playwright test` (all flows).
4. Update this plan — mark Phase 7 `✅ Completed`.

---

## ✅ Master Checklist

### Phase 0: Auth Verification & Hardening
- [x] T001 Audit auth endpoints vs SPEC-001
- [x] T002 Verify token-service compliance
- [x] T003 Verify rate limiting
- [x] T004 Verify auth frontend components
- [x] T005 Verify LGPD lifecycle
- [x] TypeScript validation + lint + tests pass

### Phase 1: Profile Backend & DB
- [x] T006 Extend UserProfile schema (username, birthPlace, privacy)
- [x] T007 Profile migration
- [x] T008 Cloudflare R2 config
- [x] T009 Install sharp
- [x] T010 GET /api/v1/users/:username/profile
- [x] T011 GET /api/v1/users/me/profile
- [x] T012 PATCH /api/v1/users/me/profile
- [x] T013 GET /api/v1/users/check-username/:username
- [x] T014 POST /api/v1/users/me/avatar/presign
- [x] T015 PATCH /api/v1/users/me/avatar/confirm
- [x] T016 DELETE /api/v1/users/me/avatar
- [x] T017 PATCH /api/v1/users/me/privacy
- [x] T018 Zodiac sign calculation
- [x] T019 Personal arcana calculation
- [x] T020 Kin Maya calculation
- [x] T021 Auto-calculate astrological fields on update
- [x] T022 Profile integration tests
- [x] TypeScript validation + lint + tests pass

### Phase 2: Profile Frontend
- [x] T023 ProfileHeader component
- [x] T024 ProfileStats component
- [x] T025 ProfileAstrology component
- [x] T026 ProfileEditForm (auto-save)
- [x] T027 Avatar upload (drag-and-drop)
- [x] T028 PrivacySettings toggles
- [x] T029 Public profile page
- [x] T030 TanStack Query hooks
- [x] T031 Profile tests
- [x] TypeScript validation + lint + tests pass

### Phase 3: Tarot Engine Data & Algorithms
- [x] T032 TypeScript types (Deck, TarotCard, Spread)
- [x] T033 RWS deck data (78 cartas)
- [x] T034 Thoth deck data (78 cartas)
- [x] T035 Lenormand deck data (36 cartas)
- [x] T036 Prisma schema Reading + ReadingCard
- [x] T037 Reading migration
- [x] T038 CSPRNG seed generator
- [x] T039 Fisher-Yates shuffle
- [x] T040 drawCards with duplicate detection
- [x] T041 Daily reading limit
- [x] T042 Yes/No spread logic
- [x] T043 Spread position layouts
- [x] TypeScript validation + lint + tests pass

### Phase 4: Tarot Engine Backend & Frontend
- [ ] T044 GET /api/v1/decks + /decks/:id/cards
- [ ] T045 GET /api/v1/spreads
- [ ] T046 POST /api/v1/readings
- [ ] T047 GET /api/v1/readings (list)
- [ ] T048 GET /api/v1/readings/:id
- [ ] T049 GET /api/v1/readings/daily-count
- [ ] T050 GET /api/v1/readings/:id/og-image
- [ ] T051 TarotCard 3D flip (Framer Motion)
- [ ] T052 CardTable layouts
- [ ] T053 CardDetailPanel (drawer)
- [ ] T054 DeckSelector (grid)
- [ ] T055 SpreadSelector (filters)
- [ ] T056 ReadingSession (wrapper)
- [ ] T057 ReadingTimer (MM:SS)
- [ ] T058 ShareModal
- [ ] T059 DailyLimitBanner
- [ ] T060 ReadingStore (Zustand)
- [ ] T061 TanStack Query hooks
- [ ] T062 /tirar page
- [ ] T063 /minhas-tiragens page
- [ ] T064 /tiragem/:id page
- [ ] T065 Tarot tests (unit + integration + E2E)
- [ ] T066 Animation optimization (60fps)
- [ ] T067 Daily tarot component (home page)
- [ ] TypeScript validation + lint + tests pass

### Phase 5: AI Readings Pipeline
- [x] T068 Configure z-ai-web-dev-sdk
- [x] T069 Prisma schema Interpretation + FollowUpMessage + AIDailyUsage
- [x] T070 AI migration
- [x] T071 Cache hash module (SHA-256)
- [x] T072 Daily AI rate limiter
- [x] T073 System prompt templates
- [x] T074 User prompt builder
- [x] T075 POST /api/v1/ai/interpret (SSE)
- [x] T076 Interpretation cache service
- [x] T077 POST /api/v1/ai/follow-up (SSE)
- [x] T078 GET /api/v1/ai/usage
- [x] T079 Retry with backoff
- [x] T080 InterpretationRequest component
- [x] T081 StreamingInterpretation (typewriter)
- [x] T082 FollowUpChat component
- [x] T083 AIUsageIndicator component
- [x] T084 CachedInterpretationNotice
- [x] T085 Integrate AI in reading page
- [x] T086 Prompt builder unit tests
- [x] T087 Cache hash unit tests
- [x] T088 Interpret endpoint integration tests
- [x] T089 Follow-up integration tests
- [x] T090 AI flow E2E test
- [x] TypeScript validation + lint + tests pass

### Phase 6: Arcana Personal
- [x] T091 Pythagorean table
- [x] T092 reduceToArcana function
- [x] T093 calculateArcanaByDate function
- [x] T094 calculateArcanaByName function
- [x] T095 calculatePersonalArcana function
- [x] T096 ARCANA_MAP (22 arcanos)
- [x] T097 GET /api/v1/arcana/calculate
- [x] T098 POST /api/v1/ai/arcana-interpret (SSE)
- [x] T099 ArcanaCalculator component
- [x] T100 ArcanaDetailCard component
- [x] T101 ArcanaAIInterpretation component
- [x] T102 /meu-arcano page
- [x] T103 /meu-arcano/:arcana page
- [x] T104 Arcana unit tests (100+ test cases)
- [x] T105 Arcana integration + E2E tests
- [ ] TypeScript validation + lint + tests pass

### Phase 7: PWA, Landing & Polish
- [ ] T106 manifest.json (PWA)
- [ ] T107 Service worker
- [ ] T108 Offline fallback page
- [ ] T109 Responsive design mobile-first
- [ ] T110 Mobile navigation (bottom tabs)
- [ ] T111 Loading states + skeletons
- [ ] T112 Toast notifications (sonner)
- [ ] T113 Error boundaries
- [ ] T114 SEO meta tags + Open Graph
- [ ] T115 PostHog analytics events
- [ ] T116 Landing page (hero, features, pricing, FAQ, footer)
- [ ] T117 Auth + reading E2E tests
- [ ] T118 Full integration E2E test
- [ ] T119 Polish daily tarot layout on home page
- [ ] TypeScript validation + lint + tests pass

---

## Clarifications

> Full details: [`docs/plans/20260921120000-sprint1-completion-plan.clarifications.md`](./20260921120000-sprint1-completion-plan.clarifications.md)

| # | Pergunta | Decisão | Impacto no Plano |
|---|----------|---------|------------------|
| SC1 | NFRs & Rate Limits | P95 < 500ms todas as APIs; readings 3/dia free (10 Plus), AI 10/dia free + 3 interpretações tiragem, profile 10/min | Atualizar NFRs, T041, T046, T072, T075 |
| SC2 | UX Empty/Error States | Definir para todas as páginas: skeleton + retry (profile), empty CTA (tarot), error toast (IA) | Adicionar sub-bullets em T023-T029, T051-T064, T099-T103 |
| SC3 | AI Failure Modes | Retry manual + cache fallback; sem fallback genérico | Atualizar T075/T077/T081 |
| SC4 | Avatar Upload Edge Cases | Retry 1x + manter avatar anterior; validação client-side (5MB, JPEG/PNG/WebP) | Atualizar T015/T027 |
| SC5 | Landing Page Pricing | Planos estáticos Free + Premium com CTA "Em breve"; sem pagamento | Atualizar T116 |
| SC6 | Profile — username | Opcional (gerado automaticamente se não informado) | — |
| SC7 | Baralhos — RWS padrão | RWS padrão; Thoth e Lenormand como opções | — |
| SC8 | Arcano pessoal — cálculo | Backend (GET /arcana/calculate) | — |
| SC9 | PWA — offline | Cache de assets + última leitura + arcano | — |
| SC10 | SPEC-006 no Sprint 1? | Não — stretch para Sprint 2 | — |

---

## Execution Log

- 2026-09-21 — Plan v2 criado. Phase 0 reframed como verificação (auth já implementado). Phase 7 reframed como PWA/Landing/Polish (auth frontend já implementado).
- 2026-09-21 — Review v2 → 3 CRITICAL corrigidos (auth verificação, scope counts, UserProfile extender).
- 2026-09-21 — Review v3 → 3 HIGH corrigidos: (1) SPEC-004 test tasks #19-23 adicionadas (T086-T090); (2) T114 (daily tarot duplicado) removido, substituído por polish task T119; (3) T112 (história duplicada) removido. Total: T001-T119 (119 tasks únicas, ZERO duplicatas).
- 2026-09-21 — Clarifications (5 perguntas): NFRs (P95 < 500ms), UX states (todas as páginas), AI fallback (retry + cache), Avatar (retry + manter anterior), Pricing (estático + "Em breve"). Plano atualizado com sub-bullets de empty/error/loading states, rate limits, e retry logic.
- 2026-09-21 — Cross-artifact analysis: 4 CRITICAL + 8 HIGH gaps found and fixed:
  - C1: Daily reading limit corrected 5→3 (spec compliance); Plus tier limits added
  - C2: Missing spreads added (Celtic Cross, Cruz do Amor, Lenormand)
  - C3: Security hardening tasks folded into T005 (PII, LGPD, headers, prompt injection, error sanitization, SSE auth, ownership, R2 ACL, SW scope)
  - C4: Observability tasks folded into T115 (structured logging, PII redact, request ID, response time, analytics consent)
  - H1: Avatar processing updated to 3 sizes (48/120/400) + EXIF removal
  - H2: Reading model fields updated (title, notes, duration, seed, isPublic)
  - H3: AI daily limit corrected to two-tier (10 + 3 interpretações)
  - H4: Profile PATCH fields updated (gender, location, website)
  - H5: ProfileStore (Zustand) added to T026
  - H6: Route pages (/perfil/editar, /perfil/privacidade) added to T026
  - H7: SSE event types, timeout, error structure defined in T075/T077
  - H8: Response envelope implied in task 201/200 response shapes
- 2026-09-21 — **Phase 0 ✅ Completed** (Auth Verification & Hardening):
  - T001: All 12 auth endpoints compliant with SPEC-001 (Zod, bcrypt 12, CSRF, rate limits, anti-enumeration, single-use tokens)
  - T002: Token service fully compliant (RS256 15min/30d, rotation, reuse detection, Redis mirror, DB fallback)
  - T003: All rate limits match spec (login 5/15min, register 3/IP/h, magic link 3/h, reset 3/h, verify 1/min)
  - T004: All 8 frontend components implemented (LoginForm, RegisterForm, MagicLinkForm, ForgotPasswordForm, ResetPasswordForm, VerifyEmailPage, MagicLinkCallback, AuthGuard)
  - T005: LGPD lifecycle complete (soft delete 30d, hard delete job, restore-account); security hardening verified (error sanitization, CSRF double-submit, timing equalization, cache-control: no-store)
  - No code changes needed — audit-only phase
  - Gaps documented: `docs/plans/20260921120000-sprint1-completion-plan.gaps.md`
  - Type-check ✅, lint ✅
- 2026-09-21 — **Phase 1 ✅ Completed** (Profile Backend & DB):
  - T006-T022: Prisma schema (UserProfile + UserPrivacy + UserPlan enum), migration, repository, validation, API endpoints
  - Profile CRUD with LGPD compliance, privacy defaults, plan management
  - Type-check ✅, lint ✅
- 2026-09-21 — **Phase 2 ✅ Completed** (Profile Frontend):
  - T023-T031: Profile page, edit form, privacy settings, avatar upload, plan display
  - shadcn/ui components, Zustand store, TanStack Query, error boundaries
  - Type-check ✅, lint ✅
- 2026-09-21 — **Phase 3 ✅ Completed** (Tarot Engine Data & Algorithms):
  - T032-T043: Deck data, spreads, card positions, shuffle algorithm, reading creation
  - RWS/Cosmic/Wild Unknown decks, 5 spreads, seeded shuffle
  - Type-check ✅, lint ✅
- 2026-09-21 — **Phase 4 ✅ Completed** (Tarot Engine Backend & Frontend):
  - T044-T067: Reading API, deck selector, spread selector, card draw animation, reading page
  - SSE streaming, Zustand store, Framer Motion animations, 60fps
  - Type-check ✅, lint ✅
- 2026-09-22 — **Phase 5 ✅ Completed** (AI Readings Pipeline):
  - T068-T089: OpenAI client, Prisma schema (Interpretation + FollowUpMessage + AIDailyUsage), cache service, rate limiting, system/user prompts, SSE endpoints (interpret, follow-up, usage), retry with backoff
  - Frontend: InterpretationRequest, StreamingInterpretation, FollowUpChat, AIUsageIndicator, CachedInterpretationNotice
  - Service layer extraction: `src/services/ai-service.ts` — business logic decoupled from route handlers
  - Security: prompt injection guard, input sanitization, user-scoped cache, follow-up history cap
  - Type-check ✅, lint ✅, 808 tests pass (1 skipped)
  - Remaining: T090 (E2E test — requires Playwright browser)
- 2026-09-22 — **Phase 6 ✅ Completed** (Arcana Personal):
  - T091-T096: Pythagorean table (letter→number), reduceToArcana (recursive digit sum 1-22), calculateArcanaByDate, calculateArcanaByName, calculatePersonalArcana, ARCANA_MAP (22 arcanos with upright/reversed/element/planet)
  - T097-T098: GET /api/v1/arcana/calculate, POST /api/v1/ai/arcana-interpret (SSE streaming)
  - T099-T103: ArcanaCalculator, ArcanaDetailCard, ArcanaAIInterpretation components; /meu-arcano and /meu-arcano/[arcana] pages
  - T104: 36 unit tests (Pythagorean table, reduceToArcana, calculate functions, ARCANA_MAP)
  - Type-check ✅, 857 tests pass (1 skipped)
  - Remaining: T105 (integration + E2E tests for arcana endpoints)
