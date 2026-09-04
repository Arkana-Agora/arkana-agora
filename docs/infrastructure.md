# Infrastructure

> **Status: skeleton + F1 (DB/Docker) + F2A (auth login) + F2B (design system) + F3 (CI/CD + Prettier/Husky) + F4 (observability: Pino logger, parallel health probes, conditional Sentry) + Módulo 1 Auth parcial (register/login/magic-link/refresh/logout + token-service + rate-limit + redis).** A minimal Next.js 16 monolith skeleton exists at the repo root (`package.json` with `bun` toolchain, `src/app/`, `src/lib/prisma.ts`, `prisma/schema.prisma` — 5 models (User, UserProfile, Subscription, Session, VerificationToken) on datasource `postgresql`, init migration `20260813000605_init` applied, `prisma/seed.ts` (admin + test), `src/app/api/health/route.ts`, `tests/health.test.ts`, `.env.example` — names only). **F1 (Sprint 0) added Docker infra**: `docker-compose.yml` (postgres:16-alpine + redis:7-alpine + migrate + web), `Dockerfile` (multi-stage bun, standalone output), `.dockerignore`, `next.config.ts` (`output: "standalone"` only outside Vercel builds, per vercel/next.js#96646) + `serverExternalPackages: ["@prisma/client"]`. **F2A (Sprint 0) added the login auth layer** (Auth.js v5 — magic link + Google OAuth; see ADR-010): `src/auth/`, `src/app/(auth)/login`, `src/app/api/auth/[...nextauth]/route.ts`, `src/types/next-auth.d.ts`, plus env vars `AUTH_URL`, `AUTH_SECRET`, `AUTH_TRUST_HOST`, `AUTH_GOOGLE_ID`/`AUTH_GOOGLE_SECRET`, `AUTH_EMAIL_SKIP_SEND`, `SMTP_*`, `EMAIL_FROM`. **F2B (Sprint 0) added the design system** (Tailwind CSS 4 via `postcss.config.mjs` + `@tailwindcss/postcss`; `components.json` style `radix-nova`; `src/app/globals.css` with oklch `:root`/`.dark` tokens, `@custom-variant dark`, `tw-animate-css`; `src/lib/utils.ts` (`cn`); `src/components/ui/` — Button, Card, Input, Label, Skeleton, Alert + hand-written `form.tsx`; `src/components/providers.tsx` (SessionProvider + ThemeProvider via next-themes), `theme-provider.tsx`, `theme-toggle.tsx`; `layout.tsx` with Geist font (`--font-geist-sans`) + `suppressHydrationWarning`; route-group auth guard at `src/app/(app)/layout.tsx`). **F3 (Sprint 0) added CI/CD**: `.github/workflows/ci.yml` (quality → type-check → test with postgres service → build → gate-deploy → deploy-staging via vercel-action, gated on secrets), Prettier (`prettier.config.mjs`) + Husky pre-commit (lint-staged + tsc), minimal `vercel.json` (framework preset + security headers); E2E green pending remote push with `VERCEL_*` secrets. **F4 (Sprint 0) added observability**: `src/lib/logger.ts` (Pino — pino-pretty in dev, secret redaction, `LOG_LEVEL`, `newReqId()`; `pino` in `serverExternalPackages`), health route with parallel probes (`Promise.allSettled`, envelope `{status,timestamp,version,services:{database,redis}}`, redis optional gated on `REDIS_URL` — absent → neutral `not-configured`), conditional Sentry (`@sentry/nextjs@10.71.0`: `src/instrumentation.ts` server/edge + `src/instrumentation-client.ts` client + `src/app/global-error.tsx` + `withSentryConfig`; **no DSN = disabled**; `sentry.properties`/`.sentryclirc`/`.env.sentry-build-plugin` excluded from git and Docker build context). **Still not implemented:** no Terraform/CDK, no AI/payments/social logic, no logout route of the Custom JWT Layer (`backend/`/`frontend/` remain empty placeholders). Everything below describes the **target/planned infrastructure** as specified in the project docs (pt-BR). Items that are planned are explicitly labeled **"planejado" (planned)**. Nothing is provisioned/deployed to a cloud provider today — local dev runs `docker compose up -d` (Postgres 16 + Redis) + `bun run dev`.
>
> **Language note:** written in English for consistency with the required section headings and the previous stub; the source-of-truth docs are in pt-BR and are referenced by path.

## Infrastructure Overview

Arkana Agora is a Brazilian Tarot/Lenormand + AI-reading + social platform. The documented target architecture is a **modular monolith** (Next.js) that is planned to evolve into a **monorepo with microservices** (Turborepo + pnpm workspaces, ADR-005 — status: **proposto/planned**).

The provider model is **fully managed SaaS/serverless** — no self-hosted servers are documented. Each runtime concern is delegated to a managed provider:

| Concern | Provider (documented) | Status |
|---|---|---|
| Web app / API / SSR / SSE | Vercel (Next.js, serverless) | em setup (F3 — deploy gated; aguarda secrets) |
| Real-time WebSocket (Socket.io) | Railway (mini-service, port 3003) | planejado |
| Background jobs (BullMQ worker) | Railway (port 3005) | planejado (futuro) |
| AI service (separate process) | Node.js (port 3004) | planejado (futuro) |
| PostgreSQL | Neon (serverless, via Prisma) | planejado |
| Redis (sessions, cache, rate limit, pub/sub) | Upstash | planejado |
| Object storage (card images, uploads) | Cloudflare R2 | planejado |
| CDN / DNS / WAF | Cloudflare | planejado |
| Reverse proxy / TLS (local + container) | Caddy (ports 80/443) | planejado |
| AI models | OpenAI GPT-4o / GPT-4o-mini via `z-ai-web-dev-sdk` | planejado |
| Payments | Mercado Pago (PIX, card, boleto, subscriptions) | planejado |
| Error tracking | Sentry (@sentry/nextjs) | implementado (F4 — disabled sem DSN; captura em produção requer DSN) |
| Product analytics | PostHog | planejado |
| Metrics / dashboards | Prometheus + Grafana | planejado |
| Alerting | PagerDuty + Slack | planejado |

**Runtime topology (documented target):**

```
Clients (Browser Next.js / Mobile Expo / Admin Next.js)
        │
        ▼
Caddy (80/443) — SSL, rate limiting, reverse proxy   [planejado]
        │
   ┌────┼───────────────┐
   ▼    ▼               ▼
Next.js :3000   AI Service :3004 (SSE)   Socket.io :3003
(SSR/API)       (futuro)                 (real-time social)
   │              │                       │
   └──────┬───────┴───────────┬───────────┘
          ▼                   ▼
   PostgreSQL (Neon)    Redis (Upstash)
   via Prisma            sessions/cache/queues
          │
          ▼
   Cloudflare R2 (assets) + CDN
```

- **AI streaming** uses **SSE** (not WebSocket) — ADR-004 (aceito). Route: `POST /api/v1/ai/reading/stream`.
- **Real-time social** (feed, notifications, presence) uses **Socket.io** on a separate mini-service (port 3003) — ADR-007 (aceito).
- **Inter-service events** use an Event Bus: custom EventEmitter in dev, **Redis Pub/Sub in production** (planejado).
- **Background jobs** (daily horoscopes, emails, image processing) via **BullMQ** on Redis (planejado, futuro).

## Environments

Documented environment matrix (source: `docs/02-architecture/deployment.md` §1):

| Environment | Purpose | URL | Database | Notes |
|---|---|---|---|---|
| **Development** | Local development | `http://localhost:3000` | Docker Postgres 16 (`arkana`, localhost:5432) | `docker compose up -d` (postgres + redis), `bun run dev` (Next.js :3000); schema sync via `bunx prisma migrate dev` |
| **Staging** | Tests and QA | `staging.arkanaagora.com.br` | Neon PostgreSQL (staging branch) | Vercel preview deploys per PR; Mercado Pago **sandbox**; Upstash free tier |
| **Production** | Production | `arkanaagora.com.br` | Neon PostgreSQL (prod) | Vercel Pro; Railway (WS); Mercado Pago live; Cloudflare CDN/WAF |

**Domains (documented, planejado):**

```
arkanaagora.com.br        → Vercel (web app)
api.arkanaagora.com.br    → Vercel (API routes, alias of same deploy)
ws.arkanaagora.com.br     → Railway (Socket.io)
assets.arkanaagora.com.br → Cloudflare R2 (images)
```

**Configuration/secret boundaries:** secrets live in environment variables managed per provider console (Vercel/Railway/Neon/Upstash) — **never in source control**. `.env` and `.env*.local` are gitignored; only `.env.example` templates are committed (see `docs/07-security/security.md` §"Gestão de Segredos"). A production secret manager (e.g., AWS Secrets Manager/Vault) is mentioned as a security guideline but is **not** documented as a concrete decision — treat as guideline only.

> Note: `docs/environments.md` is now the canonical environment matrix. **No AWS usage is documented** in the architecture docs; the AWS references in `docs/workflow/operational-overrides.md` (example) and `docs/lambdas/README.md` (empty index) are template scaffolding, not decisions.

## Core Services and Dependencies

| Service | Provider / tech | Port | Status | Integration points |
|---|---|---|---|---|
| Web app (Next.js, App Router) | Vercel serverless | 3000 | em setup (F3 — CI gated por secrets) | REST API routes, SSR, SSE streaming, Auth.js v5 (ADR-010) |
| Socket.io mini-service | Railway (Node.js) | 3003 | planejado | WebSocket events (`feed:new_post`, `notification:new`, `presence:update`, `reading:shared`, `chat:message`); Redis adapter for horizontal scale |
| AI service | Node.js | 3004 | planejado (futuro) | SSE streaming of GPT-4o interpretations |
| Worker (BullMQ) | Railway (Node.js) | 3005 | planejado (futuro) | Daily horoscopes, email notifications, image processing |
| PostgreSQL | Neon (serverless) via Prisma | — | planejado | Single data source of truth; PgBouncer pooling; PITR backups; branching for staging |
| Redis | Upstash | 6379 | planejado | Sessions, rate limiting, feed cache, AI interpretation cache (24h TTL), BullMQ queues, Pub/Sub event bus |
| Object storage | Cloudflare R2 | — | planejado | Card images (WebP, 3 variants), user uploads; served via `assets.arkanaagora.com.br` |
| CDN / DNS / WAF | Cloudflare | — | planejado | Static cache (TTL 1h HTML, 30d assets), SSL Full (Strict), WAF rules, Page Rules bypass for `/api/*` |
| Reverse proxy / TLS | Caddy | 80/443 | planejado | Local + Docker stack; SSE flush config (`flush_interval -1`); WS upgrade for :3003 |
| AI models | OpenAI GPT-4o (primary), GPT-4o-mini (fallback) via `z-ai-web-dev-sdk` | — | planejado | Model Router per feature; fallback chain: primary → mini → generic cache → friendly error |
| Payments | Mercado Pago | — | planejado | Checkout, subscriptions (Arkana Plus), webhooks (`POST /api/v1/webhooks/mercadopago`), split payments |
| Error tracking | Sentry (@sentry/nextjs@10.71.0) | — | implementado (F4 — disabled sem DSN) | Client + server errors (`instrumentation*.ts`, `global-error.tsx`), source maps (`withSentryConfig`), release tracking per deploy; captura efetiva requer `SENTRY_DSN`/`NEXT_PUBLIC_SENTRY_DSN` |
| Analytics | PostHog | — | planejado | Product events, funnels, cohorts; Vercel Analytics for Web Vitals |
| Metrics | Prometheus (`/api/metrics`) + Grafana | — | planejado | `http_requests_total`, `ai_readings_total`, `ai_tokens_used_total`, `socketio_connections_active` |
| Alerting | PagerDuty + Slack | — | planejado | Escalation: warning → Slack (30 min), high → PagerDuty (15 min), critical → PagerDuty+Slack+SMS (5 min) |
| Tracing | OpenTelemetry | — | planejado (futuro) | Backends considered: Jaeger, Tempo, Honeycomb, Datadog — no decision recorded |

**External dependencies with contracts:** Mercado Pago webhooks, OpenAI API (rate limits: 500 RPM / 200K TPM Tier 1), Google/Facebook OAuth (Auth.js v5 — Google no MVP, Facebook na Sprint 1), SMTP (magic links). See `docs/integrations.md` for the contract catalog; contracts are also documented inline in `docs/04-api/*` and `docs/05-ai/providers.md`.

## Deployment and Operations

**Deployment flow (documented, implemented in F3):**

```
PR to main
  ├─ CI (GitHub Actions): quality → type-check → test (Postgres service) → build
  ├─ Success → Vercel preview deploy (staging/preview) a cada push na main
  └─ Push main → Vercel preview/staging deploy (M0 milestone)
```

- **CI/CD**: GitHub Actions workflow implemented in F3 (`ci.yml` with quality/type-check/test/build jobs + `vercel-action` with preview deploy on push main, guarded by secrets). `.github/workflows/ci.yml` exists and is functional.
- **Migrations**: Prisma Migrate (all environments — dev included since F1). Dev syncs schema via `docker compose up -d postgres` + `bunx prisma migrate dev`; the compose `migrate` service (one-shot) and staging/prod CI use `prisma migrate deploy` (`docs/03-database/migrations.md`). First migration applied: `20260813000605_init` (5 models, `migration_lock.toml` = `postgresql`). Migration naming: `YYYYMMDDHHMMSS_descriptive_name`. Invariant: **never edit an applied migration** — create a new one.
- **Docker (implemented, F1):** `Dockerfile` (multi-stage bun: `deps` → `builder` → standalone `runner`; oven/bun:1 is Debian-based → `groupadd`/`useradd`, not Alpine `addgroup`/`adduser`) and `docker-compose.yml` (services: `postgres` db/user/pass `arkana`, `redis`, `migrate` one-shot `bunx prisma migrate deploy` with build target `builder`, `web` — **no `version:` key**, no ws/caddy yet) at the repo root, plus `.dockerignore` (excludes `.env*`, `node_modules`, `.next`, `docs`, `.specs`) and `next.config.ts` (`output: "standalone"` only outside Vercel builds — Next 16.3 adapter regression vercel/next.js#96646, `serverExternalPackages: ["@prisma/client"]`). ws/caddy services are **deferred** to the Sprint 1 chat work; `deployment.md` §5 documents the target compose.
- **Rollback**: Vercel instant rollback (<30s, via CLI/dashboard); Neon point-in-time recovery for DB; Railway `railway up --rollback` for WS. Migration rollback via `prisma migrate resolve --rolled-back`.
- **Prod deploy checklist** (`deployment.md` §8): tests green, migration tested in staging, DB backup, env vars verified, DNS/SSL verified, `/api/health` passing, Sentry release, PostHog flags, rate limiting, Slack alerts active.
- **Observability (implemented F4 + documented targets)**: Pino structured logging implemented (`src/lib/logger.ts` — JSON, redacted fields, pino-pretty in dev); Sentry implemented conditionally (`@sentry/nextjs@10.71.0` via `src/instrumentation.ts` / `src/instrumentation-client.ts` / `global-error.tsx` / `withSentryConfig` — **disabled without DSN**, so builds and runtime never require credentials; production capture requires DSN in the dashboard); PostHog, Vercel Analytics (LCP < 2.5s, INP < 200ms, TTFB < 800ms targets) still planned; `/api/health` implemented with **parallel probes** (`Promise.allSettled`, each time-boxed): envelope `{status,timestamp,version,services:{database,redis}}` — DB hard dependency (5s timeout), redis optional (gate `REDIS_URL`: absent → neutral `not-configured`; configured-but-failing → 503) per `observability.md` §6.3; Prometheus metrics endpoint; Grafana dashboards; PagerDuty+Slack alert rules remain planned. Runbooks referenced (`docs/runbooks/`) but **none exist yet** — the catalog is an empty template.
- **Ownership boundaries**: all runtime is delegated to managed providers (Vercel, Railway, Neon, Upstash, Cloudflare, OpenAI, Mercado Pago, Sentry, PostHog). The team owns: application code, Prisma schema/migrations, CI/CD definition, Caddy config, env/secret management per provider console, and monitoring/alert rules. No self-managed servers, no IaC (Terraform/CDK) is documented anywhere.

## Known Constraints and Risks

1. **CI/CD pipeline is implemented** (F3): GitHub Actions workflow (`ci.yml`) exists and runs quality → type-check → test → build → staging deploy. The CI pipeline is green and tested locally. Production deployment to Vercel requires Vercel secrets (VERCEL_TOKEN, ORG_ID, PROJECT_ID) to be configured — the workflow is gated and stays green even before secrets exist.
2. **Tooling rule (resolved):** package manager is **`bun` for the MVP single app** (deployment/migrations/Docker/CI) and **`pnpm` for the planned monorepo** (ADR-005, also `monorepo.md`/`sprint-0.md`). Not a conflict anymore — see `docs/02-architecture/deployment.md` §2.0.
3. **Dev/prod database (resolved, F1):** dev now runs **Docker Postgres 16** (`docker-compose.yml`) — same engine as prod Neon, so the old SQLite dev / PostgreSQL prod skew is gone. Scalar lists (`String[]`, e.g. `UserProfile.skills/specialties/languages`) are supported in dev. The init migration `20260813000605_init` was generated with datasource `postgresql` (`migration_lock.toml` = `postgresql`), so its SQL is portable to Neon. Residual dev/prod differences are Neon-specific (serverless, PgBouncer pooling, `pg_stat_statements`); schema changes are still validated against Postgres in CI (documented CI runs tests against `postgres:16-alpine`).
4. **Serverless constraints:** Vercel cold starts (~250ms), invocation limits (1000/min hobby, 3000/min pro), Prisma client weight on edge, and SSE buffering (requires Caddy `flush_interval -1` and `X-Accel-Buffering: no`). WebSocket cannot run on Vercel — hence the separate Railway Socket.io service (ADR-007).
5. **AI cost is the dominant variable cost:** GPT-4o is pay-per-token; estimated $25–$2,500/month depending on scale (`scalability.md` §7). Mitigations documented: aggressive caching (24h TTL, expected 30–45% hit rate), model routing (GPT-4o-mini for simple tasks), fallback chain, and budget alerts at 80%/90% of daily/monthly budget.
6. **Vendor lock-in:** Vercel (acknowledged in ADR-001), Mercado Pago (ADR-008 — Brazil-specific: PIX, split, subscriptions), OpenAI, Neon, Upstash. Exit paths are not documented.
7. **External dependency failure modes:** OpenAI rate limits/outages (fallback to mini → cache → friendly error); Mercado Pago webhook reliability (retry); Redis outage (cache disabled, cost increases — alert "Cache Down"); Neon availability (PITR for recovery).
8. **Migration risk:** prod migrations must not lock tables > 5s (no-downtime requirement), require tested rollback SQL, and run in the 02:00–05:00 BRT window (`migrations.md` §4).
9. **LGPD/privacy:** personal data (birth dates, reading history, names) is treated as sensitive; consent, right-to-erasure, and portability are architecture requirements (`vision.md`, `security.md`). Data residency/processing location for the managed providers is **not documented** — a gap to close before launch.
10. **Operational maturity gaps:** `docs/lambdas/README.md` and `docs/runbooks/README.md` are empty templates; no runbooks, no on-call roster, no incident post-mortem process exists yet (security.md defines the incident response *policy* only).

**Invariants (must not be broken):**

- No secrets in source control; `.env`/`.env*.local` always gitignored; only `.env.example` committed (`security.md`).
- Prisma is the only data-access layer; migrations are versioned and never edited after application (`migrations.md`).
- AI streaming uses SSE; Socket.io is used only for bidirectional real-time social on port 3003 (ADR-004, ADR-007).
- All API endpoints have rate limiting (per-endpoint limits in `security.md`).
- All changes reach staging/prod through the CI/CD pipeline; no manual production deploys.
- Prod database is Neon PostgreSQL; dev is Docker Postgres 16 — same engine (ADR-002); no SQLite in dev anymore.

## Source-of-truth references

- **Architecture & topology:** `docs/02-architecture/architecture.md` (diagram, ports, services, communication)
- **Deployment & environments:** `docs/02-architecture/deployment.md` (env matrix, providers, costs, domains, Docker, CI/CD, rollback, checklist)
- **Monorepo evolution:** `docs/02-architecture/monorepo.md` (monolith → monorepo migration path); ADR-005 in `docs/02-architecture/decisions.md`
- **Observability:** `docs/02-architecture/observability.md` (Pino, Sentry, PostHog, Prometheus/Grafana, PagerDuty/Slack, OTel future)
- **Scalability & capacity:** `docs/02-architecture/scalability.md` (bottlenecks, cache layers, BullMQ, Neon autoscaling, cost estimates)
- **Database migrations:** `docs/03-database/migrations.md` (Prisma Migrate flow per env, checklist, seeding)
- **AI architecture & providers:** `docs/05-ai/architecture.md`, `docs/05-ai/providers.md` (model router, fallback, env vars, rate limits, Caddy SSE config)
- **Security:** `docs/07-security/security.md` (rate limits, secrets, TLS, incident response); `docs/07-security/lgpd.md`
- **Product scope:** `docs/01-product/mvp.md` (MVP features, launch criteria, cost estimates); `docs/00-overview/vision.md`
- **Sprint 0 (infra base):** `docs/08-sprints/sprint-0.md` (planned monorepo/CI/Docker setup tasks)
- **Operational baselines:** `docs/environments.md` (env matrix), `docs/integrations.md` (contracts)