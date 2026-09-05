# Autenticação — Arkana Agora

> **Identificador**: `arkana-agora` | **Módulo**: Autenticação | **Versão**: MVP

---

## Descrição

O módulo de autenticação do **Arkana Agora** é responsável por gerenciar o ciclo de vida do usuário, desde o login inicial até o encerramento da conta. A camada de login do MVP é o **Auth.js v5** (`next-auth@5.0.0-beta.32` pinado — ADR-010, que supersede a cláusula "NextAuth.js v4 + adapter Prisma" do ADR-009) com **adapter Prisma mínimo** e estratégia de sessão **JWT**: **Google OAuth** e **magic link** são os fluxos do MVP, e a sessão real é o **cookie JWT do Auth.js** exposto em `/api/auth/*` (handler em `src/app/api/auth/[...nextauth]`). A **Custom JWT Layer** (access RS256 de 15 min + refresh rotativo de 30 dias, ADR-009 Gate B) é o estado-alvo da **Sprint 1**, com ponto de anexo nos callbacks `jwt`/`session` de `src/auth/auth.config.ts`. E-mail/senha (credentials), Facebook OAuth e as rotas `/api/v1/auth/*` (incluindo o rate limit de magic link) também são **Sprint 1**.

O magic link usa o `EmailProvider` do Auth.js (id `"email"`, callback `/api/auth/callback/email`): token **single-use** com validade de **15 minutos** via model `VerificationToken` (`type = "MAGIC_LINK"`, deletado na redenção); em dev, sem SMTP, `AUTH_EMAIL_SKIP_SEND=true` loga o link no console em vez de enviar.

**Dois fluxos de e-mail (não conflitantes):** (1) o magic link do MVP usa o `EmailProvider` do Auth.js via **nodemailer/SMTP** (`src/auth/auth.config.ts`, vars `SMTP_*`/`EMAIL_FROM`); (2) os e-mails transacionais das rotas REST `/api/v1/auth/*` (verificação de e-mail, reset de senha, magic link) usam o **Resend** via `src/lib/email/email.ts` (helpers `sendVerificationEmail`/`sendPasswordResetEmail`/`sendMagicLinkEmail`, implementado no T3), com guard de dev `AUTH_EMAIL_SKIP_SEND=true` (`NODE_ENV=development` obrigatório). O vínculo OAuth usa `User.provider`/`providerId` (`@@unique([provider, providerId])`, normalização H-2) — sem model `Account` no MVP (provedor único por usuário). A recuperação de senha e a exclusão completa da conta seguem o design de `docs/04-api/authentication.md` e `.specs/001-auth/design.md` (Sprint 1), em conformidade com a LGPD (soft delete com janela de 30 dias).

---

## Funcionalidades

