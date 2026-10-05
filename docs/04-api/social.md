# API Social — arkana-agora

> **Módulo**: `src/app/api/v1/social/` | **Autenticação**: Obrigatória em todas as rotas deste módulo **exceto** `GET /social/posts/:id/og-image` (`optionalAuth` — crawlers de preview chegam sem token) e as listas `GET /users/:username/{followers,following}` (auth opcional, o Bearer só habilita `isFollowing`); as rotas de escrita (`POST /social/follow/:userId`, `POST /social/posts`, `POST /social/posts/images/presign`) exigem Bearer **+ CSRF** (`enforceCsrf`) | **Paginação**: Cursor-based
>
> **Status (2026-10-02)**: **implementado — follow (Sprint 2 Phase 1, T043–T050) + posts/feed/explore (Sprint 2 Phase 2, T051–T065) + realtime/polling (Sprint 2 Phase 2.5, T066–T088 parcial)**. Rotas existentes hoje em `src/app/api/v1/social/`: `POST /social/follow/:userId` (toggle, `follow/[userId]/route.ts`), `POST /social/posts`, `GET /social/feed`, `GET /social/explore/{trending,hashtags,suggestions}`, `GET /social/search`, `GET /social/posts/:id`, `GET /social/posts/:id/og-image`, `POST /social/posts/images/presign`, **`GET /social/polling/{posts,likes,comments,notifications}`** (T071, fallback REST do realtime — contrato na seção de polling no fim deste documento) (+ `GET /users/:username/{followers,following}` em `src/app/api/v1/users/[username]/{followers,following}/route.ts`, libs `src/lib/social/{privacy,follow-lists,feed-algorithm,explore,search,post-visibility}.ts` e validadores `src/lib/validators/social.ts`). Testes: `tests/integration/social-follow.test.ts` (43 casos, incl. 3 de corrida), `tests/social-privacy.test.ts`, `tests/find-visible-profile.test.ts` (11 — `findVisibleProfile`/SC38), `tests/integration/social-feed.test.ts` (52) e `tests/integration/social-explore.test.ts` (20) — a cobertura da task T065 está **dividida entre esses dois arquivos + `tests/feed-algorithm.test.ts` (26)** em vez de um único `social-feed.test.ts` (desvio registrado na Phase 2). **Continuam planejados** os endpoints não listados acima (`DELETE /social/posts/:id`, `POST /social/posts/:id/like` T076, `POST|GET /social/posts/:id/comments` T077/T078, `POST /social/gifts` T120, `GET|PATCH /social/notifications*` T082) — nenhum deles existe em `src/app/api/v1/social/`. Desde o Sprint 2 Phase 0 os **models** de suporte existem no schema (`prisma/schema.prisma`, migração `20260926182325_sprint2_social_horoscopes`): `Follow`, `Post`, `Comment`, `PostLike`, `CommentLike`, `PostHashtag`, `Gift`, `Notification`, `ContentReport`. Desde o **Phase 0.5** as **utilidades compartilhadas** que as rotas usam já existem: `src/lib/social/{feed-algorithm,limits,gifts,versos,mentions}.ts`, `src/lib/moderation.ts`, `src/lib/csrf.ts` + `src/lib/middleware/{rate-limit,csrf}.ts`, `src/lib/feed-cache.ts`, `src/hooks/use-social.ts`.

## Sumário

