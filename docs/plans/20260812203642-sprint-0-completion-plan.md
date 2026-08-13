---
title: "Sprint 0 Completion — Infrastructure Plan"
ticket: null
type: "plan"
status: "ready"
created: 2026-08-12
updated: 2026-08-12
author: "opencode (pwf-plan)"
repo: "arkana-agora"
branch: "dev"
milestone: "M0"
sprints: ["sprint-0"]
related:
  - docs/08-sprints/sprint-0.md
  - docs/08-sprints/sprint-0.clarifications.md
  - docs/08-sprints/milestones.md
  - docs/00-overview/roadmap.md
  - docs/02-architecture/decisions.md (ADR-002, ADR-005, ADR-006, ADR-007, ADR-008, ADR-009)
  - prisma/schema.prisma
  - .specs/001-auth
  - docs/08-sprints/sprint-0.md (tasks 12-14: shadcn/ui, tokens, componentes base)
  - docs/08-sprints/sprint-0.md (tasks 16-19: CI/CD, Vercel, Sentry, Pino)
---

# Sprint 0 Completion — Infrastructure Plan

## Overview

Completar os itens **pendentes do Sprint 0 / M0** para destravar o desenvolvimento das tasks
em `.specs/` (SPEC-001..010). O esqueleto monolítico Next.js 16 (toolchain `bun`) já existe;
este plano entrega as frentes de infraestrutura que continuam `[ ]` em `docs/08-sprints/sprint-0.md`:

1. **Banco de dados + Docker** — dev em Docker Postgres 16 (substitui SQLite), primeira migration
   versionada, `docker-compose.yml`, Dockerfile multi-stage com `output: "standalone"`.
2. **Autenticação (Track A)** — Auth.js v5 beta (pinado ≥ 5.0.0-beta.32), Google OAuth + magic link
   via adapter mínimo custom (JWT strategy), proteção de rotas via `proxy.ts`, páginas `/login` + `/dashboard`.
3. **Design system (Track B)** — Tailwind v4 + shadcn/ui (New York), tokens, tema claro/escuro
   (`next-themes`), componentes base. Storybook adiado (risco já aceito no sprint-0.md).
4. **CI/CD** — GitHub Actions (lint → type-check → test → build → deploy Vercel), Prettier + Husky + lint-staged.
5. **Observabilidade** — logger Pino (stopgap do `console.log`), health check com probes paralelas,
   Sentry (withSentryConfig + global-error).
6. **Docs/Validação** — sincronizar docs (NextAuth v4 → v5, sqlite → postgres, env `NEXTAUTH_*` → `AUTH_*`),
   criar **ADR-010** (supersede cláusula v4 do ADR-009), flips do sprint-0.md, checklist M0.

**Decisões autorizadas pelo PO (2026-08-12, /pwf-clarify):**
- Docker Postgres 16 como banco de dev (substitui SQLite). [D1]
- Auth.js v5 beta.32 pinado + **ADR-010** formal (upgrade v4→v5). [D2]
- Init migration com 5 models: `User`, `UserProfile`, `Subscription`, `Session`, `VerificationToken`. [D3]
- Magic link via **EmailProvider + adapter mínimo custom** no Auth.js v5 (JWT strategy, token em `VerificationToken`). [D4]

## Scope / Work Breakdown

### In scope
| # | Área | Entregáveis | Fase |
|---|------|-------------|------|
| 1 | DB/Docker | `docker-compose.yml`, `Dockerfile`, `.dockerignore`, datasource `postgresql`, schema (5 models + enums), init migration versionada, `next.config.ts` standalone, docs de env | F1 |
| 2 | Auth (Track A) | `next-auth@5.0.0-beta.32`, `auth.config.ts` (edge) + `prisma-adapter.ts` (adapter mínimo) + `auth.ts` (node), handler `[...nextauth]`, Google + EmailProvider magic link, `src/proxy.ts`, `/login` + `/dashboard`, **ADR-010**, docs auth | F2A |
| 3 | Design System (Track B) | Tailwind v4, `shadcn init` (New York), tokens (globals.css), `next-themes`, `layout.tsx` reescrito, componentes base (Button, Card, Input, Label, Skeleton, Form), docs | F2B |
| 4 | CI/CD | `.github/workflows/ci.yml` (quality→test→build), deploy Vercel (staging a cada push na `main`, prod via promoção manual), Prettier, Husky, lint-staged | F3 |
| 5 | Observability | `src/lib/logger.ts` (Pino), health probes paralelas + redis check opcional, Sentry (`withSentryConfig`, `global-error.tsx`, `sentry.properties`), docs | F4 |
| 6 | Docs/Validação | doc-shepherd + plan-sync, flips sprint-0.md, checklist M0, plan review loop | F5 |

