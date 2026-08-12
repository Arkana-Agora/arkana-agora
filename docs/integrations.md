# Integrations — Arkana Agora

> Canonical catalog of the external systems and contracts Arkana Agora depends on.
> **Status: no integration code yet.** The repo's skeleton (Next.js 16 at root) has no integration wiring — no OpenAI, Mercado Pago, OAuth, SMTP, Redis, or R2 code exists; all entries below are the **documented design** (referenced to the pt-BR SDD). Secondary source of truth for each is listed in the "Contract" column.

## Integration Catalog

| Integration | Type | Purpose | Provider | Contract source |
|---|---|---|---|---|
| OpenAI GPT-4o / GPT-4o-mini | External (AI) | AI interpretations (tarot/cards/horoscope), streaming via SSE | OpenAI (via `z-ai-web-dev-sdk`) | `docs/05-ai/providers.md`, `docs/05-ai/architecture.md`, `docs/05-ai/prompts.md` |
| Mercado Pago | External (payments) | Checkout (PIX/card/boleto), subscriptions (Arkana Plus), split payments, webhooks | Mercado Pago | `docs/04-api/marketplace.md`, ADR-008 |
| Google OAuth | External (auth) | Social login via NextAuth `/api/auth/*` (provider `google`) | Google | `docs/04-api/authentication.md` |
| Facebook OAuth | External (auth) | Social login via NextAuth `/api/auth/*` (provider `facebook`) | Meta | `docs/04-api/authentication.md` |
| SMTP / email | External | Magic-link login (15 min TTL), password reset (1h TTL) | Unspecified SMTP provider | `docs/04-api/authentication.md`, `docs/07-security/security.md` |
| Neon PostgreSQL | External (data) | Serverless production database (staging branch + prod) | Neon | `docs/02-architecture/deployment.md`, `docs/03-database/*` |
| Upstash Redis | External (data) | Sessions, rate limiting, cache (AI interpretation 24h TTL), BullMQ queues, Pub/Sub event bus | Upstash | `docs/02-architecture/scalability.md` |
| Cloudflare R2 | External (storage) | Card images (WebP, 3 variants), avatars, post images | Cloudflare | `docs/02-architecture/deployment.md` §4 |
| Cloudflare CDN/DNS/WAF | External (edge) | Caching, SSL Full (Strict), WAF, DNS + domains | Cloudflare | `docs/02-architecture/deployment.md` §4.3 |
| Vercel | External (hosting) | Web app, SSR, API routes, SSE (serverless) | Vercel | `docs/02-architecture/deployment.md`, ADR-001 |
| Railway | External (hosting) | Socket.io mini-service (:3003); future BullMQ worker (:3005) | Railway | `docs/02-architecture/architecture.md`, `docs/02-architecture/deployment.md` |
| Sentry | External (observability) | Client + server error tracking, tracing (10% sample) | Sentry | `docs/02-architecture/observability.md` |
| PostHog | External (analytics) | Product events, funnels, cohorts, feature flags | PostHog | `docs/02-architecture/observability.md` |
| PagerDuty + Slack | External (alerting) | Escalation routes and alerts | PagerDuty, Slack | `docs/02-architecture/observability.md`, `docs/05-ai/providers.md` |

## Authentication and Access

| Integration | Auth model | Credentials location |
|---|---|---|
| OpenAI | API key (`AI_PRIMARY_API_KEY`, `AI_FALLBACK_API_KEY`) | Env var, provider console |
| Mercado Pago | `MP_ACCESS_TOKEN` (access token; sandbox `TEST-` prefix in staging) | Env var, provider console |
| Google / Facebook OAuth | Client ID + Client Secret (NextAuth.js v4) | Env var |
| SMTP | `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS` | Env var / secret manager |
| Neon | `DATABASE_URL` (staging/prod: connection string with password) | Env var / secret manager |
| Upstash | `REDIS_URL` (with token) | Env var |
| Cloudflare R2 | R2 credentials (S3-compatible) | Env var / secret manager |
| Vercel / Railway | Platform tokens/CLI auth | Provider console/CI secrets |
| Sentry / PostHog | `SENTRY_DSN`, `POSTHOG_KEY` | Env var |

