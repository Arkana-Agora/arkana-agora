# API de Usuários — arkana-agora

> **Módulo**: `src/app/api/v1/users/` | **Autenticação**: Obrigatória (exceto perfil público e busca)

## Sumário

- [GET /users/:id](#get-usersid)
- [PATCH /users/me](#patch-usersme)
- [PATCH /users/me/avatar](#patch-usersmeavatar)
- [GET /users/:id/readings](#get-usersidreadings)
- [GET /users/:id/stats](#get-usersidstats)
- [DELETE /users/me](#delete-usersme)
- [GET /users/search](#get-userssearch)

---

## GET /users/:id

Retorna o perfil público de um usuário.

### Requisição

```http
GET /api/v1/users/usr_a1b2c3d4
```

> **Auth**: Não obrigatória. Se autenticada, inclui campo `isFollowing`.

### Resposta — 200 OK

```json
{
  "data": {
    "user": {
      "id": "usr_a1b2c3d4",
      "name": "Maria Silva",
      "username": "mariatarot",
      "avatar": "/avatars/usr_a1b2c3d4.jpg",
      "bio": "Apaixonada por tarot desde 2018",
      "personalArcana": "A Imperatriz",
      "plan": "PLUS",
      "isFollowing": false,
      "stats": {
        "totalReadings": 42,
        "followers": 156,
        "following": 89
      },
      "createdAt": "2024-06-01T00:00:00Z"
    }
  }
}
```

### Erros

| Status | Código | Descrição |
|--------|--------|-----------|
| 404 | `USER_NOT_FOUND` | Usuário não encontrado |

---

## PATCH /users/me

Atualiza o perfil do usuário autenticado.

### Requisição

```http
PATCH /api/v1/users/me
Authorization: Bearer <accessToken>
Content-Type: application/json
```

```json
{
  "name": "Maria Silva Santos",
  "username": "mariatarot",
  "bio": "Apaixonada por tarot e cartas ciganas. Leitora desde 2018. 🌙"
}
```

### Validação

| Campo | Tipo | Regras |
|-------|------|--------|
| `name` | string | 2–100 caracteres |
| `username` | string | 3–30 chars, alfanumérico + `_`, único |
| `bio` | string | Máximo 300 caracteres |

### Resposta — 200 OK

```json
{
  "data": {
    "user": {
      "id": "usr_a1b2c3d4",
      "name": "Maria Silva Santos",
      "username": "mariatarot",
      "bio": "Apaixonada por tarot e cartas ciganas. Leitora desde 2018. 🌙",
      "avatar": "/avatars/usr_a1b2c3d4.jpg",
      "updatedAt": "2025-01-15T11:00:00Z"
    }
  }
}
```

### Erros

| Status | Código | Descrição |
|--------|--------|-----------|
| 400 | `VALIDATION_ERROR` | Dados inválidos |
| 409 | `USERNAME_ALREADY_EXISTS` | Username já em uso |

---

## PATCH /users/me/avatar

Upload ou atualização do avatar.

### Requisição

```http
PATCH /api/v1/users/me/avatar
Authorization: Bearer <accessToken>
Content-Type: multipart/form-data
```

| Campo | Tipo | Regras |
|-------|------|--------|
| `avatar` | file | Imagem, máx 5MB, JPEG/PNG/WebP, mín 200x200px |

### Resposta — 200 OK

```json
{
  "data": {
    "avatar": "/avatars/usr_a1b2c3d4_1705311600.jpg",
    "variants": {
      "small": "/avatars/usr_a1b2c3d4_1705311600_80x80.jpg",
      "medium": "/avatars/usr_a1b2c3d4_1705311600_200x200.jpg",
      "large": "/avatars/usr_a1b2c3d4_1705311600_400x400.jpg"
    }
  }
}
```

### Erros

| Status | Código | Descrição |
|--------|--------|-----------|
| 400 | `VALIDATION_ERROR` | Arquivo inválido (tipo/tamanho) |
| 413 | `FILE_TOO_LARGE` | Arquivo excede 5MB |

---

## GET /users/:id/readings

Lista tiragens públicas de um usuário.

### Requisição

```http
GET /api/v1/users/usr_a1b2c3d4/readings?page=1&limit=10
```

### Parâmetros de Query

| Parâmetro | Tipo | Padrão | Descrição |
|-----------|------|--------|-----------|
| `page` | number | 1 | Página atual |
| `limit` | number | 10 | Itens por página (máx 50) |
| `type` | string | Todos | Filtrar por tipo (`tarot`, `lenormand`) |

### Resposta — 200 OK

```json
{
  "data": [
    {
      "id": "rdg_x1y2z3",
      "type": "tarot",
      "spreadType": "tres-cartas",
      "cards": [
        {"position": 1, "cardId": "arc_03", "name": "A Imperatriz", "isReversed": false},
        {"position": 2, "cardId": "arc_14", "name": "Temperança", "isReversed": true},
        {"position": 3, "cardId": "arc_21", "name": "O Mundo", "isReversed": false}
      ],
      "summary": "Um ciclo de transformação se aproxima...",
      "isPublic": true,
      "likes": 23,
      "comments": 5,
      "createdAt": "2025-01-14T20:30:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "totalItems": 42,
    "totalPages": 5
  }
}
```

### Erros

| Status | Código | Descrição |
|--------|--------|-----------|
| 404 | `USER_NOT_FOUND` | Usuário não encontrado |

---

## GET /users/:id/stats

Retorna estatísticas públicas de um usuário.

### Requisição

```http
GET /api/v1/users/usr_a1b2c3d4/stats
```

### Resposta — 200 OK

```json
{
  "data": {
    "userId": "usr_a1b2c3d4",
    "totalReadings": 42,
    "publicReadings": 28,
    "favoriteSpread": "tres-cartas",
    "mostDrawnCard": {
      "cardId": "arc_03",
      "name": "A Imperatriz",
      "count": 12
    },
    "followers": 156,
    "following": 89,
    "memberSince": "2024-06-01T00:00:00Z",
    "streak": {
      "current": 5,
      "longest": 21
    }
  }
}
```

### Erros

| Status | Código | Descrição |
|--------|--------|-----------|
| 404 | `USER_NOT_FOUND` | Usuário não encontrado |

---

## DELETE /users/me

> **Canonical:** a deleção de conta (LGPD) pertence ao módulo de auth — **`DELETE /api/v1/auth/account`** (RF-AUTH-008, `.specs/001-auth/design.md`), com confirmação digitando o **email** do usuário. Este endpoint é um alias de conveniência do módulo de perfil e deve delegar ao mesmo serviço; não implementar um fluxo de confirmação divergente.

Deleta a conta do usuário autenticado (conformidade LGPD).

### Requisição

```http
DELETE /api/v1/users/me
Authorization: Bearer <accessToken>
```

### Comportamento

1. Valida o email digitado como confirmação
2. Marca conta para exclusão (grace period de 30 dias)
3. Dados anonimizados após 30 dias
4. Dados públicos (comentários, likes) preservados como "Usuário removido"
5. Envio de e-mail de confirmação

### Requisição (com confirmação)

```json
{
  "email": "maria@email.com"
}
```

> Confirmação digitada: `email` deve ser idêntico ao do usuário logado (mesmo contrato de `DELETE /api/v1/auth/account`).

### Resposta — 200 OK

```json
{
  "data": {
    "message": "Sua conta será excluída em 30 dias. Para cancelar, acesse sua conta antes do prazo.",
    "scheduledDeletionDate": "2025-02-14T10:30:00Z",
    "supportEmail": "suporte@arkanaagora.com.br"
  }
}
```

### Erros

| Status | Código | Descrição |
|--------|--------|-----------|
| 400 | `VALIDATION_ERROR` | Confirmação inválida |
| 401 | `AUTH_INVALID_CREDENTIALS` | Email de confirmação incorreto |
| 409 | `ACCOUNT_ALREADY_SCHEDULED_FOR_DELETION` | Exclusão já agendada |

---

## GET /users/search

Busca usuários por nome ou username.

### Requisição

```http
GET /api/v1/users/search?q=maria&page=1&limit=20
```

### Parâmetros de Query

| Parâmetro | Tipo | Obrigatório | Descrição |
|-----------|------|-------------|-----------|
| `q` | string | Sim | Termo de busca (mín 2 caracteres) |
| `page` | number | Não | Página (padrão: 1) |
| `limit` | number | Não | Resultados por página (padrão: 20, máx 50) |

### Resposta — 200 OK

```json
{
  "data": [
    {
      "id": "usr_a1b2c3d4",
      "name": "Maria Silva",
      "username": "mariatarot",
      "avatar": "/avatars/usr_a1b2c3d4.jpg",
      "bio": "Apaixonada por tarot desde 2018",
      "plan": "PLUS",
      "stats": {
        "totalReadings": 42,
        "followers": 156
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "totalItems": 3,
    "totalPages": 1
  }
}
```

### Erros

| Status | Código | Descrição |
|--------|--------|-----------|
| 400 | `VALIDATION_ERROR` | Query muito curta |
| 401 | `AUTH_TOKEN_INVALID` | Token inválido ou expirado (se autenticado) |