### Out of scope
- Monorepo Turborepo + pnpm (ADR-005, pós-MVP). **[NEEDS CLARIFICATION: manter]**
- Demais 17 entidades do `entities.md` (donos de SPEC futuros; não migradas no init). [D3]
- Socket.io mini-service / Caddy (`dev:ws`, `dev:all` — ADR-007 supersedida pela ADR-009). **[NEEDS CLARIFICATION: permanece adiado até sprint do chat]**
- JWT custom RS256 + `/api/v1/auth/*` REST (refresh/rotação) — Sprint 1.
- Rotas `/api/v1/auth/magic-link*` — Sprint 1 (contrato completo anti-enumeração/rate-limit).
- Storybook (risco aceito no sprint-0.md §Riscos; reavaliar pós-MVP).
- Payment (Mercado Pago, ADR-008), AI, Redis como dependência de negócio (só health check).
- PostHog.
- **Facebook OAuth** (enum `FACEBOOK` do ADR-009): fora do escopo deste plano — apenas o Google OAuth é implementado (Facebook fica para Sprint 1 junto das rotas custom).

## Proposed Solution

### Arquitetura-alvo (pós-plano)

```
docker-compose.yml            # postgres:16-alpine + redis:7-alpine + web (app) + migrate (one-shot)
Dockerfile                    # multi-stage bun: install → build → runner (standalone)
next.config.ts                # output: "standalone"; serverExternalPackages: ["@prisma/client"]
src/
├── auth/
│   ├── auth.config.ts        # edge-safe: providers Google + EmailProvider (magic link); callbacks; proxy matcher
│   ├── prisma-adapter.ts     # adapter mínimo (VerificationToken + User; sem Session — JWT strategy)
│   └── auth.ts               # Node runtime: NextAuth, handlers, auth(), signIn(), signOut()
├── proxy.ts                  # Next 16 (middleware → proxy); matcher protege /dashboard
├── app/
│   ├── api/auth/[...nextauth]/route.ts   # handler Auth.js
│   ├── (auth)/login/page.tsx             # login Google + email (magic link)
│   ├── (app)/dashboard/page.tsx          # protegida
│   └── layout.tsx                        # Providers (SessionProvider + ThemeProvider)
├── lib/
│   ├── prisma.ts             # singleton (já existe; datasource postgres)
│   ├── logger.ts             # Pino (pino-pretty dev)
│   └── utils.ts              # cn() (class-variance-authority + clsx + tailwind-merge)
└── components/ui/            # shadcn New York (Button, Card, Input, Label, Skeleton, Form)
prisma/
├── schema.prisma             # datasource postgresql; 5 models + enums
└── migrations/               # init migration versionada
.github/workflows/ci.yml      # quality → type-check → test (coverage) → build → deploy
```

### Decisões de solução

- **[D1] Banco dev = Postgres 16 via Docker.** Desbloqueia `String[]` (entities.md), produz migration
  portável para Neon e alinha dev/prod. `DATABASE_URL=postgresql://arkana:arkana@localhost:5432/arkana`.
  `dev.db` descartável (mantido gitignored; remover do working tree).
- **[D2] Auth.js v5 beta.32 pinado.** Compatível com Next 16 (beta.30+). Pin exato evita GHSA-8fpg-xm3f-6cx3
  (fail-open ≤ beta.31). JWT strategy com **adapter mínimo** (implementa só VerificationToken+User+Account,
  sem métodos de Session — preserva o model `Session` custom do SPEC-001). **ADR-010** formal supersede a
  cláusula v4+adapter do ADR-009. Envs `AUTH_SECRET`/`AUTH_TRUST_HOST`/`AUTH_GOOGLE_ID`/`AUTH_GOOGLE_SECRET`.
- **[D3] Init migration: 5 models.** `User` (stub atual + campos já presentes), `UserProfile`, `Subscription`,
  `Session`, `VerificationToken` — cobre M0 + base de auth (ADR-009). **Schemas de `Session` e
  `VerificationToken` = copia fiel de `.specs/001-auth/design.md` §4** (Session: `tokenHash @unique`,
  `familyId`, `tokenId`, `replacedByTokenId`, `revokedAt`, `@@index([userId])`, `@@index([familyId])`;
  VerificationToken: `identifier`, `token @unique`, `type` ("EMAIL"|"PASSWORD_RESET"|"MAGIC_LINK"),
  `expiresAt` — **sem** `usedAt`). `@@index`/`@unique` seguem `docs/03-database/indexing.md` para os 5 models.
- **[D4] Magic link via Auth.js EmailProvider + adapter mínimo custom.** O `EmailProvider` do Auth.js v5
  **exige um database adapter** para o callback `/api/auth/callback/email` (não há caminho "no-adapter").
  Solução: adapter Prisma **mínimo** (`src/auth/prisma-adapter.ts`) que implementa **apenas** os métodos
  usados pelo fluxo — `createVerificationToken`/`useVerificationToken` (→ `VerificationToken`),
  `getUserByEmail`/`getUser`/`createUser` (→ `User`), `getUserByAccount`/`linkAccount`/`unlinkAccount`/
  `updateUser` (→ OAuth Google) — e **NÃO** implementa `createSession`/`getSessionAndUser`/
  `updateSession`/`deleteSession`: a strategy é **JWT** (Auth.js não grava Session), preservando o model
  `Session` custom intacto para o refresh da Sprint 1. Single-use = `useVerificationToken` deleta o token
  na redempção; expiração 15 min = `expiresAt` de `VerificationToken`. O callback `/api/auth/callback/email`
  já autentica e cria a sessão JWT (satisfaz M0 "magic link enviando email e autenticando").
