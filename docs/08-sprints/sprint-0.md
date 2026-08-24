# Sprint 0 — Infraestrutura Base

> **Projeto**: Arkana Agora  
> **Identificador**: `arkana-agora`  
> **Duração**: 3 semanas  
> **Equipe**: 2 desenvolvedores full-stack  
> **Status**: Reescorpado — esqueleto monolítico implementado na raiz (`docs/02-architecture/monorepo.md` §1, `docs/architecture.md` → "Implementation status")

---

## Objetivo

Preparar a infraestrutura técnica necessária para o desenvolvimento acelerado dos próximos sprints. **Após reescopo, o sprint entregou um esqueleto mínimo como monolito Next.js único na raiz do repo (toolchain `bun`), adiando o monorepo (ADR-005) para depois do MVP.** O planejamento original abaixo foi mantido como referência histórica; o estado implementado está em `docs/02-architecture/monorepo.md` e `docs/architecture.md`.

---

## User Stories

| # | User Story | Critério de Aceite | Estado real |
|---|-----------|-------------------|-------------|
| US-001 | Como desenvolvedor, preciso de um setup base para desenvolvimento paralelo | Monorepo com `pnpm` + Turborepo, builds isolados por pacote, cache funcional | **Adiado** — monorepo é futuro (ADR-005); MVP é app único `bun` na raiz |
| US-002 | Como devOps, preciso que o CI/CD esteja configurado no GitHub Actions para automação de testes e deploy | Pipeline executando lint → test → build → deploy em cada push | **Parcial** — scripts `lint`/`type-check`/`test`/`build` existem; pipeline GH Actions ainda não criado |
| US-003 | Como desenvolvedor, preciso que o Docker Compose suba toda a stack (web, db, redis, ws) com um comando | `docker compose up` sobe todos os serviços sem erros | **Pendente** — sem `docker-compose.yml` no repo |
| US-004 | Como DBA, preciso que o Prisma schema defina as tabelas base (User, Profile, Subscription) | Migrations aplicáveis, dados persistindo no PostgreSQL | **Parcial** — `prisma/schema.prisma` com 5 models (User, UserProfile, Subscription, Session, VerificationToken); dev PostgreSQL (Docker Postgres 16) via `bunx prisma migrate dev`; init migration `20260813000605_init` aplicada |
| US-005 | Como desenvolvedor, preciso que o Auth.js v5 esteja configurado com Google OAuth e magic link | Login funcional com Google e envio de magic link por email | **Entregue (F2A)** — `next-auth@5.0.0-beta.32` pinado (ADR-010); Google condicional a `AUTH_GOOGLE_ID`/`AUTH_GOOGLE_SECRET` + `EmailProvider` magic link; ver task 9 |
| US-006 | Como designer, preciso que o design system (shadcn/ui) esteja padronizado com temas claro/escuro | Componentes renderizando em ambos os temas, tokens centralizados | **Entregue (F2B)** — Tailwind v4 + shadcn/ui configurados; tokens oklch centralizados em `src/app/globals.css` (`:root`/`.dark`); claro/escuro via `next-themes`; ver tasks 12-14 |

---

## Tasks Detalhadas

> Itens marcados `[x]` correspondem ao que foi entregue no esqueleto (estado em `docs/02-architecture/monorepo.md` §1).

### Configuração do Monorepo
- [x] 1. Inicializar app único Next.js 16 na raiz do repo (MVP monolito) — monorepo Turborepo + pnpm adiado para ADR-005
- [x] 2. Configurar `src/` (App Router + TypeScript 5) — `src/app/`, `src/lib/`, `src/types/`, `src/components/`, `src/services/`, `src/stores/`
- [ ] 3. Configurar `packages/shared` (ui, types, config) — **não se aplica ao MVP monolito**
- [x] 4. Definir estrutura de pastas padrão (feature-based) — raiz do app

### Banco de Dados
- [ ] 5. Setup Docker Compose (web, postgres, redis) — **pendente**
- [x] 6. Configurar Prisma ORM — `src/lib/prisma.ts` (singleton), schema stub `User` + enums (`UserRole`, `UserPlan`, `AuthProvider`)
- [x] 7. Stub inicial: model `User` — demais entidades (18, 5 domínios) documentadas em `docs/03-database/entities.md`; migrations versionadas pendentes
- [x] 8. Configurar seed script — `prisma/seed.ts` (admin + test user, upsert idempotente), `bun run seed` (`bunx tsx prisma/seed.ts` em `scripts.seed` e `prisma.seed`)

