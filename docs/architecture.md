# Architecture — Arkana Agora

> Canonical architecture reference for the **arkana-agora** project.
> Authoritative source of truth is the pt-BR SDD under `docs/`; this file is the English operational summary with concrete pointers to those pages.
> Last updated: 2026-08-12.

## Implementation status (read first)

- **Minimal skeleton implemented** at the repo root (first application code, per ADR-001/ADR-002): Next.js 16 (App Router) monolith with `bun` toolchain (`package.json`: dev, build, start, dev:ws, dev:all, lint, type-check, seed, test), strict `tsconfig.json` (`@/*` → `./src/*`), `eslint.config.mjs` (eslint-config-next flat), `vitest.config.ts` (tsconfig-paths), `src/app/` (layout.tsx pt-BR, page.tsx, error/loading/not-found, globals.css, `src/app/api/health/route.ts` — envelope `{status,timestamp,version,services:{database}}`, version from `src/lib/version.ts` (`APP_VERSION`), `database` probed via `SELECT 1` with a 5s timeout, top-level `status` derived from the check (`ok`/`degraded`), returns 200 when the DB check passes and 503 only on a hard DB failure, per `docs/02-architecture/observability.md` §6.3), `src/lib/prisma.ts` (Prisma singleton), `prisma/schema.prisma` (User stub + enums matching `docs/03-database/entities.md` §1), `prisma/seed.ts` (no-op), `tests/health.test.ts` (vitest), `.env.example` (names only), `.gitignore` (+`prisma/dev.db`). Dev DB: SQLite `file:./dev.db` via `bunx prisma db push`. Full tree: `docs/02-architecture/monorepo.md` §1.
- `backend/` and `frontend/` remain **empty placeholders** and are NOT part of the documented structure — the MVP is a single Next.js app at the repo root (aux services live in `services/` per `docs/02-architecture/deployment.md` §2.1).
- **No business logic exists yet.** Everything else in this document describes the **documented design** (SDD, ADRs, `.specs/`) — i.e. the **planned** architecture. Auth, payments, AI, SSE, social, and admin are not implemented.
- Items the docs themselves mark as future ("futuro", "planejado", "V1+") are additionally labeled **[planned]**.
- The docs target an MVP as a **modular monolith** (single Next.js app) with a documented evolution path to a **Turborepo monorepo with microservices** (ADR-005, `docs/02-architecture/monorepo.md`).

## System Overview

Arkana Agora is a Brazilian platform for Tarot, Lenormand (Baralho Cigano), numerology, Mayan/Chinese astrology and a vertical social network, with AI-driven readings in pt-BR (vision: `docs/00-overview/vision.md`). Business model is freemium: free tier + Arkana Plus subscription + marketplace for verified professionals (`docs/01-product/mvp.md`, `docs/07-security/permissions.md`).

**Planned topology** (from `docs/02-architecture/architecture.md` §1):

- **Clients**: Browser (Next.js web app), Mobile (Expo React Native) **[planned]**, Admin panel (Next.js) **[planned]**.
- **Edge**: Cloudflare CDN/DNS/WAF + Caddy as API gateway (SSL, rate limiting) — `docs/02-architecture/deployment.md`.
- **Application**: Next.js App Router app (port 3000) with API Routes; separate **Socket.io mini-service** (port 3003) for real-time; **AI Service** (port 3004) **[planned]**; **BullMQ Worker** (port 3005) **[planned]**.
- **Data layer**: PostgreSQL (Neon) via Prisma, Redis (Upstash) for sessions/cache, Cloudflare R2 for images — `docs/02-architecture/architecture.md` §1, `docs/02-architecture/deployment.md` §4.

**Boundaries**: the web app owns HTTP/SSE (REST CRUD + AI streaming); the Socket.io service owns bidirectional real-time (feed, notifications, presence); background jobs (daily horoscope, emails) are delegated to a future worker; payments are delegated to Mercado Pago via webhooks (ADR-008).

## Technology Stack