- **Auth de rotas:** `/api/auth/*` = interno Auth.js (fixo); `/api/v1/auth/*` = REST custom (Sprint 1) —
  divisão preservada (ADR-009).
- **Health check:** probes **paralelas** (`Promise.allSettled`), envelope `{status,timestamp,version,services:{database,redis?}}`; 200/503 inalterado; redis check opcional (desliga sem `REDIS_URL`).
- **Layout compartilhado:** `layout.tsx` coordena Track A (SessionProvider) e Track B (ThemeProvider).
  Sequência de merge: F2A → F2B → layout final em F2B (evita conflito no mesmo arquivo).
- **CI:** um workflow com jobs encadeados (`quality` → `test` → `build` → `deploy`); deploy Vercel
  **preview/staging a cada push na `main`; prod via promoção manual/merge** (milestones.md M0) com
  `vercel deploy --prebuilt`.

## Technical Considerations

### Compatibilidade / versões (verificadas 2026)
| Dep | Versão | Motivo |
|-----|--------|--------|
| `next-auth` | `5.0.0-beta.32` (**pin exato**) | Next 16 OK (beta.30+); ≥ beta.32 mitiga GHSA-8fpg-xm3f-6cx3 |
| `next-themes` | ^0.4 | Tema claro/escuro + `suppressHydrationWarning` |
| `tailwindcss` | ^4 (pkg nativo, sem postcss plugin dedicado) | shadcn v4 path |
| `@tailwindcss/postcss` | ^4 | integração Next 16 |
| `shadcn@latest init` | New York + CSS vars + React 19 | ADR-006 |
| `pino` | ^9 + `pino-pretty` | logger stopgap (pattern logger-migration-stopgap) |
| `@sentry/nextjs` | latest (SDK compatível Next 16) | error tracking; DSN via env |
| `prisma` | `^6.5.0` (pin manter) | ADR-002; **não** subir p/ 7 neste plano [NEEDS CLARIFICATION: Prisma 7] |

### Gotchas (não ignorar)
- **Nunca** rodar `prisma migrate dev` com `provider = "sqlite"` (SQL não é portável para Neon). Trocar
  datasource ANTES (F1-T4). `migration_lock.toml` deve ficar `provider = "postgresql"`.
- **Chain atômica de migração** (typeorm/prisma discipline): generate → drift-check → migrate dev → verify
  (`SELECT 1`, `prisma migrate status`). A geração da init (T05) roda no host via `bunx prisma migrate dev`
  contra o container Postgres; no CI/docker-compose a aplicação usa `prisma migrate deploy` (one-shot).
- **`output: "standalone"` obrigatório** — sem ele o `COPY --from=builder .next/standalone ./.next/standalone`
  falha. `serverExternalPackages: ["@prisma/client"]` evita o erro de módulo externo no standalone.
- **`proxy.ts`** (não `middleware.ts`) no Next 16. Matcher segmentado para evitar executar em `/api`, `_next`, assets.
- **Envs Auth.js:** `AUTH_SECRET` (não `NEXTAUTH_SECRET`), `AUTH_TRUST_HOST=true`, `AUTH_GOOGLE_ID`/`AUTH_GOOGLE_SECRET`
  (não `GOOGLE_CLIENT_*`). Atualizar `.env.example` (nomes atuais desatualizados) e `docs/02-architecture/deployment.md` §2.4.
- **Magic link requer nodemailer** (ou transport custom). Com custom provider + smtp, verificar credenciais
  em `SMTP_*`; sem SMTP configurado, logar o link em dev (`AUTH_EMAIL_SKIP_SEND` guard) para não bloquear o fluxo.
- **`Decimal`:** anotar `@db.Decimal(10,2)` em `UserProfile.pricePerReading` e `@db.Decimal(3,2)` em
  `UserProfile.rating` (únicos campos Decimal nos 5 models do init — `Subscription` NÃO tem `amount`).
  Evita `DECIMAL(65,30)` (4× storage).
- **Probes de saúde em paralelo** — serial = 8s worst case (performance HIGH).
- **`@unique`/`@@index`:** `Session.tokenHash @unique`, `@@index([userId])`, `@@index([familyId])` seguem
  `docs/03-database/indexing.md`.
- **Soft-delete LGPD:** queries de auth filtram `deletedAt IS NULL` (User). `isActive` mantido.
- **`providerId` EMAIL** = email lowercase (H-2) — callback de signIn aplica normalização.

### Riscos e mitigações
| Risco | Prob | Impacto | Mitigação |
|-------|------|---------|-----------|
| Migration init divergente do entities.md | Média | Alto | Criar só 5 models autorizados [D3]; drift-check + review do SQL (migrations.md §8) |
| Auth.js v5 beta instável | Média | Médio | Pin exato beta.32; testes E2E mínimos do fluxo Google/magic link; fallback documentado p/ subir issue |
| Conflito `layout.tsx` entre tracks | Alta | Baixo | Sequência F2A → F2B; layout final só em F2B |
| Docker standalone quebra build | Baixa | Alto | `output: "standalone"` + `serverExternalPackages`; teste `docker build` em F1 |
| Secret vazado em CI/compose | Baixa | Crítico | `.dockerignore` sem `.env*`, secrets via `env_file`/secrets do GH, nunca hardcode |
| Google OAuth sem credenciais de dev | Média | Médio | Magic link como fallback de login; doc de criação de credenciais |