### Autenticação
- [x] 9. Setup Auth.js v5 (Google OAuth, magic link, JWT strategy) — **entregue (F2A)** — `next-auth@5.0.0-beta.32` pinado (ADR-010, supersede a cláusula v4 do ADR-009); `src/auth/auth.config.ts` (edge: Google condicional a `AUTH_GOOGLE_ID`/`AUTH_GOOGLE_SECRET` + `EmailProvider` magic link), adapter mínimo `src/auth/prisma-adapter.ts` (VerificationToken/User; sem model `Account`), `src/auth/auth.ts` (node, JWT strategy), handler `src/app/api/auth/[...nextauth]`; `providerId` EMAIL = e-mail minúsculo (H-2, ver `prisma/schema.prisma` header)
- [x] 10. Configurar middleware de proteção de rotas — **entregue (F2A)** — `src/proxy.ts` (Next 16) com matcher `/dashboard/:path*`, validando via `getToken({ secret: AUTH_SECRET })`; **F2B** adicionou defesa em profundidade: guard de auth no layout do route group `src/app/(app)/layout.tsx` (server component: `auth()` + `redirect("/login")` sem sessão)
- [x] 11. Páginas de login/callback funcionais — **entregue (F2A)** — `src/app/(auth)/login` (Google + magic link) e `src/app/(app)/dashboard` (sessão + sign out); callbacks nos caminhos fixos do Auth.js (`/api/auth/callback/*`)

### Design System
- [x] 12. Configurar shadcn/ui (dark/light theme) — **entregue (F2B)** — `shadcn init` (shadcn@4.17, preset **radix-nova** — "New York" na CLI atual via `-b radix` + `-p nova`); `components.json` (style `radix-nova`, alias `@/components/ui`); Tailwind v4 via `postcss.config.mjs` (plugin `@tailwindcss/postcss`)
- [x] 13. Definir design tokens — **entregue (F2B)** — tokens oklch `:root`/`.dark` em `src/app/globals.css` (`@custom-variant dark`, `tw-animate-css` + `shadcn/tailwind.css`; fonte `--font-geist-sans`)
- [x] 14. Criar componentes base — **entregue (F2B)** — `src/components/ui/`: Button, Card, Input, Label, Skeleton, Alert (CLI radix-nova) + `form.tsx` escrito à mão (o registry radix-nova não inclui `form`; adaptado do fonte New York); `src/lib/utils.ts` (`cn`)
- [ ] 15. Setup Storybook para documentação visual — **pendente**

### CI/CD e Observabilidade
- [x] 16. GitHub Actions: pipeline lint → test → build → deploy — **entregue (F3)**
- [x] 17. Vercel project setup com ambiente de staging — **entregue (F3)**
- [ ] 18. Error tracking (Sentry) setup — **pendente (F4)**
- [ ] 19. Logging (Pino.js) configuration — **pendente (F4)**
- [x] 20. Health check endpoint (`/api/health`) — `src/app/api/health/route.ts` (envelope `{status,timestamp,version,services:{database}}`; DB com timeout 5s, 200 quando o check de DB passa, 503 só em falha dura)

### Documentação e Padrões
- [x] 21. Environment variables documentadas — `.env.example` (nomes apenas, sem segredos)
- [x] 22. ESLint configurado — `eslint.config.mjs` (eslint-config-next flat); Husky/lint-staged/Prettier implementados (F3)
- [x] 23. Landing page base — `src/app/page.tsx` + `layout.tsx` (pt-BR), `error`/`loading`/`not-found`
- [x] 24. Documentação da estrutura — `docs/02-architecture/monorepo.md` §1
- [x] 25. Documentação do setup local — `docs/02-architecture/deployment.md` §2 + `.env.example`

### Decisões Rastreadas (Clarifications)
- **providerId convention for EMAIL**: Set `providerId = email` normalized to lowercase (H-2). Aligns with existing `email @unique` constraint. Updates: `prisma/schema.prisma`, `docs/04-api/authentication.md`, `docs/03-database/entities.md`. See `sprint-0.clarifications.md` (session 2025-08-11).
- **LGPD 30-day soft-delete**: Soft delete with `deletedAt DateTime?` on User model (H-3). Existing `isActive` flag + new `deletedAt` for restoration window. Queries filter `isActive = true AND deletedAt IS NULL`. Restoration endpoint within 30-day window. See `sprint-0.clarifications.md` (session 2025-08-11).

---

## Critérios de Aceite do Sprint

