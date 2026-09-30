---
title: "Sprint 2 Execution Plan — Social + Conteúdo"
type: enhancement
status: active
date: 2026-09-26
phased: true
---

# Sprint 2 Execution Plan — Social + Conteúdo

## Overview

**Problema/Motivação:** Sprint 1 entregou o MVP (auth, perfil, tiragem, IA, arcano pessoal, PWA). O Sprint 2 expande com features sociais (feed, follow, interações, notificações real-time) e conteúdo esotérico avançado (horóscopos Ocidental/Chinês/Maia, gifts virtuais "Versos", Explore com busca).

**Estado atual (verificado):**
- Sprint 1 completo; Prisma schema tem User, UserProfile, Reading, Interpretation, ArcanaCalculation
- **FALTANDO:** Models Follow, Post, Comment, PostLike, PostHashtag, CommentLike, Gift, Notification, HoroscopeContent, HoroscopeEntry, HoroscopeLog, HoroscopeNotification, ContentReport; User additions (subscriptionTier, isBanned, bannedAt, banReason, maxFollowing)
- Socket.io service não existe; horóscopo algorithms não implementados; Kin Maya calculation existe em `src/lib/calculations/kin-maya.ts`
- Infra existente reutilizada: `src/lib/r2.ts` + avatar presign (upload), `src/lib/analytics.ts`, `src/lib/csrf.ts`, `UserProfile.privacy.whoCanFollow` (privacy settings Sprint 1)

## Scope / Work Breakdown

| Módulo | Tasks Sprint-2.md | Overlap | Sprint 2 tasks |
|--------|-------------------|---------|----------------|
| Sistema Social | 4 | 0 | 4 |
| Feed | 5 | 0 | 5 |
| Interações | 4 | 0 | 4 |
| Horóscopo Ocidental | 4 | 0 | 4 |
| Horóscopo Chinês | 4 | 0 | 4 |
| Horóscopo Maia | 5 | 1 | 4 |
| Gifts + Versos | 4 | 0 | 4 |
| Explore + Busca | 3 | 0 | 3 |
| DB Migrations | 3 | 0 | 3 |
| Real-time | 2 | 0 | 2 |
| **TOTAL** | **38** | **1** | **37** |

> **Convenção de US:** os tags `[US-0xx]` referem-se à tabela User Stories de `docs/08-sprints/sprint-2.md` (numeração local do sprint), **não** ao registro de produto em `docs/01-product/user-stories.md`. US-027 (marketplace) está fora do escopo (deferred Sprint 3+); as tasks de Explore/Busca (31–33 de sprint-2.md) não têm US própria e são taggeadas `[US-022]` (descoberta de conteúdo).
>
> **Tasks derivadas de RFs das specs** (não constam na lista de sprint-2.md): T013 CommentLike (RF-SOC-005), T064 upload presign (RF-SOC-003/RNF-SOC-003), T081 comment-like endpoint (RF-SOC-005), T103 config de notificações (RF-HORO-008). O bloco Explore e Busca de sprint-2.md (tasks 31–33, incluindo moderação: T012, T025, T128, T129) é todo taggeado `[US-022]`. **Tasks do clarify 2026-09-28**: T147 reconciliação de contadores (S2-19/I4), T148 purge LGPD de leituras 90d (S2-20/`lgpd.md`).

### Mapeamento por Fase

| Fase | Nome | Depends On | Tasks |
|------|------|------------|-------|
| 0 | DB Migrations & Core Models | None | T001–T023 |
| 0.5 | Shared Infrastructure | Phase 0 | T024–T042 |
| 1 | Follow System & Profile | Phase 0.5 | T043–T050 |
| 2 | Feed Backend & Post System | Phase 0.5 | T051–T065 |
| 2.5 | WebSocket Foundation | Phase 2 | T066–T075 |
| 3 | Interactions (Likes, Comments, Notifications) | Phase 2.5 | T076–T089 |
| 4 | Horóscopo Ocidental | Phase 0.5 | T090–T103, T144–T145 |
| 5 | Horóscopo Chinês | Phases 0.5, 4 | T104–T109 |
| 6 | Horóscopo Maia / Kin Maya | Phases 0.5, 4 | T110–T117 |
| 7 | Gifts + Versos Economy | Phases 0.5, 1, 3 | T118–T125, T142–T143 |
| 8 | Explore + Search | Phase 2 | T126–T130 |
| 9 | Frontend Integration & Polish | Phases 1–8 | T131–T141, T146 |
| 10 | Data Integrity & Compliance | Phases 0, 3 | T147–T148 |

**Total: 148 tasks únicas (T001–T148), ZERO duplicatas, ZERO letter suffixes.**

---

## Proposed Solution

### Arquitetura

```
src/
├── app/api/v1/
│   ├── social/           # Follow, Post, Like, Comment, Gift, Notification, Report, Uploads endpoints
│   ├── horoscopes/       # Western, Chinese, Maya, history, notifications settings endpoints
│   └── explore/          # Trending, hashtags, suggestions, search endpoints
├── app/(app)/
│   ├── feed/             # FeedPage
│   ├── explorar/         # ExplorePage
│   ├── horoscopos/       # Western/Chinese/Mayan + historico + interpret
│   ├── post/[id]/        # PostDetailPage
│   ├── notificacoes/     # NotificationsPage
│   ├── presentes/        # GiftsPage
│   └── busca/            # SearchPage
├── components/social/    # PostCard, PostComposer, CommentSection, GiftSelector, FollowButton, NotificationsDropdown
├── components/horoscopes/ # Western/Chinese/Mayan HoroscopeCard, NotificationSettings
├── lib/
│   ├── horoscopes/       # western.ts, chinese.ts, maya.ts, prompts.ts, validation.ts, western-compatibility.ts
│   ├── social/           # feed-algorithm.ts, mentions.ts, gifts.ts, versos.ts, privacy.ts, limits.ts
│   ├── queue/            # BullMQ horoscope-queue.ts
│   ├── og-image.ts       # Sharp + @vercel/og
│   ├── analytics.ts      # PostHog typed events
│   ├── moderation.ts     # checkContent
│   ├── csrf.ts           # CSRF double-submit
│   ├── feed-cache.ts     # Materialized view
│   ├── middleware/rate-limit.ts, csrf.ts
│   └── env.ts            # Zod env validation
├── socket-service/       # Socket.io server (porta 3003, Dockerfile, PM2)
├── stores/social-store.ts # Zustand: unreadCount, notifications, optimistic helpers
├── hooks/                # use-feed, use-horoscopes, use-socket, use-social
├── jobs/                 # horoscope-generation, horoscope-worker, feed-cache-refresh, horoscope-notifications
└── tests/
    ├── integration/social/, integration/horoscopes/, integration/websocket/
    └── e2e/
```

### Decisões de Projeto

- **[S2-1] Social:** Socket.io serviço separado porta 3003 com Redis adapter; auth JWT no handshake; rooms `user:{id}`, `feed:{id}`, `post:{id}`, `comment:{id}`; fallback polling 30s; alvo dos emits: `post:new` → rooms `user:`/`feed:` dos seguidores, `like-updated`/`comment-added`/`comment-like-updated` → room `post:{id}`, `follow-update`/`notification` → room `user:{id}` do destinatário, `gift-received` → room `user:{toUserId}`; cliente entra em `post:{id}`/`comment:{id}` ao abrir detalhe
- **[S2-2] Horóscopos:** Algoritmos puros em `src/lib/horoscopes/`; conteúdo via BullMQ batch (04:00 BRT) + fallback templates no seed; cache TTL 30 dias; **`HoroscopeContent.date` = data civil `America/Sao_Paulo` do gatilho (Q25)** — cron converte agendamento BRT→UTC mas grava a data civil BRT; endpoints e availability check calculam "hoje" em BRT
- **[S2-3] Kin Maya:** Reutilizar `kin-maya.ts` (Sprint 1 T020) + expandir Selos/Tons/Onda Encantada
- **[S2-4] Gifts:** 6 gifts SPEC-007 exatos (Estrela Cadente 10, Rosa Mística 25, Cristal 50, Bola de Cristal 100, Coroa Astral 200, Dragão Dourado 500) — catálogo **fixo em código** (T036), sem env de preço; **autoritativo = SPEC-007/T036**: `docs/06-features/gifts.md` (9 gifts) e `docs/04-api/social.md` (`INSUFFICIENT_COINS`) estão desatualizados → atualização pós-Phase 7 via doc-shepherd; **terminologia:** "Moedas" (SPEC-007) = "Versos", error code `INSUFFICIENT_VERSOS`; Versos: login diário 10+streak, interações (like=1, comment=2, follow=5, reading=10)
- **[S2-5] Feed:** ordenação em 4 níveis (RF-SOC-002): (1) `Post.isPinned` — máx 1 a cada 10 posts (campo criado em T002; **sem write-path no MVP** — tier inerte até admin pin Sprint 3+); (2) posts com engajamento nas últimas 2h (`engagementScore = likes + comments×2`, janela `createdAt >= now()-2h`) por score desc; (3) demais posts de seguidos por `createdAt` desc; (4) desempate a favor de posts com interação prévia do viewer (`PostLike`/`Comment`); **10 posts/página**; cursor-based `(createdAt, id)`; fallback explore se 0 following; cache para >1000 following (refresh 5min); **real-time (Q27): `post:new` com feed aberto → pill "N novos posts" no topo (acumula, dedup por id), slide-in só no clique — sem auto-inserção durante leitura**
- **[S2-7] Prisma:** generate → drift-check → run locally IMMEDIATELY
- **[S2-10] Rate Limits:** Posts 10/dia free, 50/dia Plus; Likes 100/min; Comments 30/min; Follow 20/min; Gifts 10/dia; Uploads 4/post (T027 `checkUploadLimit`, T064); Horoscopes ilimitado (cached); **modo de falha (Q26): fail-open** — Redis indisponível → request prossegue com log warn + evento PostHog `rate_limiter_bypass`; contido por daily limits via fallback Prisma count; **body do 429 (Q33/SC33): social passa a emitir `retryAfter` (segundos) junto de `resetAt`** (client lê `retryAfter` como em auth; header `Retry-After` obrigatório)
- **[S2-11] CSRF:** Double-submit; cookie `csrf-token` vs header `x-csrf-token`; client-side `ensureCsrfCookie()`
- **[S2-12] Upload de imagens:** Presign R2 reutilizando `src/lib/r2.ts` (pattern do avatar presign); máx 4 imagens, JPEG/PNG/WebP, ≤5MB; PUT direto ao R2; keys `posts/{userId}/…`; presign é a validação autoritativa de tipo/tamanho (T051 valida formato/quantidade do payload, sem re-baixar bytes)
- **[S2-13] Acesso público:** MVP autenticado — páginas sociais e de horóscopos em `src/app/(app)` (layout exige sessão; UC-005 pré-condição "usuário autenticado"); acesso de visitante fica Sprint 3+
- **[S2-14] Privacidade de follow:** fonte única `UserProfile.privacy.whoCanFollow` (Sprint 1, `src/app/api/v1/users/me/privacy/route.ts`); sem novo campo `User.privacySettings`
- **[S2-15] Visibilidade de conteúdo:** leitura honra `Post.audience` (public/followers) **e** `UserProfile.privacy.profileVisibility` (privado → só seguidores) em feed/search/detalhe/og-image; comentários honram `Post.commentsDisabled` **e** `UserProfile.privacy.whoCanComment` (RF-SOC-001/003/005)
- **[S2-16] Convenção de rotas:** prefixo `/api/v1/social/*` agrupa follow/posts/likes/gifts/notifications — desvio consciente do layout de rotas sugerido em `.specs/007-social/design.md` (`/api/v1/posts`, `/api/v1/users/:id/follow`); mesma superfície funcional, decisão de organização
- **[S2-17] Saldo Versos:** fonte única `UserProfile.versosBalance Int @default(0)` + `versosStreak Int @default(0)` + `lastClaimAt DateTime?` (campos em T014); atualizado **exclusivamente em `$transaction`** por `earnVersos`/debit de gift/claim-daily/half-share; invariant `versosBalance >= 0` checado na transação (sem ledger derivado); `GET /versos/balance` lê o campo
- **[S2-18] Envelope de paginação (Q30/SC30):** TODAS as rotas cursor sociais respondem no contrato de `docs/04-api/overview.md` §Paginação — **`{ data, pagination: { nextCursor } }`** (followers/following T044/T045, feed T052, comments T078, notifications T082, history T095, gifts-received T142); os shapes flat escritos nas tasks são o shape da lib interna — a rota envolve; hooks com union (`useNotifications`/`useFeed`) estreitados para o envelope na primeira rota (T044)
- **[S2-19] Contadores (Q31/SC31):** `Post.likeCount`/`Post.commentCount` e `Comment.likeCount` são incrementados/decrementados **no mesmo `$transaction`** do insert/delete (T051/T076/T077/T081) **e** reconciliados por cron periódico (T147) — `ON DELETE CASCADE` não roda código de app e deixa drift permanente sem reconciliação (invariante I4 de `docs/03-database/entities.md`)
- **[S2-20] LGPD leituras (Q32/SC32):** `Reading`/`ReadingCard`/`Interpretation` são purgados **90 dias após o soft-delete** da conta (retenção de `docs/07-security/lgpd.md`), estendendo o job `hard-delete` — T148

---

## Technical Considerations

### NFRs
- **Performance:** P95 < 500ms; feed < 300ms para >1000 following (materialized view); WebSocket < 100ms; RNF-HORO-002: página de horóscopo < 800ms, cálculo Kin < 1ms; RNF-SOC-003: upload de até 4 imagens < 8s P95 (4G)
- **Método de medição (Q29):** **bench automatizado** em `tests/bench/` — p95 de endpoints sociais e feed (1000 following sintéticos), Playwright tracing para página de horóscopo, cronômetro unitário para Kin; roda no gate de fase (`npm run test`); RUM pós-deploy fora do MVP (T146)
- **Security:** CSRF double-submit, Pino redact, `equalizeNoopTiming()` 240-400ms, WebSocket auth handshake; rate limiter fail-open + alerta (Q26/S2-10)
- **Observability:** PostHog events (post_create, like, comment, follow, gift_send, horoscope_view, gift_claim_daily, versos_earned, post_limit_hit, csrf_failure, rate_limiter_bypass, horoscope_missing)

### Migration Safety
1. `Follow` + `Post` + `Comment` + `PostLike` + `PostHashtag` + `CommentLike` + `Notification` + `ContentReport`
2. `Gift` + `HoroscopeContent` + `HoroscopeEntry` + `HoroscopeLog` + `HoroscopeNotification`
3. User additions (subscriptionTier, isBanned, bannedAt, banReason, maxFollowing)
4. Índices: `Post(authorId,createdAt)`, `Post(createdAt)`, `Follow(followerId,followingId)`, `Notification(userId,isRead,createdAt)`, `PostHashtag(tag)`, `HoroscopeEntry(userId,createdAt)`, unique `CommentLike(commentId,userId)`, unique `HoroscopeNotification(userId)`

### Patterns Existentes
- API Routes: App Router, Zod, `requireAuth`, `apiError`/`apiSuccess`
- Algorithms: funções puras com getters UTC (`tz-determinism-utc-tests.md`)
- Derived fields: invalidação condicional (`derived-field-invalidation.md`)
- Auth: single-flight refresh, CSRF client-side, rate-limit before lookup
- Uploads: presign R2 reutilizando pattern do avatar (`src/lib/r2.ts` + `users/me/avatar/presign`)

---

## Acceptance Criteria

#### AC-1: Follow System [US-020]
**Given** usuário autenticado visualizando perfil de outro  
**When** clica em "Seguir"  
**Then** segue; contador atualiza; notificação ao seguido  
**Roles:** USER, PROFESSIONAL | **Priority:** Must-have

#### AC-2: Unfollow [US-020]
**Given** usuário seguindo outro  
**When** clica em "Deixar de seguir"  
**Then** deixa de seguir; contador decrementa  
**Roles:** USER, PROFESSIONAL | **Priority:** Must-have

#### AC-3: Feed Personalizado [US-022]
**Given** usuário logado seguindo ≥1 pessoa  
**When** acessa `/feed`  
**Then** vê posts de quem segue ordenados por S2-5 (pinned → engajamento 2h → cronológico → interação prévia), 10/página; infinite scroll funciona; posts novos via WS chegam como pill "N novos posts" (Q27)  
**Roles:** USER, PROFESSIONAL | **Priority:** Must-have

#### AC-4: Feed Fallback (Explore) [US-022]
**Given** usuário logado sem seguir ninguém  
**When** acessa `/feed`  
**Then** vê posts públicos com maior engajamento  
**Roles:** USER, PROFESSIONAL | **Priority:** Must-have