## Acceptance Criteria

Por entregável (checklist de verificação do plano — não substitui ACs de cada task):

1. **DB/Docker** — `docker compose up -d` sobe postgres/redis/web/migrate sem erro **em < 60s** (métrica M0, milestones.md); `prisma migrate status`
   = up-to-date; `/api/health` retorna 200 com DB ok e derruba p/ 503 com DB down; `docker build` da imagem
   standalone conclui e a app responde.
2. **Auth** — `bun run dev` (pré-requisito: Docker up) — login via Google redireciona e cria/vincula User
   (`provider GOOGLE`, `providerId` = subject); magic link envia email e **autentica** ao clicar
   (`/api/auth/callback/email`, token 15min single-use via `useVerificationToken`); `/dashboard` exige
   sessão (redirect `/login`); `AUTH_*` envs documentadas; **ADR-010** registrada supersedendo a cláusula
   v4 do ADR-009.
3. **Design System** — `npx shadcn@latest add <comp>` funcional; componentes base renderizam no tema
   claro/escuro; tokens centralizados no `globals.css`; `layout.tsx` envolve SessionProvider + ThemeProvider.
4. **CI/CD** — push em `main` dispara `ci.yml`; jobs quality/type-check/test (com service container postgres)/build verdes; coverage vitest
   `lcov` gerada; deploy preview/staging OK (ou preparado com vercel CLI configurado).
5. **Observability** — `src/lib/logger.ts` substitui `console.log` no health route; probes paralelas;
   Sentry DSN via env (sem DSN → disabled); `global-error.tsx` presente.
6. **Docs/Validação** — sprint-0.md flips `[x]` nos itens entregues; `architecture.md`/`infrastructure.md`/
   `environments.md`/`deployment.md` sem referência a "NextAuth v4" nem "SQLite dev"; `.env.example`
   com `AUTH_*`/postgres; `entities.md`/`indexing.md` consistentes com os 5 models migrados; M0 checklist completo.

## Implementation Plan

> Sequência: F1 (base p/ tudo) → F2A + F2B (tracks, layout coordenado) → F3 (CI) → F4 (obs) → F5 (docs).
> Task de verificação sempre após cada fase.

### Fase 1 — Banco de dados + Docker

| Task | Descrição | Arquivos |
|------|-----------|----------|
| T01 | `docker-compose.yml` com `postgres:16-alpine`, `redis:7-alpine`, `migrate` (one-shot `prisma migrate deploy`) e `web` (build local) | `docker-compose.yml` |
| T02 | `Dockerfile` multi-stage bun (deps → build → standalone runner) + `.dockerignore` (sem `.env*`, `node_modules`, `.next`, `coverage`) | `Dockerfile`, `.dockerignore` |
| T03 | `next.config.ts`: `output: "standalone"` + `serverExternalPackages: ["@prisma/client"]` | `next.config.ts` |
| T04 | `prisma/schema.prisma`: datasource `postgresql` (env `DATABASE_URL`); enums existentes; 5 models autorizados [D3] com schemas de Session/VerificationToken = `.specs/001-auth/design.md` §4 + relações + índices (indexing.md) + `@db.Decimal(10,2)` em `UserProfile.pricePerReading` e `@db.Decimal(3,2)` em `UserProfile.rating` | `prisma/schema.prisma` |
| T05 | Gerar init migration: **antes**, subir Postgres (`docker compose up -d postgres`) e garantir `DATABASE_URL` do `.env` (não `.env.local`) apontando para o container; depois `bunx prisma migrate dev --name init` (chain atômica) — conferir `migration_lock.toml` = postgresql, revisar SQL | `prisma/migrations/` |
| T06 | `prisma/seed.ts`: seed dev mínimo (1 admin + 1 user de teste via `providerId` email lowercase) | `prisma/seed.ts` |
| T07 | `.env.example`: `DATABASE_URL` postgres local; manter demais nomes (auth corrigido na F2A) | `.env.example` |
| T08 | Verificação: `docker compose up -d`, `migrate status`, health 200/503, `bun run build` + `docker build` OK | — |

### Fase 2A — Autenticação (Auth.js v5)

