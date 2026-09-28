# Clarifications — Sprint 2 Execution Plan

## Source Plan
- `docs/plans/20260926120000-sprint2-execution-plan.md` (v7 — IDs T001–T146)

## Session 2026-09-26

### Q1: WebSocket: serviço separado ou integrado no Next.js?
- Recommendation: Serviço separado na porta 3003 para escala independente
- Final Answer: **Serviço separado (porta 3003)** — escala independente, não bloqueia Next.js; Redis adapter obrigatório para horizontal scaling; deploy separado via script próprio
- Impact on Plan: Adicionar `socket-service/` folder; T066–T070 cobrem setup completo (server, Dockerfile, PM2, env, emitters)

### Q2: Horóscopo conteúdo: IA gera tudo ou templates + IA?
- Recommendation: Híbrido — templates base + IA para variação diária
- Final Answer: **Híbrido: templates base + IA para variação diária**; cron job batch (sem streaming) gera `HoroscopeContent` com TTL 30 dias; fallback template se IA falhar
- Impact on Plan: T097 cron + T098 worker; `HoroscopeContent` cache; fallback templates T032 usados por T093 (western), T106 (chinês), T113 (maia) e pelo worker T098

### Q3: Kin Maya: reutilizar `calculateKinMaya` ou reimplementar?
- Recommendation: Reutilizar código existente do Sprint 1
- Final Answer: **Reutilizar `src/lib/calculations/kin-maya.ts` (Sprint 1 T020)** e expandir com 20 Selos, 13 Tons, Onda Encantada
- Impact on Plan: T110 expande arquivo existente; T023 verifica export; não reimplementa algoritmo base

### Q4: Gifts: catálogo fixo ou dinâmico?
- Recommendation: Catálogo fixo de 6 gifts para MVP
- Final Answer: **Fixo (6 gifts definidos no seed)**: Estrela Cadente (10), Rosa Mística (25), Cristal (50), Bola de Cristal (100), Coroa Astral (200), Dragão Dourado (500); preços **fixos em código (T036), sem env var** (corrigido no /pwf-analyze 2026-09-26 — SC4 prevalece sobre a menção de env var)
- Impact on Plan: T017 seed data com 6 gifts SPEC-007 exatos; T120 valida custo contra catálogo T036

### Q5: Feed algorithm: cursor vs offset?
- Recommendation: Cursor-based pagination para performance estável
- Final Answer: **Cursor-based** (opaque string base64 encoded); evita skip caro em datasets grandes; performance consistente
- Impact on Plan: T052 usa cursor; T061 IntersectionObserver carrega próximo cursor; T044/T045 listas seguidores também cursor

### Q6: Notificações: apenas in-app ou push também?
- Recommendation: In-app only para MVP; push em Sprint 3
- Final Answer: **In-app only (MVP)**; WebSocket `notification` event atualiza badge + dropdown; push delegado para Sprint 3
- Impact on Plan: T073 (provider), T082–T084 (API), T086 (dropdown) in-app only; T102 notificação de horóscopo in-app

### Q7: Compatibilidade ocidental: matriz fixa ou IA?
- Recommendation: Matriz fixa 12x12 predefinida
- Final Answer: **Matriz fixa 12x12** (tabela predefinida em código); IA apenas para horóscopo diário (conteúdo)
- Impact on Plan: T090 matriz estática em `src/lib/horoscopes/western-compatibility.ts` (seed T038); sem chamada IA

### Q8: Horóscopo my-horoscope: agrega os 3 sistemas?
- Recommendation: Endpoint único retorna os 3
- Final Answer: **Sim — endpoint único** `GET /api/v1/horoscopes/my-horoscope` retorna `{ western, chinese, mayan }` do usuário logado para período atual; agrega via libs (`src/lib/horoscopes/*`), não via HTTP das rotas das Fases 5/6
- Impact on Plan: T094 endpoint agregado; evita 3 requests no frontend e dependência de fase