#### AC-5: Criação de Post [US-021]
**Given** usuário logado  
**When** cria post (texto ≤500 chars, até 4 imagens validadas, ou tiragem) com audience public/followers  
**Then** post criado; atualização real-time no feed via WebSocket  
**Roles:** USER, PROFESSIONAL | **Priority:** Must-have

#### AC-6: Like Toggle [US-023]
**Given** usuário visualizando post de outro  
**When** clica em curtir/descurtir  
**Then** contador atualiza; notificação ao autor; auto-like bloqueado; **sem lista de quem curtiu (curtidas anônimas)**  
**Roles:** USER, PROFESSIONAL | **Priority:** Must-have

#### AC-7: Comentários [US-023]
**Given** usuário visualizando post  
**When** adiciona comentário (≤300 chars, ou resposta 1 nível)  
**Then** comentário aparece; notificação ao autor do post e do comentário pai; like de comentário com contagem (sem lista)  
**Roles:** USER, PROFESSIONAL | **Priority:** Must-have

#### AC-8: Notificações In-App [US-023]
**Given** usuário recebe like/comment/follow/gift  
**When** abre dropdown  
**Then** lista com unread badge; mark-as-read; real-time via WebSocket  
**Roles:** USER, PROFESSIONAL | **Priority:** Must-have

#### AC-9: Horóscopo Ocidental [US-024]
**Given** usuário autenticado com birthDate  
**When** acessa `/horoscopos/ocidental`  
**Then** signo correto (cuspides); horóscopo diário; compatibilidade; resultado também na seção de horóscopos do perfil (RF-HORO-004, T144)  
**Roles:** USER, PROFESSIONAL | **Priority:** Must-have

#### AC-10: Horóscopo Chinês [US-024]
**Given** usuário autenticado com birthDate  
**When** acessa `/horoscopos/chines`  
**Then** animal + elemento corretos (Ano Novo Chinês); características  
**Roles:** USER, PROFESSIONAL | **Priority:** Must-have

#### AC-11: Kin Maya [US-025]
**Given** usuário autenticado com birthDate  
**When** acessa `/horoscopos/maia`  
**Then** Kin via Tzolkin (GMT 584283); Selo + Tom; Onda Encantada 9 posições  
**Roles:** USER, PROFESSIONAL | **Priority:** Must-have

#### AC-12: Gifts + Versos [US-026]
**Given** usuário com saldo de Versos  
**When** envia gift  
**Then** saldo decrementa em `$transaction` (S2-17); self-gift → 403 `SELF_GIFT`; notificação ao destinatário; presente exibido no perfil do destinatário com animação (RF-SOC-006, T142/T143)  
**Roles:** USER, PROFESSIONAL | **Priority:** Must-have

#### AC-13: Explore + Busca [US-022]
**Given** usuário logado  
**When** acessa `/explorar` e busca  
**Then** tabs: posts, usuários, hashtags; trending hashtags  
**Roles:** USER, PROFESSIONAL | **Priority:** Must-have

#### AC-14: WebSocket Real-time [US-020–US-023]
**Given** usuário logado com WebSocket conectado  
**When** evento ocorre (post, like, comment, follow, gift)  
**Then** UI atualiza sem refresh; reconnection automática; fallback polling  
**Roles:** USER, PROFESSIONAL | **Priority:** Must-have

#### AC-15: Testes [US-020–US-026]
**Given** código completo  
**When** `npm run test` e `npx playwright test`  
**Then** todos passam; coverage: unit ≥80%, integration ≥70%, E2E ≥10 critical paths  
**Priority:** Must-have

#### AC-16: Horóscopo History [US-024, RF-HORO-007]
**Given** usuário logado  
**When** acessa `/horoscopos/historico`  
**Then** lista paginada com filtros (tipo, período, data)  
**Roles:** USER, PROFESSIONAL | **Priority:** Must-have

#### AC-17: Horóscopo AI Interpretation [US-024, RF-HORO-006]
**Given** usuário visualizando horóscopo  
**When** solicita interpretação IA  
**Then** streaming em tempo real (pipeline SPEC-004); **consome 1 unidade da cota diária de IA** (`checkDailyAILimit` de `src/lib/ai/rate-limit.ts`; 429 `AI_DAILY_LIMIT_REACHED` ao exceder)  
**Roles:** USER, PROFESSIONAL | **Priority:** Must-have

#### AC-18: Horóscopo Push Notifications [US-024, RF-HORO-008]
**Given** usuário com notificações habilitadas  
**When** na `hour` configurada (default 07:00 BRT)  
**Then** notificação in-app por sistema habilitado; hora e toggles configuráveis pelo usuário  
**Roles:** USER, PROFESSIONAL | **Priority:** Must-have

#### AC-19: Rate Limits [SC9 · S2-10]
**Given** usuário free/plus  
**When** excede limite  
**Then** 429 com `Retry-After`; mensagem amigável  
**Roles:** USER, PROFESSIONAL | **Priority:** Must-have

#### AC-20: CSRF Protection [RNF-SEC-001]
**Given** usuário submetendo POST  
**When** token CSRF ausente/inválido  
**Then** 403 `CSRF_TOKEN_INVALID`  
**Roles:** USER, PROFESSIONAL | **Priority:** Must-have

#### AC-21: Feed Performance [RNF-SOC-002]
**Given** usuário seguindo >1000  
**When** acessa `/feed`  
**Then** resposta <300ms (materialized view)  
**Roles:** USER, PROFESSIONAL | **Priority:** Must-have

#### AC-22: Privacy Settings [US-020, SPEC-002]
**Given** usuário com `UserProfile.privacy.whoCanFollow` configurado (Sprint 1)  
**When** outro tenta seguir  
**Then** follow bloqueado conforme `whoCanFollow`  
**Roles:** USER, PROFESSIONAL | **Priority:** Must-have

#### AC-23: Upload de Imagens [RF-SOC-003, RNF-SOC-003]
**Given** usuário logado criando post com imagens  
**When** seleciona até 4 imagens (JPEG/PNG/WebP, ≤5MB cada)  
**Then** presign R2 emitido; PUT direto ao R2; `imageUrls` salvas; tipo/tamanho inválidos → 422  
**Roles:** USER, PROFESSIONAL | **Priority:** Must-have

#### AC-24: Disponibilidade de Horóscopo [RNF-HORO-001]
**Given** cron de geração executando às 04:00 BRT (T097)  
**When** são 06:00 BRT (T145)  
**Then** `HoroscopeContent` do dia existe para todos os signos; ausência → `logger.warn` + evento PostHog  
**Roles:** SYSTEM | **Priority:** Should-have

---

## Implementation Plan

| Phase | Name | Depends On | Status |
|-------|------|------------|--------|
| 0 | DB Migrations & Core Models | None | ✅ Done |
| 0.5 | Shared Infrastructure | Phase 0 | ✅ Done |
| 1 | Follow System & Profile | Phase 0.5 | ✅ Done |
| 2 | Feed Backend & Post System | Phase 0.5 | ⬜ Pending |
| 2.5 | WebSocket Foundation | Phase 2 | ⬜ Pending |
| 3 | Interactions (Likes, Comments, Notifications) | Phase 2.5 | ⬜ Pending |
| 4 | Horóscopo Ocidental | Phase 0.5 | ⬜ Pending |
| 5 | Horóscopo Chinês | Phases 0.5, 4 | ⬜ Pending |
| 6 | Horóscopo Maia / Kin Maya | Phases 0.5, 4 | ⬜ Pending |
| 7 | Gifts + Versos Economy | Phases 0.5, 1, 3 | ⬜ Pending |
| 8 | Explore + Search | Phase 2 | ⬜ Pending |
| 9 | Frontend Integration & Polish | Phases 1–8 | ⬜ Pending |
| 10 | Data Integrity & Compliance | Phases 0, 3 | ✅ Done |

---

### Phase 0: DB Migrations & Core Models (T001–T023)

**Status**: ✅ Done
**Objective**: Criar models Prisma completos; rodar migrations; seed data
**Dependencies**: None

**Tasks**:

- [x] T001 [P1] [US-020] Add `Follow` model em `prisma/schema.prisma` — `id`, `followerId`, `followingId`, `createdAt`; `@@unique([followerId, followingId])`, `@@index([followerId])`, `@@index([followingId])`
  - **2026-09-26**: contrato T001–T016 coberto por `tests/schema-sprint2.test.ts` (42 asserts: existência dos 13 models, `@@unique`/`@@index` críticos, campos `imageUrls`/`audience`/`coinCost`/`versosBalance` etc. — falha se schema/regressão remover)
- [x] T002 [P1] [US-021] Add `Post` model em `prisma/schema.prisma` — `id`, `authorId`, `type`, `content`, `imageUrls String[]`, `readingId String?`, `audience`, `isPinned Boolean @default(false)` (lido pelo tier 1 do feed S2-5; sem write-path no MVP), `likeCount Int @default(0)`, `commentCount Int @default(0)`, `commentsDisabled Boolean @default(false)`, `isHidden Boolean @default(false)`, `createdAt`, `updatedAt`; `@@index([authorId, createdAt])`, `@@index([createdAt])`
- [x] T003 [P1] [US-023] Add `Comment` model em `prisma/schema.prisma` — `id`, `postId`, `authorId`, `content`, `parentCommentId String?`, `likeCount Int @default(0)`, `createdAt`; `@@index([postId, createdAt])`
- [x] T004 [P1] [US-023] Add `PostLike` model em `prisma/schema.prisma` — `id`, `postId`, `userId`, `createdAt`; `@@unique([postId, userId])`
- [x] T005 [P1] [US-022] Add `PostHashtag` model em `prisma/schema.prisma` — `id`, `postId`, `tag`; `@@index([tag])`
- [x] T006 [P1] [US-026] Add `Gift` model em `prisma/schema.prisma` — `id`, `fromUserId`, `toUserId`, `giftId`, `coinCost Int`, `recipientEarnsHalf Boolean @default(false)`, `createdAt`
- [x] T007 [P1] [US-023] Add `Notification` model em `prisma/schema.prisma` — `id`, `userId`, `type`, `message`, `data Json?`, `isRead Boolean @default(false)`, `createdAt`; `@@index([userId, isRead, createdAt])`
- [x] T008 [P1] [US-024] Add `HoroscopeContent` model em `prisma/schema.prisma` — `id`, `type`, `signId`, `element String?`, `period`, `date`, `content Json`, `createdAt`; `@@unique([type, signId, element, period, date])`; **`date` = data civil `America/Sao_Paulo` (Q25/S2-2)**
- [x] T009 [P1] [US-024] Add `HoroscopeEntry` model em `prisma/schema.prisma` — `id`, `userId`, `type`, `signId`, `element String?`, `period`, `createdAt`; `@@index([userId, createdAt])` (RF-HORO-007)
- [x] T010 [P1] [US-024] Add `HoroscopeLog` model em `prisma/schema.prisma` — `id`, `userId`, `type`, `signId`, `element String?`, `period`, `createdAt`; `@@index([userId, createdAt])`
- [x] T011 [P1] [US-024] Add `HoroscopeNotification` model em `prisma/schema.prisma` — `id`, `userId @unique`, `westernEnabled Boolean @default(true)`, `chineseEnabled Boolean @default(false)`, `mayaEnabled Boolean @default(false)`, `hour Int @default(7)`
- [x] T012 [P1] [US-022] Add `ContentReport` model em `prisma/schema.prisma` — `id`, `reporterId`, `targetType`, `targetId`, `reason`, `status String @default("PENDING")`, `resolvedAt DateTime?`, `resolvedBy String?`, `createdAt`; `@@index([targetType, targetId])`
- [x] T013 [P1] [US-023] Add `CommentLike` model em `prisma/schema.prisma` — `id`, `commentId`, `userId`, `createdAt`; `@@unique([commentId, userId])`, `@@index([commentId])` (RF-SOC-005: like de comentário com contagem)
- [x] T014 [P1] [US-020] Add User fields em `prisma/schema.prisma` — `subscriptionTier UserPlan @default(FREE)`, `isBanned Boolean @default(false)`, `bannedAt DateTime?`, `banReason String?`, `maxFollowing Int @default(5000)` (privacidade vive em `UserProfile.privacy` — S2-14); **`UserProfile` (S2-17): `versosBalance Int @default(0)`, `versosStreak Int @default(0)`, `lastClaimAt DateTime?`**
- [x] T015 [P1] [US-020] Create migration em `prisma/migrations/` — `npx prisma migrate dev --name sprint2_social_horoscopes` (gera SQL) → revisar diff → `npx prisma migrate status` (atomic chain do repositório; sem `db push`)
- [x] T016 [P1] [US-020] Add performance indexes em `prisma/schema.prisma` — `Post(authorId,createdAt)`, `Post(createdAt)`, `Follow(followerId,followingId)`, `Notification(userId,isRead,createdAt)`, `PostHashtag(tag)`, `HoroscopeEntry(userId,createdAt)`, `HoroscopeContent unique(type,signId,element,period,date)`, `HoroscopeNotification unique(userId)`, `CommentLike unique(commentId,userId)`
- [x] T017 [P1] [US-024] Seed data em `prisma/seed.ts` — 12 signos ocidentais (datas, elementos, regentes, emojis, keywords); 12 animais chineses + tabela CNY 1980-2035 + 60 ciclos; 20 Selos + 13 Tons + Onda Encantada; 6 gifts SPEC-007 exatos; palavras bloqueadas moderação; fallbacks horóscopo; defaults HoroscopeNotification
  - **2026-09-26**: seed cobre **DB** (usuários admin/test, `HoroscopeNotification` defaults, `HoroscopeContent` fallback western daily hoje+amanhã via `Intl` `America/Sao_Paulo`, idempotente query-then-createMany); **catálogos vivem em código** — signos/animais/selos em T018–T020, 6 gifts SPEC-007 em T036, palavras de moderação em T025 (env `MODERATION_BLOCKED_WORDS`); fallbacks completos (60 combos chineses + 260 kins + weekly/monthly) = **T032 (Phase 0.5)**
  - **2026-09-26 (testes)**: `tests/seed.test.ts` (9) — `civilDateBrt` fuso BRT (23h BRT ≠ dia UTC), `buildWesternFallback` 12 signos, idempotência dos fallbacks (0/22/24 casos), upsert de notificações, orquestração do `seed()`; para testabilidade seed ganhou **guard de execução direta** (`import.meta.url` vs `argv[1]` — importar o módulo não dispara), exports das funções auxiliares e imports via alias `@/`
- [x] T018 [P1] [US-024] Create Western algorithm em `src/lib/horoscopes/western.ts` — `getWesternSign(day, month): WesternSign` com cuspides Capricórnio; export interface com emoji, element, ruler, keywords
- [x] T019 [P1] [US-024] Create Chinese algorithm em `src/lib/horoscopes/chinese.ts` — `getChineseZodiac(year, month, day): ChineseZodiac` com tabela CNY 1980-2035, animal + elemento, 60 ciclos
  - **2026-09-26**: elemento do ano = `floor(((year-4)%10)/2)` → [madeira,fogo,terra,metal,agua] (fórmula `((year-4)%5)` do spec não bate com RF-HORO-002 1990=Cavalo de Metal, que é o acceptance criterion); CNY table 1980–2035 com fallback 04/02 fora da janela
- [x] T020 [P1] [US-025] Create Maya algorithm em `src/lib/horoscopes/maya.ts` — `gregorianToMayanLongCount` (GMT 584283), 20 Selos, 13 Tons, `getMayanOndaEncantada(kinNumber)`; reutiliza `calculateKinMaya`
  - **2026-09-26**: inversão de dependência — `maya.ts` é a fonte (`gregorianToJdn`, `gregorianToMayanLongCount` GMT 584283) e `kin-maya.ts` delega (mantém export/contrato T023); Onda Encantada = **9 câmaras** (posições 2,3,4,6,7,8,10,11,12 — decisão Q do usuário); seleção das tabelas/exemplos fora do teste: +1 teste de JDN de referência (2000-01-01 = 2451545) movido para dentro do `it.each` i=0
- [x] T021 [P1] [US-024] Create unit tests em `tests/horoscopes.test.ts` — Western 16 (12 signos + 4 cuspides); Chinese 120 (60 anos × 2); Maya 520 (260 kins × 2 correlações); Total 656
  - **2026-09-26**: 656 testes do T021 ✓ (Western 16 = 12 + 4 cuspides; Chinese 120; Maya 520 = 260 × 2 correlações) + 2 extras no arquivo (T020 `kinToSealTone` + T023 export) = **658 no total, 1781 na suíte**; e2e `jdn` por componente + cadeia `((254+i)%260)+1` ancorada em 15/06/1990 = Kin 255
