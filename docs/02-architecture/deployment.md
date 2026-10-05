# Estratégia de Deploy — arkana-agora

> Versão: 1.3 | Última atualização: 2026-10-03

---

## 1. Ambientes

| Ambiente | Propósito | URL | Banco de Dados |
|----------|-----------|-----|----------------|
| **Development** | Desenvolvimento local | `http://localhost:3000` | **Prisma Postgres** (pooled `DATABASE_URL` + direct `DIRECT_URL`); Docker Postgres 16 offline fallback |
| **Staging** | Testes e QA | `staging.arkanaagora.com.br` | Neon PostgreSQL (staging) |
| **Production** | Produção | `arkanaagora.com.br` | Neon PostgreSQL (prod) |

---

## 2. Desenvolvimento Local

### 2.0 Toolchain (regra canônica)

- **MVP / app único (este documento)**: package manager **`bun`** (instalação, scripts, Dockerfile, CI).
- **Monorepo futuro (ADR-005, proposto)**: quando a migração iniciar, usa-se **`pnpm`** + Turborepo (ver `monorepo.md`).
- Não misturar: aplicações do monorepo futuro devem usar `pnpm`; o app MVP continua `bun` até a migração.

### 2.1 Backend e Frontend (frameworks e onde fica o código)

> A arquitetura documentada é **monolito modular Next.js** — não há separação `backend/`/`frontend/` no SDD. No MVP, frontend e API ficam no mesmo app; serviços auxiliares scaffoldados ficam na **raiz do repo** (hoje `socket-service/`; o layout `services/{ai-service,socket-service,worker}` é o do monorepo futuro — `monorepo.md`). Os diretórios vazios `backend/` e `frontend/` na raiz do repo são placeholders e não fazem parte da estrutura documentada.
>
> **Status (esqueleto + F1 DB/Docker + F2A auth login + F2B design system + Módulo 1 Auth completo):** já existe na raiz do repo um esqueleto Next.js 16 (App Router) — `package.json` (toolchain `bun`), `src/app/` (incl. `src/app/api/health/route.ts`), `src/lib/prisma.ts`, `prisma/schema.prisma` (datasource `postgresql`; 5 models: User, UserProfile, Subscription, Session, VerificationToken), `prisma/migrations/` (init `20260813000605_init` aplicada), `prisma/seed.ts`, `tests/health.test.ts`, `.env.example`, `eslint.config.mjs`, `vitest.config.ts`, `Dockerfile`, `docker-compose.yml`, `.dockerignore`. Dev DB: Docker Postgres 16 (`docker compose up -d postgres`) via `bunx prisma migrate dev`. **Auth de login implementado (Sprint 0, F2A — ADR-010):** Auth.js v5 (`next-auth@5.0.0-beta.32`, adapter Prisma mínimo, JWT strategy) com **magic link** (e-mail) e **Google OAuth** em `src/app/(auth)/login`, `src/app/api/auth/[...nextauth]/route.ts`, `src/auth/`; credenciais e-mail/senha entregues na Sprint 1 (backend `POST /api/v1/auth/login` T7 + frontend `LoginForm` T19 em `src/app/(auth)/login/login-form.tsx` + `RegisterForm` T20 em `src/app/(auth)/register/register-form.tsx`); Facebook OAuth fica para o Sprint 1. **Design system implementado (Sprint 0, F2B):** Tailwind CSS 4 via `postcss.config.mjs` (plugin `@tailwindcss/postcss`), `components.json` (style radix-nova), tokens oklch claro/escuro em `src/app/globals.css`, `src/components/ui/` (Button, Card, Input, Label, Skeleton, Alert + `form.tsx` manual), `src/lib/utils.ts` (`cn`), `next-themes` (`providers.tsx`/`theme-provider.tsx`/`theme-toggle.tsx`), `layout.tsx` com fonte Geist (`--font-geist-sans`) + `suppressHydrationWarning`, guard de auth em `src/app/(app)/layout.tsx`. **Módulo 1 Auth (Sprint 1) completo:** `POST /api/v1/auth/register` (T6), `POST /api/v1/auth/login` (T7), `POST /api/v1/auth/magic-link` (T9), `POST /api/v1/auth/magic-link/verify` (T10), `POST /api/v1/auth/forgot-password` (T11), `POST /api/v1/auth/reset-password` (T12), `POST /api/v1/auth/refresh` (T13), `POST /api/v1/auth/logout` (T14), `POST /api/v1/auth/verify-email` (T30) e `POST /api/v1/auth/verify-email/resend` (T30) implementados com `src/services/token-service.ts`, `src/lib/rate-limit.ts` (+ magic link 3/h por email e 3/h por IP, register 3/15min por email e 3/h por IP, forgot-password 3/h por email e 5/h por IP, verify-email/resend 1/min por email e 5/h por IP), `src/lib/redis.ts`, `src/lib/validators/auth.ts` (`loginSchema`/`magicLinkSchema`/`magicLinkVerifySchema`/`forgotPasswordSchema`). **LGPD deleção de conta implementada:** `DELETE /api/v1/auth/account` (T15, soft delete atômico) + `GET /api/cron/hard-delete` (T16, Vercel Cron 03:00 UTC — anonimização pós-30 dias, `src/jobs/hard-delete-accounts.ts`). Ainda não existe: IA, pagamentos, social → veja `docs/architecture.md`  "Implementation status".