| Task | Descrição | Arquivos |
|------|-----------|----------|
| T09 | Instalar `next-auth@5.0.0-beta.32` (pin), `nodemailer` + `@types/nodemailer`, `@auth/core` typings se necessário | `package.json`, `bun.lock` |
| T10 | `src/auth/auth.config.ts` (edge): GoogleProvider + EmailProvider (magic link, `sendVerificationRequest` → email com link `/api/auth/callback/email?token=...`), callbacks (`signIn` normaliza providerId EMAIL lowercase; `jwt`/`session` user), pages (`/login`), `trustHost` | `src/auth/auth.config.ts` |
| T11 | `src/auth/prisma-adapter.ts` (adapter mínimo): `createVerificationToken`/`useVerificationToken`/`getUserByEmail`/`getUser`/`createUser`/`getUserByAccount`/`linkAccount`/`unlinkAccount`/`updateUser` mapeados para `VerificationToken`+`User`; **sem** métodos de Session (JWT strategy). Handler redime token em `/api/auth/callback/email`, single-use via delete, 15min via `expiresAt` | `src/auth/prisma-adapter.ts` |
| T11b | `src/auth/auth.ts` (node): `NextAuth({ ...authConfig, adapter, session: { strategy: "jwt" } })` exportando `handlers`, `auth`, `signIn`, `signOut` | `src/auth/auth.ts` |
| T12 | Handler Next.js: `GET`/`POST` em `[...nextauth]` | `src/app/api/auth/[...nextauth]/route.ts` |
| T13 | `src/proxy.ts` (Next 16): protege `/dashboard` (+ matcher segmentado), `getToken({ secret: AUTH_SECRET })` | `src/proxy.ts` |
| T14 | Página `/login`: Google + email (magic link), estados de erro/loading | `src/app/(auth)/login/page.tsx` + form |
| T15 | Página `/dashboard`: sessão, sign out | `src/app/(app)/dashboard/page.tsx` |
| T16 | `.env.example`: `AUTH_SECRET`, `AUTH_TRUST_HOST`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `SMTP_*`; remover `NEXTAUTH_*`/`GOOGLE_CLIENT_*` | `.env.example` |
| T17 | **Criar ADR-010** "Auth.js v5 beta + adapter mínimo" documentando o upgrade v4→v5 (pin beta.32, no-adapter→adapter mínimo, magic link via EmailProvider) e **supersedindo a cláusula v4+adapter do ADR-009** (autorização do PO registrada); atualizar docs auth (04-api/authentication.md, 06-features/authentication.md, .specs/001-auth) | `docs/decisions/<date>-authjs-v5-adapter-minimo.md`, `docs/02-architecture/decisions.md`, docs |
| T18 | Teste: fluxo Google + magic link (vitest unit: callbacks, normalização, geração/validação token) | `tests/` |
| T19 | Verificação: `bun run lint`, `type-check`, `test`; login manual via dev | — |

### Fase 2B — Design system (Tailwind v4 + shadcn/ui)

| Task | Descrição | Arquivos |
|------|-----------|----------|
| T20 | Instalar `tailwindcss@4`, `@tailwindcss/postcss`, `class-variance-authority`, `clsx`, `tailwind-merge`, `lucide-react`, `next-themes` | `package.json`, `bun.lock` |
| T21 | Configurar PostCSS (plugin `@tailwindcss/postcss`), `globals.css` com tokens `:root`/`.dark` (CSS vars) | `postcss.config.mjs`, `src/app/globals.css` |
| T22 | `shadcn init` (New York, CSS vars, React 19) + `components.json` | `components.json` |
| T23 | `src/lib/utils.ts` (`cn`), `src/components/ui/*`: Button, Card, Input, Label, Skeleton, Form | `src/lib/utils.ts`, `src/components/ui/` |
| T23b | Restyle das páginas `/login` e `/dashboard` (T14/T15) com os componentes ui do T23 (shadcn aplicado após a criação do design system) | `src/app/(auth)/login/`, `src/app/(app)/dashboard/` |
| T24 | `ThemeProvider` + toggle tema (claro/escuro) + `suppressHydrationWarning` no `<html>` | `src/components/theme-provider.tsx`, `src/components/theme-toggle.tsx`, `src/app/layout.tsx` |
| T25 | Layout final: `SessionProvider` (Track A) + `ThemeProvider` (Track B) no `layout.tsx` | `src/app/layout.tsx` |
| T26 | `src/components/providers.tsx` (composição dos providers) — reduz acoplamento do layout | `src/components/providers.tsx` |
| T27 | Verificação: build + lint + type-check; tema claro/escuro em `/login` e `/dashboard` | — |

### Fase 3 — CI/CD

> **Nota (plan-sync, 2026-08-13):** este plano não possui fase "F2C" — a fase seguinte à F2B é esta (F3). Os itens diferidos no pós-review da F2B **não alteram** as tasks da F3: Prettier/Husky permanecem em T29 (como planejado); rate-limit/anti-enumeração do magic link seguem para Sprint 1 (escopo deste plano); layout 50/50 de auth vai para M0. Extras criados na F2B (`src/components/ui/alert.tsx`, `form.tsx` manual) não são consumidos por nenhuma task de F3+.

| Task | Descrição | Arquivos |
|------|-----------|----------|
| T28 | `ci.yml`: `quality` (eslint+prettier --check) → `type-check` → `test` (**com `postgres:16-alpine` como service container**, `DATABASE_URL` do service) → `build` → `deploy` (Vercel preview/staging a cada push na `main`, conforme infra docs; prod via promoção manual/merge) | `.github/workflows/ci.yml` |
| T29 | Prettier config + script `format`; Husky (pre-commit: lint-staged) + lint-staged (prettier+eslint+tsc) | `prettier.config.mjs`, `.prettierignore`, `.husky/`, `package.json` |
| T30 | Secrets/actions do GH (Vercel token/org/project); `vercel.json` com framework preset | `vercel.json`, CI secrets |
| T31 | Verificação: push em branch → workflow verde de ponta a ponta; deploy staging responde | — |

