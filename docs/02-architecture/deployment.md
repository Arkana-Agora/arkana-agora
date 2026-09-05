# Estratégia de Deploy — arkana-agora

> Versão: 1.0 | Última atualização: 2026-09-02

---

## 1. Ambientes

| Ambiente | Propósito | URL | Banco de Dados |
|----------|-----------|-----|----------------|
| **Development** | Desenvolvimento local | `http://localhost:3000` | Docker Postgres 16 (`arkana`, localhost:5432) |
| **Staging** | Testes e QA | `staging.arkanaagora.com.br` | Neon PostgreSQL (staging) |
| **Production** | Produção | `arkanaagora.com.br` | Neon PostgreSQL (prod) |

---

## 2. Desenvolvimento Local

### 2.0 Toolchain (regra canônica)

- **MVP / app único (este documento)**: package manager **`bun`** (instalação, scripts, Dockerfile, CI).
- **Monorepo futuro (ADR-005, proposto)**: quando a migração iniciar, usa-se **`pnpm`** + Turborepo (ver `monorepo.md`).
- Não misturar: aplicações do monorepo futuro devem usar `pnpm`; o app MVP continua `bun` até a migração.

### 2.1 Backend e Frontend (frameworks e onde fica o código)

> A arquitetura documentada é **monolito modular Next.js** — não há separação `backend/`/`frontend/` no SDD. No MVP, frontend e API ficam no mesmo app; serviços auxiliares vivem em `services/`. Os diretórios vazios `backend/` e `frontend/` na raiz do repo são placeholders e não fazem parte da estrutura documentada.
>
> **Status (esqueleto + F1 DB/Docker + F2A auth login + F2B design system + Módulo 1 Auth parcial):** já existe na raiz do repo um esqueleto Next.js 16 (App Router) — `package.json` (toolchain `bun`), `src/app/` (incl. `src/app/api/health/route.ts`), `src/lib/prisma.ts`, `prisma/schema.prisma` (datasource `postgresql`; 5 models: User, UserProfile, Subscription, Session, VerificationToken), `prisma/migrations/` (init `20260813000605_init` aplicada), `prisma/seed.ts`, `tests/health.test.ts`, `.env.example`, `eslint.config.mjs`, `vitest.config.ts`, `Dockerfile`, `docker-compose.yml`, `.dockerignore`. Dev DB: Docker Postgres 16 (`docker compose up -d postgres`) via `bunx prisma migrate dev`. **Auth de login implementado (Sprint 0, F2A — ADR-010):** Auth.js v5 (`next-auth@5.0.0-beta.32`, adapter Prisma mínimo, JWT strategy) com **magic link** (e-mail) e **Google OAuth** em `src/app/(auth)/login`, `src/app/api/auth/[...nextauth]/route.ts`, `src/auth/`; credenciais e-mail/senha e Facebook OAuth ficam para o Sprint 1. **Design system implementado (Sprint 0, F2B):** Tailwind CSS 4 via `postcss.config.mjs` (plugin `@tailwindcss/postcss`), `components.json` (style radix-nova), tokens oklch claro/escuro em `src/app/globals.css`, `src/components/ui/` (Button, Card, Input, Label, Skeleton, Alert + `form.tsx` manual), `src/lib/utils.ts` (`cn`), `next-themes` (`providers.tsx`/`theme-provider.tsx`/`theme-toggle.tsx`), `layout.tsx` com fonte Geist (`--font-geist-sans`) + `suppressHydrationWarning`, guard de auth em `src/app/(app)/layout.tsx`. **Módulo 1 Auth (Sprint 1) parcial:** `POST /api/v1/auth/register` (T6), `POST /api/v1/auth/login` (T7), `POST /api/v1/auth/magic-link` (T9), `POST /api/v1/auth/magic-link/verify` (T10), `POST /api/v1/auth/forgot-password` (T11), `POST /api/v1/auth/reset-password` (T12), `POST /api/v1/auth/refresh` (T13), `POST /api/v1/auth/logout` (T14), `POST /api/v1/auth/verify-email` (T30) e `POST /api/v1/auth/verify-email/resend` (T30) implementados com `src/services/token-service.ts`, `src/lib/rate-limit.ts` (+ magic link 3/h por email, forgot-password 3/h por email), `src/lib/redis.ts`, `src/lib/validators/auth.ts` (`loginSchema`/`magicLinkSchema`/`magicLinkVerifySchema`/`forgotPasswordSchema`). **LGPD deleção de conta implementada:** `DELETE /api/v1/auth/account` (T15, soft delete atômico) + `GET /api/cron/hard-delete` (T16, Vercel Cron 03:00 UTC — anonimização pós-30 dias, `src/jobs/hard-delete-accounts.ts`). Ainda não existe: IA, pagamentos, social → veja `docs/architecture.md`  "Implementation status".

