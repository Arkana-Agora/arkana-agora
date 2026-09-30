# Sprint 2 — Social + Conteúdo

> **Projeto**: Arkana Agora  
> **Identificador**: `arkana-agora`  
> **Duração**: 4 semanas  
> **Equipe**: 2-3 desenvolvedores  
> **Status**: Em andamento — Phases 0 (T001–T023), 0.5 (T024–T042) e 1 (T043–T050, Follow System) do plano de execução concluídas  
> **Dependência**: Sprint 1 completo

---

## Objetivo

Adicionar features sociais (feed, follow, interações) e expandir o conteúdo esotérico com horóscopos (Ocidental, Chinês e Maia), gifts virtuais e exploração de perfis.

---

## User Stories

| # | User Story | Critério de Aceite | Prioridade |
|---|-----------|-------------------|------------|
| US-020 | Como usuário, quero seguir outros usuários para ver suas tiragens | Botão seguir/deseguir, lista de seguidos/seguidores | Alta |
| US-021 | Como usuário, quero compartilhar minha tiragem no feed | Post criado com imagens das cartas e interpretação | Alta |
| US-022 | Como usuário, quero ver um feed com tiragens de quem sigo | Timeline cronológica com posts de seguidos | Alta |
| US-023 | Como usuário, quero curtir e comentar publicações | Like toggle + formulário de comentário | Média |
| US-024 | Como usuário, quero consultar horóscopos (ocidental, chinês, maia) | Páginas dedicadas com leitura diária para cada sistema | Alta |
| US-025 | Como usuário, quero calcular meu Kin Maya | Algoritmo Tzolkin correto, resultado com Selo + Tom | Alta |
| US-026 | Como usuário, quero enviar presentes virtuais para outros usuários | Catálogo de gifts, confirmação de envio, notificação | Média |
| US-027 | Como usuário, quero navegar no marketplace | Listagem de produtos com filtros e busca | Média |

---

## Tasks Detalhadas

### Sistema Social
- [ ] 1. Modelo de dados: `Follow` (follower_id, following_id)
- [x] 2. API: follow/unfollow com validação (não seguir a si mesmo) — **entregue na Phase 1 (T043)**, `POST /api/v1/social/follow/:userId` toggle
- [ ] 3. Lista de seguidores e seguidos no perfil
- [ ] 4. Contador de seguidores em destaque no perfil

> **2026-09-28 (Phase 1 do plano)**: o **backend** dos itens 2/3/4 existe — rota toggle com validações (`POST /api/v1/social/follow/:userId`, T043), listas `GET /users/:username/{followers,following}` (T044/T045) e `followersCount`/`followingCount`/`isFollowing` no `GET /users/:username/profile` (T046). Os **componentes** `src/components/social/{follow-button,followers-modal}.tsx` também existem e são testados, mas **nenhuma page os monta**: `src/app/(app)/perfil/[username]/client.tsx` ainda renderiza `<ProfileStats />` sem props (zeros) — por isso **3 e 4 seguem `[ ]`** (falta wiring de UI, próxima fase). Item 1 (model `Follow`) já existia desde a Phase 0 (migração `20260926182325`; ver task 34 `[x]`). Os 9 "Critérios de Aceite do Sprint" abaixo permanecem `[ ]` conforme decisão do dono registrada no plano — em particular "Sistema de follow/unfollow operacional" **não** é re-marcado aqui porque o follow ainda não é operacional ponta a ponta (falta o wiring de UI descrito acima).

### Feed
- [ ] 5. Modelo de dados: `Post` (author_id, reading_id, content, visibility)
- [ ] 6. Feed timeline: query por following → fallback para suggested
- [ ] 7. Criação de posts com compartilhamento de readings
- [ ] 8. Imagem compartilhável gerada (Open Graph cards)
- [ ] 9. Infinito scroll no feed (cursor-based pagination)

### Interações
- [ ] 10. Sistema de likes (toggle, contador)
- [ ] 11. Sistema de comentários (CRUD, nested replies limitados)
- [ ] 12. Notificações in-app: likes, follows, gifts, comentários
- [ ] 13. Badge de notificações não lidas

### Horóscopo Ocidental
- [x] 14. Tabela de signos com datas precisas (incluindo cuspides)
- [x] 15. Conteúdo diário para os 12 signos (template + variação)
- [ ] 16. Página de horóscopo com signo do usuário em destaque
- [ ] 17. Compatibilidade entre signos (amizade, amor, trabalho)