| Projeto/Parte | Framework | Onde fica (documentado) | Porta | Iniciar |
|---|---|---|---|---|
| **Frontend (web)** | Next.js 16 (App Router) + TypeScript | `apps/web` (monorepo futuro) / raiz do app (MVP) | 3000 | `bun run dev` |
| **Backend (API)** | Next.js API Routes + Prisma + Auth.js v5 + Zod | `src/app/api/v1/*` (mesmo app — MVP) | 3000 | `/api/v1/*` |
| **Backend — WebSocket** | Node.js + Socket.io | `socket-service/` (raiz do repo — ADR-007; **não** existe `services/ws-service`) | 3003 | `bun run dev:ws` (`tsx watch socket-service/index.ts`) |
| **Backend — IA** (futuro) | Node.js | `services/ai-service` | 3004 | — |
| **Backend — Worker** (futuro) | Node.js + BullMQ | `services/worker` | 3005 | — |
| **Packages** (monorepo futuro) | pnpm workspace | `packages/{ui,types,config,utils,api-client}` | — | via Turborepo |

Backend no MVP = API Routes do próprio Next.js (monólito modular, ADR-001). Bibliotecas backend documentadas: Prisma (ORM), Auth.js v5 (auth — ADR-010), Zod (validação), Mercado Pago SDK (payments), `openai` SDK (IA). Frontend documentado: shadcn/ui (preset radix-nova — "New York" na nomenclatura antiga da CLI) + Tailwind CSS 4 + Zustand + TanStack Query + Framer Motion. Detalhes em `docs/02-architecture/architecture.md` e `docs/02-architecture/monorepo.md`.

### 2.2 Stack Local

```
┌───────────────────────────────────────────────────┐
│              Caddy (port 80/443)                  │
│         SSL automático, proxy reverso              │
└────┬──────────────┬──────────────┬────────────────┘
     │              │              │
     ▼              ▼              ▼
┌──────────┐ ┌──────────┐ ┌──────────────┐
│ Next.js  │ │Socket.io │ │ BullMQ       │
│ :3000    │ │ :3003    │ │ :3005 (fut.) │
└────┬─────┘ └────┬─────┘ └──────┬───────┘
     │            │              │
     ▼            ▼              ▼
┌────────────┐ ┌──────────┐ ┌──────────┐
│ PostgreSQL │ │ Redis    │ │ File     │
│ (Docker)   │ │ :6379    │ │ Storage  │
└────────────┘ └──────────┘ └──────────┘
```

> **Nota F1:** o `docker-compose.yml` atual sobe **postgres + redis + migrate + web** — **não há serviço `ws` no compose**: o `socket-service/` scaffoldado na Phase 2.5 tem `Dockerfile`/`ecosystem.config.js` próprios e roda fora do compose via `bun run dev:ws`. **Caddy continua fora do compose** (adiado). O diagrama acima é o stack local completo documentado.

### 2.3 Comandos de Desenvolvimento

```bash
# Instalar dependências
bun install

# Subir fallback offline (Docker Postgres 16 + Redis) — opcional se usando Prisma Postgres
docker compose up -d postgres redis

# Rodar migrações (Prisma Postgres — CLI usa DIRECT_URL de prisma.config.ts; pin prisma@^7)
.\node_modules\.bin\prisma migrate dev

# Gerar tipos Prisma
.\node_modules\.bin\prisma generate

# Popular dados iniciais (baralhos, spreads)
bun run seed

# Iniciar aplicação web
bun run dev          # Next.js na porta 3000

# Iniciar Socket.io service
bun run dev:ws       # Socket.io na porta 3003

# Iniciar tudo (com Caddy)
bun run dev:all
```

> **Nota:** os scripts acima já existem no `package.json` do esqueleto na raiz (MVP). **`dev:ws` não é mais stub** desde a Phase 2.5: roda `tsx watch socket-service/index.ts` (Socket.io na porta 3003, `GET /health`) e exige `AUTH_URL` e `JWT_PUBLIC_KEY` no ambiente (`REDIS_URL` é **opcional** no schema desde a correção de review K — validação Zod em `socket-service/src/lib/env.ts`; sem `REDIS_URL` o Event Bus cai no bus em memória e o E2E de realtime quebra — ver `playwright.config.ts`). `dev:all` **continua stub** (eco de aviso) até o Caddy entrar. O banco de dev é o container `postgres` do compose (db/user/pass `arkana`, porta 5432); `docker compose up -d postgres redis` sobe banco + Redis.

> **Logger note:** `src/lib/logger.ts` (Pino) is implemented (Sprint 0, F4) — the health route logs via `logger.error({ err }, "[health] ...")`. Remaining known stopgap: `console.log("[auth:magic-link] ...")` in `src/auth/auth.config.ts` (EmailProvider `sendVerificationRequest`; anchor the symbol, not a line number — it drifts; see `docs/solutions/patterns/observability/logger-migration-stopgap.md`; pattern details in `docs/solutions/patterns/backend/health-check-envelope.md`).

### 2.4 Variáveis de Ambiente (`.env`)

> Copie `.env.example` → **`.env`** na raiz do repo. O Prisma CLI e os scripts `bun` carregam `.env` (não `.env.local`); o Next.js e o Bun também carregam `.env.local` com maior precedência. Nunca commite `.env`/`.env*.local`.