- [POST /social/follow/:userId](#post-socialfollowuserid)
- [GET /users/:username/followers](#get-usersusernamefollowers)
- [GET /users/:username/following](#get-usersusernamefollowing)
- [GET /social/feed](#get-socialfeed)
- [GET /social/explore (rascunho — adiado)](#get-socialexplore)
- [GET /social/explore/trending](#get-socialexploretrending)
- [GET /social/explore/hashtags](#get-socialexplorehashtags)
- [GET /social/explore/suggestions](#get-socialexploresuggestions)
- [GET /social/search](#get-socialsearch)
- [POST /social/posts](#post-socialposts)
- [GET /social/posts/:id](#get-socialpostsid)
- [GET /social/posts/:id/og-image](#get-socialpostsidog-image)
- [POST /social/posts/images/presign](#post-socialpostsimagespresign)
- [DELETE /social/posts/:id](#delete-socialpostsid)
- [POST /social/posts/:id/like](#post-socialpostsidlike)
- [POST /social/posts/:id/comments](#post-socialpostsidcomments)
- [GET /social/posts/:id/comments](#get-socialpostsidcomments)
- [POST /social/gifts](#post-socialgifts)
- [GET /social/notifications](#get-socialnotifications)
- [PATCH /social/notifications/read](#patch-socialnotificationsread)
- [GET /social/polling/{posts,likes,comments,notifications}](#get-socialpollingpostslikescommentsnotifications)

---

## POST /social/follow/:userId

**Toggle de follow** (SC35, decidido na execução da Phase 1): o mesmo endpoint **segue** (201) ou **deixa de seguir** (200). O contrato antigo deste documento com DOIS endpoints (POST + DELETE, erros `ALREADY_FOLLOWING`/`NOT_FOLLOWING`) foi substituído pela task T043 do plano — **não existe `DELETE /social/follow`**.

> **Implementado (Sprint 2 Phase 1, T043)** em `src/app/api/v1/social/follow/[userId]/route.ts`.

### Requisição

```http
POST /api/v1/social/follow/usr_target123
Authorization: Bearer <accessToken>
```

### Comportamento

Ordem exata do handler (importada de `src/app/api/v1/social/follow/[userId]/route.ts`):

1. **CSRF** — `enforceCsrf(request, reqId)` no topo (primeira rota consumidora do `src/lib/middleware/csrf.ts`, T041; review security I3) → 403 `CSRF_TOKEN_INVALID` **sem** rate headers. A rota é `Bearer` + cookie CSRF (o interceptor `src/lib/api.ts` injeta `x-csrf-token`) — defesa em profundidade
2. **`requireAuth`** (`src/app/api/v1/users/_helpers.ts`) → 401 `AUTH_TOKEN_INVALID` / 403 `AUTH_ACCOUNT_SUSPENDED`
3. Rate limit social `follow` = 20/min — `enforceSocialLimit({ limit: "follow" })` (middleware T040; núcleo/wrapper `checkFollowLimit` T027), **antes de qualquer lookup do alvo** (anti-oráculo, padrão `docs/solutions/patterns/security/rate-limit-before-user-lookup.md`) → 429 `RATE_LIMITED` + headers `X-RateLimit-Limit`/`X-RateLimit-Remaining`/`Retry-After`
4. Não permite seguir a si mesmo → 409 `CANNOT_FOLLOW_SELF`
5. Lookup do alvo (`prisma.user.findUnique`): **inexistente, `isBanned`, `deletedAt` preenchido ou `isActive: false` → 404 `USER_NOT_FOUND`** (mesmo código para os quatro, anti-timing; TOCTOU: revalidação dentro da tx no passo 8)
6. Lookup do viewer (se sumiu por hard-delete → 401 `AUTH_TOKEN_INVALID`)
7. **Privacidade do alvo UMA vez** (`prisma.userProfile.findUnique`): lê `privacy` → **gate do response SC38** (omitir contadores se `statsVisibility === "private"`) + **preloaded para `canFollow`** (evita 2ª query)
8. **Direção decide ANTES do gate (review 2026-09-29, I1)** — `prisma.follow.findUnique` do par `followerId: viewer, followingId: alvo`: **se o link já existe, o unfollow segue direto para o tx sem passar por `canFollow`** (revogação é sempre possível — sem isso, um alvo que virasse `whoCanFollow: "nobody"` prenderia o ex-seguidor no toggle). **Só sem link existente** o handler chama `canFollow` (T049, S2-14, lê `UserProfile.privacy.whoCanFollow` com profile pré-carregado) → 403 `FOLLOW_NOT_ALLOWED`; **sem fluxo de solicitação pendente** (SC36 — negação é definitiva). ⚠️ Nesse branch de follow novo, a checagem de `whoCanFollow` ocorre **antes** da de `maxFollowing`
9. `prisma.$transaction` (serializa toggles concorrentes do **mesmo follower**):
   - **TOCTOU**: revalida alvo dentro da tx (`isBanned`, `deletedAt`, `isActive: false`) → `TargetUnavailableError` → 404
   - **Lock FOR UPDATE** do viewer: `tx.$queryRaw\`SELECT "maxFollowing" FROM "User" WHERE id = ${viewerId} FOR UPDATE\`` — cap lido sob lock, sem corrida
   - Já segue → **remove o follow** (200, `following: false` — **também remove notificação do par** via `notification.deleteMany`, anti-flood); segue → conta `follow` do viewer **dentro do tx** (filtro `following: { isActive: true, isBanned: false, deletedAt: null }`) contra `maxFollowing` lido no lock → 409 `MAX_FOLLOWING_REACHED` com `details.max`
   - **Notificação**: dedupe do par **ANTES de criar** (`notification.deleteMany` no mesmo tx, anti-flood) + `notification.create` com `data.followerId`
   - **+5 Versos são uma vez por par** (Sprint 2 review): o marker `FollowReward` (`follow_rewards`, `@@unique([followerId, followingId])`, migration `20260928205906_follow_reward_marker`) só é criado na primeira vez que A segue B — unfollow seguido de re-follow **não** paga de novo; `earnVersos(follower, Follow)` roda **dentro do tx** (atomicidade total) e, se retornar `null` (usuário sem `UserProfile`), a rota **lança e aborta a transação** — o marker nunca é commitado sem pagamento (rollback)
   - **Analytics** (T136 no-op server-side até deploy): `trackFollow(targetId)` no follow; `trackVersosEarned(Follow, amount)` no pagamento
10. Contagens `followingCount`/`followersCount` lidas **dentro do tx** por **`readFollowCounts(tx, targetId, targetId)`** — **subject change SC39**: contagens **sempre escopadas no ALVO** (não no viewer), com o **mesmo filtro das listas e do profile** (`isActive: true, isBanned: false, deletedAt: null`), então contador e lista concordam por construção
11. Todas as respostas de erro pós-rate-limit (incl. o 401 do lookup do viewer e o 500 final) e o sucesso levam `rate.headers`; corridas são resolvidas pela **fonte de verdade**: o catch de `P2002`/`P2025` **não infere qual constraint falhou** — re-quer `prisma.follow.findUnique` e responde conforme o estado real do banco (`link != null` → **201** `following: true`; senão → **200** `following: false`), com contagens frescas via `readFollowCounts(prisma, targetId, targetId)`; try/catch interno: se a **re-query falhar → 500 `INTERNAL_ERROR` JSON com `rate.headers`** (nunca HTML)
12. **Emit WS `follow-update` (room `user:{followingId}`) e, em follow novo, `notification` (room `user:{targetId}`)** — implementado na Phase 2.5 (`emitFollowUpdate`/`emitNotification` de `socket-service/src/emitters.ts`, import via alias `@socket/src/emitters`), **pós-commit e fire-and-forget**; no branch de corrida (tx abortada) só o `follow-update` é emitido (a requisição vencedora cuida da `notification`). Ver `docs/02-architecture/architecture.md` §6.3

### Resposta — 201 Created (novo follow)

```json
{
  "data": {
    "following": true,
    "followingCount": 90,
    "followersCount": 156
  }
}
```

> **SC38 (`statsVisibility: "private"`)**: quando o perfil alvo tem `statsVisibility: "private"`, a resposta **omite** `followingCount` e `followersCount` — apenas `{ "data": { "following": true } }` (201) ou `{ "data": { "following": false } }` (200). O **dono autenticado** (quem visualiza o próprio perfil) **continua vendo os contadores** (Q1).

### Resposta — 200 OK (unfollow)

```json
{
  "data": {
    "following": false,
    "followingCount": 89,
    "followersCount": 155
  }
}
```

### Erros

| Status | Código | Descrição |
|--------|--------|-----------|
| 403 | `CSRF_TOKEN_INVALID` | `enforceCsrf` rejeitou cookie/header (code canônico AC-20) — etapa 1, **antes** do rate limit, portanto sem `rate.headers` |
| 401/403 | `AUTH_TOKEN_INVALID` / `AUTH_ACCOUNT_SUSPENDED` | Falha do `requireAuth` (etapa 2, também **antes** do rate limit — sem `rate.headers`) |
| 401 | `AUTH_TOKEN_INVALID` | Viewer autenticado no token sumiu do DB **depois** do rate limit (lookup do viewer dentro do handler) — leva `rate.headers` |
| 404 | `USER_NOT_FOUND` | Usuário não encontrado, **banido, soft-deleted, ou inativo** (`isActive: false`) |
| 409 | `CANNOT_FOLLOW_SELF` | Não é possível seguir a si mesmo (`details.reason: "self_follow"`) |
| 409 | `MAX_FOLLOWING_REACHED` | `maxFollowing` do viewer atingido — `details.max` = limite configurado (lido sob lock FOR UPDATE) |
| 403 | `FOLLOW_NOT_ALLOWED` | `whoCanFollow` negou — `details.reason` = `privacy_nobody` \| `privacy_following` (SC36) — **só no branch de follow novo** (unfollow nunca passa pelo gate) |
| 429 | `RATE_LIMITED` | Limite follow 20/min — `details.limit: "follow"` |
| 500 | `INTERNAL_ERROR` | Falha interna ou falha na re-query de corrida (`follow.findUnique`) — sempre JSON com `rate.headers`, nunca HTML |

> **Garantias**: toggle idempotente — as corridas **re-querem `follow.findUnique`** e respondem 201/200 coerente com o banco (uma corrida em si **não** vira 500; só uma falha de DB na re-query vira 500 JSON com `rate.headers`) e **+5 Versos uma única vez por par** (`FollowReward`), não a cada re-follow.

---

## GET /users/:username/followers

Lista de seguidores de um usuário (público; **404 anti-timing** para perfil privado e para alvo banido/soft-deleted — `findVisibleProfile` em `src/app/api/v1/users/_helpers.ts`).

> **Implementado (Sprint 2 Phase 1, T044)** em `src/app/api/v1/users/[username]/followers/route.ts` (+ lib `src/lib/social/follow-lists.ts`).

### Requisição

```http
GET /api/v1/users/mariatarot/followers?cursor=...&q=ali&limit=20
Authorization: Bearer <accessToken>   # opcional — habilita isFollowing por item
```

### Parâmetros de Query

| Parâmetro | Tipo | Padrão | Descrição |
|-----------|------|--------|-----------|
| `cursor` | string | — | Cursor keyset base64url de `{createdAt, id}` (reutiliza `encodeFeedCursor`/`decodeFeedCursor` do feed); inválido → página vazia |
| `q` | string | — | Busca case-insensitive por nome ou username do seguidor — **filtra antes** do keyset (q + cursor é AND sobre o mesmo `where`, não um índice dedicado; `?q=` ainda não tem trigram, ver `docs/03-database/indexing.md` §7.1 "Consultas sem índice dedicado") |
| `limit` | number | 20 | Itens por página (máx 50) |

### Resposta — 200 OK (envelope S2-18/SC30)

```json
{
  "data": [
    {
      "userId": "usr_a1b2c3d4",
      "name": "Alice",
      "username": "alice",
      "avatarUrl": null,
      "isFollowing": false
    }
  ],
  "pagination": { "nextCursor": "eyJjcmVhdGVkQXQiOi..." }
}
```

> `isFollowing` presente apenas com Bearer válido (auth opcional via `optionalAuth`, que **também descarta viewer banido/soft-deleted** → `isFollowing` ausente). **Direção: viewer segue o item listado** (mesmo `followerId: viewerId, followingId: item.userId` do perfil público). Ordenação `createdAt desc, id desc`; usuários banidos/soft-delete são filtrados.
>
> **SC38 (`statsVisibility`) — implementado (T044/T045; escopo do dono fechado 2026-09-29)**: `_follow-list.ts` chama `findVisibleProfile` com `requireStatsVisibility: true` e, quando `showStats` é `false` (`statsVisibility: "private"`), responde **404 `USER_NOT_FOUND` para todo viewer exceto o próprio dono** (`viewerId === profile.userId`). O `GET /users/:username/profile` no mesmo cenário responde **200 omitindo** `followersCount`/`followingCount` **para não-dono**; o **dono autenticado continua vendo os contadores** (Q1 "só o dono vê", implementado 2026-09-29 — contrato em `docs/04-api/users.md`). Contadores visíveis usam `readFollowCounts` (SC39/Q2: excluem `isBanned`/`deletedAt`).

### Erros

| Status | Código | Descrição |
|--------|--------|-----------|
| 404 | `USER_NOT_FOUND` | Username inexistente, perfil privado, alvo banido/soft-deleted ou `statsVisibility: "private"` para não-dono (SC38) |
| 422 | `VALIDATION_ERROR` | Username inválido (3–30, `[a-zA-Z0-9_]`) |

### Limitações conhecidas (revisão 2026-09-29 — aguardam decisão do dono)

- **`profileVisibility` não vale no write path do toggle**: `POST /social/follow/:userId` responde 404/403 com base em `User` (inexistente/banido/soft-deleted), mas **não** checa `profileVisibility: "private"` do alvo — seguir um perfil privado responde 201, enquanto o `GET profile` do mesmo usuário responde 404 para não-dono (anti-timing). Pendência de design: decidir se o write path também responde 404 ou se seguir perfil privado é permitido por concepção.
- **Sem rate limit nas listas GET**: `followers`/`following` são públicos e não passam por `enforceSocialLimit` (só o POST usa o limite `follow` 20/min). Pendência: política/valores de rate limit de leitura social ainda não decididos.

---

## GET /users/:username/following

Mesmo contrato de `/followers` para a lista de **seguindo** (T045): `data[]` com `{ userId, name, username, avatarUrl, isFollowing? }` + `pagination.nextCursor`, mesmos `q`/`cursor`/`limit` e mesmos erros.

> **Implementado (Sprint 2 Phase 1, T045)** em `src/app/api/v1/users/[username]/following/route.ts`.

---

## GET /social/feed

Feed principal com publicações de seguidos + conteúdo sugerido (fallback explore em 0 following).

> **Implementado (Sprint 2 Phase 2, T052)** em `src/app/api/v1/social/feed/route.ts` (`requireAuth`; cache Redis `src/lib/feed-cache.ts` é consultado primeiro — hit serve a página materializada **completa** (`nextCursor` = pivot do algoritmo, que já embute o `include`; `limit` vale só para a paginação ao vivo — review 2026-10-01 C1: cortar o cache reencodava o cursor pelo último do ranking e duplicava/pulava posts), miss cai no `getFeed` ao vivo). `POST /social/posts` chama `refreshFeedCache(authorId)` após criar, reconstruindo a página do autor sem esperar o TTL.

### Requisição

```http
GET /api/v1/social/feed?cursor=eyJpZCI6MTIzfQ&limit=20
Authorization: Bearer <accessToken>
```

### Parâmetros de Query

| Parâmetro | Tipo | Padrão | Descrição |
|-----------|------|--------|-----------|
| `cursor` | string | — | Cursor para próxima página |
| `limit` | number | 10 | Itens por página (máx 50) — `FEED_DEFAULT_LIMIT`/`FEED_MAX_LIMIT` em `src/lib/social/feed-algorithm.ts`; fora da faixa 1–50 → 422 `VALIDATION_ERROR` |
| `type` | string | — | **DEFERIDO — não implementado.** O filtro `reading`/`text`/`all` foi adiado por decisão do dono (registrada 2026-09-30/10-01); o `feedQuerySchema` (Zod) de `src/app/api/v1/social/feed/route.ts` só lê `cursor` e `limit`, então `?type=` é **ignorado** (não filtra) |

### Algoritmo do Feed

> **Implementado (Sprint 2 Phase 0.5, T026)** em `src/lib/social/feed-algorithm.ts` — ordenação **S2-5 em 4 níveis** (RF-SOC-002), substituindo o rascunho "70/20/10" que estava aqui:

```
1. Post fixado (isPinned) — máx. 1 por página (applyPinnedCap)
2. Engajamento das últimas 2h (likes + comments×2)
3. Recência (createdAt desc)
4. Desempate: interação prévia do viewer (PostLike/Comment) e depois id desc

Candidatos: posts visíveis (S2-15) — audience='public' OU audience='followers'
de quem eu sigo; perfis privados só aparecem para seguidores; isHidden=false.
0 following → fallback para o conteúdo de explore (somente públicos).
Cursor: base64url de {createdAt, id} = menor (createdAt, id) já lido
(aproximação sobre o ranking — nunca repete nem pula candidatos).
```

> **Cursor e envelope**: `decodeFeedCursor()` espera `{createdAt, id}` (o exemplo `eyJpZCI6MTIzfQ` acima = `{"id":123}` é o formato antigo/ilustrativo). A função `getFeed()` devolve **`{ posts, nextCursor }`** (sem `prevCursor`/`hasMore`/`pagination`) — o envelope `{ data, pagination }` de `docs/04-api/overview.md` §Paginação **é o vencedor fixado pelo S2-18/SC30** e a **T052 envolve sim o retorno da lib** (`{ data: page.posts, pagination: { nextCursor: page.nextCursor } }`) — **só `nextCursor` é emitido** (`null` no fim; `hasMore`/`limit`/`prevCursor` não existem na resposta real). **Cursor inválido → contrato explícito**: `getFeed` devolve página **vazia** com `nextCursor: null` (nunca reinicia no topo — evitaria duplicar conteúdo em loop; review kieran N6).
>
> **Headers**: a resposta sai sempre com `Cache-Control: private, no-store` + `Vary: Authorization` (feed é estritamente pessoal — nunca cache público). Os posts passam por `toPublicPost` (`src/lib/social/post-visibility.ts`): campos de predicado do autor (`isBanned`, `deletedAt`, `isActive`, `profile.privacy`) nunca saem na resposta (mesmo tratamento em trending/search — review Phase 2).

### Resposta — 200 OK

```json
{
  "data": [
    {
      "id": "post_abc123",
      "type": "reading",
      "author": {
        "id": "usr_b2c3d4",
        "name": "Ana Costa",
        "username": "anatarot",
        "avatar": "/avatars/usr_b2c3d4.jpg",
        "personalArcana": "A Estrela"
      },
      "content": {
        "readingId": "rdg_w4x5y6",
        "spreadName": "Três Cartas",
        "mood": "amor",
        "cards": [
          { "position": 1, "cardName": "Os Enamorados", "isReversed": false },
          { "position": 2, "cardName": "Temperança", "isReversed": true },
          { "position": 3, "cardName": "O Sol", "isReversed": false }
        ],
        "interpretation": {
          "summary": "Suas cartas revelam uma jornada amorosa...",
          "hasFullText": true
        }
      },
      "stats": {
        "likes": 23,
        "comments": 5,
        "gifts": 2
      },
      "currentUserActions": {
        "liked": false,
        "gifted": false
      },
      "createdAt": "2025-01-15T09:00:00Z"
    },
    {
      "id": "post_def456",
      "type": "text",
      "author": {
        "id": "usr_e5f6g7",
        "name": "Pedro Luz",
        "username": "pedroluz",
        "avatar": "/avatars/usr_e5f6g7.jpg",
        "personalArcana": "O Mago"
      },
      "content": {
        "text": "Hoje fiz minha primeira leitura de cartas ciganas e me surpreendi com a precisão! Alguém mais tem experiência com Lenormand?"
      },
      "stats": {
        "likes": 45,
        "comments": 12,
        "gifts": 0
      },
      "currentUserActions": {
        "liked": true,
        "gifted": false
      },
      "createdAt": "2025-01-15T08:30:00Z"
    }
  ],
  "pagination": {
    "nextCursor": "eyJpZCI6MTAzfQ"
  }
}
```

> **Shape real do item (T052)**: cada elemento de `data` é um `FeedPost` — a row de `Post` **flat** (`id`, `type`, `content`, `imageUrls`, `readingId`, `audience`, `commentsDisabled`, `likeCount`, `commentCount`, `isPinned`, `isHidden`, `createdAt`, …) + `author { id, name, displayName, avatar }` (`POST_INCLUDE` em `src/lib/social/feed-algorithm.ts`). Os objetos aninhados `content.{spreadName,cards,…}`, `stats` e `currentUserActions` do exemplo acima são o **contrato de produto aspiracional** e **não são emitidos hoje**; `likeCount`/`commentCount` vêm zerados na criação (S2-19 — os incrementos pertencem a T076/T077/T081).

### Erros

| Status | Código | Descrição |
|--------|--------|-----------|
| 401 | `AUTH_TOKEN_INVALID` | Access token ausente/inválido (`requireAuth` — consultado **antes** de cache e algoritmo) |
| 403 | `AUTH_ACCOUNT_SUSPENDED` | Conta suspensa (`requireAuth`) |
| 422 | `VALIDATION_ERROR` | `limit` fora de 1–50 ou não-numérico (Zod) |
| 500 | `INTERNAL_ERROR` | Falha no cache/algoritmo — sempre JSON, nunca HTML |

---

## GET /social/explore

> **RASCUNHO ADIADO / SUPERADO (2026-10-01)** — **esta rota `GET /social/explore` não existe** (`src/app/api/v1/social/explore/route.ts` não há — só os diretórios filhos). O que foi implementado na Sprint 2 Phase 2 (T053–T055) são **três rotas filhas** documentadas abaixo: `/social/explore/trending`, `/social/explore/hashtags` e `/social/explore/suggestions` (mais `GET /social/search`). A página **Explorar** (`src/app/(app)/explorar/page.tsx`, T126) continua **planejada** — hoje só existe `explorar/error.tsx`; o contrato offset+`category`+`period` abaixo ficou como registro do rascunho de produto e **não deve ser implementado sem decisão nova**.

### Requisição _(rascunho, não implementado)_

```http
GET /api/v1/social/explore?page=1&limit=20&category=amor
Authorization: Bearer <accessToken>
```

### Parâmetros de Query _(rascunho, não implementado)_

| Parâmetro | Tipo | Padrão | Descrição |
|-----------|------|--------|-----------|
| `page` | number | 1 | Página |
| `limit` | number | 20 | Itens (máx 50) |
| `category` | string | — | `amor`, `carreira`, `espiritual` |
| `period` | string | `week` | `today`, `week`, `month`, `all` |

### Resposta — 200 OK _(rascunho, não implementado)_

Mesmo formato do feed, sem `nextCursor` (usa offset).

---

## GET /social/explore/trending

Posts em alta — janela de **7 dias** (decisão do dono 2026-09-30), ordenados por `engagementScore = likeCount + commentCount×2` desc.

> **Implementado (Sprint 2 Phase 2, T053)** em `src/app/api/v1/social/explore/trending/route.ts` (+ lib `src/lib/social/explore.ts` → `getTrendingPosts`).

### Requisição

```http
GET /api/v1/social/explore/trending
Authorization: Bearer <accessToken>
```

### Comportamento

1. `requireAuth` → 401/403.
2. Candidatos: `audience='public'` + `isHidden=false` + autor não-banido/não-soft-deleted + `createdAt` nos últimos 7 dias; pré-seleção ordenada por `likeCount` com **cap de 100** (`TRENDING_CANDIDATE_CAP` — `engagementScore` não é expressível no `orderBy` do Prisma; aproximação documentada), rank exato em memória e corte em **20** (`TRENDING_LIMIT`).
3. **Autores com `UserProfile.privacy.profileVisibility = "private"` são excluídos** (fail-closed — decisão do dono 2026-09-30).
4. Headers `Cache-Control: private, no-store` + `Vary: Authorization`.

### Resposta — 200 OK (envelope fixo — sem `pagination`)

```json
{
  "data": {
    "posts": [
      {
        "id": "post_abc123",
        "type": "text",
        "content": "Hoje fiz minha primeira leitura…",
        "likeCount": 23,
        "commentCount": 5,
        "author": { "id": "usr_b2c3d4", "name": "Ana Costa", "displayName": "Ana", "avatar": null },
        "createdAt": "2026-09-28T09:00:00Z"
      }
    ]
  }
}
```

### Erros

| Status | Código | Descrição |
|--------|--------|-----------|
| 401 | `AUTH_TOKEN_INVALID` / 403 `AUTH_ACCOUNT_SUSPENDED` | `requireAuth` |
| 500 | `INTERNAL_ERROR` | Falha de DB — JSON, nunca HTML |

---

## GET /social/explore/hashtags

Top 10 hashtags da semana — posts públicos da última semana com autor ativo.

> **Implementado (Sprint 2 Phase 2, T054)** em `src/app/api/v1/social/explore/hashtags/route.ts` → `getTrendingHashtags` (`src/lib/social/explore.ts`).

### Requisição

```http
GET /api/v1/social/explore/hashtags
Authorization: Bearer <accessToken>
```

### Comportamento

Agrega `PostHashtag` de posts públicos/`isHidden=false`/autor ativo criados nos últimos 7 dias via `rankHashtags()`: conta por tag **descartando autores `private`**, ordena `count` desc com desempate alfabético e corta em **10** (`HASHTAG_LIMIT`). Tags são o lowercase canônico de `parseHashtags`.

### Resposta — 200 OK

```json
{
  "data": {
    "hashtags": [
      { "tag": "tarot", "count": 42 },
      { "tag": "lenormand", "count": 17 }
    ]
  }
}
```

### Erros

| Status | Código | Descrição |
|--------|--------|-----------|
| 401 | `AUTH_TOKEN_INVALID` / 403 `AUTH_ACCOUNT_SUSPENDED` | `requireAuth` |
| 500 | `INTERNAL_ERROR` | Falha de DB — JSON, nunca HTML |

---

## GET /social/explore/suggestions

Perfis sugeridos para seguir.

> **Implementado (Sprint 2 Phase 2, T055)** em `src/app/api/v1/social/explore/suggestions/route.ts` → `getExploreSuggestions(viewerId)`.

### Requisição

```http
GET /api/v1/social/explore/suggestions
Authorization: Bearer <accessToken>
```

### Comportamento

- Exclui no `where`: o próprio viewer, já-seguidos, `isBanned`, `isActive=false` e soft-deleted; depois filtra perfis `private` (fail-closed) em memória (pré-seleção `SUGGESTIONS_CANDIDATE_CAP = 200`).
- Ordenação: **`UserRole.PROFESSIONAL` primeiro**, depois `followersCount` desc, depois `createdAt` desc (decisão do dono 2026-09-30), corte em **10** (`SUGGESTIONS_LIMIT`).
- A privacy é lida **só para filtrar e nunca sai na resposta**.

### Resposta — 200 OK

```json
{
  "data": {
    "users": [
      {
        "id": "usr_b2c3d4",
        "name": "Ana Costa",
        "username": "anatarot",
        "avatar": null,
        "role": "PROFESSIONAL",
        "followersCount": 156
      }
    ]
  }
}
```

### Erros

| Status | Código | Descrição |
|--------|--------|-----------|
| 401 | `AUTH_TOKEN_INVALID` / 403 `AUTH_ACCOUNT_SUSPENDED` | `requireAuth` |
| 500 | `INTERNAL_ERROR` | Falha de DB — JSON, nunca HTML |

---

## GET /social/search

Busca unificada (abas posts / usuários / hashtags) numa única chamada.

> **Implementado (Sprint 2 Phase 2, T056)** em `src/app/api/v1/social/search/route.ts` → `searchSocial(viewerId, q)` (`src/lib/social/search.ts`).

### Requisição

```http
GET /api/v1/social/search?q=amor
Authorization: Bearer <accessToken>
```

### Parâmetros de Query

| Parâmetro | Tipo | Obrigatório | Descrição |
|-----------|------|-------------|-----------|
| `q` | string | Sim | Termo de busca — **mínimo 2, máximo 50 caracteres** (trim); fora da faixa → 422 `VALIDATION_ERROR` (mín. precedente do contrato `GET /users/search`; máx. precedente da lista de seguidores `GET /users/:id/follow-list`, `q ≤ 50`) |

### Comportamento

| Seção | Regra | Limite |
|-------|-------|--------|
| `posts` | `content` case-insensitive + **predicado S2-15** (público OU `followers` de quem o viewer segue; perfil `private` só para quem segue; `isHidden=false`, autor ativo) — ordenação por recência | 20 |
| `users` | nome OU username case-insensitive, ativos/não-banidos/não-soft-deleted, perfis `private` excluídos — ordena por `followersCount` desc; item no shape das sugestões | 20 |
| `hashtags` | `tag` lowercase em posts públicos com autor ativo — **sem janela de tempo** (diferente do trending), agregado por `rankHashtags` | 20 |

Headers `Cache-Control: private, no-store` + `Vary: Authorization`.

> **Implementação (review 2026-10-01, W4–W8)**: os `posts` são buscados em **lotes keyset** (`orderBy [{createdAt desc},{id desc}]` + `cursor/skip:1`, `take = SEARCH_LIMIT` por lote) porque o predicado de perfil `private` é aplicado **pós-fetch** — um `take: 20` único devolveria páginas curtas quando havia privados entre os 20 primeiros. As `hashtags` usam `take = SEARCH_LIMIT * 10` (headroom: `rankHashtags` descarta autores privados **sem** repor). Não voltar para um `take` único sem repor essas duas invariantes.

### Resposta — 200 OK

```json
{
  "data": {
    "posts": [ { "id": "post_abc123", "type": "text", "content": "…", "author": { "id": "usr_b2c3d4", "name": "Ana Costa" } } ],
    "users": [ { "id": "usr_e5f6g7", "name": "Pedro Luz", "username": "pedroluz", "avatar": null, "role": "USER", "followersCount": 12 } ],
    "hashtags": [ { "tag": "tarot", "count": 42 } ]
  }
}
```

### Erros

| Status | Código | Descrição |
|--------|--------|-----------|
| 401 | `AUTH_TOKEN_INVALID` / 403 `AUTH_ACCOUNT_SUSPENDED` | `requireAuth` |
| 422 | `VALIDATION_ERROR` | `q` ausente, com menos de 2 ou mais de 50 caracteres (`details` por campo) |
| 500 | `INTERNAL_ERROR` | Falha de DB — JSON, nunca HTML |

---

## POST /social/posts

Criar uma nova publicação (texto, imagem ou compartilhar tiragem).

> **Implementado (Sprint 2 Phase 2, T051)** em `src/app/api/v1/social/posts/route.ts` (Zod `createPostSchema` de `src/lib/validators/social.ts`).

### Requisição

```http
POST /api/v1/social/posts
Authorization: Bearer <accessToken>
Content-Type: application/json
x-csrf-token: <csrf-token>
```

```json
{
  "type": "reading",
  "content": "Acabei de fazer uma leitura sobre meu futuro profissional. O que vocês acham dessas cartas?",
  "readingId": "rdg_x1y2z3",
  "audience": "public",
  "commentsDisabled": false
}
```

### Comportamento (ordem exata do handler)

1. **CSRF** — `enforceCsrf(request, reqId)` no topo → 403 `CSRF_TOKEN_INVALID` **sem** `rate.headers` (mesmo padrão de `POST /social/follow/:userId`).
2. **`requireAuth`** → 401 `AUTH_TOKEN_INVALID` / 403 `AUTH_ACCOUNT_SUSPENDED`.
3. Corpo JSON + **Zod** (`createPostSchema`) → 422 `VALIDATION_ERROR` com `details[]` por campo — **antes** do rate limit.
4. Lookup do tier do viewer (`User.subscriptionTier`) → `enforceSocialLimit({ limit: "post", tier })` = **10/dia FREE / 50/dia PLUS** (S2-10, janela UTC) → 429 `RATE_LIMITED`.
5. Chave das imagens: cada `imageUrls[i]` **deve** casar exatamente o formato emitido pelo presign T064 — `posts/{userId}/{ts}-{i}.{jpg|png|webp}` (S2-12; `ts` em epoch-ms, `i` ∈ 0–3) — prefixo sozinho, traversal (`..`) ou extensão fora do conjunto → 422 (review Phase 2: `startsWith` aceitava `posts/{userId}/../…`). Com a chave válida: `headObjectSize()` por imagem → `> 5MB` → 422 `VALIDATION_ERROR` (`details.field=imageUrls`, `rate.headers`; S2-12 resolvida em 2026-10-04 — `null`, objeto ausente, segue o caminho normal, mesmo padrão do avatar `confirm`).
6. **Moderação** (`checkContent`, `src/lib/moderation.ts`; decisão do dono 2026-09-30/CHK011): conteúdo flaggado → **403 `CONTENT_BLOCKED` com `details.flaggedWords`**.
7. `type=reading`: `Reading.userId` precisa ser do viewer → senão 403 `READING_ACCESS_DENIED` (uniforme, anti-oráculo).
8. **1 `$transaction`**: `earnVersos(viewer, Reading)` **antes** de criar (só para `type=reading`; retorno `null` = sem `UserProfile` → lança e aborta a tx, padrão K2) → `post.create` → `postHashtag.createMany` (`parseHashtags`, dedupe case-insensitive) da mesma transação.
9. **Contadores intocados**: a criação **não** escreve `likeCount`/`commentCount` (defaults 0) — incrementos pertencem a **T076/T077/T081** (S2-19).
10. **Emit `new-post`** (rooms `user:{id}`/`feed:{id}` dos **seguidores** do autor) — implementado na Phase 2.5 (`emitNewPost` de `socket-service/src/emitters.ts`, pós-commit, fire-and-forget). ⚠️ O nome do plano antigo (`post:new`) **não existe**: o canônico é `new-post` (`RealtimeEventMap`).
11. **Analytics** (T136 no-op server-side até deploy, mesmo estado do follow): `trackPostCreate(type, hasImages)` após a tx e `trackPostLimitHit(tier, limit)` quando o 429 diário dispara.

### Validação

| Campo | Tipo | Obrigatório | Regras |
|-------|------|-------------|--------|
| `type` | string | Sim | `text`, `image`, `reading` |
| `content` | string | Sim se `type=text` | **1–500** caracteres, **não pode ser só espaços em branco** (`type=text`); ≤300 (`type=image`); ≤200 (`type=reading`); vazio/whitespace rejeitado nos demais tipos (`MAX_CONTENT_BY_TYPE` em `src/lib/validators/social.ts`) |
| `imageUrls` | string[] | Sim se `type=image` | 1–4 chaves (S2-12) no formato exato do presign `posts/{userId}/{ts}-{i}.{jpg|png|webp}`; só aceitas em `type=image` |
| `readingId` | string | Sim se `type=reading` | Tiragem do usuário — `readingId` só existe em `type=reading` |
| `audience` | string | Não | `public` (padrão) ou `followers` |
| `commentsDisabled` | boolean | Não | Default `false` |

> **Campo de texto é `content` (não `text`)**: o request usa `content` (Zod) que **vai direto para a coluna `Post.content`** — o antigo contrato com campo `text` + "mapeamento para o schema real" foi removido porque o schema real é o contrato. `audience` → coluna `audience`; `type` também aceita `image` com as imagens em `imageUrls String[]`.

### Resposta — 201 Created

```json
{
  "data": {
    "post": {
      "id": "post_ghi789",
      "type": "reading",
      "content": "Acabei de fazer uma leitura sobre meu futuro profissional…",
      "imageUrls": [],
      "readingId": "rdg_x1y2z3",
      "audience": "public",
      "commentsDisabled": false,
      "likeCount": 0,
      "commentCount": 0,
      "isHidden": false,
      "isPinned": false,
      "authorId": "usr_a1b2c3d4",
      "createdAt": "2026-10-01T10:30:00Z",
      "author": { "id": "usr_a1b2c3d4", "name": "Maria Silva", "displayName": null, "avatar": null }
    }
  }
}
```

### Erros

| Status | Código | Descrição |
|--------|--------|-----------|
| 403 | `CSRF_TOKEN_INVALID` | `enforceCsrf` rejeitou cookie/header — etapa 1, **antes** do rate limit, sem `rate.headers` |
| 401/403 | `AUTH_TOKEN_INVALID` / `AUTH_ACCOUNT_SUSPENDED` | Falha do `requireAuth` (etapa 2, antes do rate limit — sem `rate.headers`) |
| 422 | `VALIDATION_ERROR` | Corpo não-JSON, schema inválido (limite de caracteres por tipo, `imageUrls` fora do padrão/outro usuário, `readingId` em tipo errado, chave de imagem >5MB via `HeadObject` pós-PUT) — `details[]` por campo |
| 429 | `RATE_LIMITED` | Limite diário de posts (10 FREE / 50 PLUS) — `details: { limit: "post", resetAt, retryAfter }` + headers `X-RateLimit-Limit`/`X-RateLimit-Remaining`/`Retry-After` (SC33) |
| 403 | `CONTENT_BLOCKED` | Moderação bloqueou o conteúdo — `details.flaggedWords` (CHK011) |
| 403 | `READING_ACCESS_DENIED` | Tiragem inexistente ou não é do usuário (uniforme — não distingue os dois casos) |
| 500 | `INTERNAL_ERROR` | Falha de DB na transação — JSON com `rate.headers`, nunca HTML |

---

## GET /social/posts/:id

Detalhe de um post: o post + preview de comentários (raízes com respostas aninhadas 1 nível).

> **Implementado (Sprint 2 Phase 2, T057)** em `src/app/api/v1/social/posts/[id]/route.ts` — predicado de visibilidade compartilhado com o og-image em `src/lib/social/post-visibility.ts` (`canViewPost`, CHK006).

### Requisição

```http
GET /api/v1/social/posts/post_abc123
Authorization: Bearer <accessToken>
```

### Comportamento

1. `requireAuth` → 401/403.
2. `post.findUnique` com `author` (`POST_DETAIL_AUTHOR_SELECT`) e `comments` (raízes `parentCommentId: null`, **autores banidos/soft-deleted excluídos** — mesma regra LGPD do predicado do post, review Phase 2, `createdAt desc`, **lote 10**) + `replies` (lote 10, mesmo filtro de autor, mais recentes primeiro — aninhamento de **1 nível**, SC11; mesmo default do endpoint dedicado de comentários T078/RF-SOC-005).
3. **`canViewPost(post, viewerId)`** — responde **404 `POST_NOT_FOUND` uniforme** (anti-timing; nunca revela qual caso) quando:
   - o post não existe;
   - `isHidden` (moderação);
   - autor banido, soft-deleted ou **inativo**;
   - `audience = "followers"` e o viewer **não** segue o autor;
   - perfil do autor `profileVisibility = "private"` e o viewer **não** segue o autor.
   **Exceção**: o **autor vê o próprio post** sem depender de follow (branch do dono não consulta a tabela de follow) — os checks de `isHidden`/banido/inativo acima **continuam valendo para o próprio autor** (autor de post oculto/banido não vê).

### Resposta — 200 OK

```json
{
  "data": {
    "post": {
      "id": "post_abc123",
      "type": "text",
      "content": "Hoje fiz minha primeira leitura…",
      "audience": "public",
      "commentsDisabled": false,
      "likeCount": 23,
      "commentCount": 5,
      "createdAt": "2026-09-28T09:00:00Z",
      "author": { "id": "usr_b2c3d4", "name": "Ana Costa", "displayName": "Ana", "avatar": null }
    },
    "comments": [
      {
        "id": "cmt_xyz789",
        "text": "Que bela leitura!",
        "author": { "id": "usr_a1b2c3d4", "name": "Maria Silva", "displayName": null, "avatar": null },
        "createdAt": "2026-09-28T10:35:00Z",
        "replies": [
          {
            "id": "cmt_rst001",
            "text": "Concordo!",
            "author": { "id": "usr_e5f6g7", "name": "Pedro Luz", "displayName": null, "avatar": null },
            "createdAt": "2026-09-28T10:40:00Z"
          }
        ]
      }
    ]
  }
}
```

> `comments` sai **de dentro** de `data` (junto com `post`) para não duplicar o payload; **não há paginação nesta rota** — é o preview de 10/10; a listagem paginada completa é `GET /social/posts/:id/comments` (T078, planejado).
>
> **Headers e projeção (review Phase 2)**: sucesso e erros saem com `Cache-Control: private, no-store` + `Vary: Authorization` (o post pode ser gated). O `post` da resposta passa por `toPublicPost` (`src/lib/social/post-visibility.ts`) — campos de predicado do autor (`isBanned`, `deletedAt`, `isActive`, `profile.privacy`) **nunca saem na resposta** (mesmo princípio do Explore).

### Erros

| Status | Código | Descrição |
|--------|--------|-----------|
| 401 | `AUTH_TOKEN_INVALID` / 403 `AUTH_ACCOUNT_SUSPENDED` | `requireAuth` |
| 404 | `POST_NOT_FOUND` | **Uniforme** para os 5 casos de invisibilidade acima (anti-timing — Q28) |
| 500 | `INTERNAL_ERROR` | Falha de DB — JSON, nunca HTML |

---

## GET /social/posts/:id/og-image

OG image (PNG 1200×630) para preview de compartilhamento.

> **Implementado (Sprint 2 Phase 2, T058)** em `src/app/api/v1/social/posts/[id]/og-image/route.ts` — gera via `generatePostOgImage` (`src/lib/og-image.ts`, T029) e usa o **mesmo predicado** `canViewPost`/`postIsGated` do detalhe (CHK006).

### Requisição

```http
GET /api/v1/social/posts/post_abc123/og-image
# Bearer opcional (optionalAuth) — crawlers de preview chegam sem token
```

### Comportamento

| Viewer | Post público | Post gated (`followers` ou perfil `private`) |
|--------|--------------|-----------------------------------------------|
| **Anônimo** (crawler) | 200 `image/png`, `Cache-Control: public, max-age=3600, s-maxage=86400` | **404 `POST_NOT_FOUND`** (CHK005 — OG de conteúdo restrito não é buscável por terceiros) |
| **Autenticado sem follow** | 200 PNG público | **404 `POST_NOT_FOUND`** |
| **Seguidor (ou o próprio autor)** | 200 PNG | 200 PNG, `Cache-Control: private, no-store` |

- **Cache no 200** (review 2026-10-01): público sai **sem** `Vary: Authorization` (resposta idêntica com ou sem token — o Vary só fragmentaria o cache do CDN por sessão); gated sai `Cache-Control: private, no-store`. **Erros 404/500** saem com `Cache-Control: private, no-store` + `Vary: Authorization` (nunca cacheável — mesmo padrão do detalhe do post).
- `optionalAuth`: token inválido/ausente → `viewerId = null` (nunca 401 nesta rota).
- 404 é **uniforme** para inexistente/`isHidden`/autor banido (mesmos casos do detalhe).

### Resposta — 200 OK

`Content-Type: image/png` + `Content-Length`; corpo = bytes do PNG (não JSON).

### Erros

| Status | Código | Descrição |
|--------|--------|-----------|
| 404 | `POST_NOT_FOUND` | Post gated/oculto/inexistente para este viewer (uniforme) |
| 500 | `INTERNAL_ERROR` | Falha do generator (`generatePostOgImage`) — JSON, nunca HTML |

---

## POST /social/posts/images/presign

Presign de imagens de post para PUT direto no R2.

> **Implementado (Sprint 2 Phase 2, T064)** em `src/app/api/v1/social/posts/images/presign/route.ts` (Zod `postImagesPresignSchema` de `src/lib/validators/social.ts`; reutiliza `generatePresignedUrl` de `src/lib/r2.ts`, mesmo padrão do presign de avatar).

### Requisição

```http
POST /api/v1/social/posts/images/presign
Authorization: Bearer <accessToken>
Content-Type: application/json
x-csrf-token: <csrf-token>
```

```json
{
  "images": [{ "contentType": "image/jpeg" }, { "contentType": "image/png" }]
}
```

### Comportamento (ordem exata do handler)

1. **CSRF** (`enforceCsrf`) → 403 `CSRF_TOKEN_INVALID` sem `rate.headers`.
2. **`requireAuth`** → 401/403.
3. Corpo JSON + Zod: `images` 1–4, `contentType` ∈ `image/jpeg` \| `image/png` \| `image/webp` → 422 `VALIDATION_ERROR` com `details[]`.
4. **Tamanho**: **não** é checado no presign (review 2026-10-01 C2 — o `Content-Length` deste request é o do **JSON**, não da imagem; o check antigo era morto). O guard de 5MB é do objeto **após** o PUT: a criação do post (`POST /social/posts`) faz `HeadObject` por chave e rejeita >5MB (S2-12 resolvida em 2026-10-04 — ver o Fluxo S2-12 abaixo).
5. **Rate limit** `upload` = **20/dia** (S2-10) → 429 `RATE_LIMITED` com `rate.headers`.
6. Gera uma URL por imagem com key `posts/{userId}/{ts}-{i}.{ext}` (`image/jpeg` → `jpg`; ext canônico por MIME — `EXT_BY_TYPE` em `src/lib/validators/social.ts`, single source), expiração **300s** (CHK014).

> **Fluxo S2-12**: o cliente faz o **PUT direto ao R2** com a `uploadUrl` e depois envia as `key`s em `POST /social/posts` (`imageUrls`, chave no formato `posts/{userId}/{ts}-{i}.{ext}` validada lá). **Tamanho revalidado na criação do post** (S2-12 resolvida em 2026-10-04): `headObjectSize()` (`HeadObject` por chave, sem re-baixar) → `> 5MB` → 422 `VALIDATION_ERROR` (`details.field=imageUrls`, `rate.headers`); `null` (objeto ausente) segue o caminho normal — mesmo padrão do avatar `confirm`. O presign **não** mede o tamanho (ver item 4) e o cliente valida ≤5MB antes do upload.
>
> **Exibição da imagem**: a `key` guardada em `Post.imageUrls` é resolvida para URL pública no client por `src/components/social/post-card.tsx` via `getR2PublicUrl()` de **`src/lib/r2-public-url.ts`** (env `NEXT_PUBLIC_R2_PUBLIC_URL`, fallback `https://r2.arkanaagora.com` — single source server/client; `src/lib/r2.ts` reexporta a mesma base; fusão de 2026-10-01; ver `docs/environments.md`).

### Resposta — 200 OK

Envelope **top-level** `{ uploads }` (mesmo shape do presign de avatar — **sem** wrapper `data`):

```json
{
  "uploads": [
    { "uploadUrl": "https://<bucket>.r2.cloudflarestorage.com/posts/usr_a1b2c3d4/1727781000000-0.jpg?X-Amz-…", "key": "posts/usr_a1b2c3d4/1727781000000-0.jpg" },
    { "uploadUrl": "https://<bucket>.r2.cloudflarestorage.com/posts/usr_a1b2c3d4/1727781000000-1.png?X-Amz-…", "key": "posts/usr_a1b2c3d4/1727781000000-1.png" }
  ]
}
```

Sempre com `X-RateLimit-Limit`/`X-RateLimit-Remaining` (`rate.headers`).

### Erros

| Status | Código | Descrição |
|--------|--------|-----------|
| 403 | `CSRF_TOKEN_INVALID` | `enforceCsrf` — etapa 1, antes do rate limit, sem `rate.headers` |
| 401/403 | `AUTH_TOKEN_INVALID` / `AUTH_ACCOUNT_SUSPENDED` | `requireAuth` |
| 422 | `VALIDATION_ERROR` | Corpo não-JSON; lista vazia; **mais de 4 imagens**; `contentType` fora de jpeg/png/webp — `details[]` por campo |
| 429 | `RATE_LIMITED` | Limite de upload 20/dia — `details: { limit: "upload", resetAt, retryAfter }` + `rate.headers` |
| 500 | `INTERNAL_ERROR` | Falha ao gerar a URL assinada (R2) — JSON com `rate.headers`, nunca HTML |

---

## DELETE /social/posts/:id

Remove uma publicação.

> **Planejado — rota não existe** (`src/app/api/v1/social/posts/[id]/route.ts` só tem o `GET` de detalhe; nenhuma rota `DELETE` em `src/app/api/v1/social/`).

### Requisição

```http
DELETE /api/v1/social/posts/post_abc123
Authorization: Bearer <accessToken>
```

### Erros

| Status | Código | Descrição |
|--------|--------|-----------|
| 404 | `POST_NOT_FOUND` | Publicação não encontrada |
| 403 | `POST_OWNERSHIP_DENIED` | Não é autor da publicação |

---

## POST /social/posts/:id/like

Curtir (ou descurtir) uma publicação.

> **Planejado (T076) — rota não existe.** Até lá o `PostCard` (`src/components/social/post-card.tsx`) renderiza o botão de like com `aria-disabled` (placeholder até T076/T077) e `likeCount`/`commentCount` nascem em **0** na criação (S2-19 — os incrementos pertencem a T076/T077/T081).

### Requisição

```http
POST /api/v1/social/posts/post_abc123/like
Authorization: Bearer <accessToken>
```

### Comportamento

- **Toggle**: Se já curtiu → descurte. Se não curtiu → curte.
- Dispara notificação ao autor (se curtiu).

### Resposta — 200 OK

```json
{
  "data": {
    "liked": true,
    "likesCount": 24
  }
}
```

---

## POST /social/posts/:id/comments

Comentar em uma publicação.

> **Planejado (T077) — rota não existe.** O preview de comentários já vem embutido em `GET /social/posts/:id` (raízes + 1 nível, lote 10).

### Requisição

```http
POST /api/v1/social/posts/post_abc123/comments
Authorization: Bearer <accessToken>
Content-Type: application/json
```

```json
{
  "text": "Que bela leitura! O Sol no futuro é um ótimo sinal. ✨",
  "parentCommentId": null
}
```

### Validação

| Campo | Tipo | Obrigatório | Regras |
|-------|------|-------------|--------|
| `text` | string | Sim | 1–300 caracteres |
| `parentCommentId` | string | Não | ID do comentário pai (resposta) |

### Resposta — 201 Created

```json
{
  "data": {
    "comment": {
      "id": "cmt_xyz789",
      "postId": "post_abc123",
      "author": {
        "id": "usr_a1b2c3d4",
        "name": "Maria Silva",
        "avatar": "/avatars/usr_a1b2c3d4.jpg"
      },
      "text": "Que bela leitura! O Sol no futuro é um ótimo sinal. ✨",
      "parentCommentId": null,
      "replies": 0,
      "createdAt": "2025-01-15T10:35:00Z"
    }
  }
}
```

---

## GET /social/posts/:id/comments

Lista comentários de uma publicação.

> **Planejado (T078) — rota não existe.** ⚠️ **Divergência de contrato**: o plano T078 prevê resposta **cursor-based com lote default 10**; o exemplo abaixo (offset `page`/`totalItems`) é o rascunho antigo deste documento — alinhar ao envelope S2-18 `{ data, pagination: { nextCursor } }` na implementação.

### Requisição

```http
GET /api/v1/social/posts/post_abc123/comments?page=1&limit=20
```

### Resposta — 200 OK

```json
{
  "data": [
    {
      "id": "cmt_xyz789",
      "author": {
        "id": "usr_a1b2c3d4",
        "name": "Maria Silva",
        "avatar": "/avatars/usr_a1b2c3d4.jpg"
      },
      "text": "Que bela leitura!",
      "replies": [
        {
          "id": "cmt_rst001",
          "author": { "id": "usr_b2c3d4", "name": "Ana Costa" },
          "text": "Concordo! E as cartas estão bem posicionadas.",
          "createdAt": "2025-01-15T10:40:00Z"
        }
      ],
      "createdAt": "2025-01-15T10:35:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "totalItems": 5,
    "totalPages": 1
  }
}
```

---

## POST /social/gifts

Enviar um presente virtual a um usuário.

> **Planejado (T120) — rota não existe** (divergências de rota/body/model listadas em "Divergências contrato ↔ código" abaixo).

### Requisição

```http
POST /api/v1/social/gifts
Authorization: Bearer <accessToken>
Content-Type: application/json
```

```json
{
  "toUserId": "usr_b2c3d4",
  "giftId": "bola-de-cristal"
}
```

### Presentes disponíveis

> **Catálogo autoritativo (Sprint 2 Phase 0.5 / T036)**: `src/lib/social/gifts.ts` — SPEC-007 exato, ids kebab-case, preços fixos em **Versos** ("Moedas" do spec = Versos; a lista antiga com 4 itens/`crystal_ball` foi substituída). O id vai em `Gift.giftId`.

| giftId | Nome | Custo (Versos) |
|--------|------|---------------|
| `estrela-cadente` | Estrela Cadente | 10 |
| `rosa-mistica` | Rosa Mística | 25 |
| `cristal-de-quartzo` | Cristal de Quartzo | 50 |
| `bola-de-cristal` | Bola de Cristal | 100 |
| `coroa-astral` | Coroa Astral | 200 |
| `dragao-dourado` | Dragão Dourado | 500 |

> **Divergências contrato ↔ código (revisadas no Phase 0.5):**
>
> 1. **Catálogo — resolvido**: a fonte canônica é `src/lib/social/gifts.ts` (T036/SPEC-007, 6 gifts) e não mais esta tabela histórica; `docs/06-features/gifts.md` já foi sincronizado.
> 2. **Ainda aberto (Phase 7, T120)**: rota/body — o plano prevê `POST /api/v1/social/gifts/send` com `{ toUserId, giftId }` (aqui documentado como `POST /social/gifts`); e o model `Gift` **não tem** `postId` nem `message` (colunas reais: `fromUserId`, `toUserId`, `giftId`, `coinCost`, `recipientEarnsHalf`) — gifting sobre um post precisa de decisão de modelagem.
> 3. **Moeda — resolvida**: o saldo real é `UserProfile.versosBalance` (**Versos**); error code de saldo insuficiente = `INSUFFICIENT_VERSOS` (não `INSUFFICIENT_COINS`); `coinCost` guarda o custo em Versos.

### Resposta — 201 Created

```json
{
  "data": {
    "gift": {
      "id": "gift_abc123",
      "fromUserId": "usr_a1b2c3d4",
      "toUserId": "usr_b2c3d4",
      "giftId": "bola-de-cristal",
      "coinCost": 100,
      "recipientEarnsHalf": false,
      "createdAt": "2025-01-15T10:40:00Z"
    },
    "balance": {
      "versosBalance": 45
    }
  }
}
```

### Erros

| Status | Código | Descrição |
|--------|--------|-----------|
| 400 | `INSUFFICIENT_VERSOS` | Versos insuficientes |
| 404 | `USER_NOT_FOUND` | Destinatário não encontrado |
| 404 | `POST_NOT_FOUND` | Publicação não encontrada |
| 409 | `CANNOT_GIFT_SELF` | Não é possível presentear a si mesmo |

---

## GET /social/notifications

Lista notificações do usuário.

> **Planejado (T082) — rota não existe** (Phase 6). A Phase 2 (2026-10-01) entregou posts/feed/explore/search, não notifications.

### Requisição

```http
GET /api/v1/social/notifications?cursor=eyJpZCI6NTB9&limit=20&unreadOnly=true
Authorization: Bearer <accessToken>
```

### Parâmetros de Query

| Parâmetro | Tipo | Padrão | Descrição |
|-----------|------|--------|-----------|
| `cursor` | string | — | Cursor de paginação |
| `limit` | number | 20 | Itens (máx 50) |
| `unreadOnly` | boolean | `false` | Apenas não lidas |

### Tipos de notificação

| Tipo | Descrição |
|------|-----------|
| `follow` | Alguém seguiu você |
| `like` | Alguém curtiu sua publicação |
| `comment` | Alguém comentou sua publicação |
| `gift` | Alguém te enviou um presente |
| `mention` | Alguém te mencionou |
| `system` | Notificação do sistema |

> **Tipos reais no schema (Sprint 2 Phase 0)**: `Notification.type` documenta `follow`, `like`, `comment`, `gift`, `mention` e **`horoscope`** — este contrato traz **`system`** em vez de `horoscope`, e `docs/06-features/notifications.md` descreve ainda **8 categorias** (inclui pagamento, leitura compartilhada, lembrete diário). Definir o conjunto canônico antes de implementar as rotas. Além disso, o payload `actor`/`resource` tem de caber em `data Json?` — as colunas reais são `userId`, `type`, `message`, `data`, `isRead`, `createdAt`.

### Resposta — 200 OK

```json
{
  "data": [
    {
      "id": "notif_001",
      "type": "like",
      "actor": {
        "id": "usr_e5f6g7",
        "name": "Pedro Luz",
        "avatar": "/avatars/usr_e5f6g7.jpg"
      },
      "resource": {
        "type": "post",
        "id": "post_abc123"
      },
      "message": "Pedro Luz curtiu sua publicação",
      "isRead": false,
      "createdAt": "2025-01-15T10:30:00Z"
    },
    {
      "id": "notif_002",
      "type": "follow",
      "actor": {
        "id": "usr_h7i8j9",
        "name": "Luna Estelar",
        "avatar": "/avatars/usr_h7i8j9.jpg"
      },
      "message": "Luna Estelar começou a te seguir",
      "isRead": true,
      "createdAt": "2025-01-15T09:00:00Z"
    }
  ],
  "pagination": {
    "nextCursor": "eyJpZCI6MzB9",
    "hasMore": true,
    "unreadCount": 7
  }
}
```

> **Contrato × hook (divergência conhecida, review Step 5; nota atualizada no Phase 1, 2026-09-28)**: o contrato acima (envelope `{ data, pagination }`) é o de `docs/04-api/overview.md` e **é o vencedor fixado pelo S2-18/SC30** — a primeira rota social existente (`GET /users/:username/{followers,following}`, T044/T045) já responde nele. O T082 do plano ainda especifica resposta **flat** `{ notifications, unreadCount, nextCursor }`. O hook `useNotifications` (`src/hooks/use-social.ts`) **aceita os dois shapes** (zod union, normaliza para `NotificationsPage { notifications, nextCursor, unreadCount }`) porque **a rota de notificações continua inexistente** (Phase 6/T082 — a Phase 1 entregou follow e a Phase 2 posts/feed, não notifications; a Phase 2.5 adicionou **`GET /social/polling/notifications`**, que é outro endpoint — delta desde `since` + `unreadCount`, ver §polling no fim deste documento); quando T082 chegar, entregar no envelope e **estreitar o hook** (union pode ser removida). `useUnreadCount()` não tem endpoint dedicado documentado: usa `GET /social/notifications?limit=1&unreadOnly=true` lendo `unreadCount` (T038 exige o hook) e retorna `number` (`?? 0`). **Atualização Phase 2.5 (2026-10-02)**: o badge do header **não** passa mais por `useUnreadCount()` — `src/components/layout/app-header.tsx` lê `unreadCount` do `NotificationsProvider` (carga inicial one-shot em `GET /social/polling/notifications?since=` + incremento por evento `notification` do WebSocket); `useUnreadCount()` continua exportado por `src/hooks/use-social.ts` mas **não é consumido por nenhum componente de UI** (só por `tests/hooks/use-social.test.tsx`).

---

## PATCH /social/notifications/read

Marca notificações como lidas.

> **Planejado — rota não existe.** ⚠️ **Divergência de contrato**: o plano prevê **duas rotas** — `PATCH /social/notifications/:id/read` (T083) e `PATCH /social/notifications/read-all` (T084) — enquanto este documento documenta **uma** rota `PATCH /social/notifications/read` com `{ notificationIds, readAll }`. Resolver na Phase 6 antes de implementar.

### Requisição

```http
PATCH /api/v1/social/notifications/read
Authorization: Bearer <accessToken>
Content-Type: application/json
```

```json
{
  "notificationIds": ["notif_001", "notif_003"],
  "readAll": false
}
```

### Validação

| Campo | Tipo | Regras |
|-------|------|--------|
| `notificationIds` | string[] | IDs das notificações (máx 50) |
| `readAll` | boolean | Se `true`, ignora `notificationIds` e marca todas como lidas |

### Resposta — 200 OK

```json
{
  "data": {
    "markedAsRead": 2,
    "unreadCount": 5
  }
}
```

---

## GET /social/polling/{posts,likes,comments,notifications}

**Fallback REST do realtime** (T071 — Sprint 2 Phase 2.5, 2026-10-02): enquanto o WebSocket está desconectado, o cliente (`src/hooks/use-socket.ts`) pergunta "o que mudou desde `since`?" **a cada 30s**; assim que o socket conecta o polling é suprimido. Base compartilhada: `src/app/api/v1/social/polling/polling-utils.ts` — todos os guards comuns foram consolidados em **`guardPolling(request, reqId)`** (revisão S), que devolve `{ userId, since, until, serverTime }` para as rotas.

### Comportamento comum às 4 rotas

1. **`requireAuth`** → 401 `AUTH_TOKEN_INVALID` / 403 `AUTH_ACCOUNT_SUSPENDED` (método GET — **sem CSRF**).
2. **Rate limit** (revisão O): `enforceSocialLimit({ limit: "polling" })` — **60/min por usuário** com chave compartilhada `rl:polling:<userId>` entre as 4 rotas (teto agregado, não por rota) → 429 **`RATE_LIMITED`** com `Retry-After`/`X-RateLimit-*`; fail-open com `logger.warn("rate_limiter_bypass")` se o Redis estiver indisponível. Ordem: **depois** do `requireAuth` (401/403 antecipam o check) e **antes** da validação de `since`.
3. **`?since=`** ISO-8601 **opcional**: ausente → janela default `POLLING_DEFAULT_SINCE_MS` = **5 min** atrás (cursor inicial `INITIAL_CURSOR()` do hook); formato inválido → **422 `VALIDATION_ERROR`** com `details[] { field: "since", message: "since deve ser uma data ISO-8601" }`; amplitude limitada a **24 h** por `POLLING_MAX_SINCE_MS` (`src/lib/social/polling-window.ts`, integridade C1 da revisão multi-agente 2026-10-04): `since` mais antigo que o teto é **limitado ao teto** no servidor (clamp, não 422 — o cliente de cursor velho, p.ex. aba aberta >24 h offline, se auto-cura ao avançar o cursor em vez de ficar preso em erro). **Não há cursor opaco** — o cliente manda o timestamp do último poll (`postsCursor`/`notificationsCursor`), corrigido pelo anti-skew abaixo.
3a. **`?until=`** ISO-8601 **opcional** (revisão I-1 — drenagem de backlog): teto superior da janela, combinado ao `since` como `createdAt: { gte: since, lt: until }` (**revisão A1** — `gte` inclusivo: `gt` perdia itens criados no mesmo ms do cursor); usado pelo hook quando a página veio **cheia (≥ `POLLING_TAKE` = 50)** para varrer o resto sem avançar o `since`. Ausente → sem `lt` (contrato antigo preservado); formato inválido → **422 `VALIDATION_ERROR`** com `details[] { field: "until", message: "until deve ser uma data ISO-8601" }`. Implementação: `resolveUntil()` em `src/app/api/v1/social/polling/polling-utils.ts`; constantes da fronteira cliente/servidor (`POLLING_DEFAULT_SINCE_MS`, `POLLING_TAKE`) em **`src/lib/social/polling-window.ts`**.
4. **`serverTime`** (revisão S): toda resposta de sucesso inclui `serverTime` (ISO-8601) **no topo do envelope** — `{ data: { … }, serverTime }` — capturado **antes** da query (relógio do servidor no momento do request).
5. Limite de **50 rows** por rota (`POLLING_TAKE`, em `src/lib/social/polling-window.ts`), ordenação `createdAt desc` (relação **inclusiva `>=`** com `since` — revisão A1: um refetch na mesma fronteira de ms pode re-entregar o item-limite; o cliente deduplica por id; o lado bom é não perder mais nada nessa fronteira) — página cheia (50 rows) sinaliza backlog e o cliente drena com `until` (item 3a).
6. Headers **`Cache-Control: private, no-store` + `Vary: Authorization`** (`POLLING_HEADERS`) em sucesso e erro; erro interno → 500 `INTERNAL_ERROR`.

| Rota | Filtro | Conteúdo de `{ data: … }` (envelope plano, mesmo padrão do feed) |
|------|--------|--------------------|
| `GET /social/polling/posts` | posts de quem o **viewer segue** (`authorId in following`, `audience in (public, followers)`, `isHidden=false`, autor ativo/banido/soft-delete filtrados; `following` limitado a **500** por poll — `POLLING_FOLLOW_TAKE`, paridade com `MAX_FANOUT_FOLLOWERS`) | `{ posts: FeedPost[] }` — mesmo `toPublicPost()` de `GET /social/feed` |
| `GET /social/polling/likes` | `PostLike` nos **posts próprios** do viewer desde `since` (`post.authorId = viewer`, `post.isHidden=false`; liker ativo/banido/soft-delete filtrado — revisão A1, mesmos predicados do comments; só metadados — RF-SOC-004 não expõe a lista completa de quem curtiu) | `{ likes: [{ id, postId, userId, createdAt }] }` |
| `GET /social/polling/comments` | `Comment` nos **posts próprios** do viewer desde `since` (`post.authorId = viewer`, `post.isHidden=false`; autor do comentário ativo/banido/soft-delete filtrado) | `{ comments: [{ id, postId, authorId, parentCommentId, content, createdAt }] }` |
| `GET /social/polling/notifications` | `Notification` do viewer desde `since` **+ contagem atual de não lidas** (`isRead=false`) | `{ notifications: Notification[], unreadCount: number }` |

### Consumo no cliente (estado atual)

- `src/hooks/use-socket.ts` só chama **`posts`** e **`notifications`**, re-disparando os eventos `new-post`/`notification` no mesmo dispatch do WebSocket; **`likes`/`comments` não têm consumidor hoje** (o wiring de like/comment é Phase 3 — T076/T077).
- **Cursor anti-skew** (revisão S): o cliente envia `sentAt` (relógio local) no corpo do poll e usa `pollingCursor(sentAt, serverTime)` = o **mais antigo** dos dois como `since` do próximo poll — nunca pula a janela sob nenhum skew de relógio (servidor à frente → `sentAt`; servidor atrás → `serverTime`); qualquer sobreposição é absorvida pelo dedup por id no cliente.
- **Cursor por endpoint `{since, until, pending}`** (revisão I-1, `PollCursor` em `src/hooks/use-socket.ts`): um poll só avança o cursor do endpoint que deu certo (`postsCursor`/`notificationsCursor` são independentes); página cheia (≥ `POLLING_TAKE`) **trava o `since`, guarda o avanço em `pending` e drena o backlog com `?until=`** — `pending` só vira `since` quando a drenagem termina com página < 50, cobrindo o que foi criado durante a janela travada.
- `NotificationsProvider` (`src/components/social/notifications-provider.tsx`, montado em `src/app/(app)/layout.tsx`) faz a carga inicial one-shot de `unreadCount` e incrementa a cada evento `notification` — **dedup por id** com `SEEN_IDS_CAP` = 500 (revisão C); o badge fica em `src/components/layout/app-header.tsx`.
- Pill do feed: `useFeedRealtime()` (`src/hooks/use-feed.ts`) busca `GET /social/posts/:id` a cada `new-post` e enfileira via `emitPendingPost` (dedup por id na fila do `useFeed`).
- **Sem catch-up**: eventos emitidos enquanto o cliente estava offline **não** são recuperados na reconexão (o polling só roda enquanto está desconectado) — pendência registrada na Phase 2.5.

### Pendências de segurança conhecidas (Phase 2.5 — atualizado nas revisões)

- ~~O join de rooms `post:`/`comment:` no socket-service não checa visibilidade~~ — **resolvido para `post:` na revisão M** (`verifyRoomAccess` em `socket-service/src/room-access.ts`: `GET /api/v1/social/posts/{id}` com o Bearer do socket; 401/403/404 → `room_forbidden`; 5xx/timeout → fail-open). `comment:{id}` **segue fail-open** até o endpoint de comentário existir (T077/Phase 3).
- ~~As 4 rotas de polling sem rate limit~~ — **resolvido na revisão O**: `limit: "polling"` 60/min por usuário, aplicado em `guardPolling()` (item 2 acima; `docs/07-security/security.md` §Rate Limiting). As demais rotas de leitura social (feed/explore/search/posts/:id/og-image) continuam sem rate limit próprio (pendência de política aberta).

### Testes

`tests/integration/polling.test.ts` (4 rotas — incl. rate limit revisão O, `serverTime` revisão S e **`until`/drenagem de backlog revisão I-1**), `tests/integration/websocket-server.test.ts`, `tests/integration/websocket-relay.test.ts`, `tests/integration/websocket.test.ts`, `tests/integration/realtime-bus.test.ts`, `tests/integration/social-realtime-wiring.test.ts`, `tests/unit/socket-env.test.ts`, `tests/unit/socket-deploy-contract.test.ts`, `tests/unit/socket-auth.test.ts`, `tests/unit/socket-service-boundary.test.ts`, `tests/unit/lockfile-sync.test.ts`, `tests/next-config-ws-warn.test.ts`, `tests/hooks/use-socket.test.tsx`, `tests/components/notifications-provider.test.tsx` + E2E `tests/e2e/social-realtime.spec.ts` (T075 — 3 cenários reais passando: pill via WebSocket, badge de notificação, polling+reconexão; **3 `test.fixme`** para like/comment/gift até a Phase 3).