### Q9: Rate limits para social features?
- Recommendation: Limits por feature com tiers FREE/PLUS
- Final Answer: **Posts 10/dia (free), 50/dia (Plus); Likes 100/min; Comments 30/min; Follow 20/min; Gifts 10/dia; Uploads 4/post; Horoscopes ilimitado (cached)**
- Impact on Plan: T027 (única casa, `src/lib/social/limits.ts`) + middleware T040; aplicado em T043 (follow), T051 (posts), T064 (upload), T076 (like), T077 (comments), T081 (comment like), T120 (gifts)

### Q10: OG Image para posts: sharp SVG→PNG ou html-to-image?
- Recommendation: Sharp SVG→PNG (consistente com reading OG image Sprint 1 T050)
- Final Answer: **Sharp SVG→PNG** — mesmo pattern de `src/app/api/v1/readings/[id]/og-image/route.ts`; template SVG 1200x630
- Impact on Plan: T029 cria utilidade (sharp); T058 endpoint usa `generatePostOgImage`; template com avatar, nome, conteúdo, imagens do post

### Q11: Comentários aninhados: quantos níveis?
- Recommendation: 1 nível (resposta a comentário pai)
- Final Answer: **1 nível apenas** (resposta direta a comentário pai); `parentCommentId` opcional; UI com indentação visual
- Impact on Plan: T077 valida `parentCommentId` pertence ao mesmo post; T078/T085 listam e renderizam nested 1 nível

### Q12: Moderação de conteúdo: escopo MVP?
- Recommendation: Lista de palavras bloqueadas + report endpoint
- Final Answer: **Lista bloqueadas + report**; `checkContent()` retorna `{ allowed, flaggedWords }`; `POST /api/v1/social/report` cria report para review manual
- Impact on Plan: T025 `src/lib/moderation.ts` + report endpoint T128 + integração T129; sem IA de moderação no MVP

### Q13: IA fallback para horóscopo: template ou erro?
- Recommendation: Template fallback
- Final Answer: **Template fallback** — se IA falhar no cron job, usa template padrão do seed; loga erro para retry manual
- Impact on Plan: T098 worker fallback; T032 templates no seed

### Q14: Versos earnings: onde hookar?
- Recommendation: Em cada ação
- Final Answer: **Em cada ação**: like (T076), comment (T077), follow (T043), reading creation (Sprint 1) chamam `earnVersos(userId, source)`
- Impact on Plan: T037 `earnVersos()` + wiring T123

### Q15: WebSocket fallback polling: endpoints?
- Recommendation: REST endpoints dedicados
- Final Answer: **REST endpoints dedicados** para polling: `/posts?since=`, `/likes?since=`, `/comments?since=`, `/notifications?since=`
- Impact on Plan: T071 (4 route files em `src/app/api/v1/social/polling/`)

### Q16: Error handling no App Router: ErrorBoundary ou error.tsx?
- Recommendation: Next.js App Router `error.tsx`/`global-error.tsx`
- Final Answer: **Next.js App Router `error.tsx`/`global-error.tsx`** por route segment; não class ErrorBoundary
- Impact on Plan: T039 cria `error.tsx` por segment

### Q17: Subscription tier para posts: como verificar?
- Recommendation: User.subscriptionTier (FREE/PLUS/PREMIUM)
- Final Answer: **User.subscriptionTier** (FREE/PLUS/PREMIUM); `checkPostLimit(userId)` tier-aware em `src/lib/social/limits.ts` chamado em T051
- Impact on Plan: T014 migration (`subscriptionTier`) + T027 limit check

### Q18: Feed performance para >1000 following?
- Recommendation: Materialized view/cache
- Final Answer: **Materialized view/cache** refrescado a cada 5 min via cron job
- Impact on Plan: T030 feed-cache + T042 cron job

### Q19: Horóscopo push notifications: como enviar?
- Recommendation: Cron job 07:00 BRT
- Final Answer: **Cron horário (BRT) com filtro `HoroscopeNotification.hour`** — default 7 (07:00 BRT), configurável por usuário (RF-HORO-008); notificação in-app por sistema habilitado
- Impact on Plan: T102 cron `0 * * * *` cria `Notification` rows; T103 API/UI de settings (RF-HORO-008)

### Q20: Horóscopo AI interpretation: como integrar?
- Recommendation: Mesmo pipeline SPEC-004
- Final Answer: **Mesmo pipeline SPEC-004** (SSE streaming) via `POST /api/v1/ai/horoscope-interpret`
- Impact on Plan: T101 endpoint; T117 página de interpretação