```env
# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
# URL do socket-service consumida por src/hooks/use-socket.ts (socket.io aceita ws://, http:// etc.;
# sem ela o default é http://localhost:3003)
NEXT_PUBLIC_WS_URL=ws://localhost:3003
# Porta do mini-service Socket.io (Sprint 2 — src/lib/env.ts E socket-service/src/lib/env.ts, default 3003)
SOCKET_PORT=3003
# socket-service (Phase 2.5, T066) — valida com Zod em socket-service/src/lib/env.ts:
#   REDIS_URL (opcional — sem ela o Event Bus vira bus em memória: ok em teste unitário, NÃO em E2E
#   multi-processo nem em produção multi-instância), AUTH_URL (obrigatória — origem do CORS),
#   JWT_PUBLIC_KEY (obrigatória, RS256/ADR-009) + SOCKET_PORT acima.
#   ACCESS_TOKEN_TTL_SECONDS (revisão R2, default 900): PRECISA casar com a do
#   token-service do Next (src/services/token-service.ts) — o handshake usa o valor
#   no maxTokenAge; divergir rejeita tokens ainda válidos ou aceita além do TTL.

# Banco (dev) — Prisma Postgres via Vercel Marketplace (pooled p/ runtime, direct p/ CLI)
DATABASE_URL=postgres://user:pass@pooled.db.prisma.io:5432/postgres?sslmode=require
DIRECT_URL=postgres://user:pass@db.prisma.io:5432/postgres?sslmode=require
# Fallback offline: Docker Postgres 16 (db/user/pass: arkana) — deixe DIRECT_URL vazio
# DATABASE_URL=postgresql://arkana:arkana@localhost:5432/arkana

# Auth (Auth.js v5 — ADR-010; não usar NEXTAUTH_*/GOOGLE_CLIENT_*)
# AUTH_URL: origem canônica da aplicação (impede host-header poisoning do magic link em prod — HTTPS obrigatório)
AUTH_URL=https://arkanaagora.com.br
AUTH_SECRET=dev-secret-change-me
AUTH_TRUST_HOST=true
AUTH_GOOGLE_ID=dev-google-id
AUTH_GOOGLE_SECRET=dev-google-secret
AUTH_EMAIL_SKIP_SEND=true
EMAIL_FROM=Arkana Agora <nao-responda@arkanaagora.dev>
# JWT custom RS256 (Sprint 1 — ADR-009): par RSA 2048, AMBAS as chaves obrigatórias
# (blocos PEM multiline — ver .env.example e docs/runbooks/jwt-public-key-missing-all-401.md).
# A pública é consumida também pelo socket-service (handshake RS256, ADR-009).
JWT_PRIVATE_KEY=
JWT_PUBLIC_KEY=
# SMTP (opcional em dev — sem SMTP + AUTH_EMAIL_SKIP_SEND=true loga o link no console)
SMTP_URL=
SMTP_HOST=
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=
SMTP_PASS=
# Resend (e-mails transacionais — src/lib/email/email.ts); em dev use AUTH_EMAIL_SKIP_SEND=true para logar no console
RESEND_API_KEY=
# Vercel Cron (T16 — GET /api/cron/hard-delete 0 3 * * *, GET /api/cron/feed-cache-refresh 0 0 * * * e GET /api/cron/counter-reconcile 0 4 * * *, todos em vercel.json):
# obrigatório em prod; sem ele os crons retornam 401
CRON_SECRET=

# IA (openai SDK — src/lib/ai/client.ts + src/lib/ai/models.ts; ver .env.example)
AI_API_KEY=dev-ai-key
AI_MODEL=gpt-4o
AI_MODEL_FOLLOWUP=gpt-4o-mini

# Sprint 2 (src/lib/env.ts) — AI_HOROSCOPE_* segue sem consumidor (fases 5/6 do plano);
# MODERATION_BLOCKED_WORDS já tem consumidor (Phase 0.5): src/lib/moderation.ts
# Horóscopos (T097/T098 — geração via IA)
AI_HOROSCOPE_API_KEY=
AI_HOROSCOPE_MODEL=gpt-4o-mini
# Moderação de posts/comentários (T025 — consumidor: src/lib/moderation.ts checkContent(); 1º consumidor de rota desde a Phase 2/T051 — POST /social/posts → 403 CONTENT_BLOCKED; escopo restante T129; palavras separadas por vírgula)
MODERATION_BLOCKED_WORDS=
# Sharp (libvips global ignorada — usado em upload de imagens)
SHARP_IGNORE_GLOBAL_LIBVIPS=

# Mercado Pago (sandbox)
MP_ACCESS_TOKEN=TEST-xxxxx
MP_WEBHOOK_URL=http://localhost:3000/api/v1/webhooks/mercadopago

# Redis
REDIS_URL=redis://localhost:6379

# Observabilidade
# Sentry: sem DSN o SDK permanece desabilitado (build e runtime não exigem credenciais)
SENTRY_DSN=
NEXT_PUBLIC_SENTRY_DSN=
# Nível de log do Pino (default: info)
LOG_LEVEL=info
POSTHOG_KEY=
# PostHog (lido por src/lib/analytics.ts — fora de development; em dev initAnalytics() é no-op)
NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN=
NEXT_PUBLIC_POSTHOG_HOST=

# Cloudflare R2 (S3-compatible) — nomes iguais a .env.example / src/lib/env.ts
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=
NEXT_PUBLIC_R2_PUBLIC_URL=https://assets.arkanaagora.com.br
```

---

## 3. Staging

### 3.1 Infraestrutura

| Serviço | Provedor | Detalhes |
|---------|----------|----------|
| Web App | **Vercel** (Preview) | Deploy automático em PRs para `main` |
| WebSocket | **Railway** | Instância pequena ($5/mês) |
| PostgreSQL | **Neon** | Branch de banco para staging |
| Redis | **Upstash** | Plano gratuito |
| CDN | Cloudflare | Cache de assets estáticos |
| Pagamentos | **Mercado Pago Sandbox** | Testes sem transações reais |

### 3.2 Deploy de Preview

Toda PR para `main` gera um deploy de preview na Vercel:

```
PR #42 → https://arkana-agora-git-pr-42-team.vercel.app
```

O pipeline de CI executa antes do deploy:

```
Lint → Type Check → Unit Tests → Build → Preview Deploy
```

---

## 4. Produção

### 4.1 Arquitetura de Deploy

