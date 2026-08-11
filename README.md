# Arkana Agora

Arkana Agora is a Brazilian platform for Tarot, Lenormand (Baralho Cigano), numerology and astrology with AI-driven readings and a vertical social network. The repo holds the full **Software Design Document (SDD)** plus a **minimal Next.js 16 skeleton** at the root (the first application code); all business features are still **planned**.

> Tagline: *"Onde a intuição encontra a tecnologia."*

## Overview

The platform combines esoteric reading tools (Tarot, Lenormand, numerology, Mayan/Chinese astrology, daily horoscope) with AI-generated interpretations in pt-BR and a vertical social network. The business model is freemium: a free tier, the **Arkana Plus** subscription, and a marketplace for verified professionals. The documented MVP target is a **modular monolith** (single Next.js app) with a planned evolution path to a **Turborepo monorepo with microservices** (ADR-005).

## Current Status

- **Minimal skeleton implemented** at the repo root: a Next.js 16 (App Router) modular-monolith app per ADR-001/ADR-002 — `bun` toolchain (`package.json`), `src/app/` (layout/page/error/loading/not-found + `src/app/api/health/route.ts`), `src/lib/prisma.ts` (Prisma singleton), `prisma/schema.prisma` (`User` stub matching `docs/03-database/entities.md` §1), `prisma/seed.ts`, `tests/health.test.ts` (vitest), `.env.example` (var names only, no secrets). Dev DB: SQLite `file:./dev.db` via `bunx prisma db push`. Full tree: `docs/02-architecture/monorepo.md` §1.
- **No business logic yet.** Auth, payments, AI, SSE, social, and admin are still **planned** — everything in `docs/` and `.specs/` describes the **documented design** (SDD, ADRs, specs). Nothing is provisioned or deployed; `/api/health` returns 503 until DB/Redis/AI are configured.
- `backend/` and `frontend/` remain **empty placeholders** and are NOT part of the documented structure — the MVP is a single Next.js app at the repo root (aux services live in `services/` per `docs/02-architecture/deployment.md` §2.1).
- **No AWS usage is documented.** Planned providers are fully managed SaaS: Vercel, Railway, Neon, Upstash, Cloudflare (CDN/WAF **and** R2 storage — not AWS S3), OpenAI, Mercado Pago, Sentry, PostHog.
- **Tooling rule (resolved):** **`bun`** for the MVP single app; **`pnpm`** for the planned Turborepo monorepo (ADR-005). Storage = **Cloudflare R2** (env vars `R2_*`; no AWS S3). Canonical rules in `docs/02-architecture/deployment.md` §2.0 and `docs/glossary.md`.

## Repository Layout

```
.
├── src/              # Next.js 16 monolith (MVP): app/ (App Router + API), lib/, services/, stores/, types/
├── prisma/           # schema.prisma (User stub) + seed.ts
├── tests/            # vitest (tests/health.test.ts)
├── public/           # static assets (empty)
├── package.json      # bun toolchain: dev, build, lint, type-check, test, seed
├── next.config.ts    # reactStrictMode
├── tsconfig.json     # strict; paths @/* → ./src/*
├── eslint.config.mjs # eslint-config-next (flat)
├── vitest.config.ts  # tsconfig-paths
├── .env.example      # documented env var names (no secrets)
├── backend/          # EMPTY placeholder — NOT part of the documented structure (no code yet)
├── frontend/         # EMPTY placeholder — NOT part of the documented structure (no code yet)
├── docs/             # Software Design Document (SDD) — source of truth
├── .specs/           # Per-module implementation specs (001–010)
└── AGENTS.md         # Project governance rules (read before implementing)
```

## Documentation Map

### SDD sections (`docs/`)

