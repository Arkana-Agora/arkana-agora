# Segurança — Arkana Agora

> **Identificador**: `arkana-agora` | **Módulo**: Segurança | **Versão**: MVP

---

## Descrição

O módulo de Segurança do **Arkana Agora** define as medidas técnicas e organizacionais para proteger a plataforma, os dados dos usuários e a infraestrutura contra ameaças cibernéticas. A segurança é tratada em camadas: autenticação forte, proteção da API, transporte seguro, gestão de segredos, segurança de dependências e resposta a incidentes. Todas as medidas seguem as melhores práticas da OWASP e são alinhadas aos requisitos da LGPD para proteção de dados pessoais.

Este documento serve como referência para desenvolvedores e equipe de infraestrutura, estabelecendo padrões obrigatórios para toda a base de código. A conformidade com estas diretrizes é verificada em code review, CI/CD pipelines e auditorias de segurança periódicas.

---

## Autenticação

### Hash de Senhas

| Parâmetro | Valor | Justificativa |
|---|---|---|
| Algoritmo | `bcrypt` | Padrão da indústria, resistente a brute-force |
| Salt rounds | 12 | Equilíbrio entre segurança e performance (~250ms por hash) |
| Tamanho mínimo da senha | 8 caracteres | Conformidade OWASP |
| Validação de força | `zxcvbn` (score ≥ 3) | Detecção de senhas fracas |

```typescript
// Exemplo de hash
const saltRounds = 12;
const hashedPassword = await bcrypt.hash(password, saltRounds);

// Exemplo de verificação
const isValid = await bcrypt.compare(inputPassword, hashedPassword);
```

> **Rotas que gravam senha (bcrypt custo 12 obrigatório):** `POST /api/v1/auth/register` (T6) e
> `POST /api/v1/auth/reset-password` (T12) — ambas usam `BCRYPT_COST = 12` ao gravar
> `passwordHash`. Nenhuma senha em texto puro, em logs ou em banco (CA-01).

### JWT (JSON Web Tokens) — fluxo híbrido (ADR-009)

> **Status:** a emissão/verificação de tokens está **implementada** em
> `src/services/token-service.ts` (`signAccessToken`, `verifyAccessToken`,
> `createRefreshSession`, `rotateRefresh`, `bumpTokenVersion`, `revokeRefreshSession`,
> `revokeAllSessions`). As rotas de refresh (`POST /api/v1/auth/refresh`, T13) e logout
> (`POST /api/v1/auth/logout`, T14) estão **expostas** em
> `src/app/api/v1/auth/refresh/route.ts` e `src/app/api/v1/auth/logout/route.ts`.

| Parâmetro | Access Token | Refresh Token |
|---|---|---|
| Algoritmo | RS256 | Opaco (gerado via `randomBytes`); apenas o hash SHA-256 é persistido |
| Chave | Par RSA (2048 bits) | N/A (opaco, não assinado) |
| Expiração | 15 minutos | 30 dias |
| Armazenamento | Memória do cliente | Cookie httpOnly, Secure, SameSite=Strict + tabela `Session` (hash) |
| Rotação | Não | Sim (a cada uso, o anterior é invalidado, mantendo o `familyId`) |