- [x] Setup funcional do app único `bun` na raiz (esqueleto) — monorepo com builds isolados **adiado** (ADR-005)
- [x] Deploy automático em staging via GitHub Actions → Vercel — **entregue (F3)**
- [x] Autenticação funcionando com Google OAuth — **entregue (F2A)** — Auth.js v5 (ADR-010); login `/login` (Google + magic link), sessão JWT do Auth.js, proteção de `/dashboard` via `src/proxy.ts` + guard de grupo `src/app/(app)/layout.tsx` (F2B)
- [ ] Banco de dados conectado com migrations aplicadas — **parcial** (5 models + init `20260813000605_init` aplicada em dev PostgreSQL/Docker)
- [x] Design system com tema claro/escuro operacional — **entregue (F2B)** — Tailwind v4 + shadcn/ui (preset radix-nova), tokens oklch em `src/app/globals.css` (`:root`/`.dark`), `next-themes` (ThemeProvider/ThemeToggle), componentes base em `src/components/ui/`; ver tasks 12-14
- [x] Health check endpoint presente — 200 quando o check de DB passa; 503 apenas em falha dura; `status` do corpo derivado dos checks (`ok`/`degraded`)
- [x] Documentação de setup local completa

---

## Arquitetura Técnica (estado real)

```
arkana-agora/                  # Raiz = monolito MVP (bun)
├── src/
│   ├── app/                   # App Router (layout pt-BR, page, error/loading/not-found, globals.css)
│   │   ├── (auth)/login/      # Página de login (Card + toggle de tema)
│   │   ├── (app)/layout.tsx   # Guard de auth do route group (auth() + redirect("/login"))
│   │   └── api/health/        # GET /api/health (envelope; 200 quando DB ok, 503 em falha)
│   ├── components/            # providers.tsx (SessionProvider + ThemeProvider), theme-provider.tsx, theme-toggle.tsx, ui/ (shadcn radix-nova)
│   ├── lib/                   # src/lib/prisma.ts (Prisma singleton), src/lib/utils.ts (cn)
│   ├── services/              # (placeholder vazio)
│   ├── stores/                # (placeholder vazio)
│   └── types/                 # (placeholder vazio)
├── prisma/
│   ├── schema.prisma          # 5 models (User, UserProfile, Subscription, Session, VerificationToken) — PostgreSQL (Docker Postgres 16 dev / Neon prod)
│   ├── migrations/            # init 20260813000605_init (aplicada; lock postgresql)
│   └── seed.ts                # Seed admin + test (idempotente)
├── public/                    # Assets estáticos (vazio)
├── tests/                     # tests/health.test.ts + tests/ui-utils.test.ts (vitest)
├── package.json               # Scripts bun: dev, build, start, dev:ws, dev:all, lint, type-check, seed, test
├── next.config.ts             # output: "standalone" só fora da Vercel (#96646) + serverExternalPackages
├── tsconfig.json
├── eslint.config.mjs
├── vitest.config.ts
├── Dockerfile                 # multi-stage bun (deps → builder → runner)
├── docker-compose.yml         # postgres + redis + migrate + web
├── .dockerignore
└── .env.example               # Nomes de env vars documentados (sem segredos)

# Monorepo futuro (ADR-005, planejado): apps/web + packages/{ui,types,config,utils,api-client}
# com pnpm + Turborepo + turbo.json + pnpm-workspace.yaml — ainda não existe.
```

---

## Riscos

| Risco | Probabilidade | Impacto | Mitigação |
|-------|--------------|---------|-----------|
| Configuração Turborepo complexa | Média | Alto | Adiado para pós-MVP (ADR-005) — MVP é app único, sem overhead de monorepo |
| Compatibilidade Prisma/Postgres | Baixa | Alto | Usar versões testadas, Docker para ambiente idêntico |
| Google OAuth aprovação | Baixa | Médio | Preparar OAuth consent screen com antecedência |
| Tempo de setup maior que estimado | Média | Médio | Focar no essencial, adiar Storybook se necessário |

---

## Estimativa

> Estimativa original (planejamento). No reescopo, apenas o esqueleto foi entregue; as demais frentes seguem pendentes.

| Recurso | Horas | Dias Úteis |
|---------|-------|-------------|
| Monorepo + Turborepo | 16h | 2d |
| Docker + DB | 12h | 1,5d |
| Autenticação | 20h | 2,5d |
| Design System | 32h | 4d |
| CI/CD + Observabilidade | 16h | 2d |
| Documentação + Landing | 16h | 2d |
| **Total** | **~112h** | **14d (3 semanas)** |

---

## Entregáveis