| Projeto/Parte | Framework | Onde fica (documentado) | Porta | Iniciar |
|---|---|---|---|---|
| **Frontend (web)** | Next.js 16 (App Router) + TypeScript | `apps/web` (monorepo futuro) / raiz do app (MVP) | 3000 | `bun run dev` |
| **Backend (API)** | Next.js API Routes + Prisma + Auth.js v5 + Zod | `src/app/api/v1/*` (mesmo app — MVP) | 3000 | `/api/v1/*` |
| **Backend — WebSocket** | Node.js + Socket.io | `services/ws-service` | 3003 | `bun run dev:ws` |
| **Backend — IA** (futuro) | Node.js | `services/ai-service` | 3004 | — |
| **Backend — Worker** (futuro) | Node.js + BullMQ | `services/worker` | 3005 | — |
| **Packages** (monorepo futuro) | pnpm workspace | `packages/{ui,types,config,utils,api-client}` | — | via Turborepo |

Backend no MVP = API Routes do próprio Next.js (monólito modular, ADR-001). Bibliotecas backend documentadas: Prisma (ORM), Auth.js v5 (auth — ADR-010), Zod (validação), Mercado Pago SDK (payments), `z-ai-web-dev-sdk` (IA). Frontend documentado: shadcn/ui (preset radix-nova — "New York" na nomenclatura antiga da CLI) + Tailwind CSS 4 + Zustand + TanStack Query + Framer Motion. Detalhes em `docs/02-architecture/architecture.md` e `docs/02-architecture/monorepo.md`.

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

> **Nota F1:** o `docker-compose.yml` atual sobe **postgres + redis + migrate + web** (sem ws/caddy — adiados para o Sprint 1 de chat). O diagrama acima é o stack local completo documentado; Socket.io e Caddy serão adicionados ao compose quando o serviço de chat for scaffoldado.

### 2.3 Comandos de Desenvolvimento

```bash
# Instalar dependências
bun install

# Subir banco de dev (Docker Postgres 16 + Redis)
docker compose up -d postgres redis

# Rodar migrações (dev: gera/aplica migrations versionadas)
bunx prisma migrate dev

# Gerar tipos Prisma
bunx prisma generate

# Popular dados iniciais (baralhos, spreads)
bun run seed

# Iniciar aplicação web
bun run dev          # Next.js na porta 3000

# Iniciar Socket.io service
bun run dev:ws       # Socket.io na porta 3003

# Iniciar tudo (com Caddy)
bun run dev:all
```

> **Nota:** os scripts acima já existem no `package.json` do esqueleto na raiz (MVP). `dev:ws` e `dev:all` ainda são stubs (eco de aviso) até o Socket.io service e o Caddy serem scaffoldados (adiados para o Sprint 1 de chat). O banco de dev é o container `postgres` do compose (db/user/pass `arkana`, porta 5432); `docker compose up -d postgres redis` sobe banco + Redis.

> **Logger note:** `src/lib/logger.ts` (Pino) is implemented (Sprint 0, F4) — the health route logs via `logger.error({ err }, "[health] ...")`. Remaining known stopgap: `console.log("[auth:magic-link] ...")` at `src/auth/auth.config.ts:88` (see `docs/solutions/patterns/observability/logger-migration-stopgap.md`; pattern details in `docs/solutions/patterns/backend/health-check-envelope.md`).

### 2.4 Variáveis de Ambiente (`.env`)

> Copie `.env.example` → **`.env`** na raiz do repo. O Prisma CLI e os scripts `bun` carregam `.env` (não `.env.local`); o Next.js e o Bun também carregam `.env.local` com maior precedência. Nunca commite `.env`/`.env*.local`.