> **Par de chaves (obrigatório):** `JWT_PRIVATE_KEY` e `JWT_PUBLIC_KEY` devem existir **juntos** e pertencer ao **mesmo par** (256 bytes SPKI/PKCS#8, multiline PEM). Com `JWT_PUBLIC_KEY` ausente, TODOS os access tokens — inclusive os recém-emitidos — eram rejeitados como 401 (bug corrigido em 2026-09-24: `verifyAccessToken` agora separa erro de config da rejeição de token). Sinais: toda chamada autenticada responde `401 AUTH_TOKEN_INVALID` com refresh 200 em loop. Pós-fix: chave ausente/malformada → 500 `AUTH_CONFIG_INVALID_PUBLIC_KEY`; assinatura inválida continua sendo 401. Runbook: `docs/runbooks/jwt-public-key-missing-all-401.md`. Na rotação (90 dias), troque **ambas** as chaves no mesmo deploy.

> **Consumidor extra da pública (Sprint 2 Phase 2.5, 2026-10-02):** o mini-service `socket-service/` valida o access token no handshake Socket.io com a **mesma `JWT_PUBLIC_KEY`** (`socket-service/src/auth.ts` — `jose` + `algorithms: ["RS256"]`). É a implementação da nota do ADR-009 sobre a ADR-007 (o `JWT_SECRET` previsto no plano T069 está obsoleto). O handshake **checa** a claim `tokenVersion` contra o espelho Redis `auth:tokenVersion:{userId}` (`socket-service/src/redis-auth.ts` — cache miss/Redis fora é **fail-open**, pois o container não tem Prisma) e a revogação efetiva chega por kick imediato no canal `auth:kicks` (`publishAuthKick()` chamado por `bumpTokenVersion`/`revokeAllSessions`/`softDeleteAccount` em `src/services/token-service.ts`) + revalidação periódica de 60 s (exp + tokenVersion) em `socket-service/src/server.ts`; a expiração de 15 min é o fallback final. Sem `JWT_PUBLIC_KEY`, o socket-service **não sobe** (falha do Zod em `socket-service/src/lib/env.ts`).

> **Geração do par (dev):** `node -e "const{generateKeyPairSync}=require('node:crypto');const{publicKey,privateKey}=generateKeyPairSync('rsa',{modulusLength:2048});process.stdout.write(privateKey.export({type:'pkcs8',format:'pem'})+publicKey.export({type:'spki',format:'pem'}))"` — cole ambos em `.env.local` como blocos PEM multiline (sem aspas duplas de agrupamento, ou mantendo o formato já usado no arquivo).

```typescript
// Payload do access token (implementado em src/services/token-service.ts)
interface JWTPayload {
  sub: string;          // userId
  role: UserRole;
  plan: UserPlan;
  tokenVersion: number; // bump em mudança de role/plan, suspensão ou logout-all
  iat: number;          // issued at
  exp: number;          // expiration
}
// Permissões NÃO vão no token: derivadas server-side a partir do role.
// `verifyAccessToken` é fail-closed: valida tokenVersion contra Redis (cache) com fallback
// DB; requisições ADMIN re-checam isActive/deletedAt no banco.
```

### Refresh Token Rotation

1. O cliente envia o refresh token via cookie httpOnly (`path=/api/v1/auth`)
2. O servidor busca a sessão pelo hash SHA-256 do token e valida `expiresAt`/`revokedAt`
3. O servidor assina o novo access token **antes** da transação — se a assinatura falhar, a rotação ainda não cometeu e o token antigo continua válido
4. A rotação roda num **`prisma.$transaction` interativo**: o `updateMany` condicional revalida atomicamente `replacedByTokenId: null` AND `revokedAt: null` AND `expiresAt > now` (fecha a corrida rotação-vs-revogação) e, se `count === 1`, cria o novo token (mesmo `familyId`)
5. O novo refresh token é enviado em cookie
6. Se um refresh token já rotacionado for reenviado (reuso), todos os tokens da família (`familyId`) são revogados (detecção de roubo)

### Logout e revogação de sessão (T14 implementado)

A rota `POST /api/v1/auth/logout` (`src/app/api/v1/auth/logout/route.ts`) delega a revogação
aos helpers compartilhados de `src/services/token-service.ts` — **nunca duplica** lógica de
rotação/revogação (S10):

- **`revokeRefreshSession(rawToken)`** — revoga a `Session` cujo hash SHA-256 do token casa;
  idempotente (sessão inexistente/já revogada → `revoked: false`, sem erro). Usado no logout
  padrão (single device), lendo o refresh do cookie httpOnly.
- **`revokeAllSessions(userId)`** — revoga **todas** as `Session` do usuário **pareado com bump
  de `tokenVersion`** (contrato de segurança architecture-review). O bump invalida **todos** os
  access tokens emitidos (validados fail-closed contra Redis/DB em `verifyAccessToken`). Usado
  quando o body `{ allDevices: true }` é enviado no logout **e** no sucesso de
  `POST /api/v1/auth/reset-password` (T12) — redefinir a senha derruba todas as sessões ativas
  (incl. access tokens emitidos antes do reset).

O logout sempre limpa o cookie de refresh (`Set-Cookie: Max-Age=0`), **expira também o cookie de
sessão do Auth.js** (`buildSessionExpireCookie` — `authjs.session-token`/`__Secure-` com
`Max-Age=0`, ADR-011) e retorna `200 { message }`
flat (sem wrapper `data`), com `Cache-Control: no-store`.

---

## Segurança da API

### Rate Limiting

> **Status:** o rate limiting de login, register, magic-link, forgot-password,
> restore-account e verify-email/resend está **implementado** em `src/lib/rate-limit.ts`
> (em memória, por instância). As linhas genéricas `GET/POST /api/v1/*` e
> `POST /api/v1/readings` da tabela abaixo são o **estado-alvo** (planejado).

| Endpoint | Limite | Janela | Usuários Autenticados |
|---|---|---|---|
| `POST /api/v1/auth/login` (lockout de conta) | 5 falhas consecutivas | 15 min | Não se aplica |
| `POST /api/v1/auth/login` (volume por IP) | 5 req | 15 min | Não se aplica |
| `POST /api/v1/auth/magic-link` (por email) | 3 req | 1 hora | Não se aplica |
| `POST /api/v1/auth/magic-link` (por IP) | 3 req | 1 hora | Não se aplica |
| `POST /api/v1/auth/register` | 3 req (email: 15min; IP: 1h) | — | Não se aplica |
| `POST /api/v1/auth/forgot-password` | 3 req | 1 hora | Não se aplica |
| `POST /api/v1/auth/forgot-password` (por IP) | 5 req | 1 hora | Não se aplica |
| `POST /api/v1/auth/verify-email/resend` (por email) | 1 req | 1 min | Não se aplica |
| `POST /api/v1/auth/verify-email/resend` (por IP) | 5 req | 1 hora | Não se aplica |
| `GET /api/v1/*` | 100 req | 1 min | 300 req / 1 min |
| `POST /api/v1/*` | 50 req | 1 min | 150 req / 1 min |
| `POST /api/v1/readings` | 3/dia | dia | 10/dia |

**Implementado (login, register, magic-link, forgot-password, restore-account, verify-email/resend):**
- **Lockout de conta**: 5 falhas consecutivas → 403 `AUTH_ACCOUNT_LOCKED` com `retryAfter: 900` (15 min). Resetado em login bem-sucedido.
- **Limite de volume por IP**: 5 tentativas/15min → 429 `AUTH_RATE_LIMITED` com `retryAfter`.
- **Magic link por email**: 3/hora por email → 429 `AUTH_MAGIC_LINK_RATE_LIMIT` com `retryAfter` (1h window, `src/lib/rate-limit.ts` `isMagicLinkLimited`/`recordMagicLinkRequest`).
- **Magic link por IP**: 3/hora por IP → 429 `AUTH_MAGIC_LINK_RATE_LIMIT` com `retryAfter` (1h window, `src/lib/rate-limit.ts` `isMagicLinkIpLimited`/`recordMagicLinkIpAttempt`; mesmo código do limite por email — não há `AUTH_MAGIC_LINK_IP_RATE_LIMIT`). Ajustado de 20/h para 3/h no review T21 (decisão de produto).
- **Forgot-password por email**: 3/hora por email → 429 `AUTH_FORGOT_RATE_LIMIT` (1h window, `src/lib/rate-limit.ts` `isPasswordResetLimited`/`recordPasswordResetRequest`, env `MAX_PASSWORD_RESET_PER_EMAIL`). A contagem é registrada antes da verificação de existência do usuário (anti-spam).
- **Forgot-password por IP**: 5/hora por IP → 429 `AUTH_FORGOT_RATE_LIMIT` com `retryAfter` (60min window, `src/lib/rate-limit.ts` `isPasswordResetIpLimited`/`recordPasswordResetIpAttempt`, env `MAX_PASSWORD_RESET_IP_ATTEMPTS`). A checagem e o registro do IP ocorrem **antes** da leitura do usuário (anti-enumeração: resposta idêntica p/ e-mail inexistente).
- **Verify-email resend por IP**: 5/hora por IP → 429 `AUTH_RATE_LIMITED` com `retryAfter` (60min window, `src/lib/rate-limit.ts` `isVerifyEmailResendIpLimited`/`recordVerifyEmailResendIpAttempt`, env `MAX_VERIFY_EMAIL_RESEND_IP_ATTEMPTS`), registrado **antes** do `findFirst` do usuário. **A contagem por e-mail também é registrada antes do lookup** (`recordVerifyEmailResend`) — gravá-la só no caminho de sucesso faria o 429 disparar apenas para contas reais/non-verificadas, transformando o próprio rate limit em oráculo de enumeração (padrão: `docs/solutions/patterns/security/rate-limit-before-user-lookup.md`).
- **Confiabilidade do IP por IP**: os limites por IP leem o primeiro hop de `x-forwarded-for` (hops são appendados pelo proxy/edge — Caddy/Vercel); o store é **em memória e por instância** (best-effort; um atacante que rotaciona IPs ou instancia réplicas dilui a contagem — limitação conhecida, XFF spoofing mitigado apenas atrás do proxy confiável).
- **Todos os 429** (login, register, magic-link, forgot-password, restore-account, verify-email/resend) também setam o header **`Retry-After`** (segundos), além do `retryAfter` no body.
- **Audit de reset de senha** (design §7.6): pedidos de recuperação de senha são logados com **IP** (`x-forwarded-for`) e **user agent** em `[auth:forgot-password]` (`src/app/api/v1/auth/forgot-password/route.ts`).
- **`POST /api/v1/auth/reset-password` (T12)** — **não possui rate limit próprio**: a rota não usa `src/lib/rate-limit.ts`; a tentativa é protegida pelo token `PASSWORD_RESET` single-use (1h). O limite 3/h por e-mail **e** 5/h por IP é da **emissão** de tokens (`POST /api/v1/auth/forgot-password`).
- `resetRateLimiter()` limpa o store (usado em testes).

**Rate limits sociais (Sprint 2 Phase 0.5 — T027/T040):** sistema **separado** do `src/lib/rate-limit.ts` de auth (acima), com estado em Redis.

- **Única casa dos limites sociais**: `src/lib/social/limits.ts` — núcleo único `checkSocialLimit(limit, userId, tier)` → `SocialLimitResult { allowed, remaining, resetAt, limit, max }` (`max` calculado uma vez, usado pelos headers); os wrappers `checkPostLimit()`/`checkLikeLimit()`/`checkCommentLimit()`/`checkFollowLimit()`/`checkGiftLimit()`/`checkUploadLimit()` do T027 são thin wrappers sobre o núcleo. Estado em sorted set por janela (`rl:<limit>:<userId>`) + TTL.
- **Semântica attempt-vs-row**: o Redis conta **checks aprovados** (attempt) e o fallback Prisma conta **linhas persistidas** (sucessos) — uma ação que falha após o check aprovado consome cota só no Redis; divergência aceita e documentada no cabeçalho de `limits.ts`.
- **Valores (S2-10)**: posts **10/dia FREE** e **50/dia PLUS** (`POST_LIMIT_BY_TIER`, lido de `User.subscriptionTier`), likes 100/min, comments 30/min, follow 20/min, gifts 10/dia, uploads **20/dia** (`FIXED_LIMITS.upload`, janela diária em **UTC**) e polling **60/min por usuário** (`FIXED_LIMITS.polling`, janela de 60 s — revisão O, 2026-10-02; a chave `rl:polling:<userId>` é **compartilhada** entre as 4 rotas `GET /social/polling/{posts,likes,comments,notifications}`, então o teto é agregado e não por rota). ⚠️ **Divergência aberta**: o plano/clarificação S2-10 lista "**Uploads 4/post**" para `checkUploadLimit` — o cap de 4 imagens por post **passou a existir como restrição de payload no presign** (`postImagesPresignSchema` `.max(4)`, T064/Phase 2) e o `checkUploadLimit` continua sendo cota **diária de 20**; confirmar com o dono se a cota diária de 20 é a intenção ou se o limite é realmente 4/post.
- **Middleware**: `src/lib/middleware/rate-limit.ts` (`enforceSocialLimit()`) devolve 429 **`RATE_LIMITED`** com headers `Retry-After`, `X-RateLimit-Limit` e `X-RateLimit-Remaining`.
- **Modo de falha (Q26) — fail-open**: Redis indisponível → o request **prossegue** com `logger.warn("rate_limiter_bypass")` (evento PostHog `rate_limiter_bypass` via `trackRateLimiterBypass()` em `src/lib/analytics.ts`, ligação prevista em T136); para os **daily** limits há fallback de contagem via Prisma **antes** de liberar. **Nunca respondemos 503 por causa do rate limit.**
  - ⚠️ **Fronteira de captura server-side (review nextjs IMP-2)**: `trackRateLimiterBypass()`/`trackCsrfFailure()` vivem em `src/lib/analytics.ts` (diretiva `"use client"` removida na Phase 2.5; `hasConsent()` devolve `false` em `typeof window === "undefined"`) — chamá-los do servidor é **no-op silencioso**. Hoje os dois eventos disparam **só `logger.warn` no servidor** (os middlewares são Node-side); o consumo PostHog real acontece quando houver implementação server-side (PostHog Node/HTTP com política de consentimento LGPD — previsto em **T136**). Cliente só pode consumir estes eventos se o sinal for exposto num endpoint.
- **Status**: libs + middleware implementados e testados (`tests/social-limits.test.ts`, `tests/middleware-rate-limit.test.ts`) — **consumidores ligados**: `POST /api/v1/social/follow/:userId` (T043, Phase 1), `POST /api/v1/social/posts` → `limit: "post"` (T051, Phase 2), `POST /api/v1/social/posts/images/presign` → `limit: "upload"` (T064, Phase 2) **e — desde a review W4–W8 (2026-10-01) — `POST /api/v1/users/me/avatar/presign` + `PATCH /api/v1/users/me/avatar/confirm` → `limit: "upload"`** (o `DELETE /users/me/avatar` **não** tem rate limit próprio). Todos chamam `enforceSocialLimit(...)` **antes** de qualquer lookup **do usuário-alvo/alvo de negócio** (anti-oráculo, padrão `docs/solutions/patterns/security/rate-limit-before-user-lookup.md`; na ordem real das rotas eles vêm **depois** de `enforceCsrf` e `requireAuth`, que olham só a sessão/identidade do viewer). **Faltam os consumidores T076/T077/T081/T120** (like de post, comentário, like de comentário, gifts) e as demais rotas de **leitura** social (feed/explore/search/posts/:id/og-image) seguem **sem rate limit próprio** — pendência: política/valores de rate limit de leitura dessas rotas ainda não decididos. **As 4 rotas de polling `GET /social/polling/{posts,likes,comments,notifications}` ganharam rate limit na revisão O (2026-10-02)**: `limit: "polling"` (60/min por usuário, valor acima) aplicado em `guardPolling()` (`src/app/api/v1/social/polling/polling-utils.ts`) na ordem **`requireAuth` → `enforceSocialLimit` → `resolveSince`** (401 antecede o check; `since` inválido → 422 depois do check), cobrindo o volume de 30 s/cliente do fallback — políticas de leitura das **outras** rotas permanecem em aberto.

### CSRF (double-submit)

> **Status (Sprint 2 Phase 2 — atualizado 2026-10-01, reviews W4 + W4–W8):** helpers e middleware prontos e **seis rotas consumidoras ligadas**: `POST /api/v1/social/follow/:userId` (T043, Phase 1); `POST /api/v1/social/posts` (T051); `POST /api/v1/social/posts/images/presign` (T064); e — **desde a review W4** — `POST /api/v1/users/me/avatar/presign` + `PATCH /api/v1/users/me/avatar/confirm` (mutam estado e emitem credencial de upload) e — **desde a review W4–W8** — `DELETE /api/v1/users/me/avatar` (`src/app/api/v1/users/me/avatar/route.ts`: `enforceCsrf` antes do `requireAuth`; era o 6º consumidor, antes listado só como 5), todas chamando `enforceCsrf(request, reqId)` no topo do handler (correção da review security I3; com o interceptor `x-csrf-token` de `src/lib/api.ts` o header viaja e o gate vale). Bearer puro (sem cookie) continua não sendo alvo de CSRF, mas as rotas validam mesmo assim (defesa em profundidade). `login`/`register` seguem usando `validateCsrfToken` direto. Próximos consumidores previstos: likes/comentários/gifts (T076/T077/T120). O fluxo do Sprint 1 continua sendo o padrão descrito em `docs/solutions/patterns/auth/set-csrf-cookie-client-side.md` (cookie gravado client-side por `ensureCsrfCookie()`, validação server-side antes de qualquer efeito colateral).

- `src/lib/csrf.ts`: `validateCsrfToken(request)` (cookie `csrf-token`/`__Host-csrf-token` vs header `x-csrf-token`, `timingSafeEqual` sobre buffers UTF-8) e `csrfErrorResponse(reqId)` → 403 **`CSRF_TOKEN_INVALID`** (code canônico AC-20 — o middleware T041 emitia `CSRF_INVALID`; divergência **fechada na review Step 5**: `csrf.ts`, `middleware/csrf.ts`, testes e banners de `docs/04-api/overview.md` alinhados ao code das rotas de auth).
- **Single-writer do cookie (LGPD/segurança)**: o Set-Cookie é feito **APENAS no client** via `ensureCsrfCookie()` (`src/lib/csrf-client.ts`) — não existe builder server-side de Set-Cookie para o CSRF (o `buildCsrfSetCookieHeader` da Phase 0.5 foi **removido na review**: code morto que, se ligado no middleware/rotas, quebraria o single-writer e duplicaria as flags `Secure`/`SameSite` em dois lugares). Cookie **não é `HttpOnly`** de propósito: double-submit exige o client ler o valor para ecoar no header.
- `src/lib/middleware/csrf.ts` (T041): `enforceCsrf(request, reqId)` — para métodos inseguros (gate `needsCsrf()`, re-exportado de `src/lib/csrf-methods.ts`) checa **primeiro `Origin` same-origin**: se o header `Origin` vier e divergir de `new URL(request.url).origin` → 403 antes de olhar o token (defesa em profundidade; `reason: "origin_mismatch"`); depois `validateCsrfToken` (`reason: "token_mismatch"`). Ambos logam `csrf_failure` antes de devolver 403 `CSRF_TOKEN_INVALID`. O interceptor `src/lib/api.ts` envia `x-csrf-token` (via `ensureCsrfCookie()`) em todo método inseguro cujo chamador não enviou o header.

### Guard de sessão (`requireAuth`) — banimento e soft-delete

> **Status (Sprint 2 review — CHK008; Phase 1 2026-09-29):** implementado em `src/app/api/v1/users/_helpers.ts` (`requireAuth`, usado por **todas** as rotas `/api/v1/users/me/*`, `/api/v1/ai/*`, `/api/v1/arcana/calculate`, `/api/v1/readings/*` **e, desde o Phase 1, `POST /api/v1/social/follow/:userId`**). Antes da review, `User.isBanned` nunca era checado em nenhum guard. **Mesmo arquivo (Phase 1)**: `optionalAuth(request)` — auth opcional que devolve `userId` só com Bearer válido e **`null` sem token/token inválido (nunca 401)**; usado pelas listas `GET /api/v1/users/:username/{followers,following}` (`_follow-list.ts`) e por `GET /api/v1/users/:username/profile` para habilitar `isFollowing`. ✅ **Desde a review de Phase 1 (C3)**: `optionalAuth` **também aplica** o gate `isBanned`/`deletedAt` (consulta `prisma.user.findUnique` pós-token: banida/soft-deleted/inexistente → `null`, sem identificação) — contrato em `tests/optional-auth.test.ts` (10 casos).

- Depois do `verifyAccessToken`, o guard consulta `prisma.user.findUnique({ select: { isBanned, deletedAt } })` e aplica:
  - **linha inexistente (`null`)** → **401 `AUTH_TOKEN_INVALID`** (hard delete / id forjado);
  - **`deletedAt` preenchido** (janela LGPD) → **401 `AUTH_TOKEN_INVALID`**;
  - **`isBanned`** → **403 `AUTH_ACCOUNT_SUSPENDED`**;
  - caso contrário → `{ userId }`.
- **Semântica de falha — fail-closed**: se o lookup **lançar** (DB pool agotado/failover) → **503 `SERVICE_UNAVAILABLE`** (nunca 200: abriria o gate num pico de DB; nunca 401: dispararia o refresh loop do client). Branch `undefined` (model sem stub) é impossível em produção — o schema garante `User` — e existe só para mocks de teste. `verifyAccessToken` segue o contrato anterior: `AUTH_CONFIG_*` → 500, demais `AuthTokenError` → 401.
- Testes: `tests/require-auth.test.ts` (5 casos: ativo/banida/soft-deleted/inexistente/lookup quebrado → 503).
- **Escopo parcial (CHK008)**: o gate cobre só rotas `requireAuth` (API). `src/proxy.ts`, `(app)/layout.tsx` e o refresh `rotateRefresh` **não** checam `isBanned`, e **nada no repo ainda escreve `isBanned=true`** (endpoint de moderação/admin = fase posterior).

### CORS (Cross-Origin Resource Sharing)

> **Implementado (Sprint 2 Phase 2.5):** a única configuração CORS **real** do repo é a do socket-service (`socket-service/src/server.ts`): `origin: env.AUTH_URL` (origem canônica), `methods: ["GET","POST"]` no handshake Socket.io. O snippet Express abaixo é **design original** — `ALLOWED_ORIGINS` **não tem consumidor em `.ts` algum** (só `.env.example`); as rotas Next não configuram CORS próprio (same-origin por construção).

```typescript
const corsOptions = {
  origin: process.env.ALLOWED_ORIGINS.split(','),
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'x-csrf-token'],
  credentials: true,
  maxAge: 86400, // 24h preflight cache
};
```

### Helmet Middleware

> **Implementado de verdade (Sprint 2 review S-I8)**: o Express acima é só o design original — no Next.js as diretrizes vivem em **`next.config.ts` (`headers()`)** e espelhadas em **`vercel.json`**:
> `Content-Security-Policy: ...; frame-ancestors 'none'; base-uri 'self'; object-src 'none'; img-src 'self' https: data:` (anti-clickjacking + anti-base-tag-hijack + sem plugins/object) + HSTS, `X-Content-Type-Options: nosniff`, `Referrer-Policy` e `Cache-Control: private, no-store`.
> ⚠️ **CSP parcial (realidade ≠ design)**: só essas 4 diretrizes estão implementadas — `default-src`/`script-src`/`connect-src`/`style-src` do bloco abaixo **ainda não existem no header** (débito de hardening, não há sink XSS aberto hoje). O gate `has` do bloco HTML usa `accept: text/html.*` porque `has.value` vira regex ancorada (`^…$`) em `prepare-destination` — com `text/html` puro o Accept real do browser (`text/html,application/xhtml+xml,…`) não casava e **nenhum header HTML era emitido** (corrigido na review 2026-09-28). Testes de header não existem (mudanças de CSP não quebram suíte).

```typescript
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "https://cdn.arkanaagora.com.br"],
      connectSrc: ["'self'", "https://api.mercadopago.com"],
    },
  },
  hsts: { maxAge: 31536000, includeSubDomains: true },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
}));
```

### Validação de Input (Zod)

Todos os inputs da API são validados com **Zod** antes do processamento:

```typescript
import { z } from 'zod';

const registerSchema = z.object({
  email: z.string().email('E-mail inválido'),
  password: z.string().min(8, 'Mínimo 8 caracteres'),
  displayName: z.string().min(2).max(50),
});
```

### Prevenção de Injeção SQL

O **Prisma ORM** utiliza query parameterization nativamente, eliminando o risco de injeção SQL:

```typescript
// ✅ Seguro — Prisma parameteriza automaticamente
const user = await prisma.user.findUnique({
  where: { email: userEmail },
});

// ❌ Nunca fazer — concatenação de strings
// const user = await prisma.$queryRaw(`SELECT * FROM users WHERE email = '${userEmail}'`);
```

### Prevenção de XSS

- **Servidor**: Sanitização com `DOMPurify` em todos os inputs de usuário antes do armazenamento
- **Cliente**: React/Next.js sanitiza automaticamente por padrão (JSX escaping)
- **Headers CSP**: Restringe fontes de scripts, estilos e imagens

```typescript
import DOMPurify from 'isomorphic-dompurify';

const cleanInput = DOMPurify.sanitize(userInput, {
  ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'br'],
  ALLOWED_ATTR: ['href', 'target', 'rel'],
});
```

- **Guardrail do linkify (review security N6 — atualizado na Phase 2)**: `src/lib/social/mentions.ts` gera HTML com links pré-construídos (menções/hashtags) e **tem consumidor de produção desde a Sprint 2 Phase 2 (T059)**: `src/components/social/post-card.tsx` renderiza `linkifyMentionsHashtags(post.content)` via `dangerouslySetInnerHTML`. O output é seguro **porque** `linkifyMentionsHashtags()` HTML-escapa o texto inteiro antes de inserir as âncoras (`escapeHtml` em `mentions.ts`) — **nunca** passar texto bruto de usuário ao `dangerouslySetInnerHTML` nem remover/encapsular esse escape; se o rendering precisar de mais que âncoras de menção/hashtag, migrar para **peças estruturadas** (React elements), não string HTML.

### Moderação de conteúdo (fail-open + exposição)

> **Status (review security I4/N13 — atualizado na Phase 2):** `src/lib/moderation.ts` implementa `checkContent()` (NFKC + remoção de zero-width, palavras bloqueadas de `MODERATION_BLOCKED_WORDS`, compilação única, Unicode `\b`) — **primeira rota consumidora desde a Sprint 2 Phase 2 (2026-10-01)**: `POST /api/v1/social/posts` (T051) responde **403 `CONTENT_BLOCKED`** com `details.flaggedWords`. Rotas de comentário (T077/T078) seguem sem consumidor.

- **Modo de falha — fail-open com sinal**: `MODERATION_BLOCKED_WORDS` ausente → **não** derruba o boot — `logger.warn` **uma vez** (fail-open deliberado: moderação desligada é melhor que app fora). ⚠️ Ausência em **produção** hoje **não é asserted no boot** (`src/lib/env.ts` é `optionalText`); a assertion `NODE_ENV=production` foi **avaliada e adiada** — decisão de infra do dono (exigir a env derruba deploy onde ela não está provisionada); **gatilho da revisão atingido na Phase 2** (`checkContent` ligado em `POST /social/posts` desde 2026-10-01) — a adiamento continua valendo até nova decisão do dono.
- **`flaggedWords` só volta ao autor, como erro (decisão do dono CHK011, 2026-09-30 — atualiza a regra anterior de "nunca volta")**: `POST /api/v1/social/posts` (T051) responde 403 `CONTENT_BLOCKED` com `details.flaggedWords` **para quem tentou postar** (feedback do autor + `logger.warn` server-side). Nenhuma rota de **leitura** (feed/detalhe/explore/search) expõe a lista, nem para terceiros; comentários (T077/T078) ainda não consomem `checkContent`.

---

## Segurança de Transporte

| Medida | Configuração | Justificativa |
|---|---|---|
| TLS | Versão 1.3 (mínimo 1.2) | Criptografia em trânsito |
| HSTS | `max-age=63072000; includeSubDomains; preload` | Força HTTPS (2 anos) |
| X-Content-Type-Options | `nosniff` | Previne MIME type sniffing |
| Referrer-Policy | `strict-origin-when-cross-origin` | Controla informação de referrer |
| CSP | **Pendente** — requer auditoria de inline scripts/styles (Next.js App Router + shadcn/ui + Framer Motion) antes de enforçar | Prevenção de XSS |
| Certificate | Let's Encrypt (auto-renewal) | Certificado válido e atualizado |

> **Implementação (fix 2026-09-25):** headers de resposta adicionados via `async headers()` em `next.config.ts` — split por `Accept: text/html` (com `Cache-Control: private, no-store`) vs rotas `/api/*`. **F-04 rate-limit via middleware/edge deferido (Low)**. CSP documentado como pendente; auditoria necessária antes de aplicar.

---

## Gestão de Segredos

### Princípios

1. **Nenhum segredo no código-fonte** — use variáveis de ambiente
2. **`.env.example`** — arquivo de template com nomes das variáveis, sem valores
3. **`.gitignore`** — `.env` sempre ignorado no versionamento
4. **Segredos em produção** — usar secret manager do provedor (ex.: consoles Vercel/Neon/Upstash) ou gerenciador de segredos dedicado
5. **Rotação de chaves** — chaves JWT rotacionadas a cada 90 dias

### Variáveis de Ambiente Críticas

```bash
# .env.example — NÃO incluir valores reais
DATABASE_URL=
JWT_PRIVATE_KEY=
JWT_PUBLIC_KEY=
MP_ACCESS_TOKEN=
FCM_SERVER_KEY=
SMTP_HOST=
SMTP_USER=
SMTP_PASS=
REDIS_URL=
# Objeto storage é Cloudflare R2 (S3-compatible), não AWS S3
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=
NEXT_PUBLIC_R2_PUBLIC_URL=https://assets.arkanaagora.com.br
# Vercel Cron secret — protege as rotas GET /api/cron/hard-delete (0 3 * * *), GET /api/cron/feed-cache-refresh (0 0 * * *, SC34) e GET /api/cron/counter-reconcile (0 4 * * *, T147) agendadas em vercel.json
CRON_SECRET=
```

> ⚠️ **Assertions de produção (review security N19/I4 — decisão registrada 2026-09-29)**: `REDIS_URL` e `MODERATION_BLOCKED_WORDS` são **opcionais no schema** (`src/lib/env.ts`); em produção a ausência de `REDIS_URL` degrada para o fallback Prisma daily (Q26) e a de `MODERATION_BLOCKED_WORDS` deixa a moderação off com `logger.warn`. **Não há boot assertion** hoje — adicionar `NODE_ENV=production → throw` foi avaliado e **adiado como decisão do dono** (provisionamento de infra: exigir no boot derruba qualquer ambiente production-like sem as envs). O fail-fast atual cobre apenas **formato inválido** (`getEnv()` no `register()` de `src/instrumentation.ts`).

### Verificação em CI/CD

- Pipeline CI verifica se `.env` foi adicionado ao commit (falha o build)
- Scanner de segredos (`git-secrets` ou `trufflehog`) executado em cada PR
- Alerta automático se segredos forem detectados no histórico do Git

---

## Segurança de Dependências

| Ferramenta | Frequência | Ação |
|---|---|---|
| `bun audit` | A cada commit (CI) | Falha o build se encontrar vulnerabilidades críticas/alta |
| Dependabot | Diário | Abre PRs automáticas com atualizações de segurança |
| Snyk | Semanal | Scan completo de vulnerabilidades com relatório |
| Lockfile | Sempre | `bun.lock` obrigatório (MVP, bun) — sem alterações manuais |

### Política de Atualização

- **Vulnerabilidades críticas**: Corrigida em até 24 horas
- **Vulnerabilidades altas**: Corrigida em até 7 dias
- **Vulnerabilidades médias**: Corrigida no próximo sprint
- **Vulnerabilidades baixas**: Avaliada e corrigida conforme disponibilidade
- **2026-09-27 (Sprint 2 review CRIT-3)**: `npm audit fix` **sem `--force`** resolveu **9 vulnerabilidades transitivas** trazidas pelas deps novas do changeset (`bullmq`, `@vercel/og`); nenhuma major forçada — majors continuam com o fluxo normal de política acima.

---

## Testes de Penetração (Pentest)

| Atividade | Frequência | Responsável |
|---|---|---|
| Pentest anual completo | Anual | Empresa terceirizada certificada |
| Pentest de nova feature | Antes de lançamento V2+ | Equipe de segurança interna |
| Bug bounty program | Contínuo | Comunidade (HackerOne/Bugcrowd) |
| Scan de vulnerabilidades automático | Semanal | Snyk + OWASP ZAP |

### Escopo do Pentest

- Autenticação e autorização
- API REST (todos os endpoints)
- Upload de arquivos
- Pagamentos e checkout
- Gestão de sessões
- Proteção contra OWASP Top 10

---

## Resposta a Incidentes

### Runbook de Incidente

1. **Detecção** — alertas de monitoramento (Sentry, Grafana/Prometheus, logs)
2. **Triagem** — classificar severidade (P1 a P4)
3. **Contenção** — isolar sistemas afetados, bloquear IPs maliciosos
4. **Comunicação** — notificar equipe, stakeholders e (se LGPD) titulares e ANPD
5. **Erradicação** — remover a causa raiz
6. **Recuperação** — restaurar serviços com monitoramento intensivo
7. **Post-mortem** — documento de lições aprendidas em até 5 dias úteis

### Escalonamento

| Severidade | Tempo de resposta | Escala para |
|---|---|---|
| P1 (crítico) | 15 minutos | CTO, DPO, equipe completa |
| P2 (alto) | 1 hora | Tech Lead, equipe de segurança |
| P3 (médio) | 4 horas | Equipe responsável |
| P4 (baixo) | Próximo dia útil | Equipe responsável |

---

## Critérios de Aceite

- **CA-01**: Todas as senhas devem ser armazenadas com bcrypt (12 rounds) — nenhuma senha em texto puro, em logs ou em banco
- **CA-02**: Todos os endpoints da API devem possuir rate limiting configurado e testado
- **CA-03**: O scanner de segredos deve ser executado em 100% dos pull requests antes do merge
- **CA-04**: O certificado TLS deve ser renovado automaticamente e possuir validade mínima de 90 dias
- **CA-05**: O tempo médio de detecção (MTTD) de incidentes críticos deve ser inferior a 15 minutos