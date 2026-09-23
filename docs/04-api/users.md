# API de Usuários — arkana-agora

> **Módulo**: `src/app/api/v1/users/` | **Autenticação**: Obrigatória (exceto perfil público e busca)

## Sumário

- [GET /users/:id](#get-usersid)
- [PATCH /users/me/profile](#patch-usersmeprofile)
- [PATCH /users/me/privacy](#patch-usersmeprivacy)
- [GET /users/:username/profile](#get-usersusernameprofile)
- [Avatar (presign → upload → confirm → delete)](#avatar-presign--upload--confirm--delete)
- [GET /users/:id/readings](#get-usersidreadings)
- [GET /users/:id/stats](#get-usersidstats)
- [DELETE /users/me](#delete-usersme)
- [GET /users/search](#get-userssearch)

---

## PATCH /users/me/profile

Atualiza o perfil do usuário autenticado.

> **Implementado** em `src/app/api/v1/users/me/profile/route.ts` (Zod `updateProfileSchema` de
> `src/lib/validators/profile.ts`, `.strict()`). Não existe rota `PATCH /users/me` (sem `/profile`).

### Requisição

```http
PATCH /api/v1/users/me/profile
Authorization: Bearer <accessToken>
Content-Type: application/json
```

```json
{
  "displayName": "Maria Silva Santos",
  "username": "mariatarot",
  "bio": "Apaixonada por tarot e cartas ciganas. Leitora desde 2018. 🌙",
  "birthDate": "1995-03-15",
  "birthPlace": "São Paulo, SP",
  "location": "Rio de Janeiro, RJ",
  "website": "https://maria.tarot"
}
```

### Validação

| Campo | Tipo | Regras |
|-------|------|--------|
| `displayName` | string | 2–50 caracteres (trim) |
| `username` | string | `""` **não altera** (só aplica se truthy no route); valor novo: 3–30 chars alfanumérico+`_`, único |
| `bio` | string \| `""` | máx 500 chars; `""` → `null` (limpa) |
| `birthDate` | `"AAAA-MM-DD"` \| `""` | `""` → `null` e **limpa** `astrologicalSign`/`mayanKin`; data válida recalcula signo/kin |
| `birthPlace` | string \| `""` | máx 200; `""` → `null` |
| `location` | string \| `""` | máx 100; `""` → `null` |
| `website` | url \| `""` | `""` → `null`; URL válida máx 200 |

> **Sem `gender` no schema** (removido — nunca implementado). Campos extras → 422 (`.strict()`).

### Resposta — 200 OK

```json
{
  "message": "Perfil atualizado"
}
```

> Body **flat** — sem wrapper `data` e sem objeto `user`.

### Erros

| Status | Código | Descrição |
|--------|--------|-----------|
| 401 | `AUTH_TOKEN_INVALID` | Access token ausente ou inválido |
| 409 | `USERNAME_TAKEN` | Username já em uso (colisão P2002 em `UserProfile.username`) |
| 422 | `VALIDATION_ERROR` | Dados inválidos (Zod, com `details` por campo) ou corpo não-JSON |
| 500 | `INTERNAL_ERROR` | Falha interna (inclui `meta.requestId`) |

---

## PATCH /users/me/privacy

Atualiza as configurações de privacidade do usuário autenticado.

> **Implementado** em `src/app/api/v1/users/me/privacy/route.ts` (`privacySchema` de `src/lib/validators/profile.ts`).
> Persiste/upserta `UserProfile.privacy` (JSON).

### Requisição

```http
PATCH /api/v1/users/me/privacy
Authorization: Bearer <accessToken>
Content-Type: application/json
```

```json
{
  "profileVisibility": "public",
  "statsVisibility": "private",
  "arcanaVisibility": "public",
  "whoCanFollow": "all",
  "whoCanComment": "following"
}
```

### Validação

| Campo | Tipo | Valores permitidos |
|-------|------|--------------------|
| `profileVisibility` | enum | `public`, `private` |
| `statsVisibility` | enum | `public`, `private` |
| `arcanaVisibility` | enum | `public`, `private` |
| `whoCanFollow` | enum | `all`, `following`, `nobody` |
| `whoCanComment` | enum | `all`, `following`, `nobody` |

### Resposta — 200 OK

```json
{
  "message": "Privacidade atualizada"
}
```

---

## GET /users/:username/profile

Perfil público por username (implementado: `src/app/api/v1/users/[username]/profile/route.ts`).
Respeita `privacy.profileVisibility` — perfil com `profileVisibility === "private"` oculta dados
estatísticos/visíveis do dono para visitantes não autorizados.

### Requisição

```http
GET /api/v1/users/mariatarot/profile
```

---

## GET /users/:id (planejado)

> **Status: não implementado.** Use `GET /users/:username/profile` (acima).
> Seção abaixo é design de produto, não contrato em produção.

Retorna o perfil público de um usuário.

#### Requisição

```http
GET /api/v1/users/usr_a1b2c3d4
```

> **Auth**: Não obrigatória. Se autenticada, inclui campo `isFollowing`.

#### Resposta — 200 OK

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

#### Erros

| Status | Código | Descrição |
|--------|--------|-----------|
| 404 | `USER_NOT_FOUND` | Usuário não encontrado |

---

## Avatar (presign → upload → confirm → delete)

Fluxo **Implementado** em 3 rotas (não multipart):

> `src/app/api/v1/users/me/avatar/presign/route.ts`
> `src/app/api/v1/users/me/avatar/confirm/route.ts`
> `src/app/api/v1/users/me/avatar/route.ts` (DELETE)

### 1) POST /users/me/avatar/presign

Gera URL pré-assinada R2 para upload direto do arquivo.

```http
POST /api/v1/users/me/avatar/presign
Authorization: Bearer <accessToken>
Content-Type: application/json
```

```json
{ "contentType": "image/png" }
```

`contentType` aceito: `image/jpeg`, `image/png`, `image/webp` (máx 5MB validado no confirm).

**Resposta — 200 OK**

```json
{
  "uploadUrl": "https://r2.../presigned",
  "key": "avatars/usr_a1b2c3d4/photo-123.png"
}
```

Cliente envia `PUT` do arquivo binário para `uploadUrl` com o mesmo `Content-Type`.

### 2) PATCH /users/me/avatar/confirm

Processa o arquivo no R2, gera variantes WebP (48/120/400), atualiza `User.avatar` e apaga o original.

```http
PATCH /api/v1/users/me/avatar/confirm
Authorization: Bearer <accessToken>
Content-Type: application/json
```

```json
{ "fileKey": "avatars/usr_a1b2c3d4/photo-123.png" }
```

**Resposta — 200 OK**

```json
{
  "avatarUrl": "https://r2.../avatars/usr_a1b2c3d4/photo-123-400.webp",
  "variants": [
    "https://r2.../avatars/usr_a1b2c3d4/photo-123-48.webp",
    "https://r2.../avatars/usr_a1b2c3d4/photo-123-120.webp",
    "https://r2.../avatars/usr_a1b2c3d4/photo-123-400.webp"
  ]
}
```

### 3) DELETE /users/me/avatar

Remove o avatar atual (`User.avatar = null`) e apaga o objeto R2 se existir.

```http
DELETE /api/v1/users/me/avatar
Authorization: Bearer <accessToken>
```

**Resposta — 200 OK**

```json
{ "message": "Avatar removido" }
```

### Erros (presign/confirm)

| Status | Código | Descrição |
|--------|--------|-----------|
| 401 | `AUTH_TOKEN_INVALID` | Access token ausente ou inválido |
| 422 | `VALIDATION_ERROR` | contentType inválido, fileKey ausente/path traversal, arquivo >5MB, extensão inválida |
| 500 | `INTERNAL_ERROR` | Falha no processamento (avatar anterior mantido) |

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

> **Nota (contrato canônico):** o body de sucesso é **plano** (flat) — `{ message }`, **sem**
> wrapper `data` — idêntico ao de `DELETE /api/v1/auth/account`. A resposta é a **mesma 200**
> para sucesso, e-mail de confirmação divergente e usuário inexistente (anti-enumeração, com
> piso de 240–400ms no no-op via `equalizeNoopTiming`).

```json
{
  "message": "Conta marcada para exclusao. Voce tem 30 dias para reverter."
}
```

### Erros

| Status | Código | Descrição |
|--------|--------|-----------|
| 401 | `AUTH_TOKEN_INVALID` | Access token ausente ou inválido |
| 403 | `AUTH_ACCOUNT_SUSPENDED` | Conta suspensa (`isActive=false`/`deletedAt`) |
| 422 | `VALIDATION_ERROR` | Body inválido, e-mail ausente/inválido ou corpo não-JSON (Zod, com `details` por campo) |

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