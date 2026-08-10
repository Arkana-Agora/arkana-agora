# Environments — Arkana Agora

> Canonical environment matrix and deployment context.
> **Status: documentation-only.** No environment is provisioned/running yet. Every value below is the **documented target** from `docs/02-architecture/deployment.md`; provider consoles are not yet configured. No AWS usage is documented anywhere in the SDD — providers are Vercel/Railway/Neon/Upstash/Cloudflare.

## Environment Matrix

| Environment | Purpose | URL | Database | Provider footprint |
|---|---|---|---|---|
| **Development** | Local development | `http://localhost:3000` | SQLite local (`file:./dev.db`) | Next.js :3000, Socket.io :3003, optional Caddy :80/443, local Redis/Postgres via Docker |
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

- **Dev**: `.env.local` with `DATABASE_URL=file:./dev.db`, `NEXTAUTH_SECRET=dev-...`, `MP_ACCESS_TOKEN=TEST-...`, `REDIS_URL=redis://localhost:6379`, empty `SENTRY_DSN`/`POSTHOG_KEY` (`docs/02-architecture/deployment.md` §2.4).
- **Staging**: Mercado Pago **sandbox** token, Upstash free tier, Vercel preview env vars.
- **Production**: live tokens, Neon prod `DATABASE_URL`, `JWT_PRIVATE_KEY`/`JWT_PUBLIC_KEY` (RS256), `MP_ACCESS_TOKEN`, `FCM_SERVER_KEY`, SMTP creds (`docs/07-security/security.md` §Variáveis de Ambiente Críticas).
- **Rule:** secrets only in provider consoles / secret manager, never in source control. `.env` and `.env*.local` gitignored; only `.env.example` committed. `.gitignore` enforced in CI (build fails if `.env` committed); secret scanner (`git-secrets`/`trufflehog`) on every PR.

## Deployment Differences

| Step | Development | Staging | Production |
|---|---|---|---|
| Schema sync | `bunx prisma db push` | `prisma migrate deploy` (CI) | `prisma migrate deploy` (CI, before deploy) |
| Deploy trigger | Local commands (`bun run dev`, `dev:ws`, `dev:all`) | PR to `main` → Vercel preview | Merge to `main` → Vercel `--prod` |
| Payment mode | Sandbox | Sandbox | Live |
| Rollback | Restart local process | Vercel instant rollback | Vercel rollback (<30s), `prisma migrate resolve --rolled-back`, `railway up --rollback` |
| CI checks | — | Lint → type-check → test (Postgres service) → build → preview | Same CI, then prod deploy |

Local stack also runs via Docker (`docker-compose.yml` with web, ws, postgres:16-alpine, redis:7-alpine, caddy) per `docs/02-architecture/deployment.md` §5.

## Operational Access

| Concern | Development | Staging | Production |
|---|---|---|---|
| Logs | Pino JSON stdout | Vercel/Railway logs | Vercel/Railway logs + Sentry |
| Errors | Console | Sentry (staging DSN) | Sentry release tracking |
| Metrics | None (or local Prometheus) | Prometheus `/api/metrics` | Prometheus → Grafana; Vercel Analytics (LCP < 2.5s, INP < 200ms, TTFB < 800ms); PostHog |
| Alerts | — | Slack | PagerDuty + Slack (warning → Slack 30 min; high → PagerDuty 15 min; critical → PagerDuty+Slack+SMS 5 min) |
| DB access | SQLite file | Neon console / staging branch | Neon console (prod), restricted |
| Deploy permissions | Any developer | Team (Vercel) | Restricted (Vercel Pro owners) + CI |
| Health check | `http://localhost:3000/api/health` | `https://staging.../api/health` | `https://arkanaagora.com.br/api/health` (DB/Redis/AI checks) |

**Known environmental constraints**
- Vercel serverless cold starts (~250ms) and invocation limits (1000/min hobby, 3000/min pro).
- WebSocket cannot run on Vercel → separate Railway Socket.io service (port 3003) (ADR-007).
- SSE streaming requires Caddy `flush_interval -1` and `X-Accel-Buffering: no` in proxy layers.
- Dev (SQLite) / prod (PostgreSQL) discrepancy: Postgres-only features (JSONB, PgBouncer) must be validated in CI against `postgres:16-alpine`.