```
                    ┌─────────────────────────────┐
                    │     Cloudflare CDN           │
                    │  arkanaagora.com.br          │
                    │  Cache estático, DDoS, WAF   │
                    └──────────┬──────────────────┘
                               │
              ┌────────────────┼────────────────┐
              │                │                │
              ▼                ▼                ▼
     ┌─────────────┐  ┌──────────────┐  ┌──────────────┐
     │   Vercel     │  │   Railway     │  │   Railway     │
     │   (Web)      │  │   (WS)       │  │   (Worker)   │
     │   Next.js    │  │   Socket.io  │  │   BullMQ     │
     │   Serverless │  │   :3003      │  │   (futuro)   │
     └──────┬──────┘  └──────┬───────┘  └──────┬───────┘
            │                │                 │
            ▼                ▼                 ▼
     ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
     │   Neon       │ │   Upstash    │ │  Cloudflare  │
     │  PostgreSQL  │ │    Redis     │ │      R2      │
     │  (Serverless)│ │  (Sessions,  │ │  (Imagens de │
     │              │ │   Cache)     │ │   cartas)    │
     └──────────────┘ └──────────────┘ └──────────────┘
```

### 4.2 Environment Variables

**Configuração no Vercel (Production)**:

1. Acesse o painel da Vercel: `https://vercel.com/dedsdeads-projects/arkana-agora/settings/environment-variables`
2. Adicione as seguintes variáveis de ambiente (globais ou específicas por environment):

| Nome | Valor | Environment | Descrição |
|------|-------|-------------|-----------|
| `AUTH_SECRET` | *Sua secret de produção* | Production | Segredo para assinar tokens do Auth.js |
| `AUTH_TRUST_HOST` | `true` | Production | Confia no header Host fornecido |
| `AUTH_GOOGLE_ID` | *ID do cliente Google OAuth* | Production | Client ID do Google Cloud Console |
| `AUTH_GOOGLE_SECRET` | *Secret do cliente Google OAuth* | Production | Client Secret do Google Cloud Console |
| `EMAIL_FROM` | `Arkana Agora <nao-responda@arkanaagora.dev>` | Production | Remetente dos e-mails (magic link, etc) |
| `SMTP_HOST` | *Sua configuração SMTP* | Production | Host do servidor SMTP (opcional) |
| `SMTP_PORT` | `587` | Production | Porta do servidor SMTP |
| `SMTP_SECURE` | `true` | Production | TLS habilitado |
| `SMTP_USER` | *Usuário SMTP* | Production | Usuário do SMTP |
| `SMTP_PASS` | *Senha do SMTP* | Production | Senha do SMTP |
**Prisma CLI**: pinado em **`prisma@^7`** (`package.json`); `prisma@8` RC remove `generate`/`migrate` e quebra `npm run build`. URL do datasource vive em `prisma.config.ts` (não em `schema.prisma`). CLI local: `.\node_modules\.bin\prisma` (evitar `npx prisma@latest`). `prisma postgres link` sobrescreve `DATABASE_URL` com o host **direct** — após re-link, restaurar o host **pooled** em `DATABASE_URL` e manter `DIRECT_URL` no host direct (`docs/solutions/ci-cd/prisma-v8-cli-regression.md`).