```env
# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_WS_URL=ws://localhost:3003

# Banco (dev) — Docker Postgres 16 via docker compose (db/user/pass: arkana)
DATABASE_URL=postgresql://arkana:arkana@localhost:5432/arkana

# Auth (Auth.js v5 — ADR-010; não usar NEXTAUTH_*/GOOGLE_CLIENT_*)
# AUTH_URL: origem canônica da aplicação (impede host-header poisoning do magic link em prod — HTTPS obrigatório)
AUTH_URL=https://arkanaagora.com.br
AUTH_SECRET=dev-secret-change-me
AUTH_TRUST_HOST=true
AUTH_GOOGLE_ID=dev-google-id
AUTH_GOOGLE_SECRET=dev-google-secret
AUTH_EMAIL_SKIP_SEND=true
EMAIL_FROM=Arkana Agora <nao-responda@arkanaagora.dev>
# SMTP (opcional em dev — sem SMTP + AUTH_EMAIL_SKIP_SEND=true loga o link no console)
SMTP_URL=
SMTP_HOST=
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=
SMTP_PASS=
# Resend (e-mails transacionais — src/lib/email/email.ts); em dev use AUTH_EMAIL_SKIP_SEND=true para logar no console
RESEND_API_KEY=
# Vercel Cron (T16 — GET /api/cron/hard-delete): obrigatório em prod; sem ele o cron retorna 401
CRON_SECRET=

# IA
AI_PRIMARY_API_KEY=dev-ai-key
AI_FALLBACK_API_KEY=dev-ai-fallback-key

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

# Cloudflare R2 (S3-compatible)
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET=
R2_PUBLIC_URL=https
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
| `DATABASE_URL` | *URL do Neon PostgreSQL* | Production | Ex: `postgresql://user:pass@ep-xxx.us-east-2.aws.neon.tech/dbname` |
| `REDIS_URL` | *URL do Redis Upstash* | Production | Ex: `redis://default:pass@xxx.upstash.io:6379` |
| `R2_ACCOUNT_ID` | *ID da conta Cloudflare R2* | Production | Conta ID da R2 |
| `R2_ACCESS_KEY_ID` | *Access Key ID da R2* | Production | Chave de acesso da R2 |
| `R2_SECRET_ACCESS_KEY` | *Access Key Secret da R2* | Production | Segredo da chave de acesso da R2 |
| `R2_BUCKET` | *Nome do bucket da R2* | Production | Nome do bucket na R2 |
| `R2_PUBLIC_URL` | `https://` | Production | URL pública do bucket (ex: `https://your-bucket.r2.dev` se custom domain) |
| `AI_PRIMARY_API_KEY` | *Chave OpenAI/IA* | Production | Chave da API principal de IA |
| `AI_FALLBACK_API_KEY` | *Chave de fallback de IA* | Production | Chave da API de fallback de IA |
| `MP_ACCESS_TOKEN` | *Token Mercado Pago* | Production | Token de acesso do Mercado Pago |
| `MP_WEBHOOK_URL` | *URL do webhook Mercado Pago* | Production | URL de callback do webhook |
| `SENTRY_DSN` | *DSN do Sentry* | Production | DSN do Sentry (opcional, SDK desabilitado sem DSN) |
| `LOG_LEVEL` | `info` | Production | Nível de log do Pino |
| `POSTHOG_KEY` | *Chave do PostHog* | Production | Chave do PostHog (analytics) |
| `AUTH_URL` | `https://arkanaagora.com.br` | Production | Origem canônica da aplicação (HTTPS obrigatório) |
| `CRON_SECRET` | *Secret do Vercel Cron* | Production | Protege `GET /api/cron/hard-delete` (T16 — LGPD hard-delete); obrigatório, sem ele o cron retorna 401 |

**Configuração no Vercel (Staging)**:

Acesse `https://vercel.com/dedsdeads-projects/arkana-agora/settings/environment-variables`:
1. Crie uma variável `AUTH_URL` com valor `https://arkana-agora.vercel.app` (ou `https://staging.arkanaagora.com.br` se configurado)
2. Configure as outras variáveis de ambiente conforme a tabela acima

**Nota**: As variáveis `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `DATABASE_URL`, `REDIS_URL`, `SENTRY_DSN` e `CRON_SECRET` (Vercel Cron T16) são obrigatórias em produção. Em staging, apenas `AUTH_URL` e `AUTH_SECRET` são obrigatórios para evitar o erro de `AUTH_URL missing`.

### 4.3 Serviços de Produção

| Serviço | Provedor | Plano Estimado | Custo/mês |
|---------|----------|----------------|-----------|
| Web (Next.js) | **Vercel** (Pro) | Serverless, auto-scale | $20 |
| WebSocket | **Railway** | 1 instância (512MB RAM) | $5 |
| PostgreSQL | **Neon** | Pro (0.25 vCPU, 1GB RAM) | $19 |
| Redis | **Upstash** | Pay-as-you-go | ~$5 |
| CDN + DNS | **Cloudflare** | Pro (se necessário) | $0-20 |
| Armazenamento | **Cloudflare R2** | Pay-as-you-go | ~$3 |
| IA (GPT-4o) | **OpenAI** (via z-ai-sdk) | Pay-per-token | Variável |
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
- **2026-08-24 (F4 sync):** §2.3 Logger note atualizada — `src/lib/logger.ts` (Pino) já está implementado; a health route loga via `logger.error({ err }, "[health] ...")` e o stopgap restante conhecido é o `console.log("[auth:magic-link] ...")` em `src/auth/auth.config.ts:88` (ver `docs/solutions/patterns/observability/logger-migration-stopgap.md`).
- **2026-09-01 (T3 email):** §2.4 adicionada `RESEND_API_KEY` (provedor Resend transacional — `src/lib/email/email.ts`, helpers `sendVerificationEmail`/`sendPasswordResetEmail`/`sendMagicLinkEmail`), alinhada ao `.env.example`; guard de dev `AUTH_EMAIL_SKIP_SEND=true` exige `NODE_ENV=development`. O magic link do Auth.js continua via nodemailer/SMTP (`SMTP_*`).