### Fase 4 — Observabilidade

| Task | Descrição | Arquivos |
|------|-----------|----------|
| T32 | `src/lib/logger.ts` Pino (+ pino-pretty dev), `reqId`/redact de secrets | `src/lib/logger.ts` |
| T33 | Health route: probes paralelas (`Promise.allSettled`), redis check opcional, logger substitui `console.log` | `src/app/api/health/route.ts`, `tests/health.test.ts` |
| T34 | Sentry: instalar `@sentry/nextjs`, `withSentryConfig`, DSN via env (sem DSN = disabled), `global-error.tsx`; **`sentry.properties` e o auth token do CLI: `.gitignore` + excluídos do build context via `.dockerignore`** | `src/app/global-error.tsx`, `sentry.server.config.ts`, `sentry.client.config.ts`, `sentry.edge.config.ts`, `next.config.ts`, `.gitignore`, `.dockerignore` |
| T35 | Atualizar `docs/02-architecture/observability.md` §6.3 (probes paralelas + redis) e `docs/solutions/operations/health-endpoint-contract.md` | docs |
| T36 | Verificação: test de saúde (probes paralelas), lint/type-check/build; Sentry disabled sem DSN | — |

### Fase 5 — Docs e Validação final

| Task | Descrição | Arquivos |
|------|-----------|----------|
| T37 | Doc-shepherd: sync v4→v5, sqlite→postgres, `NEXTAUTH_*`→`AUTH_*`, flags de status; sem contradições | todos `docs/` |
| T38 | Plan-sync: marcar Master Checklist `[x]`, exec log; flips no `sprint-0.md` (US-002..006, tasks, critérios) | `docs/08-sprints/sprint-0.md` |
| T39 | M0 checklist (milestones.md): validar critérios; remover `.specs` blockers de infra pendentes | `docs/08-sprints/milestones.md` |
| T40 | Atualizar `docs/infrastructure.md` (Known Constraints: remover SQLite-dev/lista escalar; postgres dev) | `docs/infrastructure.md`, `docs/environments.md` |
| T41 | Verificação final: `bun run lint` + `type-check` + `test` + `build` + `docker compose up` (green) | — |

## Master Checklist

- [x] F1: docker-compose sobe postgres+redis+web+migrate (T01)
- [x] F1: Dockerfile standalone + `.dockerignore` (T02)
- [x] F1: `next.config.ts` standalone + serverExternalPackages (T03)
- [x] F1: schema postgres com 5 models autorizados [D3] (T04)
- [x] F1: init migration versionada, lock=postgresql, SQL revisado (T05)
- [x] F1: seed dev mínimo (T06)
- [x] F1: `.env.example` DATABASE_URL postgres (T07)
- [x] F1: verificação build+docker+health (T08)
- [x] F2A: `next-auth@5.0.0-beta.32` pinado (T09)
- [x] F2A: auth.config edge + EmailProvider magic link (T10)
- [x] F2A: adapter mínimo `prisma-adapter.ts` (T11)
- [x] F2A: auth.ts node JWT strategy (T11b)
- [x] F2A: handler `[...nextauth]` (T12)
- [x] F2A: `proxy.ts` protege `/dashboard` (T13)
- [x] F2A: `/login` + `/dashboard` funcionais (T14-T15)
- [x] F2A: `.env.example` `AUTH_*` (T16)
- [x] F2A: **ADR-010** + docs auth sync (T17)
- [x] F2A: testes auth unit (T18) + verificação (T19)
- [x] F2B: Tailwind v4 + postcss (T20-T21)
- [x] F2B: shadcn init New York (T22)
- [x] F2B: cn + componentes base (T23) + restyle pages (T23b)
- [x] F2B: ThemeProvider + toggle + layout final (T24-T26)
- [x] F2B: verificação build/tema (T27)
- [ ] F3: `ci.yml` completo (T28)
- [ ] F3: Prettier + Husky + lint-staged (T29)
- [ ] F3: Vercel deploy configurado (T30)
- [ ] F3: verificação workflow verde (T31)
- [ ] F4: logger Pino (T32)
- [ ] F4: health probes paralelas + redis + logger (T33)
- [ ] F4: Sentry withSentryConfig + global-error (T34)
- [ ] F4: docs observability sync (T35) + verificação (T36)
- [ ] F5: doc-shepherd sem contradições (T37)
- [ ] F5: plan-sync + flips sprint-0.md (T38)
- [ ] F5: M0 checklist validado (T39)
- [ ] F5: infrastructure/environments docs sync (T40)
- [ ] F5: verificação final full green (T41)

## Clarifications

