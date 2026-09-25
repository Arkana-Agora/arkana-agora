# Environments — Arkana Agora

> Canonical environment matrix and deployment context.
> **Status: skeleton + F1 (DB/Docker) + Prisma Postgres local link (2026-09-23).** Local runtime uses **Prisma Postgres** via Vercel Marketplace (`pooled.db.prisma.io` for the client, `db.prisma.io` for the Prisma CLI) — Docker Postgres 16 remains available as offline fallback. Prisma CLI is pinned to **`prisma@^7`** (do **not** install `prisma@8` — v8 RC removes `generate`/`migrate` and breaks `npm run build`). Connection URL lives in `prisma.config.ts` (not `schema.prisma`); `prisma postgres link` writes `DATABASE_URL` (direct) — keep runtime `DATABASE_URL` on the **pooled** host and `DIRECT_URL` on the **direct** host for CLI. `.env.example` lists all documented var names (no secrets). No AWS usage is documented anywhere in the SDD — providers are Vercel/Railway/Prisma Postgres/Neon/Upstash/Cloudflare.

## Environment Matrix

| Environment | Purpose | URL | Database | Provider footprint |
|---|---|---|---|---|
| **Development** | Local development | `http://localhost:3000` | **Prisma Postgres** (Vercel Marketplace, pooled `DATABASE_URL` + direct `DIRECT_URL`); Docker Postgres 16 (`arkana`, localhost:5432) as offline fallback | `prisma@^7` + `prisma.config.ts`; `prisma postgres link` already run; Next.js :3000; Socket.io :3003 + Caddy planejados (Sprint 1 chat) |
| **Staging** | Tests and QA | `staging.arkanaagora.com.br` | Neon PostgreSQL (staging branch) | Vercel previews, Railway WS, Upstash free tier, Mercado Pago sandbox |
| **Production** | Production | `arkanaagora.com.br` | Neon PostgreSQL (prod) | Vercel Pro, Railway WS (+ future worker), Upstash, Cloudflare CDN/WAF, Mercado Pago live, Sentry, PostHog |

**Domains (documented, planejado):**

```
arkanaagora.com.br        → Vercel (web app)
api.arkanaagora.com.br    → Vercel (API routes, alias of same deploy)
ws.arkanaagora.com.br     → Railway (Socket.io)
assets.arkanaagora.com.br → Cloudflare R2 (images)
```

**API base URLs** (`docs/04-api/overview.md`):

```
Production        https://arkanaagora.com.br/api/v1
Staging           https://staging.arkanaagora.com.br/api/v1
Development       http://localhost:3000/api/v1
```

## Configuration and Secrets Boundaries

- **Dev**: `.env` (Prisma CLI and `bun` scripts load `.env`, not `.env.local`) with **Prisma Postgres**: `DATABASE_URL=postgres://…@pooled.db.prisma.io:5432/postgres?sslmode=require` (runtime, via `@prisma/adapter-pg` in `src/lib/prisma.ts`) and `DIRECT_URL=postgres://…@db.prisma.io:5432/postgres?sslmode=require` (Prisma CLI / `prisma.config.ts` only — never use the pooled host for `migrate`). Docker fallback: `DATABASE_URL=postgresql://arkana:arkana@localhost:5432/arkana` (leave `DIRECT_URL` empty). Also `AUTH_URL=http://localhost:3000`, `AUTH_SECRET=dev-...`, `AUTH_TRUST_HOST=true`, `AUTH_GOOGLE_ID=dev-...`, `AUTH_GOOGLE_SECRET=dev-...` (Auth.js v5, ADR-010 — not `NEXTAUTH_*`/`GOOGLE_CLIENT_*`), `JWT_PRIVATE_KEY` **e** `JWT_PUBLIC_KEY` (par RSA 2048, blocos PEM multiline — **ambos** obrigatórios; ausência da pública rejeita todos os tokens como 401, ver `docs/runbooks/jwt-public-key-missing-all-401.md`), `MP_ACCESS_TOKEN=TEST-...`, `REDIS_URL=redis://localhost:6379`, empty `SENTRY_DSN`/`NEXT_PUBLIC_SENTRY_DSN` (Sentry desabilitado sem DSN), `LOG_LEVEL=info` (`docs/02-architecture/deployment.md` §2.4). PostHog: `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN`/`NEXT_PUBLIC_POSTHOG_HOST` podem ficar vazios em dev — `initAnalytics()` (`src/lib/analytics.ts`) faz no-op quando `NODE_ENV === "development"` (antes do check de key), então dev nunca carrega o SDK.
- **Staging**: Mercado Pago **sandbox** token, Upstash free tier, Vercel preview env vars.
- **Production**: live tokens, Neon prod `DATABASE_URL`, `JWT_PRIVATE_KEY`/`JWT_PUBLIC_KEY` (RS256), `MP_ACCESS_TOKEN`, `FCM_SERVER_KEY`, SMTP creds (`docs/07-security/security.md` §Variáveis de Ambiente Críticas), `CRON_SECRET` (Vercel Cron — protege `GET /api/cron/hard-delete`, obrigatório para agendamento).
- **Rule:** secrets only in provider consoles / secret manager, never in source control. `.env` and `.env*.local` gitignored; only `.env.example` committed. `.gitignore` enforced in CI (build fails if `.env` committed); secret scanner (`git-secrets`/`trufflehog`) on every PR.