### Q21: Horóscopos e Explore públicos para visitante (sem login)?
- Recommendation: MVP autenticado; público em Sprint 3+
- Final Answer: **MVP autenticado** — páginas vivem em `src/app/(app)` (layout redireciona para `/login`); UC-005 tem pré-condição "usuário autenticado"; acesso público (route group `(public)`) fica Sprint 3+
- Impact on Plan: AC-9/AC-10/AC-11/AC-13 Roles removido `Visitante` (S2-13); sem task de route group público

### Q22: Upload de imagens dos posts (RF-SOC-003)?
- Recommendation: Presign R2 reutilizando pattern do avatar
- Final Answer: **Presign R2** — `POST /api/v1/social/posts/images/presign` reutiliza `generatePresignedUrl` de `src/lib/r2.ts`; máx 4 imagens, JPEG/PNG/WebP, ≤5MB cada; PUT direto ao R2; keys `posts/{userId}/…`
- Impact on Plan: T064 (presign), T060 (cliente PUT), T051 (valida `imageUrls`), T022 (vars R2 no env), AC-23

### Q23: Onde vive a privacidade de follow (`whoCanFollow`)?
- Recommendation: Reutilizar `UserProfile.privacy` do Sprint 1
- Final Answer: **`UserProfile.privacy.whoCanFollow`** (gravado por `src/app/api/v1/users/me/privacy/route.ts` + UI `privacy-settings.tsx`); sem novo campo `User.privacySettings` (split-brain)
- Impact on Plan: T014 não adiciona `privacySettings`; T049 (`canFollow`) e T043 leem `UserProfile.privacy`; AC-22 reescrito

### Q24: Curtir comentários (RF-SOC-005)?
- Recommendation: Contagem apenas, sem lista de quem curtiu
- Final Answer: **Contagem apenas** — model `CommentLike` com `@@unique([commentId, userId])`; endpoint toggle; UI mostra só a contagem
- Impact on Plan: T013 (model), T081 (endpoint), T085 (botão na CommentSection), AC-7

## Session 2026-09-26 (Clarify pass pós-/pwf-analyze, v7)

### Q25: Como chavear `HoroscopeContent.date` (constraint única)?
- Recommendation: Data civil BRT do gatilho
- Final Answer: **Data civil `America/Sao_Paulo`** — cron converte agendamento BRT→UTC mas grava a data civil BRT; entre 00:00–04:00 BRT o endpoint resolve "hoje" = data civil BRT corrente; availability check (06:00 BRT) valida a data civil BRT do dia
- Impact on Plan: [S2-2] estendido; T008 (`HoroscopeContent.date` = date BRT), T097/T098/T107/T114 (geração grava data BRT), T093/T106/T113/T094 (leitura calcula data BRT), T145 (checagem usa data BRT)

### Q26: Rate limiter com Redis indisponível?
- Recommendation: Fail-open + alerta
- Final Answer: **Fail-open + alerta** — request prossegue com log warn + evento PostHog `rate_limiter_bypass`; contido downstream por daily limits em DB (fallback Prisma count) e moderação; sem 503, sem contador em memória local
- Impact on Plan: [S2-10] estendido; T027/T040 (modo de falha documentado em `src/lib/social/limits.ts`); CHK019 no checklist de observability

### Q27: Comportamento do feed ao receber `post:new` com página aberta?
- Recommendation: Pill "N novos posts" + slide-in no clique
- Final Answer: **Pill "N novos posts" no topo** — bolha acumula contagem dos eventos `post:new`; clique insere os posts com animação slide-in (RF-SOC-002) posicionando no topo; dedup por `post.id` contra refetch; sem auto-inserção durante leitura
- Impact on Plan: T061 (pill + listener), T062 (`useFeed` expõe `pendingPosts`/`flushPending`), T087 (SocialStore fila de pendentes); AC-3 reforçado

