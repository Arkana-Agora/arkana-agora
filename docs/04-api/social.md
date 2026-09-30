# API Social — arkana-agora

> **Módulo**: `src/app/api/v1/social/` | **Autenticação**: Obrigatória nas rotas de escrita (`POST /social/follow/:userId` exige Bearer; as listas `GET /users/:username/{followers,following}` usam **auth opcional** — `optionalAuth`, o Bearer só habilita `isFollowing`) | **Paginação**: Cursor-based
>
> **Status (2026-09-29)**: **follow implementado (Sprint 2 Phase 1, T043–T050; revisado 2026-09-29)** — `POST /social/follow/:userId` (toggle), `GET /users/:username/followers` e `GET /users/:username/following` existem em `src/app/api/v1/social/follow/[userId]/route.ts` e `src/app/api/v1/users/[username]/{followers,following}/route.ts` (+ lib `src/lib/social/{privacy,follow-lists}.ts`); testes em `tests/integration/social-follow.test.ts` (31 casos, incl. 3 de corrida), `tests/social-privacy.test.ts` e `tests/find-visible-profile.test.ts` (9 — `findVisibleProfile`/SC38). As **demais rotas deste documento continuam planejadas** (o diretório `src/app/api/v1/social/` só contém `follow/`; nenhum código chama `prisma.post`/`prisma.comment`/etc.). Desde o Sprint 2 Phase 0 os **models** de suporte existem no schema (`prisma/schema.prisma`, migração `20260926182325_sprint2_social_horoscopes`): `Follow`, `Post`, `Comment`, `PostLike`, `CommentLike`, `PostHashtag`, `Gift`, `Notification`, `ContentReport`. Desde o **Phase 0.5** as **utilidades compartilhadas** que as rotas vão usar já existem: `src/lib/social/{feed-algorithm,limits,gifts,versos,mentions}.ts`, `src/lib/moderation.ts`, `src/lib/csrf.ts` + `src/lib/middleware/{rate-limit,csrf}.ts`, `src/lib/feed-cache.ts`, `src/hooks/use-social.ts`.

## Sumário

