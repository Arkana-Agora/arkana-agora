# API de Autenticação — arkana-agora

> **Status (Sprint 0):** a sessão real do MVP é o **cookie JWT do Auth.js** (`/api/auth/*`,
> ADR-010). As rotas `/api/v1/auth/*` e a **Custom JWT Layer** (access RS256 + refresh com
> rotação) abaixo são o estado-alvo da **Sprint 1** (ADR-009 Gate B), com exceção de
> **`POST /auth/register` (T6), `POST /auth/login` (T7), `POST /auth/magic-link` (T9),
> `POST /auth/magic-link/verify` (T10), `POST /auth/forgot-password` (T11),
> `POST /auth/reset-password` (T12), `POST /auth/refresh` (T13) e `POST /auth/logout` (T14)
> que já estão implementados**
> (ver seções abaixo).
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
- **Requisitos mínimos**: 8 caracteres, 1 maiúscula, 1 minúscula, 1 número, 1 caractere especial
- **Bloqueio**: 5 tentativas falhas (credenc. comuns) / 20 (ADMIN) → lockout de 15 minutos

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
    "avatar": null,
    "emailVerified": null
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

> **Status (T9 implementado):** esta rota está **implementada** em
> `src/app/api/v1/auth/magic-link/route.ts`. Zod `magicLinkSchema` (email-only, `.strict()` —
> rejeita campos extras como `redirectUrl`), normaliza email para minúsculas, aplica rate limit
> 3/h por email (`AUTH_MAGIC_LINK_RATE_LIMIT` 429) **e** 20/h por IP
> (`AUTH_MAGIC_LINK_RATE_LIMIT` 429 — mesmo código do limite por email), anti-enumeração (200 idêntico para
> emails inexistentes/inativos/não verificados), gera token de 64 chars
> (`randomBytes(32).toString("hex")`), persiste `VerificationToken type=MAGIC_LINK` com
> `expiresAt` 15 min, envia via `sendMagicLinkEmail`, retorna **200 flat `{ message }`**.
> No-op anti-enumeração (email inexistente/inativo/não verificado) responde o **mesmo 200 com
> delay mínimo de 250ms** (`equalizeNoopTiming`) — **piso de duração**, não equalização exata do
> fluxo completo (o envio de email tem latência variável); dificulta a enumeração por timing em vez
> de eliminá-la (residual documentado).
> `POST /auth/magic-link/verify` (T10) — que redime o token — está **implementado** em
> `src/app/api/v1/auth/magic-link/verify/route.ts` (contrato da seção abaixo).

### Requisição

```http
POST /api/v1/auth/magic-link
Content-Type: application/json
```

```json
{
  "email": "maria@email.com"
}
```

### Validação

| Campo | Tipo | Obrigatório | Regras |
|-------|------|-------------|--------|
| `email` | string | Sim | Formato e-mail válido |

> **Nota (contrato canônico):** o magic link é **email-only** — o campo opcional `redirectUrl`
> foi removido deste contrato (consistente com `T9`/`MagicLinkForm` `T21`, campo único email).

### Resposta — 200 OK

> **Nota (contrato canônico):** o body de sucesso é **plano** (flat) — `{ message }`, **sem**
> wrapper `data` — consistente com as rotas implementadas (register/login/magic-link/magic-link-verify/forgot-password/reset-password/refresh/logout).

```json
{
  "message": "Magic link enviado se o e-mail estiver cadastrado"
}
```

> **Nota**: Sempre retorna 200 para evitar enumeração de e-mails.

> **LGPD Soft-Delete (30-day window):** User soft-delete uses `deletedAt DateTime?` field. Active users are filtered by `isActive = true AND deletedAt IS NULL`. Restoration endpoint (future) sets `deletedAt = NULL` and `isActive = true` within 30-day window per sprint-0.clarifications.md.

### Erros

| Status | Código | Descrição |
|--------|--------|-----------|
| 422 | `VALIDATION_ERROR` | Body inválido ou campo extra rejeitado (Zod, com `details` por campo) |
| 429 | `AUTH_MAGIC_LINK_RATE_LIMIT` | Máximo 3 magic links/hora por e-mail (`retryAfter` no body) |
| 500 | `INTERNAL_ERROR` | Erro interno ao persistir token (inclui `meta.requestId`) |

> **Nota:** falha no envio do e-mail **não** retorna erro — o 200 é mantido (token persistido,
> usuário pode solicitar novo link). Erros incluem `meta.requestId` (C13).

---

## POST /auth/magic-link/verify