| `DATABASE_URL` | *Prisma Postgres (dev) / Neon (staging/prod)* | Todas | Dev: pooled `pooled.db.prisma.io`; prod: Neon `postgresql://user:pass@ep-xxx…/dbname` |
| `REDIS_URL` | *URL do Redis Upstash* | Production | Ex: `redis://default:pass@xxx.upstash.io:6379` |
| `R2_ACCOUNT_ID` | *ID da conta Cloudflare R2* | Production | Conta ID da R2 |
| `R2_ACCESS_KEY_ID` | *Access Key ID da R2* | Production | Chave de acesso da R2 |
| `R2_SECRET_ACCESS_KEY` | *Access Key Secret da R2* | Production | Segredo da chave de acesso da R2 |
| `R2_BUCKET_NAME` | *Nome do bucket da R2* | Production | Nome do bucket na R2 — lido por `src/lib/r2.ts`/`src/lib/env.ts` (não existe `R2_BUCKET`) |
| `NEXT_PUBLIC_R2_PUBLIC_URL` | `https://assets.arkanaagora.com.br` | Production | URL pública dos assets R2 — **mesma var para server e client** (fusão 2026-10-01; antes eram `R2_PUBLIC_URL` + `NEXT_PUBLIC_R2_PUBLIC_URL`): validada em `src/lib/env.ts`; single source **`src/lib/r2-public-url.ts`** (`getR2PublicUrl()`/`r2KeyFromPublicUrl()` — review 2026-10-01, W4–W8; `src/lib/r2.ts` só reexporta), consumida server-side por avatar confirm/delete e client-side por `post-card.tsx`, que transforma chaves R2 (`posts/{userId}/…`) em URLs exibíveis; vazio/ausente → fallback `https://r2.arkanaagora.com` |
| `AI_API_KEY` | *Chave OpenAI/IA* | Production | Chave da API principal de IA |
| `AI_MODEL` | *Modelo OpenAI* | Production | Modelo de interpretacao (default: gpt-4o) |
| `AI_MODEL_FOLLOWUP` | *Modelo OpenAI follow-up* | Production | Modelo de follow-up (default: gpt-4o-mini) |
| `SOCKET_PORT` | `3003` | Production | Porta do mini-service Socket.io (`socket-service/` — scaffolded na Phase 2.5/T066; default 3003 validado em `socket-service/src/lib/env.ts` e `src/lib/env.ts`) |
| `ACCESS_TOKEN_TTL_SECONDS` | `900` | Production | TTL do access token em segundos (token-service `src/services/token-service.ts`, default 900 = 15 min; **revisão R2**: também validado no boot do socket-service em `socket-service/src/lib/env.ts` e usado no `maxTokenAge` do handshake — **o valor tem de ser o MESMO nos dois processos**, senão o handshake rejeita tokens ainda válidos ou aceita além do TTL do emissor; `REFRESH_TOKEN_TTL_DAYS` default 30, só do token-service) |
| `NEXT_PUBLIC_WS_URL` | `wss://ws.arkanaagora.com.br` | Production | URL do socket-service lida por `src/hooks/use-socket.ts` (domínio `ws.*` da §4.3; socket.io aceita `ws(s)://`/`http(s)://`; **sem a var em produção o realtime fica desabilitado** — `resolveSocketUrl` devolve `null`, `connect()` não abre socket e o fallback de polling cobre posts/notificações, **nunca localhost**, que mandaria o access token no handshake para um processo local; em dev cai no fallback `http://localhost:3003`). Também é a origem esperada do CORS do socket-service. **Inlined em build time** — precisa estar definida ANTES de `next build` (revisão I-e: `next.config.ts` emite WARN no build de produção sem a var; o CI builda sem ela de propósito e não falha) |
| `AI_HOROSCOPE_API_KEY` | *Chave dedicada* | Production | Opcional — chave separada p/ geração de horóscopos (Sprint 2; **sem consumidor até as fases 5/6** do plano) |
| `AI_HOROSCOPE_MODEL` | `gpt-4o-mini` | Production | Modelo da geração de horóscopos (idem — pendente de T097/T098) |
| `MODERATION_BLOCKED_WORDS` | *palavra1,palavra2* | Production | Palavras bloqueadas da moderação de posts/comentários (Sprint 2 T025 — declarada em `src/lib/env.ts`, consumida por `src/lib/moderation.ts` `checkContent()` desde o Phase 0.5; **primeiro consumidor de rota desde o Sprint 2 Phase 2 (2026-10-01)**: `POST /api/v1/social/posts` (T051) responde **403 `CONTENT_BLOCKED`** com `details.flaggedWords`; escopo restante de T129 pendente) |
| `SHARP_IGNORE_GLOBAL_LIBVIPS` | `true` \| `false` | Production | Flag do Sharp para upload de imagens (Sprint 2 — `src/lib/env.ts`) |
| `MP_ACCESS_TOKEN` | *Token Mercado Pago* | Production | Token de acesso do Mercado Pago |
| `MP_WEBHOOK_URL` | *URL do webhook Mercado Pago* | Production | URL de callback do webhook |
| `SENTRY_DSN` | *DSN do Sentry* | Production | DSN do Sentry (opcional, SDK desabilitado sem DSN) |
| `LOG_LEVEL` | `info` | Production | Nível de log do Pino |
| `POSTHOG_KEY` | *Chave do PostHog* | Production | Legado em `.env.example` — **não lido pelo código**; o client usa `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN` + `NEXT_PUBLIC_POSTHOG_HOST` (`src/lib/analytics.ts`; obrigatório só fora de development, pois `initAnalytics()` no-op em dev) |
| `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN` | *Token do projeto PostHog* | Production | Client analytics PostHog (`src/lib/analytics.ts`); sem ele, `console.warn("[Analytics] PostHog key not configured")` e não init (fora de development) |
| `NEXT_PUBLIC_POSTHOG_HOST` | `https://app.posthog.com` | Production | Host do PostHog (`src/lib/analytics.ts`; default `https://app.posthog.com`; override com `us.i.posthog.com`/`eu.i.posthog.com` conforme a região do projeto) |
| `AUTH_URL` | `https://arkanaagora.com.br` | Production + Preview | Origem canônica da aplicação (HTTPS obrigatório); guard de runtime em `src/auth/auth.config.ts` (`AUTH_URL_in_env`/`AUTH_URL_empty` no erro — redeploy após editar env) |
| `CRON_SECRET` | *Secret do Vercel Cron* | Production | Protege **todas** as rotas `GET /api/cron/*` agendadas em `vercel.json`: `hard-delete` (T16 — LGPD hard-delete, `0 3 * * *`), `feed-cache-refresh` (Sprint 2, `0 0 * * *` diário — SC34) e `counter-reconcile` (Sprint 2 T147 — reconciliação de contadores, `0 4 * * *`); obrigatório, sem ele os crons retornam 401 |

**Build time (revisão I-e)**: variáveis `NEXT_PUBLIC_*` são resolvidas no **build**, não no runtime — definir `NEXT_PUBLIC_WS_URL` no ambiente do servidor *depois* do `next build` não tem efeito no bundle. Sem ela, em **produção** `resolveSocketUrl()` devolve `null` e `connect()` não abre socket: o realtime fica desabilitado (fallback de polling cobre posts/notificações; **nunca localhost** — C1 da revisão multi-agente 2026-10-04) e em **dev** cai no fallback `http://localhost:3003`; `resolveSocketUrl()` lança apenas para URL malformada/protocolo inválido. `next.config.ts` emite um **WARN** (não erro) quando `NODE_ENV=production` e a variável está ausente no momento do build.

**Configuração no Railway (socket-service — Phase 2.5)**: o mini-service é um processo Node separado (não roda na Vercel). Deploy via `socket-service/Dockerfile` (PM2 cluster `socket-service/ecosystem.config.js`) com `AUTH_URL` (origem do CORS) e `JWT_PUBLIC_KEY` (handshake RS256, ADR-009) obrigatórias, `SOCKET_PORT` e `REDIS_URL` — opcional no schema (sem ela o bus é em memória), mas **exigida em produção** (Event Bus `realtime:events` + Redis adapter entre instâncias do cluster); `ACCESS_TOKEN_TTL_SECONDS` opcional (default 900) mas, se definida na Vercel/Next, **tem de ser idêntica aqui** (revisão R2 — `maxTokenAge` do handshake); healthcheck no `GET /health`. Ainda **não scaffoldado em produção** (deploy Railway planejado).