### Autorizadas (2026-08-12)
- **[D1]** Dev DB: SQLite → Docker Postgres 16. Exige atualização de `docs/infrastructure.md` (Known Constraints), `docs/environments.md`, `deployment.md`, `sprint-0.md`.
- **[D2]** Auth.js v5 beta.32 pinado (JWT strategy, adapter mínimo). **ADR-010** criada supersedindo a cláusula v4+adapter do ADR-009 + sync `.specs/001-auth` e docs antigas via doc-shepherd. NÃO altera payload `tokenVersion`/design do refresh (Sprint 1).
- **[D3]** Init migration escopo = 5 models (User, UserProfile, Subscription, Session, VerificationToken), schemas de Session/VerificationToken = cópia de `.specs/001-auth/design.md` §4. Demais entidades nos seus sprints.
- **[D4]** Magic link = EmailProvider do Auth.js v5 + adapter mínimo custom (sem métodos de Session; JWT strategy). Rotas custom `/api/v1/auth/magic-link*` permanecem Sprint 1.

### [NEEDS CLARIFICATION]
- **Prisma 7:** manter pin Prisma 6.5 neste plano (recomendado — ADR-002), ou avaliar upgrade p/ Prisma 7 com nova pesquisa antes de migrar. Recomendação: manter 6.5.
- **`VerificationToken` schema:** alinhado ao design.md §4 (`token` texto plano `@unique`, `type`, `expiresAt`, **sem** `usedAt`). A variante `tokenHash sha256` é melhor prática de segurança (security-sentinel) mas **divergiria do design.md** — manter design.md salvo decisão do PO em contrário.
- **Storybook:** adiado (risco aceito) — manter adiado ou incluir? Recomendação: manter adiado.
- **Deploy automático Vercel:** exige conta/token Vercel + credenciais do PO. Se indisponível na Sprint 0, entregar workflow com passo deploy em "continue-on-error" ou job opcional + doc de config manual.
- **Google OAuth credenciais de dev:** se não houver client ID/secret reais, magic link (com SMTP real ou log dev) é o caminho de teste; documentar criação de credenciais.

---

## Execution Log