## Deployment Differences

| Step | Development | Staging | Production |
|---|---|---|---|
| Schema sync | Prisma Postgres via `prisma migrate dev` (uses `DIRECT_URL` from `prisma.config.ts`); Docker fallback: `docker compose up -d postgres` + `bunx prisma migrate dev` | `prisma migrate deploy` (CI) | `prisma migrate deploy` (CI, before deploy) |
| Deploy trigger | Local commands (`bun run dev`, `dev:ws`, `dev:all`) | PR to `main` → Vercel preview | Merge to `main` → Vercel `--prod` |
| Payment mode | Sandbox | Sandbox | Live |
| Rollback | Restart local process | Vercel instant rollback | Vercel rollback (<30s), `prisma migrate resolve --rolled-back`, `railway up --rollback` |
| CI checks | — | Lint → type-check → test (Postgres service) → build → preview | Same CI, then prod deploy |

Local stack runs via Docker (`docker-compose.yml` with postgres:16-alpine, redis:7-alpine, migrate, web — no `version:` key; ws/caddy deferred to Sprint 1 chat) per `docs/02-architecture/deployment.md` §5.

## Operational Access

| Concern | Development | Staging | Production |
|---|---|---|---|
| Logs | Pino JSON stdout | Vercel/Railway logs | Vercel/Railway logs + Sentry |
| Errors | Console | Sentry (staging DSN) | Sentry release tracking |
| Metrics | None (or local Prometheus) | Prometheus `/api/metrics` | Prometheus → Grafana; Vercel Analytics (LCP < 2.5s, INP < 200ms, TTFB < 800ms); PostHog |
| Alerts | — | Slack | PagerDuty + Slack (warning → Slack 30 min; high → PagerDuty 15 min; critical → PagerDuty+Slack+SMS 5 min) |
| DB access | Prisma Postgres console (Vercel Storage) / local `prisma postgres link`; Docker Postgres 16 (localhost:5432) fallback | Neon console / staging branch | Neon console (prod), restricted |
| Deploy permissions | Any developer | Team (Vercel) | Restricted (Vercel Pro owners) + CI |
| Health check | `http://localhost:3000/api/health` | `https://staging.../api/health` | `https://arkanaagora.com.br/api/health` (DB probed; redis probe ativa quando `REDIS_URL` configurada — sem ela reporta `not-configured`, neutro; IA ainda fora do envelope; per `observability.md` §6.3) |

**Known environmental constraints**
- **Prisma CLI must stay on v7** (`prisma@^7` in `package.json`): `prisma@8` RC has no `generate`/`migrate` commands — `npm run build` fails with `CLI.UNKNOWN_COMMAND`. Pin explicitly; never run bare `npx prisma@latest` in this repo.
- **Pooled vs direct hosts**: runtime client (`src/lib/prisma.ts` → `PrismaPg`) uses `DATABASE_URL` (`pooled.db.prisma.io`); Prisma CLI (`prisma.config.ts`) uses `DIRECT_URL` (`db.prisma.io`). `prisma postgres link --force` overwrites `DATABASE_URL` with the **direct** host — restore the pooled host after re-linking.
- Windows: a leftover corrupted `node_modules/.bin/prisma.exe` (from a prior bun/v8 install) shadows the correct shim and makes `npm run build` look for `dist/prisma.js`. Delete `prisma.exe`/`prisma.bunx` from `node_modules/.bin` if that error appears.
- **Build heap flag (local + CI + Vercel)**: `npm run build` / `bun run build` use `node --max-old-space-size=4096` (PostCSS/Turbopack zone OOM under low free RAM — keep **>1 GB free** before building; flag is not a free-RAM substitute; see `docs/solutions/ci-cd/turbopack-postcss-oom.md`). Production runtime still requires non-empty `https://` `AUTH_URL` (guard in `src/auth/auth.config.ts`; runbook `docs/runbooks/vercel-deploy-auth-url.md`).
- Vercel serverless cold starts (~250ms) and invocation limits (1000/min hobby, 3000/min pro).
- **JWT keypair is required together (dev and prod)**: `verifyAccessToken` treats a missing/unparsable `JWT_PUBLIC_KEY` as a server config fault (HTTP 500 `AUTH_CONFIG_INVALID_PUBLIC_KEY` since 2026-09-24) — but before that fix the absence made EVERY token 401 in an endless refresh loop. Both `JWT_PRIVATE_KEY`/`JWT_PUBLIC_KEY` must be set per environment and rotated in the same deploy (90-day rotation); keep the multiline PEM form (quoted block in `.env.local` works under bun). Runbook: `docs/runbooks/jwt-public-key-missing-all-401.md`.
- WebSocket cannot run on Vercel → separate Railway Socket.io service (port 3003) (ADR-007).
- SSE streaming requires Caddy `flush_interval -1` and `X-Accel-Buffering: no` in proxy layers.
- Dev/prod parity: Prisma Postgres and Neon are both PostgreSQL; residual Neon-only features (PgBouncer pooling, `pg_stat_statements`) are validated in CI against `postgres:16-alpine`.