**Resiliência do Event Bus (raiz do E2E T075, `socket-service/src/bus.ts`)**: conexões Redis podem cair com `ECONNRESET` após o boot (observado com Memurai local ~30 s depois de criar) e o `retryStrategy: () => null` (fail-fast, revisão K) deixaria o bus **permanentemente morto** — `publish FALHOU: Connection is closed` e evento perdido. Comportamento atual, sem ação operacional do operador:
1. `ensureRedis()` detecta cliente morto (`status === "end" || "close"`) em **pub ou sub** → `discardDeadClients()` → **nova tentativa no próximo publish/subscribe** (promise rejeitada não é cacheada);
2. o **sub reconecta sozinho** via handler em `close`/`end` → `scheduleBusReconnect()` com backoff **1 s → 30 s** e **máx 5 falhas consecutivas**, cancelado pela flag `busShuttingDown` em `resetRealtimeBus()` — necessário porque o socket-service nunca publica e o sub ficaria mudo para sempre;
3. o fail-fast do **publish** é preservado: uma tentativa por chamada, `commandTimeout` 2 s, sem fila offline — o emit nunca pendura a rota de negócio.
Testes: `tests/integration/realtime-bus.test.ts` (grupo `auto-recuperação de conexão morta (ECONNRESET)`).

**Configuração no Vercel (Staging)**:

Acesse `https://vercel.com/dedsdeads-projects/arkana-agora/settings/environment-variables`:
1. Crie uma variável `AUTH_URL` com valor `https://arkana-agora.vercel.app` (ou `https://staging.arkanaagora.com.br` se configurado)
2. Configure as outras variáveis de ambiente conforme a tabela acima