**Rule:** no secrets in source control. `.env`/`.env*.local` gitignored; only `.env.example` committed (`docs/07-security/security.md` §Gestão de Segredos).

**Inbound webhook auth:** Mercado Pago webhook (`POST /api/v1/webhooks/mercadopago`) is authenticated with an **API key** (`X-API-Key` header) per `docs/04-api/overview.md`. Internal service-to-service calls (WebSocket) use `X-Internal-Token`; standard API calls use `Authorization: Bearer <JWT>`.

## Contracts and Data Flows

- **API**: REST + SSE, base URL `/api/v1`, JWT bearer sessions (NextAuth v4). Standard error envelope, cursor/offset pagination, per-plan rate limits. See `docs/04-api/overview.md` (OpenAPI 3.1.0 template embedded).
- **Auth**: `POST /api/v1/auth/register|login|magic-link|magic-link/verify|refresh|logout|forgot-password|reset-password`, `GET /api/v1/auth/me`. OAuth (Google/Facebook) via NextAuth `/api/auth/*`. Access token 15 min, refresh token 30 days (opaque), magic link 15 min. See `docs/04-api/authentication.md`.
- **AI streaming (SSE)**: `POST /api/v1/ai/reading/stream` → `Content-Type: text/event-stream` with `{type: content|done}` payloads and `tokensUsed`. Fallback chain GPT-4o → GPT-4o-mini → generic cache → friendly error. See `docs/05-ai/architecture.md`, `docs/04-api/overview.md`.
- **Payments**: `POST /api/v1/payments/create` → Mercado Pago checkout → webhook `POST /api/v1/webhooks/mercadopago` → order/payment status update; native split payment; PLUS subscription via recurring billing. Entities `Product`, `Order`, `Payment`, `Subscription` (`docs/03-database/entities.md`).
- **Real-time (Socket.io :3003)**: events `feed:new_post`, `notification:new`, `presence:update`, `reading:shared`, `chat:message` [planned]. Inter-service event bus: `user:registered`, `reading:created`, `payment:completed`, `post:liked` (EventEmitter dev / Redis Pub/Sub prod). See `docs/02-architecture/architecture.md` §6.
- **Image storage**: R2 with WebP variants (3 sizes per card); served via `assets.arkanaagora.com.br`.
- **Async jobs [planned]**: BullMQ worker (:3005) for daily horoscope, email notifications, image processing.

## Failure Modes and Retries

| Integration | Failure mode | Handling (documented) |
|---|---|---|
| OpenAI | Rate limit / outage (500 RPM, 200K TPM Tier 1) | Auto-fallback to GPT-4o-mini → cached generic interpretation → friendly error (`docs/05-ai/providers.md`); alert "Provider Down" if error rate > 10%. Timeouts: request 30s, stream 60s |
| Mercado Pago | Webhook delivery unreliable / missing | Webhook retry; order/payment idempotency by order reference; status reconciliation via order lookup |
| Redis | Outage | Cache disabled (cost increases), alert "Cache Down"; sessions/logic degrade to fallback paths |
| Neon | Availability / migration lock | Point-in-time recovery; migrations window 02:00–05:00 BRT; no table locks > 5s |
| SMTP | Delivery failure (magic link/reset) | Rate-limited (3 magic links/h); silent 200 response to avoid enumeration |
| OAuth providers | Token invalid/expired | `AUTH_SOCIAL_TOKEN_INVALID` → client re-auth with provider |

## Ownership

- **Platform/team owns**: all application code, each integration's usage layer (services, SDK wrappers), env/secret management, contract adherence in `docs/04-api/*` and `docs/05-ai/*`, and monitoring/alert rules.
- **Third parties own**: the external service behavior, SLAs, and credentials lifecycle outside the platform's repository (`Azure`/provider consoles).
- Changes to an integration contract require updating this file plus the corresponding `docs/04-api/*` and `docs/05-ai/*` docs, and — for architectural decisions — a new ADR (see `docs/02-architecture/decisions.md`).
- No integration exists at runtime yet; every row above is **planned** per the SDD.