- [x] T022 [P1] [US-020] Create env validation em `src/lib/env.ts` — Zod schema: `REDIS_URL`, `SOCKET_PORT` (default 3003), `AI_HOROSCOPE_API_KEY`, `AI_HOROSCOPE_MODEL`, `SHARP_IGNORE_GLOBAL_LIBVIPS`, `MODERATION_BLOCKED_WORDS`, `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_PUBLIC_URL` (R2 já usado por `src/lib/r2.ts`)
  - **2026-09-26 (testes)**: `tests/env.test.ts` (12) — default `SOCKET_PORT` 3003, empty→undefined, URLs válidas/inválidas, coerção/faixa de porta, enum `SHARP_*`, erro `parseEnv` com path+mensagem por issue, memoização `getEnv` + `resetEnvCache` + lançamento com env inválido; `parseEnv` passou a aceitar `Record<string, string | undefined>` (o repo exige `NODE_ENV` em `NodeJS.ProcessEnv`)
- [x] T023 [P1] [US-025] Verify kin-maya.ts em `src/lib/calculations/kin-maya.ts` — Assertion em `tests/horoscopes.test.ts`: export `calculateKinMaya(birthDate: Date): number` existe (falha do teste se ausente)

**After completing**: `npm run lint` → `npm run type-check` → `npm run test` → mark Phase 0 ✅

---

### Phase 0.5: Shared Infrastructure (T024–T042)

**Status**: ✅ Done
**Objective**: Infraestrutura compartilhada (analytics, moderação, feed, rate limits, CSRF, OG image, cache, mentions, fallbacks, hooks, env, error handling)
**Dependencies**: Phase 0

**Tasks**:

- [x] T024 [P1] [US-020] Extend analytics utility em `src/lib/analytics.ts` (arquivo existe) — Typed events: `trackPostCreate()`, `trackLike()`, `trackComment()`, `trackFollow()`, `trackGiftSend()`, `trackHoroscopeView()`, `trackGiftClaimDaily()`, `trackVersosEarned()`, `trackPostLimitHit()`, `trackCsrfFailure()`; manter consent-first PostHog init
- [x] T025 [P1] [US-022] Create moderation utility em `src/lib/moderation.ts` — `checkContent(content): { allowed: boolean, flaggedWords: string[] }`; blocked words via env `MODERATION_BLOCKED_WORDS`
- [x] T026 [P1] [US-022] Create feed algorithm em `src/lib/social/feed-algorithm.ts` — `getFeed(userId, cursor?, limit=10)`: candidatos visíveis (S2-15) de `followingIds`; ordenação S2-5 em 4 níveis (tier 1 `isPinned` máx 1/10; tier 2 engajamento últimas 2h por `engagementScore = likes + comments×2`; tier 3 `createdAt` desc; tier 4 desempate por interação prévia do viewer via `PostLike`/`Comment`); cursor `(createdAt, id)`; fallback explore se 0 following
- [x] T027 [P1] [US-021] Create rate limiter em `src/lib/social/limits.ts` — `checkPostLimit(userId)` (tier-aware: 10/dia FREE, 50/dia Plus via `User.subscriptionTier`), `checkLikeLimit()`, `checkCommentLimit()`, `checkFollowLimit()`, `checkGiftLimit()`, `checkUploadLimit()`; Redis sorted sets + TTL; retorna `{ allowed, remaining, resetAt }` (única casa dos limites sociais — S2-10); **fail-open em Redis down (Q26): libera + `logger.warn` + evento `rate_limiter_bypass`, com fallback de daily limits via count Prisma**; **estender T024 com `trackRateLimiterBypass()`**
- [x] T028 [P1] [US-020] Extend CSRF utility em `src/lib/csrf.ts` (arquivo existe com `validateCsrfToken`) — **reutilizar** `csrfCookieName()`/`generateCsrfToken()` (`src/lib/csrf-cookie-name.ts`) e `ensureCsrfCookie()` (`src/lib/csrf-client.ts`) já existentes desde o Sprint 1 — adicionar ao `src/lib/csrf.ts` apenas helpers server-side faltantes; cookie `csrf-token`/`__Host-csrf-token` vs header `x-csrf-token` (pattern `set-csrf-cookie-client-side`)
- [x] T029 [P1] [US-022] Create OG image utility em `src/lib/og-image.ts` — `generatePostOgImage(post)`; sharp + @vercel/og fallback; SVG 1200×630 template
- [x] T030 [P1] [US-022] Create feed cache em `src/lib/feed-cache.ts` — Materialized view para >1000 following; `refreshFeedCache(userId)`, `getCachedFeed(userId, cursor)`
- [x] T031 [P1] [US-021] Create mention/hashtag parser em `src/lib/social/mentions.ts` — `parseMentions()`, `parseHashtags()`, `linkifyMentionsHashtags()`
- [x] T032 [P1] [US-024] Create fallback templates em `prisma/seed.ts` — Default daily/weekly/monthly para 12 signos, 60 combos Chinese, 260 Maya kins
- [x] T033 [P1] [US-024] Create BullMQ queue em `src/lib/queue/horoscope-queue.ts` — `Queue('horoscope-generation')`; Redis; concurrency 3; retry 2× backoff
- [x] T034 [P1] [US-024] Create AI prompt templates em `src/lib/horoscopes/prompts.ts` — Templates por tipo/período/mood; variáveis sign, date, luckyNumber, luckyColor, compatibility
- [x] T035 [P1] [US-024] Create content validation em `src/lib/horoscopes/validation.ts` — Zod schema para `HoroscopeContent.content` com contagem de palavras **por período** (RF-HORO-001): diário 150-250, semanal 300-500, mensal 500-800; markdown permitido
- [x] T036 [P1] [US-026] Create gift catalog em `src/lib/social/gifts.ts` — SPEC-007 exato: Estrela Cadente(10), Rosa Mística(25), Cristal(50), Bola de Cristal(100), Coroa Astral(200), Dragão Dourado(500); `getGiftCost()`, `validateGiftId()`
- [x] T037 [P1] [US-026] Create Versos earnings em `src/lib/social/versos.ts` — `earnVersos(userId, source)`: like=1, comment=2, follow=5, reading=10; fontes fixas no enum `VersosSource`; **"milestones" (sprint-2 task 29) = os streak milestones do claim-daily (T122: dia 7=50, dia 30=200)** — sem outro tipo de milestone no MVP; sempre `$transaction` com checagem `versosBalance >= 0` (S2-17)
- [x] T038 [P1] [US-024] Create shared hooks em `src/hooks/use-horoscopes.ts` e `src/hooks/use-social.ts` — `useHoroscopes(type, period, date)`, `useMyHoroscope()`, `useHoroscopeHistory(cursor)`, `useNotifications()`, `useUnreadCount()`; TanStack Query (matriz de compatibilidade vive só no código — T090/SC7)
- [x] T039 [P1] [US-020] Create error.tsx files — `src/app/error.tsx`, `src/app/global-error.tsx`, `src/app/(app)/error.tsx`, `src/app/(app)/feed/error.tsx`, `src/app/(app)/explorar/error.tsx`, `src/app/(app)/horoscopos/error.tsx`, `src/app/(app)/post/[id]/error.tsx`
- [x] T040 [P1] [US-021] Create rate limit middleware em `src/lib/middleware/rate-limit.ts` — Aplica T027 em endpoints sociais; headers `Retry-After`, `X-RateLimit-Remaining`; propaga modo fail-open de T027 (sem 503, Q26)
- [x] T041 [P1] [US-020] Create CSRF middleware em `src/lib/middleware/csrf.ts` — Valida `x-csrf-token` vs cookie em POST/PATCH/DELETE
- [x] T042 [P1] [US-022] Create feed cache cron job em `src/jobs/feed-cache-refresh.ts` — CRON `*/5 * * * *`; refresh para >1000 following
  - **2026-09-28 (clarify Q34/SC34)**: schedule muda para **`0 * * * *` (horário)** — Vercel Hobby (tier alvo) rejeita cron < 1 dia e **falha o deploy**
  - **2026-09-28 (execução, correção do dono)**: a doc oficial da Vercel mostra que `0 * * * *` (per-hour) **também falha em Hobby** (`Hobby accounts are limited to daily cron jobs`); dono confirmou via pergunta na execução → schedule final **`0 0 * * *` (diário 00:00 UTC)**; `vercel.json` + `FEED_CACHE_REFRESH_CRON` ajustados

**After completing**: `npm run lint` → `npm run type-check` → `npm run test` → mark Phase 0.5 ✅

---

### Phase 1: Follow System & Profile Integration (T043–T050)

**Status**: ✅ Done
**Objective**: Follow/unfollow API, listas, contador
**Dependencies**: Phase 0.5

**Tasks**:

- [x] T043 [P1] [US-020] Implement `POST /api/v1/social/follow/:userId` em `src/app/api/v1/social/follow/[userId]/route.ts` — Bearer; `checkFollowLimit` (T027, 20/min); valida não-si-mesmo; valida `maxFollowing`; valida `whoCanFollow` via `canFollow` (T049, lê `UserProfile.privacy`); toggle; cria `Notification` ao seguido; `earnVersos` (T037); emit `follow-update`/`notification` (alvo room `user:{targetId}`) wireado em T088
- [x] T044 [P1] [US-020] Implement `GET /api/v1/users/:username/followers` em `src/app/api/v1/users/[username]/followers/route.ts` — Cursor-based; suporta `?q=` busca; **envelope `{ data, pagination: { nextCursor } }` (S2-18 — primeira rota a fixar o shape; hooks union estreitados aqui)**
- [x] T045 [P1] [US-020] Implement `GET /api/v1/users/:username/following` em `src/app/api/v1/users/[username]/following/route.ts` — Cursor-based; suporta `?q=` busca; envelope S2-18
- [x] T046 [P1] [US-020] Update `GET /api/v1/users/:username/profile` em `src/app/api/v1/users/[username]/profile/route.ts` — Incluir `followersCount`, `followingCount`, `isFollowing`
- [x] T047 [P1] [US-020] Create `FollowButton` em `src/components/social/follow-button.tsx` — Toggle com loading; otimistic update via TanStack Query
- [x] T048 [P1] [US-020] Create `FollowersModal`/`FollowingModal` em `src/components/social/followers-modal.tsx` — Lista com avatar, nome, username, botão; busca por nome
- [x] T049 [P1] [US-020] Create `canFollow` em `src/lib/social/privacy.ts` — `canFollow(currentUser, targetUser)`: lê `UserProfile.privacy.whoCanFollow` (Sprint 1, S2-14); retorna `{ allowed, reason? }`
- [x] T050 [P1] [US-020] Create integration tests em `tests/integration/social-follow.test.ts` — Follow/unfollow, listas, validações, anti-self, maxFollowing, privacy (`whoCanFollow`), criação de Notification, rate limit follow 20/min (`checkFollowLimit`)

**After completing**: `npm run lint` → `npm run type-check` → `npm run test` → mark Phase 1 ✅

---

### Phase 2: Feed Backend & Post System (T051–T065)

**Status**: ⬜ Pending
**Objective**: Post CRUD, feed, upload de imagens, OG image, search
**Dependencies**: Phase 0.5

**Tasks**:

- [ ] T051 [P1] [US-021] Implement `POST /api/v1/social/posts` em `src/app/api/v1/social/posts/route.ts` — Bearer; Zod `{ type, content?, imageUrls?, readingId?, audience, commentsDisabled? }` com limites por tipo (texto ≤500, imagem ≤300, tiragem ≤200); valida `imageUrls` ≤4 com prefixo `posts/{userId}/` (tipo/tamanho autoritativos no presign T064/S2-12); `checkPostLimit` (T027); CSRF (T041); daily limit (10 free/50 Plus); `checkContent` (T025); $transaction Post + PostHashtag; `earnVersos` (T037) se type='reading'; **contadores: criação não altera `commentCount`/`likeCount` (defaults 0); updates pertencem a T076/T077/T081 (S2-19)**; emit `post:new` (alvo rooms `user:{id}`/`feed:{id}` dos seguidores) wireado em T088
- [ ] T052 [P1] [US-022] Implement `GET /api/v1/social/feed` em `src/app/api/v1/social/feed/route.ts` — Cursor-based `WHERE (createdAt, id) < (cursorCreatedAt, cursorId)`; **predicado de visibilidade (S2-15)**: `audience='public'` OU (`audience='followers'` E viewer segue author) E não `isHidden`, honrando `UserProfile.privacy.profileVisibility` (privado → só seguidores); aplica ordenação S2-5 (4 níveis via T026); `limit` default **10** (máx 50); fallback explore; retorna `{ posts, nextCursor }` da lib **envolvido no envelope `{ data, pagination }` (S2-18)**
- [ ] T053 [P1] [US-022] Implement `GET /api/v1/social/explore/trending` em `src/app/api/v1/social/explore/trending/route.ts` — Públicos por engagementScore desc, limit 20
- [ ] T054 [P1] [US-022] Implement `GET /api/v1/social/explore/hashtags` em `src/app/api/v1/social/explore/hashtags/route.ts` — Top 10 hashtags da semana
- [ ] T055 [P1] [US-022] Implement `GET /api/v1/social/explore/suggestions` em `src/app/api/v1/social/explore/suggestions/route.ts` — Excluir seguidos + si; limit 10
- [ ] T056 [P1] [US-022] Implement `GET /api/v1/social/search` em `src/app/api/v1/social/search/route.ts` — Query `q`; posts + users + hashtags; posts filtrados pela visibilidade S2-15
- [ ] T057 [P1] [US-021] Implement `GET /api/v1/social/posts/:id` em `src/app/api/v1/social/posts/[id]/route.ts` — Post + comentários nested 1 nível; **checa visibilidade S2-15** (404 se `audience='followers'` sem follow, perfil privado sem follow, ou `isHidden`); anti-timing
- [ ] T058 [P1] [US-021] Implement `GET /api/v1/social/posts/:id/og-image` em `src/app/api/v1/social/posts/[id]/og-image/route.ts` — Usa `generatePostOgImage` (T029); mesma checagem de visibilidade S2-15 de T057
- [ ] T059 [P1] [US-021] Create `PostCard` em `src/components/social/post-card.tsx` — Avatar, nome, timestamp relativo, mentions/hashtags clicáveis (T031), grid imagens, preview tiragem, barra ações, animação entrada
- [ ] T060 [P1] [US-021] Create `PostComposer` em `src/components/social/post-composer.tsx` — Modal; abas Texto/Imagem/Tiragem; contador chars (500/300/200); menções/hashtags (T031) com **debounce 300ms** (RF-SOC-003); upload até 4 imagens via presign T064 (valida JPEG/PNG/WebP ≤5MB client-side); seletor audience; toggle `commentsDisabled`; CSRF (T028)
- [ ] T061 [P1] [US-022] Create `FeedPage` em `src/app/(app)/feed/page.tsx` — Infinite scroll (IntersectionObserver, **páginas de 10 — S2-5**), pull-to-refresh, barra criação rápida, skeleton, empty state CTA; **pill "N novos posts" no topo (Q27): escuta `post:new` (T072), acumula pendentes, clique insere com slide-in (dedup por id)**
- [ ] T062 [P1] [US-022] Create hooks em `src/hooks/use-feed.ts` — `useFeed(cursor)`, `useCreatePost()`, `useTrending()`, `useExploreSuggestions()`, `useSearch(q)`; **`useFeed` expõe `pendingPosts` + `flushPending()` (Q27, pill do T061)**
- [ ] T063 [P1] [US-021] Create `ShareModal` em `src/components/social/share-modal.tsx` — Copiar link, download PNG, Web Share API, social links
- [ ] T064 [P1] [US-021] Implement `POST /api/v1/social/posts/images/presign` em `src/app/api/v1/social/posts/images/presign/route.ts` — Bearer; CSRF (T041); Zod `{ images: [{ contentType }] }` com `max 4` e contentType ∈ `image/jpeg|image/png|image/webp`; valida Content-Length ≤5MB por imagem; `checkUploadLimit` (T027); keys `posts/{userId}/{ts}-{i}.{ext}`; reutiliza `generatePresignedUrl` de `src/lib/r2.ts` (pattern do avatar presign); retorna `{ uploads: [{ uploadUrl, key }] }` para PUT direto ao R2 (RF-SOC-003, RNF-SOC-003)
- [ ] T065 [P1] [US-021] Create integration tests em `tests/integration/social-feed.test.ts` — POST/GET feed, daily limit, audience, presign upload (validações tipo/tamanho/limite 4), OG image, explore, search, rate limits

**After completing**: `npm run lint` → `npm run type-check` → `npm run test` → mark Phase 2 ✅

---

### Phase 2.5: WebSocket Foundation (T066–T075)

**Status**: ⬜ Pending
**Objective**: Socket.io server standalone; emitters; polling fallback — habilita Phase 3
**Dependencies**: Phase 2

**Tasks**:

