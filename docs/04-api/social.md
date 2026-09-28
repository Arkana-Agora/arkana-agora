# API Social — arkana-agora

> **Módulo**: `src/app/api/v1/social/` | **Autenticação**: Obrigatória | **Paginação**: Cursor-based
>
> **Status (2026-09-26)**: **contrato planejado — rotas ainda não implementadas** (o diretório `src/app/api/v1/social/` não existe e nenhum código chama `prisma.follow`/`prisma.post`/etc.). Desde o Sprint 2 Phase 0 os **models** de suporte existem no schema (`prisma/schema.prisma`, migração `20260926182325_sprint2_social_horoscopes`): `Follow`, `Post`, `Comment`, `PostLike`, `CommentLike`, `PostHashtag`, `Gift`, `Notification`, `ContentReport`. Desde o **Phase 0.5** as **utilidades compartilhadas** que as rotas vão usar já existem: `src/lib/social/{feed-algorithm,limits,gifts,versos,mentions}.ts`, `src/lib/moderation.ts`, `src/lib/csrf.ts` + `src/lib/middleware/{rate-limit,csrf}.ts`, `src/lib/feed-cache.ts`, `src/hooks/use-social.ts`.

## Sumário

- [POST /social/follow/:userId](#post-socialfollowuserid)
- [DELETE /social/follow/:userId](#delete-socialfollowuserid)
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

Seguir um usuário.

### Requisição

```http
POST /api/v1/social/follow/usr_target123
Authorization: Bearer <accessToken>
```

### Comportamento

1. Não permite seguir a si mesmo
2. Se já segue → retorna 409
3. Se usuário privado → cria solicitação pendente
4. Dispara notificação ao seguido

### Resposta — 201 Created

```json
{
  "data": {
    "following": {
      "userId": "usr_target123",
      "name": "João Tarólogo",
      "avatar": "/avatars/usr_target123.jpg",
      "followedAt": "2025-01-15T10:30:00Z"
    },
    "stats": {
      "followingCount": 90,
      "followersCount": 156
    }
  }
}
```

### Erros

| Status | Código | Descrição |
|--------|--------|-----------|
| 404 | `USER_NOT_FOUND` | Usuário não encontrado |
| 409 | `ALREADY_FOLLOWING` | Já segue este usuário |
| 409 | `CANNOT_FOLLOW_SELF` | Não é possível seguir a si mesmo |

---

## DELETE /social/follow/:userId

Deixa de seguir um usuário.

### Requisição

```http
DELETE /api/v1/social/follow/usr_target123
Authorization: Bearer <accessToken>
```

### Resposta — 200 OK

```json
{
  "data": {
    "unfollowed": {
      "userId": "usr_target123",
      "name": "João Tarólogo"
    },
    "stats": {
      "followingCount": 89,
      "followersCount": 155
    }
  }
}
```

### Erros

| Status | Código | Descrição |
|--------|--------|-----------|
| 404 | `USER_NOT_FOUND` | Usuário não encontrado |
| 404 | `NOT_FOLLOWING` | Não segue este usuário |

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

> **Cursor e envelope**: `decodeFeedCursor()` espera `{createdAt, id}` (o exemplo `eyJpZCI6MTIzfQ` acima = `{"id":123}` é o formato antigo/ilustrativo). A função `getFeed()` devolve **`{ posts, nextCursor }`** (sem `prevCursor`/`hasMore`/`pagination`) — a T052 decide se envolve no envelope `{ data, pagination }` de `docs/04-api/overview.md` §Paginação ou expõe o shape da lib. **Cursor inválido → contrato explícito**: `getFeed` devolve página **vazia** com `nextCursor: null` (nunca reinicia no topo — evitaria duplicar conteúdo em loop; review kieran N6).

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

> **Contrato × hook (divergência conhecida, review Step 5)**: o contrato acima (envelope `{ data, pagination }`) é o de `docs/04-api/overview.md`; o T082 do plano especifica resposta **flat** `{ notifications, unreadCount, nextCursor }`. O hook `useNotifications` (`src/hooks/use-social.ts`) **aceita os dois shapes** (zod union, normaliza para `NotificationsPage { notifications, nextCursor, unreadCount }`) justamente porque nenhuma rota existe ainda — a rota da Phase 1 (T043+) define o vencedor e o hook pode ser estreitado. `useUnreadCount()` não tem endpoint dedicado documentado: usa `GET /social/notifications?limit=1&unreadOnly=true` lendo `unreadCount` (T038 exige o hook) e retorna `number` (`?? 0`).

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