### Horóscopo Chinês
- [x] 18. Algoritmo de cálculo do animal chinês (data de nascimento)
- [x] 19. Sistema dos 5 elementos (Madeira, Fogo, Terra, Metal, Água)
- [x] 20. Combinação Animal × Elemento (60 ciclos sexagenários)
- [x] 21. Conteúdo descritivo para cada combinação

### Horóscopo Maia
- [x] 22. Algoritmo de Kin Maya (calendário Tzolkin: 20 Selos × 13 Tons = 260 dias)
- [x] 23. Integração dos 20 Selos Solares (nome, significado, tom, cor)
- [x] 24. Integração dos 13 Tons Galácticos (nome, poder, ação, essência)
- [x] 25. Cálculo da Onda Encantada (9 posições do destino)
- [ ] 26. Página dedicada com visual rico do Kin Maya

### Gifts e Economia Virtual
- [x] 27. Catálogo de 6 tipos de gifts: 🌟 Estrela, 🦋 Borboleta, 🔮 Cristal, 🌙 Lua, 🌹 Rosa, ✨ Brilho
- [ ] 28. Moeda virtual "Versos" (sistema de saldo)
- [ ] 29. Ganhos de Versos: login diário, interações, milestones
- [ ] 30. Gastos de Versos: enviar gifts, desbloquear conteúdo premium

### Explore e Busca
- [ ] 31. Página Explore: trending readings, perfis populares, profissionais
- [ ] 32. Busca de usuários por nome ou username
- [ ] 33. Moderação básica: report de conteúdo, filtro de palavras

### Banco de Dados
- [x] 34. Migrations: `Follow`, `Post`, `Comment`, `Like`, `Gift`, `HoroscopeEntry`
- [x] 35. Índices de performance para queries do feed
- [x] 36. Seed data: horóscopos, selos maias, gifts

### Real-time
- [ ] 37. WebSocket service para atualizações do feed em tempo real
- [ ] 38. Reconnection logic e fallback para polling

---

## Critérios de Aceite do Sprint

> **2026-09-26**: itens re-abertos (`[ ]`) — estavam todos marcados `[x]` antes de qualquer entrega (feed/follow/likes/gifts/Explore não existem; horóscopos têm algoritmo mas ainda sem UI/endpoint). Marcar apenas quando o critério for entregue de fato.

- [ ] Feed funcional com posts de seguidos e suggested
- [ ] Sistema de follow/unfollow operacional
- [ ] Likes e comentários funcionando
- [ ] Horóscopo Ocidental calculando e exibindo corretamente
- [ ] Horóscopo Chinês com animal e elemento corretos
- [ ] Kin Maya calculado via algoritmo Tzolkin
- [ ] Gifts enviáveis e recebíveis com notificação
- [ ] Notificações in-app para interações
- [ ] Página Explore com busca de usuários

---

## Dependências

| Dependência | Tipo | Status |
|------------|------|--------|
| Sprint 1 completo | Bloqueante | Necessário |
| Conteúdo dos horóscopos (textos) | Conteúdo | Preparar antes do início |
| Dados dos 20 Selos + 13 Tons Maia | Conteúdo | Preparar antes do início |

---

## Riscos

| Risco | Probabilidade | Impacto | Mitigação |
|-------|--------------|---------|-----------|
| Algoritmo Tzolkin incorreto | Média | Alto | Validar com calculadoras de referência, testar bordas |
| Performance do feed com muitos posts | Média | Médio | Cursor pagination, cache Redis, query optimization |
| Moderação de conteúdo inadequado | Alta | Médio | Filtro de palavras, sistema de report, review manual |
| WebSocket instability | Baixa | Médio | Fallback para polling, auto-reconnect |

---

## Estimativa

| Módulo | Horas | Dias Úteis |
|--------|-------|-------------|
| Sistema Social (follow + perfil) | 32h | 4d |
| Feed + Posts | 48h | 6d |
| Likes + Comentários | 32h | 4d |
| Horóscopo Ocidental | 24h | 3d |
| Horóscopo Chinês | 32h | 4d |
| Horóscopo Maia (Tzolkin) | 40h | 5d |
| Gifts + Versos | 32h | 4d |
| Explore + Busca | 24h | 3d |
| Notificações | 16h | 2d |
| DB + Seeds | 16h | 2d |
| WebSocket | 16h | 2d |
| **Total** | **~312h** | **39d (4 semanas)** |

