# Glossary — Arkana Agora

> **Consolidated glossary:** The authoritative, detailed pt-BR glossary lives in `docs/00-overview/glossary.md`. This file is the operational summary with disambiguation and naming conventions, linking to where terms are applied.

## Domain Terms

| Term | Definition | Applied in |
|---|---|---|
| Tiragem / Consulta | A card reading session; the core unit of the platform | `docs/04-api/tarot.md`, `docs/03-database/entities.md` |
| Espalhamento (Spread) | Layout pattern defining card positions and meanings | `docs/06-features/tarot.md`, `.specs/003-tarot-engine/` |
| Arcano Pessoal | Personal Major Arcana derived from Pythagorean numerology (Destiny Number mapped to 0–21) | `docs/06-features/profile.md`, `docs/06-features/tarot.md` |
| Kin Maya | Day order in the 260-day Tzolkin cycle (Selo Solar + Tom Galáctico); part of profile identity | `docs/06-features/tarot-daily.md`, `docs/00-overview/glossary.md` |
| Verso | Shareable content unit (reading, calculation, reflective text) on the social feed | `docs/06-features/social.md` |
| Baralho Cigano (Lenormand) | 36-card oracle system, popular in Brazil | `docs/06-features/lenormand.md` |
| Arkana Plus | Premium freemium subscription plan (unlimited AI readings, exclusive perks) | `docs/06-features/payments.md`, `docs/01-product/mvp.md` |
| Tarot do Dia | Daily automatic single-card reading, free for all users | `docs/06-features/tarot-daily.md` |
| Profissional / Profissional verificado | Verified user offering services/products in the marketplace | `docs/06-features/professionals.md`, `docs/07-security/permissions.md` |
| Marketplace | Space for professionals to offer reading services, consulting, and esoteric products | `docs/06-features/marketplace.md`, `docs/04-api/marketplace.md` |

For full definitions (Arcanos Maiores/Menores, numerologia pitagórica, Tzolkin terms, zodiac chines, horóscopo ocidental), see `docs/00-overview/glossary.md`.

## Technical Terms and Acronyms

| Term | Definition | Applied in |
|---|---|---|
| SSE (Server-Sent Events) | One-way server→client streaming used for AI interpretations (note: not WebSocket; ADR-004) | `docs/05-ai/architecture.md`, `docs/04-api/overview.md` |
| RBAC | Role-Based Access Control; roles `USER → PROFESSIONAL → ADMIN` (+ `SUPER_ADMIN` planned), implemented in `prisma/schema.prisma`; plan tier (`UserPlan`: FREE/PLUS) is a separate dimension | `docs/07-security/permissions.md` |
| PWA | Progressive Web App (manifest, service worker, offline cache) — planned V1 | `docs/01-product/mvp.md` |
| LGPD | Lei Geral de Proteção de Dados (Lei 13.709/2018); privacy-by-design requirement | `docs/07-security/lgpd.md`, `docs/07-security/security.md` |
| JWT | JSON Web Tokens (RS256) for API sessions: access 15 min, refresh 7 days (rotation) | `docs/04-api/authentication.md`, `docs/07-security/security.md` |
| JWT Bearer / API Key / Internal Token | Authentication header types: `Authorization: Bearer`, `X-API-Key`, `X-Internal-Token` | `docs/04-api/overview.md` |
| NextAuth.js v4 | Auth library (OAuth, credentials, JWT) | `docs/04-api/authentication.md`, ADR/`docs/02-architecture/architecture.md` |
| Prisma | TypeScript ORM; SQLite (dev) → PostgreSQL/Neon (prod) | `docs/03-database/*`, ADR-002 |
| SQLite / PostgreSQL = Neon | Dev/prod databases | `docs/02-architecture/deployment.md` §1 |
| Upstash Redis | Serverless Redis: sessions, cache, rate limit, BullMQ queues, Pub/Sub | `docs/02-architecture/scalability.md` |
| Cloudflare R2 | Object storage for card images, avatars, posts | `docs/02-architecture/deployment.md` §4 |
| BullMQ | Background job queue (worker :3005) — planned | `docs/02-architecture/architecture.md`, `docs/02-architecture/scalability.md` |
| z-ai-web-dev-sdk | SDK abstracting AI providers (OpenAI GPT-4o / GPT-4o-mini) | `docs/05-ai/providers.md`, `docs/05-ai/architecture.md` |
| Model Router | Feature → model mapping with fallback chain | `docs/05-ai/providers.md` |
| Event Bus | Inter-service event propagation (EventEmitter dev / Redis Pub/Sub prod) | `docs/02-architecture/architecture.md` §6 |
| Kotlin/Expo — N/A | Placeholder; mobile client planned as Expo React Native | `docs/02-architecture/architecture.md` §7 |

## Disambiguation

| Term | Meanings in context | How the project distinguishes |
|---|---|---|
| "IA / AI" | (1) The AI subsystem, (2) the AI streaming endpoint, (3) OpenAI providers | Referenced as `AI Service`, `/api/v1/ai/reading/stream`, provider names |
| "Tarot" | (1) The RWS deck system, (2) the tarot feature module, (3) the reading engine | Module paths: `docs/06-features/tarot*.md`, `.specs/003-tarot-engine/` |
| "R2 / S3" | Storage documented as Cloudflare R2; env vars use the `R2_*` prefix in `security.md` | Canonical storage = **Cloudflare R2**; env vars are `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_PUBLIC_URL`. No AWS S3 in SDD |
| "bun vs pnpm" | Package managers in different docs | **bun** = MVP single app (deploy/Docker/CI); **pnpm** = planned monorepo (ADR-005). See `docs/02-architecture/deployment.md` §2.0 |
| "Monorepo" | Antiga descrição como estado atual em sprint-0.md vs futuro (ADR-005) | **Resolvido (2026-08-10):** `sprint-0.md` atualizado — MVP é app único `bun` na raiz; monorepo pnpm/Turborepo é planejado pós-MVP (ADR-005). Ver `docs/02-architecture/monorepo.md` |

## Naming Conventions

- **Identificador técnico / repo**: `arkana-agora`
- **Marca**: Arkana Agora
- **Domain brand / prod domains**: `arkanaagora.com.br`, `staging.arkanaagora.com.br`, `ws.arkanaagora.com.br`, `assets.arkanaagora.com.br`
- **API versioning**: URI versioning `/api/v1`; deprecated versions kept 6 months with `Deprecation`/`Sunset` headers
- **Package namespace (monorepo, planned)**: `@arkana/ui`, `@arkana/api-client`, `@arkana/types`, `@arkana/config`, `@arkana/utils` (ADR-005)
- **ID prefixes (API examples)**: `usr_`, `prod_`, `ord_`, `rev_`, `req_`, `evt_`, `rt_`, `cm_` per `docs/04-api/*`
- **DB migrations**: `YYYYMMDDHHMMSS_descriptive_name`; never edit an applied migration (`docs/03-database/migrations.md`)
- **Secrets/files**: `.env.example` committed only; `.env`, `.env*.local` gitignored
- **Language**: project docs primary language pt-BR; canonical foundation docs (this set) in English with pt-BR references as noted at the top of each file.