- 2026-08-12 — Plano criado (pwf-plan). Pesquisa completa (Rounds 1–3). Clarifications D1–D4 autorizadas.
- 2026-08-12 — Review `plan-document-reviewer` iteração 1: NEEDS_WORK (2 HIGH). Corrigido: D4 (adapter mínimo — EmailProvider exige adapter), D3/VerificationToken (premissa falsa corrigida para design.md §4), T05 (ordem postgres), T04 (Decimal em UserProfile), T28 (service container postgres), T30 (branches main), T17 (ADR-010), T34 (.sentryclirc), restyle T23b, Facebook out-of-scope, métrica <60s, frontmatter paths.
- 2026-08-12 — Review iteração 2: NEEDS_WORK (1 CRITICAL resquícios "sem adapter"/"nota ADR-009"/"dev→staging"). Corrigido em Overview, Decisões, Proposed Solution e Scope table.
- 2026-08-12 — Review iteração 3: NEEDS_WORK (1 HIGH: entrada "NextAuth v4 referências" remanescente; 3 LOW). Removida entrada, D2 absorveu doc-shepherd; LOWs de wording/runner corrigidos.
- 2026-08-12 — Review iteração 4: **APPROVED** (0 CRITICAL/HIGH/MEDIUM; 1 LOW não-bloqueante — log histórico).
- 2026-08-13 — Fase 1 executada (T01–T08): docker-compose.yml (postgres/redis/migrate/web), Dockerfile multi-stage bun + .dockerignore, next.config.ts standalone + serverExternalPackages, schema postgresql com 5 models autorizados [D3], init migration 20260813000605_init (lock postgresql, SQL revisado), seed dev (admin + test), .env.example DATABASE_URL postgres. Verificação: compose up ~32s (<60s), migrate status up-to-date, health 200/503, bun build/lint/type-check/test verdes, docker build OK. Nota: porta 5432 conflitava com Postgres nativo Windows (P1000) — serviço nativo parado pelo usuário; DATABASE_URL mantida em 5432.
- 2026-08-13 — Fase 2A executada (T09–T19): `next-auth@5.0.0-beta.32` + nodemailer/@types pinados; `src/auth/auth.config.ts` (edge, Google condicional + EmailProvider magic link, SMTP_* com guard dev `AUTH_EMAIL_SKIP_SEND`); adapter mínimo `src/auth/prisma-adapter.ts` (VerificationToken/User/Account-mapping, sem métodos de Session); `src/auth/auth.ts` (JWT strategy); handler `src/app/api/auth/[...nextauth]`; `src/proxy.ts` (Next 16) protegendo `/dashboard`; páginas `/login` (Google + magic link) e `/dashboard` (sessão + sign out); `.env`/`.env.example` migrados p/ `AUTH_*`; ADR-010 + supersessão ADR-009 + sync docs (04-api, 06-features, overview, deployment §2.4, .specs/001-auth). Verificação: build/lint/type-check verdes; 13 testes vitest verdes; smoke dev — `/api/auth/providers` 200 (google+email), `/login` 200, `/dashboard` sem sessão → 307 `/login?callbackUrl=%2Fdashboard`. Nota ADR-010: sem model `Account` no MVP, vínculo OAuth usa `User.provider`/`providerId` (provedor único por usuário); `unlinkAccount` no-op. **Review pass pós-entrega:** fixes aplicados — filtros `isActive` nas queries de auth, `deleteMany` idempotente na redenção de token, `trustHost` env-driven (`AUTH_TRUST_HOST`), `secureCookie` no proxy, `AUTH_URL` setado. Suíte final: **16 testes vitest verdes**.
- 2026-08-13 — Step 4 (review) Fase 2A: 7 revisores em paralelo na versão final (security-sentinel, nextjs-reviewer, architecture-strategist, code-simplicity, kieran-typescript-reviewer, learnings-researcher, workflow/lint) — 0 CRITICAL. Fixes aplicados: `trustHost` `!== "false"` (matava todos os endpoints de auth sem a env); guard de boot em prod exige `AUTH_URL` https (fora da fase de build); `AUTH_EMAIL_SKIP_SEND` em allowlist `NODE_ENV != development`; `allowDangerousEmailAccountLinking` no GoogleProvider (revincula silenciosa do ADR-010 §5); `useVerificationToken` atômico (`delete` por token `@unique` + P2025→null); `createUser` mapeia P2002 (conta LGPD inativa); `satisfies Adapter` + augmentation movida p/ `src/types/next-auth.d.ts`; try/catch no email do login-form; `docker-compose.yml` web com `env_file: .env`. Docs: README, deployment:29, overview:39, infrastructure.md, ADR-010 embutido realinhado à canônica (10 decisões), ADR-002 nota (SQLite→Postgres), sprint-1.md + backlog.md (tasks B-009A–D / 1a–1e do Sprint 1). Verificação: lint/type-check/test (**17 testes**) /build verdes; smoke dev OK (providers 200, login 200, dashboard 307). Commits `dev` (sem push): `69e4bc8` 🐛 fix(auth) + `bfa4d30` 📝 docs(auth).
- 2026-08-13 — Fase 2B executada (T20–T27): deps instaladas (`tailwindcss@4.3.3`, `@tailwindcss/postcss`, `cva`, `clsx`, `tailwind-merge`, `lucide-react`, `radix-ui` [via shadcn], `next-themes@0.4.6`, `react-hook-form`+`@hookform/resolvers` p/ Form); `postcss.config.mjs` (`@tailwindcss/postcss`); `shadcn init` (**radix-nova** preset — nota: CLI atual `shadcn@4.17` usa `-b radix` + `-p nova`; "New York" virou preset radix-nova; ADR-006 "baseado em Radix" preservado) → `components.json`, `src/lib/utils.ts` (cn), `globals.css` com tokens `:root`/`.dark` (oklch, `@custom-variant dark`, `tw-animate-css`); componentes `ui/`: Button, Card, Input, Label, Skeleton (+ **form.tsx escrito manualmente** — componente `form` não existe no registry radix-nova; adaptado do fonte New York para imports unificados `radix-ui` + `data-slot`); restyle `/login` (Card + toggle tema) e `/dashboard` (Card + toggle tema + sign out); `src/components/providers.tsx` (SessionProvider + ThemeProvider), `theme-provider.tsx`, `theme-toggle.tsx`, `layout.tsx` final (Geist font via `next/font/google` + `suppressHydrationWarning`). Verificação final (T27): lint 0 / type-check 0, **25 testes** vitest verdes (16 auth + 8 ui-utils + 1 health), build OK (Next 16.3.0, Turbopack). Smoke dev — `/login` 200 (toggle tema presente), `/dashboard` 307→`/login?callbackUrl=%2Fdashboard`, `/api/auth/providers` 200. Notas: Docker Desktop não estava rodando no momento da verificação — health test loga DB-down mas **passa por design** (envelope coerente; 503 esperado sem DB); smoke sem DB — F2A não quebrado.
- 2026-08-13 — Fase 2B **post-review (quality pass)**: `src/app/(app)/layout.tsx` com guard de auth em grupo (`auth()` + `redirect('/login')` — defesa em profundidade além do `proxy.ts`); corrigida auto-referência cíclica de fonte (`--font-sans: var(--font-sans)` → `--font-geist-sans` em `globals.css` + `layout.tsx`); `color-scheme: dark` adicionado a `.dark`; `FormItemContext` reordenado acima de `useFormField` em `form.tsx`; a11y no `login-form.tsx` (`name`, `autoComplete`, `maxLength`, `aria-invalid`, `aria-describedby`, dedup de erro); `import type ReactNode`; guard no `theme-toggle.tsx`; novo `tests/ui-utils.test.ts` (8 testes: `cn` + `buttonVariants`) → suíte final **25 testes**. **Diferido (documentado, fora desta fase):** layout 50/50 de auth → M0; Prettier/Husky → F3 (T29, como planejado); rate-limit + contrato anti-enumeração do magic link → Sprint 1 (já previsto no escopo deste plano); `allowDangerousEmailAccountLinking` (`auth.config.ts`) mantido como decisão aceita do ADR-010 §5 (NÃO alterado). Extras criados além do plano: `src/components/ui/alert.tsx` (não listado no T23) e `form.tsx` escrito à mão (registry radix-nova não o contém) — não afetam as tasks das fases seguintes.