> **Status (T10 implementado):** esta rota está **implementada** em
> `src/app/api/v1/auth/magic-link/verify/route.ts`. Zod `magicLinkVerifySchema` (`{ token }`,
> `.strict()`), redime o token **single-use** (delete atômico via `deleteMany` com
> `expiresAt > now` — contagem 0 = já usado → 401). Token inexistente/tipo ≠ `MAGIC_LINK` →
> **401 `AUTH_MAGIC_TOKEN_INVALID`**; expirado (15 min) → **410 `AUTH_MAGIC_TOKEN_EXPIRED`**.
> **Contrato LGPD:** revalida `isActive=true AND deletedAt=null` do usuário (resolvido pelo
> `identifier` do token) antes de re-autenticar — inativo/deletado → 401 e token consumido.
> Sucesso: `signAccessToken` + `createRefreshSession` (ip/userAgent) → **200 `{ accessToken,
> user }`** + `Set-Cookie` httpOnly (`Path=/api/v1/auth`), mesmo formato do `/auth/login`.
>
> **Nota (interop com Auth.js):** a rota redime qualquer `VerificationToken` `MAGIC_LINK`
> vigente. Tokens emitidos por `POST /auth/magic-link` (T9) só existem para usuários com
> `emailVerified` setado (T9 exige verificação antes de emitir). Já os tokens do `EmailProvider`
> do Auth.js (`src/auth/prisma-adapter.ts` → `createVerificationToken`) também são gravados com
> `type=MAGIC_LINK` **sem** exigir `emailVerified` — ao redimir um por esta rota, o usuário
> autentica sem marcar `emailVerified` (o fluxo canônico de verificação é o callback do Auth.js).
> Assimetria consciente, **não documentada no plano T10** — follow-up (hardening): gate de
> `emailVerified` no verify, em paridade com o RF-AUTH-005 exigido no login.

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

> **Status (T13 implementado):** esta rota está **implementada** em
> `src/app/api/v1/auth/refresh/route.ts`. Lê o `refreshToken` do cookie httpOnly e chama
> `rotateRefresh` de `src/services/token-service.ts` (rotação condicional anti-race +
> revogação de família em reuso). O contrato abaixo reflete o comportamento implementado.

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
| 403 | `AUTH_ACCOUNT_SUSPENDED` | Conta suspensa (`isActive=false`/`deletedAt`) |
| 500 | `INTERNAL_ERROR` | Erro desconhecido (todos os erros incluem `meta.requestId`, C13) |

---

## POST /auth/logout

Revoga tokens e encerra sessão.

> **Status (T14 implementado):** esta rota está **implementada** em
> `src/app/api/v1/auth/logout/route.ts`. Lê o access token do header `Authorization: Bearer`,
> verifica via `verifyAccessToken` (de `src/services/token-service.ts`, S10) e delega a
> revogação de sessão aos helpers compartilhados `revokeRefreshSession`/`revokeAllSessions`
> do mesmo `token-service.ts` — **nunca duplica** lógica de rotação/revogação.

### Requisição

```http
POST /api/v1/auth/logout
Authorization: Bearer <accessToken>
Cookie: refreshToken=<rt_token>
```

> **Nota:** o access token é obrigatório (header `Authorization: Bearer`). O refresh token é
> lido **somente** do cookie httpOnly (`path=/api/v1/auth`) — nunca em body ou query string.

### Body (opcional)

```json
{
  "allDevices": true
}
```

| Campo | Tipo | Obrigatório | Regras |
|-------|------|-------------|--------|
| `allDevices` | boolean | Não | `true` revoga **todas** as sessões do usuário; `false`/ausente revoga apenas a sessão do refresh cookie |

### Resposta — 200 OK

```json
{
  "message": "Sessao encerrada com sucesso"
}
```

> **Nota (contrato canônico):** o body de sucesso é **plano** (flat) — `{ message }`, **sem**
> wrapper `data` — consistente com login/register/refresh implementados. A resposta sempre
> limpa o cookie de refresh via `Set-Cookie: refreshToken=; Path=/api/v1/auth; HttpOnly;
> SameSite=Strict; Max-Age=0` e define `Cache-Control: no-store`.

### Comportamento

1. Lê o access token do header `Authorization: Bearer`; ausente → 401 `AUTH_TOKEN_INVALID`
2. Verifica via `verifyAccessToken` (fail-closed, Redis+DB); mapeia `AuthTokenError`:
   - `AUTH_ACCOUNT_SUSPENDED` → 403
   - `AUTH_TOKEN_*` → 401
   - código desconhecido → 500 `INTERNAL_ERROR` (não vaza o código)