**Entregues no esqueleto:**
- App único Next.js 16 (App Router) na raiz, toolchain `bun` — documentado em `docs/02-architecture/monorepo.md` §1
- Prisma schema com 5 models (User, UserProfile, Subscription, Session, VerificationToken) + init migration `20260813000605_init` aplicada; seed idempotente (admin + test); dev DB Docker Postgres 16 via `bunx prisma migrate dev`
- Rota `/api/health` (envelope `{status,timestamp,version,services:{database}}`; 200 quando DB ok, 503 em falha dura; Redis/IA adicionados quando conectados, per `observability.md` §6.3) + teste vitest
- Design system shadcn/ui (claro/escuro) — Tailwind v4 via `postcss.config.mjs` (`@tailwindcss/postcss`), `components.json` (style radix-nova), tokens oklch `:root`/`.dark` em `src/app/globals.css`, `src/lib/utils.ts` (`cn`), componentes `src/components/ui/` (Button, Card, Input, Label, Skeleton, Alert + `form.tsx` manual), `next-themes` (`providers.tsx`/`theme-provider.tsx`/`theme-toggle.tsx`), fonte Geist (`--font-geist-sans`) + `suppressHydrationWarning` no `layout.tsx`; `ThemeToggle` em `/login` e `/dashboard`
- `tsconfig.json`, `eslint.config.mjs`, `vitest.config.ts`, `next.config.ts`, `.env.example`
- Documentação de estrutura e setup local

**Pendentes (planejados):**
- Pipeline CI/CD (GitHub Actions) → Vercel
- Infraestrutura Docker Compose
- Migrations Prisma versionadas + tabelas completas (18 entidades, `docs/03-database/entities.md`)
- Autenticação Sprint 1: e-mail/senha (credentials), Facebook OAuth, Custom JWT Layer (access RS256 + refresh rotation) e rotas `/api/v1/auth/*` (rate limit de magic link, LGPD delete)
- Monorepo Turborepo + pnpm (ADR-005, pós-MVP)

**Decisões rastreadas para a Sprint 1 (não reversíveis de forma barata — ver `prisma/schema.prisma` header e `docs/infrastructure.md` → Known Constraints #3):**
- Banco de dados de dev: **Resolvido (F1)** — escolhido Docker Postgres 16 (`docker-compose.yml`); listas escalares (`String[]`) suportadas no dev; init migration gerada com datasource `postgresql`. See docs/infrastructure.md → Known Constraints.
- **providerId convention for EMAIL (H-2):** Set `providerId = email` normalized to lowercase (clarified 2025-08-11). Aligns with existing `email @unique` constraint. Updates: `prisma/schema.prisma`, `docs/04-api/authentication.md`, `docs/03-database/entities.md`. See `sprint-0.clarifications.md`.
- **LGPD 30-day soft-delete (H-3):** Soft delete with `deletedAt DateTime?` on User model (clarified 2025-08-11). Existing `isActive` flag + new `deletedAt` for restoration window. Queries filter `isActive = true AND deletedAt IS NULL`. Restoration endpoint within 30-day window. See `sprint-0.clarifications.md`.
- Conflito de enums RBAC: `entities.md`/schema (USER, PROFESSIONAL, ADMIN) vs antigo `permissions.md` (FREE_USER…SUPER_ADMIN) — alinhado em `docs/07-security/permissions.md`; `requirements.md` RNF-005 atualizado para o modelo alinhado (3 roles + SUPER_ADMIN planejado; plano FREE/PLUS é dimensão separada).
- **Resolvido (ADR-009):** `.specs/001-auth/design.md` reescrito para `UserRole` (USER/PROFESSIONAL/ADMIN + SUPER_ADMIN planejado) com plano `UserPlan` separado. Prefixo de rotas decidido: `/api/auth/*` = endpoints internos NextAuth (fixo da lib); `/api/v1/auth/*` = auth REST custom (incl. `POST /api/v1/auth/refresh` para rotação). `architecture.md` §2.2 atualizado; `authentication.md` mantém módulo `src/app/api/v1/auth/`.

---

## Clarifications

See `sprint-0.clarifications.md` for detailed decisions and coverage summary.

| Question | Decision | Impact |
|----------|----------|--------|
| H-2: providerId convention for EMAIL | `providerId = email` normalized to lowercase | Updates schema, auth docs, entities; aligns with `email @unique` |
| H-3: LGPD 30-day soft-delete design | Soft delete with `deletedAt DateTime?` | Adds `deletedAt` field to User model; restoration endpoint within 30-day window; queries filter `isActive = true AND deletedAt IS NULL` |
- **H-3 (LGPD 30-day soft-delete):** Pending decision — see clarifications artifact.