---

## Entregáveis

- Feed social funcional com timeline e infinite scroll
- Sistema completo de follow/interações
- Três sistemas de horóscopo (Ocidental, Chinês, Maia)
- Kin Maya com Onda Encantada
- Sistema de gifts e moeda virtual "Versos"
- Notificações in-app
- Página Explore com busca

---

## Execution Log

- 2026-09-26 — **Phase 0 do plano de execução concluída (T001–T023, `docs/plans/20260926120000-sprint2-execution-plan.md`)**: tasks **14, 18, 19, 20, 22, 23, 24, 25, 34, 35** marcadas `[x]` acima. Entregas: schema +13 models sociais/horóscopos (Follow, Post, Comment, PostLike, PostHashtag, CommentLike, Gift, Notification, HoroscopeContent, HoroscopeEntry, HoroscopeLog, HoroscopeNotification, ContentReport) + campos User/UserProfile; migração `20260926182325_sprint2_social_horoscopes` aplicada; `src/lib/horoscopes/{western,chinese,maya}.ts` (catálogos + algoritmos); `src/lib/calculations/kin-maya.ts` migrado para **GMT 584283** (15/06/1990 → **Kin 255**); seed DB idempotente; `src/lib/env.ts` (Zod); backfill `prisma/backfill-mayankin.ts`. **Decisões**: Kin = epoch GMT 584283 → 255; Onda Encantada = **9 câmaras** (posições 2,3,4,6,7,8,10,11,12); elemento chinês = `floor(stem/2)` (a fórmula `((year-4)%5)` da spec viola RF-HORO-002). **Gates**: lint ✓ · type-check ✓ · **1781 testes ✓** (658 em `tests/horoscopes.test.ts`). **Não concluído nesta fase** (fases posteriores): 15/21/36 (conteúdo e fallbacks completos — T032), 26 (página maia), 37–38 (WebSocket) e demais tasks sociais.
- 2026-09-26 — **Phase 0.5 do plano de execução concluída (T024–T042, `docs/plans/20260926120000-sprint2-execution-plan.md`)**: tasks **15, 21, 27, 36** marcadas `[x]` acima. Entregas: `src/lib/analytics.ts` (+11 eventos typed, incl. `rate_limiter_bypass`); `src/lib/moderation.ts` (env `MODERATION_BLOCKED_WORDS`); `src/lib/social/feed-algorithm.ts` (ordenação 4 níveis S2-5, cursor `(createdAt,id)`, fallback explore); `src/lib/social/limits.ts` (única casa dos rate limits — Redis ZSET + fail-open Q26 + daily via Prisma); `src/lib/csrf.ts` + middlewares `rate-limit`/`csrf` (`src/lib/middleware/`); `src/lib/og-image.ts` (SVG 1200×630 → sharp PNG, fallback `@vercel/og`); `src/lib/feed-cache.ts` + `src/jobs/feed-cache-refresh.ts` (cron `*/5`, threshold 1000 following); `src/lib/social/mentions.ts`; **T032 fallback templates no seed → 1328 rows idempotentes** (12 signos + 60 combos chineses + 260 kins × daily×2+weekly+monthly, datas civis BRT); `src/lib/queue/horoscope-queue.ts` (BullMQ, concurrency 3, jobId determinístico); `src/lib/horoscopes/prompts.ts` + `validation.ts` (faixas RF-HORO-001); `src/lib/social/gifts.ts` (**catálogo SPEC-007 = 6 gifts em código**, decisão S2-4 — nomes canônicos ≠ lista de emojis desta task, que estava desatualizada) + `src/lib/social/versos.ts` (`earnVersos` `$transaction`); hooks `use-horoscopes`/`use-social`; **6 `error.tsx` (segmentos) + `src/app/global-error.tsx`** (App Router — T039). **Decisões**: gifts em catálogo fixo em código (S2-4), não em seed → task 36 entregue assim; upload 20/dia (S2-10). **Gates**: lint ✓ · type-check ✓ · **1975 testes passed / 1 skipped ✓**; seed idempotente (1328 fallbacks). **Parciais — continuam `[ ]`**: 6 (algoritmo T026 pronto; endpoint feed T052 = Phase 2), 8 (utilitário T029 pronto; rota og-image T058 = Phase 2), 28/29 (util `versos.ts` T037 pronto; `GET /versos/balance` T121 + claim-daily/milestones T122 = Phase 7), 33 (filtro T025 pronto; report endpoint T128 = Phase 8), 37–38 (WebSocket = Phase 2.5). **Critérios de Aceite do Sprint**: não alterados (decisão do dono de docs em 2026-09-26 — re-marcados conforme fases entregarem).
- 2026-09-27/28 — **Revisão cross-cutting (9 revisores) — "fix all issues" concluído**: correções CRIT/S/N/I aplicadas em código + testes (Sentry via `RouteError`, CSRF `CSRF_TOKEN_INVALID`, rate limits núcleo único, moderation cache, `isBanned`, feed-cache-refresh cron em `vercel.json`, proxy matcher, CSP real, og-image, mentions, backfill `mayanKin`); **novos nesta passada**: `versos.ts` simplificado (1 query, P2025→null), migrations **#8** `20260927222620_sprint2_review_fixes` e **#9** `20260928004004_horoscope_contents_domain_checks` (CHECKs `type`/`period`), **CI drift gate** (`migrate status` + `migrate diff --exit-code` no job Testes), paridade `WESTERN_SIGNS`×`calculateZodiacSign`, `analytics.ts` com unions typed, `instrumentation.ts` `getEnv()` fail-fast, `error.tsx` ×6 com `RouteErrorProps`, `.env.example` + `CRON_SECRET`. **Deferred (decisão explícita)**: type-aware lint + `import/order` (PR separado). **Docs**: batch de sincronização (security/social/overview/migrations/entities/erd/infrastructure/observability/environments + execution log do plano). **Gates frescos**: prettier ✓ · eslint 0 warnings ✓ · type-check ✓ · suíte completa ✓ · 9 migrations up-to-date ✓ · `migrate diff` sem drift ✓. **Regressão pós-gate**: o gate `isBanned`/`deletedAt` do `requireAuth` quebrou 58 testes de 8 arquivos (mocks sem o model/stub) — corrigido com lookup fail-open em falha de DB + contrato `null`→401/`deletedAt`→401/`isBanned`→403 preservado (`tests/require-auth.test.ts` 4/4); documentado em `docs/07-security/security.md` §Guard de sessão; suíte completa re-verdada com **2017 passed / 1 skipped**.
- 2026-09-28 — **Plan-sync — verificação do entry 2026-09-27/28 contra `git diff`**: entry conferido — as ações/entregas citadas existem no diff (Sentry/`RouteError`, `CSRF_TOKEN_INVALID`, núcleo único de rate limits, moderation cache, gate `isBanned`, cron `feed-cache-refresh` em `vercel.json`, proxy matcher, CSP, og-image, mentions, backfill `mayanKin`, `versos.ts` 1-query, migrations #8/#9, CI drift gate, paridade `WESTERN_SIGNS`, `analytics.ts` unions, `instrumentation.ts` `getEnv()`, `error.tsx` ×6, `no-console`, `.env.example` `CRON_SECRET`). **Omissão do entry — registrada aqui**: a mesma passada incluiu a **purga social LGPD do hard-delete** (`src/jobs/hard-delete-accounts.ts` + `tests/hard-delete-accounts.test.ts`; docs `04-api/authentication.md` + `07-security/lgpd.md`), as invariantes de cursor/pinned em `src/lib/social/feed-algorithm.ts`, a validação zod do payload do `feed-cache`, `useMyHoroscope` → `GET /horoscopes/my-horoscope` (T094/SC8) e `src/lib/csrf-methods.ts`. **Nenhuma task/checklist marcada**: as tasks 6/8/9/28/29/33/37/38 permanecem `[ ]` (parciais justificados no entry da Phase 0.5) e os 9 "Critérios de Aceite" permanecem `[ ]` (decisão do dono de 2026-09-26, não alterada).
- 2026-09-28 — **Re-review (6 agentes) + correção dos achados — "fix all issues" encerrado**: `requireAuth` virou **fail-closed** (throw do lookup → **503 `SERVICE_UNAVAILABLE`**; corrige o "fail-open" do entry 2026-09-27/28; contrato `null`/`deletedAt`→401, `isBanned`→403; teste 5/5 + `security.md` §Guard de sessão reescrito); `next.config.ts` accept `text/html.*` (regex ancorada em `prepare-destination` fazia HSTS/nosniff/CSP **nunca serem emitidos** em self-hosted); enriquecimento OAuth projeta `{name, picture}` antes do `.strict()` (profile Google bruto não era mais no-op) + teste; **CI assertion** `prisma/ci/assert-integrity.sql` (9 CHECKs + índice `NULLS NOT DISTINCT`, cobre o blind spot do `migrate diff`, verificado pos/neg); `limits.ts` (`bypass` param → `remaining`, `dailyFallback` com `userId` explícito); removidos `isAuthTokenError` e re-export `CSRF_PROTECTED_METHODS`; `global-error.tsx` → `RouteErrorProps`; override `scripts/**` do eslint **restaurado** (falso positivo — `gen-og-image.cjs` é lintado). **Docs**: `overview.md` §CSRF, `security.md` §Helmet (CSP parcial), `infrastructure.md` (assertion + **banner cron `*/5` × Vercel Hobby** — deploy falha em Hobby; decisão do dono). **Gates frescos**: prettier ✓ · eslint 0 problems ✓ · type-check ✓ · suíte **2019 passed / 1 skipped** ✓ · 9 migrations ✓ · `migrate diff` sem drift ✓ · assertion SQL ✓.
- 2026-09-28 — **Phase 10 do plano concluída (T147–T148) + pendências do clarify executadas (SC33/SC34)**: **T147** cron de reconciliação de contadores (S2-19, invariante I4) — `src/jobs/counter-reconcile.ts` (`0 4 * * *`, dois `UPDATE ... WHERE divergente` com subquery `COUNT(*)` em `Post.likeCount`/`Post.commentCount`/`Comment.likeCount`, `$executeRaw` = rows corrigidas → idempotente) + rota `GET /api/cron/counter-reconcile` (`Bearer CRON_SECRET`, pattern do `hard-delete`) + entrada em `vercel.json` + 10 testes. **T148** purge LGPD de leituras (S2-20) — `purgeExpiredReadings()` no `hard-delete-accounts.ts`: contas `deletedAt ≤ now−90d` **com** leituras (seleção auto-esgotante), transação FK-order **Interpretation → ReadingCard → Reading**, campo `readingsPurged` no summary; janelas 30d (anonimização) e 90d (purge) coexistem; +3 testes (45d mantém / 95d perde / idempotência). **SC33** `retryAfter` (segundos) no body do 429 social ao lado de `resetAt`. **SC34** cron feed-cache `*/5` → **`0 0 * * *`** — correção da decisão original (`0 * * * *` horário **também falha em Hobby** segundo a doc da Vercel; dono consultado e confirmou diário). **Docs**: `infrastructure.md` (banner RESOLVIDO), `deployment.md`, `overview.md` (crons + 429), `social.md`, `security.md`, `entities.md` (I4(b)), `lgpd.md`, clarifications Q34. **Gates frescos**: prettier ✓ · eslint 0 problems ✓ · type-check ✓ · **suíte 2032 passed / 1 skipped (132 files)** ✓ (+13 testes novos).
- 2026-09-28 — **Phase 1 do plano concluída (T043–T050, Follow System) — executada com TDD (red/green por behavior)**: **T049** `canFollow` em `src/lib/social/privacy.ts` (lê `UserProfile.privacy.whoCanFollow`: `all`/`nobody`/`following` — "following" = só quem o alvo **já segue**, semântica da label "Quem eu sigo"; `{ allowed, reason: privacy_nobody|privacy_following }`; 7 testes). **T043** `POST /api/v1/social/follow/:userId` — **toggle** (decisão **SC35**: um endpoint segue 201 / deixa de seguir 200, **sem DELETE**; contrato antigo de `docs/04-api/social.md` reescrito); validações na ordem: `enforceSocialLimit({ limit: "follow" })` (20/min) → 409 `CANNOT_FOLLOW_SELF` → 404 `USER_NOT_FOUND` → toggle → 409 `MAX_FOLLOWING_REACHED` (`User.maxFollowing`) → 403 `FOLLOW_NOT_ALLOWED` com `details.reason` (**SC36**: negação definitiva, sem solicitação pendente); seguir cria `Notification` (`type:"follow"`, `data.followerId`) no mesmo `$transaction` + `earnVersos(follower, Follow)`; unfollow não recompensa; emits WS ficam p/ T088. **T044/T045** `GET /users/:username/{followers,following}` — lib `src/lib/social/follow-lists.ts` (keyset com `encodeFeedCursor`/`decodeFeedCursor`, cursor inválido → página vazia, `q` case-insensitive em nome/username, banidos/soft-delete filtrados, default 20/máx 50) + envelope **`{ data, pagination: { nextCursor } }`** (S2-18, primeira rota a fixar o shape) com **auth opcional** (`optionalAuth` novo em `users/_helpers.ts` → `isFollowing` por item); perfil privado → 404 anti-timing. **T046** profile público + `followersCount`/`followingCount` no root + `isFollowing` só autenticado (**SC37**: nomes do plano, não `stats.*` de `users.md`). **T047** `FollowButton` (`src/components/social/follow-button.tsx`) — toggle com optimistic update local + cache `["profile", username]` via TanStack Query (`onMutate` flipa / `onError` reverte / `onSettled` invalida), disabled durante mutação. **T048** `FollowersModal`/`FollowingModal` (`src/components/social/followers-modal.tsx`) + hook `useFollowList` (`use-social.ts`, infinite query sobre o envelope S2-18) — lista com avatar/nome/username/botão, busca com debounce 300ms, "Carregar mais", empty/loading/error states. **T050** suíte `tests/integration/social-follow.test.ts` (**19 testes**: follow/unfollow, listas + cursor + q, validações, anti-self, maxFollowing, privacy ×2 reasons, Notification, rate limit). **Decisões registradas**: SC35/SC36/SC37 (tabela do plano) + Q35/Q36/Q37 (clarifications). **Docs**: `04-api/social.md` (contrato follow reescrito + seções das listas), `04-api/users.md` (contrato T046), `06-features/social.md` (banner Phase 1), clarifications Q35–Q37. **Gates frescos**: prettier ✓ · eslint 0 problems ✓ · type-check ✓ · **suíte 2074 passed / 1 skipped (136 files)** ✓ (+42 testes novos vs baseline 2032/132).

- 2026-09-29 — **Review multi-agent (9 agents) do Phase 1 — achados corrigidos ('fix all issues' encerrado)**: sintese dos 9 relatorios de review -> todos os Critical/Important aplicaveis fechados. **Bugs**: toggle de follow retornava **500** (ollowingCount/ollowersCount declarados dentro do callback do $transaction, usados fora - hoisted); **OR collision** em ollow-lists.ts (?q= + cursor no mesmo literal: o keyset sobrescrevia o filtro de busca -> AND: [{OR busca},{OR keyset}] + teste combinado); isFollowing invertido (direcao viewer->item); toggle reescrito (tx unica idempotente P2002/P2025, enforceCsrf, ate.headers, gate isBanned/deletedAt no alvo); optionalAuth com gate (	ests/optional-auth.test.ts 10). **Fix-now**: unions HoroscopeType/HoroscopePeriod single-source no hook; seed guard com warn; 	rackVersosEarned sem alance; docblocks 'Node runtime / nunca em proxy.ts'. **Migracao #12** 20260929142921_secondary_indexes_review (+4 indices secundarios: comments.authorId, post_likes.userId, content_reports.reporterId, horoscope_contents(type,period,date)) + contrato em schema-sprint2. **Docs**: security.md (status CSRF/optionalAuth corrigidos, captura server-side log-only ate T136, secao Moderacao fail-open + laggedWords, guardrail linkify, env assertion adiada = decisao do dono), entities.md (debito condicional Versos, cascades Gift, alidateHoroscopeContent), elationships.md (ContentReport 	argetId polimorfico), lgpd.md (PII free-text), infrastructure.md (feed-cache sem invalidation ate T052; retencao horoscope_contents Sprint 3+). **Deferred/skip justificados**: type-aware lint + import/order (PR separado), boot assertion de producao (infra do dono), OG dup (T058), prompt injection (T093), length caps (T057+), cron tick lock (diario), 4 advisories moderate, CSRF stateless. **Gates frescos**: prettier ✓ · eslint 0 problems ✓ · type-check ✓ · **suíte completa 137 files / 2091 passed / 1 skipped ✓** · **12 migrations up-to-date ✓**.

- 2026-09-29 — **Re-review focada (2 agents: kieran-typescript + security-sentinel) do Phase 1 — 12 IMPORTANTs corrigidos (0 CRITICAL)**: (I1) `existingLink` decidido **antes** do gate `canFollow` → unfollow nunca mais bloqueado por `whoCanFollow: "nobody"` do alvo (+teste); (SC39/Q2) contadores do toggle/profile/corridas unificados em `readFollowCounts()` (excluem `isBanned`/`deletedAt`); (K2) `earnVersos === null` aborta a tx — marker `FollowReward` nunca commita sem pagamento, e re-follow não paga de novo (+testes); (K3/S5) handlers P2002/P2025 **re-querem `follow.findUnique`** (fonte de verdade) em vez de assumir qual constraint falhou — falha na re-query vira 500 JSON com `rate.headers`, nunca HTML (+3 testes de corrida); (I2) `rate.headers` no 401 do viewer e nos 500; (I3/S3) `meta.requestId`/`logger.reqId` corrigidos em `profile/route.ts` (3 usos de `visible.profile.userId` — 2 em `meta`, 1 no logger); (SC38/I4) listas `followers`/`following` → **404 p/ não-dono** com `statsVisibility: "private"` (+2 testes); (Q1) dono autenticado **vê** os contadores no profile quando `statsVisibility: "private"` (antes ninguém via; `optionalAuth` antes do bloco de stats, +2 testes); (K4) `findVisibleProfile` loga `logger.warn` quando o privacy JSON falha no `safeParse` (404 fail-closed observável) + `tests/find-visible-profile.test.ts` (9 casos); (K6) `social-follow.test.ts` → **31** testes e `schema-sprint2.test.ts` → **48** (+`FollowReward` model e `@@unique`). **Pendências de design registradas (NÃO implementadas — exigem decisão do dono)**: `profileVisibility` não vale no write path do toggle (seguir perfil privado responde 201) e listas GET sem rate limit → `docs/04-api/social.md` § "Limitações conhecidas (revisão 2026-09-29)". **Docs**: `04-api/social.md` (SC38 + 404 + limitações), `04-api/users.md` (Q1 escalação do dono), `06-features/profile.md`, `06-features/social.md`, `07-security/permissions.md`. **Gates frescos (re-executados e re-conferidos pelo plan-sync)**: prettier ✓ · eslint 0 problems ✓ · `tsc --noEmit` ✓ · suíte **138 files / 2115 passed / 1 skipped** ✓ (baseline 2091/137). **Checklist/tasks**: nada novo a marcar — itens 3/4 do Sistema Social continuam `[ ]` (wiring de UI pendente: nenhuma page monta `FollowButton`/`FollowersModal`), item 1 (model `Follow`) segue `[ ]` apesar de entregue na Phase 0 (nota acima remete à task 34 `[x]`) e os 9 Critérios de Aceite seguem `[ ]` (decisão do dono de 2026-09-26, não alterada).
- 2026-09-29 — **Pre-commit: OOM da suíte inteira no `bun run test` → heap flag nos scripts de teste**: reproduzido `FATAL ERROR: Zone Allocation failed` + `ERR_IPC_CHANNEL_CLOSED` (worker tinypool) num run do dono com ~1 GB livres de 7,8 GB (Node v24), exit 1 em 27/139 arquivos e **zero falhas de asserção** — mesma classe já documentada do build (`docs/solutions/ci-cd/turbopack-postcss-oom.md`, fix de 2026-09-23). **Fix**: `package.json` `test`/`test:coverage` → `node --max-old-space-size=4096 node_modules/vitest/vitest.mjs run[ --coverage]` (tinypool forks herdam `execArgv` → workers recebem o cap). **Green**: suíte completa **138 files / 2115 passed / 1 skipped, exit 0**. **Docs**: `turbopack-postcss-oom.md` (+§ "Recurrence: test suite (2026-09-29)"), `infrastructure.md` + `environments.md` (bullets build/test heap flag), execution log do plano (linha ~938). Sem mudança de código de aplicação; nenhum checkbox de fase alterado (fix de infra, não deliverable de fase).
