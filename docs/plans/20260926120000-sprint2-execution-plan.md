---
title: "Sprint 2 Execution Plan â€” Social + ConteÃºdo"
type: enhancement
status: active
date: 2026-09-26
phased: true
---

# Sprint 2 Execution Plan â€” Social + ConteÃºdo

## Overview

**Problema/MotivaÃ§Ã£o:** Sprint 1 entregou o MVP (auth, perfil, tiragem, IA, arcano pessoal, PWA). O Sprint 2 expande com features sociais (feed, follow, interaÃ§Ãµes, notificaÃ§Ãµes real-time) e conteÃºdo esotÃ©rico avanÃ§ado (horÃ³scopos Ocidental/ChinÃªs/Maia, gifts virtuais "Versos", Explore com busca).

**Estado atual (verificado):**
- Sprint 1 completo; Prisma schema tem User, UserProfile, Reading, Interpretation, ArcanaCalculation
- **FALTANDO:** Models Follow, Post, Comment, PostLike, PostHashtag, CommentLike, Gift, Notification, HoroscopeContent, HoroscopeEntry, HoroscopeLog, HoroscopeNotification, ContentReport; User additions (subscriptionTier, isBanned, bannedAt, banReason, maxFollowing)
- Socket.io service nÃ£o existe; horÃ³scopo algorithms nÃ£o implementados; Kin Maya calculation existe em `src/lib/calculations/kin-maya.ts`
- Infra existente reutilizada: `src/lib/r2.ts` + avatar presign (upload), `src/lib/analytics.ts`, `src/lib/csrf.ts`, `UserProfile.privacy.whoCanFollow` (privacy settings Sprint 1)

## Scope / Work Breakdown

| MÃ³dulo | Tasks Sprint-2.md | Overlap | Sprint 2 tasks |
|--------|-------------------|---------|----------------|
| Sistema Social | 4 | 0 | 4 |
| Feed | 5 | 0 | 5 |
| InteraÃ§Ãµes | 4 | 0 | 4 |
| HorÃ³scopo Ocidental | 4 | 0 | 4 |
| HorÃ³scopo ChinÃªs | 4 | 0 | 4 |
| HorÃ³scopo Maia | 5 | 1 | 4 |
| Gifts + Versos | 4 | 0 | 4 |
| Explore + Busca | 3 | 0 | 3 |
| DB Migrations | 3 | 0 | 3 |
| Real-time | 2 | 0 | 2 |
| **TOTAL** | **38** | **1** | **37** |

> **ConvenÃ§Ã£o de US:** os tags `[US-0xx]` referem-se Ã  tabela User Stories de `docs/08-sprints/sprint-2.md` (numeraÃ§Ã£o local do sprint), **nÃ£o** ao registro de produto em `docs/01-product/user-stories.md`. US-027 (marketplace) estÃ¡ fora do escopo (deferred Sprint 3+); as tasks de Explore/Busca (31â€“33 de sprint-2.md) nÃ£o tÃªm US prÃ³pria e sÃ£o taggeadas `[US-022]` (descoberta de conteÃºdo).
>
> **Tasks derivadas de RFs das specs** (nÃ£o constam na lista de sprint-2.md): T013 CommentLike (RF-SOC-005), T064 upload presign (RF-SOC-003/RNF-SOC-003), T081 comment-like endpoint (RF-SOC-005), T103 config de notificaÃ§Ãµes (RF-HORO-008). O bloco Explore e Busca de sprint-2.md (tasks 31â€“33, incluindo moderaÃ§Ã£o: T012, T025, T128, T129) Ã© todo taggeado `[US-022]`. **Tasks do clarify 2026-09-28**: T147 reconciliaÃ§Ã£o de contadores (S2-19/I4), T148 purge LGPD de leituras 90d (S2-20/`lgpd.md`).

### Mapeamento por Fase

| Fase | Nome | Depends On | Tasks |
|------|------|------------|-------|
| 0 | DB Migrations & Core Models | None | T001â€“T023 |
| 0.5 | Shared Infrastructure | Phase 0 | T024â€“T042 |
| 1 | Follow System & Profile | Phase 0.5 | T043â€“T050 |
| 2 | Feed Backend & Post System | Phase 0.5 | T051â€“T065 |
| 2.5 | WebSocket Foundation | Phase 2 | T066â€“T075 |
| 3 | Interactions (Likes, Comments, Notifications) | Phase 2.5 | T076â€“T089 |
| 4 | HorÃ³scopo Ocidental | Phase 0.5 | T090â€“T103, T144â€“T145 |
| 5 | HorÃ³scopo ChinÃªs | Phases 0.5, 4 | T104â€“T109 |
| 6 | HorÃ³scopo Maia / Kin Maya | Phases 0.5, 4 | T110â€“T117 |
| 7 | Gifts + Versos Economy | Phases 0.5, 1, 3 | T118â€“T125, T142â€“T143 |
| 8 | Explore + Search | Phase 2 | T126â€“T130 |
| 9 | Frontend Integration & Polish | Phases 1â€“8 | T131â€“T141, T146 |
| 10 | Data Integrity & Compliance | Phases 0, 3 | T147â€“T148 |

**Total: 148 tasks Ãºnicas (T001â€“T148), ZERO duplicatas, ZERO letter suffixes.**

---

## Proposed Solution

### Arquitetura

```
src/
â”œâ”€â”€ app/api/v1/
â”‚   â”œâ”€â”€ social/           # Follow, Post, Like, Comment, Gift, Notification, Report, Uploads endpoints
â”‚   â”œâ”€â”€ horoscopes/       # Western, Chinese, Maya, history, notifications settings endpoints
â”‚   â””â”€â”€ explore/          # Trending, hashtags, suggestions, search endpoints
â”œâ”€â”€ app/(app)/
â”‚   â”œâ”€â”€ feed/             # FeedPage
â”‚   â”œâ”€â”€ explorar/         # ExplorePage
â”‚   â”œâ”€â”€ horoscopos/       # Western/Chinese/Mayan + historico + interpret
â”‚   â”œâ”€â”€ post/[id]/        # PostDetailPage
â”‚   â”œâ”€â”€ notificacoes/     # NotificationsPage
â”‚   â”œâ”€â”€ presentes/        # GiftsPage
â”‚   â””â”€â”€ busca/            # SearchPage
â”œâ”€â”€ components/social/    # PostCard, PostComposer, CommentSection, GiftSelector, FollowButton, NotificationsDropdown
â”œâ”€â”€ components/horoscopes/ # Western/Chinese/Mayan HoroscopeCard, NotificationSettings
â”œâ”€â”€ lib/
â”‚   â”œâ”€â”€ horoscopes/       # western.ts, chinese.ts, maya.ts, prompts.ts, validation.ts, western-compatibility.ts
â”‚   â”œâ”€â”€ social/           # feed-algorithm.ts, mentions.ts, gifts.ts, versos.ts, privacy.ts, limits.ts
â”‚   â”œâ”€â”€ queue/            # BullMQ horoscope-queue.ts
â”‚   â”œâ”€â”€ og-image.ts       # Sharp + @vercel/og
â”‚   â”œâ”€â”€ analytics.ts      # PostHog typed events
â”‚   â”œâ”€â”€ moderation.ts     # checkContent
â”‚   â”œâ”€â”€ csrf.ts           # CSRF double-submit
â”‚   â”œâ”€â”€ feed-cache.ts     # Materialized view
â”‚   â”œâ”€â”€ middleware/rate-limit.ts, csrf.ts
â”‚   â””â”€â”€ env.ts            # Zod env validation
â”œâ”€â”€ socket-service/       # Socket.io server (porta 3003, Dockerfile, PM2)
â”œâ”€â”€ stores/social-store.ts # Zustand: unreadCount, notifications, optimistic helpers
â”œâ”€â”€ hooks/                # use-feed, use-horoscopes, use-socket, use-social
â”œâ”€â”€ jobs/                 # horoscope-generation, horoscope-worker, feed-cache-refresh, horoscope-notifications
â””â”€â”€ tests/
    â”œâ”€â”€ integration/social/, integration/horoscopes/, integration/websocket/
    â””â”€â”€ e2e/
```

### DecisÃµes de Projeto

- **[S2-1] Social:** Socket.io serviÃ§o separado porta 3003 com Redis adapter; auth JWT no handshake; rooms `user:{id}`, `feed:{id}`, `post:{id}`, `comment:{id}`; fallback polling 30s; alvo dos emits: `post:new` â†’ rooms `user:`/`feed:` dos seguidores, `like-updated`/`comment-added`/`comment-like-updated` â†’ room `post:{id}`, `follow-update`/`notification` â†’ room `user:{id}` do destinatÃ¡rio, `gift-received` â†’ room `user:{toUserId}`; cliente entra em `post:{id}`/`comment:{id}` ao abrir detalhe
- **[S2-2] HorÃ³scopos:** Algoritmos puros em `src/lib/horoscopes/`; conteÃºdo via BullMQ batch (04:00 BRT) + fallback templates no seed; cache TTL 30 dias; **`HoroscopeContent.date` = data civil `America/Sao_Paulo` do gatilho (Q25)** â€” cron converte agendamento BRTâ†’UTC mas grava a data civil BRT; endpoints e availability check calculam "hoje" em BRT
- **[S2-3] Kin Maya:** Reutilizar `kin-maya.ts` (Sprint 1 T020) + expandir Selos/Tons/Onda Encantada
- **[S2-4] Gifts:** 6 gifts SPEC-007 exatos (Estrela Cadente 10, Rosa MÃ­stica 25, Cristal 50, Bola de Cristal 100, Coroa Astral 200, DragÃ£o Dourado 500) â€” catÃ¡logo **fixo em cÃ³digo** (T036), sem env de preÃ§o; **autoritativo = SPEC-007/T036**: `docs/06-features/gifts.md` (9 gifts) e `docs/04-api/social.md` (`INSUFFICIENT_COINS`) estÃ£o desatualizados â†’ atualizaÃ§Ã£o pÃ³s-Phase 7 via doc-shepherd; **terminologia:** "Moedas" (SPEC-007) = "Versos", error code `INSUFFICIENT_VERSOS`; Versos: login diÃ¡rio 10+streak, interaÃ§Ãµes (like=1, comment=2, follow=5, reading=10)
- **[S2-5] Feed:** ordenaÃ§Ã£o em 4 nÃ­veis (RF-SOC-002): (1) `Post.isPinned` â€” mÃ¡x 1 a cada 10 posts (campo criado em T002; **sem write-path no MVP** â€” tier inerte atÃ© admin pin Sprint 3+); (2) posts com engajamento nas Ãºltimas 2h (`engagementScore = likes + commentsÃ—2`, janela `createdAt >= now()-2h`) por score desc; (3) demais posts de seguidos por `createdAt` desc; (4) desempate a favor de posts com interaÃ§Ã£o prÃ©via do viewer (`PostLike`/`Comment`); **10 posts/pÃ¡gina**; cursor-based `(createdAt, id)`; fallback explore se 0 following; cache para >1000 following (refresh 5min); **real-time (Q27): `post:new` com feed aberto â†’ pill "N novos posts" no topo (acumula, dedup por id), slide-in sÃ³ no clique â€” sem auto-inserÃ§Ã£o durante leitura**
- **[S2-7] Prisma:** generate â†’ drift-check â†’ run locally IMMEDIATELY
- **[S2-10] Rate Limits:** Posts 10/dia free, 50/dia Plus; Likes 100/min; Comments 30/min; Follow 20/min; Gifts 10/dia; Uploads 4/post (T027 `checkUploadLimit`, T064); Horoscopes ilimitado (cached); **modo de falha (Q26): fail-open** â€” Redis indisponÃ­vel â†’ request prossegue com log warn + evento PostHog `rate_limiter_bypass`; contido por daily limits via fallback Prisma count; **body do 429 (Q33/SC33): social passa a emitir `retryAfter` (segundos) junto de `resetAt`** (client lÃª `retryAfter` como em auth; header `Retry-After` obrigatÃ³rio)
- **[S2-11] CSRF:** Double-submit; cookie `csrf-token` vs header `x-csrf-token`; client-side `ensureCsrfCookie()`
- **[S2-12] Upload de imagens:** Presign R2 reutilizando `src/lib/r2.ts` (pattern do avatar presign); mÃ¡x 4 imagens, JPEG/PNG/WebP, â‰¤5MB; PUT direto ao R2; keys `posts/{userId}/â€¦`; presign Ã© a validaÃ§Ã£o autoritativa de tipo/tamanho (T051 valida formato/quantidade do payload, sem re-baixar bytes)
- **[S2-13] Acesso pÃºblico:** MVP autenticado â€” pÃ¡ginas sociais e de horÃ³scopos em `src/app/(app)` (layout exige sessÃ£o; UC-005 prÃ©-condiÃ§Ã£o "usuÃ¡rio autenticado"); acesso de visitante fica Sprint 3+
- **[S2-14] Privacidade de follow:** fonte Ãºnica `UserProfile.privacy.whoCanFollow` (Sprint 1, `src/app/api/v1/users/me/privacy/route.ts`); sem novo campo `User.privacySettings`
- **[S2-15] Visibilidade de conteÃºdo:** leitura honra `Post.audience` (public/followers) **e** `UserProfile.privacy.profileVisibility` (privado â†’ sÃ³ seguidores) em feed/search/detalhe/og-image; comentÃ¡rios honram `Post.commentsDisabled` **e** `UserProfile.privacy.whoCanComment` (RF-SOC-001/003/005)
- **[S2-16] ConvenÃ§Ã£o de rotas:** prefixo `/api/v1/social/*` agrupa follow/posts/likes/gifts/notifications â€” desvio consciente do layout de rotas sugerido em `.specs/007-social/design.md` (`/api/v1/posts`, `/api/v1/users/:id/follow`); mesma superfÃ­cie funcional, decisÃ£o de organizaÃ§Ã£o
- **[S2-17] Saldo Versos:** fonte Ãºnica `UserProfile.versosBalance Int @default(0)` + `versosStreak Int @default(0)` + `lastClaimAt DateTime?` (campos em T014); atualizado **exclusivamente em `$transaction`** por `earnVersos`/debit de gift/claim-daily/half-share; invariant `versosBalance >= 0` checado na transaÃ§Ã£o (sem ledger derivado); `GET /versos/balance` lÃª o campo
- **[S2-18] Envelope de paginaÃ§Ã£o (Q30/SC30):** TODAS as rotas cursor sociais respondem no contrato de `docs/04-api/overview.md` Â§PaginaÃ§Ã£o â€” **`{ data, pagination: { nextCursor } }`** (followers/following T044/T045, feed T052, comments T078, notifications T082, history T095, gifts-received T142); os shapes flat escritos nas tasks sÃ£o o shape da lib interna â€” a rota envolve; hooks com union (`useNotifications`/`useFeed`) estreitados para o envelope na primeira rota (T044)
- **[S2-19] Contadores (Q31/SC31):** `Post.likeCount`/`Post.commentCount` e `Comment.likeCount` sÃ£o incrementados/decrementados **no mesmo `$transaction`** do insert/delete (T051/T076/T077/T081) **e** reconciliados por cron periÃ³dico (T147) â€” `ON DELETE CASCADE` nÃ£o roda cÃ³digo de app e deixa drift permanente sem reconciliaÃ§Ã£o (invariante I4 de `docs/03-database/entities.md`)
- **[S2-20] LGPD leituras (Q32/SC32):** `Reading`/`ReadingCard`/`Interpretation` sÃ£o purgados **90 dias apÃ³s o soft-delete** da conta (retenÃ§Ã£o de `docs/07-security/lgpd.md`), estendendo o job `hard-delete` â€” T148

---

## Technical Considerations

### NFRs
- **Performance:** P95 < 500ms; feed < 300ms para >1000 following (materialized view); WebSocket < 100ms; RNF-HORO-002: pÃ¡gina de horÃ³scopo < 800ms, cÃ¡lculo Kin < 1ms; RNF-SOC-003: upload de atÃ© 4 imagens < 8s P95 (4G)
- **MÃ©todo de mediÃ§Ã£o (Q29):** **bench automatizado** em `tests/bench/` â€” p95 de endpoints sociais e feed (1000 following sintÃ©ticos), Playwright tracing para pÃ¡gina de horÃ³scopo, cronÃ´metro unitÃ¡rio para Kin; roda no gate de fase (`npm run test`); RUM pÃ³s-deploy fora do MVP (T146)
- **Security:** CSRF double-submit, Pino redact, `equalizeNoopTiming()` 240-400ms, WebSocket auth handshake; rate limiter fail-open + alerta (Q26/S2-10)
- **Observability:** PostHog events (post_create, like, comment, follow, gift_send, horoscope_view, gift_claim_daily, versos_earned, post_limit_hit, csrf_failure, rate_limiter_bypass, horoscope_missing)

### Migration Safety
1. `Follow` + `Post` + `Comment` + `PostLike` + `PostHashtag` + `CommentLike` + `Notification` + `ContentReport`
2. `Gift` + `HoroscopeContent` + `HoroscopeEntry` + `HoroscopeLog` + `HoroscopeNotification`
3. User additions (subscriptionTier, isBanned, bannedAt, banReason, maxFollowing)
4. Ãndices: `Post(authorId,createdAt)`, `Post(createdAt)`, `Follow(followerId,followingId)`, `Notification(userId,isRead,createdAt)`, `PostHashtag(tag)`, `HoroscopeEntry(userId,createdAt)`, unique `CommentLike(commentId,userId)`, unique `HoroscopeNotification(userId)`

### Patterns Existentes
- API Routes: App Router, Zod, `requireAuth`, `apiError`/`apiSuccess`
- Algorithms: funÃ§Ãµes puras com getters UTC (`tz-determinism-utc-tests.md`)
- Derived fields: invalidaÃ§Ã£o condicional (`derived-field-invalidation.md`)
- Auth: single-flight refresh, CSRF client-side, rate-limit before lookup
- Uploads: presign R2 reutilizando pattern do avatar (`src/lib/r2.ts` + `users/me/avatar/presign`)

---

## Acceptance Criteria

#### AC-1: Follow System [US-020]
**Given** usuÃ¡rio autenticado visualizando perfil de outro  
**When** clica em "Seguir"  
**Then** segue; contador atualiza; notificaÃ§Ã£o ao seguido  
**Roles:** USER, PROFESSIONAL | **Priority:** Must-have

#### AC-2: Unfollow [US-020]
**Given** usuÃ¡rio seguindo outro  
**When** clica em "Deixar de seguir"  
**Then** deixa de seguir; contador decrementa  
**Roles:** USER, PROFESSIONAL | **Priority:** Must-have

#### AC-3: Feed Personalizado [US-022]
**Given** usuÃ¡rio logado seguindo â‰¥1 pessoa  
**When** acessa `/feed`  
**Then** vÃª posts de quem segue ordenados por S2-5 (pinned â†’ engajamento 2h â†’ cronolÃ³gico â†’ interaÃ§Ã£o prÃ©via), 10/pÃ¡gina; infinite scroll funciona; posts novos via WS chegam como pill "N novos posts" (Q27)  
**Roles:** USER, PROFESSIONAL | **Priority:** Must-have

#### AC-4: Feed Fallback (Explore) [US-022]
**Given** usuÃ¡rio logado sem seguir ninguÃ©m  
**When** acessa `/feed`  
**Then** vÃª posts pÃºblicos com maior engajamento  
**Roles:** USER, PROFESSIONAL | **Priority:** Must-have

#### AC-5: CriaÃ§Ã£o de Post [US-021]
**Given** usuÃ¡rio logado  
**When** cria post (texto â‰¤500 chars, atÃ© 4 imagens validadas, ou tiragem) com audience public/followers  
**Then** post criado; atualizaÃ§Ã£o real-time no feed via WebSocket  
**Roles:** USER, PROFESSIONAL | **Priority:** Must-have

#### AC-6: Like Toggle [US-023]
**Given** usuÃ¡rio visualizando post de outro  
**When** clica em curtir/descurtir  
**Then** contador atualiza; notificaÃ§Ã£o ao autor; auto-like bloqueado; **sem lista de quem curtiu (curtidas anÃ´nimas)**  
**Roles:** USER, PROFESSIONAL | **Priority:** Must-have

#### AC-7: ComentÃ¡rios [US-023]
**Given** usuÃ¡rio visualizando post  
**When** adiciona comentÃ¡rio (â‰¤300 chars, ou resposta 1 nÃ­vel)  
**Then** comentÃ¡rio aparece; notificaÃ§Ã£o ao autor do post e do comentÃ¡rio pai; like de comentÃ¡rio com contagem (sem lista)  
**Roles:** USER, PROFESSIONAL | **Priority:** Must-have

#### AC-8: NotificaÃ§Ãµes In-App [US-023]
**Given** usuÃ¡rio recebe like/comment/follow/gift  
**When** abre dropdown  
**Then** lista com unread badge; mark-as-read; real-time via WebSocket  
**Roles:** USER, PROFESSIONAL | **Priority:** Must-have

#### AC-9: HorÃ³scopo Ocidental [US-024]
**Given** usuÃ¡rio autenticado com birthDate  
**When** acessa `/horoscopos/ocidental`  
**Then** signo correto (cuspides); horÃ³scopo diÃ¡rio; compatibilidade; resultado tambÃ©m na seÃ§Ã£o de horÃ³scopos do perfil (RF-HORO-004, T144)  
**Roles:** USER, PROFESSIONAL | **Priority:** Must-have

#### AC-10: HorÃ³scopo ChinÃªs [US-024]
**Given** usuÃ¡rio autenticado com birthDate  
**When** acessa `/horoscopos/chines`  
**Then** animal + elemento corretos (Ano Novo ChinÃªs); caracterÃ­sticas  
**Roles:** USER, PROFESSIONAL | **Priority:** Must-have

#### AC-11: Kin Maya [US-025]
**Given** usuÃ¡rio autenticado com birthDate  
**When** acessa `/horoscopos/maia`  
**Then** Kin via Tzolkin (GMT 584283); Selo + Tom; Onda Encantada 9 posiÃ§Ãµes  
**Roles:** USER, PROFESSIONAL | **Priority:** Must-have

#### AC-12: Gifts + Versos [US-026]
**Given** usuÃ¡rio com saldo de Versos  
**When** envia gift  
**Then** saldo decrementa em `$transaction` (S2-17); self-gift â†’ 403 `SELF_GIFT`; notificaÃ§Ã£o ao destinatÃ¡rio; presente exibido no perfil do destinatÃ¡rio com animaÃ§Ã£o (RF-SOC-006, T142/T143)  
**Roles:** USER, PROFESSIONAL | **Priority:** Must-have

#### AC-13: Explore + Busca [US-022]
**Given** usuÃ¡rio logado  
**When** acessa `/explorar` e busca  
**Then** tabs: posts, usuÃ¡rios, hashtags; trending hashtags  
**Roles:** USER, PROFESSIONAL | **Priority:** Must-have

#### AC-14: WebSocket Real-time [US-020â€“US-023]
**Given** usuÃ¡rio logado com WebSocket conectado  
**When** evento ocorre (post, like, comment, follow, gift)  
**Then** UI atualiza sem refresh; reconnection automÃ¡tica; fallback polling  
**Roles:** USER, PROFESSIONAL | **Priority:** Must-have

#### AC-15: Testes [US-020â€“US-026]
**Given** cÃ³digo completo  
**When** `npm run test` e `npx playwright test`  
**Then** todos passam; coverage: unit â‰¥80%, integration â‰¥70%, E2E â‰¥10 critical paths  
**Priority:** Must-have

#### AC-16: HorÃ³scopo History [US-024, RF-HORO-007]
**Given** usuÃ¡rio logado  
**When** acessa `/horoscopos/historico`  
**Then** lista paginada com filtros (tipo, perÃ­odo, data)  
**Roles:** USER, PROFESSIONAL | **Priority:** Must-have

