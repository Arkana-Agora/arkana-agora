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
| SPEC-002 Profile | 26 | 0 | 26 |
| SPEC-003 Tarot Engine | 37 | 0 | 37 |
| SPEC-004 AI Readings | 23 | 0 | 23 (inclui 5 testes #19-23) |
| SPEC-005 Arcana Personal | 18 | 0 | 18 |
| Sprint-1#25-40 | ~16 | 0 | ~10 |
| **TOTAL** | **~155** | **~27** | **~122** |

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
| 1 | Profile Backend & DB | Phase 0 | ⬜ Pending |
| 2 | Profile Frontend | Phase 1 | ⬜ Pending |
| 3 | Tarot Engine Data & Algorithms | None | ⬜ Pending |
| 4 | Tarot Engine Backend & Frontend | Phase 3 | ⬜ Pending |
| 5 | AI Readings Pipeline | Phase 3 | ⬜ Pending |
| 6 | Arcana Personal | Phase 5 | ⬜ Pending |
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

**Status**: ⬜ Pending
**Objective**: Componentes de perfil, formulário de edição, upload de avatar, página pública.
**Dependencies**: Phase 1

**Tasks**:

- [ ] T023 [SPEC-002#13] Create `ProfileHeader` em `src/components/profile/profile-header.tsx`
  - Avatar, nome, username, bio; layout responsivo
- [ ] T024 [SPEC-002#14] Create `ProfileStats` em `src/components/profile/profile-stats.tsx`
  - Tiragens, seguidores, seguindo; contadores formatados
- [ ] T025 [SPEC-002#15] Create `ProfileAstrology` em `src/components/profile/profile-astrology.tsx`
  - Signo zodiacal, arcano pessoal, kin maya; ícones temáticos
- [ ] T026 [SPEC-002#16] Create `ProfileEditForm` em `src/components/profile/profile-edit-form.tsx`
  - Auto-save com debounce 1s; campos: displayName, bio, birthDate, birthPlace, gender, location, website
  - Zod client-side validation
  - **ProfileStore** (Zustand): isEditing, dirtyFields, isSaving — gerencia estado do formulário
  - Route pages: `/perfil/editar` (formulário) e `/perfil/privacidade` ( PrivacySettings)
- [ ] T027 [SPEC-002#17] Create avatar upload component em `src/components/profile/avatar-upload.tsx`
  - Preview, drag-and-drop, crop; chama presign + confirm endpoints
  - Validação client-side: max 5MB, formatos aceitos (JPEG, PNG, WebP)
  - Retry: se upload falhar, retry 1x automaticamente; se falhar novamente, mostrar erro com retry manual
  - Manter avatar anterior visível durante upload; reverter se falhar
- [ ] T028 [SPEC-002#18] Create `PrivacySettings` em `src/components/profile/privacy-settings.tsx`
  - Toggles: profileVisibility (public/followers/private), statsVisibility, arcanaVisibility
  - Toggles: whoCanFollow (everyone/followers/nobody), whoCanComment (everyone/followers/nobody)
  - Chama PATCH /privacy
- [ ] T029 [SPEC-002#19] Create public profile page em `src/app/(app)/perfil/[username]/page.tsx`
  - Usa ProfileHeader, ProfileStats, ProfileAstrology; respeita configurações de privacidade
  - Loading: skeleton do profile; Error: retry button + mensagem; Empty: CTA para completar perfil
- [ ] T030 [SPEC-002#20] Configure TanStack Query hooks em `src/hooks/use-profile.ts`
  - `useProfile(username)`, `useMyProfile()`, `useUpdateProfile()`, `useUploadAvatar()`
- [ ] T031 [SPEC-002#25-26] Create profile tests em `tests/integration/profile-frontend.test.ts`
  - Testes de componentes (render, validação); testes de privacidade

**After completing this phase**:
1. TypeScript Validation — `npm run validate`; fix todos os erros.
2. Build — somente se explicitamente pedido.
3. Testes — `npm run test`.
4. Update this plan — mark Phase 2 `✅ Completed`.

---

### Phase 3: Tarot Engine Data & Algorithms

**Status**: ⬜ Pending
**Objective**: Dados dos baralhos (JSON), tipos TypeScript, algoritmos de embaralhamento e seleção.
**Dependencies**: None (pode paralelizar com Phase 0/1)

**Tasks**:

- [ ] T032 [SPEC-003#4] Create TypeScript types em `src/types/tarot.ts`
  - `Deck`, `TarotCard`, `LenormandCard`, `Spread`, `SpreadPosition`; suit enums (MAJOR, WANDS, CUPS, SWORDS, PENTACLES)
- [ ] T033 [SPEC-003#1] Create RWS deck data em `src/data/decks/rws.json`
  - 78 cartas (22 Arcanos Maiores + 56 Arcanos Menores); significados em português (upright/reversed)
- [ ] T034 [SPEC-003#2] Create Thoth deck data em `src/data/decks/thoth.json`
  - 78 cartas com significados em português
- [ ] T035 [SPEC-003#3] Create Lenormand deck data em `src/data/decks/lenormand.json`
  - 36 cartas com significados em português
- [ ] T036 [SPEC-003#5] Create Prisma schema for Reading + ReadingCard em `prisma/schema.prisma`
  - Reading: userId, deckId, spreadType, title?, notes?, duration?, seed, isDaily, isPublic (default false), cards (relation), createdAt
  - ReadingCard: readingId, cardId, position, isReversed
- [ ] T037 [SPEC-003#6] Run Reading migration em `prisma/migrations/`
  - Gerar migration → drift-check → run locally IMMEDIATELY
- [ ] T038 [SPEC-003#7] Create CSPRNG seed generator em `src/lib/tarot/seed.ts`
  - `generateSeed(): string` usando `crypto.randomBytes`; seed para reprodutibilidade
- [ ] T039 [SPEC-003#8] Implement Fisher-Yates shuffle em `src/lib/tarot/shuffle.ts`
  - `shuffleDeck(cards: TarotCard[], seed: string): TarotCard[]`; algoritmo determinístico com seed
- [ ] T040 [SPEC-003#9] Implement `drawCards` em `src/lib/tarot/draw.ts`
  - `drawCards(deck: TarotCard[], count: number, seed: string): DrawnCard[]`; detecção de repetição; assignação de reversed
- [ ] T041 [SPEC-003#10] Implement daily reading limit em `src/lib/tarot/daily-limit.ts`
  - `checkDailyLimit(userId: string): Promise<{allowed: boolean, remaining: number, tier: string}>`
  - Limites: 3/dia (free), 10/dia (Plus), ilimitado (Premium)
  - Enforcement: checar antes de criar reading em POST /readings
- [ ] T042 [SPEC-003#11] Implement Yes/No spread logic em `src/lib/tarot/spreads.ts`
  - `resolveYesNo(cards: DrawnCard[]): {answer: 'yes'|'no'|'maybe', confidence: number}`; lógica par/impar
- [ ] T043 [SPEC-003#12] Create spread position layouts em `src/data/spreads.json`
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

**Status**: ⬜ Pending
**Objective**: API routes de tiragem, componentes frontend (cartas 3D, seleção, sessão), páginas.
**Dependencies**: Phase 3

**Tasks**:

- [ ] T044 [SPEC-003#13] Implement `GET /api/v1/decks` + `GET /api/v1/decks/:id/cards` em `src/app/api/v1/decks/route.ts` e `src/app/api/v1/decks/[id]/cards/route.ts`
  - Lista baralhos disponíveis; retorna cartas de um baralho específico
- [ ] T045 [SPEC-003#14] Implement `GET /api/v1/spreads` em `src/app/api/v1/spreads/route.ts`
  - Lista espalhamentos disponíveis com posições
- [ ] T046 [SPEC-003#15] Implement `POST /api/v1/readings` em `src/app/api/v1/readings/route.ts`
  - Bearer; Zod validation: deckId + spreadType + title? + notes? + isPublic?
  - Embaralha + seleciona cartas; gera seed; salva Reading + ReadingCards
  - Rate limit: 3/dia (free), 10/dia (Plus) — verificar antes de criar
  - 201 `{reading: {id, cards, spread, createdAt}}` | 429 (limit atingido)
- [ ] T047 [SPEC-003#16] Implement `GET /api/v1/readings` em `src/app/api/v1/readings/route.ts`
  - Bearer; lista readings do usuário com paginação; filtros por data/tipo
- [ ] T048 [SPEC-003#17] Implement `GET /api/v1/readings/:id` em `src/app/api/v1/readings/[id]/route.ts`
  - Bearer; retorna reading detalhada com cards; 404 se não encontrada
- [ ] T049 [SPEC-003#18] Implement `GET /api/v1/readings/daily-count` em `src/app/api/v1/readings/daily-count/route.ts`
  - Bearer; retorna count de readings hoje + limite
- [ ] T050 [SPEC-003#19] Implement `GET /api/v1/readings/:id/og-image` em `src/app/api/v1/readings/[id]/og-image/route.ts`
  - Gera imagem OG da reading usando html-to-image; retorna como PNG
- [ ] T051 [SPEC-003#22] Create `TarotCard` component com flip 3D em `src/components/tarot/tarot-card.tsx`
  - Framer Motion: animação de virar carta (3D flip, 600ms ease-out); estados: face-down, flipping, face-up
- [ ] T052 [SPEC-003#23] Create `CardTable` em `src/components/tarot/card-table.tsx`
  - Layouts de espalhamento responsivos; posicionamento absoluto das cartas conforme spread
- [ ] T053 [SPEC-003#24] Create `CardDetailPanel` em `src/components/tarot/card-detail-panel.tsx`
  - Drawer lateral; significado upright/reversed; nome da carta; posição no spread
- [ ] T054 [SPEC-003#20] Create `DeckSelector` em `src/components/tarot/deck-selector.tsx`
  - Grid visual de baralhos; seleção com preview; info do baralho
- [ ] T055 [SPEC-003#21] Create `SpreadSelector` em `src/components/tarot/spread-selector.tsx`
  - Filtros por tipo; info de cada espalhamento; preview visual
- [ ] T056 [SPEC-003#25] Create `ReadingSession` em `src/components/tarot/reading-session.tsx`
  - Wrapper do fluxo completo: deck → spread → seleção → resultado
- [ ] T057 [SPEC-003#26] Create `ReadingTimer` em `src/components/tarot/reading-timer.tsx`
  - Contagem MM:SS; timer de reflexão antes de revelar
  - Pausa automaticamente quando painel de detalhes está aberto
  - Exibe tempo final ao salvar: "Tempo de leitura: 5min 23s"
- [ ] T058 [SPEC-003#27] Create `ShareModal` em `src/components/tarot/share-modal.tsx`
  - Opções: copiar link, download PNG, Web Share API (mobile)
  - Toggle "Tornar pública esta tiragem" (atualiza isPublic no reading)
  - Social media: WhatsApp, Twitter/X, Facebook
- [ ] T059 [SPEC-003#28] Create `DailyLimitBanner` em `src/components/tarot/daily-limit-banner.tsx`
  - Banner com CTA de upgrade quando limite atingido
- [ ] T060 [SPEC-003#29] Create `ReadingStore` em `src/stores/reading-store.ts`
  - Zustand com persistência em sessionStorage; estado da sessão de tiragem atual
- [ ] T061 [SPEC-003#30] Configure TanStack Query hooks em `src/hooks/use-readings.ts`
  - `useReadings()`, `useReading(id)`, `useDailyCount()`, `useCreateReading()`
- [ ] T062 [SPEC-003#31] Create `/tirar` page em `src/app/(app)/tirar/page.tsx`
  - Fluxo: deck → spread → sessão → resultado
  - Loading: skeleton; Error: retry + toast; Empty: CTA "Começar primeira tiragem"
- [ ] T063 [SPEC-003#32] Create `/minhas-tiragens` page em `src/app/(app)/minhas-tiragens/page.tsx`
  - Histórico com paginação; filtros por data e tipo
  - Loading: skeleton列表; Error: retry + toast; Empty: CTA "Faça sua primeira tiragem"
- [ ] T064 [SPEC-003#33] Create `/tiragem/:id` page em `src/app/(app)/tiragem/[id]/page.tsx`
  - Visualização pública de reading; usa ShareModal
- [ ] T065 [SPEC-003#34-36] Create tarot tests em `tests/integration/tarot.test.ts` e `tests/e2e/tarot-flows.spec.ts`
  - Unit: algoritmos de sorteio, Fisher-Yates, drawCards; Integration: endpoints; E2E: fluxo completo
- [ ] T066 [SPEC-003#37] Optimize animations em `src/components/tarot/tarot-card.tsx`
  - GPU acceleration, will-change, verify 60fps em devices lentos
- [ ] T067 [Sprint-1#13] Create daily tarot component em `src/components/tarot/daily-tarot.tsx` + `src/app/(app)/page.tsx`
  - Tarot do dia na home: cálculo determinístico (data + userId); carta única com significado

**After completing this phase**:
1. TypeScript Validation — `npm run validate`; fix todos os erros.
2. Build — somente se explicitamente pedido.
3. Testes — `npm run test` + `npx playwright test` (tarot flows).
4. Update this plan — mark Phase 4 `✅ Completed`.

---

### Phase 5: AI Readings Pipeline

**Status**: ⬜ Pending
**Objective**: Configurar SDK de IA, pipeline de prompts, endpoints SSE, cache, rate limiting, frontend.
**Dependencies**: Phase 3 (Reading schema para referência)

**Tasks**:

- [ ] T068 [SPEC-004#1] Configure z-ai-web-dev-sdk em `src/lib/ai/client.ts`
  - Cliente GPT-4o; env vars: AI_API_KEY, AI_MODEL; retry config
- [ ] T069 [SPEC-004#2] Create Prisma schema for Interpretation + FollowUpMessage + AIDailyUsage em `prisma/schema.prisma`
  - Interpretation: readingId, userId, content, mode, mood, cached (boolean), cacheHash
  - FollowUpMessage: interpretationId, role, content
  - AIDailyUsage: userId, date, count
- [ ] T070 [SPEC-004#3] Run AI migration em `prisma/migrations/`
  - Gerar migration → drift-check → run locally IMMEDIATELY
- [ ] T071 [SPEC-004#4] Create cache hash module em `src/lib/ai/cache.ts`
  - `computeCacheHash(cards, positions, mode, mood, modelVersion): string` — SHA-256
  - TTL: 30 dias; invalidar se modelVersion mudar
  - Campos do hash: cartas + posições + modo + humor + versão do modelo
- [ ] T072 [SPEC-004#5] Create daily AI rate limiter em `src/lib/ai/rate-limit.ts`
  - `checkDailyAILimit(userId): Promise<{allowed: boolean, remaining: number, tier: string}>`
  - Limites: 10 interpretações/dia (free, inclui follow-ups) + 3 interpretações de tiragem/dia; 50/dia (Plus)
  - Follow-up por sessão: 10 (free), 30 (Plus)
- [ ] T073 [SPEC-004#6] Create system prompt templates em `src/lib/ai/prompts/system.ts`
  - Base prompt + modos (leitura geral, amor, carreira, espiritual); tom esotérico
- [ ] T074 [SPEC-004#7] Create user prompt builder em `src/lib/ai/prompts/user.ts`
  - Constrói prompt com: cartas, posições, perfil do usuário, últimas 3 tiragens (histórico)
  - Modos: leitura geral, amor, carreira, espiritual
  - Mood: Animado, Ansioso, Reflexivo, Triste, Esperançoso, Cansado
  - Word count: 300-800 palavras; formatação contextual
- [ ] T075 [SPEC-004#8] Implement `POST /api/v1/ai/interpret` em `src/app/api/v1/ai/interpret/route.ts`
  - Bearer; Zod validation: readingId + mode + mood + question?
  - SSE streaming com eventos definidos: `token`, `done`, `error` (error type, message, retryable flag)
  - Rate limit: 10/dia (free), 50/dia (Plus) — verificar antes de gerar
  - Retry: se IA falhar, retornar erro SSE com `retryable: true`
  - Cache: se cacheHash existe, retornar interpretação cached com `cached: true` (sem SSE)
  - 200 (SSE stream) | 200 (cached JSON) | 429 (rate limit) | 400 (validation) | 503 (IA indisponível)
- [ ] T076 [SPEC-004#9] Implement interpretation cache em `src/lib/ai/cache-service.ts`
  - Busca por cacheHash; salva após geração; hit retorna interpretação cached
- [ ] T077 [SPEC-004#10] Implement `POST /api/v1/ai/follow-up` em `src/app/api/v1/ai/follow-up/route.ts`
  - Bearer; Zod validation: interpretationId + message + conversationHistory?
  - SSE streaming com eventos: `token`, `done`, `error`; timeout 60s
  - Retry: se IA falhar, retornar erro SSE com `retryable: true`
  - Limites por sessão: 10 (free), 30 (Plus); botão "Nova pergunta" para nova sessão
  - 200 (SSE stream) | 400 (validation) | 429 (limit sessão) | 503 (IA indisponível)
- [ ] T078 [SPEC-004#11] Implement `GET /api/v1/ai/usage` em `src/app/api/v1/ai/usage/route.ts`
  - Bearer; retorna uso diário de IA (count, remaining, limit)
- [ ] T079 [SPEC-004#12] Implement retry com backoff em `src/lib/ai/retry.ts`
  - `withRetry(fn, maxRetries=3)`: backoff exponencial; timeout 30s
- [ ] T080 [SPEC-004#13] Create `InterpretationRequest` component em `src/components/ai/interpretation-request.tsx`
  - Seleção de modo, mood, campo de pergunta; botão "Interpretar"
- [ ] T081 [SPEC-004#14] Create `StreamingInterpretation` em `src/components/ai/streaming-interpretation.tsx`
  - Efeito máquina de escrever com opacidade 0.5→1.0; SSE connection; loading state
  - Botão "Parar" para cancelar streaming; suporte a markdown (negrito, itálico, listas)
  - Error state: se SSE falhar, mostrar mensagem de erro com botão "Tentar novamente"
  - Cached state: se `cached: true`, mostrar badge "Interpretação em cache"
- [ ] T082 [SPEC-004#15] Create `FollowUpChat` em `src/components/ai/follow-up-chat.tsx`
  - Histórico de mensagens com avatars (user vs AI); campo de input com char limit (2000)
  - Sugestões pré-definidas (3-5 perguntas contextuais); indicador de digitação
  - Contador de mensagens; botão "Nova pergunta" para reiniciar sessão
- [ ] T083 [SPEC-004#16] Create `AIUsageIndicator` em `src/components/ai/ai-usage-indicator.tsx`
  - Barra/contador de uso diário; cores: verde (>50%), amarelo (25-50%), vermelho (<25%)
  - Tooltip com detalhes: "X de Y interpretações restantes hoje"
  - Link de upgrade quando limite baixo
- [ ] T084 [SPEC-004#17] Create `CachedInterpretationNotice` em `src/components/ai/cached-notice.tsx`
  - Badge "Interpretação em cache"; aviso de que é resultado anterior
- [ ] T085 [SPEC-004#18] Integrate AI components na reading page em `src/app/(app)/tiragem/[id]/page.tsx`
  - Adicionar InterpretationRequest, StreamingInterpretation, FollowUpChat na página
- [ ] T086 [SPEC-004#19] Create prompt builder unit tests em `tests/unit/ai-prompts.test.ts`
  - Testar system prompt templates e user prompt builder; cobertura de todos os modos
- [ ] T087 [SPEC-004#20] Create cache hash unit tests em `tests/unit/ai-cache.test.ts`
  - Testar computeCacheHash com inputs variados; verificar determinismo
- [ ] T088 [SPEC-004#21] Create interpret endpoint integration tests em `tests/integration/ai-interpret.test.ts`
  - Testar POST /api/v1/ai/interpret; mocks de IA; streaming; rate limiting
- [ ] T089 [SPEC-004#22] Create follow-up integration tests em `tests/integration/ai-followup.test.ts`
  - Testar POST /api/v1/ai/follow-up; mocks de IA; streaming
- [ ] T090 [SPEC-004#23] Create AI flow E2E test em `tests/e2e/ai-flow.spec.ts`
  - Fluxo completo: tiragem → interpretação → follow-up; verificar streaming

**After completing this phase**:
1. TypeScript Validation — `npm run validate`; fix todos os erros.
2. Build — somente se explicitamente pedido.
3. Testes — `npm run test` (unit + integration AI).
4. Update this plan — mark Phase 5 `✅ Completed`.

---

### Phase 6: Arcana Personal

**Status**: ⬜ Pending
**Objective**: Algoritmos de Pitágoras, tabela pitagórica, 22 arcanos, backend, frontend.
**Dependencies**: Phase 5 (AI streaming para interpretação de arcano)

**Tasks**:

- [ ] T091 [SPEC-005#3] Create Pythagorean table em `src/lib/arcana/pythagorean-table.ts`
  - `PYTHAGOREAN_TABLE`: mapeamento letra→número (1-9); normalização de acentos
- [ ] T092 [SPEC-005#1] Implement `reduceToArcana` em `src/lib/arcana/reduce.ts`
  - Redução pitagórica: soma dígitos até 1-22; `reduceToArcana(n: number): number`
- [ ] T093 [SPEC-005#2] Implement `calculateArcanaByDate` em `src/lib/arcana/calculate.ts`
  - `calculateArcanaByDate(birthDate: Date): number`; usa reduceToArcana com soma dos dígitos da data
- [ ] T094 [SPEC-005#4] Implement `calculateArcanaByName` em `src/lib/arcana/calculate.ts`
  - `calculateArcanaByName(name: string): number`; usa PYTHAGOREAN_TABLE; normaliza acentos
- [ ] T095 [SPEC-005#5] Implement `calculatePersonalArcana` em `src/lib/arcana/calculate.ts`
  - `calculatePersonalArcana(birthDate: Date, name: string): number`; combina data + nome
- [ ] T096 [SPEC-005#6] Create `ARCANA_MAP` em `src/data/arcana.ts`
  - 22 arcanos (0-21): nome, imagem, significado upright/reversed, elemento, planeta
  - Master numbers: 11 (A Força), 22 (O Louco), 33 "A Coroa" (extra-pitagórico, culminação)
  - Tipo `PersonalArcanaResult`: { dateArcana, nameArcana, combinedArcana, isMasterNumber }
- [ ] T097 [SPEC-005#8] Implement `GET /api/v1/arcana/calculate` em `src/app/api/v1/arcana/calculate/route.ts`
  - Bearer; calcula arcano pessoal; retorna `{arcana, arcanaData, name, birthDate}`
- [ ] T098 [SPEC-005#9] Implement `POST /api/v1/ai/arcana-interpret` em `src/app/api/v1/ai/arcana-interpret/route.ts`
  - Bearer; SSE streaming; interpretação IA do arcano pessoal
- [ ] T099 [SPEC-005#10] Create `ArcanaCalculator` em `src/components/arcana/arcana-calculator.tsx`
  - Formulário (nome + data); resultado client-side; animação de revelação
- [ ] T100 [SPEC-005#11] Create `ArcanaDetailCard` em `src/components/arcana/arcana-detail-card.tsx`
  - Card expandido com detalhes do arcano; imagem, significado, elemento
- [ ] T101 [SPEC-005#12] Create `ArcanaAIInterpretation` em `src/components/arcana/arcana-ai-interpretation.tsx`
  - Integração com T098; StreamingInterpretation para arcano
- [ ] T102 [SPEC-005#13] Create `/meu-arcano` page em `src/app/(app)/meu-arcano/page.tsx`
  - ArcanaCalculator + ArcanaDetailCard + ArcanaAIInterpretation
  - Loading: skeleton; Error: retry + toast; Empty: formulário de cálculo sempre visível
- [ ] T103 [SPEC-005#14] Create `/meu-arcano/:arcana` page em `src/app/(app)/meu-arcano/[arcana]/page.tsx`
  - Detalhe de qualquer arcano; usa ArcanaDetailCard
- [ ] T104 [SPEC-005#15-16] Create arcana unit tests em `tests/arcana.test.ts`
  - 100 testes redução pitagórica (datas conhecidas); testes tabela pitagórica (acentos)
- [ ] T105 [SPEC-005#17-18] Create arcana integration + E2E tests em `tests/integration/arcana.test.ts` e `tests/e2e/arcana.spec.ts`
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
- [ ] T023 ProfileHeader component
- [ ] T024 ProfileStats component
- [ ] T025 ProfileAstrology component
- [ ] T026 ProfileEditForm (auto-save)
- [ ] T027 Avatar upload (drag-and-drop)
- [ ] T028 PrivacySettings toggles
- [ ] T029 Public profile page
- [ ] T030 TanStack Query hooks
- [ ] T031 Profile tests
- [ ] TypeScript validation + lint + tests pass

### Phase 3: Tarot Engine Data & Algorithms
- [ ] T032 TypeScript types (Deck, TarotCard, Spread)
- [ ] T033 RWS deck data (78 cartas)
- [ ] T034 Thoth deck data (78 cartas)
- [ ] T035 Lenormand deck data (36 cartas)
- [ ] T036 Prisma schema Reading + ReadingCard
- [ ] T037 Reading migration
- [ ] T038 CSPRNG seed generator
- [ ] T039 Fisher-Yates shuffle
- [ ] T040 drawCards with duplicate detection
- [ ] T041 Daily reading limit
- [ ] T042 Yes/No spread logic
- [ ] T043 Spread position layouts
- [ ] TypeScript validation + lint + tests pass

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
- [ ] T068 Configure z-ai-web-dev-sdk
- [ ] T069 Prisma schema Interpretation + FollowUpMessage + AIDailyUsage
- [ ] T070 AI migration
- [ ] T071 Cache hash module (SHA-256)
- [ ] T072 Daily AI rate limiter
- [ ] T073 System prompt templates
- [ ] T074 User prompt builder
- [ ] T075 POST /api/v1/ai/interpret (SSE)
- [ ] T076 Interpretation cache service
- [ ] T077 POST /api/v1/ai/follow-up (SSE)
- [ ] T078 GET /api/v1/ai/usage
- [ ] T079 Retry with backoff
- [ ] T080 InterpretationRequest component
- [ ] T081 StreamingInterpretation (typewriter)
- [ ] T082 FollowUpChat component
- [ ] T083 AIUsageIndicator component
- [ ] T084 CachedInterpretationNotice
- [ ] T085 Integrate AI in reading page
- [ ] T086 Prompt builder unit tests
- [ ] T087 Cache hash unit tests
- [ ] T088 Interpret endpoint integration tests
- [ ] T089 Follow-up integration tests
- [ ] T090 AI flow E2E test
- [ ] TypeScript validation + lint + tests pass

### Phase 6: Arcana Personal
- [ ] T091 Pythagorean table
- [ ] T092 reduceToArcana function
- [ ] T093 calculateArcanaByDate function
- [ ] T094 calculateArcanaByName function
- [ ] T095 calculatePersonalArcana function
- [ ] T096 ARCANA_MAP (22 arcanos)
- [ ] T097 GET /api/v1/arcana/calculate
- [ ] T098 POST /api/v1/ai/arcana-interpret (SSE)
- [ ] T099 ArcanaCalculator component
- [ ] T100 ArcanaDetailCard component
- [ ] T101 ArcanaAIInterpretation component
- [ ] T102 /meu-arcano page
- [ ] T103 /meu-arcano/:arcana page
- [ ] T104 Arcana unit tests (100+ test cases)
- [ ] T105 Arcana integration + E2E tests
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