3. Lê o body opcional `{ allDevices }` (não-booleano/ausente → `false`)
4. **Default (single device):** chama `revokeRefreshSession(rawToken)` com o refresh do cookie
   (idempotente — sessão inexistente/já revogada não falha)
5. **`allDevices=true`:** chama `revokeAllSessions(userId)` — revoga **todas** as `Session` do
   usuário **pareado com bump de `tokenVersion`** (contrato de segurança architecture-review:
   invalida todos os access tokens emitidos)
6. Sempre limpa o cookie de refresh (`Max-Age=0`) e retorna `200 { message }`
7. `Cache-Control: no-store`; erros incluem `meta.requestId` (C13); log estruturado não expõe tokens

### Erros

| Status | Código | Descrição |
|--------|--------|-----------|
| 401 | `AUTH_TOKEN_INVALID` | Access token ausente ou inválido |
| 401 | `AUTH_TOKEN_REVOKED` | Access token revogado (tokenVersion/flags) |
| 403 | `AUTH_ACCOUNT_SUSPENDED` | Conta suspensa (`isActive=false`/`deletedAt`) |
| 500 | `INTERNAL_ERROR` | Erro desconhecido (código `AuthTokenError` não vazado; inclui `meta.requestId`, C13) |

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

> **Nota (contrato canônico):** o body de sucesso é **plano** (flat) — `{ message }`, **sem**
> wrapper `data` — consistente com as rotas implementadas.

```json
{
  "message": "Se o e-mail estiver cadastrado, voce recebera instrucoes para redefinir sua senha"
}
```

> **Nota**: Sempre retorna 200 para evitar enumeração (a mensagem é idêntica para e-mail existente ou
> não — o cliente não consegue distinguir). Contas suspensas (`isActive=false`) ou deletadas
> (`deletedAt` preenchido, LGPD) também recebem 200 sem gerar token nem enviar e-mail. O no-op
> aplica delay mínimo de 250ms (`equalizeNoopTiming`) — **piso de duração**, não equalização exata do
> fluxo completo (o envio de email tem latência variável); dificulta a enumeração por tempo em vez de
> eliminá-la (residual documentado).
>
> **Sem gate de `emailVerified`** — qualquer e-mail cadastrado ativo pode receber reset (verificado
> ou não) — e **sem limite por IP** (apenas 3/h por e-mail).

### Validação

| Campo | Tipo | Obrigatório | Regras |
|-------|------|-------------|--------|
| `email` | string | Sim | Formato e-mail; normalizado para minúsculas; `forgotPasswordSchema` `.strict()` rejeita campos extras (ex.: `redirectUrl`) |

### Erros

| Status | Código | Descrição |
|--------|--------|-----------|
| 422 | `VALIDATION_ERROR` | E-mail inválido, campo extra ou corpo não-JSON |
| 429 | `AUTH_FORGOT_RATE_LIMIT` | Limite de 3 pedidos/hora por e-mail atingido (`retryAfter` em segundos; janela de 1h; `MAX_PASSWORD_RESET_PER_EMAIL`) |
| 500 | `INTERNAL_ERROR` | Falha DB/SMTP desconhecida (inclui `meta.requestId`, C13) |

A contagem é registrada **antes** da verificação de existência do usuário, então pedidos de
e-mails inexistentes também consomem cota (anti-spam).

> **Fluxo completo (T11 → T12):** o token `PASSWORD_RESET` emitido aqui (1h) é **redimido** por
> `POST /auth/reset-password` (T12, seção abaixo) — single-use, com invalidação de todas as
> sessões do usuário no sucesso.

---

## POST /auth/reset-password

Redefine a senha usando token de recuperação.

> **Status (T12 implementado):** esta rota está **implementada** em
> `src/app/api/v1/auth/reset-password/route.ts`. Zod `resetPasswordSchema` (`{ token,
> password, passwordConfirmation }`, `.strict()` — rejeita campos extras), hash bcrypt **custo
> 12**, invalida **todas** as sessões do usuário via `revokeAllSessions(userId)` de
> `src/services/token-service.ts` (bump de `tokenVersion` + espelho Redis) e loga evento de
> segurança com código `AUTH_PASSWORD_RESET` (IP/userAgent). **Sem rate limit** nesta rota
> (rate limiting, incl. Redis-based, é tarefa posterior T27).

### Requisição

```http
POST /api/v1/auth/reset-password
Content-Type: application/json
```

```json
{
  "token": "reset_abc123def456",
  "password": "NovaSenhaForte456",
  "passwordConfirmation": "NovaSenhaForte456"
}
```

### Validação