### Q28: Like/comentário em post `isHidden` ou removido entre render e clique?
- Recommendation: 404 uniforme
- Final Answer: **404 `POST_NOT_FOUND` uniforme** — POST like/comments num post oculto/privado/removido responde 404 (mesmo anti-timing do GET T057); sem código 403/409 para escrita
- Impact on Plan: T076/T077 validam post visível (predicado S2-15) → 404; T089 testes cobrem race render→clique

### Q29: Como medir os NFRs (CHK005/CHK006)?
- Recommendation: Bench automatizado como gate de fase
- Final Answer: **Bench automatizado** — `tests/bench/`: p95 de endpoints sociais (<500ms) e feed (<300ms com 1000 following sintéticos), Playwright tracing para página de horóscopo (<800ms), cronômetro unitário para Kin (<1ms); RUM pós-deploy fora do MVP
- Impact on Plan: NFR section com método; nova T146 (bench suite) no fim da Phase 9; gate `npm run test` inclui bench

## Session 2026-09-28 (Clarify pass pós-re-review, batch de divergências executadas)

### Q30: Envelope canônico das rotas sociais cursor-based?
- Recommendation: `{ data, pagination }` (contrato documentado em `overview.md` §Paginação)
- Final Answer: **`{ data, pagination: { nextCursor } }`** para TODAS as rotas cursor sociais (followers/following/feed/comments/notifications/history/gifts-received) — o contrato de `docs/04-api/overview.md` §Paginação prevalece sobre os shapes flat escritos nas tasks; hooks (`useNotifications`/`useFeed` union) são estreitados no shape vencedor quando a primeira rota (T044) existir
- Impact on Plan: nova decisão **[S2-18]**; T044/T052/T082 marcados com o envelope; `docs/04-api/social.md` nota "T052 decide" perde o defer (decidido aqui)

### Q31: Caminho de escrita/reconciliação de `Post.likeCount`/`Post.commentCount`/`Comment.likeCount`?
- Recommendation: increment no mesmo `$transaction` + cron de reconciliação
- Final Answer: **increment/decrement no MESMO `$transaction` do insert/delete** (T051/T076/T077/T081) **+ task nova de reconciliação periódica** (recompute `UPDATE ... SET count = (SELECT count(*)...)` via cron) — fecha a exigência I4 de `entities.md` (cascade `ON DELETE` não roda código de app → drift permanente sem reconciliação)
- Impact on Plan: notas explícitas em T051/T076/T077/T081; **nova T147** (reconciliação de contadores, Phase 10)

### Q32: Purge LGPD do histórico de leituras (Reading/ReadingCard/Interpretation) no Sprint 2?
- Recommendation: nova task no Sprint 2 (exigência já documentada)
- Final Answer: **Nova task no Sprint 2** — `lgpd.md` já exige retenção "ativo + 90 dias" / "90 dias após exclusão da conta"; o job `hard-delete` (30d) não apaga `Reading`/`ReadingCard`/`Interpretation` hoje
- Impact on Plan: **nova T148** (purge de leituras >90d, estende `src/jobs/hard-delete-accounts.ts`, com teste)

### Q33: Unificar o body dos 429 (social `resetAt` × auth `retryAfter`)?
- Recommendation: adicionar `retryAfter` (segundos) ao body do middleware social
- Final Answer: **`retryAfter` (segundos) passa a existir no body do 429 social junto de `resetAt`** — o client lê `retryAfter` uniformemente (padrão do `auth-store.ts`); header `Retry-After` continua obrigatório; contrato de auth (Sprint 1) não muda
- Impact on Plan: [S2-10] estendido; `src/lib/middleware/rate-limit.ts` + teste na execução (1 linha)

### Q34: Cron `*/5` do feed-cache × Vercel Hobby (deploy falha em plano Hobby)?
- Recommendation: cron horário
- Final Answer: **Cron horário `0 * * * *`** (em vez de `*/5 * * * *` de T042) — o tier alvo do projeto é Hobby (`scalability.md`), que só aceita cron ≥ 1 dia; refresh horário é coerente com TTL de 5 min do cache e threshold `>1000` following raramente atingido no MVP; upgrade para Pro fica Sprint 3+ se o refresh horário não bastar
- Impact on Plan: **T042 atualizado** (`*/5` → `0 * * * *`); `vercel.json` e banner de `docs/infrastructure.md` ajustados na execução