- **Login por magic link** — MVP: `EmailProvider` do Auth.js, token single-use válido por 15 minutos (`VerificationToken`, `type = "MAGIC_LINK"`)
- **Login via OAuth (Google)** — MVP: vínculo via `User.provider`/`providerId`, sem model `Account` (provedor único no MVP); provider condicional a `AUTH_GOOGLE_ID`/`AUTH_GOOGLE_SECRET`
- **Sessão JWT do Auth.js** — MVP: cookie JWT (`session: { strategy: "jwt" }`), sem gravação de sessão no banco
- **Proteção de rotas** — MVP (duas camadas): `src/proxy.ts` (Next 16, matcher `/dashboard/:path*`, validando via `getToken({ secret: AUTH_SECRET })`) + guard de auth no layout do route group `src/app/(app)/layout.tsx` (server component: `auth()` e `redirect("/login")` sem sessão — adicionado na F2B, defesa em profundidade)
- **Cadastro por e-mail e senha** — Sprint 1: **T6 implementado** — `POST /api/v1/auth/register` (validação de formato/força da senha via Zod, hash bcrypt custo 12, verificação de e-mail com token 24h; **não faz auto-login**)
- **Verificação de e-mail** — Sprint 1: **T30 implementado** — `POST /api/v1/auth/verify-email` (redime `VerificationToken type=EMAIL` single-use 24h; 401 `AUTH_EMAIL_VERIFY_INVALID` / 410 `AUTH_EMAIL_VERIFY_EXPIRED`; guarda LGPD; marca `emailVerified` + `bumpTokenVersion`) e `POST /api/v1/auth/verify-email/resend` (reenvio anti-enumeração, 200 uniforme)
- **Login por e-mail e senha** — Sprint 1: **T7 implementado** — `POST /api/v1/auth/login` (Zod `loginSchema`, lockout de conta 5 falhas/15min, rate limit por IP 5/15min, anti-enumeração, access RS256 + refresh session 30d)
- **Refresh de token** — Sprint 1: **T13 implementado** — `POST /api/v1/auth/refresh` (lê `refreshToken` do cookie httpOnly, chama `rotateRefresh`, rotação com mesmo `familyId`, reuso revoga família, `200 { accessToken, expiresIn }` + Set-Cookie)
- **Logout** — Sprint 1: **T14 implementado** — `POST /api/v1/auth/logout` (lê access token do `Authorization: Bearer`, verifica via `verifyAccessToken`, delega revogação a `revokeRefreshSession`/`revokeAllSessions` do `token-service.ts`, limpa cookie de refresh, `200 { message }` flat)
- **Login via OAuth (Facebook)** — Sprint 1 (não faz parte da camada de login do MVP, ADR-010)
- **Recuperação de senha** — Sprint 1: **T11 implementado** — `POST /api/v1/auth/forgot-password` (Zod `forgotPasswordSchema` email-only `.strict()`, anti-enumeração 200 idêntico para e-mail existente/inexistente/suspenso/deletado, token 64 chars `VerificationToken type=PASSWORD_RESET` 1h, envio via `sendPasswordResetEmail`, rate limit 429 `AUTH_FORGOT_RATE_LIMIT` máx. 3/hora por e-mail — contagem registrada antes da verificação de existência, anti-spam); **T12 implementado** — `POST /api/v1/auth/reset-password` (Zod `resetPasswordSchema` `{ token, password, passwordConfirmation }` `.strict()`, hash bcrypt custo 12, token single-use, 401 `AUTH_RESET_TOKEN_INVALID` / 410 `AUTH_RESET_TOKEN_EXPIRED` (1h), invalida **todas** as sessões via `revokeAllSessions` + log de segurança `AUTH_PASSWORD_RESET`; **sem rate limit** — T27 posterior)
- **Rotas de rate limit de magic link** — Sprint 1: **T9 implementado** — `POST /api/v1/auth/magic-link` (Zod `magicLinkSchema` email-only `.strict()`, anti-enumeração 200 idêntico, token 64 chars `VerificationToken type=MAGIC_LINK` 15min, envio via `sendMagicLinkEmail`, rate limit 429 `AUTH_MAGIC_LINK_RATE_LIMIT` máx. 3/hora por e-mail; **T10 verify implementado** — `POST /api/v1/auth/magic-link/verify` consome o token single-use, 401 `AUTH_MAGIC_TOKEN_INVALID` / 410 `AUTH_MAGIC_TOKEN_EXPIRED`)
- **Custom JWT Layer** — Sprint 1: access token (15 min, RS256) + refresh token rotativo (30 dias, cookie httpOnly `path=/api/v1/auth`) — **T9 implementado** (`POST /api/v1/auth/magic-link`), **T10 implementado** (`POST /api/v1/auth/magic-link/verify`), **T11 implementado** (`POST /api/v1/auth/forgot-password`), **T12 implementado** (`POST /api/v1/auth/reset-password`), **T13 implementado** (`POST /api/v1/auth/refresh`), **T14 implementado** (`POST /api/v1/auth/logout`), **T30 implementado** (`POST /api/v1/auth/verify-email` + `POST /api/v1/auth/verify-email/resend`)
- **Exclusão de conta (LGPD)** — Sprint 1: soft delete (`deletedAt`) com janela de restauração de 30 dias
- **Sessões ativas** — Sprint 1: visualização e revogação de dispositivos conectados

---

## Configuração do Google OAuth (credenciais)

O login via Google OAuth (MVP, ADR-010) requer um **OAuth 2.0 Client** no Google Cloud Console. O provider é **condicional**: só é registrado em `src/auth/auth.config.ts` quando as duas vars `AUTH_GOOGLE_ID` e `AUTH_GOOGLE_SECRET` estão definidas (sem elas, o magic link segue funcional).

### Criar as credenciais (Google Cloud Console)