| Section | Contents |
|---|---|
| `00-overview/` | Vision, personas, glossary, roadmap, project conventions |
| `01-product/` | Requirements, business rules, user stories, use cases, MVP scope |
| `02-architecture/` | Architecture, deployment, monorepo, scalability, observability, ADRs (`decisions.md`) |
| `03-database/` | ERD, entities, relationships, indexing, migrations |
| `04-api/` | API overview, authentication, tarot, social, marketplace, users, AI, admin |
| `05-ai/` | AI architecture, providers, prompts, moderation, costs |
| `06-features/` | Per-feature docs (tarot, lenormand, profile, social, marketplace, payments, etc.) |
| `07-security/` | Security, permissions (RBAC), LGPD |
| `08-sprints/` | Sprints 0–3, backlog, milestones |

### Canonical foundation docs (English operational summaries)

| Doc | Purpose |
|---|---|
| `docs/architecture.md` | Architecture reference: topology, tech stack, invariants, safe-change guidance |
| `docs/infrastructure.md` | Target infrastructure: providers, environments, deployment, constraints, risks |
| `docs/integrations.md` | External systems and contracts catalog (OpenAI, Mercado Pago, OAuth, etc.) |
| `docs/environments.md` | Environment matrix (dev/staging/prod), domains, secrets boundaries |
| `docs/glossary.md` | Domain and technical terms, disambiguation, naming conventions |

### Workflow-managed directories (`docs/`)

`brainstorms/`, `plans/`, `work-plans/`, `solutions/`, `modules/`, `features/`, `lambdas/`, `runbooks/`, `decisions/`, `workflow/` — mostly empty templates (`.gitkeep`/README stubs) managed by the project workflow. `docs/runbooks/` and `docs/lambdas/` are empty indexes; no runbooks or Lambda definitions exist yet.

### Module specs (`.specs/`)

`001-auth`, `002-profile`, `003-tarot-engine`, `004-ai-readings`, `005-arcana-personal`, `006-horoscopes`, `007-social`, `008-marketplace`, `009-payments`, `010-admin` — each contains `design.md`, `requirements.md`, and `tasks.md`.

## Tech Stack Snapshot

All entries are **documented design, not yet implemented**, except the bare skeleton: Next.js 16, Prisma, bun, and vitest exist as scaffolding only (see Current Status) — no feature logic (auth, AI, payments, social) is implemented. (MVP = MVP target; **[planned]** = explicitly future).

| Technology | Role | Status |
|---|---|---|
| Next.js (App Router) | Web framework: SSR, RSC, API Routes, SSE streaming | MVP |
| Prisma ORM | Data access; SQLite (dev) / PostgreSQL-Neon (prod); migrations | MVP |
| NextAuth.js v4 | Auth: JWT sessions, Google/Facebook OAuth, magic link | MVP |
| z-ai-web-dev-sdk + GPT-4o | AI interpretations, SSE streaming, model router (GPT-4o-mini fallback) | MVP |
| Mercado Pago | Payments: PIX, card, boleto; split payment; Arkana Plus subscription | MVP |
| Zustand | Client-side state (UI, reading session, auth) | MVP |
| TanStack Query | Server-state cache, invalidation, mutations | MVP |
| shadcn/ui (New York) + Tailwind CSS 4 | Design system and styling | MVP |
| Framer Motion | Card reveal/flip animations | MVP |
| SQLite → PostgreSQL (Neon) | Local dev DB → serverless prod DB | MVP |
| Redis (Upstash) | Sessions, cache, rate limiting, WS adapter, BullMQ queues | MVP |
| Cloudflare (CDN/DNS/WAF + R2) | Edge, object storage (card images, uploads) | MVP |
| Socket.io mini-service (:3003) | Real-time: feed, notifications, presence | MVP |
| Docker / docker-compose | Local full-stack stack (web, ws, postgres, redis, caddy) | MVP |
| Pino + Sentry + PostHog + Vercel Analytics | Logging, error tracking, analytics | MVP |
| Turborepo + pnpm workspaces | Monorepo orchestration | **[planned]** (V1+) |
| BullMQ worker (:3005) | Background jobs (daily horoscope, emails) | **[planned]** |
| Expo React Native | Mobile app | **[planned]** |