Schema compartilhado em `src/lib/validators/auth.ts` (`resetPasswordSchema`, reusa
`passwordSchema` do register):

| Campo | Tipo | Obrigatório | Regras |
|-------|------|-------------|--------|
| `token` | string | Sim | Token `PASSWORD_RESET` válido (expira em 1h; máx. 256 chars) |
| `password` | string | Sim | Mesmas regras de cadastro (min 8 chars, 1 maiúsc, 1 minúsc, 1 número, 1 especial) |
| `passwordConfirmation` | string | Sim | Deve ser idêntico a `password` |

### Resposta — 200 OK

> **Nota (contrato canônico):** o body de sucesso é **plano** (flat) — `{ message }`, **sem**
> wrapper `data` — consistente com as rotas implementadas.

```json
{
  "message": "Senha redefinida com sucesso"
}
```

### Comportamento

1. Valida o body com `resetPasswordSchema` (422 `VALIDATION_ERROR` em falha, com `details` por campo; corpo não-JSON → 422)
2. Busca o `VerificationToken` por `token`; inexistente ou `type ≠ PASSWORD_RESET` → 401 `AUTH_RESET_TOKEN_INVALID`
3. Token expirado (1h) → **deleta o token** (`deleteMany`) e retorna 410 `AUTH_RESET_TOKEN_EXPIRED`
4. Revalida o usuário (`isActive=true AND deletedAt=null` via `identifier` do token) — usuário inativo/deletado (janela LGPD) → 401 `AUTH_RESET_TOKEN_INVALID` e token consumido (**nunca reativa conta via token válido**)
5. Redime o token **single-use** (delete atômico via `deleteMany` com `expiresAt > now` — contagem ≠ 1 = já usado → 401 `AUTH_RESET_TOKEN_INVALID`)
6. Hash da nova senha com **bcrypt custo 12**
7. `revokeAllSessions(userId)` — invalida **todas** as sessões (bump de `tokenVersion` + espelho Redis), **antes** do write da senha (ordem fail-safe: falha aqui deixa conta com sessões revogadas, senha intacta, token consumido — nunca senha nova com sessões antigas válidas)
8. Atualiza `passwordHash` e retorna **200 `{ message }`** com `Cache-Control: no-store`
9. Log de segurança `AUTH_PASSWORD_RESET` com IP/userAgent

### Erros

| Status | Código | Descrição |
|--------|--------|-----------|
| 422 | `VALIDATION_ERROR` | Body inválido, campo extra, senha fraca ou `passwordConfirmation` divergente (Zod, com `details` por campo) |
| 401 | `AUTH_RESET_TOKEN_INVALID` | Token inexistente, tipo ≠ `PASSWORD_RESET`, já usado (single-use) ou usuário inativo/deletado (LGPD) |
| 410 | `AUTH_RESET_TOKEN_EXPIRED` | Token expirado (1h) — deletado no momento da detecção |
| 500 | `INTERNAL_ERROR` | Falha interna (inclui `meta.requestId`, C13) |

> **Nota:** todos os erros incluem `meta.requestId` (C13). O token é **single-use**: após o
> sucesso ou após detecção de expiração/uso, uma nova tentativa com o mesmo token retorna 401.

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
| `AUTH_FORGOT_RATE_LIMIT` | 429 | Muitos pedidos de recuperação de senha por e-mail (3/h) | Aguardar 1 hora |
| `AUTH_MAGIC_TOKEN_INVALID` | 401 | Token de magic link inválido (já usado / single-use) | Solicitar novo link |
| `AUTH_MAGIC_TOKEN_EXPIRED` | 410 | Token de magic link expirado (15 min) | Solicitar novo link |
| `AUTH_EMAIL_VERIFY_INVALID` | 401 | Token de verificação de e-mail inválido (já usado) | Reenviar verificação |
| `AUTH_EMAIL_VERIFY_EXPIRED` | 410 | Token de verificação de e-mail expirado (24 h) | Reenviar verificação |
| `AUTH_RESET_TOKEN_INVALID` | 401 | Token de reset inválido (inexistente, tipo errado, já usado ou usuário inativo/deletado) | Solicitar novo link |
| `AUTH_RESET_TOKEN_EXPIRED` | 410 | Token de reset expirado (1 h) | Solicitar novo link |
| `AUTH_UNDER_AGE` | 422 | Menor de 18 anos | Bloquear cadastro |

> **Nota:** `AUTH_UNDER_AGE` não faz parte do contrato canônico de register (S11) — o cadastro
> do MVP não coleta `birthDate`/idade. Mantido na tabela apenas como referência histórica;
> não usar em implementações novas do register.