**Nota**: As variáveis `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `DATABASE_URL`, `REDIS_URL`, `SENTRY_DSN` e `CRON_SECRET` (Vercel Cron — `hard-delete` + `feed-cache-refresh` + `counter-reconcile`) são obrigatórias em produção. Em staging, apenas `AUTH_URL` e `AUTH_SECRET` são obrigatórios para evitar o erro de `AUTH_URL missing`.

### 4.3 Serviços de Produção

| Serviço | Provedor | Plano Estimado | Custo/mês |
|---------|----------|----------------|-----------|
| Web (Next.js) | **Vercel** (Pro) | Serverless, auto-scale | $20 |
| WebSocket | **Railway** | 1 instância (512MB RAM) | $5 |
| PostgreSQL | **Neon** | Pro (0.25 vCPU, 1GB RAM) | $19 |
| Redis | **Upstash** | Pay-as-you-go | ~$5 |
| CDN + DNS | **Cloudflare** | Pro (se necessário) | $0-20 |
| Armazenamento | **Cloudflare R2** | Pay-as-you-go | ~$3 |
| IA (GPT-4o) | **OpenAI** (via openai SDK) | Pay-per-token | Variável |
| Erros | **Sentry** | Team plan | $26 |
| Analytics | **PostHog** | Pay-as-you-go | ~$10 |
| **Total estimado** | | | **~$108/mês** |

### 4.3 Domínios e DNS

```
arkanaagora.com.br          → Vercel (web app)
api.arkanaagora.com.br     → Vercel (API routes) — alias para o mesmo deploy
ws.arkanaagora.com.br      → Railway (Socket.io service)
assets.arkanaagora.com.br  → Cloudflare R2 (imagens)
```

**Configuração Cloudflare**:
- DNS: Registros A/CNAME apontando para provedores
- SSL: Full (Strict) — certificados gerenciados pela Cloudflare
- Cache: TTL 1h para HTML, 30d para assets estáticos
- WAF: Regras para proteção contra bots e abuso
- Page Rules: Bypass cache para `/api/*` e `/_next/data/*`

---

## 5. Docker

### 5.1 Dockerfile (Web App)

```dockerfile
# ====================
# Estágio 1: Dependências
# ====================
FROM oven/bun:1 AS deps
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# ====================
# Estágio 2: Build
# ====================
FROM oven/bun:1 AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN bunx prisma generate
RUN bun run build

# ====================
# Estágio 3: Produção (standalone)
# ====================
FROM oven/bun:1 AS runner
WORKDIR /app

ENV NODE_ENV=production

# oven/bun:1 é Debian-based → usar groupadd/useradd (não addgroup/adduser do Alpine)
RUN groupadd --system --gid 1001 nodejs
RUN useradd --system --uid 1001 --gid nodejs --no-create-home nextjs

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["bun", "server.js"]
```

> **Pré-requisito standalone (fora da Vercel):** `next.config.ts` ativa `output: "standalone"` somente quando `VERCEL` **não** está no ambiente (`if (!process.env.VERCEL) nextConfig.output = "standalone"`). Motivo: no Next 16.3, com o adapter da Vercel ativo o build não emite `.next/next-server.js.nft.json`, mas o finalizador do modo standalone lê esse arquivo sem guard e falha com `ENOENT` em `onBuildComplete` (regressão upstream vercel/next.js#96646; workaround oficial da issue). Na Vercel o standalone sequer é usado (o adapter empacota a saída). Docker/CI (sem `VERCEL`) mantêm `.next/standalone` para o runner copiar. `serverExternalPackages: ["@prisma/client"]` mantém o Prisma Client como dependência externa (incluída pelo trace standalone), por isso o runner não copia `node_modules` inteiro. Reavaliar a condição quando o fix upstream (PR #97287) chegar em versão estável do `next`.

### 5.2 Docker Compose (Stack Completa — estado real, F1)

> **Alinhado ao `docker-compose.yml` commitado (2026-08-12):** serviços `postgres` (db/user/pass `arkana`, porta 5432, healthcheck), `redis`, `migrate` (one-shot `bunx prisma migrate deploy`, build target `builder`) e `web` (porta 3000, `DATABASE_URL` + `REDIS_URL`). **Não há** chave `version:` (obsoleta no Compose v2) nem serviços `ws`/`caddy` — adiados para o Sprint 1 de chat.

```yaml
services:
  postgres:
    image: postgres:16-alpine
    container_name: arkana-postgres
    environment:
      POSTGRES_USER: arkana
      POSTGRES_PASSWORD: arkana
      POSTGRES_DB: arkana
    ports:
      - "5432:5432"
    volumes:
      - pg_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U arkana -d arkana"]
      interval: 5s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    container_name: arkana-redis
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

  migrate:
    build:
      context: .
      dockerfile: Dockerfile
      target: builder
    command: ["bunx", "prisma", "migrate", "deploy"]
    environment:
      DATABASE_URL: postgresql://arkana:arkana@postgres:5432/arkana
    depends_on:
      postgres:
        condition: service_healthy
    restart: "no"

  web:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "3000:3000"
    environment:
      DATABASE_URL: postgresql://arkana:arkana@postgres:5432/arkana
      REDIS_URL: redis://redis:6379
    depends_on:
      postgres:
        condition: service_healthy
      migrate:
        condition: service_completed_successfully
      redis:
        condition: service_started

volumes:
  pg_data:
  redis_data:
```

---

## 6. CI/CD — GitHub Actions

### 6.1 Pipeline Principal

```yaml
# .github/workflows/ci.yml
name: CI/CD

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  quality:
    name: Qualidade
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v1
      - run: bun install --frozen-lockfile
      - run: bunx prisma generate
      - run: bun run lint
      - run: bun run type-check

  test:
    name: Testes
    runs-on: ubuntu-latest
    needs: quality
    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
          POSTGRES_DB: akasha_test
        ports: ["5432:5432"]
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v1
      - run: bun install --frozen-lockfile
      - run: bunx prisma migrate deploy
        env:
          DATABASE_URL: postgresql://test:test@localhost:5432/akasha_test
      - run: bun run test:coverage
        env:
          DATABASE_URL: postgresql://test:test@localhost:5432/akasha_test
      - uses: codecov/codecov-action@v3
        with:
          files: ./coverage/lcov.info

  build:
    name: Build
    runs-on: ubuntu-latest
    needs: test
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v1
      - run: bun install --frozen-lockfile
      - run: bunx prisma generate
      - run: bun run build
      - uses: actions/upload-artifact@v4
        with:
          name: nextjs-build
          path: .next/
          if-no-files-found: error
          include-hidden-files: true # obrigatório: .next/ é dot-dir e v4.4+ exclui ocultos por padrão

  # Gate: presença dos secrets VERCEL_* checada em step — os contextos
  # `secrets`/`env` NÃO estão disponíveis em `if:` de job-level.
  # Sem creds → has_creds=false → deploy skipado, workflow permanece verde.
  gate-deploy:
    name: Gate (secrets Vercel)
    runs-on: ubuntu-latest
    outputs:
      has_creds: ${{ steps.check.outputs.has_creds }}
    steps:
      - id: check
        env:
          VERCEL_TOKEN: ${{ secrets.VERCEL_TOKEN }}
          VERCEL_ORG_ID: ${{ secrets.VERCEL_ORG_ID }}
          VERCEL_PROJECT_ID: ${{ secrets.VERCEL_PROJECT_ID }}
        run: |
          if [ -n "$VERCEL_TOKEN" ] && [ -n "$VERCEL_ORG_ID" ] && [ -n "$VERCEL_PROJECT_ID" ]; then
            echo "has_creds=true" >> "$GITHUB_OUTPUT"
          else
            echo "has_creds=false" >> "$GITHUB_OUTPUT"
          fi

  # Staging/preview a cada push na `main` (M0); prod via promoção manual no painel da Vercel.
  deploy-staging:
    name: Deploy Staging (Vercel preview)
    runs-on: ubuntu-latest
    needs: [build, gate-deploy]
    if: >-
      needs.gate-deploy.outputs.has_creds == 'true' &&
      github.event_name == 'push' &&
      github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v4
      - uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
```

### 6.2 Fluxo de Deploy

```
PR para main
  │
  ├─ CI: Quality (lint+format) → Type Check → Test (Postgres service) → Build
  │     └─ Deploy staging: SKIPADO (evento pull_request)
  │
Push na main
  │
  ├─ CI completo (mesma cadeia acima)
  │
  └─ ✅ Sucesso + secrets VERCEL_* presentes (gate)
       ├─ Deploy Staging/preview automático (Vercel)
       │    └── URL: projeto-*.vercel.app / domínio de staging
       └─ Produção: promoção manual no painel da Vercel
            └── URL: arkanaagora.com.br (M0)
```

---

## 7. Estratégia de Rollback

### 7.1 Web App (Vercel)

A Vercel mantém histórico de deploys. Rollback é instantâneo:

```bash
# Via CLI
vercel rollback [deployment-url]

# Via Dashboard Vercel
# 1. Acessar dashboard.vercel.com
# 2. Selecionar deploy anterior
# 3. Clicar "Promote to Production"
```

**Tempo estimado de rollback**: < 30 segundos

### 7.2 Banco de Dados (Migrações)

```bash
# Rollback de migration
bunx prisma migrate resolve --rolled-back [migration_name]

# Ou, em emergência, aplicar migration reversa manual
bunx prisma migrate deploy --schema=prisma/schema.prisma
```

**Checklist de rollback de migration**:
1. Notificar equipe no Slack
2. Verificar backup mais recente do Neon (point-in-time recovery)
3. Aplicar rollback da migration
4. Verificar integridade dos dados
5. Monitorar logs por erros pós-rollback

### 7.3 Socket.io Service (Railway)

```bash
# Railway permite rollback via CLI
railway up --rollback
# ou via dashboard: selecionar deploy anterior
```

---

## 8. Checklist de Deploy de Produção

- [ ] Todos os testes passando no CI
- [ ] Build sem warnings ou errors
- [ ] Migration do banco testada em staging
- [ ] Backup do banco realizado
- [ ] Variáveis de ambiente verificadas na Vercel/Railway
- [ ] DNS e SSL verificados no Cloudflare
- [ ] Health checks passando (`/api/health`)
- [ ] Sentry release criado
- [ ] PostHog feature flags atualizadas
- [ ] Rate limiting configurado
- [ ] Monitoramento de erros ativo (Slack alerts)

---

*Documento parte do SDD (Software Design Document) do arkana-agora.*

---

## Refresh Notes

- **2026-08-12:** Dockerfile §5.1 updated — `COPY package.json bun.lockb ./` → `bun.lock ./` to match the bun text lockfile actually committed in the repo (the old `bun.lockb` binary format is not used). Consistent with `docs/07-security/security.md` (bun.lock mandatory). No other drift found.
- **2026-08-12 (F1 — Banco de dados + Docker):** dev DB SQLite → Docker Postgres 16 — §1 env table, §2.1 skeleton status, §2.2 stack diagram, §2.3 dev commands (`db push` → `docker compose up -d postgres` + `bunx prisma migrate dev`), §2.4 `DATABASE_URL=postgresql://arkana:arkana@localhost:5432/arkana`. §5.1 Dockerfile aligned to the real file (named stages deps/builder/runner; `groupadd`/`useradd` because oven/bun:1 is Debian-based; `bun install --frozen-lockfile`; standalone prerequisite note on `next.config.ts`). §5.2 docker-compose replaced with the committed file (postgres/redis/migrate/web; db `arkana`; no `version:` key; no ws/caddy — deferred to Sprint 1 chat).
- **2026-08-24:** §5.1 standalone prerequisite note rewritten — `output: "standalone"` agora é condicional (`if (!process.env.VERCEL)`). Primeiro deploy na Vercel falhava com `ENOENT .next/next-server.js.nft.json` em `onBuildComplete` (Next 16.3 + adapter + standalone, upstream #96646). Docker/CI preservam o standalone.
- **2026-08-24 (F4 sync):** §2.3 Logger note atualizada — `src/lib/logger.ts` (Pino) já está implementado; a health route loga via `logger.error({ err }, "[health] ...")` e o stopgap restante conhecido é o `console.log("[auth:magic-link] ...")` em `EmailProvider.sendVerificationRequest` (`src/auth/auth.config.ts` — symbol anchor; ver `docs/solutions/patterns/observability/logger-migration-stopgap.md`).
- **2026-09-01 (T3 email):** §2.4 adicionada `RESEND_API_KEY` (provedor Resend transacional — `src/lib/email/email.ts`, helpers `sendVerificationEmail`/`sendPasswordResetEmail`/`sendMagicLinkEmail`), alinhada ao `.env.example`; guard de dev `AUTH_EMAIL_SKIP_SEND=true` exige `NODE_ENV=development`. O magic link do Auth.js continua via nodemailer/SMTP (`SMTP_*`).
- **2026-09-23 (Prisma Postgres local):** dev DB alinhado a **Prisma Postgres** (Vercel Marketplace) — §1 tabela, §2.3 comandos (`.\node_modules\.bin\prisma generate` / `migrate dev`), §2.4 `DATABASE_URL` = pooled + `DIRECT_URL` = direct (Docker 16 como fallback offline). CLI pinado em `prisma@^7` (v8 RC sem `generate`/`migrate` quebra `npm run build`). URL do datasource em `prisma.config.ts`. Runtime com `@prisma/adapter-pg` (`src/lib/prisma.ts`). Ver `docs/solutions/ci-cd/prisma-v8-cli-regression.md`.
- **2026-09-24 (PostHog env):** §2.4 e §4.2 alinhadas ao `.env.example`/código — adicionadas `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN` + `NEXT_PUBLIC_POSTHOG_HOST` (as vars que `src/lib/analytics.ts` realmente lê); `POSTHOG_KEY` marcada como legada (não lida pelo código). `initAnalytics()` faz no-op em development (dev gate), então essas vars só são necessárias fora de development.
- **2026-10-02 (socket-service — Sprint 2 Phase 2.5, T066–T075):** §2.1 caminho `services/ws-service` → **`socket-service/`** (raiz do repo — não existe diretório `services/`); Nota F1 + §2.3 — **`dev:ws` deixou de ser stub** (`tsx watch socket-service/index.ts`) e o compose continua **sem** serviço `ws` (socket-service roda fora do compose; `dev:all` segue stub do Caddy); §2.4 — `SOCKET_PORT` sem o marcador "serviço ainda não scaffoldado", + bloco de variáveis do socket-service (`REDIS_URL` obrigatória, `AUTH_URL` = origem do CORS, `JWT_PUBLIC_KEY` RS256/ADR-009 — Zod em `socket-service/src/lib/env.ts`) e o par `JWT_PRIVATE_KEY`/`JWT_PUBLIC_KEY` que faltava no bloco (já documentado em `environments.md`/`security.md`); §4.2 — linhas `SOCKET_PORT` e `NEXT_PUBLIC_WS_URL` (`src/hooks/use-socket.ts`) + seção de configuração no Railway. Nomes canônicos dos eventos e contrato de rooms em `architecture.md` §6.3/§6.4.
- **2026-10-03 (revisões Phase 2.5 I-a…I-e + auto-heal do Event Bus):** §4.2 — novo bloco **"Resiliência do Event Bus"** documentando o comportamento real de `socket-service/src/bus.ts`: detecção de cliente morto + nova tentativa no próximo publish (`ensureRedis()`/`discardDeadClients()`) e reconexão automática do sub via `close`/`end` com backoff 1 s→30 s e máx 5 falhas (`scheduleBusReconnect()`), preservando o fail-fast por chamada do publish (revisão K). **Correção do entry anterior**: `REDIS_URL` **não** é obrigatória no schema (opcional desde a revisão K — só é exigida em produção, como §4.2 já diz). §2.4/§4.2 já continham o WARN de build da revisão I-e (`NEXT_PUBLIC_WS_URL` inlined em build time).
