# API de Autenticação — arkana-agora

> **Módulo**: `src/app/api/v1/auth/` | **Auth Provider**: NextAuth.js v4 | **Session**: JWT

## Sumário

- [Visão Geral](#visão-geral)
- [POST /auth/register](#post-authregister)
- [POST /auth/login](#post-authlogin)
- [POST /auth/social](#post-authsocial)
- [POST /auth/magic-link](#post-authmagic-link)
- [POST /auth/refresh](#post-authrefresh)
- [POST /auth/logout](#post-authlogout)
- [POST /auth/forgot-password](#post-authforgot-password)
- [POST /auth/reset-password](#post-authreset-password)
- [GET /auth/me](#get-authme)
- [Códigos de Erro](#códigos-de-erro)

---

## Visão Geral

> **providerId Convention (from sprint-0.clarifications.md):** For EMAIL provider, set `providerId = email` normalized to lowercase (e.g., "Maria@email.com" → "maria@email.com"). For OAuth providers (GOOGLE/FACEBOOK), set `providerId = OAuth subject ID`. This aligns with the `email @unique` constraint.

### Fluxo de Autenticação

```
┌─────────┐    ┌──────────────┐    ┌──────────┐    ┌─────────┐
│ Cliente │───>│ NextAuth.js  │───>│ Prisma   │───>│  Banco  │
│         │<───│  v4 (JWT)    │<───│ ORM      │<───│   DB    │
└─────────┘    └──────────────┘    └──────────┘    └─────────┘
```

### Tipos de sessão

| Tipo | Duração | Uso |
|------|---------|-----|
| Access Token | 15 min | Requisições à API |
| Refresh Token | 7 dias | Renovação do access token |
| Magic Link | 10 min | Login sem senha |

### Estratégia de senhas

- **Hashing**: bcrypt com salt rounds = 12
- **Requisitos mínimos**: 8 caracteres, 1 maiúscula, 1 minúscula, 1 número
- **Bloqueio**: 5 tentativas falhas → lockout de 15 minutos

---

## POST /auth/register

Cadastro de novo usuário.

### Requisição

```http
POST /api/v1/auth/register
Content-Type: application/json
Accept-Language: pt-BR
```

```json
{
  "name": "Maria Silva",
  "email": "maria@email.com",
  "password": "SenhaForte123",
  "birthDate": "1995-03-15",
  "acceptTerms": true
}
```

### Validação

| Campo | Tipo | Obrigatório | Regras |
|-------|------|-------------|--------|
| `name` | string | Sim | 2–100 caracteres |
| `email` | string | Sim | Formato e-mail válido, único |
| `password` | string | Sim | Min 8 chars, 1 maiúsc, 1 minúsc, 1 número |
| `birthDate` | string | Sim | ISO 8601 (`YYYY-MM-DD`), maior de 18 anos |
| `acceptTerms` | boolean | Sim | Deve ser `true` |

### Resposta — 201 Created

```json
{
  "data": {
    "user": {
      "id": "usr_a1b2c3d4",
      "name": "Maria Silva",
      "email": "maria@email.com",
      "avatar": null,
      "plan": "free",
      "createdAt": "2025-01-15T10:30:00Z"
    },
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "rt_abc123def456"
  },
  "meta": {
    "requestId": "req_f8a7b6c5",
    "timestamp": "2025-01-15T10:30:00Z"
  }
}
```

### Erros

| Status | Código | Descrição |
|--------|--------|-----------|
| 400 | `VALIDATION_ERROR` | Dados inválidos |
| 409 | `AUTH_EMAIL_ALREADY_EXISTS` | E-mail já cadastrado |
| 422 | `AUTH_UNDER_AGE` | Usuário menor de 18 anos |

---

## POST /auth/login

Login com e-mail e senha.

### Requisição

```http
POST /api/v1/auth/login
Content-Type: application/json
```

```json
{
  "email": "maria@email.com",
  "password": "SenhaForte123"
}
```

### Validação

| Campo | Tipo | Obrigatório | Regras |
|-------|------|-------------|--------|
| `email` | string | Sim | Formato e-mail válido |
| `password` | string | Sim | Não vazio |

### Resposta — 200 OK

```json
{
  "data": {
    "user": {
      "id": "usr_a1b2c3d4",
      "name": "Maria Silva",
      "email": "maria@email.com",
      "avatar": "/avatars/usr_a1b2c3d4.jpg",
      "plan": "plus",
      "createdAt": "2024-06-01T00:00:00Z"
    },
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "rt_abc123def456"
  }
}
```

### Erros

| Status | Código | Descrição |
|--------|--------|-----------|
| 400 | `VALIDATION_ERROR` | Dados inválidos |
| 401 | `AUTH_INVALID_CREDENTIALS` | E-mail ou senha incorretos |
| 403 | `AUTH_ACCOUNT_LOCKED` | Conta bloqueada por tentativas |
| 403 | `AUTH_ACCOUNT_SUSPENDED` | Conta suspensa pelo admin |

---

## POST /auth/social

Login via provedor social (Google, Facebook).

### Requisição

```http
POST /api/v1/auth/social
Content-Type: application/json
```

```json
{
  "provider": "google",
  "idToken": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### Validação

| Campo | Tipo | Obrigatório | Regras |
|-------|------|-------------|--------|
| `provider` | string | Sim | `google` ou `facebook` |
| `idToken` | string | Sim | Token JWT do provedor |

### Comportamento

1. Valida o `idToken` com o provedor
2. Busca usuário pelo email do provedor
3. **Novo usuário** → cria conta, vincula provider
4. **Usuário existente** → vincula provider (se não vinculado) ou faz login

### Resposta — 200 OK

Mesmo formato de `/auth/login`.

### Erros

| Status | Código | Descrição |
|--------|--------|-----------|
| 400 | `VALIDATION_ERROR` | Provider inválido |
| 401 | `AUTH_SOCIAL_TOKEN_INVALID` | Token do provedor inválido/expirado |
| 409 | `AUTH_SOCIAL_ACCOUNT_CONFLICT` | Email já vinculado a outra conta |

---

## POST /auth/magic-link

Envia link mágico por e-mail para login sem senha.

### Requisição

```http
POST /api/v1/auth/magic-link
Content-Type: application/json
```

```json
{
  "email": "maria@email.com",
  "redirectUrl": "/dashboard"
}
```

### Validação

| Campo | Tipo | Obrigatório | Regras |
|-------|------|-------------|--------|
| `email` | string | Sim | Formato e-mail válido |
| `redirectUrl` | string | Não | URL válida do app (padrão: `/dashboard`) |

### Resposta — 200 OK

```json
{
  "data": {
    "message": "Link mágico enviado para maria@email.com. Válido por 10 minutos."
  }
}
```

> **Nota**: Sempre retorna 200 para evitar enumeração de e-mails.

> **LGPD Soft-Delete (30-day window):** User soft-delete uses `deletedAt DateTime?` field. Active users are filtered by `isActive = true AND deletedAt IS NULL`. Restoration endpoint (future) sets `deletedAt = NULL` and `isActive = true` within 30-day window per sprint-0.clarifications.md.

### Erros

| Status | Código | Descrição |
|--------|--------|-----------|
| 429 | `AUTH_MAGIC_LINK_RATE_LIMIT` | Máximo 3 magic links/hora por e-mail |

---

## POST /auth/refresh

Renova o access token usando o refresh token.

### Requisição

```http
POST /api/v1/auth/refresh
Content-Type: application/json
```

```json
{
  "refreshToken": "rt_abc123def456"
}
```

### Resposta — 200 OK

```json
{
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "rt_new456ghi789",
    "expiresIn": 900
  }
}
```

### Erros

| Status | Código | Descrição |
|--------|--------|-----------|
| 401 | `AUTH_REFRESH_TOKEN_INVALID` | Refresh token inválido |
| 401 | `AUTH_REFRESH_TOKEN_EXPIRED` | Refresh token expirado |
| 401 | `AUTH_REFRESH_TOKEN_REVOKED` | Refresh token revogado |

---

## POST /auth/logout

Revoga tokens e encerra sessão.

### Requisição

```http
POST /api/v1/auth/logout
Authorization: Bearer <accessToken>
```

### Resposta — 200 OK

```json
{
  "data": {
    "message": "Sessão encerrada com sucesso."
  }
}
```

---

## POST /auth/forgot-password

Solicita recuperação de senha.

### Requisição

```http
POST /api/v1/auth/forgot-password
Content-Type: application/json
```

```json
{
  "email": "maria@email.com"
}
```

### Resposta — 200 OK

```json
{
  "data": {
    "message": "Se o e-mail estiver cadastrado, você receberá instruções para redefinir sua senha."
  }
}
```

> **Nota**: Sempre retorna 200 para evitar enumeração.

---

## POST /auth/reset-password

Redefine a senha usando token de recuperação.

### Requisição

```http
POST /api/v1/auth/reset-password
Content-Type: application/json
```

```json
{
  "token": "reset_abc123def456",
  "password": "NovaSenhaForte456"
}
```

### Validação

| Campo | Tipo | Obrigatório | Regras |
|-------|------|-------------|--------|
| `token` | string | Sim | Token válido (expira em 1h) |
| `password` | string | Sim | Mesmas regras de cadastro |

### Resposta — 200 OK

```json
{
  "data": {
    "message": "Senha redefinida com sucesso."
  }
}
```

### Erros

| Status | Código | Descrição |
|--------|--------|-----------|
| 400 | `VALIDATION_ERROR` | Senha não atende requisitos |
| 401 | `AUTH_RESET_TOKEN_INVALID` | Token inválido ou expirado |

---

## GET /auth/me

Retorna o perfil do usuário autenticado.

### Requisição

```http
GET /api/v1/auth/me
Authorization: Bearer <accessToken>
```

### Resposta — 200 OK

```json
{
  "data": {
    "user": {
      "id": "usr_a1b2c3d4",
      "name": "Maria Silva",
      "email": "maria@email.com",
      "avatar": "/avatars/usr_a1b2c3d4.jpg",
      "bio": "Apaixonada por tarot desde 2018",
      "birthDate": "1995-03-15",
      "plan": "plus",
      "personalArcana": "A Imperatriz",
      "stats": {
        "totalReadings": 42,
        "followers": 156,
        "following": 89,
        "aiReadingsToday": 3,
        "aiReadingsLimit": 10
      },
      "providers": ["google", "credentials"],
      "createdAt": "2024-06-01T00:00:00Z",
      "updatedAt": "2025-01-14T20:00:00Z"
    }
  }
}
```

### Erros

| Status | Código | Descrição |
|--------|--------|-----------|
| 401 | `AUTH_TOKEN_EXPIRED` | Token expirado |
| 401 | `AUTH_INVALID_CREDENTIALS` | Token inválido |

---

## Códigos de Erro

Referência completa de erros do módulo de autenticação:

| Código | HTTP | Descrição | Ação do cliente |
|--------|------|-----------|-----------------|
| `AUTH_INVALID_CREDENTIALS` | 401 | Credenciais incorretas | Reenviar credenciais |
| `AUTH_TOKEN_EXPIRED` | 401 | Token expirado | Usar refresh token |
| `AUTH_REFRESH_TOKEN_INVALID` | 401 | Refresh token inválido | Refazer login |
| `AUTH_REFRESH_TOKEN_EXPIRED` | 401 | Refresh token expirado | Refazer login |
| `AUTH_REFRESH_TOKEN_REVOKED` | 401 | Refresh token revogado | Refazer login |
| `AUTH_EMAIL_ALREADY_EXISTS` | 409 | E-mail já cadastrado | Oferecer login |
| `AUTH_ACCOUNT_LOCKED` | 403 | Conta bloqueada | Aguardar ou contato suporte |
| `AUTH_ACCOUNT_SUSPENDED` | 403 | Conta suspensa | Contato suporte |
| `AUTH_SOCIAL_TOKEN_INVALID` | 401 | Token social inválido | Reautenticar com provedor |
| `AUTH_SOCIAL_ACCOUNT_CONFLICT` | 409 | Conflito de conta social | Login com credenciais + vincular |
| `AUTH_MAGIC_LINK_RATE_LIMIT` | 429 | Muitos magic links | Aguardar 1 hora |
| `AUTH_RESET_TOKEN_INVALID` | 401 | Token de reset inválido | Solicitar novo link |
| `AUTH_UNDER_AGE` | 422 | Menor de 18 anos | Bloquear cadastro |