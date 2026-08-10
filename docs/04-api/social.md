# API Social — arkana-agora

> **Módulo**: `src/app/api/v1/social/` | **Autenticação**: Obrigatória | **Paginação**: Cursor-based

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
| `limit` | number | 20 | Itens por página (máx 50) |
| `type` | string | Todos | `reading`, `text`, `all` |

### Algoritmo do Feed

```
1. Posts de seguidos (70%)
2. Posts em destaque da comunidade (20%)
3. Posts de descoberta com base em interesses (10%)
```

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
  "isPublic": true
}
```

### Validação

| Campo | Tipo | Obrigatório | Regras |
|-------|------|-------------|--------|
| `type` | string | Sim | `text`, `reading` |
| `readingId` | string | Se type=`reading` | Tiragem do usuário |
| `text` | string | Se type=`text` | 1–500 caracteres |
| `isPublic` | boolean | Não | Padrão: `true` |

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
  "recipientId": "usr_b2c3d4",
  "postId": "post_abc123",
  "giftType": "crystal_ball",
  "message": "Adorei sua leitura! Muito inspiradora 💎"
}
```

### Presentes disponíveis

| giftType | Nome | Custo (moedas) | Descrição |
|----------|------|---------------|-----------|
| `crystal_ball` | Bola de Cristal | 5 | Presente básico |
| `tarot_deck` | Baralho Místico | 15 | Presente especial |
| `moon` | Lua Prateada | 25 | Presente raro |
| `star` | Estrela Dourada | 50 | Presente premium |

> **Moedas**: Usuários recebem moedas diárias. Compras adicionais via marketplace.

### Resposta — 201 Created

```json
{
  "data": {
    "gift": {
      "id": "gift_abc123",
      "senderId": "usr_a1b2c3d4",
      "recipientId": "usr_b2c3d4",
      "postId": "post_abc123",
      "giftType": "crystal_ball",
      "message": "Adorei sua leitura! Muito inspiradora 💎",
      "createdAt": "2025-01-15T10:40:00Z"
    },
    "balance": {
      "coins": 45
    }
  }
}
```

### Erros

| Status | Código | Descrição |
|--------|--------|-----------|
| 400 | `INSUFFICIENT_COINS` | Moedas insuficientes |
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