- [ ] T066 [P1] [US-020] Create Socket.io server em `socket-service/index.ts` — Porta 3003 (`SOCKET_PORT`); Redis adapter; CORS `AUTH_URL`; JWT auth middleware (`socket.data.userId`); rooms `user:{id}`, `feed:{id}`, `post:{id}`, `comment:{id}`; `GET /health`
- [ ] T067 [P1] [US-020] Create Dockerfile em `socket-service/Dockerfile` — `node:20-alpine`; healthcheck `wget -qO- http://localhost:3003/health`
- [ ] T068 [P1] [US-020] Create PM2 config em `socket-service/ecosystem.config.js` — Cluster mode, `instances: 'max'`
- [ ] T069 [P1] [US-020] Create env validation em `socket-service/src/lib/env.ts` — Zod: `REDIS_URL`, `SOCKET_PORT`, `AUTH_URL`, `JWT_SECRET`
- [ ] T070 [P1] [US-020] Create event emitters em `socket-service/src/emitters.ts` — `emitNewPost()` (followers' `user:`/`feed:` rooms), `emitLikeUpdated()`/`emitCommentAdded()`/`emitCommentLikeUpdated()` (room `post:{id}`), `emitFollowUpdate()`/`emitNotification()` (room `user:{id}`), `emitGiftReceived()` (room `user:{toUserId}`); TypeScript interfaces
- [ ] T071 [P1] [US-020] Create polling endpoints (4 route files) — `src/app/api/v1/social/polling/posts/route.ts`, `src/app/api/v1/social/polling/likes/route.ts`, `src/app/api/v1/social/polling/comments/route.ts`, `src/app/api/v1/social/polling/notifications/route.ts` — GET `?since=` em cada
- [ ] T072 [P1] [US-020] Create `useSocket` hook em `src/hooks/use-socket.ts` — Auth via auth-store; join rooms `user:{userId}` e `feed:{userId}` no connect + `post:{postId}`/`comment:{id}` sob demanda (PostDetail aberto); reconnect backoff (1s→30s); fallback polling 30s (T071); typed listeners
- [ ] T073 [P1] [US-020] Create `NotificationsProvider` em `src/components/social/notifications-provider.tsx` — Context global unreadCount; WebSocket `notification` event; badge no AppHeader
- [ ] T074 [P1] [US-020] Create integration tests em `tests/integration/websocket.test.ts` — Auth, rooms, events, reconnect, fallback
- [ ] T075 [P1] [US-020] Create E2E test em `tests/e2e/social-realtime.spec.ts` — 2 browsers: post → feed real-time; like/comment/follow/gift → notification; reconnect; fallback

**After completing**: `npm run lint` → `npm run type-check` → `npm run test` → mark Phase 2.5 ✅

---

### Phase 3: Interactions (T076–T089)

**Status**: ⬜ Pending
**Objective**: Likes, comments CRUD, likes de comentário, notificações in-app, wiring WebSocket
**Dependencies**: Phase 2.5

**Tasks**:

- [ ] T076 [P1] [US-023] Implement `POST /api/v1/social/posts/:id/like` em `src/app/api/v1/social/posts/[id]/like/route.ts` — Bearer; `checkLikeLimit` (T027); toggle; **`Post.likeCount` increment/decrement no MESMO `$transaction` do toggle (S2-19)**; **bloqueia auto-like** (RF-SOC-004: 403 `SELF_LIKE`); **post `isHidden`/privado/removido → 404 `POST_NOT_FOUND` uniforme com o GET (Q28, anti-timing)**; **curtidas anônimas — endpoint não expõe lista de quem curtiu (RF-SOC-004)**; cria `Notification` ao autor (se ≠ self); `earnVersos` (T037); emit `like-updated` (room `post:{id}`) + `notification` (room `user:{authorId}`)
- [ ] T077 [P1] [US-023] Implement `POST /api/v1/social/posts/:id/comments` em `src/app/api/v1/social/posts/[id]/comments/route.ts` — Bearer; `checkCommentLimit` (T027); CSRF (T041); Zod `{ content ≤300, parentCommentId? }`; valida parent no mesmo post; **`Post.commentCount` +1 no MESMO `$transaction` do insert (S2-19)**; **post `isHidden`/privado/removido → 404 `POST_NOT_FOUND` (Q28)**; valida `commentsDisabled` do post **e** `UserProfile.privacy.whoCanComment` do autor (403 `COMMENTS_DISABLED` / `WHO_CAN_COMMENT`); cria `Notification` ao autor do post e ao autor do comentário pai (se ≠ self); `earnVersos` (T037); emit `comment-added` (room `post:{id}`) + `notification` (rooms `user:` dos notificados)
- [ ] T078 [P1] [US-023] Implement `GET /api/v1/social/posts/:id/comments` em `src/app/api/v1/social/posts/[id]/comments/route.ts` — Cursor-based; **lote default 10** (RF-SOC-005); nested 1 nível; ordenação mais recentes primeiro
- [ ] T079 [P1] [US-023] Implement `PATCH /api/v1/social/comments/:id` em `src/app/api/v1/social/comments/[id]/route.ts` — Só autor; 15min window; **soft delete em T080 decrementa `Post.commentCount` no mesmo `$transaction` (S2-19)**
- [ ] T080 [P1] [US-023] Implement `DELETE /api/v1/social/comments/:id` em `src/app/api/v1/social/comments/[id]/route.ts` — Só autor; soft delete `content="[removido]"`; **`Post.commentCount` −1 no MESMO `$transaction` (S2-19)**
- [ ] T081 [P1] [US-023] Implement `POST /api/v1/social/comments/:id/like` em `src/app/api/v1/social/comments/[id]/like/route.ts` — Bearer; toggle `CommentLike` (T013); atualiza `Comment.likeCount` **no MESMO `$transaction` do toggle (S2-19)**; `checkLikeLimit` (T027); contagem apenas, **sem lista de quem curtiu** (RF-SOC-005); emit `comment-like-updated`
- [ ] T082 [P1] [US-023] Implement `GET /api/v1/social/notifications` em `src/app/api/v1/social/notifications/route.ts` — Cursor; filtros `isRead`; **envelope `{ data: { notifications }, pagination: { nextCursor } }` + `unreadCount` em `data` (S2-18 — resolve a divergência flat × envelope anotada em `docs/04-api/social.md`)**
- [ ] T083 [P1] [US-023] Implement `PATCH /api/v1/social/notifications/:id/read` em `src/app/api/v1/social/notifications/[id]/read/route.ts` — Marca como lida
- [ ] T084 [P1] [US-023] Implement `PATCH /api/v1/social/notifications/read-all` em `src/app/api/v1/social/notifications/read-all/route.ts` — Marca todas
- [ ] T085 [P1] [US-023] Create `CommentSection` em `src/components/social/comment-section.tsx` — Lista, input (≤300 chars), respostas 1 nível, "Carregar mais", botão like com contagem (T081)
- [ ] T086 [P1] [US-023] Create `NotificationsDropdown` em `src/components/social/notifications.tsx` — Badge unread; lista tipo/mensagem/timestamp; mark-as-read
- [ ] T087 [P1] [US-023] Create `SocialStore` em `src/stores/social-store.ts` — **Apenas client state**: `unreadCount`, `notifications`, `addPostToFeed`, `updatePostLike`, `addCommentToPost`, `setUnreadCount`; NÃO feedPosts (useFeed hooks)
- [ ] T088 [P1] [US-023] Wire realtime nos routes anteriores — em `src/app/api/v1/social/follow/[userId]/route.ts` (T043): `emitFollowUpdate` + `emitNotification` após criar `Notification`; em `src/app/api/v1/social/posts/route.ts` (T051): `emitNewPost` para rooms dos seguidores; contrato de eventos com `socket-service/src/emitters.ts` (T070); **sem duplicar** emits de like/comment/gift (já em T076/T077/T120)
- [ ] T089 [P1] [US-023] Create integration tests em `tests/integration/social-interactions.test.ts` — Like toggle + auto-like 403, comments CRUD + `commentsDisabled` 403 + limits, comment like (contagem), notifications criadas (like/comment/follow), rate limits, earnVersos

**After completing**: `npm run lint` → `npm run type-check` → `npm run test` → mark Phase 3 ✅

---

### Phase 4: Horóscopo Ocidental (T090–T103, T144–T145)

**Status**: ⬜ Pending
**Objective**: Compatibilidade, signos, conteúdo diário, página, cron jobs, settings de notificação
**Dependencies**: Phase 0.5

**Tasks**:

- [ ] T090 [P1] [US-024] Create compatibility matrix em `src/lib/horoscopes/western-compatibility.ts` — `getCompatibility(a, b): { love, friendship, work, overall }`; 12×12 hardcoded em código — **única fonte de verdade** (SC7; não há seed, não há leitura de DB)
- [ ] T091 [P1] [US-024] Create `WesternHoroscopeCard` em `src/components/horoscopes/western-horoscope-card.tsx` — Ícone Unicode, seções colapsáveis (Amor/Carreira/Saúde), número/cor sorte, compatibilidade, compartilhar
- [ ] T092 [P1] [US-024] Create `WesternHoroscopePage` em `src/app/(app)/horoscopos/ocidental/page.tsx` — Signo em destaque, seletor signo, diário/semanal/mensal, compatibilidade
- [ ] T093 [P1] [US-024] Implement `GET /api/v1/horoscopes/western` em `src/app/api/v1/horoscopes/western/route.ts` — Query `sign`, `period`, `date`, `targetSign` (compat via T090); fallback template (T032)
- [ ] T094 [P1] [US-024] Implement `GET /api/v1/horoscopes/my-horoscope` em `src/app/api/v1/horoscopes/my-horoscope/route.ts` — Bearer; agrega western + chinese + mayan via libs `src/lib/horoscopes/*` (T018/T019/T020) + `HoroscopeContent` — **sem depender das rotas das Fases 5/6**
- [ ] T095 [P1] [US-024] Implement `GET /api/v1/horoscopes/history` em `src/app/api/v1/horoscopes/history/route.ts` — Bearer; cursor; `HoroscopeEntry[]` (RF-HORO-007)
- [ ] T096 [P1] [US-024] Create `HoroscopeHistoryPage` em `src/app/(app)/horoscopos/historico/page.tsx` — Paginada com filtros
- [ ] T097 [P1] [US-024] Create cron job em `src/jobs/horoscope-generation.ts` — CRON 04:00 BRT; BullMQ (T033); gera conteúdo se não existe; loga resultado
- [ ] T098 [P1] [US-024] Create worker em `src/jobs/horoscope-worker.ts` — Processa BullMQ; prompt (T034) → IA → valida (T035) → salva; fallback template (T032) se falhar
- [ ] T099 [P1] [US-024] Create unit tests em `tests/horoscopes-western.test.ts` — getWesternSign bordas, compatibilidade, API shape
- [ ] T100 [P1] [US-024] Create integration tests em `tests/integration/horoscopes-western.test.ts` — GET endpoints, cron, my-horoscope, history
- [ ] T101 [P1] [US-024] Implement `POST /api/v1/ai/horoscope-interpret` em `src/app/api/v1/ai/horoscope-interpret/route.ts` — Bearer; **valida e consome 1 unidade da cota diária de IA via `checkDailyAILimit` (`src/lib/ai/rate-limit.ts`) → 429 `AI_DAILY_LIMIT_REACHED`** (RF-HORO-006); SSE streaming
- [ ] T102 [P1] [US-024] Create notification cron em `src/jobs/horoscope-notifications.ts` — **Cron horário `0 * * * *` (BRT)** com filtro `HoroscopeNotification.hour = hora atual` (default 7 = 07:00 BRT, honrando `hour` configurável do RF-HORO-008); para usuários habilitados no sistema da hora; **cria `Notification` rows** in-app conforme toggles (RF-HORO-008)
- [ ] T103 [P1] [US-024] Implement `PATCH /api/v1/horoscopes/notifications/settings` em `src/app/api/v1/horoscopes/notifications/settings/route.ts` + UI `src/components/horoscopes/notification-settings.tsx` — Bearer; Zod `{ westernEnabled?, chineseEnabled?, mayaEnabled?, hour?: 0–23 }`; upsert `HoroscopeNotification`; toggle/hora na seção de notificações de `src/app/(app)/perfil/page.tsx` (RF-HORO-008: configurável pelo usuário)
- [ ] T144 [P2] [US-024] Create seção de horóscopos no perfil (RF-HORO-004) em `src/components/horoscopes/profile-horoscopes.tsx` — consome `useMyHoroscope()` (T038 → T094); exibe signo ocidental, animal+elemento chinês e Kin Maya em `src/app/(app)/perfil/page.tsx` e `src/app/(app)/perfil/[username]/page.tsx`
- [ ] T145 [P2] [US-024] Create availability check em `src/jobs/horoscope-availability-check.ts` (RNF-HORO-001, AC-24) — CRON `0 6 * * *` (BRT); verifica `HoroscopeContent` do dia **pela data civil BRT corrente (Q25)** (western diário × 12 signos); ausência → `logger.warn` + evento PostHog `horoscope_missing` (extender T024)

**After completing**: `npm run lint` → `npm run type-check` → `npm run test` → mark Phase 4 ✅

---

### Phase 5: Horóscopo Chinês (T104–T109)

**Status**: ⬜ Pending
**Objective**: Animal, elementos, 60 ciclos, conteúdo
**Dependencies**: Phases 0.5, 4 (estende cron/worker T097/T098)

**Tasks**:

- [ ] T104 [P1] [US-024] Create `ChineseHoroscopeCard` em `src/components/horoscopes/chinese-horoscope-card.tsx` — Imagem animal, nome + elemento ("Cavalo de Metal"), características chips
- [ ] T105 [P1] [US-024] Create `ChineseHoroscopePage` em `src/app/(app)/horoscopos/chines/page.tsx` — Animal/elemento em destaque, seletor, diário/semanal/mensal
- [ ] T106 [P1] [US-024] Implement `GET /api/v1/horoscopes/chinese` em `src/app/api/v1/horoscopes/chinese/route.ts` — Query `animal`, `element`, `period`, `date`; fallback template (T032)
- [ ] T107 [P1] [US-024] Extend cron generation em `src/jobs/horoscope-generation.ts` — 60 combos (animal+elemento); via worker T098
- [ ] T108 [P1] [US-024] Create unit tests em `tests/horoscopes-chinese.test.ts` — Antes/depois Ano Novo, 60 ciclos
- [ ] T109 [P1] [US-024] Create integration tests em `tests/integration/horoscopes-chinese.test.ts` — GET endpoints, cron

**After completing**: `npm run lint` → `npm run type-check` → `npm run test` → mark Phase 5 ✅

---

### Phase 6: Horóscopo Maia / Kin Maya (T110–T117)

**Status**: ⬜ Pending
**Objective**: Tzolkin, Selos, Tons, Onda Encantada, página
**Dependencies**: Phases 0.5, 4 (estende cron/worker T097/T098; página de interpretação usa T101)

**Tasks**:

- [ ] T110 [P1] [US-025] Expand `src/lib/calculations/kin-maya.ts` — 20 Selos (nome, significado, direção, cor), 13 Tons (nome, keyword, ação, poder), `getMayanOndaEncantada(kinNumber)` 9 posições
- [ ] T111 [P1] [US-025] Create `MayanHoroscopeCard` em `src/components/horoscopes/mayan-horoscope-card.tsx` — Visual temático (cores selos), Selo + Tom destaque, elementos gráficos maias
- [ ] T112 [P1] [US-025] Create `MayanHoroscopePage` em `src/app/(app)/horoscopos/maia/page.tsx` — Kin em destaque, seletor kin, Onda Encantada 9 cards, detalhes Selo/Tom
- [ ] T113 [P1] [US-025] Implement `GET /api/v1/horoscopes/maya` em `src/app/api/v1/horoscopes/maya/route.ts` — Query `kinNumber`, `period`, `date`; fallback template (T032)
- [ ] T114 [P1] [US-025] Extend cron generation em `src/jobs/horoscope-generation.ts` — 260 kins; via worker T098
- [ ] T115 [P1] [US-025] Create unit tests em `tests/horoscopes-mayan.test.ts` — Tzolkin, Selos/Tons, Onda Encantada
- [ ] T116 [P1] [US-025] Create integration tests em `tests/integration/horoscopes-mayan.test.ts` — GET endpoints, cron, my-horoscope
- [ ] T117 [P1] [US-024] Create interpretation page em `src/app/(app)/horoscopos/[type]/interpret/page.tsx` — StreamingInterpretation via endpoint T101 (RF-HORO-006)

**After completing**: `npm run lint` → `npm run type-check` → `npm run test` → mark Phase 6 ✅

---

### Phase 7: Gifts + Versos Economy (T118–T125, T142–T143)

**Status**: ⬜ Pending
**Objective**: Catálogo gifts, moeda Versos, ganhos/gastos
**Dependencies**: Phases 0.5, 1, 3 (T123 wireia T043/T076/T077)

**Tasks**:

- [ ] T118 [P1] [US-026] Create `GiftSelector` em `src/components/social/gift-selector.tsx` — Modal 6 gifts SPEC-007; ícone animado, preço Versos; saldo topo; animação envio; confirmação
- [ ] T119 [P1] [US-026] Create `GiftsPage` em `src/app/(app)/presentes/page.tsx` — Catálogo, saldo Versos, histórico, ganhos diários
- [ ] T120 [P1] [US-026] Implement `POST /api/v1/social/gifts/send` em `src/app/api/v1/social/gifts/send/route.ts` — Bearer; CSRF; Zod `{ toUserId, giftId }`; **self-gift → 403 `SELF_GIFT`**; `validateGiftId` (T036); `checkGiftLimit` (T027); valida saldo (`versosBalance >= custo`); **debito + creditos em `$transaction` (S2-17)**: decrementa remetente; `recipientEarnsHalf` se PROFESSIONAL (+50% ao destinatário na mesma transação); cria Gift; cria `Notification` ao destinatário; emit `gift-received` + `notification` (room `user:{toUserId}`); `earnVersos` (T037)
- [ ] T121 [P1] [US-026] Implement `GET /api/v1/social/versos/balance` em `src/app/api/v1/social/versos/balance/route.ts` — Bearer; lê `UserProfile.versosBalance`/`versosStreak`/`lastClaimAt` (S2-17); retorna `{ balance, dailyEarned, streak }`
- [ ] T122 [P1] [US-026] Implement `POST /api/v1/social/versos/claim-daily` em `src/app/api/v1/social/versos/claim-daily/route.ts` — 10 base + streak milestones (dia 7=50, dia 30=200, T037); idempotente por `lastClaimAt` (mesmo dia → 409 `ALREADY_CLAIMED`); streak reset ao perder dia; `$transaction` S2-17
- [ ] T123 [P1] [US-026] Wire `earnVersos` (T037) na rota de criação de reading do Sprint 1 em `src/app/api/v1/readings/route.ts` + smoke-test dos hooks já declarados em T043/T051/T076/T077 — todos chamam `earnVersos(userId, source)`
- [ ] T124 [P1] [US-026] Create unit tests em `tests/social-gifts.test.ts` — Gift send (saldo, custo, recipientEarnsHalf), earnings, streak
- [ ] T125 [P1] [US-026] Create integration tests em `tests/integration/social-gifts.test.ts` — POST send (+Notification), balance, claim-daily, earnings
- [ ] T142 [P2] [US-026] Implement `GET /api/v1/social/gifts/received` em `src/app/api/v1/social/gifts/received/route.ts` — Bearer; query `userId`; honra visibilidade S2-15 (perfil privado → só seguidores); últimos 20 gifts recebidos `{ gifts, totalReceived }` (RF-SOC-006)
- [ ] T143 [P2] [US-026] Create `GiftsStrip` em `src/components/social/gifts-strip.tsx` — Gifts recebidos exibidos no perfil do destinatário com animação especial (RF-SOC-006); integra em `src/app/(app)/perfil/[username]/page.tsx`; atualização via evento `gift-received` (S2-1)

**After completing**: `npm run lint` → `npm run type-check` → `npm run test` → mark Phase 7 ✅

---

### Phase 8: Explore + Search (T126–T130)

**Status**: ⬜ Pending
**Objective**: Explore page, busca, moderação básica (UI + report endpoint)
**Dependencies**: Phase 2

**Tasks**:

- [ ] T126 [P1] [US-022] Create `ExplorePage` em `src/app/(app)/explorar/page.tsx` — Tabs Em Alta/Hashtags/Pessoas/Tiragens; busca topo; infinite scroll; skeleton
- [ ] T127 [P1] [US-022] Create `SearchPage` em `src/app/(app)/busca/page.tsx` — Unificada (posts, usuários, hashtags); filtros; paginada
- [ ] T128 [P1] [US-022] Implement `POST /api/v1/social/report` em `src/app/api/v1/social/report/route.ts` — Bearer; CSRF; Zod `{ targetType, targetId, reason }`; cria `ContentReport` (T012)
- [ ] T129 [P1] [US-022] Integrate moderation em feed/explore — `checkContent` (T025) em `src/app/api/v1/social/posts/route.ts` (T051); filtrar `Post.isHidden` e `User.isBanned` em `src/app/api/v1/social/feed/route.ts` (T052), `.../explore/trending/route.ts` (T053), `.../search/route.ts` (T056)
- [ ] T130 [P1] [US-022] Create integration tests em `tests/integration/social-explore.test.ts` — Explore tabs, search, report, moderação filters

**After completing**: `npm run lint` → `npm run type-check` → `npm run test` → mark Phase 8 ✅

---

### Phase 9: Frontend Integration & Polish (T131–T141, T146)

**Status**: ⬜ Pending
**Objective**: Páginas finais, components layout, E2E tests, polish
**Dependencies**: Phases 1–8

**Tasks**:

- [ ] T131 [P1] [US-021] Create `PostDetailPage` em `src/app/(app)/post/[id]/page.tsx` — PostCard + CommentSection + ShareModal; SEO meta tags
- [ ] T132 [P1] [US-023] Create `NotificationsPage` em `src/app/(app)/notificacoes/page.tsx` — Lista completa, filtros, mark-all-read
- [ ] T133 [P1] [US-020] Update `MobileNav` em `src/components/layout/mobile-nav.tsx` — 5 tabs: Feed, Explorar, Notificações, Presentes, Perfil
- [ ] T134 [P1] [US-023] Update `AppHeader` em `src/components/layout/app-header.tsx` — Notification bell + badge unreadCount + dropdown (T073)
- [ ] T135 [P1] [US-020] Add loading/error/empty states em `src/app/(app)/feed/page.tsx`, `src/app/(app)/explorar/page.tsx`, `src/components/horoscopes/*` — Skeleton; empty states com CTAs
- [ ] T136 [P1] [US-020] Integrate PostHog events (T024) nos consumers — `src/app/api/v1/social/posts/route.ts` (T051), `.../posts/[id]/like/route.ts` (T076), `.../posts/[id]/comments/route.ts` (T077), `.../follow/[userId]/route.ts` (T043), `.../gifts/send/route.ts` (T120), `src/app/api/v1/horoscopes/western/route.ts` (T093), `.../versos/claim-daily/route.ts` (T122), `src/lib/social/limits.ts` (`rate_limiter_bypass`, T027)
- [ ] T137 [P2] [US-021] Animation optimization em `src/components/social/post-card.tsx`, `src/components/social/gift-selector.tsx`, feed scroll — `will-change`, `transform` GPU, 60fps; medir com Chrome DevTools
- [ ] T138 [P1] [US-020] Create E2E tests em `tests/e2e/social-flows.spec.ts` — Feed CRUD, follow, like/comment, gift, horoscopes, explore, real-time 2 browsers
- [ ] T139 [P1] [US-024] Create E2E test em `tests/e2e/horoscopes-flow.spec.ts` — 3 sistemas, my-horoscope, compatibilidade, Onda Encantada, history, AI interpret
- [ ] T140 [P2] [US-020] Responsive polish em `src/app/(app)/**` + `src/components/layout/mobile-nav.tsx` — Mobile-first todas páginas; bottom tabs; drawer desktop
- [ ] T141 [P1] [US-020] Create full-flow E2E em `tests/e2e/full-flow-sprint2.spec.ts` — Cadastro → perfil → follow → post (+upload) → like/comment → gift → horóscopo → explore → notificações → moderação
- [ ] T146 [P1] [US-020] Create bench suite em `tests/bench/` (Q29, NFRs) — p95 endpoints sociais <500ms; feed <300ms com 1000 following sintéticos; Playwright tracing página de horóscopo <800ms; cronômetro unitário Kin <1ms; **método: ≥30 reqs/endpoint, 1 warmup descartado, P95 = percentile 95**; **isolamento: `vitest.config.ts` ganha `exclude: ["tests/bench/**"]` (não roda em `npm run test`) + package.json `bench` → `vitest run tests/bench/`**; roda via `npm run bench` no gate da Phase 9

**After completing**: `npm run lint` → `npm run type-check` → `npx playwright test` → `npm run bench` → mark Phase 9 ✅

---

### Phase 10: Data Integrity & Compliance (T147–T148)

**Status**: ✅ Completed
**Objective**: Reconciliar contadores sociais e purgar histórico de leituras pós-90d (LGPD)
**Dependencies**: T147 → Phase 3 (likes/comments existem); T148 → Phase 0 (models existem; pode rodar antes da Phase 3)

**Tasks**:

- [x] T147 [P1] [US-023] Create cron de reconciliação de contadores (S2-19, invariante I4 de `entities.md`) em `src/jobs/counter-reconcile.ts` — recomputa `Post.likeCount`/`Post.commentCount`/`Comment.likeCount` via `UPDATE ... SET count = (SELECT count(*) ...)` para todos os rows (ou só os divergentes); agendamento diário em `vercel.json` + rota `GET /api/cron/counter-reconcile` com `Bearer CRON_SECRET` (mesmo pattern do `hard-delete`); loga divergências corrigidas; **testes**: seed com drift artificial → reconcile → counts corretos + idempotência
- [x] T148 [P1] [US-020] Extend LGPD purge de leituras (S2-20, `docs/07-security/lgpd.md` retenção "90 dias após exclusão") em `src/jobs/hard-delete-accounts.ts` — para contas com `deletedAt > 90 dias`, apaga `Reading`/`ReadingCard`/`Interpretation` (ordenado por FK: Interpretation → ReadingCard → Reading) na mesma transação do job; janela de 30d (anonimização) e 90d (purge de leituras) coexistem; **testes**: conta 45d mantém leituras, conta 95d as perde; idempotência

**After completing**: `npm run lint` → `npm run type-check` → `npm run test` → mark Phase 10 ✅

---

## ✅ Master Checklist

### Phase 0: DB Migrations & Core Models
- [x] T001 Follow model
- [x] T002 Post model
- [x] T003 Comment model
- [x] T004 PostLike model
- [x] T005 PostHashtag model
- [x] T006 Gift model
- [x] T007 Notification model
- [x] T008 HoroscopeContent model
- [x] T009 HoroscopeEntry model
- [x] T010 HoroscopeLog model
- [x] T011 HoroscopeNotification model
- [x] T012 ContentReport model
- [x] T013 CommentLike model
- [x] T014 User additions
- [x] T015 Migration (migrate dev chain)
- [x] T016 Performance indexes
- [x] T017 Seed data completo
- [x] T018 Western algorithm
- [x] T019 Chinese algorithm
- [x] T020 Maya algorithm
- [x] T021 Horoscopes unit tests (656)
- [x] T022 Env validation
- [x] T023 Verify kin-maya.ts
- [x] TypeScript validation + lint + tests pass

### Phase 0.5: Shared Infrastructure
- [x] T024 Analytics utility (extend)
- [x] T025 Moderation utility
- [x] T026 Feed algorithm
- [x] T027 Social rate limits (única casa)
- [x] T028 CSRF utility (extend)
- [x] T029 OG image utility
- [x] T030 Feed cache
- [x] T031 Mention/hashtag parser
- [x] T032 Fallback templates
- [x] T033 BullMQ queue
- [x] T034 AI prompt templates
- [x] T035 Content validation
- [x] T036 Gift catalog utility
- [x] T037 Versos earnings util
- [x] T038 Shared hooks (use-horoscopes, use-social)
- [x] T039 error.tsx files
- [x] T040 Rate limit middleware
- [x] T041 CSRF middleware
- [x] T042 Feed cache cron job
- [x] TypeScript validation + lint + tests pass

### Phase 1: Follow System
- [x] T043 POST /social/follow/:userId (+Notification)
- [x] T044 GET /users/:username/followers
- [x] T045 GET /users/:username/following
- [x] T046 Update profile endpoint
- [x] T047 FollowButton
- [x] T048 FollowersModal
- [x] T049 canFollow privacy check (UserProfile.privacy)
- [x] T050 Follow integration tests
- [x] TypeScript validation + lint + tests pass

### Phase 2: Feed Backend
- [ ] T051 POST /social/posts (+char limits, commentsDisabled)
- [ ] T052 GET /social/feed
- [ ] T053 GET /explore/trending
- [ ] T054 GET /explore/hashtags
- [ ] T055 GET /explore/suggestions
- [ ] T056 GET /social/search
- [ ] T057 GET /posts/:id
- [ ] T058 GET /posts/:id/og-image
- [ ] T059 PostCard
- [ ] T060 PostComposer
- [ ] T061 FeedPage
- [ ] T062 use-feed hooks
- [ ] T063 ShareModal
- [ ] T064 POST /posts/images/presign (upload R2)
- [ ] T065 Feed integration tests
- [ ] TypeScript validation + lint + tests pass

### Phase 2.5: WebSocket Foundation
- [ ] T066 Socket.io server
- [ ] T067 Dockerfile
- [ ] T068 PM2 config
- [ ] T069 socket env validation
- [ ] T070 Event emitters
- [ ] T071 Polling endpoints (4 files)
- [ ] T072 use-socket hook (rooms join)
- [ ] T073 NotificationsProvider
- [ ] T074 WebSocket integration tests
- [ ] T075 E2E realtime test
- [ ] TypeScript validation + lint + tests pass

### Phase 3: Interactions
- [ ] T076 POST /like (auto-like 403 + Notification)
- [ ] T077 POST /comments (limits + Notification)
- [ ] T078 GET /comments
- [ ] T079 PATCH /comments/:id
- [ ] T080 DELETE /comments/:id
- [ ] T081 POST /comments/:id/like (CommentLike)
- [ ] T082 GET /notifications
- [ ] T083 PATCH /notifications/:id/read
- [ ] T084 PATCH /notifications/read-all
- [ ] T085 CommentSection (+like count)
- [ ] T086 NotificationsDropdown
- [ ] T087 SocialStore
- [ ] T088 Wire realtime (T043, T051)
- [ ] T089 Interactions integration tests
- [ ] TypeScript validation + lint + tests pass

### Phase 4: Horóscopo Ocidental
- [ ] T090 Western compatibility matrix
- [ ] T091 WesternHoroscopeCard
- [ ] T092 WesternHoroscopePage
- [ ] T093 GET /horoscopes/western
- [ ] T094 GET /horoscopes/my-horoscope
- [ ] T095 GET /horoscopes/history
- [ ] T096 HoroscopeHistoryPage
- [ ] T097 Cron job generation
- [ ] T098 Batch worker
- [ ] T099 Western unit tests
- [ ] T100 Western integration tests
- [ ] T101 POST /ai/horoscope-interpret
- [ ] T102 Horoscope notification cron (+Notification rows)
- [ ] T103 Notification settings API + UI
- [ ] T144 Profile horoscopes section (RF-HORO-004)
- [ ] T145 Horoscope availability check 06:00 BRT (RNF-HORO-001)
- [ ] TypeScript validation + lint + tests pass

### Phase 5: Horóscopo Chinês
- [ ] T104 ChineseHoroscopeCard
- [ ] T105 ChineseHoroscopePage
- [ ] T106 GET /horoscopes/chinese
- [ ] T107 Cron generation chinês
- [ ] T108 Chinese unit tests
- [ ] T109 Chinese integration tests
- [ ] TypeScript validation + lint + tests pass

### Phase 6: Horóscopo Maia
- [ ] T110 Expand kin-maya.ts
- [ ] T111 MayanHoroscopeCard
- [ ] T112 MayanHoroscopePage
- [ ] T113 GET /horoscopes/maya
- [ ] T114 Cron generation maia
- [ ] T115 Mayan unit tests
- [ ] T116 Mayan integration tests
- [ ] T117 Horoscope interpretation page
- [ ] TypeScript validation + lint + tests pass

### Phase 7: Gifts + Versos
- [ ] T118 GiftSelector
- [ ] T119 GiftsPage
- [ ] T120 POST /gifts/send (+Notification +emit)
- [ ] T121 GET /versos/balance
- [ ] T122 POST /versos/claim-daily
- [ ] T123 Wire earnVersos hooks
- [ ] T124 Gifts unit tests
- [ ] T125 Gifts integration tests
- [ ] T142 GET /gifts/received
- [ ] T143 GiftsStrip no perfil (RF-SOC-006)
- [ ] TypeScript validation + lint + tests pass

### Phase 8: Explore + Search
- [ ] T126 ExplorePage
- [ ] T127 SearchPage
- [ ] T128 POST /social/report
- [ ] T129 Moderation in feed/explore
- [ ] T130 Explore integration tests
- [ ] TypeScript validation + lint + tests pass

### Phase 9: Frontend Integration & Polish
- [ ] T131 PostDetailPage
- [ ] T132 NotificationsPage
- [ ] T133 MobileNav update
- [ ] T134 AppHeader notification bell
- [ ] T135 Loading/error/empty states
- [ ] T136 PostHog events integration
- [ ] T137 Animation optimization
- [ ] T138 E2E social-flows
- [ ] T139 E2E horoscopes-flow
- [ ] T140 Responsive polish
- [ ] T141 Full-flow Sprint 2 E2E
- [ ] T146 Bench suite (tests/bench/)
- [ ] TypeScript validation + lint + tests pass

### Phase 10: Data Integrity & Compliance
- [x] T147 Cron de reconciliação de contadores (S2-19/I4)
- [x] T148 LGPD purge de leituras >90d (S2-20)
- [x] TypeScript validation + lint + tests pass

---

## Clarifications

> Full details: [`docs/plans/20260926120000-sprint2-execution-plan.clarifications.md`](./20260926120000-sprint2-execution-plan.clarifications.md)

**Sessão 2026-09-28 (Q30–Q34, batch de divergências pós-re-review):**
- Envelope social cursor = `{ data, pagination }` (S2-18; resolve o "T052 decide" de `overview.md`/`social.md`)
- Contadores = mesmo `$transaction` + cron de reconciliação (S2-19 → T147)
- Purge LGPD de leituras 90d = task nova no Sprint 2 (S2-20 → T148)
- 429 social ganha `retryAfter` no body (S2-10/SC33) — ✅ executado
- Cron feed-cache `*/5` → `0 * * * *` (SC34; Hobby falha deploy com cron < 1 dia) — **corrigido na execução para `0 0 * * *`** (a doc da Vercel mostra que horário também falha em Hobby; dono confirmou)
- ~~**Pendente de execução** (fora do artefato do plano): ajustar `vercel.json` (cron horário) e `src/lib/middleware/rate-limit.ts` (+`retryAfter`)~~ — ✅ **executado em 2026-09-28**: `vercel.json` (`feed-cache` `0 0 * * *`, `counter-reconcile` `0 4 * * *`) + `retryAfter` no body do 429 social

| SC | Pergunta | Decisão |
|----|----------|---------|
| SC1 | WebSocket: serviço separado? | **Sim**, porta 3003, Redis adapter, deploy separado |
| SC2 | Horóscopo conteúdo: IA ou templates? | **Híbrido**: templates + IA batch (BullMQ); fallback template se falhar |
| SC3 | Kin Maya: reutilizar? | **Sim**, expandir `kin-maya.ts` com Selos/Tons/Onda |
| SC4 | Gifts: catálogo? | **Fixo SPEC-007 exato** (6 gifts; sem env de preço — corrige Q4 das clarifications) |
| SC5 | Feed: cursor ou offset? | **Cursor-based** |
| SC6 | Notificações: in-app ou push? | **In-app only** (MVP) |
| SC7 | Compatibilidade: matriz ou IA? | **Matriz fixa 12×12** em código |
| SC8 | my-horoscope: agrega 3? | **Sim**, endpoint único via libs (sem depender das rotas Fases 5/6) |
| SC9 | Rate limits? | Posts 10/50, Likes 100/min, Comments 30/min, Follow 20/min, Gifts 10/dia |
| SC10 | OG Image? | **Sharp SVG→PNG** |
| SC11 | Comentários: níveis? | **1 nível** |
| SC12 | Moderação MVP? | **Lista + report endpoint**; sem IA |
| SC13 | IA fallback? | **Template fallback** |
| SC14 | Versos earnings? | **Hook em like/comment/follow/reading**; milestones = streak do claim-daily (T122) |
| SC15 | WebSocket fallback? | **Polling endpoints dedicados** |
| SC16 | Error handling? | **error.tsx** App Router |
| SC17 | Subscription tier? | **User.subscriptionTier** + `checkPostLimit` tier-aware |
| SC18 | Feed >1000 following? | **Materialized view** + cron 5min |
| SC19 | Push notifications horóscopo? | **Cron horário** (default 07:00 BRT via `hour`) → in-app |
| SC20 | AI interpretation horóscopo? | **Pipeline SPEC-004** SSE |
| SC21 | Horóscopos/Explore públicos (visitante)? | **Não no MVP** — atrás do auth layout (UC-005 pré-condição autenticado); público Sprint 3+ |
| SC22 | Upload de imagens? | **Presign R2** (pattern avatar): máx 4, JPEG/PNG/WebP, ≤5MB, PUT direto |
| SC23 | Fonte de privacidade de follow? | **`UserProfile.privacy.whoCanFollow`** (Sprint 1); sem `User.privacySettings` |
| SC24 | Curtir comentários? | **Contagem apenas** (`CommentLike` unique), RF-SOC-005 |
| SC25 | `HoroscopeContent.date`? | **Data civil BRT** (`America/Sao_Paulo`) — Q25/S2-2 |
| SC26 | Rate limiter com Redis down? | **Fail-open + alerta** (`rate_limiter_bypass`) — Q26/S2-10 |
| SC27 | Post novo no feed aberto? | **Pill "N novos posts" + slide-in no clique** — Q27/S2-5 |
| SC28 | Like/comment em post oculto? | **404 `POST_NOT_FOUND` uniforme** (anti-timing) — Q28 |
| SC29 | Medição dos NFRs? | **Bench automatizado `tests/bench/`** (T146) — Q29 |
| SC30 | Envelope das rotas sociais cursor? | **`{ data, pagination: { nextCursor } }`** (contrato overview.md §Paginação) — [S2-18] |
| SC31 | Contadores `likeCount`/`commentCount`? | **Mesmo `$transaction` + cron de reconciliação (T147)** — [S2-19] |
| SC32 | Purge LGPD de leituras 90d? | **Nova task no Sprint 2 (T148)** estendendo o job hard-delete — [S2-20] |
| SC33 | Body do 429 social? | **+ `retryAfter` (segundos) junto de `resetAt`** — [S2-10] |
| SC34 | Cron `*/5` × Vercel Hobby? | **`0 0 * * *` (diário 00:00 UTC)** — Hobby rejeita cron < 1 dia e falha o deploy; decisão original `0 * * * *` corrigida na execução (horário também falha em Hobby; dono confirmou) — T042 |

| SC35 | Formato da API de follow? | **POST toggle unico** (201 segue / 200 deixa de seguir); sem `DELETE /social/follow` - contrato de `docs/04-api/social.md` substituido -> T043 |
| SC36 | Solicitacao pendente p/ `whoCanFollow`? | **Nao - 403 `FOLLOW_NOT_ALLOWED` com `details.reason`** (negacao definitiva; sem model `FollowRequest`) -> T043/T049 |
| SC37 | Nomes dos contadores no profile? | **`followersCount`/`followingCount`/`isFollowing` no root** (texto de T046; design `stats.*` de `users.md` nao vale) -> T046 |
| SC38 | `statsVisibility` honrado nos dados de follow? | **Sim — só nos dados de follow** (omitir contadores p/ não-dono, listas 404 p/ não-dono) — RF-PROF-005 escopo mínimo -> profile/route.ts + _follow-list.ts |
| SC39 | Contadores filtram banidos/soft-deleted? | **Sim — igual às listas** (excluir `isBanned`/`deletedAt`); contador e lista concordam por construção -> follow-lists.ts + profile/route.ts + toggle |
| SC40 | Versos farming no re-follow? | **Uma vez por par com marker durável** — nova tabela `FollowReward` (`@@unique([followerId,followingId])`) inserida no mesmo `$transaction` do follow; `earnVersos` só paga se marker não existir -> schema + migração + versos.ts |
| SC41 | Toggle idempotente (corrida/500)? | **Sim — 1 $transaction + mapear P2002/P2025 para 2xx** (P2002→201 following:true, P2025→200 following:false; earnVersos/contadores pós-commit best-effort log-only — **superado na re-review 2026-09-29**: `earnVersos` + contadores agora rodam **dentro** do tx, `earnVersos === null` aborta a tx, e os handlers de corrida **re-querem `follow.findUnique`**; falha na re-query → 500 JSON com `rate.headers`, ver Execution Log 2026-09-29) -> social/follow/[userId]/route.ts |
| SC42 | Índices keyset para listas? | **Adicionar agora via migrate dev** — `@@index([followingId,createdAt,id])` + `@@index([followerId,createdAt,id])` + drop `@@index([followerId])` redundante -> schema.prisma + migração |

---

**Sessão 2026-09-29 (Review findings fix round — Phase 1 post-review):**
- `statsVisibility` honrado nos dados de follow (omitir contadores + listas 404 p/ não-dono)
- Contadores filtram `isBanned`/`deletedAt` igual às listas (concordam por construção)
- Versos farming fechado: `FollowReward` marker table + pagamento única vez por par
- Toggle POST idempotente: 1 transação, P2002/P2025 → 2xx, sem 500 na corrida; earnVersos best-effort *(superado no mesmo dia pela re-review — ver SC41 e Execution Log 2026-09-29: earnVersos/contadores dentro do tx)*
- Índices keyset compostos adicionados via `prisma migrate dev` (follow_keyset_indexes)
- Fix round executa via `/pwf-work-tdd` (TDD Red/Green/Refactor) cobrindo todos achados do review (2 CRITICAL + 16 Important/Informational)

## Execution Log

- 2026-09-26 — Plan v1 criado (Sprint 2 requirements, specs, state atual)
- 2026-09-26 — Research: repo, patterns docs/solutions/, spec flows
- 2026-09-26 — Plan v2: estruturado 12 phases; clarifications (20 decisões)
- 2026-09-26 — Review v1: 6 CRITICAL + 12 HIGH/MEDIUM → fixes aplicados (models, feed algorithm, WebSocket phase, migration commands, Sharp/OG)
- 2026-09-26 — Review v2: 6 CRITICAL (duplicate IDs, Phase 9 dup, placeholder, cross-refs) + 8 HIGH → renumbering + consolidation
- 2026-09-26 — Review v3: 3 CRITICAL (ID com sufixo de letra duplicado ×132, checklist format, AC dup) + HIGH/MEDIUM → **renumbering completo T001–T141, AC únicos 1–22, checklist separado**
- 2026-09-26 — Review v4: 3 CRITICAL (upload sem task; write-path de notificações ausente; clarifications com IDs obsoletos) + HIGH (Visitante vs auth layout, deps de fase, gaps SPEC-007, privacy split-brain) + MEDIUM (US tags, totais, rate-limits duplicados, task hygiene) → **v5: +4 tasks (T013 CommentLike, T064 presign, T081 comment-like, T103 notif settings), −3 redundantes (old T014/T015/T025), merge rate limits (old T029+T035), deps de fase corrigidas, AC-23 upload, Visitante→autenticado, privacy→UserProfile.privacy, US crosswalk, renumbering T001–T141, clarifications re-sync (SC1–SC24)**
- 2026-09-26 — Review v5: **Go (CRITICAL=0)** — regressões v4 confirmadas corrigidas + hygiene estrutural OK; patches HIGH/MEDIUM/LOW aplicados: visibilidade `audience`/`profileVisibility` em T052/T056/T057/T058 (S2-15), `whoCanComment` em T077, `checkFollowLimit` em T043+T050, cron horário por `hour` (T102/AC-18/SC19), phase gates `lint`+`type-check` (script `validate` não existe), rooms/alvos de emit em S2-1/T070/T072/T076/T077/T120, tags US-022 no bloco moderação, matriz de compat só em código (T038→hooks compartilhados), migration chain sem `db push` (T015), T023 como assertion, T123 restrito à rota de readings, [S2-16] convenção de rotas
- 2026-09-26 — **/pwf-checklist**: 5 checklists criados (88 itens CHK: api/ux/security/data/observability)
- 2026-09-26 — **/pwf-analyze**: Decision Gate **Go (CRITICAL=0)** — 18 issues (0C/2H/10M/6L), coverage 96% mapeado (20 full, 7 partial, 1 deferred); **remediation aplicada**: [S2-5] ordenação em 4 níveis RF-SOC-002 + 10/página; [S2-17] saldo Versos (`UserProfile.versosBalance`, `$transaction`); [S2-4] catálogo autoritativo SPEC-007 + terminologia Moedas=Versos + `INSUFFICIENT_VERSOS`; self-gift 403 (T120/AC-12); AI quota `checkDailyAILimit` (T101/AC-17); T035 palavras por período; gift no perfil (T142/T143); horóscopo no perfil (T144/RF-HORO-004); availability check 06:00 (T145/AC-24/RNF-HORO-001); T028 reusa helpers CSRF Sprint 1; debounce 300ms (T060); likes anônimos (T076/AC-6); lote 10 comentários (T078); S2-10 +uploads; T037 milestones=streak; **+4 tasks → T001–T145**; clarifications Q4 corrigida; **débito doc:** `docs/06-features/gifts.md` e `docs/04-api/social.md` desatualizados → atualizar via doc-shepherd pós-Phase 7
- 2026-09-26 — **/pwf-clarify (v7, Q25–Q29)**: data civil BRT para `HoroscopeContent.date` (S2-2/T008/T145); rate limiter fail-open + `rate_limiter_bypass` (S2-10/T027/T040); pill "N novos posts" + slide-in (S2-5/T061/T062); 404 uniforme p/ post oculto em escrita (T076/T077); NFR via bench automatizado + **T146** → **T001–T146**; SC25–SC29 adicionados
- 2026-09-26 — **/pwf-analyze v7 (re-run)**: **Go (CRITICAL=0)** — coverage 100% dos 27 requisitos in-scope; 0 ambiguidades abertas; fixes: `trackRateLimiterBypass` em T024/T136 (A1), isolamento do bench (`vitest exclude` + script `bench` + gate Phase 9, A2/A6), contagem de checklists 91 (A3); A4 (docs gifts/social desatualizados) = débito aceito, A5 (pill vs slide-in literal) = desvio documentado em Q27
- 2026-09-26 — **Phase 0 executada (T001–T023 ✓)**: 2 clarify respondidos antes de codar — **(1) Kin do produto = GMT 584283** (AC-11/RF-HORO-004; 15/06/1990 → **Kin 255**, não 148; `calculateKinMaya` reescrito para delegar a `maya.ts`, contrato T023 preservado) e **(2) Onda Encantada = 9 câmaras** (posições 2,3,4,6,7,8,10,11,12 — exclui portais 1/13 e torres 5/9). Entregas: schema + migração `20260926182325` aplicada (13 models sociais/horóscopos), `western.ts`/`chinese.ts`/`maya.ts` (catálogos + algoritmos), `env.ts` (Zod), seed DB idempotente (24 fallbacks + notifs + usuários), `tests/horoscopes.test.ts` **658 testes** (T021 = 656 exatos + 2 extras T020/T023), `.env.example` +4 vars. Correções de spec documentadas nas notas de task: elemento chinês = `floor(stem/2)` (spec `((year-4)%5)` viola RF-HORO-002), typos PT (Humano Amarelo/Inspirar/Harmonização/Pulsar), keywords ocidentais = decisão de conteúdo, CNY fallback 04/02. Gates: **lint ✓ type-check ✓ 1781 testes ✓** (baseline 1124). Seed executado (idempotente na 2ª passada). **Backfill de `mayanKin`**: script pontual `prisma/backfill-mayankin.ts` (dry-run → apply → idempotente, fonte única `calculateKinMaya`; validado com 1990-06-15 → 255 em dev e revertido). `prisma generate` re-executado (client desatualizado). Nota: T017 seed cobre DB; catálogos (gifts T036, palavras T025, fallbacks completos T032) ficam nas fases próprias
- 2026-09-26 — **Phase 0 — testes de cobertura remanescente**: 63 testes novos fechando os gaps sem teste da fase — `tests/schema-sprint2.test.ts` (**42**: contrato T001–T016 — models, `@@unique`/`@@index`, campos críticos), `tests/env.test.ts` (**12**: T022 — defaults, empty→undefined, coerção/porta/enum, erros `parseEnv`, cache `getEnv`), `tests/seed.test.ts` (**9**: T017 — `civilDateBrt` fuso BRT, `buildWesternFallback`, idempotência 0/22/24, notifs upsert, `seed()`). Mudanças de suporte: `prisma/seed.ts` + guard de execução direta/exports/aliases (import em teste não dispara seed), `parseEnv` aceita `Record` (repo exige `NODE_ENV` em `ProcessEnv`). Gates frescos: **lint ✓ type-check ✓ suíte 1844 passed / 1 skipped ✓**; seed direto re-executado ✓ (guard válido, idempotente)
- 2026-09-26/27 — **Phase 0.5 executada (T024–T042 ✓)**: 5 lotes, cada um com testes (129 novos). Entregas: analytics +11 eventos typed (inclui `trackRateLimiterBypass`); `moderation.ts` (env `MODERATION_BLOCKED_WORDS`); **`social/limits.ts` única casa dos limites** (Redis ZSET+TTL; fail-open Q26: libera + `logger.warn rate_limiter_bypass` + fallback de daily via count Prisma; tier-aware FREE 10/PLUS 50; **upload 20/dia = decisão S2-10** sem spec); `csrf.ts` + `buildCsrfSetCookieHeader`/`csrfErrorResponse`; `social/mentions.ts` (fronteiras: hashtag exige `(^|[^\p{L}\p{N}_])#`, menções não casam e-mail); `horoscopes/validation.ts` (faixas RF-HORO-001 sobre `general` — decisão; fallbacks do seed fora da validação); `gifts.ts` SPEC-007 (ids kebab-case = decisão de conteúdo); `versos.ts` (`$transaction` + `versosBalance >= 0`); `social/feed-algorithm.ts` (4 tiers S2-5, cap 1 pinned/10, cursor `(createdAt,id)` = menor lido — aproximação sobre ranking, S2-15 com perfil privado, fallback explore em 0 following); `feed-cache.ts` (Redis TTL 5 min, threshold 1000, cursor → miss) + `jobs/feed-cache-refresh.ts` (`*/5 * * * *`, candidatos via `HAVING COUNT(*) > 1000`); `og-image.ts` (SVG 1200×630 com escape XML → sharp PNG, fallback `@vercel/og`); seed T032 (**1328 rows** = (12+60+260) × daily×2+weekly+monthly; `civilIsoWeek`/`civilMonth` em BRT p/ formato Q25); `queue/horoscope-queue.ts` (**deps novas `bullmq` + `@vercel/og`**; jobId determinístico idempotiza o cron; attempts 3 = retry 2×; `HOROSCOPE_WORKER_CONCURRENCY = 3`); `horoscopes/prompts.ts` (matriz 3×3 tipo×período + 12 moods, faixas RF-HORO-001, guardrails); hooks `use-horoscopes`/`use-social` (zod + cursor infinite query); 7 `error.tsx` + `route-error.tsx` compartilhado (Link p/ home); middlewares `rate-limit` (429 `RATE_LIMITED` + `Retry-After`/`X-RateLimit-*`, fail-open nunca 503) e `csrf` (403 `CSRF_INVALID` + log). Bug real pego por teste: `DAY = 24 * MINUTE` (24 minutos!) no T027. Gates: **lint ✓ type-check ✓ suíte 1975 passed / 1 skipped ✓**; seed real: 1304 criados (24 diários pré-existentes reaproveitados) e **0 criados na 2ª passada** (idempotente)
- 2026-09-27/28 — **Step 4/5 — "fix all issues" dos 9 revisores (9 relatórios em disco) concluído**: **CRIT/S/N/I corrigidos** — Sentry global (`RouteError` com `Sentry.captureException` + `console.error`, 6 `error.tsx` + `global-error.tsx` + S-N18 teste "nunca renderiza error.message no DOM"); rate limits núcleo único (`social/limits.ts`); CSRF canônico **`CSRF_TOKEN_INVALID`** (código+middleware+docs; `buildCsrfSetCookieHeader` removido, cookie non-httpOnly single-writer, interceptor `api.ts`); moderation cache de regex; `isBanned` gate; seed/dates/chinese fixes; backfill `mayanKin`; mentions fronteiras; og-image escape/aria; feed-cache-refresh cron (`*/5` em `vercel.json` + rota com `Bearer CRON_SECRET`); proxy matcher; CSP real (`next.config.ts`/`vercel.json`); hooks aceitam envelope de notificação; **novos**: `versos.ts` simplificado (1 query `update`+`select`, P2025→null, guards de runtime removidos — CHECK `UserProfile_versosBalance_nonneg` cobre invariante, 12/12 versos+gifts); **migration #8** `20260927222620_sprint2_review_fixes` (checks/notnull/backfill) e **migration #9** `20260928004004_horoscope_contents_domain_checks` (CHECKs `type`/`period` em `HoroscopeContents`, gerada `--create-only` + SQL custom, dados verificados no domínio antes do ADD; 9 migrations up-to-date, 1660 rows conformes); **CI drift gate** no job Testes (`migrate status` + `migrate diff --from-config-datasource --exit-code`, verificado localmente exit 0); paridade `WESTERN_SIGNS`×`calculateZodiacSign` (366 dias 2028 + 12 datas de início); `analytics.ts` typed (`trackHoroscopeView(type, period)` uniões, `VersosSource`/`UserPlan`/`SocialLimit` type-only imports); `instrumentation.ts` `getEnv()` fail-fast no boot (+teste REDIS_URL inválido); `limits.ts` comentário attempt-vs-row (INFO-3); **eslint**: `no-console` warn allow error/warn + override off `prisma/**`/`scripts/**`/`auth.config.ts` → `eslint .` 0 warnings; **deferred (decisão explícita)**: type-aware lint + regra `import/order` (sem dep direta `typescript-eslint`, churn repo-wide 33 arquivos — PR separado); **docs batch**: security.md (limites/CSRF/CSP/audit 9 vulns), moderation.md (cache), social.md (cursor/notificações), overview.md (429 taxonomy/CSRF_TOKEN_INVALID), migrations.md v1.3 + §11, entities.md (contadores invariant, sync `plan`×`subscriptionTier`, gap data civil `HoroscopeEntry` = gap do spec, CHECK versos), erros/observability/infrastructure/environments/erd×4 (9 na chain), patterns path `tests/setup.ts`; `.env.example` + `CRON_SECRET`. **Gates (frescos, pós-docs)**: prettier --check ✓ · eslint 0 warnings ✓ · type-check ✓ · suíte completa ✓ · `migrate status` 9 up-to-date ✓ · `migrate diff` no drift ✓.
- 2026-09-28 — **Regressão encontrada e corrigida na passada de gates frescos**: a suíte completa falhou com **58 testes em 8 arquivos** — o gate `isBanned`/`deletedAt` adicionado ao `requireAuth` (`src/app/api/v1/users/_helpers.ts`) quebrava os mocks dos consumidores (model `user` ausente → `TypeError` → 500; `findUnique` sem stub → `undefined` → 401; objeto stub sem `deletedAt` → `deletedAt !== null` = true → 401). Correção com contrato preservado (`tests/require-auth.test.ts` continua 4/4): lookup isolado em try/catch (throw → **fail-open** com `logger.error`, documentado em `docs/07-security/security.md` §Guard de sessão), `user === null` → 401, `deletedAt != null` → 401, `isBanned` → 403, `undefined` (impossível no Prisma) → segue. `tests/integration/arcana-calculate.test.ts` — teste "404 when user not found" sequenciado com `mockResolvedValueOnce` (gate vê a conta; lookup da rota não — corrida). **Gates re-executados após o fix**: prettier ✓ · eslint 0 warnings ✓ · tsc ✓ · **suíte completa 130 files / 2017 passed / 1 skipped ✓**.
- 2026-09-28 — **Plan-sync — verificação do batch contra `git diff HEAD` (staged + unstaged)**: as duas entradas acima foram conferidas item a item — **todos os claims checados batem com o código**: Sentry via `RouteError` (`Sentry.captureException` + teste S-N18 em `tests/components/route-error.test.tsx`), `CSRF_TOKEN_INVALID` (remoção de `buildCsrfSetCookieHeader`, check de `Origin` no middleware, interceptor `src/lib/api.ts`), núcleo único `checkSocialLimit`, cache por env em `moderation.ts`, gate `isBanned`/`deletedAt` (`_helpers.ts`, `tests/require-auth.test.ts` 4/4), cron `feed-cache-refresh` (`vercel.json` `*/5` + rota `Bearer CRON_SECRET`), matcher `proxy.ts`, CSP (`next.config.ts`/`vercel.json`), escape/aria `og-image.ts`, `mentions.ts`, backfill (`isDirectRun` + `maskEmail` + `--apply`), `versos.ts` 1-query/P2025 (12 testes = 5 `versos.test.ts` + 7 `gifts.test.ts`), migrations **#8 `20260927222620` + #9 `20260928004004`** (9 na chain), CI drift gate, paridade zodiac (366 dias de 2028 + 12 datas), `analytics.ts` unions, `getEnv()` no boot (+teste `REDIS_URL` inválido), `no-console` no eslint, `error.tsx` ×6 com `RouteErrorProps` + `global-error.tsx` com `globals.css`, `.env.example` `CRON_SECRET`. **Omissões dos dois entries (registradas aqui; entries anteriores não reescritos)**: (1) **purga social LGPD do hard-delete** — `src/jobs/hard-delete-accounts.ts` (+`Follow`/`Post`/`Comment`/`PostLike`/`CommentLike`/`Gift` enviado/`Notification`/`ContentReport`/`HoroscopeEntry`/`HoroscopeLog`/`HoroscopeNotification` na mesma transação; gifts recebidos ficam como ledger do doador) + `tests/hard-delete-accounts.test.ts` (+76) + `docs/04-api/authentication.md` + `docs/07-security/lgpd.md`; (2) `feed-algorithm.ts` — cursor com `include` de pinned adiados, `applyPinnedCap` → `{page, dropped}`, validação dura de `decodeFeedCursor`; (3) `feed-cache.ts` — schema zod do payload Redis (`z.coerce.date`) + `followingCount` opcional; (4) `queue/horoscope-queue.ts` — `getEnv()`/zod; (5) `use-horoscopes.ts` — `useMyHoroscope` → `GET /horoscopes/my-horoscope` (T094/SC8/CHK018) + `horoscopeContentShape` compartilhado; (6) `src/lib/csrf-methods.ts` (módulo sem deps p/ o bundle client) — o entry citava só o interceptor; (7) cross-ref: o gate `requireAuth` altera comportamento de rotas do Sprint 1 (403 `AUTH_ACCOUNT_SUSPENDED`) → entry de cross-reference em `docs/work-plans/20260921120000-sprint1-completion-work-plan.md`. **Precisões**: o docs batch cita "`erros/…`" — não existe doc `errors*` neste repositório (a taxonomia de erros vive em `docs/04-api/overview.md`, já listado); o drift gate roda `migrate diff --from-config-datasource --to-schema prisma/schema.prisma --exit-code` (forma completa em `migrations.md` §11). **Não verificáveis neste plan-sync** (gates não re-executados aqui): "9 relatórios em disco" (fora do git) e os totais de suíte — recount local: **131** arquivos `tests/**/*.test.{ts,tsx}` no disco vs "130 files" do entry da regressão. **Master Checklist: nenhum item marcado** — nada desta passada fecha tasks de Phase 1+ (o diff não contém rotas sociais/horóscopo nem UI) e T001–T042 já estavam `[x]`; **permanecem `[ ]` de propósito**: T043–T050, T051–T065 (T052 feed, T058 rota og-image), T066–T075, T076–T089, T090–T103/T144–T145, T104–T109, T110–T117, T118–T125/T142–T143 (T121/T122 versos), T126–T130 (T128/T129 moderação), T131–T146; em `docs/08-sprints/sprint-2.md` seguem `[ ]` os 9 "Critérios de Aceite" (decisão do dono de 2026-09-26) e as tasks 6/8/9/28/29/33/37/38 (parciais já justificados no entry da Phase 0.5).

---

- 2026-09-28 — **Phase 10 executada (T147–T148 ✓) + pendências do clarify executadas (SC33/SC34 ✓)**: **T147** `src/jobs/counter-reconcile.ts` (`COUNTER_RECONCILE_CRON = "0 4 * * *"`; dois `UPDATE ... WHERE divergente` com subquery `COUNT(*)` para `Post.likeCount`/`Post.commentCount`/`Comment.likeCount`; `$executeRaw` retorna rows corrigidas = idempotente) + rota `GET /api/cron/counter-reconcile` (pattern `Bearer CRON_SECRET` do `hard-delete`: 401/200 `no-store`/500) + entrada em `vercel.json` + **10 testes** (`tests/counter-reconcile.test.ts` 4: cron/summary/idempotência/SQL; `tests/cron-counter-reconcile.test.ts` 6: rota). **T148** `purgeExpiredReadings()` em `src/jobs/hard-delete-accounts.ts` — seleção `deletedAt ≤ now−90d` **com** `readings: { some: {} }` (auto-esgota: conta sem leituras sai do where), transação na ordem de FK **Interpretation → ReadingCard → Reading**, campo novo `readingsPurged` no `HardDeleteSummary`, try/catch no tick (falha de purge não derruba a anonimização); janelas 30d (anonimização) e 90d (purge) coexistem; **+3 testes** (`tests/hard-delete-accounts.test.ts` → 11: >90d purga com ordem de FK, 45d mantém, idempotência 2ª execução). **SC33** `retryAfter` (segundos) no body do 429 social ao lado de `resetAt` (`rate-limit.ts`) + asserção no teste bloqueado. **SC34** cron feed-cache `*/5` → **`0 0 * * *`** — correção sobre a decisão original: a doc oficial da Vercel mostra que `0 * * * *` (per-hour) **também falha em Hobby**; dono consultado na execução e confirmou diário; `FEED_CACHE_REFRESH_CRON` + teste atualizados. **Docs**: `infrastructure.md` (banner Hobby → RESOLVIDO + bullet do counter-reconcile), `deployment.md` (3 crons no `.env.example` da tabela, `CRON_SECRET`), `overview.md` (lista de crons + summary `readingsPurged`/`{posts,comments,total}` + 429 social com `retryAfter` e taxonomia fechada), `social.md`/`security.md` (schedules), `entities.md` (I4(b) implementado), `lgpd.md` (retenção 90d → `purgeExpiredReadings`), clarifications Q34 (execution resolution). **Gates frescos**: prettier write+check ✓ · `eslint .` 0 problems ✓ · tsc ✓ · **suíte completa 132 files / 2032 passed / 1 skipped ✓** (+13 testes sobre a baseline 2019/130).

- 2026-09-28 — **Re-review (6 agentes) + correção dos achados**: re-review via `requesting-code-review` (kieran-typescript, code-simplicity, security-sentinel, nextjs-reviewer, doc-shepherd, plan-sync) sobre o batch Step 4/5. **Aplicado**: (1) `requireAuth` passou a ser **fail-closed** — lookup em try/catch próprio, **throw → 503 `SERVICE_UNAVAILABLE`** (nunca 200 em pico de DB, nunca 401 que dispararia o refresh loop), contrato `null`/`deletedAt`→401 e `isBanned`→403 preservado, branch `undefined` (model sem stub) restrito a `!prisma.user?.findUnique` (impossível em prod: schema garante `User`); teste novo em `tests/require-auth.test.ts` (5/5) e `docs/07-security/security.md` §Guard de sessão reescrito (era fail-open). (2) `next.config.ts` gate `has` accept `text/html` → **`text/html.*`** — `has.value` vira regex ancorada `^…$` e o Accept real do browser nunca casava: HSTS/nosniff/CSP **nunca eram emitidos** em self-hosted. (3) `account-service.ts`: enriquecimento projetava o profile inteiro no `.strict()` (sub/email/given_name rejeitavam) → projeção `{name, picture}` antes do parse + teste com profile Google realista. (4) CI: **`prisma db execute --file prisma/ci/assert-integrity.sql`** fecha o blind spot do `migrate diff` (CHECKs/`NULLS NOT DISTINCT` não modelados no `schema.prisma`): `RAISE EXCEPTION` se qualquer uma das 9 CHECKs escritas à mão ou o índice `NULLS NOT DISTINCT` de `HoroscopeContents` sumir — verificado positivo (exit 0) e negativo (exit ≠ 0). (5) `limits.ts`: `bypass(…, allowed)` → `remaining` (o parâmetro era um count) e `dailyFallback` recebe `userId` explícito (remove `key.split(":")`). (6) Removidos `isAuthTokenError` (export morto) e o re-export `CSRF_PROTECTED_METHODS` de `middleware/csrf.ts`; `global-error.tsx` usa `RouteErrorProps`. **Docs**: `overview.md` §CSRF_TOKEN_INVALID (enforceCsrf ainda sem rota consumidora), `security.md` §Helmet (CSP parcial: só 4 diretrizes reais; nota do regex ancorado), `infrastructure.md` (drift gate + assertion; **banner risco Hobby × cron `*/5`** — deploy falha em plano Hobby, decisão do dono). **Falso positivo**: o suposto override morto `scripts/**` do eslint **não era morto** (`scripts/gen-og-image.cjs` é lintado — o ignore `*.cjs` só cobre a raiz) → restaurado. **Gates frescos**: prettier ✓ · `eslint .` 0 problems ✓ · tsc ✓ · suíte **2019 passed / 1 skipped (130 files)** ✓ · 9 migrations up-to-date ✓ · `migrate diff` sem drift ✓ · assertion SQL ✓.

- 2026-09-28 — **Phase 1 concluída (T043–T050 ✓, TDD)**: **T043** `POST /api/v1/social/follow/:userId` toggle (201 segue / 200 deixa de seguir, **sem DELETE** — SC35): `enforceSocialLimit({limit:"follow"})` 20/min + headers `X-RateLimit-*` → 409 `CANNOT_FOLLOW_SELF` → 404 `USER_NOT_FOUND` → 409 `MAX_FOLLOWING_REACHED` (`User.maxFollowing` default 5000) → 403 `FOLLOW_NOT_ALLOWED` com `details.reason` (SC36, sem `FollowRequest`) → `$transaction` Follow + Notification(`type:"follow"`) → `earnVersos(followerId, Follow)` +5 só na criação → `{ data: { following, followingCount, followersCount } }`. **T044/T045** followers/following com shared `users/_follow-list.ts` + `src/lib/social/follow-lists.ts` — keyset cursor `encodeFeedCursor`/`decodeFeedCursor`, `?q=` case-insensitive, banido/soft-delete filtrados, perfil privado → 404 anti-timing, default 20/máx 50, envelope `{ data, pagination: { nextCursor } }` (S2-18) + `optionalAuth` novo em `users/_helpers.ts` (`isFollowing` por item quando autenticado). **T046** profile com `followersCount`/`followingCount` no root + `isFollowing` só autenticado (SC37). **T047** `FollowButton` — optimistic update no cache `["profile", username]` (onMutate flipa, onError reverte, onSettled invalida), labels "Seguir"/"Seguindo". **T048** `useFollowList(username, side, q, enabled)` infinite query zod + `FollowersModal`/`FollowingModal` (debounce 300ms, `?q=`, "Carregar mais", empty states, role=dialog). **T049** `src/lib/social/privacy.ts` `canFollow(currentUser, targetUser)` lendo `UserProfile.privacy.whoCanFollow` (`all`|`following`|`nobody`). **T050** suíte: `social-follow` 19 + `social-privacy` 7 + `public-profile` 6 + `follow-button` 6 + `followers-modal` 7. **Gates**: prettier ✓ · `npx eslint .` 0 problems ✓ · `tsc --noEmit` ✓ · **`npx vitest run`: 2074 passed / 136 files** (baseline 2032/132 → +42 testes / +4 arquivos). **Docs sincronizados**: `04-api/social.md`, `04-api/users.md`, `06-features/social.md`, `06-features/profile.md`, `08-sprints/sprint-2.md`. **Decisões**: SC35–SC37 / Q35–Q37.

- 2026-09-29 - **Review multi-agent (9 agents) do Phase 1 + correcao de todos os achados aplicaveis ('fix all issues' concluido)**: sintese dos 9 relatorios (kieran-typescript, code-simplicity, rchitecture-strategist, learnings-researcher, 
extjs-reviewer, security-sentinel, gent-native, performance-oracle, lint) -> todos os Critical/Important aplicaveis corrigidos. **Bugs reais corrigidos**: (1) **ollowingCount/ollowersCount declarados dentro do callback do $transaction e usados fora** -> ReferenceError -> 500 em TODO toggle de follow (2 testes vermelhos; hoisted para let no escopo da rota); (2) **OR collision em ollow-lists.ts** (bug novo achado na verificacao): busca ?q= e keyset do cursor competiam pela mesma chave OR no mesmo literal - o cursor **sobrescrevia o filtro** (?q=ana&cursor=X ignorava q) -> grupos em AND: [{OR busca}, {OR keyset}] + teste combinado q+cursor (social-follow 20/20); (3) isFollowing invertido (C1, direcao viewer->item); (4) toggle reescrito (C2): $transaction unica + idempotencia P2002->201/P2025->200 + enforceCsrf + ate.headers em todo piError + gate isBanned/deletedAt no alvo + contadores dentro da tx; (5) optionalAuth ganhou gate isBanned/deletedAt (C3) + 	ests/optional-auth.test.ts 10 casos. **Fix-now de review**: HoroscopeType/HoroscopePeriod re-exportados das fontes no hook use-horoscopes (unions single-source); seed guard agora loga console.warn quando invocado via wrapper (skip em VITEST); 	rackVersosEarned **sem o 3o param alance** (dados financeiros fora de analytics + teste atualizado); comentario 'Node runtime / nunca em src/proxy.ts' nos docblocks de middleware/rate-limit.ts e middleware/csrf.ts. **Indices secundarios (review data N2)**: migration **#12 20260929142921_secondary_indexes_review** (comments_authorId_idx, post_likes_userId_idx, content_reports_reporterId_idx, horoscope_contents_type_period_date_idx) + contrato em 	ests/schema-sprint2.test.ts (+4 pares). **Docs 'document now'**: security.md (status CSRF **corrigido** - follow roda enforceCsrf; status optionalAuth **corrigido** - aplica gate; captura server-side de ate_limiter_bypass/csrf_failure e' log-only ate T136; nova secao Moderation fail-open + laggedWords; guardrail do linkify; env assertion NODE_ENV=production **avaliada e adiada = decisao do dono**), entities.md (padrao de debito condicional updateMany({versosBalance:{gte}}), decisao de cascades de Gift ate Versos virar monetario, contrato alidateHoroscopeContent), elationships.md (+3.17 ContentReport targetId polimorfico aceito), lgpd.md (+3 linhas de PII free-text), infrastructure.md (feed-cache sem invalidation - janela aceita <=5min ate T052; retencao horoscope_contents ~330 rows/dia -> cleanup Sprint 3+). **Registrado como deferred/skip com justificativa**: eslint type-aware + import/order (decisao explicita anterior, PR separado), boot assertion de producao (infra do dono), #7 OG dup (T058), #19 prompt injection (T093), #22 length caps (T057+), #6 cron tick lock (cadencia diaria), #23 4 advisories moderate (udit fix --force regride @vercel/og), #25 CSRF stateless (SameSite=Strict + __Host-). **Gates frescos**: prettier write+check ok · eslint . 0 problems · 	sc --noEmit ok · **suíte completa 137 files / 2091 passed / 1 skipped** (baseline 2074/136 -> +17 testes) · **12 migrations up-to-date**.

- 2026-09-29 - **Re-review focada (2 agents: kieran-typescript + security-sentinel) + correcao dos IMPORTANTs**: 0 CRITICAL nos dois relatorios; 12 IMPORTANTs triados. **Aplicados (codigo)**: (1) **I1** - `canFollow` rodava ANTES da transacao para ambos os branches, entao um alvo que virava `whoCanFollow: "nobody"` impedia o EX-seguidor de dar unfollow (toggle virava beco sem sauda) -> checagem de `existingLink` movida para antes do gate: **unfollow nunca passa por `whoCanFollow`** (revogacao sempre possivel) + teste; (2) **K1/SC39** - contadores do toggle nao filtravam banidos/soft-deleted (profile e listas filtravam) -> helper `readFollowCounts()` em `follow-lists.ts` agora usado pelo toggle, profile e corridas (clarification Q2/SC39 fechada); (3) **K2** - `earnVersos` retornando `null` sem UserProfile deixava o marker FollowReward commitado sem pagamento -> null agora aborta a tx (throw) ; re-follow com marker existente nao paga de novo (teste); (4) **K3/S5** - handlers P2002/P2025 **assumiam qual constraint falhou** (nao sabiam se era follow ou FollowReward) -> re-quer `follow.findUnique` (fonte de verdade) e responde conforme o estado real + try/catch interno no catch (erro na re-query vira 500 JSON com rate headers, nunca HTML) + 3 testes de corrida; (5) **I2** - `rate.headers` faltando no 401 do viewer e no 500 final; (6) **I3/S3** - `meta.requestId` retornava o **userId cru do alvo** em 3 pontos de `profile/route.ts` (copy-paste); (7) **I4/K5/SC38** - listas `followers`/`following` agora respondem **404 para nao-dono** quando `statsVisibility: "private"` (showStats false) + teste; (8) **Q1 profile** - "só o dono vê" implementado: com `statsVisibility: "private"` o dono autenticado ve os contadores, nao-dono nao ve (antes NINGUEM via) + 2 testes; (9) **K4** - `findVisibleProfile` loga `logger.warn` quando o privacy JSON falha no safeParse (404 fail-closed mudo -> observavel) + **arquivo de teste novo `tests/find-visible-profile.test.ts` (9 casos**: anti-timing, ban, soft-delete, privacy invalido, showStats); (10) **K6** - 11 testes de headline adicionados em `social-follow.test.ts` (unfollow vs nobody, re-fold sem pagamento, corridas P2002/P2025, falha na re-query, filtro ban nas contagens, alvo banido 404, 401 com headers, SC38 listas); (11) contrato `schema-sprint2` + `FollowReward` (model + `@@unique`). **Documentado como pendencia de design (nao implementado - exige decisao do dono)**: **I6** `profileVisibility: "private"` nao vale no write path do toggle (seguir perfil privado responde 201 enquanto o profile responde 404 anti-timing) e **I7** listas GET sem rate limit (sem politica/valores decididos) -> `docs/04-api/social.md` §Limitacoes conhecidas. **Docs**: `social.md` (SC38 implementado + 404 com statsVisibility + limitacoes), `users.md` (Q1 escalacao do dono implementada). **Gates frescos**: prettier write+check ok · eslint . 0 problems · tsc --noEmit ok · **suíte completa 138 files / 2115 passed / 1 skipped** (baseline 2091/137 -> +24 testes / +1 arquivo).

- 2026-09-29 - **Pre-commit: suite inteira OOM no `bun run test` do dono -> fix no script de test**: o dono reportou `bun run test` falhando antes do commit — **`FATAL ERROR: Zone Allocation failed - process out of memory`** num worker tinypool + `ERR_IPC_CHANNEL_CLOSED`, exit 1 com 27/139 arquivos e **zero falha de assercao** (344/344 testes que rodaram passaram). Causa raiz = **mesma classe ja documentada do build** (`docs/solutions/ci-cd/turbopack-postcss-oom.md`, fix do build de 2026-09-23): RAM livre ~1 GB de 7.8 GB no Node v24, OOM intermitente do allocator de zona — o script `test` era so `vitest run`, sem o heap flag que o `build` ja usa; as suites verdes da sessao so passavam porque `NODE_OPTIONS=--max-old-space-size=4096` era setado manualmente. **Fix (mesmo padrao do repo, sem cross-env)**: `package.json` `test` = `node --max-old-space-size=4096 node_modules/vitest/vitest.mjs run` e `test:coverage` idem com `--coverage` (tinypool forks herdam `execArgv` -> workers recebem o cap). **Ciclo TDD**: Red = execucao do dono com OOM (2 tentativas de repro limpas posteriores falharam em reproducir — intermitente, condizente com a classe documentada); Green = `bun run test` com o script novo -> **138 files / 2115 passed / 1 skipped, exit 0** (+ smoke `vitest.mjs --version` + prettier check). **Docs**: `turbopack-postcss-oom.md` +secao "Recurrence: test suite (2026-09-29)", `infrastructure.md` + `environments.md` (build/test heap flag). Sem mudanca de codigo de aplicacao.

- 2026-09-29 — **Plan-sync — entry "Re-review focada" (acima) verificado contra `git diff HEAD` (staged + unstaged) + gates re-executados**: **os 11 itens de código batem com o código atual** — (1) I1: `existingLink` (`follow.findUnique`) é lido ANTES do gate `canFollow` em `social/follow/[userId]/route.ts` (unfollow nunca passa por `whoCanFollow`) + teste "unfollow não é bloqueado por whoCanFollow"; (2) `readFollowCounts()` em `src/lib/social/follow-lists.ts` chamada pelo tx do toggle, pelo `profile/route.ts` e pelos handlers de corrida; (3) `earnVersos === null` → `throw` dentro do tx (rollback do marker) + teste de re-follow sem novo pagamento; (4) P2002/P2025 re-querem `follow.findUnique` com try/catch interno → 500 JSON + `rate.headers` (3 testes de corrida); (5) `rate.headers` no 401 do viewer e nos 500 (+2 testes); (7) `_follow-list.ts` → 404 `USER_NOT_FOUND` p/ não-dono com `statsVisibility: "private"`; (8) Q1: `optionalAuth` antes do bloco de stats, dono autenticado vê contadores (+2 testes em `tests/public-profile.test.ts`); (9) `logger.warn` no `safeParse` falho de `findVisibleProfile` + `tests/find-visible-profile.test.ts` (9 casos); (10) `social-follow.test.ts` = **31** testes (+11) e `schema-sprint2.test.ts` = **48** (+`FollowReward` model e `@@unique`); (11) I6/I7 confirmados **não implementados** (toggle sem checar `profileVisibility`; listas GET sem `enforceSocialLimit`) e documentados só como pendência em `docs/04-api/social.md` §Limitações conhecidas. **Gates frescos re-executados**: `prettier --check .` ✓ · `npx eslint .` 0 problems ✓ · `tsc --noEmit` ✓ · `npx vitest run` **138 files / 2115 passed / 1 skipped** ✓ — idênticos aos declarados no entry (baseline 2091/137 confirmada). **Precisões/omissões (entry acima mantido intacto; correções só nesta entrada)**: (a) item (6) I3/S3 — `profile/route.ts` tinha **3** usos de `visible.profile.userId`, mas só **2** são `meta.requestId` (404 `USER_NOT_FOUND` e 500 `INTERNAL_ERROR`); o 3º era o campo `reqId` de `logger.error({ err, reqId })`; (b) item (7) I4/SC38 — "**+ teste**" são **2 testes** ("404 para anônimo quando statsVisibility é private" e "dono autenticado vê a própria lista mesmo com statsVisibility private"); (c) **mudança de código não citada em nenhum entry**: `FollowDenyReason` ganhou `privacy_invalid` em `src/lib/social/privacy.ts` (privacy JSON inválido em `canFollow` nega com reason distinta em vez de `privacy_nobody`) + 1 teste novo em `tests/social-privacy.test.ts` (→ 8); (d) **docs deste batch também incluem** `docs/06-features/profile.md` (Q1/SC38 + §Pendente do `ProfileStats` reescrito), `docs/06-features/social.md` (status 2026-09-29 com notas da re-review) e `docs/07-security/permissions.md` (T043 como consumidor do follow limit), além dos `04-api/{social,users}.md` citados; (e) a alegação "users.md substituiu o aviso 'não implementada'" — os avisos removidos estavam em `docs/06-features/profile.md` ("seguidores/seguindo não implementados") e no status de `docs/04-api/social.md` ("rotas ainda não implementadas"); `users.md` ganhou o bloco SC38/Q1, a nota ⚠️ de `requireStatsVisibility` e a linha 404 atualizada; (f) `docs/04-api/social.md` §Status dizia "social-follow.test.ts (20 casos)" e já está "(31 casos, incl. 3 de corrida)" no estado final. **Master Checklist Phase 1 (T043–T050 + gates)**: já estava integralmente `[x]` antes desta passada — nenhum checkbox precisou ser alterado; status da fase segue ✅ Done. **Método**: `git diff HEAD` não separa este batch do batch "Review multi-agent" anterior (ambos uncommitted, índice parcial) — a verificação foi feita pelo conteúdo atual dos arquivos. **Não há work-plan de Sprint 2 em `docs/work-plans/`** (só existe o do Sprint 1).

---

## Next Steps

1. ~~`/pwf-checklist`~~ ✅ (91 itens CHK: 88 originais + CHK017/018 analyze + CHK019 clarify)
2. ~~`/pwf-analyze`~~ ✅ (Go, CRITICAL=0; remediation aplicada → v6)
3. ~~`/pwf-clarify`~~ ✅ (Q25–Q29 → v7)
4. ~~`/pwf-work-plan docs/plans/20260926120000-sprint2-execution-plan.md Phase0`~~ ✅ **Phase 0 executada (T001–T023)** — gates lint/type-check/1781 testes ✓; docs sincronizados (doc-shepherd + plan-sync); Steps 4–5 concluídos
5. ~~Phase 0.5~~ ✅ **Phase 0.5 executada (T024–T042)** — gates lint/type-check/1975 testes ✓; seed 1328 fallbacks idempotente; deps novas `bullmq` + `@vercel/og`; docs sincronizados (Step 4/5)
6. Débito pós-Phase 7: doc-shepherd atualizar `docs/06-features/gifts.md` e `docs/04-api/social.md` (catálogo/terminologia desatualizados — S2-4); divergências já banneradas: catálogo de gifts (4 vs 9 itens, moeda, body) e tipos de notificação (6 vs 8) — conjunto canônico fecha com T036/T025
7. ~~Decisão pendente do dono de docs~~ ✅ **2026-09-26 respondido**: os 9 "Critérios de Aceite do Sprint" de `docs/08-sprints/sprint-2.md` foram desmarcados (com nota datada) por decisão do dono — serão re-marcados conforme as fases entregarem
8. ~~Débito menor: `.env.example` não declara `CRON_SECRET`~~ ✅ **2026-09-28 (review)**: `CRON_SECRET` adicionada ao `.env.example` (seção Cron) + `environments.md`/`infrastructure.md`/`security.md` atualizados — a var protege `hard-delete` **e** `feed-cache-refresh`