#### AC-17: HorÃ³scopo AI Interpretation [US-024, RF-HORO-006]
**Given** usuÃ¡rio visualizando horÃ³scopo  
**When** solicita interpretaÃ§Ã£o IA  
**Then** streaming em tempo real (pipeline SPEC-004); **consome 1 unidade da cota diÃ¡ria de IA** (`checkDailyAILimit` de `src/lib/ai/rate-limit.ts`; 429 `AI_DAILY_LIMIT_REACHED` ao exceder)  
**Roles:** USER, PROFESSIONAL | **Priority:** Must-have

#### AC-18: HorÃ³scopo Push Notifications [US-024, RF-HORO-008]
**Given** usuÃ¡rio com notificaÃ§Ãµes habilitadas  
**When** na `hour` configurada (default 07:00 BRT)  
**Then** notificaÃ§Ã£o in-app por sistema habilitado; hora e toggles configurÃ¡veis pelo usuÃ¡rio  
**Roles:** USER, PROFESSIONAL | **Priority:** Must-have

#### AC-19: Rate Limits [SC9 Â· S2-10]
**Given** usuÃ¡rio free/plus  
**When** excede limite  
**Then** 429 com `Retry-After`; mensagem amigÃ¡vel  
**Roles:** USER, PROFESSIONAL | **Priority:** Must-have

#### AC-20: CSRF Protection [RNF-SEC-001]
**Given** usuÃ¡rio submetendo POST  
**When** token CSRF ausente/invÃ¡lido  
**Then** 403 `CSRF_TOKEN_INVALID`  
**Roles:** USER, PROFESSIONAL | **Priority:** Must-have

#### AC-21: Feed Performance [RNF-SOC-002]
**Given** usuÃ¡rio seguindo >1000  
**When** acessa `/feed`  
**Then** resposta <300ms (materialized view)  
**Roles:** USER, PROFESSIONAL | **Priority:** Must-have

#### AC-22: Privacy Settings [US-020, SPEC-002]
**Given** usuÃ¡rio com `UserProfile.privacy.whoCanFollow` configurado (Sprint 1)  
**When** outro tenta seguir  
**Then** follow bloqueado conforme `whoCanFollow`  
**Roles:** USER, PROFESSIONAL | **Priority:** Must-have

#### AC-23: Upload de Imagens [RF-SOC-003, RNF-SOC-003]
**Given** usuÃ¡rio logado criando post com imagens  
**When** seleciona atÃ© 4 imagens (JPEG/PNG/WebP, â‰¤5MB cada)  
**Then** presign R2 emitido; PUT direto ao R2; `imageUrls` salvas; tipo/tamanho invÃ¡lidos â†’ 422  
**Roles:** USER, PROFESSIONAL | **Priority:** Must-have

#### AC-24: Disponibilidade de HorÃ³scopo [RNF-HORO-001]
**Given** cron de geraÃ§Ã£o executando Ã s 04:00 BRT (T097)  
**When** sÃ£o 06:00 BRT (T145)  
**Then** `HoroscopeContent` do dia existe para todos os signos; ausÃªncia â†’ `logger.warn` + evento PostHog  
**Roles:** SYSTEM | **Priority:** Should-have

---

## Implementation Plan

| Phase | Name | Depends On | Status |
|-------|------|------------|--------|
| 0 | DB Migrations & Core Models | None | âœ… Done |
| 0.5 | Shared Infrastructure | Phase 0 | âœ… Done |
| 1 | Follow System & Profile | Phase 0.5 | âœ… Done |
| 2 | Feed Backend & Post System | Phase 0.5 | âœ… Done |
| 2.5 | WebSocket Foundation | Phase 2 | âœ… Done |
| 3 | Interactions (Likes, Comments, Notifications) | Phase 2.5 | âœ… Done |
| 4 | HorÃ³scopo Ocidental | Phase 0.5 | â¬œ Pending |
| 5 | HorÃ³scopo ChinÃªs | Phases 0.5, 4 | â¬œ Pending |
| 6 | HorÃ³scopo Maia / Kin Maya | Phases 0.5, 4 | â¬œ Pending |
| 7 | Gifts + Versos Economy | Phases 0.5, 1, 3 | â¬œ Pending |
| 8 | Explore + Search | Phase 2 | â¬œ Pending |
| 9 | Frontend Integration & Polish | Phases 1â€“8 | â¬œ Pending |
| 10 | Data Integrity & Compliance | Phases 0, 3 | âœ… Done |

---

### Phase 0: DB Migrations & Core Models (T001â€“T023)

**Status**: âœ… Done
**Objective**: Criar models Prisma completos; rodar migrations; seed data
**Dependencies**: None

**Tasks**:

- [x] T001 [P1] [US-020] Add `Follow` model em `prisma/schema.prisma` â€” `id`, `followerId`, `followingId`, `createdAt`; `@@unique([followerId, followingId])`, `@@index([followerId])`, `@@index([followingId])`
  - **2026-09-26**: contrato T001â€“T016 coberto por `tests/schema-sprint2.test.ts` (42 asserts: existÃªncia dos 13 models, `@@unique`/`@@index` crÃ­ticos, campos `imageUrls`/`audience`/`coinCost`/`versosBalance` etc. â€” falha se schema/regressÃ£o remover)
- [x] T002 [P1] [US-021] Add `Post` model em `prisma/schema.prisma` â€” `id`, `authorId`, `type`, `content`, `imageUrls String[]`, `readingId String?`, `audience`, `isPinned Boolean @default(false)` (lido pelo tier 1 do feed S2-5; sem write-path no MVP), `likeCount Int @default(0)`, `commentCount Int @default(0)`, `commentsDisabled Boolean @default(false)`, `isHidden Boolean @default(false)`, `createdAt`, `updatedAt`; `@@index([authorId, createdAt])`, `@@index([createdAt])`
- [x] T003 [P1] [US-023] Add `Comment` model em `prisma/schema.prisma` â€” `id`, `postId`, `authorId`, `content`, `parentCommentId String?`, `likeCount Int @default(0)`, `createdAt`; `@@index([postId, createdAt])`
- [x] T004 [P1] [US-023] Add `PostLike` model em `prisma/schema.prisma` â€” `id`, `postId`, `userId`, `createdAt`; `@@unique([postId, userId])`
- [x] T005 [P1] [US-022] Add `PostHashtag` model em `prisma/schema.prisma` â€” `id`, `postId`, `tag`; `@@index([tag])`
- [x] T006 [P1] [US-026] Add `Gift` model em `prisma/schema.prisma` â€” `id`, `fromUserId`, `toUserId`, `giftId`, `coinCost Int`, `recipientEarnsHalf Boolean @default(false)`, `createdAt`
- [x] T007 [P1] [US-023] Add `Notification` model em `prisma/schema.prisma` â€” `id`, `userId`, `type`, `message`, `data Json?`, `isRead Boolean @default(false)`, `createdAt`; `@@index([userId, isRead, createdAt])`
- [x] T008 [P1] [US-024] Add `HoroscopeContent` model em `prisma/schema.prisma` â€” `id`, `type`, `signId`, `element String?`, `period`, `date`, `content Json`, `createdAt`; `@@unique([type, signId, element, period, date])`; **`date` = data civil `America/Sao_Paulo` (Q25/S2-2)**
- [x] T009 [P1] [US-024] Add `HoroscopeEntry` model em `prisma/schema.prisma` â€” `id`, `userId`, `type`, `signId`, `element String?`, `period`, `createdAt`; `@@index([userId, createdAt])` (RF-HORO-007)
- [x] T010 [P1] [US-024] Add `HoroscopeLog` model em `prisma/schema.prisma` â€” `id`, `userId`, `type`, `signId`, `element String?`, `period`, `createdAt`; `@@index([userId, createdAt])`
- [x] T011 [P1] [US-024] Add `HoroscopeNotification` model em `prisma/schema.prisma` â€” `id`, `userId @unique`, `westernEnabled Boolean @default(true)`, `chineseEnabled Boolean @default(false)`, `mayaEnabled Boolean @default(false)`, `hour Int @default(7)`
- [x] T012 [P1] [US-022] Add `ContentReport` model em `prisma/schema.prisma` â€” `id`, `reporterId`, `targetType`, `targetId`, `reason`, `status String @default("PENDING")`, `resolvedAt DateTime?`, `resolvedBy String?`, `createdAt`; `@@index([targetType, targetId])`
- [x] T013 [P1] [US-023] Add `CommentLike` model em `prisma/schema.prisma` â€” `id`, `commentId`, `userId`, `createdAt`; `@@unique([commentId, userId])`, `@@index([commentId])` (RF-SOC-005: like de comentÃ¡rio com contagem)
- [x] T014 [P1] [US-020] Add User fields em `prisma/schema.prisma` â€” `subscriptionTier UserPlan @default(FREE)`, `isBanned Boolean @default(false)`, `bannedAt DateTime?`, `banReason String?`, `maxFollowing Int @default(5000)` (privacidade vive em `UserProfile.privacy` â€” S2-14); **`UserProfile` (S2-17): `versosBalance Int @default(0)`, `versosStreak Int @default(0)`, `lastClaimAt DateTime?`**
- [x] T015 [P1] [US-020] Create migration em `prisma/migrations/` â€” `npx prisma migrate dev --name sprint2_social_horoscopes` (gera SQL) â†’ revisar diff â†’ `npx prisma migrate status` (atomic chain do repositÃ³rio; sem `db push`)
- [x] T016 [P1] [US-020] Add performance indexes em `prisma/schema.prisma` â€” `Post(authorId,createdAt)`, `Post(createdAt)`, `Follow(followerId,followingId)`, `Notification(userId,isRead,createdAt)`, `PostHashtag(tag)`, `HoroscopeEntry(userId,createdAt)`, `HoroscopeContent unique(type,signId,element,period,date)`, `HoroscopeNotification unique(userId)`, `CommentLike unique(commentId,userId)`
- [x] T017 [P1] [US-024] Seed data em `prisma/seed.ts` â€” 12 signos ocidentais (datas, elementos, regentes, emojis, keywords); 12 animais chineses + tabela CNY 1980-2035 + 60 ciclos; 20 Selos + 13 Tons + Onda Encantada; 6 gifts SPEC-007 exatos; palavras bloqueadas moderaÃ§Ã£o; fallbacks horÃ³scopo; defaults HoroscopeNotification
  - **2026-09-26**: seed cobre **DB** (usuÃ¡rios admin/test, `HoroscopeNotification` defaults, `HoroscopeContent` fallback western daily hoje+amanhÃ£ via `Intl` `America/Sao_Paulo`, idempotente query-then-createMany); **catÃ¡logos vivem em cÃ³digo** â€” signos/animais/selos em T018â€“T020, 6 gifts SPEC-007 em T036, palavras de moderaÃ§Ã£o em T025 (env `MODERATION_BLOCKED_WORDS`); fallbacks completos (60 combos chineses + 260 kins + weekly/monthly) = **T032 (Phase 0.5)**
  - **2026-09-26 (testes)**: `tests/seed.test.ts` (9) â€” `civilDateBrt` fuso BRT (23h BRT â‰  dia UTC), `buildWesternFallback` 12 signos, idempotÃªncia dos fallbacks (0/22/24 casos), upsert de notificaÃ§Ãµes, orquestraÃ§Ã£o do `seed()`; para testabilidade seed ganhou **guard de execuÃ§Ã£o direta** (`import.meta.url` vs `argv[1]` â€” importar o mÃ³dulo nÃ£o dispara), exports das funÃ§Ãµes auxiliares e imports via alias `@/`
- [x] T018 [P1] [US-024] Create Western algorithm em `src/lib/horoscopes/western.ts` â€” `getWesternSign(day, month): WesternSign` com cuspides CapricÃ³rnio; export interface com emoji, element, ruler, keywords
- [x] T019 [P1] [US-024] Create Chinese algorithm em `src/lib/horoscopes/chinese.ts` â€” `getChineseZodiac(year, month, day): ChineseZodiac` com tabela CNY 1980-2035, animal + elemento, 60 ciclos
  - **2026-09-26**: elemento do ano = `floor(((year-4)%10)/2)` â†’ [madeira,fogo,terra,metal,agua] (fÃ³rmula `((year-4)%5)` do spec nÃ£o bate com RF-HORO-002 1990=Cavalo de Metal, que Ã© o acceptance criterion); CNY table 1980â€“2035 com fallback 04/02 fora da janela
- [x] T020 [P1] [US-025] Create Maya algorithm em `src/lib/horoscopes/maya.ts` â€” `gregorianToMayanLongCount` (GMT 584283), 20 Selos, 13 Tons, `getMayanOndaEncantada(kinNumber)`; reutiliza `calculateKinMaya`
  - **2026-09-26**: inversÃ£o de dependÃªncia â€” `maya.ts` Ã© a fonte (`gregorianToJdn`, `gregorianToMayanLongCount` GMT 584283) e `kin-maya.ts` delega (mantÃ©m export/contrato T023); Onda Encantada = **9 cÃ¢maras** (posiÃ§Ãµes 2,3,4,6,7,8,10,11,12 â€” decisÃ£o Q do usuÃ¡rio); seleÃ§Ã£o das tabelas/exemplos fora do teste: +1 teste de JDN de referÃªncia (2000-01-01 = 2451545) movido para dentro do `it.each` i=0
- [x] T021 [P1] [US-024] Create unit tests em `tests/horoscopes.test.ts` â€” Western 16 (12 signos + 4 cuspides); Chinese 120 (60 anos Ã— 2); Maya 520 (260 kins Ã— 2 correlaÃ§Ãµes); Total 656
  - **2026-09-26**: 656 testes do T021 âœ“ (Western 16 = 12 + 4 cuspides; Chinese 120; Maya 520 = 260 Ã— 2 correlaÃ§Ãµes) + 2 extras no arquivo (T020 `kinToSealTone` + T023 export) = **658 no total, 1781 na suÃ­te**; e2e `jdn` por componente + cadeia `((254+i)%260)+1` ancorada em 15/06/1990 = Kin 255