- [POST /social/follow/:userId](#post-socialfollowuserid)
- [GET /users/:username/followers](#get-usersusernamefollowers)
- [GET /users/:username/following](#get-usersusernamefollowing)
- [GET /social/feed](#get-socialfeed)
- [GET /social/explore](#get-socialexplore)
- [POST /social/posts](#post-socialposts)
- [DELETE /social/posts/:id](#delete-socialpostsid)
- [POST /social/posts/:id/like](#post-socialpostsidlike)
- [POST /social/posts/:id/comments](#post-socialpostsidcomments)
- [GET /social/posts/:id/comments](#get-socialpostsidcomments)
- [POST /social/gifts](#post-socialgifts)
- [GET /social/notifications](#get-socialnotifications)
- [PATCH /social/notifications/read](#patch-socialnotificationsread)

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
12. Emit WS `follow-update`/`notification` (room `user:{targetId}`) fica para **T088** — não implementado nesta fase

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

Feed principal com publicações de seguidos + conteúdo sugerido.

### Requisição

```http
GET /api/v1/social/feed?cursor=eyJpZCI6MTIzfQ&limit=20
Authorization: Bearer <accessToken>
```

### Parâmetros de Query

| Parâmetro | Tipo | Padrão | Descrição |
|-----------|------|--------|-----------|
| `cursor` | string | — | Cursor para próxima página |
| `limit` | number | 10 | Itens por página (máx 50) — `FEED_DEFAULT_LIMIT`/`FEED_MAX_LIMIT` em `src/lib/social/feed-algorithm.ts` |
| `type` | string | Todos | `reading`, `text`, `all` |

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

> **Cursor e envelope**: `decodeFeedCursor()` espera `{createdAt, id}` (o exemplo `eyJpZCI6MTIzfQ` acima = `{"id":123}` é o formato antigo/ilustrativo). A função `getFeed()` devolve **`{ posts, nextCursor }`** (sem `prevCursor`/`hasMore`/`pagination`) — o envelope `{ data, pagination }` de `docs/04-api/overview.md` §Paginação **é o vencedor fixado pelo S2-18/SC30** (a primeira rota social a existir, `GET /users/:username/{followers,following}` T044/T045 no Phase 1, já responde nele), logo a **T052 deve envolver** o retorno da lib em `{ data, pagination }` em vez de expor `{ posts, nextCursor }` cru. **Cursor inválido → contrato explícito**: `getFeed` devolve página **vazia** com `nextCursor: null` (nunca reinicia no topo — evitaria duplicar conteúdo em loop; review kieran N6).

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
    "nextCursor": "eyJpZCI6MTAzfQ",
    "hasMore": true,
    "limit": 20
  }
}
```

---

## GET /social/explore

Explorar publicações populares e em destaque.

### Requisição

```http
GET /api/v1/social/explore?page=1&limit=20&category=amor
Authorization: Bearer <accessToken>
```

### Parâmetros de Query

| Parâmetro | Tipo | Padrão | Descrição |
|-----------|------|--------|-----------|
| `page` | number | 1 | Página |
| `limit` | number | 20 | Itens (máx 50) |
| `category` | string | — | `amor`, `carreira`, `espiritual` |
| `period` | string | `week` | `today`, `week`, `month`, `all` |

### Resposta — 200 OK

Mesmo formato do feed, sem `nextCursor` (usa offset).

---

## POST /social/posts

Criar uma nova publicação (texto ou compartilhar tiragem).

### Requisição

```http
POST /api/v1/social/posts
Authorization: Bearer <accessToken>
Content-Type: application/json
```

```json
{
  "type": "reading",
  "readingId": "rdg_x1y2z3",
  "text": "Acabei de fazer uma leitura sobre meu futuro profissional. O que vocês acham dessas cartas?",
  "audience": "public"
}
```

### Validação

| Campo | Tipo | Obrigatório | Regras |
|-------|------|-------------|--------|
| `type` | string | Sim | `text`, `image`, `reading` |
| `readingId` | string | Se type=`reading` | Tiragem do usuário |
| `text` | string | Se type=`text` | 1–500 caracteres |
| `audience` | string | Não | `public` (padrão) ou `followers` |

> **Mapeamento para o schema real (Sprint 2 Phase 0 — `prisma/schema.prisma`)**: `text` → coluna `content`; `audience` → coluna `audience` (default `public`); `type` também aceita `image`, com as imagens em `imageUrls String[]`. Contagens vivem em `likeCount`/`commentCount` (denormalizadas).

### Resposta — 201 Created

```json
{
  "data": {
    "post": {
      "id": "post_ghi789",
      "type": "reading",
      "author": {
        "id": "usr_a1b2c3d4",
        "name": "Maria Silva",
        "username": "mariatarot"
      },
      "content": {
        "readingId": "rdg_x1y2z3",
        "text": "Acabei de fazer uma leitura..."
      },
      "stats": { "likes": 0, "comments": 0, "gifts": 0 },
      "createdAt": "2025-01-15T10:30:00Z"
    }
  }
}
```

### Erros

| Status | Código | Descrição |
|--------|--------|-----------|
| 400 | `VALIDATION_ERROR` | Dados inválidos |
| 403 | `READING_ACCESS_DENIED` | Tiragem não é do usuário |

---

## DELETE /social/posts/:id

Remove uma publicação.

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

> **Contrato × hook (divergência conhecida, review Step 5; nota atualizada no Phase 1, 2026-09-28)**: o contrato acima (envelope `{ data, pagination }`) é o de `docs/04-api/overview.md` e **é o vencedor fixado pelo S2-18/SC30** — a primeira rota social existente (`GET /users/:username/{followers,following}`, T044/T045) já responde nele. O T082 do plano ainda especifica resposta **flat** `{ notifications, unreadCount, nextCursor }`. O hook `useNotifications` (`src/hooks/use-social.ts`) **aceita os dois shapes** (zod union, normaliza para `NotificationsPage { notifications, nextCursor, unreadCount }`) porque **a rota de notificações continua inexistente** (Phase 6/T082 — a Phase 1 entregou follow, não notifications); quando T082 chegar, entregar no envelope e **estreitar o hook** (union pode ser removida). `useUnreadCount()` não tem endpoint dedicado documentado: usa `GET /social/notifications?limit=1&unreadOnly=true` lendo `unreadCount` (T038 exige o hook) e retorna `number` (`?? 0`).

---

## PATCH /social/notifications/read

Marca notificações como lidas.

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