1. Acesse [Google Cloud Console](https://console.cloud.google.com/) e selecione (ou crie) um projeto.
2. Navegue para **APIs & Services → OAuth consent screen** (`https://console.cloud.google.com/apis/credentials/consent`):
   - Escolha **External** (aplicação de teste / produção requer verificação publicada).
   - Preencha app name e e-mail de suporte; salve.
3. Navegue para **APIs & Services → Credentials → Create credentials → OAuth client ID** (`https://console.cloud.google.com/apis/credentials`):
   - Application type: **Web application**.
   - **Authorized redirect URIs**: adicione a URL de callback do Auth.js:
     - Local dev: `http://localhost:3000/api/auth/callback/google`
     - Produção: `https://SEU-DOMINIO/api/auth/callback/google` (substitua `SEU-DOMINIO`)
   - **Authorized JavaScript origins** (opcional, se necessário): origem da aplicação (ex.: `http://localhost:3000`).
   - Clique em **Create**.
4. Copie o **Client ID** e o **Client Secret** exibidos.

### Configurar as variáveis de ambiente

Use a convenção `AUTH_GOOGLE_*` (não `GOOGLE_CLIENT_*`):

- `AUTH_GOOGLE_ID` — o **Client ID** (termine com `.apps.googleusercontent.com`).
- `AUTH_GOOGLE_SECRET` — o **Client Secret**.

Preencha em `.env` (dev local) e nas variáveis de ambiente de produção/staging (nunca no `.env.example`, que só tem nomes, nem em `.env.local`). A URL de callback é derivada por `AUTH_URL`/`AUTH_TRUST_HOST` no Auth.js v5 — não é obrigatório definir `GOOGLE_CALLBACK_URL` explicitamente.

---

## Fluxo Principal (MVP)

1. O usuário acessa `/login` e escolhe **magic link** ou **Entrar com Google**
2. **Magic link**: o usuário informa o e-mail; o `EmailProvider` do Auth.js gera o token em `VerificationToken` e envia o link (15 min, single-use; em dev, `AUTH_EMAIL_SKIP_SEND=true` loga o link no console)
3. O clique no link autentica no callback `/api/auth/callback/email` (o token é deletado na redenção — single-use)
4. **Google OAuth**: o Auth.js redireciona para o consent screen; no callback `/api/auth/callback/google`, o adapter mínimo busca/cria o usuário (`getUserByAccount`/`getUserByEmail`/`createUser` + `linkAccount`)
5. A sessão é o **cookie JWT do Auth.js** (JWT strategy) — o Auth.js não grava sessões no banco
6. Rotas protegidas (`/dashboard/:path*`) são validadas em `src/proxy.ts` via `getToken({ secret: AUTH_SECRET })` e, em nível de route group, pelo guard `src/app/(app)/layout.tsx` (`auth()` + `redirect("/login")` — F2B); sem sessão válida, redireciona para `/login`
7. **Sprint 1**: a Custom JWT Layer assume após o callback (callbacks `jwt`/`session` em `src/auth/auth.config.ts`): access token (15 min, RS256) + refresh token rotativo (30 dias)
8. **Sprint 1**: rate limit de magic link (3/hora — T9 implementado), recuperação de senha (1h — T11 implementado) e exclusão de conta (LGPD, 30 dias)

---

## Cadastro por e-mail e senha (`POST /api/v1/auth/register`) — T6 implementado

Primeira rota da **Custom JWT Layer** (Fase 2) implementada em
`src/app/api/v1/auth/register/route.ts`. Contrato canônico conforme o plano S11 (design §3),
que supersede a divergência antiga da `docs/04-api/authentication.md` (sem `birthDate`/idade,
sem auto-login).

### Contrato do endpoint

- **Body** `{ name, email, password, passwordConfirmation, acceptTerms }` — **sem `birthDate`**
- **201** → `{ user: { id, name, email, emailVerified }, message }` — **sem `accessToken`/`meta`**
  (o cadastro **NÃO faz auto-login**; exige verificação de e-mail — RF-AUTH-005)
- **409** `AUTH_EMAIL_ALREADY_EXISTS` — e-mail duplicado (busca case-insensitive)
- **422** `VALIDATION_ERROR` — falha de validação Zod (com `details` por campo)
- **500** `INTERNAL_ERROR` — falha interna ao criar conta

### Validação (Zod)

Schemas compartilhados em **`src/lib/validators/auth.ts`** (local canônico para validação de
register/senha das rotas `/api/v1/auth/*`):

- `passwordSchema` — min 8 chars + 1 maiúscula + 1 minúscula + 1 número + 1 especial
- `registerSchema` — `name` 2–50, `email` RFC, `password` (via `passwordSchema`),
  `passwordConfirmation` idêntico, `acceptTerms === true`
- `RegisterInput` — tipo inferido (`z.infer<typeof registerSchema>`)

### Comportamento

1. Valida o body com `registerSchema` (422 `VALIDATION_ERROR` em falha)
2. Normaliza `email` para minúsculas; busca duplicado case-insensitive (409 `AUTH_EMAIL_ALREADY_EXISTS`)
3. Hash da senha com **bcrypt custo 12** (`BCRYPT_COST = 12`) — nunca plaintext
4. Cria `User` com `role=USER`, `plan=FREE`, `provider=EMAIL`, `providerId=email-lowercase`
   (convenção S7), `displayName=name`
5. Cria `VerificationToken` `type=EMAIL` com validade de **24h**
6. Envia e-mail de verificação apontando para o frontend `/auth/verify-email?token=...`
   (helper `sendVerificationEmail` de `src/lib/email/email.ts`)
7. Retorna **201** com `user` + `message`

### Observability

Respostas de erro usam o envelope `{ error: { code, message, details? } }` com correlação
`requestId`/`newReqId()` e log estruturado Pino (`src/lib/logger.ts`) em cada etapa
(`[auth:register] ...`).

### Testes

`tests/register.test.ts` — 10 testes vitest cobrindo o contrato do register (validação,
duplicado, hash, criação de token de verificação, resposta 201, erros 409/422).

---

## Login por e-mail e senha (`POST /api/v1/auth/login`) — T7 implementado

Segunda rota da **Custom JWT Layer** (Fase 2) implementada em
`src/app/api/v1/auth/login/route.ts`. Contrato canônico conforme o plano S11 (design §3).

### Contrato do endpoint

- **Body** `{ email, password }` — validado com `loginSchema` de `src/lib/validators/auth.ts`
- **200** → `{ accessToken, user: { id, name, email, displayName, role, plan, avatar } }`
  — **body plano (flat), sem wrapper `data`** + `Set-Cookie: refreshToken`
  (`Path=/api/v1/auth`, `HttpOnly`, `SameSite=Strict`, `Max-Age=2592000` = 30 dias)
- **422** `VALIDATION_ERROR` — falha de validação Zod (com `details` por campo)
- **403** `AUTH_ACCOUNT_LOCKED` — 5 falhas consecutivas (body com `retryAfter: 900`)
- **429** `AUTH_RATE_LIMITED` — limite de volume por IP (5/15min; body com `retryAfter`)
- **403** `AUTH_ACCOUNT_SUSPENDED` — `isActive=false` ou `deletedAt` set
- **401** `AUTH_EMAIL_NOT_VERIFIED` — e-mail não verificado
- **401** `AUTH_INVALID_CREDENTIALS` — credenciais incorretas (anti-enumeração)

### Serviços de suporte (implementados)

- **`src/services/token-service.ts`** — `sha256()`, `signAccessToken` (RS256 via jose, 15min,
  claims `role`/`plan`/`tokenVersion`), `verifyAccessToken` (fail-closed, Redis cache com
  fallback DB, admin recheck de `isActive`/`deletedAt`), `createRefreshSession` (Session 30d),
  `rotateRefresh` (rotação + revogação de família em reuso), `bumpTokenVersion` (incremento
  atômico), `revokeRefreshSession` (revoga Session por hash; idempotente), `revokeAllSessions`
  (revoga todas as Session + bump de `tokenVersion`), `AuthTokenError`
- **`src/lib/rate-limit.ts`** — rate limiting em memória: lockout de conta (5 falhas
  consecutivas → 15min, `retryAfter`) e limite de volume por IP (5/15min → 429),
  `resetRateLimiter()`
- **`src/lib/redis.ts`** — singleton Redis (ioredis, `lazyConnect`, gated on `REDIS_URL` env)

### Testes

`tests/login.test.ts` — testes vitest cobrindo o contrato do login (validação, lockout,
rate limit, suspensão, email não verificado, credenciais inválidas, sucesso com accessToken
+ refresh cookie).

---

## Refresh de token (`POST /api/v1/auth/refresh`) — T13 implementado

Terceira rota da **Custom JWT Layer** (Fase 2) implementada em
`src/app/api/v1/auth/refresh/route.ts`.

### Contrato do endpoint

- **Cookie** `refreshToken` (httpOnly, `path=/api/v1/auth`) — nunca em body/query
- **200** → `{ accessToken, expiresIn }` + `Set-Cookie` do refresh rotacionado (mesmo `familyId`)
- **401** `AUTH_REFRESH_TOKEN_INVALID` / `AUTH_REFRESH_TOKEN_EXPIRED` / `AUTH_REFRESH_TOKEN_REVOKED`
- **403** `AUTH_ACCOUNT_SUSPENDED` — conta suspensa (`isActive=false`/`deletedAt`)
- **500** `INTERNAL_ERROR` — erro desconhecido
- Todos os erros incluem `meta.requestId` (C13)

### Comportamento

1. Lê o `refreshToken` do cookie httpOnly
2. Chama `rotateRefresh` de `src/services/token-service.ts` (rotação condicional anti-race +
   revogação de família em reuso)
3. Sucesso: retorna `200 { accessToken, expiresIn }` + `Set-Cookie` do refresh rotacionado
4. Mapeia `AuthTokenError` para HTTP (401/403/500 conforme o código)
5. Log estruturado não expõe o token

### Testes

`tests/refresh.test.ts` — 8 testes vitest cobrindo o contrato do refresh (rotação, reuso,
expiração, invalidação, suspensão, sucesso com accessToken + Set-Cookie).

---

## Logout (`POST /api/v1/auth/logout`) — T14 implementado

Quarta rota da **Custom JWT Layer** (Fase 2) implementada em
`src/app/api/v1/auth/logout/route.ts`.

### Contrato do endpoint

- **Header** `Authorization: Bearer <accessToken>` (obrigatório) — verificado via
  `verifyAccessToken` de `src/services/token-service.ts`
- **Cookie** `refreshToken` (httpOnly, `path=/api/v1/auth`) — lido para revogação single-device
- **Body (opcional)** `{ allDevices?: boolean }` — `true` revoga todas as sessões do usuário
- **200** → `{ message }` — **body plano (flat), sem wrapper `data`** (consistente com
  login/register/refresh) + `Set-Cookie` limpando o refresh (`Max-Age=0`) + `Cache-Control: no-store`
- **401** `AUTH_TOKEN_INVALID` / `AUTH_TOKEN_REVOKED` — access token ausente/inválido/revogado
- **403** `AUTH_ACCOUNT_SUSPENDED` — conta suspensa (`isActive=false`/`deletedAt`)
- **500** `INTERNAL_ERROR` — erro desconhecido (código `AuthTokenError` não vazado)
- Todos os erros incluem `meta.requestId` (C13)

### Comportamento

1. Lê o access token do header `Authorization: Bearer`; ausente → 401 `AUTH_TOKEN_INVALID`
2. Verifica via `verifyAccessToken`; mapeia `AuthTokenError` (403 suspensão / 401 `AUTH_TOKEN_*` /
   500 código desconhecido)
3. Lê o body opcional `{ allDevices }` (não-booleano/ausente → `false`)
4. **Default:** chama `revokeRefreshSession(rawToken)` com o refresh do cookie (idempotente)
5. **`allDevices=true`:** chama `revokeAllSessions(userId)` — revoga todas as `Session` +
   **bump de `tokenVersion`** (contrato de segurança architecture-review: invalida todos os
   access tokens emitidos)
6. Sempre limpa o cookie de refresh (`Max-Age=0`) e retorna `200 { message }`
7. Log estruturado não expõe tokens (C13)

### Serviços de suporte (implementados)

- **`src/services/token-service.ts`** — adiciona `revokeRefreshSession(rawToken)` (revoga a
  `Session` pelo hash do token; idempotente) e `revokeAllSessions(userId)` (revoga todas as
  `Session` + `bumpTokenVersion`). A rota **nunca duplica** lógica de rotação/revogação — delega
  tudo ao serviço compartilhado (S10).

### Testes

`tests/logout.test.ts` — 9 testes vitest cobrindo o contrato do logout (revogação single-device,
idempotência sem refresh cookie, `allDevices=true`, `allDevices` não-booleano, 401/403/500,
não exposição de tokens). `tests/token-service.test.ts` — 4 testes adicionais para
`revokeRefreshSession`/`revokeAllSessions`.

---

## Redefinição de senha (`POST /api/v1/auth/reset-password`) — T12 implementado

Rota que redime o token `PASSWORD_RESET` emitido pelo forgot-password (T11), implementada em
`src/app/api/v1/auth/reset-password/route.ts`.

### Contrato do endpoint

- **Body** `{ token, password, passwordConfirmation }` — validado com `resetPasswordSchema` de
  `src/lib/validators/auth.ts` (`.strict()`, reusa `passwordSchema` do register)
- **200** → `{ message: "Senha redefinida com sucesso" }` — **body plano (flat), sem wrapper
  `data`** (consistente com as demais rotas)
- **422** `VALIDATION_ERROR` — body inválido, campo extra, senha fraca ou `passwordConfirmation`
  divergente (com `details` por campo); corpo não-JSON → 422
- **401** `AUTH_RESET_TOKEN_INVALID` — token inexistente, tipo ≠ `PASSWORD_RESET`, já usado
  (single-use) ou usuário inativo/deletado (janela LGPD — **nunca reativa conta via token válido**)
- **410** `AUTH_RESET_TOKEN_EXPIRED` — token expirado (1h); deletado no momento da detecção
- **500** `INTERNAL_ERROR` — falha interna (inclui `meta.requestId`, C13)
- **Sem rate limit** nesta rota (rate limiting, incl. Redis-based, é tarefa posterior T27)

### Comportamento

1. Valida o body com `resetPasswordSchema` (422 `VALIDATION_ERROR` em falha)
2. Busca o `VerificationToken` por `token`; inexistente ou `type ≠ PASSWORD_RESET` → 401
3. Token expirado (1h) → deleta o token e retorna 410 `AUTH_RESET_TOKEN_EXPIRED`
4. Revalida o usuário (`isActive=true AND deletedAt=null` via `identifier` do token) —
   inativo/deletado → 401 e token consumido
5. Redime o token **single-use** (delete atômico via `deleteMany` com `expiresAt > now` —
   contagem ≠ 1 = já usado → 401)
6. Hash da nova senha com **bcrypt custo 12** (`BCRYPT_COST = 12`) e atualiza `passwordHash`
7. `revokeAllSessions(userId)` — invalida **todas** as sessões (bump de `tokenVersion` + espelho Redis)
8. Log de segurança `AUTH_PASSWORD_RESET` com IP/userAgent; retorna **200 `{ message }`**

### Testes

`tests/reset-password.test.ts` — 14 testes vitest cobrindo o contrato do reset-password
(validação, token inválido/tipo errado, expirado, single-use, usuário inativo/deletado LGPD,
hash bcrypt custo 12, revogação de sessões, 200 flat, 401/410/422/500).

---

## Versão

| Feature | Versão |
|---|---|
| Login OAuth (Google) | MVP |
| Magic Link | MVP |
| Sessão JWT do Auth.js (`/api/auth/*`) | MVP |
| Proteção de rotas (`src/proxy.ts` + `src/app/(app)/layout.tsx`) | MVP |
| Cadastro e-mail/senha (`POST /api/v1/auth/register`) | Sprint 1 — **T6 implementado** |
| Login e-mail/senha (`POST /api/v1/auth/login`) | Sprint 1 — **T7 implementado** |
| Refresh de token (`POST /api/v1/auth/refresh`) | Sprint 1 — **T13 implementado** |
| Logout (`POST /api/v1/auth/logout`) | Sprint 1 — **T14 implementado** |
| Login OAuth (Facebook) | Sprint 1 |
| Rotas de rate limit de magic link (`/api/v1/auth/magic-link`) | Sprint 1 — **T9 implementado** |
| Recuperação de senha (`POST /api/v1/auth/forgot-password`) | Sprint 1 — **T11 implementado** |
| Redefinição de senha (`POST /api/v1/auth/reset-password`) | Sprint 1 — **T12 implementado** |
| Custom JWT Layer (access/refresh) | Sprint 1 — **parcial (register/login/magic-link/magic-link-verify/forgot-password/reset-password/refresh/logout/verify-email/verify-email-resend implementados)** |
| Exclusão de conta (LGPD) | Sprint 1 |
| Verificação de e-mail | Sprint 1 — **T30 implementado** |

---

## Dependências

| Dependência | Tipo | Descrição |
|---|---|---|
| `next-auth` (Auth.js v5) | Biblioteca | Camada de login (Google OAuth + magic link); `5.0.0-beta.32` pinado (ADR-010; ≥ beta.32 mitiga GHSA-8fpg-xm3f-6cx3) |
| `nodemailer` + `@types/nodemailer` | Biblioteca | Envio dos e-mails de magic link |
| Banco de dados | Infraestrutura | Tabelas `users`, `verification_tokens` (adapter mínimo; sem model `Account` no MVP) |
| Serviço de e-mail (SMTP) | Serviço externo | Envio de magic links (dev: `AUTH_EMAIL_SKIP_SEND=true` loga o link no console) |
| Google OAuth / Facebook Login | API externa | Autenticação social (Google: MVP; Facebook: Sprint 1) |
| `bcryptjs` + `@types/bcryptjs` | Biblioteca | Hash de senhas — e-mail/senha (Sprint 1; **instalado no F1/T1**) |
| `jose` | Biblioteca | JWT RS256 da Custom JWT Layer (Sprint 1; **instalado no F1/T1**) |
| `zustand` | Biblioteca | Store de auth do frontend (Sprint 1; **instalado no F1/T1**) |
| `ioredis` + `@types/ioredis` | Biblioteca | Redis: validação de `tokenVersion` + rate limiting (Sprint 1; **instalado no F1/T1**) |
| `axios` | Biblioteca | Interceptor de API com refresh token (Sprint 1; **instalado no F1/T1**) |
| `resend` | Biblioteca | Provedor de e-mail transacional (issue #3): `src/lib/email/email.ts` com helpers `sendVerificationEmail`/`sendPasswordResetEmail`/`sendMagicLinkEmail` (**implementado no T3**) — consumido pelas rotas REST `/api/v1/auth/*` da Sprint 1 |
| `zod` | Biblioteca | Validação de inputs das rotas `/api/v1/auth/*` (Sprint 1) |

---

## Critérios de Aceite

- **CA-01**: O login com magic link deve autenticar o usuário e o e-mail deve ser enviado em até 10 segundos (em dev, o link é logado no console via `AUTH_EMAIL_SKIP_SEND=true`)
- **CA-02**: O token do magic link deve ser single-use e expirar em 15 minutos; redenção de token já usado deve falhar
- **CA-03**: O login com Google OAuth deve criar ou vincular a conta sem duplicação (vínculo via `User.provider`/`providerId`, sem model `Account`)
- **CA-04**: A sessão do MVP é o cookie JWT do Auth.js (`/api/auth/*`); a Custom JWT Layer (access/refresh) é Sprint 1, ancorada nos callbacks `jwt`/`session` de `src/auth/auth.config.ts`
- **CA-05**: O rate limit de magic link (máx. 3/hora por e-mail) deve retornar 429 `AUTH_MAGIC_LINK_RATE_LIMIT` — Sprint 1 (`POST /api/v1/auth/magic-link`)
- **CA-06**: A exclusão de conta deve marcar o registro para exclusão em 30 dias (LGPD, soft delete `deletedAt`) com possibilidade de restauração — Sprint 1
- **CA-07**: Tentativas de login com credenciais inválidas devem ser limitadas a 5 por IP em 15 minutos (rate limiting) — Sprint 1 (e-mail/senha)
- **CA-08**: O rate limit de forgot-password (máx. 3/hora por e-mail) deve retornar 429 `AUTH_FORGOT_RATE_LIMIT` com `retryAfter` — Sprint 1 (`POST /api/v1/auth/forgot-password`)
- **CA-09**: O reset de senha (`POST /api/v1/auth/reset-password`) deve redefinir a senha com bcrypt custo 12, consumir o token `PASSWORD_RESET` (single-use, 1h), invalidar **todas** as sessões do usuário (`revokeAllSessions`) e retornar 401 `AUTH_RESET_TOKEN_INVALID` / 410 `AUTH_RESET_TOKEN_EXPIRED` — Sprint 1 (T12)