Except for the skeleton scaffolding (Next.js 16, Prisma, bun, vitest — see "Implementation status"), all entries are **documented design, not yet implemented**. Status column: **MVP** = documented target for the MVP monolith; **[planned]** = explicitly future in the docs.

| Technology | Role | Status | Source of truth |
|---|---|---|---|
| Next.js (App Router) | Web framework: SSR, RSC, API Routes, SSE streaming | MVP | ADR-001; `docs/02-architecture/architecture.md` §2.1 |
| Prisma ORM | Data access; SQLite (dev) / PostgreSQL (prod); migrations | MVP | ADR-002; `docs/03-database/*` |
| Zustand | Client-side state (UI, reading session, auth) | MVP | ADR-003; `.specs/003-tarot-engine/design.md` §7 |
| TanStack Query | Server-state cache, invalidation, mutations | MVP | ADR-003 |
| shadcn/ui (New York style) | Design system (Radix-based, copied into repo) | MVP | ADR-006; `docs/02-architecture/architecture.md` §3.1 |
| Tailwind CSS 4 | Utility-first styling | MVP | `docs/02-architecture/architecture.md` §3.1; `docs/00-overview/glossary.md` |
| Framer Motion | Card reveal/flip animations | MVP | `docs/02-architecture/architecture.md` §3.1; `.specs/003-tarot-engine/design.md` §8 |
| NextAuth.js v4 | Auth: JWT sessions, Google/Facebook OAuth, magic link | MVP | `docs/02-architecture/architecture.md` §8; `docs/04-api/authentication.md` |
| z-ai-web-dev-sdk + GPT-4o | AI interpretations, SSE streaming, model router (GPT-4o / GPT-4o-mini fallback) | MVP | `docs/05-ai/architecture.md`; `docs/05-ai/prompts.md` |
| Mercado Pago | Payments: PIX, credit card, boleto; split payment; PLUS subscription | MVP | ADR-008; `docs/04-api/marketplace.md` |
| SQLite → PostgreSQL (Neon) | Local dev DB → serverless prod DB | MVP | ADR-002; `docs/02-architecture/deployment.md` §1 |
| Redis (Upstash) | Sessions, cache, rate limiting, WS horizontal adapter | MVP | `docs/02-architecture/scalability.md` §3 |
| Cloudflare R2 | Card images, avatars, post images | MVP | `docs/02-architecture/architecture.md` §1; `docs/02-architecture/deployment.md` §4 |
| Socket.io (mini-service, :3003) | Real-time: feed, notifications, presence | MVP | ADR-007; `docs/02-architecture/architecture.md` §2.3 |
| Docker / docker-compose | Local full-stack stack (web, ws, postgres, redis, caddy) | MVP | `docs/02-architecture/deployment.md` §5 |
| Pino + Sentry + PostHog + Vercel Analytics | Logging, error tracking, analytics, Web Vitals | MVP | `docs/02-architecture/observability.md` |
| PWA (manifest, service worker, offline cache) | Installable mobile web app | **[planned]** (V1) | `docs/01-product/mvp.md` V1-009; `docs/00-overview/roadmap.md` |
| Turborepo + pnpm workspaces | Monorepo orchestration | **[planned]** (V1+) | ADR-005; `docs/02-architecture/monorepo.md` |
| BullMQ worker (:3005) | Background jobs (daily horoscope, emails) | **[planned]** | `docs/02-architecture/architecture.md` §2.3; `docs/02-architecture/scalability.md` §5 |
| Expo React Native | Mobile app sharing types/api-client | **[planned]** | `docs/02-architecture/architecture.md` §7 |
| OpenTelemetry | Distributed tracing | **[planned]** | `docs/02-architecture/observability.md` §8 |

## Module and Service Boundaries

### Web app (Next.js) — documented MVP structure

From `docs/02-architecture/architecture.md` §2.1 and `docs/02-architecture/monorepo.md` §1:

```
src/
├── app/            # App Router: (auth)/, (main)/, api/ route groups
├── components/     # ui/ (shadcn), cards/, social/, layout/
├── lib/            # prisma.ts, auth.ts (NextAuth v4), ai.ts, validators/ (Zod)
├── services/       # reading.service.ts, social.service.ts, payment.service.ts, ai.service.ts
├── stores/         # Zustand: reading.store.ts, ui.store.ts, user.store.ts
└── types/          # domain contracts
```

**API Routes** (RESTful, `docs/02-architecture/architecture.md` §2.2; versioned `/api/v1` per `docs/04-api/overview.md`): `/api/auth/*` (NextAuth), `/api/readings` CRUD, `/api/feed`, `/api/posts`, `/api/follows`, `/api/marketplace/products`, `/api/v1/payments/create`, `/api/v1/webhooks/mercadopago`. AI streaming route: `POST /api/v1/ai/reading/stream` (`docs/05-ai/architecture.md`).

### Mini-services (separate ports)

| Service | Port | Responsibility | Status |
|---|---|---|---|
| Socket.io service | 3003 | Real-time: feed updates, notifications, presence | MVP design (ADR-007) |
| AI Service | 3004 | Async AI reading processing | **[planned]** (`architecture.md` §2.3) |
| Worker (BullMQ) | 3005 | Background jobs: daily horoscope, emails | **[planned]** |

### Layered architecture

`docs/02-architecture/architecture.md` §3 defines four layers: **Presentation** (RSC + client components, Framer Motion, shadcn/ui, Tailwind 4), **Application** (API Routes as controllers, Zod validation, SSE, NextAuth v4), **Domain** (`src/services/` business rules, e.g. plan limits on spreads, arcano calculation), **Infrastructure** (Prisma, z-ai-web-dev-sdk, Mercado Pago SDK, Upstash Redis, Cloudflare R2).

### Design patterns (documented)

Repository (services depend on interfaces, not Prisma), Factory (`SpreadFactory` for spread generators), Strategy (`AIProvider` — swap GPT-4o without touching `ReadingInterpreter`), Observer (Event Bus), Singleton (Prisma client) — `docs/02-architecture/architecture.md` §4.

### Monorepo evolution **[planned]**

ADR-005 + `docs/02-architecture/monorepo.md`: `apps/` (web, mobile, admin), `packages/` (`@arkana/ui`, `@arkana/api-client`, `@arkana/types`, `@arkana/config`, `@arkana/utils`), `services/` (ai-service, ws-service, worker), Turborepo + pnpm workspaces, changesets versioning. Migration phases (Fase 0–4) are listed in `docs/02-architecture/monorepo.md` §5.

## Data and Request Flows

### Authentication flow

NextAuth.js v4 with JWT sessions (`docs/04-api/authentication.md`, `.specs/001-auth/design.md`): access token 15 min, refresh token 30 days (opaque, httpOnly cookie, rotation + reuse detection revokes the token family), magic link 15 min; bcrypt (12 rounds); 5 failed attempts → 15 min lockout. Providers: credentials, Google, Facebook. RBAC roles `USER → PROFESSIONAL → ADMIN` (implemented in `prisma/schema.prisma`) plus `SUPER_ADMIN` **[planned]**; plan tier (`UserPlan`: FREE/PLUS) is a separate dimension from role. Permission matrix enforced by middleware (`docs/07-security/permissions.md`).

### AI reading flow (SSE)

`docs/05-ai/architecture.md`: `POST /api/readings` (validate → shuffle via CSPRNG/Fisher-Yates → save cards) → `POST /api/v1/ai/reading/stream` (load reading+user → Prompt Engine → Model Router → z-ai-web-dev-sdk → GPT-4o stream → SSE chunks to client → save interpretation + tokens → cache 24h). Fallback chain: GPT-4o → GPT-4o-mini → generic cached interpretation → friendly error. Client consumes SSE into a Zustand reading store (`.specs/003-tarot-engine/design.md` §7).

### Real-time social flow