## Getting Started

A minimal skeleton is runnable (see Current Status); all feature work is still **planned**. Start by reading the SDD:

1. `docs/00-overview/README.md` — project overview and conventions (pt-BR).
2. `docs/architecture.md` — architecture reference and invariants (English).
3. `docs/infrastructure.md` — target infrastructure and constraints (English).
4. `docs/environments.md` — environment matrix and domains (English).
5. `docs/02-architecture/deployment.md` — deployment plan (pt-BR, planned; no pipeline exists yet).

Local skeleton commands (repo root, `bun`): `bun install` → `bunx prisma db push` (creates `prisma/dev.db` from the `User` stub) → `bun run dev` (:3000). Checks: `bun run lint`, `bun run type-check`, `bun test` (vitest). `/api/health` returns 503 until DB/Redis/AI are configured (`src/app/api/health/route.ts`).

Before any implementation work, load the mandatory baseline per `AGENTS.md`: `docs/`, `.specs/`, and the ADRs in `docs/02-architecture/decisions.md`. Never implement requirements that are not documented.

### Starting backend & frontend (concise)

The documented architecture is a **Next.js modular monolith** — backend and frontend live in the same app at MVP; mini-services live in `services/`. Full bootstrap table: `docs/02-architecture/deployment.md` §2.1.

| Part | Framework | Runs on | Start |
|---|---|---|---|
| Frontend web | Next.js 16 (App Router), shadcn/ui, Tailwind 4 | `apps/web` (monorepo) / app root (MVP) | `bun run dev` (:3000) |
| Backend API | Next.js API Routes + Prisma + NextAuth v4 + Zod | `src/app/api/v1/*` (same app) | served by the same app |
| Backend WS | Node.js + Socket.io | `services/ws-service` | `bun run dev:ws` (:3003) |
| Backend IA / Worker (future) | Node.js (+ BullMQ) | `services/ai-service`, `services/worker` | — |

Toolchain: **`bun`** for MVP; **`pnpm`** for the planned monorepo (ADR-005). Storage: **Cloudflare R2** (`R2_*` env vars).

## Conventions

- **Marca:** Arkana Agora — **Identificador técnico:** `arkana-agora` — **Idioma principal:** pt-BR — **Versão do documento:** 1.0.0.
- **Docs-first governance (`AGENTS.md`):** never implement undocumented requirements; always update documentation after implementation; never alter an ADR without authorization; never skip tests.
- **Language:** project docs are primarily pt-BR; the canonical foundation docs (`architecture.md`, `infrastructure.md`, `integrations.md`, `environments.md`, `glossary.md`) are in English.
- **Secrets:** never commit secrets; `.env`/`.env*.local` are gitignored; only `.env.example` is committed.
- **API:** versioned via `/api/v1`; deprecated versions kept 6 months with `Deprecation`/`Sunset` headers.
- **Migrations:** named `YYYYMMDDHHMMSS_descriptive_name`; never edit an applied migration — create a new one.
- **Deployment:** follow `docs/02-architecture/deployment.md`; never deploy via IaC per project convention.
- **Architecture invariants** (from `docs/architecture.md`): AI streaming uses SSE (not WebSocket, ADR-004); Socket.io is a separate mini-service on :3003 (ADR-007); Prisma is the only ORM (ADR-002); Zustand for client state, TanStack Query for server state (ADR-003); Mercado Pago is the payment gateway (ADR-008). Breaking an invariant requires a new ADR first.

## Contributing

Follow the rules in `AGENTS.md` and the workflow skills in `.opencode/skills/`. Keep the "implemented vs. planned" separation accurate in `docs/architecture.md` as code lands in `src/` (MVP monolith at repo root; `backend/`/`frontend/` stay placeholders).