- [x] T022 [P1] [US-020] Create env validation em `src/lib/env.ts` â€” Zod schema: `REDIS_URL`, `SOCKET_PORT` (default 3003), `AI_HOROSCOPE_API_KEY`, `AI_HOROSCOPE_MODEL`, `SHARP_IGNORE_GLOBAL_LIBVIPS`, `MODERATION_BLOCKED_WORDS`, `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `NEXT_PUBLIC_R2_PUBLIC_URL` (R2 jÃ¡ usado por `src/lib/r2.ts`)
  - **2026-09-26 (testes)**: `tests/env.test.ts` (12) â€” default `SOCKET_PORT` 3003, emptyâ†’undefined, URLs vÃ¡lidas/invÃ¡lidas, coerÃ§Ã£o/faixa de porta, enum `SHARP_*`, erro `parseEnv` com path+mensagem por issue, memoizaÃ§Ã£o `getEnv` + `resetEnvCache` + lanÃ§amento com env invÃ¡lido; `parseEnv` passou a aceitar `Record<string, string | undefined>` (o repo exige `NODE_ENV` em `NodeJS.ProcessEnv`)
- [x] T023 [P1] [US-025] Verify kin-maya.ts em `src/lib/calculations/kin-maya.ts` â€” Assertion em `tests/horoscopes.test.ts`: export `calculateKinMaya(birthDate: Date): number` existe (falha do teste se ausente)

**After completing**: `npm run lint` â†’ `npm run type-check` â†’ `npm run test` â†’ mark Phase 0 âœ…

---

### Phase 0.5: Shared Infrastructure (T024â€“T042)

**Status**: âœ… Done
**Objective**: Infraestrutura compartilhada (analytics, moderaÃ§Ã£o, feed, rate limits, CSRF, OG image, cache, mentions, fallbacks, hooks, env, error handling)
**Dependencies**: Phase 0

**Tasks**:

- [x] T024 [P1] [US-020] Extend analytics utility em `src/lib/analytics.ts` (arquivo existe) â€” Typed events: `trackPostCreate()`, `trackLike()`, `trackComment()`, `trackFollow()`, `trackGiftSend()`, `trackHoroscopeView()`, `trackGiftClaimDaily()`, `trackVersosEarned()`, `trackPostLimitHit()`, `trackCsrfFailure()`; manter consent-first PostHog init
- [x] T025 [P1] [US-022] Create moderation utility em `src/lib/moderation.ts` â€” `checkContent(content): { allowed: boolean, flaggedWords: string[] }`; blocked words via env `MODERATION_BLOCKED_WORDS`
- [x] T026 [P1] [US-022] Create feed algorithm em `src/lib/social/feed-algorithm.ts` â€” `getFeed(userId, cursor?, limit=10)`: candidatos visÃ­veis (S2-15) de `followingIds`; ordenaÃ§Ã£o S2-5 em 4 nÃ­veis (tier 1 `isPinned` mÃ¡x 1/10; tier 2 engajamento Ãºltimas 2h por `engagementScore = likes + commentsÃ—2`; tier 3 `createdAt` desc; tier 4 desempate por interaÃ§Ã£o prÃ©via do viewer via `PostLike`/`Comment`); cursor `(createdAt, id)`; fallback explore se 0 following
- [x] T027 [P1] [US-021] Create rate limiter em `src/lib/social/limits.ts` â€” `checkPostLimit(userId)` (tier-aware: 10/dia FREE, 50/dia Plus via `User.subscriptionTier`), `checkLikeLimit()`, `checkCommentLimit()`, `checkFollowLimit()`, `checkGiftLimit()`, `checkUploadLimit()`; Redis sorted sets + TTL; retorna `{ allowed, remaining, resetAt }` (Ãºnica casa dos limites sociais â€” S2-10); **fail-open em Redis down (Q26): libera + `logger.warn` + evento `rate_limiter_bypass`, com fallback de daily limits via count Prisma**; **estender T024 com `trackRateLimiterBypass()`**
- [x] T028 [P1] [US-020] Extend CSRF utility em `src/lib/csrf.ts` (arquivo existe com `validateCsrfToken`) â€” **reutilizar** `csrfCookieName()`/`generateCsrfToken()` (`src/lib/csrf-cookie-name.ts`) e `ensureCsrfCookie()` (`src/lib/csrf-client.ts`) jÃ¡ existentes desde o Sprint 1 â€” adicionar ao `src/lib/csrf.ts` apenas helpers server-side faltantes; cookie `csrf-token`/`__Host-csrf-token` vs header `x-csrf-token` (pattern `set-csrf-cookie-client-side`)
- [x] T029 [P1] [US-022] Create OG image utility em `src/lib/og-image.ts` â€” `generatePostOgImage(post)`; sharp + @vercel/og fallback; SVG 1200Ã—630 template
- [x] T030 [P1] [US-022] Create feed cache em `src/lib/feed-cache.ts` â€” Materialized view para >1000 following; `refreshFeedCache(userId)`, `getCachedFeed(userId, cursor)`
- [x] T031 [P1] [US-021] Create mention/hashtag parser em `src/lib/social/mentions.ts` â€” `parseMentions()`, `parseHashtags()`, `linkifyMentionsHashtags()`
- [x] T032 [P1] [US-024] Create fallback templates em `prisma/seed.ts` â€” Default daily/weekly/monthly para 12 signos, 60 combos Chinese, 260 Maya kins
- [x] T033 [P1] [US-024] Create BullMQ queue em `src/lib/queue/horoscope-queue.ts` â€” `Queue('horoscope-generation')`; Redis; concurrency 3; retry 2Ã— backoff
- [x] T034 [P1] [US-024] Create AI prompt templates em `src/lib/horoscopes/prompts.ts` â€” Templates por tipo/perÃ­odo/mood; variÃ¡veis sign, date, luckyNumber, luckyColor, compatibility
- [x] T035 [P1] [US-024] Create content validation em `src/lib/horoscopes/validation.ts` â€” Zod schema para `HoroscopeContent.content` com contagem de palavras **por perÃ­odo** (RF-HORO-001): diÃ¡rio 150-250, semanal 300-500, mensal 500-800; markdown permitido
- [x] T036 [P1] [US-026] Create gift catalog em `src/lib/social/gifts.ts` â€” SPEC-007 exato: Estrela Cadente(10), Rosa MÃ­stica(25), Cristal(50), Bola de Cristal(100), Coroa Astral(200), DragÃ£o Dourado(500); `getGiftCost()`, `validateGiftId()`
- [x] T037 [P1] [US-026] Create Versos earnings em `src/lib/social/versos.ts` â€” `earnVersos(userId, source)`: like=1, comment=2, follow=5, reading=10; fontes fixas no enum `VersosSource`; **"milestones" (sprint-2 task 29) = os streak milestones do claim-daily (T122: dia 7=50, dia 30=200)** â€” sem outro tipo de milestone no MVP; sempre `$transaction` com checagem `versosBalance >= 0` (S2-17)
- [x] T038 [P1] [US-024] Create shared hooks em `src/hooks/use-horoscopes.ts` e `src/hooks/use-social.ts` â€” `useHoroscopes(type, period, date)`, `useMyHoroscope()`, `useHoroscopeHistory(cursor)`, `useNotifications()`, `useUnreadCount()`; TanStack Query (matriz de compatibilidade vive sÃ³ no cÃ³digo â€” T090/SC7)
- [x] T039 [P1] [US-020] Create error.tsx files â€” `src/app/error.tsx`, `src/app/global-error.tsx`, `src/app/(app)/error.tsx`, `src/app/(app)/feed/error.tsx`, `src/app/(app)/explorar/error.tsx`, `src/app/(app)/horoscopos/error.tsx`, `src/app/(app)/post/[id]/error.tsx`
- [x] T040 [P1] [US-021] Create rate limit middleware em `src/lib/middleware/rate-limit.ts` â€” Aplica T027 em endpoints sociais; headers `Retry-After`, `X-RateLimit-Remaining`; propaga modo fail-open de T027 (sem 503, Q26)
- [x] T041 [P1] [US-020] Create CSRF middleware em `src/lib/middleware/csrf.ts` â€” Valida `x-csrf-token` vs cookie em POST/PATCH/DELETE
- [x] T042 [P1] [US-022] Create feed cache cron job em `src/jobs/feed-cache-refresh.ts` â€” CRON `*/5 * * * *`; refresh para >1000 following
  - **2026-09-28 (clarify Q34/SC34)**: schedule muda para **`0 * * * *` (horÃ¡rio)** â€” Vercel Hobby (tier alvo) rejeita cron < 1 dia e **falha o deploy**
  - **2026-09-28 (execuÃ§Ã£o, correÃ§Ã£o do dono)**: a doc oficial da Vercel mostra que `0 * * * *` (per-hour) **tambÃ©m falha em Hobby** (`Hobby accounts are limited to daily cron jobs`); dono confirmou via pergunta na execuÃ§Ã£o â†’ schedule final **`0 0 * * *` (diÃ¡rio 00:00 UTC)**; `vercel.json` + `FEED_CACHE_REFRESH_CRON` ajustados

**After completing**: `npm run lint` â†’ `npm run type-check` â†’ `npm run test` â†’ mark Phase 0.5 âœ…

---

### Phase 1: Follow System & Profile Integration (T043â€“T050)

**Status**: âœ… Done
**Objective**: Follow/unfollow API, listas, contador
**Dependencies**: Phase 0.5

**Tasks**:

- [x] T043 [P1] [US-020] Implement `POST /api/v1/social/follow/:userId` em `src/app/api/v1/social/follow/[userId]/route.ts` â€” Bearer; `checkFollowLimit` (T027, 20/min); valida nÃ£o-si-mesmo; valida `maxFollowing`; valida `whoCanFollow` via `canFollow` (T049, lÃª `UserProfile.privacy`); toggle; cria `Notification` ao seguido; `earnVersos` (T037); emit `follow-update`/`notification` (alvo room `user:{targetId}`) wireado em T088
- [x] T044 [P1] [US-020] Implement `GET /api/v1/users/:username/followers` em `src/app/api/v1/users/[username]/followers/route.ts` â€” Cursor-based; suporta `?q=` busca; **envelope `{ data, pagination: { nextCursor } }` (S2-18 â€” primeira rota a fixar o shape; hooks union estreitados aqui)**
- [x] T045 [P1] [US-020] Implement `GET /api/v1/users/:username/following` em `src/app/api/v1/users/[username]/following/route.ts` â€” Cursor-based; suporta `?q=` busca; envelope S2-18
- [x] T046 [P1] [US-020] Update `GET /api/v1/users/:username/profile` em `src/app/api/v1/users/[username]/profile/route.ts` â€” Incluir `followersCount`, `followingCount`, `isFollowing`
- [x] T047 [P1] [US-020] Create `FollowButton` em `src/components/social/follow-button.tsx` â€” Toggle com loading; otimistic update via TanStack Query
- [x] T048 [P1] [US-020] Create `FollowersModal`/`FollowingModal` em `src/components/social/followers-modal.tsx` â€” Lista com avatar, nome, username, botÃ£o; busca por nome
- [x] T049 [P1] [US-020] Create `canFollow` em `src/lib/social/privacy.ts` â€” `canFollow(currentUser, targetUser)`: lÃª `UserProfile.privacy.whoCanFollow` (Sprint 1, S2-14); retorna `{ allowed, reason? }`
- [x] T050 [P1] [US-020] Create integration tests em `tests/integration/social-follow.test.ts` â€” Follow/unfollow, listas, validaÃ§Ãµes, anti-self, maxFollowing, privacy (`whoCanFollow`), criaÃ§Ã£o de Notification, rate limit follow 20/min (`checkFollowLimit`)

**After completing**: `npm run lint` â†’ `npm run type-check` â†’ `npm run test` â†’ mark Phase 1 âœ…

---

### Phase 2: Feed Backend & Post System (T051â€“T065)

**Status**: âœ… Done
**Objective**: Post CRUD, feed, upload de imagens, OG image, search
**Dependencies**: Phase 0.5

**Tasks**:

- [x] T051 [P1] [US-021] Implement `POST /api/v1/social/posts` em `src/app/api/v1/social/posts/route.ts` â€” Bearer; Zod `{ type, content?, imageUrls?, readingId?, audience, commentsDisabled? }` com limites por tipo (texto â‰¤500, imagem â‰¤300, tiragem â‰¤200); valida `imageUrls` â‰¤4 com prefixo `posts/{userId}/` (tipo/tamanho autoritativos no presign T064/S2-12); `checkPostLimit` (T027); CSRF (T041); daily limit (10 free/50 Plus); `checkContent` (T025); $transaction Post + PostHashtag; `earnVersos` (T037) se type='reading'; **contadores: criaÃ§Ã£o nÃ£o altera `commentCount`/`likeCount` (defaults 0); updates pertencem a T076/T077/T081 (S2-19)**; emit `post:new` (alvo rooms `user:{id}`/`feed:{id}` dos seguidores) wireado em T088
- [x] T052 [P1] [US-022] Implement `GET /api/v1/social/feed` em `src/app/api/v1/social/feed/route.ts` â€” Cursor-based `WHERE (createdAt, id) < (cursorCreatedAt, cursorId)`; **predicado de visibilidade (S2-15)**: `audience='public'` OU (`audience='followers'` E viewer segue author) E nÃ£o `isHidden`, honrando `UserProfile.privacy.profileVisibility` (privado â†’ sÃ³ seguidores); aplica ordenaÃ§Ã£o S2-5 (4 nÃ­veis via T026); `limit` default **10** (mÃ¡x 50); fallback explore; retorna `{ posts, nextCursor }` da lib **envolvido no envelope `{ data, pagination }` (S2-18)**
- [x] T053 [P1] [US-022] Implement `GET /api/v1/social/explore/trending` em `src/app/api/v1/social/explore/trending/route.ts` â€” PÃºblicos por engagementScore desc, limit 20
- [x] T054 [P1] [US-022] Implement `GET /api/v1/social/explore/hashtags` em `src/app/api/v1/social/explore/hashtags/route.ts` â€” Top 10 hashtags da semana
- [x] T055 [P1] [US-022] Implement `GET /api/v1/social/explore/suggestions` em `src/app/api/v1/social/explore/suggestions/route.ts` â€” Excluir seguidos + si; limit 10
- [x] T056 [P1] [US-022] Implement `GET /api/v1/social/search` em `src/app/api/v1/social/search/route.ts` â€” Query `q`; posts + users + hashtags; posts filtrados pela visibilidade S2-15
- [x] T057 [P1] [US-021] Implement `GET /api/v1/social/posts/:id` em `src/app/api/v1/social/posts/[id]/route.ts` â€” Post + comentÃ¡rios nested 1 nÃ­vel; **checa visibilidade S2-15** (404 se `audience='followers'` sem follow, perfil privado sem follow, ou `isHidden`); anti-timing
- [x] T058 [P1] [US-021] Implement `GET /api/v1/social/posts/:id/og-image` em `src/app/api/v1/social/posts/[id]/og-image/route.ts` â€” Usa `generatePostOgImage` (T029); mesma checagem de visibilidade S2-15 de T057
- [x] T059 [P1] [US-021] Create `PostCard` em `src/components/social/post-card.tsx` â€” Avatar, nome, timestamp relativo, mentions/hashtags clicÃ¡veis (T031), grid imagens, preview tiragem, barra aÃ§Ãµes, animaÃ§Ã£o entrada
- [x] T060 [P1] [US-021] Create `PostComposer` em `src/components/social/post-composer.tsx` â€” Modal; abas Texto/Imagem/Tiragem; contador chars (500/300/200); menÃ§Ãµes/hashtags (T031) com **debounce 300ms** (RF-SOC-003); upload atÃ© 4 imagens via presign T064 (valida JPEG/PNG/WebP â‰¤5MB client-side); seletor audience; toggle `commentsDisabled`; CSRF (T028)
- [x] T061 [P1] [US-022] Create `FeedPage` em `src/app/(app)/feed/page.tsx` â€” Infinite scroll (IntersectionObserver, **pÃ¡ginas de 10 â€” S2-5**), pull-to-refresh, barra criaÃ§Ã£o rÃ¡pida, skeleton, empty state CTA; **pill "N novos posts" no topo (Q27): escuta `post:new` (T072), acumula pendentes, clique insere com slide-in (dedup por id)**
- [x] T062 [P1] [US-022] Create hooks em `src/hooks/use-feed.ts` â€” `useFeed(cursor)`, `useCreatePost()`, `useTrending()`, `useExploreSuggestions()`, `useSearch(q)`; **`useFeed` expÃµe `pendingPosts` + `flushPending()` (Q27, pill do T061)**
- [x] T063 [P1] [US-021] Create `ShareModal` em `src/components/social/share-modal.tsx` â€” Copiar link, download PNG, Web Share API, social links
- [x] T064 [P1] [US-021] Implement `POST /api/v1/social/posts/images/presign` em `src/app/api/v1/social/posts/images/presign/route.ts` â€” Bearer; CSRF (T041); Zod `{ images: [{ contentType }] }` com `max 4` e contentType âˆˆ `image/jpeg|image/png|image/webp`; valida Content-Length â‰¤5MB por imagem; `checkUploadLimit` (T027); keys `posts/{userId}/{ts}-{i}.{ext}`; reutiliza `generatePresignedUrl` de `src/lib/r2.ts` (pattern do avatar presign); retorna `{ uploads: [{ uploadUrl, key }] }` para PUT direto ao R2 (RF-SOC-003, RNF-SOC-003)
- [x] T065 [P1] [US-021] Create integration tests em `tests/integration/social-feed.test.ts` â€” POST/GET feed, daily limit, audience, presign upload (validaÃ§Ãµes tipo/tamanho/limite 4), OG image, explore, search, rate limits

**After completing**: `npm run lint` â†’ `npm run type-check` â†’ `npm run test` â†’ mark Phase 2 âœ…

---

### Phase 2.5: WebSocket Foundation (T066â€“T075)

**Status**: âœ… Done
**Objective**: Socket.io server standalone; emitters; polling fallback â€” habilita Phase 3
**Dependencies**: Phase 2

**Tasks**:

- [x] T066 [P1] [US-020] Create Socket.io server em `socket-service/index.ts` â€” Porta 3003 (`SOCKET_PORT`); Redis adapter; CORS `AUTH_URL`; JWT auth middleware (`socket.data.userId`); rooms `user:{id}`, `feed:{id}`, `post:{id}`, `comment:{id}`; `GET /health`
- [x] T067 [P1] [US-020] Create Dockerfile em `socket-service/Dockerfile` â€” `node:20-alpine`; healthcheck `wget -qO- http://localhost:3003/health`
- [x] T068 [P1] [US-020] Create PM2 config em `socket-service/ecosystem.config.js` â€” Cluster mode, `instances: 'max'`
- [x] T069 [P1] [US-020] Create env validation em `socket-service/src/lib/env.ts` â€” Zod: `REDIS_URL`, `SOCKET_PORT`, `AUTH_URL`, `JWT_SECRET`
- [x] T070 [P1] [US-020] Create event emitters em `socket-service/src/emitters.ts` â€” `emitNewPost()` (followers' `user:`/`feed:` rooms), `emitLikeUpdated()`/`emitCommentAdded()`/`emitCommentLikeUpdated()` (room `post:{id}`), `emitFollowUpdate()`/`emitNotification()` (room `user:{id}`), `emitGiftReceived()` (room `user:{toUserId}`); TypeScript interfaces
- [x] T071 [P1] [US-020] Create polling endpoints (4 route files) â€” `src/app/api/v1/social/polling/posts/route.ts`, `src/app/api/v1/social/polling/likes/route.ts`, `src/app/api/v1/social/polling/comments/route.ts`, `src/app/api/v1/social/polling/notifications/route.ts` â€” GET `?since=` em cada
- [x] T072 [P1] [US-020] Create `useSocket` hook em `src/hooks/use-socket.ts` â€” Auth via auth-store; join rooms `user:{userId}` e `feed:{userId}` no connect + `post:{postId}`/`comment:{id}` sob demanda (PostDetail aberto); reconnect backoff (1sâ†’30s); fallback polling 30s (T071); typed listeners
- [x] T073 [P1] [US-020] Create `NotificationsProvider` em `src/components/social/notifications-provider.tsx` â€” Context global unreadCount; WebSocket `notification` event; badge no AppHeader
- [x] T074 [P1] [US-020] Create integration tests em `tests/integration/websocket.test.ts` â€” Auth, rooms, events, reconnect, fallback
- [x] T075 [P1] [US-020] Create E2E test em `tests/e2e/social-realtime.spec.ts` â€” 2 browsers: post â†’ feed real-time; like/comment/follow/gift â†’ notification; reconnect; fallback

**After completing**: `npm run lint` â†’ `npm run type-check` â†’ `npm run test` â†’ mark Phase 2.5 âœ…

---

### Phase 3: Interactions (T076â€“T089)

**Status**: âœ… Done
**Objective**: Likes, comments CRUD, likes de comentÃ¡rio, notificaÃ§Ãµes in-app, wiring WebSocket
**Dependencies**: Phase 2.5

**Tasks**:

- [x] T076 [P1] [US-023] Implement `POST /api/v1/social/posts/:id/like` em `src/app/api/v1/social/posts/[id]/like/route.ts` â€” Bearer; `checkLikeLimit` (T027); toggle; **`Post.likeCount` increment/decrement no MESMO `$transaction` do toggle (S2-19)**; **bloqueia auto-like** (RF-SOC-004: 403 `SELF_LIKE`); **post `isHidden`/privado/removido â†’ 404 `POST_NOT_FOUND` uniforme com o GET (Q28, anti-timing)**; **curtidas anÃ´nimas â€” endpoint nÃ£o expÃµe lista de quem curtiu (RF-SOC-004)**; cria `Notification` ao autor (se â‰  self); `earnVersos` (T037); emit `like-updated` (room `post:{id}`) + `notification` (room `user:{authorId}`)
- [x] T077 [P1] [US-023] Implement `POST /api/v1/social/posts/:id/comments` em `src/app/api/v1/social/posts/[id]/comments/route.ts` â€” Bearer; `checkCommentLimit` (T027); CSRF (T041); Zod `{ content â‰¤300, parentCommentId? }`; valida parent no mesmo post; **`Post.commentCount` +1 no MESMO `$transaction` do insert (S2-19)**; **post `isHidden`/privado/removido â†’ 404 `POST_NOT_FOUND` (Q28)**; valida `commentsDisabled` do post **e** `UserProfile.privacy.whoCanComment` do autor (403 `COMMENTS_DISABLED` / `WHO_CAN_COMMENT`); cria `Notification` ao autor do post e ao autor do comentÃ¡rio pai (se â‰  self); `earnVersos` (T037); emit `comment-added` (room `post:{id}`) + `notification` (rooms `user:` dos notificados)
- [x] T078 [P1] [US-023] Implement `GET /api/v1/social/posts/:id/comments` em `src/app/api/v1/social/posts/[id]/comments/route.ts` â€” Cursor-based; **lote default 10** (RF-SOC-005); nested 1 nÃ­vel; ordenaÃ§Ã£o mais recentes primeiro
- [x] T079 [P1] [US-023] Implement `PATCH /api/v1/social/comments/:id` em `src/app/api/v1/social/comments/[id]/route.ts` â€” SÃ³ autor; 15min window; **soft delete em T080 decrementa `Post.commentCount` no mesmo `$transaction` (S2-19)**
- [x] T080 [P1] [US-023] Implement `DELETE /api/v1/social/comments/:id` em `src/app/api/v1/social/comments/[id]/route.ts` â€” SÃ³ autor; soft delete `content="[removido]"`; **`Post.commentCount` âˆ’1 no MESMO `$transaction` (S2-19)**
- [x] T081 [P1] [US-023] Implement `POST /api/v1/social/comments/:id/like` em `src/app/api/v1/social/comments/[id]/like/route.ts` â€” Bearer; toggle `CommentLike` (T013); atualiza `Comment.likeCount` **no MESMO `$transaction` do toggle (S2-19)**; `checkLikeLimit` (T027); contagem apenas, **sem lista de quem curtiu** (RF-SOC-005); emit `comment-like-updated`
- [x] T082 [P1] [US-023] Implement `GET /api/v1/social/notifications` em `src/app/api/v1/social/notifications/route.ts` â€” Cursor; filtros `isRead`; **envelope `{ data: { notifications }, pagination: { nextCursor } }` + `unreadCount` em `data` (S2-18 â€” resolve a divergÃªncia flat Ã— envelope anotada em `docs/04-api/social.md`)**
- [x] T083 [P1] [US-023] Implement `PATCH /api/v1/social/notifications/:id/read` em `src/app/api/v1/social/notifications/[id]/read/route.ts` â€” Marca como lida
- [x] T084 [P1] [US-023] Implement `PATCH /api/v1/social/notifications/read-all` em `src/app/api/v1/social/notifications/read-all/route.ts` â€” Marca todas
- [x] T085 [P1] [US-023] Create `CommentSection` em `src/components/social/comment-section.tsx` â€” Lista, input (â‰¤300 chars), respostas 1 nÃ­vel, "Carregar mais", botÃ£o like com contagem (T081)
- [x] T086 [P1] [US-023] Create `NotificationsDropdown` em `src/components/social/notifications.tsx` â€” Badge unread; lista tipo/mensagem/timestamp; mark-as-read
- [x] T087 [P1] [US-023] Create `SocialStore` em `src/stores/social-store.ts` â€” **Apenas client state**: `unreadCount`, `notifications`, `addPostToFeed`, `updatePostLike`, `addCommentToPost`, `setUnreadCount`; NÃƒO feedPosts (useFeed hooks)
- [x] T088 [P1] [US-023] Wire realtime nos routes anteriores â€” em `src/app/api/v1/social/follow/[userId]/route.ts` (T043): `emitFollowUpdate` + `emitNotification` apÃ³s criar `Notification`; em `src/app/api/v1/social/posts/route.ts` (T051): `emitNewPost` para rooms dos seguidores; contrato de eventos com `socket-service/src/emitters.ts` (T070); **sem duplicar** emits de like/comment/gift (jÃ¡ em T076/T077/T120)
- [x] T089 [P1] [US-023] Create integration tests em `tests/integration/social-interactions.test.ts` â€” Like toggle + auto-like 403, comments CRUD + `commentsDisabled` 403 + limits, comment like (contagem), notifications criadas (like/comment/follow), rate limits, earnVersos

**After completing**: `npm run lint` â†’ `npm run type-check` â†’ `npm run test` â†’ mark Phase 3 âœ…

---

### Phase 4: HorÃ³scopo Ocidental (T090â€“T103, T144â€“T145)

**Status**: â¬œ Pending
**Objective**: Compatibilidade, signos, conteÃºdo diÃ¡rio, pÃ¡gina, cron jobs, settings de notificaÃ§Ã£o
**Dependencies**: Phase 0.5

**Tasks**:

- [ ] T090 [P1] [US-024] Create compatibility matrix em `src/lib/horoscopes/western-compatibility.ts` â€” `getCompatibility(a, b): { love, friendship, work, overall }`; 12Ã—12 hardcoded em cÃ³digo â€” **Ãºnica fonte de verdade** (SC7; nÃ£o hÃ¡ seed, nÃ£o hÃ¡ leitura de DB)
- [ ] T091 [P1] [US-024] Create `WesternHoroscopeCard` em `src/components/horoscopes/western-horoscope-card.tsx` â€” Ãcone Unicode, seÃ§Ãµes colapsÃ¡veis (Amor/Carreira/SaÃºde), nÃºmero/cor sorte, compatibilidade, compartilhar
- [ ] T092 [P1] [US-024] Create `WesternHoroscopePage` em `src/app/(app)/horoscopos/ocidental/page.tsx` â€” Signo em destaque, seletor signo, diÃ¡rio/semanal/mensal, compatibilidade
- [ ] T093 [P1] [US-024] Implement `GET /api/v1/horoscopes/western` em `src/app/api/v1/horoscopes/western/route.ts` â€” Query `sign`, `period`, `date`, `targetSign` (compat via T090); fallback template (T032)
- [ ] T094 [P1] [US-024] Implement `GET /api/v1/horoscopes/my-horoscope` em `src/app/api/v1/horoscopes/my-horoscope/route.ts` â€” Bearer; agrega western + chinese + mayan via libs `src/lib/horoscopes/*` (T018/T019/T020) + `HoroscopeContent` â€” **sem depender das rotas das Fases 5/6**
- [ ] T095 [P1] [US-024] Implement `GET /api/v1/horoscopes/history` em `src/app/api/v1/horoscopes/history/route.ts` â€” Bearer; cursor; `HoroscopeEntry[]` (RF-HORO-007)
- [ ] T096 [P1] [US-024] Create `HoroscopeHistoryPage` em `src/app/(app)/horoscopos/historico/page.tsx` â€” Paginada com filtros
- [ ] T097 [P1] [US-024] Create cron job em `src/jobs/horoscope-generation.ts` â€” CRON 04:00 BRT; BullMQ (T033); gera conteÃºdo se nÃ£o existe; loga resultado
- [ ] T098 [P1] [US-024] Create worker em `src/jobs/horoscope-worker.ts` â€” Processa BullMQ; prompt (T034) â†’ IA â†’ valida (T035) â†’ salva; fallback template (T032) se falhar
- [ ] T099 [P1] [US-024] Create unit tests em `tests/horoscopes-western.test.ts` â€” getWesternSign bordas, compatibilidade, API shape
- [ ] T100 [P1] [US-024] Create integration tests em `tests/integration/horoscopes-western.test.ts` â€” GET endpoints, cron, my-horoscope, history
- [ ] T101 [P1] [US-024] Implement `POST /api/v1/ai/horoscope-interpret` em `src/app/api/v1/ai/horoscope-interpret/route.ts` â€” Bearer; **valida e consome 1 unidade da cota diÃ¡ria de IA via `checkDailyAILimit` (`src/lib/ai/rate-limit.ts`) â†’ 429 `AI_DAILY_LIMIT_REACHED`** (RF-HORO-006); SSE streaming
- [ ] T102 [P1] [US-024] Create notification cron em `src/jobs/horoscope-notifications.ts` â€” **Cron horÃ¡rio `0 * * * *` (BRT)** com filtro `HoroscopeNotification.hour = hora atual` (default 7 = 07:00 BRT, honrando `hour` configurÃ¡vel do RF-HORO-008); para usuÃ¡rios habilitados no sistema da hora; **cria `Notification` rows** in-app conforme toggles (RF-HORO-008)
- [ ] T103 [P1] [US-024] Implement `PATCH /api/v1/horoscopes/notifications/settings` em `src/app/api/v1/horoscopes/notifications/settings/route.ts` + UI `src/components/horoscopes/notification-settings.tsx` â€” Bearer; Zod `{ westernEnabled?, chineseEnabled?, mayaEnabled?, hour?: 0â€“23 }`; upsert `HoroscopeNotification`; toggle/hora na seÃ§Ã£o de notificaÃ§Ãµes de `src/app/(app)/perfil/page.tsx` (RF-HORO-008: configurÃ¡vel pelo usuÃ¡rio)
- [ ] T144 [P2] [US-024] Create seÃ§Ã£o de horÃ³scopos no perfil (RF-HORO-004) em `src/components/horoscopes/profile-horoscopes.tsx` â€” consome `useMyHoroscope()` (T038 â†’ T094); exibe signo ocidental, animal+elemento chinÃªs e Kin Maya em `src/app/(app)/perfil/page.tsx` e `src/app/(app)/perfil/[username]/page.tsx`
- [ ] T145 [P2] [US-024] Create availability check em `src/jobs/horoscope-availability-check.ts` (RNF-HORO-001, AC-24) â€” CRON `0 6 * * *` (BRT); verifica `HoroscopeContent` do dia **pela data civil BRT corrente (Q25)** (western diÃ¡rio Ã— 12 signos); ausÃªncia â†’ `logger.warn` + evento PostHog `horoscope_missing` (extender T024)

**After completing**: `npm run lint` â†’ `npm run type-check` â†’ `npm run test` â†’ mark Phase 4 âœ…

---

### Phase 5: HorÃ³scopo ChinÃªs (T104â€“T109)

**Status**: â¬œ Pending
**Objective**: Animal, elementos, 60 ciclos, conteÃºdo
**Dependencies**: Phases 0.5, 4 (estende cron/worker T097/T098)

**Tasks**:

- [ ] T104 [P1] [US-024] Create `ChineseHoroscopeCard` em `src/components/horoscopes/chinese-horoscope-card.tsx` â€” Imagem animal, nome + elemento ("Cavalo de Metal"), caracterÃ­sticas chips
- [ ] T105 [P1] [US-024] Create `ChineseHoroscopePage` em `src/app/(app)/horoscopos/chines/page.tsx` â€” Animal/elemento em destaque, seletor, diÃ¡rio/semanal/mensal
- [ ] T106 [P1] [US-024] Implement `GET /api/v1/horoscopes/chinese` em `src/app/api/v1/horoscopes/chinese/route.ts` â€” Query `animal`, `element`, `period`, `date`; fallback template (T032)
- [ ] T107 [P1] [US-024] Extend cron generation em `src/jobs/horoscope-generation.ts` â€” 60 combos (animal+elemento); via worker T098
- [ ] T108 [P1] [US-024] Create unit tests em `tests/horoscopes-chinese.test.ts` â€” Antes/depois Ano Novo, 60 ciclos
- [ ] T109 [P1] [US-024] Create integration tests em `tests/integration/horoscopes-chinese.test.ts` â€” GET endpoints, cron

**After completing**: `npm run lint` â†’ `npm run type-check` â†’ `npm run test` â†’ mark Phase 5 âœ…

---

### Phase 6: HorÃ³scopo Maia / Kin Maya (T110â€“T117)

**Status**: â¬œ Pending
**Objective**: Tzolkin, Selos, Tons, Onda Encantada, pÃ¡gina
**Dependencies**: Phases 0.5, 4 (estende cron/worker T097/T098; pÃ¡gina de interpretaÃ§Ã£o usa T101)

**Tasks**:

- [ ] T110 [P1] [US-025] Expand `src/lib/calculations/kin-maya.ts` â€” 20 Selos (nome, significado, direÃ§Ã£o, cor), 13 Tons (nome, keyword, aÃ§Ã£o, poder), `getMayanOndaEncantada(kinNumber)` 9 posiÃ§Ãµes
- [ ] T111 [P1] [US-025] Create `MayanHoroscopeCard` em `src/components/horoscopes/mayan-horoscope-card.tsx` â€” Visual temÃ¡tico (cores selos), Selo + Tom destaque, elementos grÃ¡ficos maias
- [ ] T112 [P1] [US-025] Create `MayanHoroscopePage` em `src/app/(app)/horoscopos/maia/page.tsx` â€” Kin em destaque, seletor kin, Onda Encantada 9 cards, detalhes Selo/Tom
- [ ] T113 [P1] [US-025] Implement `GET /api/v1/horoscopes/maya` em `src/app/api/v1/horoscopes/maya/route.ts` â€” Query `kinNumber`, `period`, `date`; fallback template (T032)
- [ ] T114 [P1] [US-025] Extend cron generation em `src/jobs/horoscope-generation.ts` â€” 260 kins; via worker T098
- [ ] T115 [P1] [US-025] Create unit tests em `tests/horoscopes-mayan.test.ts` â€” Tzolkin, Selos/Tons, Onda Encantada
- [ ] T116 [P1] [US-025] Create integration tests em `tests/integration/horoscopes-mayan.test.ts` â€” GET endpoints, cron, my-horoscope
- [ ] T117 [P1] [US-024] Create interpretation page em `src/app/(app)/horoscopos/[type]/interpret/page.tsx` â€” StreamingInterpretation via endpoint T101 (RF-HORO-006)

**After completing**: `npm run lint` â†’ `npm run type-check` â†’ `npm run test` â†’ mark Phase 6 âœ…

---

### Phase 7: Gifts + Versos Economy (T118â€“T125, T142â€“T143)

**Status**: â¬œ Pending
**Objective**: CatÃ¡logo gifts, moeda Versos, ganhos/gastos
**Dependencies**: Phases 0.5, 1, 3 (T123 wireia T043/T076/T077)

**Tasks**:

- [ ] T118 [P1] [US-026] Create `GiftSelector` em `src/components/social/gift-selector.tsx` â€” Modal 6 gifts SPEC-007; Ã­cone animado, preÃ§o Versos; saldo topo; animaÃ§Ã£o envio; confirmaÃ§Ã£o
- [ ] T119 [P1] [US-026] Create `GiftsPage` em `src/app/(app)/presentes/page.tsx` â€” CatÃ¡logo, saldo Versos, histÃ³rico, ganhos diÃ¡rios
- [ ] T120 [P1] [US-026] Implement `POST /api/v1/social/gifts/send` em `src/app/api/v1/social/gifts/send/route.ts` â€” Bearer; CSRF; Zod `{ toUserId, giftId }`; **self-gift â†’ 403 `SELF_GIFT`**; `validateGiftId` (T036); `checkGiftLimit` (T027); valida saldo (`versosBalance >= custo`); **debito + creditos em `$transaction` (S2-17)**: decrementa remetente; `recipientEarnsHalf` se PROFESSIONAL (+50% ao destinatÃ¡rio na mesma transaÃ§Ã£o); cria Gift; cria `Notification` ao destinatÃ¡rio; emit `gift-received` + `notification` (room `user:{toUserId}`); `earnVersos` (T037)
- [ ] T121 [P1] [US-026] Implement `GET /api/v1/social/versos/balance` em `src/app/api/v1/social/versos/balance/route.ts` â€” Bearer; lÃª `UserProfile.versosBalance`/`versosStreak`/`lastClaimAt` (S2-17); retorna `{ balance, dailyEarned, streak }`
- [ ] T122 [P1] [US-026] Implement `POST /api/v1/social/versos/claim-daily` em `src/app/api/v1/social/versos/claim-daily/route.ts` â€” 10 base + streak milestones (dia 7=50, dia 30=200, T037); idempotente por `lastClaimAt` (mesmo dia â†’ 409 `ALREADY_CLAIMED`); streak reset ao perder dia; `$transaction` S2-17
- [ ] T123 [P1] [US-026] Wire `earnVersos` (T037) na rota de criaÃ§Ã£o de reading do Sprint 1 em `src/app/api/v1/readings/route.ts` + smoke-test dos hooks jÃ¡ declarados em T043/T051/T076/T077 â€” todos chamam `earnVersos(userId, source)`
- [ ] T124 [P1] [US-026] Create unit tests em `tests/social-gifts.test.ts` â€” Gift send (saldo, custo, recipientEarnsHalf), earnings, streak
- [ ] T125 [P1] [US-026] Create integration tests em `tests/integration/social-gifts.test.ts` â€” POST send (+Notification), balance, claim-daily, earnings
- [ ] T142 [P2] [US-026] Implement `GET /api/v1/social/gifts/received` em `src/app/api/v1/social/gifts/received/route.ts` â€” Bearer; query `userId`; honra visibilidade S2-15 (perfil privado â†’ sÃ³ seguidores); Ãºltimos 20 gifts recebidos `{ gifts, totalReceived }` (RF-SOC-006)
- [ ] T143 [P2] [US-026] Create `GiftsStrip` em `src/components/social/gifts-strip.tsx` â€” Gifts recebidos exibidos no perfil do destinatÃ¡rio com animaÃ§Ã£o especial (RF-SOC-006); integra em `src/app/(app)/perfil/[username]/page.tsx`; atualizaÃ§Ã£o via evento `gift-received` (S2-1)

**After completing**: `npm run lint` â†’ `npm run type-check` â†’ `npm run test` â†’ mark Phase 7 âœ…

---

### Phase 8: Explore + Search (T126â€“T130)

**Status**: â¬œ Pending
**Objective**: Explore page, busca, moderaÃ§Ã£o bÃ¡sica (UI + report endpoint)
**Dependencies**: Phase 2

**Tasks**:

- [ ] T126 [P1] [US-022] Create `ExplorePage` em `src/app/(app)/explorar/page.tsx` â€” Tabs Em Alta/Hashtags/Pessoas/Tiragens; busca topo; infinite scroll; skeleton
- [ ] T127 [P1] [US-022] Create `SearchPage` em `src/app/(app)/busca/page.tsx` â€” Unificada (posts, usuÃ¡rios, hashtags); filtros; paginada
- [ ] T128 [P1] [US-022] Implement `POST /api/v1/social/report` em `src/app/api/v1/social/report/route.ts` â€” Bearer; CSRF; Zod `{ targetType, targetId, reason }`; cria `ContentReport` (T012)
- [ ] T129 [P1] [US-022] Integrate moderation em feed/explore â€” `checkContent` (T025) em `src/app/api/v1/social/posts/route.ts` (T051); filtrar `Post.isHidden` e `User.isBanned` em `src/app/api/v1/social/feed/route.ts` (T052), `.../explore/trending/route.ts` (T053), `.../search/route.ts` (T056)
- [ ] T130 [P1] [US-022] Create integration tests em `tests/integration/social-explore.test.ts` â€” Explore tabs, search, report, moderaÃ§Ã£o filters

**After completing**: `npm run lint` â†’ `npm run type-check` â†’ `npm run test` â†’ mark Phase 8 âœ…

---

### Phase 9: Frontend Integration & Polish (T131â€“T141, T146)

**Status**: â¬œ Pending
**Objective**: PÃ¡ginas finais, components layout, E2E tests, polish
**Dependencies**: Phases 1â€“8

**Tasks**:

- [ ] T131 [P1] [US-021] Create `PostDetailPage` em `src/app/(app)/post/[id]/page.tsx` â€” PostCard + CommentSection + ShareModal; SEO meta tags
- [ ] T132 [P1] [US-023] Create `NotificationsPage` em `src/app/(app)/notificacoes/page.tsx` â€” Lista completa, filtros, mark-all-read
- [ ] T133 [P1] [US-020] Update `MobileNav` em `src/components/layout/mobile-nav.tsx` â€” 5 tabs: Feed, Explorar, NotificaÃ§Ãµes, Presentes, Perfil
- [x] T134 [P1] [US-023] Update `AppHeader` em `src/components/layout/app-header.tsx` â€” Notification bell + badge unreadCount + dropdown (T073)
- [ ] T135 [P1] [US-020] Add loading/error/empty states em `src/app/(app)/feed/page.tsx`, `src/app/(app)/explorar/page.tsx`, `src/components/horoscopes/*` â€” Skeleton; empty states com CTAs
- [ ] T136 [P1] [US-020] Integrate PostHog events (T024) nos consumers â€” `src/app/api/v1/social/posts/route.ts` (T051), `.../posts/[id]/like/route.ts` (T076), `.../posts/[id]/comments/route.ts` (T077), `.../follow/[userId]/route.ts` (T043), `.../gifts/send/route.ts` (T120), `src/app/api/v1/horoscopes/western/route.ts` (T093), `.../versos/claim-daily/route.ts` (T122), `src/lib/social/limits.ts` (`rate_limiter_bypass`, T027)
- [ ] T137 [P2] [US-021] Animation optimization em `src/components/social/post-card.tsx`, `src/components/social/gift-selector.tsx`, feed scroll â€” `will-change`, `transform` GPU, 60fps; medir com Chrome DevTools
- [ ] T138 [P1] [US-020] Create E2E tests em `tests/e2e/social-flows.spec.ts` â€” Feed CRUD, follow, like/comment, gift, horoscopes, explore, real-time 2 browsers
- [ ] T139 [P1] [US-024] Create E2E test em `tests/e2e/horoscopes-flow.spec.ts` â€” 3 sistemas, my-horoscope, compatibilidade, Onda Encantada, history, AI interpret
- [ ] T140 [P2] [US-020] Responsive polish em `src/app/(app)/**` + `src/components/layout/mobile-nav.tsx` â€” Mobile-first todas pÃ¡ginas; bottom tabs; drawer desktop
- [ ] T141 [P1] [US-020] Create full-flow E2E em `tests/e2e/full-flow-sprint2.spec.ts` â€” Cadastro â†’ perfil â†’ follow â†’ post (+upload) â†’ like/comment â†’ gift â†’ horÃ³scopo â†’ explore â†’ notificaÃ§Ãµes â†’ moderaÃ§Ã£o
- [ ] T146 [P1] [US-020] Create bench suite em `tests/bench/` (Q29, NFRs) â€” p95 endpoints sociais <500ms; feed <300ms com 1000 following sintÃ©ticos; Playwright tracing pÃ¡gina de horÃ³scopo <800ms; cronÃ´metro unitÃ¡rio Kin <1ms; **mÃ©todo: â‰¥30 reqs/endpoint, 1 warmup descartado, P95 = percentile 95**; **isolamento: `vitest.config.ts` ganha `exclude: ["tests/bench/**"]` (nÃ£o roda em `npm run test`) + package.json `bench` â†’ `vitest run tests/bench/`**; roda via `npm run bench` no gate da Phase 9

**After completing**: `npm run lint` â†’ `npm run type-check` â†’ `npx playwright test` â†’ `npm run bench` â†’ mark Phase 9 âœ…

---

### Phase 10: Data Integrity & Compliance (T147â€“T148)

**Status**: âœ… Completed
**Objective**: Reconciliar contadores sociais e purgar histÃ³rico de leituras pÃ³s-90d (LGPD)
**Dependencies**: T147 â†’ Phase 3 (likes/comments existem); T148 â†’ Phase 0 (models existem; pode rodar antes da Phase 3)

**Tasks**:

- [x] T147 [P1] [US-023] Create cron de reconciliaÃ§Ã£o de contadores (S2-19, invariante I4 de `entities.md`) em `src/jobs/counter-reconcile.ts` â€” recomputa `Post.likeCount`/`Post.commentCount`/`Comment.likeCount` via `UPDATE ... SET count = (SELECT count(*) ...)` para todos os rows (ou sÃ³ os divergentes); agendamento diÃ¡rio em `vercel.json` + rota `GET /api/cron/counter-reconcile` com `Bearer CRON_SECRET` (mesmo pattern do `hard-delete`); loga divergÃªncias corrigidas; **testes**: seed com drift artificial â†’ reconcile â†’ counts corretos + idempotÃªncia
- [x] T148 [P1] [US-020] Extend LGPD purge de leituras (S2-20, `docs/07-security/lgpd.md` retenÃ§Ã£o "90 dias apÃ³s exclusÃ£o") em `src/jobs/hard-delete-accounts.ts` â€” para contas com `deletedAt > 90 dias`, apaga `Reading`/`ReadingCard`/`Interpretation` (ordenado por FK: Interpretation â†’ ReadingCard â†’ Reading) na mesma transaÃ§Ã£o do job; janela de 30d (anonimizaÃ§Ã£o) e 90d (purge de leituras) coexistem; **testes**: conta 45d mantÃ©m leituras, conta 95d as perde; idempotÃªncia

**After completing**: `npm run lint` â†’ `npm run type-check` â†’ `npm run test` â†’ mark Phase 10 âœ…

---

## âœ… Master Checklist

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
- [x] T027 Social rate limits (Ãºnica casa)
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
- [x] T051 POST /social/posts (+char limits, commentsDisabled)
- [x] T052 GET /social/feed
- [x] T053 GET /explore/trending
- [x] T054 GET /explore/hashtags
- [x] T055 GET /explore/suggestions
- [x] T056 GET /social/search
- [x] T057 GET /posts/:id
- [x] T058 GET /posts/:id/og-image
- [x] T059 PostCard
- [x] T060 PostComposer
- [x] T061 FeedPage
- [x] T062 use-feed hooks
- [x] T063 ShareModal
- [x] T064 POST /posts/images/presign (upload R2)
- [x] T065 Feed integration tests
- [x] TypeScript validation + lint + tests pass

### Phase 2.5: WebSocket Foundation
- [x] T066 Socket.io server
- [x] T067 Dockerfile
- [x] T068 PM2 config
- [x] T069 socket env validation
- [x] T070 Event emitters
- [x] T071 Polling endpoints (4 files)
- [x] T072 use-socket hook (rooms join)
- [x] T073 NotificationsProvider
- [x] T074 WebSocket integration tests
- [x] T075 E2E realtime test
- [x] TypeScript validation + lint + tests pass

### Phase 3: Interactions
- [x] T076 POST /like (auto-like 403 + Notification)
- [x] T077 POST /comments (limits + Notification)
- [x] T078 GET /comments
- [x] T079 PATCH /comments/:id
- [x] T080 DELETE /comments/:id
- [x] T081 POST /comments/:id/like (CommentLike)
- [x] T082 GET /notifications
- [x] T083 PATCH /notifications/:id/read
- [x] T084 PATCH /notifications/read-all
- [x] T085 CommentSection (+like count)
- [x] T086 NotificationsDropdown
- [x] T087 SocialStore
- [x] T088 Wire realtime (T043, T051)
- [x] T089 Interactions integration tests
- [x] TypeScript validation + lint + tests pass

### Phase 4: HorÃ³scopo Ocidental
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

### Phase 5: HorÃ³scopo ChinÃªs
- [ ] T104 ChineseHoroscopeCard
- [ ] T105 ChineseHoroscopePage
- [ ] T106 GET /horoscopes/chinese
- [ ] T107 Cron generation chinÃªs
- [ ] T108 Chinese unit tests
- [ ] T109 Chinese integration tests
- [ ] TypeScript validation + lint + tests pass

### Phase 6: HorÃ³scopo Maia
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
- [x] T134 AppHeader notification bell
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
- [x] T147 Cron de reconciliaÃ§Ã£o de contadores (S2-19/I4)
- [x] T148 LGPD purge de leituras >90d (S2-20)
- [x] TypeScript validation + lint + tests pass

---

## Clarifications

> Full details: [`docs/plans/20260926120000-sprint2-execution-plan.clarifications.md`](./20260926120000-sprint2-execution-plan.clarifications.md)

**SessÃ£o 2026-09-28 (Q30â€“Q34, batch de divergÃªncias pÃ³s-re-review):**
- Envelope social cursor = `{ data, pagination }` (S2-18; resolve o "T052 decide" de `overview.md`/`social.md`)
- Contadores = mesmo `$transaction` + cron de reconciliaÃ§Ã£o (S2-19 â†’ T147)
- Purge LGPD de leituras 90d = task nova no Sprint 2 (S2-20 â†’ T148)
- 429 social ganha `retryAfter` no body (S2-10/SC33) â€” âœ… executado
- Cron feed-cache `*/5` â†’ `0 * * * *` (SC34; Hobby falha deploy com cron < 1 dia) â€” **corrigido na execuÃ§Ã£o para `0 0 * * *`** (a doc da Vercel mostra que horÃ¡rio tambÃ©m falha em Hobby; dono confirmou)
- ~~**Pendente de execuÃ§Ã£o** (fora do artefato do plano): ajustar `vercel.json` (cron horÃ¡rio) e `src/lib/middleware/rate-limit.ts` (+`retryAfter`)~~ â€” âœ… **executado em 2026-09-28**: `vercel.json` (`feed-cache` `0 0 * * *`, `counter-reconcile` `0 4 * * *`) + `retryAfter` no body do 429 social

| SC | Pergunta | DecisÃ£o |
|----|----------|---------|
| SC1 | WebSocket: serviÃ§o separado? | **Sim**, porta 3003, Redis adapter, deploy separado |
| SC2 | HorÃ³scopo conteÃºdo: IA ou templates? | **HÃ­brido**: templates + IA batch (BullMQ); fallback template se falhar |
| SC3 | Kin Maya: reutilizar? | **Sim**, expandir `kin-maya.ts` com Selos/Tons/Onda |
| SC4 | Gifts: catÃ¡logo? | **Fixo SPEC-007 exato** (6 gifts; sem env de preÃ§o â€” corrige Q4 das clarifications) |
| SC5 | Feed: cursor ou offset? | **Cursor-based** |
| SC6 | NotificaÃ§Ãµes: in-app ou push? | **In-app only** (MVP) |
| SC7 | Compatibilidade: matriz ou IA? | **Matriz fixa 12Ã—12** em cÃ³digo |
| SC8 | my-horoscope: agrega 3? | **Sim**, endpoint Ãºnico via libs (sem depender das rotas Fases 5/6) |
| SC9 | Rate limits? | Posts 10/50, Likes 100/min, Comments 30/min, Follow 20/min, Gifts 10/dia |
| SC10 | OG Image? | **Sharp SVGâ†’PNG** |
| SC11 | ComentÃ¡rios: nÃ­veis? | **1 nÃ­vel** |
| SC12 | ModeraÃ§Ã£o MVP? | **Lista + report endpoint**; sem IA |
| SC13 | IA fallback? | **Template fallback** |
| SC14 | Versos earnings? | **Hook em like/comment/follow/reading**; milestones = streak do claim-daily (T122) |
| SC15 | WebSocket fallback? | **Polling endpoints dedicados** |
| SC16 | Error handling? | **error.tsx** App Router |
| SC17 | Subscription tier? | **User.subscriptionTier** + `checkPostLimit` tier-aware |
| SC18 | Feed >1000 following? | **Materialized view** + cron 5min |
| SC19 | Push notifications horÃ³scopo? | **Cron horÃ¡rio** (default 07:00 BRT via `hour`) â†’ in-app |
| SC20 | AI interpretation horÃ³scopo? | **Pipeline SPEC-004** SSE |
| SC21 | HorÃ³scopos/Explore pÃºblicos (visitante)? | **NÃ£o no MVP** â€” atrÃ¡s do auth layout (UC-005 prÃ©-condiÃ§Ã£o autenticado); pÃºblico Sprint 3+ |
| SC22 | Upload de imagens? | **Presign R2** (pattern avatar): mÃ¡x 4, JPEG/PNG/WebP, â‰¤5MB, PUT direto |
| SC23 | Fonte de privacidade de follow? | **`UserProfile.privacy.whoCanFollow`** (Sprint 1); sem `User.privacySettings` |
| SC24 | Curtir comentÃ¡rios? | **Contagem apenas** (`CommentLike` unique), RF-SOC-005 |
| SC25 | `HoroscopeContent.date`? | **Data civil BRT** (`America/Sao_Paulo`) â€” Q25/S2-2 |
| SC26 | Rate limiter com Redis down? | **Fail-open + alerta** (`rate_limiter_bypass`) â€” Q26/S2-10 |
| SC27 | Post novo no feed aberto? | **Pill "N novos posts" + slide-in no clique** â€” Q27/S2-5 |
| SC28 | Like/comment em post oculto? | **404 `POST_NOT_FOUND` uniforme** (anti-timing) â€” Q28 |
| SC29 | MediÃ§Ã£o dos NFRs? | **Bench automatizado `tests/bench/`** (T146) â€” Q29 |
| SC30 | Envelope das rotas sociais cursor? | **`{ data, pagination: { nextCursor } }`** (contrato overview.md Â§PaginaÃ§Ã£o) â€” [S2-18] |
| SC31 | Contadores `likeCount`/`commentCount`? | **Mesmo `$transaction` + cron de reconciliaÃ§Ã£o (T147)** â€” [S2-19] |
| SC32 | Purge LGPD de leituras 90d? | **Nova task no Sprint 2 (T148)** estendendo o job hard-delete â€” [S2-20] |
| SC33 | Body do 429 social? | **+ `retryAfter` (segundos) junto de `resetAt`** â€” [S2-10] |
| SC34 | Cron `*/5` Ã— Vercel Hobby? | **`0 0 * * *` (diÃ¡rio 00:00 UTC)** â€” Hobby rejeita cron < 1 dia e falha o deploy; decisÃ£o original `0 * * * *` corrigida na execuÃ§Ã£o (horÃ¡rio tambÃ©m falha em Hobby; dono confirmou) â€” T042 |

| SC35 | Formato da API de follow? | **POST toggle unico** (201 segue / 200 deixa de seguir); sem `DELETE /social/follow` - contrato de `docs/04-api/social.md` substituido -> T043 |
| SC36 | Solicitacao pendente p/ `whoCanFollow`? | **Nao - 403 `FOLLOW_NOT_ALLOWED` com `details.reason`** (negacao definitiva; sem model `FollowRequest`) -> T043/T049 |
| SC37 | Nomes dos contadores no profile? | **`followersCount`/`followingCount`/`isFollowing` no root** (texto de T046; design `stats.*` de `users.md` nao vale) -> T046 |
| SC38 | `statsVisibility` honrado nos dados de follow? | **Sim â€” sÃ³ nos dados de follow** (omitir contadores p/ nÃ£o-dono, listas 404 p/ nÃ£o-dono) â€” RF-PROF-005 escopo mÃ­nimo -> profile/route.ts + _follow-list.ts |
| SC39 | Contadores filtram banidos/soft-deleted? | **Sim â€” igual Ã s listas** (excluir `isBanned`/`deletedAt`); contador e lista concordam por construÃ§Ã£o -> follow-lists.ts + profile/route.ts + toggle |
| SC40 | Versos farming no re-follow? | **Uma vez por par com marker durÃ¡vel** â€” nova tabela `FollowReward` (`@@unique([followerId,followingId])`) inserida no mesmo `$transaction` do follow; `earnVersos` sÃ³ paga se marker nÃ£o existir -> schema + migraÃ§Ã£o + versos.ts |
| SC41 | Toggle idempotente (corrida/500)? | **Sim â€” 1 $transaction + mapear P2002/P2025 para 2xx** (P2002â†’201 following:true, P2025â†’200 following:false; earnVersos/contadores pÃ³s-commit best-effort log-only â€” **superado na re-review 2026-09-29**: `earnVersos` + contadores agora rodam **dentro** do tx, `earnVersos === null` aborta a tx, e os handlers de corrida **re-querem `follow.findUnique`**; falha na re-query â†’ 500 JSON com `rate.headers`, ver Execution Log 2026-09-29) -> social/follow/[userId]/route.ts |
| SC42 | Ãndices keyset para listas? | **Adicionar agora via migrate dev** â€” `@@index([followingId,createdAt,id])` + `@@index([followerId,createdAt,id])` + drop `@@index([followerId])` redundante -> schema.prisma + migraÃ§Ã£o |

---

**SessÃ£o 2026-09-29 (Review findings fix round â€” Phase 1 post-review):**
- `statsVisibility` honrado nos dados de follow (omitir contadores + listas 404 p/ nÃ£o-dono)
- Contadores filtram `isBanned`/`deletedAt` igual Ã s listas (concordam por construÃ§Ã£o)
- Versos farming fechado: `FollowReward` marker table + pagamento Ãºnica vez por par
- Toggle POST idempotente: 1 transaÃ§Ã£o, P2002/P2025 â†’ 2xx, sem 500 na corrida; earnVersos best-effort *(superado no mesmo dia pela re-review â€” ver SC41 e Execution Log 2026-09-29: earnVersos/contadores dentro do tx)*
- Ãndices keyset compostos adicionados via `prisma migrate dev` (follow_keyset_indexes)
- Fix round executa via `/pwf-work-tdd` (TDD Red/Green/Refactor) cobrindo todos achados do review (2 CRITICAL + 16 Important/Informational)

## Execution Log

- 2026-09-26 â€” Plan v1 criado (Sprint 2 requirements, specs, state atual)
- 2026-09-26 â€” Research: repo, patterns docs/solutions/, spec flows
- 2026-09-26 â€” Plan v2: estruturado 12 phases; clarifications (20 decisÃµes)
- 2026-09-26 â€” Review v1: 6 CRITICAL + 12 HIGH/MEDIUM â†’ fixes aplicados (models, feed algorithm, WebSocket phase, migration commands, Sharp/OG)
- 2026-09-26 â€” Review v2: 6 CRITICAL (duplicate IDs, Phase 9 dup, placeholder, cross-refs) + 8 HIGH â†’ renumbering + consolidation
- 2026-09-26 â€” Review v3: 3 CRITICAL (ID com sufixo de letra duplicado Ã—132, checklist format, AC dup) + HIGH/MEDIUM â†’ **renumbering completo T001â€“T141, AC Ãºnicos 1â€“22, checklist separado**
- 2026-09-26 â€” Review v4: 3 CRITICAL (upload sem task; write-path de notificaÃ§Ãµes ausente; clarifications com IDs obsoletos) + HIGH (Visitante vs auth layout, deps de fase, gaps SPEC-007, privacy split-brain) + MEDIUM (US tags, totais, rate-limits duplicados, task hygiene) â†’ **v5: +4 tasks (T013 CommentLike, T064 presign, T081 comment-like, T103 notif settings), âˆ’3 redundantes (old T014/T015/T025), merge rate limits (old T029+T035), deps de fase corrigidas, AC-23 upload, Visitanteâ†’autenticado, privacyâ†’UserProfile.privacy, US crosswalk, renumbering T001â€“T141, clarifications re-sync (SC1â€“SC24)**
- 2026-09-26 â€” Review v5: **Go (CRITICAL=0)** â€” regressÃµes v4 confirmadas corrigidas + hygiene estrutural OK; patches HIGH/MEDIUM/LOW aplicados: visibilidade `audience`/`profileVisibility` em T052/T056/T057/T058 (S2-15), `whoCanComment` em T077, `checkFollowLimit` em T043+T050, cron horÃ¡rio por `hour` (T102/AC-18/SC19), phase gates `lint`+`type-check` (script `validate` nÃ£o existe), rooms/alvos de emit em S2-1/T070/T072/T076/T077/T120, tags US-022 no bloco moderaÃ§Ã£o, matriz de compat sÃ³ em cÃ³digo (T038â†’hooks compartilhados), migration chain sem `db push` (T015), T023 como assertion, T123 restrito Ã  rota de readings, [S2-16] convenÃ§Ã£o de rotas
- 2026-09-26 â€” **/pwf-checklist**: 5 checklists criados (88 itens CHK: api/ux/security/data/observability)
- 2026-09-26 â€” **/pwf-analyze**: Decision Gate **Go (CRITICAL=0)** â€” 18 issues (0C/2H/10M/6L), coverage 96% mapeado (20 full, 7 partial, 1 deferred); **remediation aplicada**: [S2-5] ordenaÃ§Ã£o em 4 nÃ­veis RF-SOC-002 + 10/pÃ¡gina; [S2-17] saldo Versos (`UserProfile.versosBalance`, `$transaction`); [S2-4] catÃ¡logo autoritativo SPEC-007 + terminologia Moedas=Versos + `INSUFFICIENT_VERSOS`; self-gift 403 (T120/AC-12); AI quota `checkDailyAILimit` (T101/AC-17); T035 palavras por perÃ­odo; gift no perfil (T142/T143); horÃ³scopo no perfil (T144/RF-HORO-004); availability check 06:00 (T145/AC-24/RNF-HORO-001); T028 reusa helpers CSRF Sprint 1; debounce 300ms (T060); likes anÃ´nimos (T076/AC-6); lote 10 comentÃ¡rios (T078); S2-10 +uploads; T037 milestones=streak; **+4 tasks â†’ T001â€“T145**; clarifications Q4 corrigida; **dÃ©bito doc:** `docs/06-features/gifts.md` e `docs/04-api/social.md` desatualizados â†’ atualizar via doc-shepherd pÃ³s-Phase 7
- 2026-09-26 â€” **/pwf-clarify (v7, Q25â€“Q29)**: data civil BRT para `HoroscopeContent.date` (S2-2/T008/T145); rate limiter fail-open + `rate_limiter_bypass` (S2-10/T027/T040); pill "N novos posts" + slide-in (S2-5/T061/T062); 404 uniforme p/ post oculto em escrita (T076/T077); NFR via bench automatizado + **T146** â†’ **T001â€“T146**; SC25â€“SC29 adicionados
- 2026-09-26 â€” **/pwf-analyze v7 (re-run)**: **Go (CRITICAL=0)** â€” coverage 100% dos 27 requisitos in-scope; 0 ambiguidades abertas; fixes: `trackRateLimiterBypass` em T024/T136 (A1), isolamento do bench (`vitest exclude` + script `bench` + gate Phase 9, A2/A6), contagem de checklists 91 (A3); A4 (docs gifts/social desatualizados) = dÃ©bito aceito, A5 (pill vs slide-in literal) = desvio documentado em Q27
- 2026-09-26 â€” **Phase 0 executada (T001â€“T023 âœ“)**: 2 clarify respondidos antes de codar â€” **(1) Kin do produto = GMT 584283** (AC-11/RF-HORO-004; 15/06/1990 â†’ **Kin 255**, nÃ£o 148; `calculateKinMaya` reescrito para delegar a `maya.ts`, contrato T023 preservado) e **(2) Onda Encantada = 9 cÃ¢maras** (posiÃ§Ãµes 2,3,4,6,7,8,10,11,12 â€” exclui portais 1/13 e torres 5/9). Entregas: schema + migraÃ§Ã£o `20260926182325` aplicada (13 models sociais/horÃ³scopos), `western.ts`/`chinese.ts`/`maya.ts` (catÃ¡logos + algoritmos), `env.ts` (Zod), seed DB idempotente (24 fallbacks + notifs + usuÃ¡rios), `tests/horoscopes.test.ts` **658 testes** (T021 = 656 exatos + 2 extras T020/T023), `.env.example` +4 vars. CorreÃ§Ãµes de spec documentadas nas notas de task: elemento chinÃªs = `floor(stem/2)` (spec `((year-4)%5)` viola RF-HORO-002), typos PT (Humano Amarelo/Inspirar/HarmonizaÃ§Ã£o/Pulsar), keywords ocidentais = decisÃ£o de conteÃºdo, CNY fallback 04/02. Gates: **lint âœ“ type-check âœ“ 1781 testes âœ“** (baseline 1124). Seed executado (idempotente na 2Âª passada). **Backfill de `mayanKin`**: script pontual `prisma/backfill-mayankin.ts` (dry-run â†’ apply â†’ idempotente, fonte Ãºnica `calculateKinMaya`; validado com 1990-06-15 â†’ 255 em dev e revertido). `prisma generate` re-executado (client desatualizado). Nota: T017 seed cobre DB; catÃ¡logos (gifts T036, palavras T025, fallbacks completos T032) ficam nas fases prÃ³prias
- 2026-09-26 â€” **Phase 0 â€” testes de cobertura remanescente**: 63 testes novos fechando os gaps sem teste da fase â€” `tests/schema-sprint2.test.ts` (**42**: contrato T001â€“T016 â€” models, `@@unique`/`@@index`, campos crÃ­ticos), `tests/env.test.ts` (**12**: T022 â€” defaults, emptyâ†’undefined, coerÃ§Ã£o/porta/enum, erros `parseEnv`, cache `getEnv`), `tests/seed.test.ts` (**9**: T017 â€” `civilDateBrt` fuso BRT, `buildWesternFallback`, idempotÃªncia 0/22/24, notifs upsert, `seed()`). MudanÃ§as de suporte: `prisma/seed.ts` + guard de execuÃ§Ã£o direta/exports/aliases (import em teste nÃ£o dispara seed), `parseEnv` aceita `Record` (repo exige `NODE_ENV` em `ProcessEnv`). Gates frescos: **lint âœ“ type-check âœ“ suÃ­te 1844 passed / 1 skipped âœ“**; seed direto re-executado âœ“ (guard vÃ¡lido, idempotente)
- 2026-09-26/27 â€” **Phase 0.5 executada (T024â€“T042 âœ“)**: 5 lotes, cada um com testes (129 novos). Entregas: analytics +11 eventos typed (inclui `trackRateLimiterBypass`); `moderation.ts` (env `MODERATION_BLOCKED_WORDS`); **`social/limits.ts` Ãºnica casa dos limites** (Redis ZSET+TTL; fail-open Q26: libera + `logger.warn rate_limiter_bypass` + fallback de daily via count Prisma; tier-aware FREE 10/PLUS 50; **upload 20/dia = decisÃ£o S2-10** sem spec); `csrf.ts` + `buildCsrfSetCookieHeader`/`csrfErrorResponse`; `social/mentions.ts` (fronteiras: hashtag exige `(^|[^\p{L}\p{N}_])#`, menÃ§Ãµes nÃ£o casam e-mail); `horoscopes/validation.ts` (faixas RF-HORO-001 sobre `general` â€” decisÃ£o; fallbacks do seed fora da validaÃ§Ã£o); `gifts.ts` SPEC-007 (ids kebab-case = decisÃ£o de conteÃºdo); `versos.ts` (`$transaction` + `versosBalance >= 0`); `social/feed-algorithm.ts` (4 tiers S2-5, cap 1 pinned/10, cursor `(createdAt,id)` = menor lido â€” aproximaÃ§Ã£o sobre ranking, S2-15 com perfil privado, fallback explore em 0 following); `feed-cache.ts` (Redis TTL 5 min, threshold 1000, cursor â†’ miss) + `jobs/feed-cache-refresh.ts` (`*/5 * * * *`, candidatos via `HAVING COUNT(*) > 1000`); `og-image.ts` (SVG 1200Ã—630 com escape XML â†’ sharp PNG, fallback `@vercel/og`); seed T032 (**1328 rows** = (12+60+260) Ã— dailyÃ—2+weekly+monthly; `civilIsoWeek`/`civilMonth` em BRT p/ formato Q25); `queue/horoscope-queue.ts` (**deps novas `bullmq` + `@vercel/og`**; jobId determinÃ­stico idempotiza o cron; attempts 3 = retry 2Ã—; `HOROSCOPE_WORKER_CONCURRENCY = 3`); `horoscopes/prompts.ts` (matriz 3Ã—3 tipoÃ—perÃ­odo + 12 moods, faixas RF-HORO-001, guardrails); hooks `use-horoscopes`/`use-social` (zod + cursor infinite query); 7 `error.tsx` + `route-error.tsx` compartilhado (Link p/ home); middlewares `rate-limit` (429 `RATE_LIMITED` + `Retry-After`/`X-RateLimit-*`, fail-open nunca 503) e `csrf` (403 `CSRF_INVALID` + log). Bug real pego por teste: `DAY = 24 * MINUTE` (24 minutos!) no T027. Gates: **lint âœ“ type-check âœ“ suÃ­te 1975 passed / 1 skipped âœ“**; seed real: 1304 criados (24 diÃ¡rios prÃ©-existentes reaproveitados) e **0 criados na 2Âª passada** (idempotente)
- 2026-09-27/28 â€” **Step 4/5 â€” "fix all issues" dos 9 revisores (9 relatÃ³rios em disco) concluÃ­do**: **CRIT/S/N/I corrigidos** â€” Sentry global (`RouteError` com `Sentry.captureException` + `console.error`, 6 `error.tsx` + `global-error.tsx` + S-N18 teste "nunca renderiza error.message no DOM"); rate limits nÃºcleo Ãºnico (`social/limits.ts`); CSRF canÃ´nico **`CSRF_TOKEN_INVALID`** (cÃ³digo+middleware+docs; `buildCsrfSetCookieHeader` removido, cookie non-httpOnly single-writer, interceptor `api.ts`); moderation cache de regex; `isBanned` gate; seed/dates/chinese fixes; backfill `mayanKin`; mentions fronteiras; og-image escape/aria; feed-cache-refresh cron (`*/5` em `vercel.json` + rota com `Bearer CRON_SECRET`); proxy matcher; CSP real (`next.config.ts`/`vercel.json`); hooks aceitam envelope de notificaÃ§Ã£o; **novos**: `versos.ts` simplificado (1 query `update`+`select`, P2025â†’null, guards de runtime removidos â€” CHECK `UserProfile_versosBalance_nonneg` cobre invariante, 12/12 versos+gifts); **migration #8** `20260927222620_sprint2_review_fixes` (checks/notnull/backfill) e **migration #9** `20260928004004_horoscope_contents_domain_checks` (CHECKs `type`/`period` em `HoroscopeContents`, gerada `--create-only` + SQL custom, dados verificados no domÃ­nio antes do ADD; 9 migrations up-to-date, 1660 rows conformes); **CI drift gate** no job Testes (`migrate status` + `migrate diff --from-config-datasource --exit-code`, verificado localmente exit 0); paridade `WESTERN_SIGNS`Ã—`calculateZodiacSign` (366 dias 2028 + 12 datas de inÃ­cio); `analytics.ts` typed (`trackHoroscopeView(type, period)` uniÃµes, `VersosSource`/`UserPlan`/`SocialLimit` type-only imports); `instrumentation.ts` `getEnv()` fail-fast no boot (+teste REDIS_URL invÃ¡lido); `limits.ts` comentÃ¡rio attempt-vs-row (INFO-3); **eslint**: `no-console` warn allow error/warn + override off `prisma/**`/`scripts/**`/`auth.config.ts` â†’ `eslint .` 0 warnings; **deferred (decisÃ£o explÃ­cita)**: type-aware lint + regra `import/order` (sem dep direta `typescript-eslint`, churn repo-wide 33 arquivos â€” PR separado); **docs batch**: security.md (limites/CSRF/CSP/audit 9 vulns), moderation.md (cache), social.md (cursor/notificaÃ§Ãµes), overview.md (429 taxonomy/CSRF_TOKEN_INVALID), migrations.md v1.3 + Â§11, entities.md (contadores invariant, sync `plan`Ã—`subscriptionTier`, gap data civil `HoroscopeEntry` = gap do spec, CHECK versos), erros/observability/infrastructure/environments/erdÃ—4 (9 na chain), patterns path `tests/setup.ts`; `.env.example` + `CRON_SECRET`. **Gates (frescos, pÃ³s-docs)**: prettier --check âœ“ Â· eslint 0 warnings âœ“ Â· type-check âœ“ Â· suÃ­te completa âœ“ Â· `migrate status` 9 up-to-date âœ“ Â· `migrate diff` no drift âœ“.
- 2026-09-28 â€” **RegressÃ£o encontrada e corrigida na passada de gates frescos**: a suÃ­te completa falhou com **58 testes em 8 arquivos** â€” o gate `isBanned`/`deletedAt` adicionado ao `requireAuth` (`src/app/api/v1/users/_helpers.ts`) quebrava os mocks dos consumidores (model `user` ausente â†’ `TypeError` â†’ 500; `findUnique` sem stub â†’ `undefined` â†’ 401; objeto stub sem `deletedAt` â†’ `deletedAt !== null` = true â†’ 401). CorreÃ§Ã£o com contrato preservado (`tests/require-auth.test.ts` continua 4/4): lookup isolado em try/catch (throw â†’ **fail-open** com `logger.error`, documentado em `docs/07-security/security.md` Â§Guard de sessÃ£o), `user === null` â†’ 401, `deletedAt != null` â†’ 401, `isBanned` â†’ 403, `undefined` (impossÃ­vel no Prisma) â†’ segue. `tests/integration/arcana-calculate.test.ts` â€” teste "404 when user not found" sequenciado com `mockResolvedValueOnce` (gate vÃª a conta; lookup da rota nÃ£o â€” corrida). **Gates re-executados apÃ³s o fix**: prettier âœ“ Â· eslint 0 warnings âœ“ Â· tsc âœ“ Â· **suÃ­te completa 130 files / 2017 passed / 1 skipped âœ“**.
- 2026-09-28 â€” **Plan-sync â€” verificaÃ§Ã£o do batch contra `git diff HEAD` (staged + unstaged)**: as duas entradas acima foram conferidas item a item â€” **todos os claims checados batem com o cÃ³digo**: Sentry via `RouteError` (`Sentry.captureException` + teste S-N18 em `tests/components/route-error.test.tsx`), `CSRF_TOKEN_INVALID` (remoÃ§Ã£o de `buildCsrfSetCookieHeader`, check de `Origin` no middleware, interceptor `src/lib/api.ts`), nÃºcleo Ãºnico `checkSocialLimit`, cache por env em `moderation.ts`, gate `isBanned`/`deletedAt` (`_helpers.ts`, `tests/require-auth.test.ts` 4/4), cron `feed-cache-refresh` (`vercel.json` `*/5` + rota `Bearer CRON_SECRET`), matcher `proxy.ts`, CSP (`next.config.ts`/`vercel.json`), escape/aria `og-image.ts`, `mentions.ts`, backfill (`isDirectRun` + `maskEmail` + `--apply`), `versos.ts` 1-query/P2025 (12 testes = 5 `versos.test.ts` + 7 `gifts.test.ts`), migrations **#8 `20260927222620` + #9 `20260928004004`** (9 na chain), CI drift gate, paridade zodiac (366 dias de 2028 + 12 datas), `analytics.ts` unions, `getEnv()` no boot (+teste `REDIS_URL` invÃ¡lido), `no-console` no eslint, `error.tsx` Ã—6 com `RouteErrorProps` + `global-error.tsx` com `globals.css`, `.env.example` `CRON_SECRET`. **OmissÃµes dos dois entries (registradas aqui; entries anteriores nÃ£o reescritos)**: (1) **purga social LGPD do hard-delete** â€” `src/jobs/hard-delete-accounts.ts` (+`Follow`/`Post`/`Comment`/`PostLike`/`CommentLike`/`Gift` enviado/`Notification`/`ContentReport`/`HoroscopeEntry`/`HoroscopeLog`/`HoroscopeNotification` na mesma transaÃ§Ã£o; gifts recebidos ficam como ledger do doador) + `tests/hard-delete-accounts.test.ts` (+76) + `docs/04-api/authentication.md` + `docs/07-security/lgpd.md`; (2) `feed-algorithm.ts` â€” cursor com `include` de pinned adiados, `applyPinnedCap` â†’ `{page, dropped}`, validaÃ§Ã£o dura de `decodeFeedCursor`; (3) `feed-cache.ts` â€” schema zod do payload Redis (`z.coerce.date`) + `followingCount` opcional; (4) `queue/horoscope-queue.ts` â€” `getEnv()`/zod; (5) `use-horoscopes.ts` â€” `useMyHoroscope` â†’ `GET /horoscopes/my-horoscope` (T094/SC8/CHK018) + `horoscopeContentShape` compartilhado; (6) `src/lib/csrf-methods.ts` (mÃ³dulo sem deps p/ o bundle client) â€” o entry citava sÃ³ o interceptor; (7) cross-ref: o gate `requireAuth` altera comportamento de rotas do Sprint 1 (403 `AUTH_ACCOUNT_SUSPENDED`) â†’ entry de cross-reference em `docs/work-plans/20260921120000-sprint1-completion-work-plan.md`. **PrecisÃµes**: o docs batch cita "`erros/â€¦`" â€” nÃ£o existe doc `errors*` neste repositÃ³rio (a taxonomia de erros vive em `docs/04-api/overview.md`, jÃ¡ listado); o drift gate roda `migrate diff --from-config-datasource --to-schema prisma/schema.prisma --exit-code` (forma completa em `migrations.md` Â§11). **NÃ£o verificÃ¡veis neste plan-sync** (gates nÃ£o re-executados aqui): "9 relatÃ³rios em disco" (fora do git) e os totais de suÃ­te â€” recount local: **131** arquivos `tests/**/*.test.{ts,tsx}` no disco vs "130 files" do entry da regressÃ£o. **Master Checklist: nenhum item marcado** â€” nada desta passada fecha tasks de Phase 1+ (o diff nÃ£o contÃ©m rotas sociais/horÃ³scopo nem UI) e T001â€“T042 jÃ¡ estavam `[x]`; **permanecem `[ ]` de propÃ³sito**: T043â€“T050, T051â€“T065 (T052 feed, T058 rota og-image), T066â€“T075, T076â€“T089, T090â€“T103/T144â€“T145, T104â€“T109, T110â€“T117, T118â€“T125/T142â€“T143 (T121/T122 versos), T126â€“T130 (T128/T129 moderaÃ§Ã£o), T131â€“T146; em `docs/08-sprints/sprint-2.md` seguem `[ ]` os 9 "CritÃ©rios de Aceite" (decisÃ£o do dono de 2026-09-26) e as tasks 6/8/9/28/29/33/37/38 (parciais jÃ¡ justificados no entry da Phase 0.5).

---

- 2026-09-28 â€” **Phase 10 executada (T147â€“T148 âœ“) + pendÃªncias do clarify executadas (SC33/SC34 âœ“)**: **T147** `src/jobs/counter-reconcile.ts` (`COUNTER_RECONCILE_CRON = "0 4 * * *"`; dois `UPDATE ... WHERE divergente` com subquery `COUNT(*)` para `Post.likeCount`/`Post.commentCount`/`Comment.likeCount`; `$executeRaw` retorna rows corrigidas = idempotente) + rota `GET /api/cron/counter-reconcile` (pattern `Bearer CRON_SECRET` do `hard-delete`: 401/200 `no-store`/500) + entrada em `vercel.json` + **10 testes** (`tests/counter-reconcile.test.ts` 4: cron/summary/idempotÃªncia/SQL; `tests/cron-counter-reconcile.test.ts` 6: rota). **T148** `purgeExpiredReadings()` em `src/jobs/hard-delete-accounts.ts` â€” seleÃ§Ã£o `deletedAt â‰¤ nowâˆ’90d` **com** `readings: { some: {} }` (auto-esgota: conta sem leituras sai do where), transaÃ§Ã£o na ordem de FK **Interpretation â†’ ReadingCard â†’ Reading**, campo novo `readingsPurged` no `HardDeleteSummary`, try/catch no tick (falha de purge nÃ£o derruba a anonimizaÃ§Ã£o); janelas 30d (anonimizaÃ§Ã£o) e 90d (purge) coexistem; **+3 testes** (`tests/hard-delete-accounts.test.ts` â†’ 11: >90d purga com ordem de FK, 45d mantÃ©m, idempotÃªncia 2Âª execuÃ§Ã£o). **SC33** `retryAfter` (segundos) no body do 429 social ao lado de `resetAt` (`rate-limit.ts`) + asserÃ§Ã£o no teste bloqueado. **SC34** cron feed-cache `*/5` â†’ **`0 0 * * *`** â€” correÃ§Ã£o sobre a decisÃ£o original: a doc oficial da Vercel mostra que `0 * * * *` (per-hour) **tambÃ©m falha em Hobby**; dono consultado na execuÃ§Ã£o e confirmou diÃ¡rio; `FEED_CACHE_REFRESH_CRON` + teste atualizados. **Docs**: `infrastructure.md` (banner Hobby â†’ RESOLVIDO + bullet do counter-reconcile), `deployment.md` (3 crons no `.env.example` da tabela, `CRON_SECRET`), `overview.md` (lista de crons + summary `readingsPurged`/`{posts,comments,total}` + 429 social com `retryAfter` e taxonomia fechada), `social.md`/`security.md` (schedules), `entities.md` (I4(b) implementado), `lgpd.md` (retenÃ§Ã£o 90d â†’ `purgeExpiredReadings`), clarifications Q34 (execution resolution). **Gates frescos**: prettier write+check âœ“ Â· `eslint .` 0 problems âœ“ Â· tsc âœ“ Â· **suÃ­te completa 132 files / 2032 passed / 1 skipped âœ“** (+13 testes sobre a baseline 2019/130).

- 2026-09-28 â€” **Re-review (6 agentes) + correÃ§Ã£o dos achados**: re-review via `requesting-code-review` (kieran-typescript, code-simplicity, security-sentinel, nextjs-reviewer, doc-shepherd, plan-sync) sobre o batch Step 4/5. **Aplicado**: (1) `requireAuth` passou a ser **fail-closed** â€” lookup em try/catch prÃ³prio, **throw â†’ 503 `SERVICE_UNAVAILABLE`** (nunca 200 em pico de DB, nunca 401 que dispararia o refresh loop), contrato `null`/`deletedAt`â†’401 e `isBanned`â†’403 preservado, branch `undefined` (model sem stub) restrito a `!prisma.user?.findUnique` (impossÃ­vel em prod: schema garante `User`); teste novo em `tests/require-auth.test.ts` (5/5) e `docs/07-security/security.md` Â§Guard de sessÃ£o reescrito (era fail-open). (2) `next.config.ts` gate `has` accept `text/html` â†’ **`text/html.*`** â€” `has.value` vira regex ancorada `^â€¦$` e o Accept real do browser nunca casava: HSTS/nosniff/CSP **nunca eram emitidos** em self-hosted. (3) `account-service.ts`: enriquecimento projetava o profile inteiro no `.strict()` (sub/email/given_name rejeitavam) â†’ projeÃ§Ã£o `{name, picture}` antes do parse + teste com profile Google realista. (4) CI: **`prisma db execute --file prisma/ci/assert-integrity.sql`** fecha o blind spot do `migrate diff` (CHECKs/`NULLS NOT DISTINCT` nÃ£o modelados no `schema.prisma`): `RAISE EXCEPTION` se qualquer uma das 9 CHECKs escritas Ã  mÃ£o ou o Ã­ndice `NULLS NOT DISTINCT` de `HoroscopeContents` sumir â€” verificado positivo (exit 0) e negativo (exit â‰  0). (5) `limits.ts`: `bypass(â€¦, allowed)` â†’ `remaining` (o parÃ¢metro era um count) e `dailyFallback` recebe `userId` explÃ­cito (remove `key.split(":")`). (6) Removidos `isAuthTokenError` (export morto) e o re-export `CSRF_PROTECTED_METHODS` de `middleware/csrf.ts`; `global-error.tsx` usa `RouteErrorProps`. **Docs**: `overview.md` Â§CSRF_TOKEN_INVALID (enforceCsrf ainda sem rota consumidora), `security.md` Â§Helmet (CSP parcial: sÃ³ 4 diretrizes reais; nota do regex ancorado), `infrastructure.md` (drift gate + assertion; **banner risco Hobby Ã— cron `*/5`** â€” deploy falha em plano Hobby, decisÃ£o do dono). **Falso positivo**: o suposto override morto `scripts/**` do eslint **nÃ£o era morto** (`scripts/gen-og-image.cjs` Ã© lintado â€” o ignore `*.cjs` sÃ³ cobre a raiz) â†’ restaurado. **Gates frescos**: prettier âœ“ Â· `eslint .` 0 problems âœ“ Â· tsc âœ“ Â· suÃ­te **2019 passed / 1 skipped (130 files)** âœ“ Â· 9 migrations up-to-date âœ“ Â· `migrate diff` sem drift âœ“ Â· assertion SQL âœ“.

- 2026-09-28 â€” **Phase 1 concluÃ­da (T043â€“T050 âœ“, TDD)**: **T043** `POST /api/v1/social/follow/:userId` toggle (201 segue / 200 deixa de seguir, **sem DELETE** â€” SC35): `enforceSocialLimit({limit:"follow"})` 20/min + headers `X-RateLimit-*` â†’ 409 `CANNOT_FOLLOW_SELF` â†’ 404 `USER_NOT_FOUND` â†’ 409 `MAX_FOLLOWING_REACHED` (`User.maxFollowing` default 5000) â†’ 403 `FOLLOW_NOT_ALLOWED` com `details.reason` (SC36, sem `FollowRequest`) â†’ `$transaction` Follow + Notification(`type:"follow"`) â†’ `earnVersos(followerId, Follow)` +5 sÃ³ na criaÃ§Ã£o â†’ `{ data: { following, followingCount, followersCount } }`. **T044/T045** followers/following com shared `users/_follow-list.ts` + `src/lib/social/follow-lists.ts` â€” keyset cursor `encodeFeedCursor`/`decodeFeedCursor`, `?q=` case-insensitive, banido/soft-delete filtrados, perfil privado â†’ 404 anti-timing, default 20/mÃ¡x 50, envelope `{ data, pagination: { nextCursor } }` (S2-18) + `optionalAuth` novo em `users/_helpers.ts` (`isFollowing` por item quando autenticado). **T046** profile com `followersCount`/`followingCount` no root + `isFollowing` sÃ³ autenticado (SC37). **T047** `FollowButton` â€” optimistic update no cache `["profile", username]` (onMutate flipa, onError reverte, onSettled invalida), labels "Seguir"/"Seguindo". **T048** `useFollowList(username, side, q, enabled)` infinite query zod + `FollowersModal`/`FollowingModal` (debounce 300ms, `?q=`, "Carregar mais", empty states, role=dialog). **T049** `src/lib/social/privacy.ts` `canFollow(currentUser, targetUser)` lendo `UserProfile.privacy.whoCanFollow` (`all`|`following`|`nobody`). **T050** suÃ­te: `social-follow` 19 + `social-privacy` 7 + `public-profile` 6 + `follow-button` 6 + `followers-modal` 7. **Gates**: prettier âœ“ Â· `npx eslint .` 0 problems âœ“ Â· `tsc --noEmit` âœ“ Â· **`bun run test`: 2074 passed / 136 files** (baseline 2032/132 â†’ +42 testes / +4 arquivos). **Docs sincronizados**: `04-api/social.md`, `04-api/users.md`, `06-features/social.md`, `06-features/profile.md`, `08-sprints/sprint-2.md`. **DecisÃµes**: SC35â€“SC37 / Q35â€“Q37.

- 2026-09-29 - **Review multi-agent (9 agents) do Phase 1 + correcao de todos os achados aplicaveis ('fix all issues' concluido)**: sintese dos 9 relatorios (kieran-typescript, code-simplicity, rchitecture-strategist, learnings-researcher, 
extjs-reviewer, security-sentinel, gent-native, performance-oracle, lint) -> todos os Critical/Important aplicaveis corrigidos. **Bugs reais corrigidos**: (1) **ollowingCount/ollowersCount declarados dentro do callback do $transaction e usados fora** -> ReferenceError -> 500 em TODO toggle de follow (2 testes vermelhos; hoisted para let no escopo da rota); (2) **OR collision em ollow-lists.ts** (bug novo achado na verificacao): busca ?q= e keyset do cursor competiam pela mesma chave OR no mesmo literal - o cursor **sobrescrevia o filtro** (?q=ana&cursor=X ignorava q) -> grupos em AND: [{OR busca}, {OR keyset}] + teste combinado q+cursor (social-follow 20/20); (3) isFollowing invertido (C1, direcao viewer->item); (4) toggle reescrito (C2): $transaction unica + idempotencia P2002->201/P2025->200 + enforceCsrf + 
ate.headers em todo piError + gate isBanned/deletedAt no alvo + contadores dentro da tx; (5) optionalAuth ganhou gate isBanned/deletedAt (C3) + 	ests/optional-auth.test.ts 10 casos. **Fix-now de review**: HoroscopeType/HoroscopePeriod re-exportados das fontes no hook use-horoscopes (unions single-source); seed guard agora loga console.warn quando invocado via wrapper (skip em VITEST); 	rackVersosEarned **sem o 3o param alance** (dados financeiros fora de analytics + teste atualizado); comentario 'Node runtime / nunca em src/proxy.ts' nos docblocks de middleware/rate-limit.ts e middleware/csrf.ts. **Indices secundarios (review data N2)**: migration **#12 20260929142921_secondary_indexes_review** (comments_authorId_idx, post_likes_userId_idx, content_reports_reporterId_idx, horoscope_contents_type_period_date_idx) + contrato em 	ests/schema-sprint2.test.ts (+4 pares). **Docs 'document now'**: security.md (status CSRF **corrigido** - follow roda enforceCsrf; status optionalAuth **corrigido** - aplica gate; captura server-side de 
ate_limiter_bypass/csrf_failure e' log-only ate T136; nova secao Moderation fail-open + laggedWords; guardrail do linkify; env assertion NODE_ENV=production **avaliada e adiada = decisao do dono**), entities.md (padrao de debito condicional updateMany({versosBalance:{gte}}), decisao de cascades de Gift ate Versos virar monetario, contrato alidateHoroscopeContent), 
elationships.md (+3.17 ContentReport targetId polimorfico aceito), lgpd.md (+3 linhas de PII free-text), infrastructure.md (feed-cache sem invalidation - janela aceita <=5min ate T052; retencao horoscope_contents ~330 rows/dia -> cleanup Sprint 3+). **Registrado como deferred/skip com justificativa**: eslint type-aware + import/order (decisao explicita anterior, PR separado), boot assertion de producao (infra do dono), #7 OG dup (T058), #19 prompt injection (T093), #22 length caps (T057+), #6 cron tick lock (cadencia diaria), #23 4 advisories moderate (udit fix --force regride @vercel/og), #25 CSRF stateless (SameSite=Strict + __Host-). **Gates frescos**: prettier write+check ok Â· eslint . 0 problems Â· 	sc --noEmit ok Â· **suÃ­te completa 137 files / 2091 passed / 1 skipped** (baseline 2074/136 -> +17 testes) Â· **12 migrations up-to-date**.

- 2026-09-29 - **Re-review focada (2 agents: kieran-typescript + security-sentinel) + correcao dos IMPORTANTs**: 0 CRITICAL nos dois relatorios; 12 IMPORTANTs triados. **Aplicados (codigo)**: (1) **I1** - `canFollow` rodava ANTES da transacao para ambos os branches, entao um alvo que virava `whoCanFollow: "nobody"` impedia o EX-seguidor de dar unfollow (toggle virava beco sem sauda) -> checagem de `existingLink` movida para antes do gate: **unfollow nunca passa por `whoCanFollow`** (revogacao sempre possivel) + teste; (2) **K1/SC39** - contadores do toggle nao filtravam banidos/soft-deleted (profile e listas filtravam) -> helper `readFollowCounts()` em `follow-lists.ts` agora usado pelo toggle, profile e corridas (clarification Q2/SC39 fechada); (3) **K2** - `earnVersos` retornando `null` sem UserProfile deixava o marker FollowReward commitado sem pagamento -> null agora aborta a tx (throw) ; re-follow com marker existente nao paga de novo (teste); (4) **K3/S5** - handlers P2002/P2025 **assumiam qual constraint falhou** (nao sabiam se era follow ou FollowReward) -> re-quer `follow.findUnique` (fonte de verdade) e responde conforme o estado real + try/catch interno no catch (erro na re-query vira 500 JSON com rate headers, nunca HTML) + 3 testes de corrida; (5) **I2** - `rate.headers` faltando no 401 do viewer e no 500 final; (6) **I3/S3** - `meta.requestId` retornava o **userId cru do alvo** em 3 pontos de `profile/route.ts` (copy-paste); (7) **I4/K5/SC38** - listas `followers`/`following` agora respondem **404 para nao-dono** quando `statsVisibility: "private"` (showStats false) + teste; (8) **Q1 profile** - "sÃ³ o dono vÃª" implementado: com `statsVisibility: "private"` o dono autenticado ve os contadores, nao-dono nao ve (antes NINGUEM via) + 2 testes; (9) **K4** - `findVisibleProfile` loga `logger.warn` quando o privacy JSON falha no safeParse (404 fail-closed mudo -> observavel) + **arquivo de teste novo `tests/find-visible-profile.test.ts` (9 casos**: anti-timing, ban, soft-delete, privacy invalido, showStats); (10) **K6** - 11 testes de headline adicionados em `social-follow.test.ts` (unfollow vs nobody, re-fold sem pagamento, corridas P2002/P2025, falha na re-query, filtro ban nas contagens, alvo banido 404, 401 com headers, SC38 listas); (11) contrato `schema-sprint2` + `FollowReward` (model + `@@unique`). **Documentado como pendencia de design (nao implementado - exige decisao do dono)**: **I6** `profileVisibility: "private"` nao vale no write path do toggle (seguir perfil privado responde 201 enquanto o profile responde 404 anti-timing) e **I7** listas GET sem rate limit (sem politica/valores decididos) -> `docs/04-api/social.md` Â§Limitacoes conhecidas. **Docs**: `social.md` (SC38 implementado + 404 com statsVisibility + limitacoes), `users.md` (Q1 escalacao do dono implementada). **Gates frescos**: prettier write+check ok Â· eslint . 0 problems Â· tsc --noEmit ok Â· **suÃ­te completa 138 files / 2115 passed / 1 skipped** (baseline 2091/137 -> +24 testes / +1 arquivo).

- 2026-09-29 - **Pre-commit: suite inteira OOM no `bun run test` do dono -> fix no script de test**: o dono reportou `bun run test` falhando antes do commit â€” **`FATAL ERROR: Zone Allocation failed - process out of memory`** num worker tinypool + `ERR_IPC_CHANNEL_CLOSED`, exit 1 com 27/139 arquivos e **zero falha de assercao** (344/344 testes que rodaram passaram). Causa raiz = **mesma classe ja documentada do build** (`docs/solutions/ci-cd/turbopack-postcss-oom.md`, fix do build de 2026-09-23): RAM livre ~1 GB de 7.8 GB no Node v24, OOM intermitente do allocator de zona â€” o script `test` era so `vitest run`, sem o heap flag que o `build` ja usa; as suites verdes da sessao so passavam porque `NODE_OPTIONS=--max-old-space-size=4096` era setado manualmente. **Fix (mesmo padrao do repo, sem cross-env)**: `package.json` `test` = `node --max-old-space-size=4096 node_modules/vitest/vitest.mjs run` e `test:coverage` idem com `--coverage` (tinypool forks herdam `execArgv` -> workers recebem o cap). **Ciclo TDD**: Red = execucao do dono com OOM (2 tentativas de repro limpas posteriores falharam em reproducir â€” intermitente, condizente com a classe documentada); Green = `bun run test` com o script novo -> **138 files / 2115 passed / 1 skipped, exit 0** (+ smoke `vitest.mjs --version` + prettier check). **Docs**: `turbopack-postcss-oom.md` +secao "Recurrence: test suite (2026-09-29)", `infrastructure.md` + `environments.md` (build/test heap flag). Sem mudanca de codigo de aplicacao.

- 2026-09-29 â€” **Plan-sync â€” entry "Re-review focada" (acima) verificado contra `git diff HEAD` (staged + unstaged) + gates re-executados**: **os 11 itens de cÃ³digo batem com o cÃ³digo atual** â€” (1) I1: `existingLink` (`follow.findUnique`) Ã© lido ANTES do gate `canFollow` em `social/follow/[userId]/route.ts` (unfollow nunca passa por `whoCanFollow`) + teste "unfollow nÃ£o Ã© bloqueado por whoCanFollow"; (2) `readFollowCounts()` em `src/lib/social/follow-lists.ts` chamada pelo tx do toggle, pelo `profile/route.ts` e pelos handlers de corrida; (3) `earnVersos === null` â†’ `throw` dentro do tx (rollback do marker) + teste de re-follow sem novo pagamento; (4) P2002/P2025 re-querem `follow.findUnique` com try/catch interno â†’ 500 JSON + `rate.headers` (3 testes de corrida); (5) `rate.headers` no 401 do viewer e nos 500 (+2 testes); (7) `_follow-list.ts` â†’ 404 `USER_NOT_FOUND` p/ nÃ£o-dono com `statsVisibility: "private"`; (8) Q1: `optionalAuth` antes do bloco de stats, dono autenticado vÃª contadores (+2 testes em `tests/public-profile.test.ts`); (9) `logger.warn` no `safeParse` falho de `findVisibleProfile` + `tests/find-visible-profile.test.ts` (9 casos); (10) `social-follow.test.ts` = **31** testes (+11) e `schema-sprint2.test.ts` = **48** (+`FollowReward` model e `@@unique`); (11) I6/I7 confirmados **nÃ£o implementados** (toggle sem checar `profileVisibility`; listas GET sem `enforceSocialLimit`) e documentados sÃ³ como pendÃªncia em `docs/04-api/social.md` Â§LimitaÃ§Ãµes conhecidas. **Gates frescos re-executados**: `prettier --check .` âœ“ Â· `npx eslint .` 0 problems âœ“ Â· `tsc --noEmit` âœ“ Â· `bun run test` **138 files / 2115 passed / 1 skipped** âœ“ â€” idÃªnticos aos declarados no entry (baseline 2091/137 confirmada). **PrecisÃµes/omissÃµes (entry acima mantido intacto; correÃ§Ãµes sÃ³ nesta entrada)**: (a) item (6) I3/S3 â€” `profile/route.ts` tinha **3** usos de `visible.profile.userId`, mas sÃ³ **2** sÃ£o `meta.requestId` (404 `USER_NOT_FOUND` e 500 `INTERNAL_ERROR`); o 3Âº era o campo `reqId` de `logger.error({ err, reqId })`; (b) item (7) I4/SC38 â€” "**+ teste**" sÃ£o **2 testes** ("404 para anÃ´nimo quando statsVisibility Ã© private" e "dono autenticado vÃª a prÃ³pria lista mesmo com statsVisibility private"); (c) **mudanÃ§a de cÃ³digo nÃ£o citada em nenhum entry**: `FollowDenyReason` ganhou `privacy_invalid` em `src/lib/social/privacy.ts` (privacy JSON invÃ¡lido em `canFollow` nega com reason distinta em vez de `privacy_nobody`) + 1 teste novo em `tests/social-privacy.test.ts` (â†’ 8); (d) **docs deste batch tambÃ©m incluem** `docs/06-features/profile.md` (Q1/SC38 + Â§Pendente do `ProfileStats` reescrito), `docs/06-features/social.md` (status 2026-09-29 com notas da re-review) e `docs/07-security/permissions.md` (T043 como consumidor do follow limit), alÃ©m dos `04-api/{social,users}.md` citados; (e) a alegaÃ§Ã£o "users.md substituiu o aviso 'nÃ£o implementada'" â€” os avisos removidos estavam em `docs/06-features/profile.md` ("seguidores/seguindo nÃ£o implementados") e no status de `docs/04-api/social.md` ("rotas ainda nÃ£o implementadas"); `users.md` ganhou o bloco SC38/Q1, a nota âš ï¸ de `requireStatsVisibility` e a linha 404 atualizada; (f) `docs/04-api/social.md` Â§Status dizia "social-follow.test.ts (20 casos)" e jÃ¡ estÃ¡ "(31 casos, incl. 3 de corrida)" no estado final. **Master Checklist Phase 1 (T043â€“T050 + gates)**: jÃ¡ estava integralmente `[x]` antes desta passada â€” nenhum checkbox precisou ser alterado; status da fase segue âœ… Done. **MÃ©todo**: `git diff HEAD` nÃ£o separa este batch do batch "Review multi-agent" anterior (ambos uncommitted, Ã­ndice parcial) â€” a verificaÃ§Ã£o foi feita pelo conteÃºdo atual dos arquivos. **NÃ£o hÃ¡ work-plan de Sprint 2 em `docs/work-plans/`** (sÃ³ existe o do Sprint 1).

- 2026-10-01 â€” **Phase 2 executada (T051â€“T065 âœ“, TDD)**: **TDD Redâ†’Green por fatia** (Red escrito antes de cada componente/rota; fix `feed-algorithm.ts` S2-15: comparava `"PRIVATE"` vs contrato lowercase `"private"` â†’ predicado exportado `hasPrivateProfile`). **Backend**: `POST /social/posts` (Zod por tipo 500/300/200, moderaÃ§Ã£o â†’ **403 `CONTENT_BLOCKED` + `details.flaggedWords`** (decisÃ£o do dono), transaÃ§Ã£o Post+PostHashtag, `earnVersos` p/ reading, daily 10/50 via `enforceSocialLimit`, CSRF, `apiError` 500 + `logger.error`); `GET /social/feed` (envelope `{data, pagination}`, cache + 4 tiers S2-5, headers `private, no-store` + `Vary: Authorization`); explore `trending`/`hashtags`/`suggestions` (**janela 7d, score likes+2Ã—comments, limit 20**; autores `profileVisibility='private'` excluÃ­dos fail-closed; **PROFESSIONAL primeiro, depois followersCount** â€” decisÃµes do dono) e `GET /social/search` (qâ‰¥2, S2-15); `GET /social/posts/:id` + `og-image` com predicado compartilhado **`src/lib/social/post-visibility.ts`** (`canViewPost`/`postIsGated`, comentÃ¡rios raÃ­zes+replies lote 10, anti-timing 404 uniforme); `POST /posts/images/presign` (Content-Length â‰¤5MBÃ—n, keys `posts/{userId}/{ts}-{i}.{ext}` jpegâ†’jpg, envelope `{uploads}`, rate headers). **Frontend**: `use-feed.ts` (T062: `useFeed` com `pendingPosts`+`flushPending` Q27, `useCreatePost` invalida `["feed"]`, `useTrending`/`useExploreSuggestions`/`useSearch` qâ‰¥2), `ShareModal` (T063: `/post/{id}`, download og-image com Bearer, Web Share, X/WhatsApp/Facebook), `PostCard` (T059: `formatRelativeTime` exportado, `linkifyMentionsHashtags` escapado, like/coment `aria-disabled` atÃ© T076/T077, `NEXT_PUBLIC_R2_PUBLIC_URL` p/ resolver chaves R2), `PostComposer` (T060: abas+contadores 500/300/200, menÃ§Ã£o @ debounce 300ms â†’ `/social/search`, hashtag # â†’ top10, validaÃ§Ã£o client-side jpeg/png/webp â‰¤5MB â†’ presign+PUT, audience/commentsDisabled; CSRF via interceptor `authApi` T028), `FeedPage` (T061: IntersectionObserver sentinel + `fetchNextPage`, pull-to-refresh touch, barra criaÃ§Ã£o rÃ¡pida, skeleton/empty CTA `Criar publicacao`/erro retry, pill "N novos posts" com dedup por id; **sem link `/explorar` no empty state â€” rota ainda nÃ£o existe (Phase 8)**). **T065 desvio documentado**: cobertura de integraÃ§Ã£o dividida em `social-feed.test.ts` (50: POST/feed/detail/OG/presign incl. daily limit `trackPostLimitHit("FREE",10)` e audience) + `social-explore.test.ts` (19: trending/hashtags/suggestions/search) + `feed-algorithm.test.ts` (24) + suÃ­tes de componentes/hooks (post-card 8, share-modal 6, post-composer 11, feed-page 7, use-feed 10) em vez de um Ãºnico arquivo. **?type= do feed adiado** + doc pendente (`04-api/social.md`). **Gates frescos**: `prettier --check .` âœ“ Â· `npx eslint .` 0 problems âœ“ Â· `tsc --noEmit` âœ“ Â· **`bun run test`: 146 files / 2261 passed / 1 skipped âœ“** (baseline 137/2091 â†’ +9 arquivos / +170 testes).

- 2026-10-01 â€” **RevisÃ£o pÃ³s-Phase 2 (kieran-typescript + security-sentinel) aplicada**: `toPublicPost` (strip `isBanned/deletedAt/isActive/profile.privacy` do autor) em feed cache+live/trending/search/detalhe; detalhe com headers `private, no-store`+`Vary: Authorization` (sucesso e erros) e comentÃ¡rios filtrando autores banidos/soft-deleted; `hasPrivateProfile` fail-closed via `parsePrivacy` + `logger.warn`; `imageUrls` exige o formato exato do presign `posts/{userId}/{ts}-{i}.{jpg|png|webp}` (bloqueia traversal â€” antes sÃ³ `startsWith`); `q` de busca â‰¤ 50; `isActive: true` nos filtros de autor (feed/trending/hashtags/search); whitespace-only â†’ 422; FeedPage: erro com dados jÃ¡ carregados mantÃ©m lista + banner inline; composer: insert de hashtag case-insensitive, aba Imagem exige chave de upload, parse zod de presign/create (removes `any`), type predicates; `flushPending` puro (sem `setState` no updater); `use-feed`: `likeCount`/`commentCount` required; share-modal com `toast.error` na falha do download; og-image: `optionalAuth` dentro do `try`; docstrings corrigidos (autor nÃ£o vÃª post oculto/banido) + `docs/04-api/social.md` (chave presign completa, qâ‰¤50, whitespace, headers/projeÃ§Ã£o, presign **nÃ£o autoritativo** + **pendÃªncia de decisÃ£o do dono** sobre validaÃ§Ã£o pÃ³s-PUT). **Adiados** (registrados na triagem): purge de cache OG (H-4), rate-limit/memo da og-image (H-5, dono), `isProfessional` no author (I-3), objetos R2 Ã³rfÃ£os (I-9), colisÃ£o de key (I-10), quota por imagem vs por chamada (I-8), escape/focus-trap de diÃ¡logos, duplicaÃ§Ã£o client/server de constants. Gates pÃ³s-fixes: prettier âœ“, eslint âœ“, tsc âœ“, **146 files / 2269 passed** (+8 testes novos: fail-closed privacy, traversal, whitespace, q>50, hashtag maiÃºscula, aba Imagem, banner de erro).

- 2026-10-01 â€” **RevisÃ£o TDD pÃ³s-fusÃ£o das vars pÃºblicas do R2** (`R2_PUBLIC_URL` + `NEXT_PUBLIC_R2_PUBLIC_URL` â†’ apenas `NEXT_PUBLIC_R2_PUBLIC_URL`): bug real corrigido â€” string vazia nÃ£o caÃ­a no fallback (`??` â†’ `||`) em `src/lib/r2.ts` e `src/components/social/post-card.tsx`; `avatar/route.ts` (DELETE) deixou de ler `process.env` inline e passou a importar o export de `@/lib/r2`; `.env` local renomeado (chave Ã³rfÃ£ `R2_PUBLIC_URL` â†’ `NEXT_PUBLIC_R2_PUBLIC_URL`, valor preservado). **Testes novos**: `tests/r2.test.ts` (3), `tests/r2-env-contract.test.ts` (3 â€” guarda de nome antigo + `.env.example` + rota avatar), +1 em `tests/env.test.ts`, +3 em `tests/components/post-card.test.tsx` (+2 removidos/ajustados em `tests/integration/avatar.test.ts`: linha morta de env removida). **Docs corrigidos**: `docs/environments.md` (1 var), `docs/02-architecture/deployment.md` (entrada Ãºnica + tabela), `docs/04-api/social.md`, `docs/glossary.md` (`R2_BUCKET_NAME`), `.env.example` (comentÃ¡rio de validaÃ§Ã£o). Gates: prettier âœ“, eslint âœ“, tsc âœ“, `bun run test` **148 files / 2279 passed / 1 skipped**.

- 2026-10-01 â€” **Plan-sync â€” Phase 2 consolidada + fix waves W4â€“W8 (execuÃ§Ã£o detalhada nos 3 entries 2026-10-01 acima; esta entrada registra o sync dos documentos)**: **Phase 2 implementada (T051â€“T065)** â€” rota de feed (cache Redis, semÃ¢ntica de pÃ¡gina cheia), CRUD de posts (`POST` com CSRF + rate limit social + `refreshFeedCache(authorId)` na criaÃ§Ã£o), detalhe do post, `og-image` (cache por viewer: pÃºblico 200 `public, max-age=3600, s-maxage=86400` sem `Vary`; gated/404/500 â†’ `private, no-store` + `Vary: Authorization`), busca (keyset `(createdAt, id)`, privacidade fail-closed, hashtags `take` 10Ã—), explore (`trending`/`suggestions`/`hashtags`), UI `FeedPage` + `PostCard` + `PostComposer` (presign em lote) + `ShareModal` (`useSession`) + hook `use-feed`. **Fix waves W4â€“W8**: (a) cache do feed **nÃ£o Ã© mais fatiado pelo `limit`** (hit serve a pÃ¡gina materializada com o `nextCursor` como pivot do algoritmo â€” cortar reencodava pelo Ãºltimo do ranking e duplicava/pulava posts) + `refreshFeedCache(authorId)` apÃ³s criar post; (b) avatar: `enforceCsrf` em `presign` + `confirm` + `DELETE /users/me/avatar` (**6 rotas consumidoras de CSRF no total** â€” o work summary cita "5 rotas", contagem anterior ao DELETE entrar na W4â€“W8; ver `07-security/security.md` Â§CSRF) + `enforceSocialLimit({limit:"upload"})` em presign/confirm (`confirm` valida tamanho via `headObjectSize()` antes de baixar â€” review C3); (c) presign de posts: checagem de `Content-Length` **removida** (morta â€” media o JSON do request, nÃ£o a imagem; 5MB Ã© guard do PUT assinado; pendÃªncia S2-12 = HEAD pÃ³s-PUT) + ext canÃ´nica `EXT_BY_TYPE` single source (`src/lib/validators/social.ts`); (d) `og-image`: fix de `Vary` (pÃºblico sai **sem** `Vary` para nÃ£o fragmentar o CDN por sessÃ£o; gated â†’ `private, no-store`; 404/500 â†’ `private, no-store` + `Vary: Authorization`); (e) headers de erro `private, no-store` + `Vary: Authorization` em **todas** as rotas sociais (feed/search/posts/:id/explore); (f) busca: cursor keyset estÃ¡vel em lotes (predicado `private` pÃ³s-fetch â€” `take` Ãºnico devolvia pÃ¡ginas curtas), hashtags com `take = 10Ã—`, privacidade fail-closed nos resultados; (g) `src/lib/r2-public-url.ts` single source (`getR2PublicUrl()`/`r2KeyFromPublicUrl()`, consumido por `r2.ts`, avatar e `post-card.tsx`); (h) `feedPostSchema` com `z.string().datetime()` + enums (`src/hooks/use-feed.ts`). **Gates verdes**: suÃ­te completa **148 arquivos / 2279 passed / 1 skipped**, `tsc --noEmit` âœ“, `prettier --check .` âœ“, `eslint .` 0 problems âœ“. **Docs**: `04-api/social.md`, `04-api/users.md`, `07-security/security.md`, `06-features/social.md`, `infrastructure.md` + varredura doc-shepherd (`05-ai/moderation.md`, `07-security/permissions.md`, `04-api/overview.md`, `environments.md`, `02-architecture/deployment.md`, `02-architecture/scalability.md`, `glossary.md`, pattern `set-csrf-cookie-client-side.md`). **Checklists**: Master Checklist Phase 2 (T051â€“T065 + gates de fase) `[x]`, `**Status**: âœ… Done` na seÃ§Ã£o da fase **e linha da tabela Implementation Plan sincronizada (estava `â¬œ Pending`)**; `checklists/security.md` marca **CHK002** (cobertura CSRF â€” lista canÃ´nica das 6 rotas incl. avatar/presign), **CHK005** (OG de conteÃºdo restrito â†’ 404 anti-timing + `private, no-store`), **CHK006** (presign: content-type confiado, bytes **nÃ£o** revalidados p/ PUT = limitaÃ§Ã£o documentada, expiraÃ§Ã£o 300s, sÃ³ autenticado+CSRF), **CHK011** (moderaÃ§Ã£o: 403 `CONTENT_BLOCKED` + `details.flaggedWords` informa o autor â€” decisÃ£o do dono) e **CHK014** (expiraÃ§Ã£o 300s + permissÃµes via `NEXT_PUBLIC_R2_PUBLIC_URL`); demais itens CHK permanecem `[ ]` de propÃ³sito (read paths de polling/comentÃ¡rios e writes de like/comment/gift ainda nÃ£o existem â€” Phase 2.5/3+/7).

- 2026-10-02 â€” **Phase 2.5 executada (T066â€“T075 âœ“) + plan-sync â€” WebSocket Foundation (branch `sprint2-f2`, mudanÃ§as nÃ£o commitadas)**: **Escopo**: (1) **`socket-service/`** novo â€” `index.ts` + `src/server.ts` (Socket.io porta 3003 `SOCKET_PORT`, CORS restrito a `AUTH_URL`, `GET /health`, auth middleware â†’ `socket.data.userId`, rooms `user:`/`feed:` com auto-join no connect + `room:join`/`room:leave` on-demand para `post:`/`comment:` via regex `CLIENT_JOIN_ROOM`, Redis adapter `@socket.io/redis-adapter` sÃ³ com `REDIS_URL`, dedupe por socket no relay Event Busâ†’rooms), `src/auth.ts` (jose `jwtVerify` RS256), `src/bus.ts` (Event Bus pub/sub + fallback in-memory sem `REDIS_URL`), `src/emitters.ts` (T070: `emitNewPost`/`emitLikeUpdated`/`emitCommentAdded`/`emitCommentLikeUpdated`/`emitFollowUpdate`/`emitNotification`/`emitGiftReceived` + interfaces typed), `src/lib/env.ts` (T069: Zod `REDIS_URL`/`SOCKET_PORT`/`AUTH_URL`/`JWT_PUBLIC_KEY`), `Dockerfile` (T067: `node:20-alpine`, healthcheck `wget -qO- /health`), `ecosystem.config.js` (T068: PM2 cluster `instances: 'max'`, ADR-007); (2) **polling Ã—4** (T071: `social/polling/{posts,likes,comments,notifications}/route.ts` GET `?since=` + `polling-utils.ts` compartilhado); (3) **`src/hooks/use-socket.ts`** (T072: singleton com `SocketStatus`, auth via `resolveAccessToken`/`getSession`, auto-join `user:`/`feed:`, `post:`/`comment:` sob demanda, backoff `reconnectionDelayMax` 1sâ†’30s, fallback polling 30s suprimido quando conectado, typed `SocketHandlers`); (4) **`NotificationsProvider`** (T073: context `unreadCount`, evento `notification`, badge no AppHeader com `data-testid="unread-notifications-badge"`, montado no `(app)/layout.tsx`); (5) **`useFeedRealtime`** em `use-feed.ts` + ligaÃ§Ã£o no `FeedPage` â€” listener `new-post` â†’ `GET /social/posts/:id` â†’ `emitPendingPost` (dedup por id, pilha da pill Q27/T061); (6) **T088 parcial puxado para a Phase 2.5 (pull-forward)**: `POST /social/posts` â†’ `emitNewPost` para rooms dos seguidores pÃ³s-commit + rota de follow (T043) â†’ `emitFollowUpdate`/`emitNotification` (race handler emite sÃ³ `emitFollowUpdate` apÃ³s rollback); (7) **testes**: `tests/integration/websocket.test.ts` (T074) + `websocket-server`/`websocket-relay`/`realtime-bus`/`polling`/`social-realtime-wiring`, `tests/unit/socket-env` + `socket-deploy-contract`, `tests/hooks/use-socket` + `use-feed-realtime`, `tests/components/notifications-provider`; (8) **E2E T075** `tests/e2e/social-realtime.spec.ts` â€” **3 cenÃ¡rios reais passando** (postâ†’pill "1 novo post" via WS em 2 contexts; followâ†’notification+badge "1" no AppHeader; WS bloqueadoâ†’fallback polling 30s + reconexÃ£o) + **3 `test.fixme` documentados** (like/comment/gift dependem das rotas da Phase 3 â€” T076/T077/T120).
**Desvio de spec**: auth do socket valida o access token com **`JWT_PUBLIC_KEY` RS256 (ADR-009)** â€” mesma chave pÃºblica usada por `token-service.ts` â€” e nÃ£o `JWT_SECRET` como o texto de T069 sugeria; contrato das 4 vars Zod preservado e a troca estÃ¡ comentada no prÃ³prio `socket-service/src/lib/env.ts`.
**Bugs corrigidos na validaÃ§Ã£o**: (a) `emitNewPost` emitia para as rooms de **quem o autor segue** em vez das rooms **dos seguidores** â€” contrato de teste atualizado REDâ†’GREEN (`social-realtime-wiring.test.ts`: "post criado publica new-post para as rooms dos seguidores"); (b) `"use client"` em `src/lib/analytics.ts` quebrava as rotas de servidor que chamam `track*` no dev Turbopack (**500 em `POST /social/posts`**) â€” diretiva removida; (c) helpers E2E: client Prisma 7 passa a usar o adapter **`PrismaPg`** e forÃ§a `DATABASE_URL` lido de `.env.local` (o `next dev` carrega `.env.local`, o processo do Playwright nÃ£o â€” mesmo banco sob teste); (d) `.env.local` ganhou `AUTH_URL=http://localhost:3000` â€” fecha loop de login do NextAuth por divergÃªncia de nome de cookie secure/non-secure.
**Infra E2E**: `playwright.config.ts` â†’ `webServer` **Ã—2** (`npm run dev` + `npm run dev:ws` com healthcheck `/health` na 3003, ambos com `REDIS_URL` + keys JWT â€” Event Bus em memÃ³ria nÃ£o cruza processos, ADR-007/Â§6.4); init script de consent-banner (`localStorage.setItem("analytics-consent","false")`) para o backdrop nÃ£o interceptar cliques; register rate limit in-memory **3/60min por processo** (`MAX_REGISTER_IP_ATTEMPTS`/`REGISTER_IP_WINDOW_MS`) contornado no `registerUser` dos helpers (reusa usuÃ¡rio existente + fallback de `emailVerified`).
**PendÃªncias registradas**: (1) `room:join` de `post:`/`comment:` valida sÃ³ o formato da room (regex) â€” **sem checagem de visibilidade** do post/comentÃ¡rio no join; (2) eventos emitidos com o cliente offline **nÃ£o tÃªm catch-up pÃ³s-reconexÃ£o** (polling fica suprimido enquanto conectado â€” janela de perda atÃ© o prÃ³ximo evento); (3) warning `missing 'error' handler on this Redis client` nos clients ioredis do Redis adapter em `server.ts` (`bus.ts` jÃ¡ trata `error`, o adapter nÃ£o); (4) E2E `test.fixme` de like/comment/gift atÃ© as rotas da Phase 3.
**Gates frescos re-executados no plan-sync**: `prettier --check .` âœ“ Â· `npx eslint .` 0 problems âœ“ Â· `tsc --noEmit` âœ“ Â· `bun run test` **159 files / 2359 passed / 1 skipped** âœ“ Â· `npx playwright test tests/e2e/social-realtime.spec.ts` **3 passed / 3 skipped (fixme)** âœ“ â€” idÃªnticos aos declarados na execuÃ§Ã£o (a saÃ­da do webServer do E2E confirma o warning do item 3 acima).
**Master Checklist Phase 2.5 (T066â€“T075 + gates de fase) `[x]`** e **tasks detalhadas da seÃ§Ã£o Phase 2.5 `[x]`**, `**Status**: âœ… Done` na seÃ§Ã£o da fase **e linha da tabela Implementation Plan** (estava `â¬œ Pending`). **NÃ£o hÃ¡ work-plan de Sprint 2 em `docs/work-plans/`** (sÃ³ existe o do Sprint 1).

- 2026-10-03 â€” **Phase 2.5 â€” "fix all issues (incl. informationais)" da revisÃ£o de cÃ³digo executado (TDD REDâ†’GREEN em todas as fatias, gates verdes; branch `sprint2-f2`, mudanÃ§as nÃ£o commitadas) + plan-sync**: **Fatias concluÃ­das â†’ mapeamento para os IDs do plano**: (a) **I-a** janela de polling â€” `src/lib/social/polling-window.ts` (`POLLING_DEFAULT_SINCE_MS` = 5 min, `POLLING_TAKE` = 50) + `?until=` (drenagem de backlog; ISO invÃ¡lido â†’ **422**) em `polling-utils.ts` e nas 4 rotas + cursor `since`/`until` no cliente â†’ **T071/T072**; (b) **I-b** `socket-service/Dockerfile` com base pinada `node:20.20.2-alpine3.23` (sem tag flutuante), `package.json`/`package-lock.json` dedicados do serviÃ§o (`npm ci --omit=dev`, runtime `USER node`) + `tests/unit/lockfile-sync.test.ts` â†’ **T067**; (c) **I-c** teste de fronteira do mini-service `tests/unit/socket-service-boundary.test.ts` (marcadores `[fronteira I-c]` em `emitters.ts`/`bus.ts`) â†’ **T066/T074**; (d) **I-d** `socket-service/src/auth.ts`: `jwtVerify` com `maxTokenAge` + `clockTolerance` + cache de `KeyObject` (`publicKeyCache`) â†’ handshake tolera troca de `JWT_PUBLIC_KEY` â†’ **T066**; (e) **I-e** WARN de build em `next.config.ts` (`NODE_ENV=production` sem `NEXT_PUBLIC_WS_URL`) + `tests/next-config-ws-warn.test.ts` + seÃ§Ã£o "Build time" de `docs/02-architecture/deployment.md` â†’ **sem task no plano** (infra de build; WARN, nÃ£o erro, porque o CI builda sem a var de propÃ³sito); (f) **X** harness `tests/integration/websocket-harness.ts` + suÃ­tes `websocket*` reescritas sobre ele â†’ **T074/T075**; (g) **W-extras** docs: `security.md` (consumidor extra da pÃºblica + rate limit `polling` 60/min por usuÃ¡rio), `architecture.md`, `observability.md` (health `GET /health` minimalista; mÃ©tricas de WS seguem planejadas), runbook `jwt-public-key-missing-all-401.md`, `docs/08-sprints/sprint-2.md` (blockquote de status), `.prettierignore` (comentÃ¡rio: `docs/`/`.specs/` fora do prettier) e gates do plano `npx vitest run` â†’ **`bun run test`**; (h) **U** badge mobile `data-testid="unread-notifications-badge-mobile"` + `MobileNav` montado em `src/app/(app)/layout.tsx` dentro do `NotificationsProvider` â†’ **parcial de T133/T134**; (i) **epoch-race** em `src/hooks/use-socket.ts` (`connectWanted` + religaÃ§Ã£o no finally; montaâ†’cleanupâ†’re-monta do StrictMode) + 2 testes â†’ hardening de **T072**; (j) **auto-heal do Event Bus** em `socket-service/src/bus.ts`: `ensureRedis` detecta cliente morto (`status end|close`) e refaz, reconector do sub em `close`/`end` com backoff 1sâ†’30s e mÃ¡x 5 falhas sob flag `busShuttingDown` + 4 testes novos em `tests/integration/realtime-bus.test.ts` â†’ hardening de **T066**; (k) **E2E** `tests/e2e/social-realtime.spec.ts` com testid Ãºnico do badge (evita strict-mode violation do locator).

**Desvios / nÃ£o planejados**: (1) **epoch-race do `use-socket` e auto-heal do `bus.ts` foram descobertas durante o E2E da fase** (ECONNRESET no sub do adapter Redis; double-mount do StrictMode) â€” nenhuma task os previa; (2) **migraÃ§Ã£o `20261003015407_polling_reverse_lookup_indexes_review_r`** (`CREATE INDEX CONCURRENTLY` p/ reverse-lookup das rotas de polling) â€” fora do plano, derivada de T071; (3) **I-e nÃ£o tem task** no plano; (4) infra nÃ£o listada em tasks: `socket-service/package.json`+lock, `src/lib/socket-url.ts`, `src/lib/social/post-preview.ts`, `tests/integration/websocket-harness.ts`; (5) **U entregue apenas em parte** (ver itens nÃ£o marcados abaixo). **Observado no diff desta branch e nÃ£o atribuÃ­do a esta sessÃ£o**: `socket-service/src/room-access.ts` (**RevisÃ£o M**) estÃ¡ ligado ao `room:join` (`verifyRoomAccess` â†’ ack `room_forbidden`), o que **endereÃ§a a pendÃªncia (1) do entry 2026-10-02** (`comment:{id}` segue fail-open atÃ© T077); alÃ©m disso existem `handshake-limit.ts` (rate limit de handshake 60/min por IP), `redis-auth.ts` (cache de `tokenVersion`, fail-open â€” o processo nÃ£o tem Prisma) e `event-schemas.ts` (validaÃ§Ã£o dos payloads emitidos).

**Master Checklist / tasks**: **T088 `[x]`** (task list da Phase 3 + Master Checklist) â€” todas as clÃ¡usulas da task comprovadas no cÃ³digo: `emitFollowUpdate`/`emitNotification` pÃ³s-commit em `social/follow/[userId]/route.ts` (T043, inclusive no handler de corrida apÃ³s rollback), `emitNewPost` pÃ³s-commit em `social/posts/route.ts` (T051) para as rooms dos seguidores, contrato com `socket-service/src/emitters.ts` (T070) e **sem** emits duplicados de like/comment/gift (escopo de T076/T077/T120); cobertura em `tests/integration/social-realtime-wiring.test.ts`. Ã‰ o mesmo "T088 parcial (pull-forward)" do entry 2026-10-02 â€” agora integralmente coberto pelo texto da task. **NÃ£o marcados**: **T133** (MobileNav continua com 4 tabs Home/Tirar/HistÃ³rico/Perfil â€” sem Explorar/NotificaÃ§Ãµes/Presentes) e **T134** (bell + badge no AppHeader existem, mas **sem dropdown**; o dropdown Ã© T086, pendente) â€” ambos apenas parciais; **T066â€“T075 e os gates da Phase 2.5 jÃ¡ estavam `[x]`** desde o plan-sync de 2026-10-02 e permanecem `[x]` (esta sessÃ£o sÃ³ os reforÃ§ou); demais fases intactas (rotas de like/comment/notifications/gifts e pÃ¡ginas de notificaÃ§Ãµes/busca/presentes nÃ£o existem no tree). **Status da Phase 3 permanece `â¬œ Pending`** (seÃ§Ã£o e tabela Implementation Plan) â€” sÃ³ o pull-forward T088 foi entregue, nenhuma execuÃ§Ã£o da fase comeÃ§ou.

**Gates (2026-10-03, re-executados no plan-sync)**: `npx eslint .` **0 problems** âœ“ Â· `npx tsc --noEmit` **exit 0** âœ“ Â· `npx playwright test tests/e2e/social-realtime.spec.ts` **3 passed / 3 skipped (fixme), exit 0** âœ“ (a saÃ­da do webServer ainda loga `missing 'error' handler on this Redis client` â€” pendÃªncia (4) abaixo segue aberta). **`bun run test` â€” DIVERGÃŠNCIA**: a execuÃ§Ã£o declarou **173 files / 2494 passed / 1 skipped, exit 0**; as **3** re-execuÃ§Ãµes do plan-sync terminaram **174 files = 172 passed + 1 failed + 1 skipped; 2493 passed / 2495 no total**, sempre com **`tests/unit/playwright-config.test.ts` â€º "gera par RS2256-efÃªmero quando o ambiente nÃ£o fornece chaves" â†’ `Test timed out in 5000ms`**. Ã‰ timeout, nÃ£o asserÃ§Ã£o: a geraÃ§Ã£o do par RSA dentro do import de `playwright.config.ts` leva **4454ms quando o teste roda isolado (passa, exit 0)** e estoura os 5000ms do `testTimeout` default sob a carga da suÃ­te completa â€” reproduzido 3/3. NÃ£o Ã© regressÃ£o do cÃ³digo desta sessÃ£o.

**PendÃªncias conhecidas**: (1) **3 E2E `test.fixme`** (like/comment/gift) atÃ© T076/T077/T120; (2) **rotaÃ§Ã£o de keypair** â€” `JWT_PRIVATE_KEY`/`JWT_PUBLIC_KEY` sÃ£o estÃ¡ticas, **rotaÃ§Ã£o recomendada ao usuÃ¡rio** (a revisÃ£o I-d sÃ³ torna o handshake *tolerante* Ã  troca da chave, nÃ£o rotaciona); (3) **`useUnreadCount` com fonte dupla (NotificationsProvider + hook de notificaÃ§Ãµes) adiada a T083**; ~~(4) warning `missing 'error' handler on this Redis client` dos clients ioredis do Redis adapter~~ âœ… **2026-10-04 (review multi-agente)**: `server.ts` agora tem `.on("error")` em `pub`/`sub` do adapter (`server.ts:123-126`, alÃ©m de `bus.ts:128/135` e `redis-auth.ts:35`) e a saÃ­da do E2E de 2026-10-04 **nÃ£o loga mais o warning**; (5) timeout frÃ¡gil de `playwright-config.test.ts` (subir o `testTimeout` ou baratear a geraÃ§Ã£o da par â€” fora do escopo do plan-sync; **mesma classe observada em 2026-10-04**: 1Âª execuÃ§Ã£o do `bun run test` pÃ³s-fixes teve 5 timeouts sob carga, ex. `auth-config.test.ts:63` >5s â€” verde isolado e em 2 execuÃ§Ãµes seguidas); (6) seguem do entry 2026-10-02: catch-up de eventos emitidos com cliente offline e `comment:{id}` sem checagem de visibilidade (fail-open atÃ© T077).

- 2026-10-04 â€” **RevisÃ£o multi-agente (11 agentes) da Phase 2.5 + correÃ§Ã£o de todos os CRITICALs em TDD (branch `sprint2-f2`, mudanÃ§as nÃ£o commitadas) + plan-sync**: **Review** (`/pwf-review` sobre `sprint2-f2` vs `main`: kieran-typescript, code-simplicity, architecture-strategist, security-sentinel, data-integrity-guardian, schema-drift-detector, deployment-verification, nextjs-reviewer, pattern-recognition, workflow/lint, learnings-researcher â€” diff 62 commitados + 112 staged = 152 arquivos). **6 CRITICALs â†’ 5 corrigidos (TDD REDâ†’GREEN) + 1 de workflow**: (1) **`format:check` do CI vermelho (25 arquivos)** â†’ `bun run format` aplicado, `prettier --check .` exit 0; (2) **architecture C-1** â€” reconector do `bus.ts` morria na 1Âª falha (guard `sub !== subClient` anulava o retry nos dois sites, docs prometiam 1sâ†’30s/mÃ¡x 5) â†’ guard `subClient !== null && sub !== subClient` em `scheduleBusReconnect` (schedule + timer) + teste real-timer "2a tentativa de reconexao acontece mesmo se a 1a falhar" (`realtime-bus.test.ts`); (3) **architecture C-2** â€” rejeiÃ§Ã£o de namespace (`CONNECT_ERROR`) chama `destroy()` (limpa subs â†’ socket.io **nÃ£o** religa) e o catch/token-nulo morriam silenciosos â†’ `connect_error` handler com backoff manual 1sâ†’30s (`rate_limited` â†’ 60s; erros de transporte ficam com o Manager â€” `next.active`), retry no catch/token-nulo quando `connectWanted`, timers/failures zerados em `release()`/`resetRealtimeClient()`/`resetSocketManagerForTests()`; +5 testes em `use-socket.test.tsx`; (4) **data-integrity C1** â€” `resolveSince` sem teto â†’ full scan por poll â†’ clamp `POLLING_MAX_SINCE_MS` = 24h em `polling-window.ts` (decisÃ£o: **clamp, nÃ£o 422** â€” cursor velho se auto-cura; ceiling sÃ³ em `since` futuro/poller) + 2 testes + 3 testes de data fixa (2026-10-01) migrados p/ relativos; (5) **nextjs C1** â€” prod sem `NEXT_PUBLIC_WS_URL` caÃ­a no `localhost:3003` do dev-default (vazaria access token no handshake) e o WARN do `next.config.ts` prometia throw inexistente â†’ `resolveSocketUrl(raw, nodeEnv)` devolve **`null`** em produÃ§Ã£o (realtime desabilitado, `connect()` no-op + `console.error`, polling cobre), WARN/documentaÃ§Ã£o reescritos para o comportamento real; +11 testes (`socket-url` prod/dev, `use-socket` prod, warn message); (6) **pattern C1 (workflow)** â€” 112 arquivos staged nÃ£o commitados + PR #364 jÃ¡ merged + `main` local stale â†’ **sem cÃ³digo; aÃ§Ã£o pendente: `/pwf-commit-changes` + PR novo** (commit sÃ³ com pedido explÃ­cito). **Docs sincronizados**: `04-api/social.md` Â§polling (teto 24h + identificadores `INITIAL_CURSOR()`/`postsCursor`/`notificationsCursor`), `02-architecture/deployment.md:281/296` e `architecture.md:451/452` (contrato prod-null, retry de namespace, clamp 24h), `architecture.md:453` (warning de error handler marcado resolvido â€” ver pendÃªncia 4), `solutions/patterns/testing/e2e-realtime-harness.md` (identificadores obsoletos `INITIAL_SINCE_MS`/`lastPollSince` corrigidos) e comentÃ¡rio de `tests/e2e/social-realtime.spec.ts`. **~25 IMPORTANTs Ãºnicos** (dedup 11â†’1) registrados na sÃ­ntese e **pendentes para `/pwf-work`** â€” prioridade seguranÃ§a (XFF spoofÃ¡vel `handshake-limit.ts:17-23`, `room:join` fail-open `room-access.ts:30-41`, revogaÃ§Ã£o em cache miss, presign sem teto) â†’ realtime/client (pill sem re-agenda, `gt` exclusivo perde mesmo ms, `SocketData` morto, envelope triplo) â†’ UX (`/feed` sem entrada de navegaÃ§Ã£o CHK009). **Gates frescos**: `prettier --check .` âœ“ Â· `eslint .` 0 âœ“ Â· `tsc --noEmit` âœ“ Â· `bun run test` **174 files / 2509 passed / 1 skipped, exit 0** (2 execuÃ§Ãµes seguidas; ver pendÃªncia 5 p/ a 1Âª execuÃ§Ã£o) âœ“ Â· `npx playwright test tests/e2e/social-realtime.spec.ts` **3 passed / 3 fixme, exit 0** âœ“. **ObservaÃ§Ã£o**: `playwright test` completo roda **58 specs** e 17 falham por dependÃªncia de ambiente (seed/estado de DB) â€” specs fora do gate desta fase, falhas prÃ©-existentes nÃ£o relacionadas a estes fixes. **Nenhuma task nova do plano** foi marcada (revisÃ£o de cÃ³digo, nÃ£o entrega de fase); Phase 3 segue `â¬œ Pending`.

- 2026-10-04 â€” **`/pwf-work` â€” correÃ§Ã£o dos ~25 IMPORTANTs deduplicados da revisÃ£o multi-agente em TDD (branch `sprint2-f2`, mudanÃ§as nÃ£o commitadas) + plan-sync**: **Ordem executada**: seguranÃ§a â†’ realtime/client â†’ API/UX â†’ consistÃªncia (TDD REDâ†’GREEN em todas as fatias com teste novo). **SeguranÃ§a**: **S1** `socket-service/src/handshake-limit.ts` â€” em prod usa sÃ³ o ÃšLTIMO XFF (hop de proxy confiÃ¡vel; atrÃ¡s de Cloudflare+Railway sempre hÃ¡ XFF; nÃ£o-prod continua address-only) + `tests/unit/handshake-limit.test.ts` 10/10; **S2** `room-access.ts` fail-closed (`boolean | null` â†’ deny-unless-allowed), `room:join` valida ANTES de entrar e corrida "reserve-slot-before-await" corrigida em `server.ts` + 7 arquivos/48 testes; **S3** `warmTokenVersionMirror` com SET NX em `signAccessToken` (bounce do token novo nunca regredir o mirror mais novo) + `tests/token-service.test.ts` 33/33; **S4** presign size-cap (HeadObject/5MB) **ADIADO â€” decisÃ£o S2-12 do dono** (pergunta ao final). **Realtime/client**: **A1** `gt â†’ gte` nas 4 rotas de polling (fronteira de mesmo ms nÃ£o perde mais o item-limite), likes ganha filtro `user` ativo/banido/soft-delete, posts ganha `take: POLLING_FOLLOW_TAKE` = 500 (paridade `MAX_FANOUT_FOLLOWERS`, exportado de `polling-utils.ts`), teste "integridade A1" â†’ `tests/integration/polling.test.ts` 21/21; **R1** `use-feed` â€” o lote do pill que falha re-agenda sozinho (`FEED_REALTIME_RETRY_MS` = 3 s, nÃ£o martela o bucket `polling` 60/min) + cursor `advanceSinceCursor(requestedAt, serverTime)` (min â€” anti-skew, espelha `pollingCursor`) â†’ hooks 25/25; **R2 (5/5)**: `bus.ts` `safeParse` tipado (event string, rooms array nÃ£o-vazio, payload presente; extraÃ§Ã£o `handleBusMessage` + `handleBusRawForTests`; 24/24), `SocketData` virou o 4Âº genÃ©rico de `Server`/`Socket` (`declare module` Ã³rfÃ£o removido, casts `as string` mortos), `emit<E extends RealtimeEventName>` tipado, envelope de polling com zod em `use-socket` (`pollingEnvelopeSchema`/`pollingItemSchema` â€” malformado = falha: cursor intocado, sem eventos; teste "envelope malformado conta como falha") e **`ACCESS_TOKEN_TTL_SECONDS` validado no boot do socket** (`socket-service/src/lib/env.ts` com paridade do `validatedEnvNumber` do token-service â€” antes `process.env` cru em `auth.ts`, fora da "fonte Ãºnica"; valor passado a `verifySocketToken(token, pem, ttl)`, `maxTokenAge` parametrizado; `.env.example` + `deployment.md` + `architecture.md` documentam que os DOIS processos precisam do mesmo valor). **API/UX (UX1)**: aba **Feed** no AppHeader (6 itens) e no MobileNav (5 tabs) â€” CHK009 `/feed` alcanÃ§Ã¡vel a partir do login (`AppNavHref` + `isAppNavActive` ganham `/feed`); MobileNav troca `pathname === item.href` por `isAppNavActive` (subrotas como `/tiragem/:id` nÃ£o apagam mais o tab ativo); composer aberto silencia o pull-to-refresh (o modal renderiza dentro do `<main>` com os handlers, sem portal â€” teste "composer aberto: pull-to-refresh nÃ£o dispara refetch") +7 testes novos. **ConsistÃªncia**: `socket-service-boundary.test.ts` com lista DERIVADA DO DISCO (arquivo novo do closure entra na varredura sozinho â€” a hardcoded podia ficar obsoleta) + guarda "1 pino sÃ³"; logger consolidado em `socket-service/src/lib/logger.ts` (era 3Ã— `pino({ name: "socket-service" })` idÃªnticos em bus/server/redis-auth); docs drift de `gt â†’ gte` corrigido em `polling-utils.ts` e `docs/04-api/social.md` ("relaÃ§Ã£o estrita `>` sem sobreposiÃ§Ã£o" â†’ inclusiva `>=` + dedup por id; tabela ganhou `POLLING_FOLLOW_TAKE`/filtros liker e autor) + docs de navegaÃ§Ã£o (`profile.md`, `sprint-1.md`). **Gates frescos**: `prettier --check .` 0 Â· `eslint .` 0 Â· `tsc --noEmit` 0 Â· `bun run test` **174 files + 1 skipped / 2534 passed / 1 skipped, exit 0** Â· `npx playwright test tests/e2e/social-realtime.spec.ts` **3 passed / 3 fixme, exit 0** (1Âª execuÃ§Ã£o do teste da pill falhou por flake conhecido de polling â€” reexecuÃ§Ãµes isolada e do arquivo inteiro verdes). **Perguntas abertas p/ o dono ao final**: (1) S4 presign size-cap, (2) rotaÃ§Ã£o de keypair, (3) wording original do "polling bucket dispute", (4) interpretaÃ§Ã£o de "redis config duplication".

- 2026-10-04 â€” **`/pwf-work` (continuaÃ§Ã£o pÃ³s-perguntas) â€” S4 size-cap do presign + helper Redis compartilhado em TDD + docs + gates (branch `sprint2-f2`, mudanÃ§as nÃ£o commitadas) + plan-sync**: **DecisÃµes do dono**: S4 = implementar agora; "redis config duplication" = extrair o padrÃ£o configure/resolve duplicado; "polling bucket dispute" = coberto (retry 3s + bucket compartilhado `polling` 60/min), descartado; prÃ³ximo passo = `/pwf-doc-capture`. **S4 (S2-12 resolvida)** â€” TDD RED (2 falhas) â†’ GREEN: `POST /social/posts` valida a chave (`posts/{userId}/{ts}-{i}.{ext}`) e entÃ£o faz `headObjectSize()` por imagem; `> 5MB` (`MAX_IMAGE_BYTES` em `posts/route.ts`, mesmo limite do avatar) â†’ 422 `VALIDATION_ERROR` "Imagem muito grande. Maximo 5MB." (`details.field=imageUrls` + `rate.headers`), `post.create` nunca Ã© chamado; `null` (objeto ausente) segue o caminho normal â€” padrÃ£o `avatar/confirm`, **sem re-baixar** o objeto. +3 testes em `tests/integration/social-feed.test.ts` (mock `@/lib/r2` ganhou `headObjectSize` â†’ 57/57), incluindo "chave gigante entre vÃ¡lidas â†’ 422". ComentÃ¡rio do `presign/route.ts` e docs atualizados (`docs/04-api/social.md`: item 4 + Fluxo S2-12 + etapa 5 da criaÃ§Ã£o + tabela 422; `docs/06-features/social.md` nota W4â€“W7): a "pendÃªncia HEAD pÃ³s-PUT" virou a checagem na criaÃ§Ã£o do post. **ConsistÃªncia (Redis)** â€” TDD RED (mÃ³dulo inexistente) â†’ GREEN: `socket-service/src/lib/redis-url.ts` exporta `createRedisUrlResolver()` â€” estado **por instÃ¢ncia** (bus e auth configuram/resetam independentemente; `process.env.REDIS_URL` sÃ³ quando nunca configurado); `bus.ts` (`configureBusRedis`/`resetRealtimeBus`) e `redis-auth.ts` (`configureRedisAuth`/`resetRedisAuthForTests`) delegam ao helper (flags/`configuredUrl` duplicadas removidas) + 5 testes novos em `tests/unit/socket-redis-url.test.ts`; regressÃ£o `redis-auth-config.test.ts` 3/3 + `realtime-bus.test.ts` 24/24. **Gates finais**: `prettier --check .` 0 Â· `eslint .` 0 Â· `tsc --noEmit` 0 Â· `bun run test` **176 files (175 passed + 1 skipped) / 2542 passed / 1 skipped, exit 0** (1Âª execuÃ§Ã£o: 1 timeout de carga em `auth-config.test.ts:63` â€” classe jÃ¡ documentada na pendÃªncia (5); verde isolado e na re-execuÃ§Ã£o completa) Â· E2E `social-realtime.spec.ts` com `BASE_URL`/`PORT`=3001 (porta 3000 ocupada por processo externo `bun ./dist/index.mjs`, nÃ£o do repo): 2 passed + 1 failed = flake conhecido `:216` (pill de polling â€” passou isolado em 1.1m) + 3 fixmes; rerun completo do arquivo interrompido pelo usuÃ¡rio.

- 2026-10-05 — **Phase 3 executada (T076–T089 ✓, TDD; branch `sprint2-f2.5`, mudanças não commitadas vs `f9a833e`) + plan-sync + doc-shepherd**: **Rotas** — **T076** `POST /social/posts/:id/like` (bucket `like`; 403 `SELF_LIKE`; toggle + `Post.likeCount` na MESMA `$transaction` S2-19 com re-querida no handler de corrida; notification anti-flood ao autor; `earnVersos` 1; emits `like-updated` + 
otification; resposta {data:{liked,likeCount}}); **T077** POST /social/posts/:id/comments (bucket comment; Zod content ≤300; 403 COMMENTS_DISABLED/WHO_CAN_COMMENT; parent de outro post → 422; tx com commentCount +1 e Notification ao autor do post **e** do comentário pai; earnVersos 2; emits; 201 {data:{comment}}); **T078** GET no mesmo arquivo (cursor keyset, default 10, replies aninhados 1 nível, envelope {data:[...],pagination:{nextCursor}}, headers private, no-store); **T079** PATCH /social/comments/:id (404 COMMENT_NOT_FOUND uniforme anti-enumeration, janela de 15min → 403 COMMENT_EDIT_EXPIRED, bucket comment); **T080** DELETE (soft delete "[removido]" via REMOVED_COMMENT_CONTENT em src/lib/social/comments.ts + commentCount −1 na MESMA tx; idempotente 404; **sem** janela de tempo); **T081** POST /social/comments/:id/like (toggle + Comment.likeCount na tx, emitCommentLikeUpdated, {data:{liked,likeCount}}; sem notification/versos/analytics/self-block, conforme spec); **T082** GET /social/notifications (cursor, filtros isRead + unreadOnly com precedência de unreadOnly, limit 1–50 default 20, envelope {data:{notifications,unreadCount},pagination:{nextCursor}}, rows crus, sem rate limit); **T083** PATCH .../:id/read (updateMany com ownership → {data:{read:true}}, 404 NOTIFICATION_NOT_FOUND, sem bucket); **T084** PATCH .../read-all ({data:{updated:count}}, sem bucket). **Frontend** — **T085** CommentSection + wiring no PostCard (like otimista via overlay do SocialStore, toggle de comentários, commentsDisabled inert); **T086** NotificationsDropdown (badge unread, lista, mark-as-read); **T087** SocialStore (client state: unreadCount, 
otifications, helpers otimistas); **T088** wiring realtime completo (follow T043, posts T051, like/comment T076/T077 — sem duplicatas); **T089** integration tests (	ests/integration/social-interactions.test.ts — 47 testes: like toggle + auto-like 403, comments CRUD + commentsDisabled 403 + limits, comment like contagem, notifications criadas, rate limits, earnVersos). **Gates verdes**: prettier --check . 0 · 
px eslint . 0 problems · 	sc --noEmit 0 · un run test **2643 passed** · 
px playwright test **5 passed / 1 skipped** (gift T120 	est.fixme). **Decisões abertas documentadas**: (1) checkContent para comentários — hoje só no POST de posts; pendente avaliar se aplica a comments (T077) — registrado em docs/04-api/social.md §Moderação; (2) bucket de rate limit para notificações — GET /notifications sem bucket; PATCH /read e /read-all sem bucket; decisão: manter sem rate limit (baixo risco, leitura/escrita própria) — registrado em docs/04-api/social.md §Rate limits; (3) **rotação de keypair (pendência 2)** — JWT_PRIVATE_KEY/JWT_PUBLIC_KEY estáticas; handshake tolera troca (I-d 2026-10-03) mas não há automação de rotação — registrado em docs/07-security/security.md §JWT; (4) **gift T120** — 	est.fixme no E2E; rota POST /gifts/send pendente (Phase 7). **Desvio conhecido**: NotificationsDropdown badge revertido para **polling 30s** (via useUnreadCount + SocialStore) para estabilidade dos testes unitários; atualização real-time do badge via WebSocket diferida (requer useUnreadCount unificado com NotificationsProvider — T083/T132). **Flakiness conhecida E2E**: testes WebSocket de follow/like/badge têm timing flakiness inerente (race entre emit e assert) — mitigado com waitFor + retry, mas não eliminado; documentado em 	ests/e2e/social-realtime.spec.ts. **Phase 3 → ✅ Done** (seção, tabela Implementation Plan, Master Checklist). **T134** (bell + badge + dropdown) permanece [x] no Master Checklist.---

## Next Steps

1. ~~`/pwf-checklist`~~ âœ… (91 itens CHK: 88 originais + CHK017/018 analyze + CHK019 clarify)
2. ~~`/pwf-analyze`~~ âœ… (Go, CRITICAL=0; remediation aplicada â†’ v6)
3. ~~`/pwf-clarify`~~ âœ… (Q25â€“Q29 â†’ v7)
4. ~~`/pwf-work-plan docs/plans/20260926120000-sprint2-execution-plan.md Phase0`~~ âœ… **Phase 0 executada (T001â€“T023)** â€” gates lint/type-check/1781 testes âœ“; docs sincronizados (doc-shepherd + plan-sync); Steps 4â€“5 concluÃ­dos
5. ~~Phase 0.5~~ âœ… **Phase 0.5 executada (T024â€“T042)** â€” gates lint/type-check/1975 testes âœ“; seed 1328 fallbacks idempotente; deps novas `bullmq` + `@vercel/og`; docs sincronizados (Step 4/5)
6. DÃ©bito pÃ³s-Phase 7: doc-shepherd atualizar `docs/06-features/gifts.md` e `docs/04-api/social.md` (catÃ¡logo/terminologia desatualizados â€” S2-4); divergÃªncias jÃ¡ banneradas: catÃ¡logo de gifts (4 vs 9 itens, moeda, body) e tipos de notificaÃ§Ã£o (6 vs 8) â€” conjunto canÃ´nico fecha com T036/T025
7. ~~DecisÃ£o pendente do dono de docs~~ âœ… **2026-09-26 respondido**: os 9 "CritÃ©rios de Aceite do Sprint" de `docs/08-sprints/sprint-2.md` foram desmarcados (com nota datada) por decisÃ£o do dono â€” serÃ£o re-marcados conforme as fases entregarem
8. ~~DÃ©bito menor: `.env.example` nÃ£o declara `CRON_SECRET`~~ âœ… **2026-09-28 (review)**: `CRON_SECRET` adicionada ao `.env.example` (seÃ§Ã£o Cron) + `environments.md`/`infrastructure.md`/`security.md` atualizados â€” a var protege `hard-delete` **e** `feed-cache-refresh`