Socket.io on :3003 with events `feed:new_post`, `notification:new`, `presence:update`, `reading:shared`, `chat:message` **[planned]** (`architecture.md` §6.3). Inter-service communication via Event Bus: `user:registered`, `reading:created`, `payment:completed`, `post:liked` — EventEmitter in dev, Redis Pub/Sub in prod (§6.4).

### Payments flow

Mercado Pago (ADR-008): `POST /api/v1/payments/create` → checkout (PIX/card/boleto) → webhook `POST /api/v1/webhooks/mercadopago` (API-key authenticated) → order/payment status update; native split payment (platform commission); PLUS subscription via recurring billing. Entities: `Product`, `Order`, `Payment`, `Subscription` (`docs/03-database/entities.md`).

### Data layer

18 entities across 5 domains (Auth & User, Readings & Tarot, Social, Marketplace, System) — `docs/03-database/erd.md`, `docs/03-database/relationships.md` (1:1, 1:N, N:M via `Follow` junction; cascade matrix). DB: SQLite in dev, Neon PostgreSQL in prod via Prisma (ADR-002). Cache layers: L1 client (Zustand/in-memory) → L2 Redis (sessions, feed, rate limit, AI interpretation cache 24h) → L3 CDN (card images, static assets) — `docs/02-architecture/scalability.md` §3. API conventions: `/api/v1` versioning, JWT bearer, standardized error envelope, cursor/offset pagination, per-plan rate limits (`docs/04-api/overview.md`).

## Architecture Invariants

These are documented decisions that must not be broken without a new ADR:

1. **AI streaming uses SSE, not WebSocket** — unidirectional server→client is sufficient; native reconnection (ADR-004).
2. **Socket.io is a separate mini-service on :3003**, communicating via Event Bus — never embedded in the Next.js app (ADR-007).
3. **Prisma is the only ORM**; schema lives in `prisma/schema.prisma`; SQLite in dev, PostgreSQL in prod (ADR-002). Schema changes require the documented migration discipline (`docs/03-database/migrations.md`).
4. **State split is fixed**: Zustand for client state, TanStack Query for server state (ADR-003).
5. **shadcn/ui (New York) is the design-system base** (ADR-006); **Tailwind CSS 4** for styling.
6. **Mercado Pago is the payment gateway** (ADR-008).
7. **Every API input is validated with Zod**; **RBAC middleware** enforces the permission matrix; **rate limits** are per-role (`docs/07-security/security.md`, `docs/07-security/permissions.md`).
8. **Repository pattern**: services depend on interfaces, never on Prisma directly (`architecture.md` §4.1).
9. **No secrets in code** — env vars only, `.env` gitignored, secret scanning in CI (`docs/07-security/security.md` §Gestão de Segredos).
10. **API is versioned via `/api/v1`**; deprecated versions kept 6 months with `Deprecation`/`Sunset` headers (`docs/04-api/overview.md`).
11. **Docs-first governance** (per `AGENTS.md`): never implement requirements that are not documented; always update documentation after implementation; never alter an ADR without authorization; never skip tests.

### Safe-change guidance

- Before any implementation, load the baseline: `docs/`, `.specs/`, ADRs (`docs/02-architecture/decisions.md`).
- Changing a documented invariant (SSE, Socket.io separation, ORM, state split, payment gateway) requires a new ADR first.
- Adding a service or port must be reflected in `docs/02-architecture/monorepo.md` and `docs/02-architecture/deployment.md`.
- DB schema changes: follow the Prisma migration chain (`docs/03-database/migrations.md`); keep SQLite/PostgreSQL parity (ADR-002).
- Deploy changes: follow `docs/02-architecture/deployment.md` (Vercel web, Railway WS, Neon, Upstash, Cloudflare) — never deploy via IAC per project convention.
- Keep "implemented" vs "planned" separation in this file accurate as code lands in `src/` (MVP monolith at repo root); `backend/`/`frontend/` stay placeholders and are not part of the documented structure.