## Coverage Summary

| Category | Status | Notes |
|----------|--------|-------|
| 1. Functional scope & success criteria | **Resolved** | 24 ACs (AC-24 disponibilidade) cobrindo todos os módulos |
| 2. Domain/data model & lifecycle | **Resolved** | 13 novos models + User/UserProfile additions (S2-17 saldo); migrations atômicas; `HoroscopeContent.date` = data civil BRT (Q25); **contadores = $transaction + reconciliação cron T147 (Q31/S2-19); purge de leituras 90d T148 (Q32/S2-20)** |
| 3. UX/interaction flows | **Resolved** | Feed (pill "N novos posts" + slide-in, Q27), follow, post (+upload), like, comment (+like), gift, horoscopes, explore, notificações, history, AI interpret, settings |
| 4. NFRs | **Resolved** | Metas + método de medição via bench automatizado `tests/bench/` (Q29); rate limits + modo de falha fail-open (Q26); **cron feed-cache horário × Vercel Hobby (Q34)** |
| 5. Integration boundaries & failure modes | **Resolved** | WebSocket fallback polling; IA fallback template; presign R2; rate limiter fail-open com alerta (Q26); **429 social com `retryAfter` no body (Q33); deploy Vercel Hobby (Q34)** |
| 6. Edge cases & concurrency | **Resolved** | Self-follow/auto-like bloqueados; self-gift 403; claim-daily idempotente (409); 404 uniforme em post oculto (Q28); streak reset; maxFollowing 5000; chars 500/300/200/300; **drift de contadores fechado por reconciliação (Q31)** |
| 7. Terminology consistency | **Clear** | Moedas=Versos + `INSUFFICIENT_VERSOS` (S2-4); pt-BR usuário, inglês código/logs; US IDs = sprint-2.md; 429 code anotado em overview.md |
| 8. Completion signals | **Clear** | Gates `lint`+`type-check`+`test` (com bench) por fase; unit ≥80%, integration ≥70%, E2E ≥10 critical paths |

## Deferred Items

- **Push notifications (FCM/APNs)** — Sprint 3
- **Acesso público (visitante) a horóscopos e Explore** — Sprint 3+ (route group `(public)`; S2-13/Q21)
- **Desbloquear conteúdo premium com Versos (sprint-2.md task 30)** — Sprint 3+
- **Marketplace (SPEC-008 / US-027 de sprint-2.md)** — Sprint 3+
- **WebSocket horizontal scaling (multiple socket-service instances)** — pós-MVP se necessário
- **IA moderação automática** — Sprint 3
- **Pagamentos (Versos purchase, Stripe)** — Sprint 3+
- **Admin dashboard moderação** (inclui escrita de `User.isBanned`) — Sprint 3+
- **Analytics avançado (cohorts, retention)** — Sprint 3+

## Sources

- `docs/08-sprints/sprint-2.md` (requirements + tasks + US numbering)
- `docs/08-sprints/sprint-1.md` (estado atual verificado)
- `docs/plans/20260921120000-sprint1-completion-plan.md` (Sprint 1 completion)
- `.specs/006-horoscopes/requirements.md` + `design.md` (algoritmos + API + schema)
- `.specs/007-social/requirements.md` + `design.md` (RF-SOC-001..007, RNF-SOC-001..003, CA-SOC-001..005)
- `docs/01-product/use-cases.md` (UC-005 pré-condição autenticado)
- `prisma/schema.prisma` (estado atual do schema)
- `src/lib/r2.ts` + `src/app/api/v1/users/me/avatar/presign/route.ts` (pattern de upload)
- `src/app/(app)/layout.tsx` (redirect sem sessão)
- `docs/solutions/patterns/` (patterns existentes: tz-determinism, derived-field-invalidation, single-flight-token-refresh, auth-uniform-response-timing-equalization, rate-limit-before-user-lookup, validate-callback-url-single-source, soft-delete-gdpr-window, providerid-normalization-convention, atomic-account-lifecycle-invalidation, logger-migration-stopgap, gate-third-party-analytics-sdk-init, turbopack-postcss-oom, prisma-v8-cli-regression)
