# API de Autenticação — arkana-agora

> **Status (Sprint 0):** a sessão real do MVP é o **cookie JWT do Auth.js** (`/api/auth/*`,
> ADR-010). As rotas `/api/v1/auth/*` e a **Custom JWT Layer** (access RS256 + refresh com
> rotação) abaixo são o estado-alvo da **Sprint 1** (ADR-009 Gate B), com exceção de
> **`POST /auth/register` (T6) e `POST /auth/login` (T7) que já estão implementados** (ver
> seções abaixo).
> O ponto de anexo da camada custom são os callbacks `jwt`/`session` em `src/auth/auth.config.ts`.

> **Módulo**: `src/app/api/v1/auth/` (Sprint 1) + `src/app/api/auth/[...nextauth]` (Auth.js v5 — ADR-010) | **Auth Provider**: Auth.js v5 (`next-auth@5.0.0-beta.32`, adapter mínimo, JWT strategy) | **Session (MVP)**: cookie JWT do Auth.js | **Session (Sprint 1)**: Custom JWT (access/refresh)

## Sumário

- [Visão Geral](#visão-geral)
- [POST /auth/register](#post-authregister)
- [POST /auth/login](#post-authlogin)
- [POST /auth/social](#post-authsocial) _(deprecated)_
- [POST /auth/magic-link](#post-authmagic-link)
- [POST /auth/magic-link/verify](#post-authmagic-linkverify)
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
┌─────────┐   ┌──────────────┐   ┌──────────┐   ┌─────────┐
│ Cliente │──>│  Auth.js v5  │──>│  Prisma  │──>│  Banco  │
│         │   │ (camada de   │   │ adapter  │   │   DB    │
│         │   │  login, JWT) │   │  mínimo  │   │         │
│         │   └──────────────┘   └──────────┘   └─────────┘
│         │          │ confirma identidade (callback)
│         │          ▼
│         │   ┌──────────────┐
│         │   │ Custom JWT   │──> gera access (RS256, 15min) + refresh (30d, rotação)
│         │   │ Layer        │
│         │   └──────────────┘
└─────────┘<── Bearer access_token → POST /auth/refresh (rotação)
```

### Tipos de sessão

| Tipo | Duração | Uso |
|------|---------|-----|
| Access Token | 15 min | Requisições à API (Bearer, RS256) |
| Refresh Token | 30 dias | Renovação com rotação (cookie httpOnly) |
| Magic Link | 15 min | Login sem senha |

### Estratégia de senhas

- **Hashing**: bcrypt com salt rounds = 12
- **Requisitos mínimos**: 8 caracteres, 1 maiúscula, 1 minúscula, 1 número
- **Bloqueio**: 5 tentativas falhas → lockout de 15 minutos

---

## POST /auth/register

Cadastro de novo usuário.

> **Status (T6 implementado):** esta rota está **implementada** em
> `src/app/api/v1/auth/register/route.ts` (primeira rota da Custom JWT Layer, Fase 2).
> O contrato abaixo reflete o **contrato canônico do plano S11 (design §3)**, que **supersede**
> a divergência antiga desta seção (que documentava `birthDate`/`AUTH_UNDER_AGE`/`accessToken`/
> `meta`). A divergência foi registrada para o doc-shepherd na conclusão da F7.

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
  "passwordConfirmation": "SenhaForte123",
  "acceptTerms": true
}
```

> **Nota:** o body **não** inclui `birthDate` (mantido para evolução de perfil, fora do MVP).

### Validação

Schemas compartilhados em `src/lib/validators/auth.ts` (`passwordSchema`, `registerSchema`):

| Campo | Tipo | Obrigatório | Regras |
|-------|------|-------------|--------|
| `name` | string | Sim | 2–50 caracteres |
| `email` | string | Sim | Formato e-mail válido, único (case-insensitive) |
| `password` | string | Sim | Min 8 chars, 1 maiúsc, 1 minúsc, 1 número, 1 especial |
| `passwordConfirmation` | string | Sim | Deve ser idêntico a `password` |
| `acceptTerms` | boolean | Sim | Deve ser `true` |

### Resposta — 201 Created

```json
{
  "user": {
    "id": "usr_a1b2c3d4",
    "name": "Maria Silva",
    "email": "maria@email.com",
    "emailVerified": null
  },
  "message": "Email de verificacao enviado"
}
```

> **Nota:** a resposta **não** inclui `accessToken`/`meta` — o cadastro **NÃO faz auto-login**
> (exige verificação de e-mail, RF-AUTH-005). `emailVerified` é `DateTime?` (S12) — `null` até
> a verificação.

### Comportamento

1. Valida o body com `registerSchema` (422 `VALIDATION_ERROR` em falha)
2. Normaliza `email` para minúsculas; busca duplicado case-insensitive (409 `AUTH_EMAIL_ALREADY_EXISTS`)
3. Hash da senha com **bcrypt custo 12**
4. Cria `User` com `role=USER`, `plan=FREE`, `provider=EMAIL`, `providerId=email-lowercase`
5. Cria `VerificationToken` `type=EMAIL` (24h) e envia e-mail de verificação para
   `/auth/verify-email?token=...`
6. Retorna **201** com `user` + `message`

### Erros

| Status | Código | Descrição |
|--------|--------|-----------|
| 409 | `AUTH_EMAIL_ALREADY_EXISTS` | E-mail já cadastrado |
| 422 | `VALIDATION_ERROR` | Dados inválidos (Zod, com `details` por campo) |
| 500 | `INTERNAL_ERROR` | Falha interna ao criar conta |

> **Divergência supersedida:** o contrato antigo desta seção (body com `birthDate`, resposta com
> `data`/`accessToken`/`meta`, erro `AUTH_UNDER_AGE` 422, sem `passwordConfirmation`) foi
> **substituído** pelo contrato canônico S11 acima (design §3). O `AUTH_UNDER_AGE`/idade não faz
> parte do cadastro no MVP.

---

## POST /auth/login

Login com e-mail e senha.

> **Status (implementado):** esta rota está **implementada** em
> `src/app/api/v1/auth/login/route.ts`. Usa `loginSchema` de `src/lib/validators/auth.ts`,
> `signAccessToken`/`createRefreshSession` de `src/services/token-service.ts` e o rate limiter
> em memória de `src/lib/rate-limit.ts`.

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

Schema compartilhado em `src/lib/validators/auth.ts` (`loginSchema`):

| Campo | Tipo | Obrigatório | Regras |
|-------|------|-------------|--------|
| `email` | string | Sim | Formato e-mail válido (normalizado para minúsculas) |
| `password` | string | Sim | Não vazio |

### Resposta — 200 OK

> **Nota (contrato canônico):** o body de sucesso é **plano** (flat) — `{ accessToken, user }`,
> **sem** wrapper `data`. Este é o formato canônico do login implementado; o antigo
> `{ data: { user, accessToken } }` desta seção foi **substituído**.

```json
{
  "accessToken": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "usr_a1b2c3d4",
    "name": "Maria Silva",
    "email": "maria@email.com",
    "displayName": "Maria Silva",
    "role": "USER",
    "plan": "FREE",
    "avatar": null
  }
}
```

> **Nota**: o `refreshToken` nunca é retornado no body — é definido via `Set-Cookie` httpOnly
> (`Path=/api/v1/auth`, `HttpOnly`, `SameSite=Strict`, `Max-Age=2592000` = 30 dias).

### Comportamento

1. Valida o body com `loginSchema` (422 `VALIDATION_ERROR` em falha, com `details` por campo)
2. Checa lockout de conta (5 falhas consecutivas → 403 `AUTH_ACCOUNT_LOCKED` com `retryAfter: 900`)
3. Checa limite de volume por IP (5 tentativas/15min → 429 `AUTH_RATE_LIMITED` com `retryAfter`)
4. Busca usuário por e-mail normalizado (`findFirst`); e-mail inexistente → 401 `AUTH_INVALID_CREDENTIALS` (anti-enumeração)
5. Conta suspensa (`isActive=false` ou `deletedAt` set) → 403 `AUTH_ACCOUNT_SUSPENDED`
6. E-mail não verificado (`emailVerified=null`) → 401 `AUTH_EMAIL_NOT_VERIFIED`
7. Compara hash bcrypt (custo 12); falha → 401 `AUTH_INVALID_CREDENTIALS` (anti-enumeração)
8. Sucesso: `signAccessToken` (RS256, 15min, claims `role`/`plan`/`tokenVersion`) + `createRefreshSession` (Session 30d) + `Set-Cookie` refreshToken
9. Reseta contador de falhas da conta

### Erros

| Status | Código | Descrição |
|--------|--------|-----------|
| 422 | `VALIDATION_ERROR` | Dados inválidos (Zod, com `details` por campo) |
| 403 | `AUTH_ACCOUNT_LOCKED` | Conta bloqueada por 5 falhas consecutivas (body com `retryAfter: 900`) |
| 429 | `AUTH_RATE_LIMITED` | Limite de volume por IP atingido (5/15min; body com `retryAfter`) |
| 403 | `AUTH_ACCOUNT_SUSPENDED` | Conta suspensa pelo admin (`isActive=false`/`deletedAt`) |
| 401 | `AUTH_EMAIL_NOT_VERIFIED` | E-mail não verificado |
| 401 | `AUTH_INVALID_CREDENTIALS` | E-mail ou senha incorretos (anti-enumeração) |

---

## POST /auth/social

> **Deprecated**: o fluxo OAuth é delegado ao Auth.js v5 em `/api/auth/*` (ADR-010, supersede a cláusula v4 do ADR-009). Mantido apenas para compatibilidade; não usar em implementações novas.

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
    "message": "Link mágico enviado para maria@email.com. Válido por 15 minutos."
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

## POST /auth/magic-link/verify

Redime o token do magic link (single-use, expira em 15 minutos).

### Requisição

```http
POST /api/v1/auth/magic-link/verify
Content-Type: application/json
```

```json
{
  "token": "magic_abc123def456"
}
```

### Resposta — 200 OK

Mesmo formato de `/auth/login` (access token no body + refresh token em cookie httpOnly).

### Erros

| Status | Código | Descrição |
|--------|--------|-----------|
| 401 | `AUTH_MAGIC_TOKEN_INVALID` | Token inválido (já usado) |
| 410 | `AUTH_MAGIC_TOKEN_EXPIRED` | Token expirado (15 min) |

---

## POST /auth/refresh

Renova o access token usando o refresh token do cookie httpOnly.

> **Status:** a lógica de rotação está **implementada** em `src/services/token-service.ts`
> (`rotateRefresh` — rotação condicional anti-race + revogação de família em reuso), mas a
> **rota HTTP ainda não está exposta** como endpoint.

### Requisição

```http
POST /api/v1/auth/refresh
Cookie: refreshToken=<rt_token>
```

> **Nota**: o refresh token é enviado **somente** via cookie httpOnly (`path=/api/v1/auth`) — nunca em body ou query string.

### Resposta — 200 OK

```json
{
  "accessToken": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresIn": 900
}
```

> O novo refresh token rotacionado é entregue via `Set-Cookie` (mesmo `familyId`). Se um token já rotacionado for reenviado, toda a família é revogada.

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
      "plan": "PLUS",
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
| 401 | `AUTH_TOKEN_INVALID` | Token inválido ou expirado |
| 401 | `AUTH_TOKEN_REVOKED` | Token revogado (tokenVersion/flags) |

---

## Códigos de Erro

Referência completa de erros do módulo de autenticação:

| Código | HTTP | Descrição | Ação do cliente |
|--------|------|-----------|-----------------|
| `AUTH_INVALID_CREDENTIALS` | 401 | Credenciais incorretas (anti-enumeração) | Reenviar credenciais |
| `AUTH_EMAIL_NOT_VERIFIED` | 401 | E-mail não verificado | Verificar e-mail |
| `AUTH_TOKEN_INVALID` | 401 | Token inválido ou expirado (emitido por `verifyAccessToken`) | Usar refresh token |
| `AUTH_TOKEN_REVOKED` | 401 | Token revogado (tokenVersion divergente / flags) | Refazer login |
| `AUTH_REFRESH_TOKEN_INVALID` | 401 | Refresh token inválido | Refazer login |
| `AUTH_REFRESH_TOKEN_EXPIRED` | 401 | Refresh token expirado | Refazer login |
| `AUTH_REFRESH_TOKEN_REVOKED` | 401 | Refresh token revogado (reuso revoga família) | Refazer login |
| `AUTH_EMAIL_ALREADY_EXISTS` | 409 | E-mail já cadastrado | Oferecer login |
| `AUTH_ACCOUNT_LOCKED` | 403 | Conta bloqueada (5 falhas consecutivas; `retryAfter: 900`) | Aguardar ou contato suporte |
| `AUTH_RATE_LIMITED` | 429 | Limite de volume por IP atingido (5/15min) | Aguardar `retryAfter` |
| `AUTH_ACCOUNT_SUSPENDED` | 403 | Conta suspensa | Contato suporte |
| `AUTH_SOCIAL_TOKEN_INVALID` | 401 | Token social inválido | Reautenticar com provedor |
| `AUTH_SOCIAL_ACCOUNT_CONFLICT` | 409 | Conflito de conta social | Login com credenciais + vincular |
| `AUTH_MAGIC_LINK_RATE_LIMIT` | 429 | Muitos magic links | Aguardar 1 hora |
| `AUTH_RESET_TOKEN_INVALID` | 401 | Token de reset inválido | Solicitar novo link |
| `AUTH_UNDER_AGE` | 422 | Menor de 18 anos | Bloquear cadastro |

> **Nota:** `AUTH_UNDER_AGE` não faz parte do contrato canônico de register (S11) — o cadastro
> do MVP não coleta `birthDate`/idade. Mantido na tabela apenas como referência histórica;
> não usar em implementações novas do register.