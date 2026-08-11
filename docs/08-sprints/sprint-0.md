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
| US-004 | Como DBA, preciso que o Prisma schema defina as tabelas base (User, Profile, Subscription) | Migrations aplicáveis, dados persistindo no PostgreSQL | **Parcial** — `prisma/schema.prisma` com stub `User` + enums; dev SQLite `file:./dev.db` via `db push` |
| US-005 | Como desenvolvedor, preciso que o NextAuth.js esteja configurado com Google OAuth e magic link | Login funcional com Google e envio de magic link por email | **Pendente** — dependência instalada, sem lógica de auth |
| US-006 | Como designer, preciso que o design system (shadcn/ui) esteja padronizado com temas claro/escuro | Componentes renderizando em ambos os temas, tokens centralizados | **Pendente** — sem shadcn/ui/Tailwind configurados ainda |

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
- [x] 8. Configurar seed script — `prisma/seed.ts` (no-op), `bun run seed`

### Autenticação
- [ ] 9. Setup NextAuth.js v4 (Google OAuth, magic link, JWT strategy) — **pendente**
- [ ] 10. Configurar middleware de proteção de rotas — **pendente**
- [ ] 11. Páginas de login/callback funcionais — **pendente**

### Design System
- [ ] 12. Configurar shadcn/ui (New York style, dark/light theme) — **pendente**
- [ ] 13. Definir design tokens — **pendente**
- [ ] 14. Criar componentes base — **pendente**
- [ ] 15. Setup Storybook para documentação visual — **pendente**

### CI/CD e Observabilidade
- [ ] 16. GitHub Actions: pipeline lint → test → build → deploy — **pendente**
- [ ] 17. Vercel project setup com ambiente de staging — **pendente**
- [ ] 18. Error tracking (Sentry) setup — **pendente**
- [ ] 19. Logging (Pino.js) configuration — **pendente**
- [x] 20. Health check endpoint (`/api/health`) — `src/app/api/health/route.ts` (envelope; retorna 503 até serviços configurados)

### Documentação e Padrões
- [x] 21. Environment variables documentadas — `.env.example` (nomes apenas, sem segredos)
- [x] 22. ESLint configurado — `eslint.config.mjs` (eslint-config-next flat); Husky/lint-staged/Prettier ainda não
- [x] 23. Landing page base — `src/app/page.tsx` + `layout.tsx` (pt-BR), `error`/`loading`/`not-found`
- [x] 24. Documentação da estrutura — `docs/02-architecture/monorepo.md` §1
- [x] 25. Documentação do setup local — `docs/02-architecture/deployment.md` §2 + `.env.example`

---

## Critérios de Aceite do Sprint

- [x] Setup funcional do app único `bun` na raiz (esqueleto) — monorepo com builds isolados **adiado** (ADR-005)
- [ ] Deploy automático em staging via GitHub Actions → Vercel — **pendente** (sem pipeline criado)
- [ ] Autenticação funcionando com Google OAuth — **pendente**
- [ ] Banco de dados conectado com migrations aplicadas — **parcial** (stub `User`, SQLite dev via `db push`)
- [ ] Design system com tema claro/escuro operacional — **pendente**
- [x] Health check endpoint presente — retorna 503 (não 200) até serviços configurados
- [x] Documentação de setup local completa

---

## Arquitetura Técnica (estado real)

```
arkana-agora/                  # Raiz = monolito MVP (bun)
├── src/
│   ├── app/                   # App Router (layout pt-BR, page, error/loading/not-found, globals.css)
│   │   └── api/health/        # GET /api/health (envelope; 503 até serviços configurados)
│   ├── components/            # (placeholder vazio)
│   ├── lib/                   # src/lib/prisma.ts (Prisma singleton)
│   ├── services/              # (placeholder vazio)
│   ├── stores/                # (placeholder vazio)
│   └── types/                 # (placeholder vazio)
├── prisma/
│   ├── schema.prisma          # Stub User + enums (SQLite dev / PostgreSQL Neon prod)
│   └── seed.ts                # Seed no-op
├── public/                    # Assets estáticos (vazio)
├── tests/                     # tests/health.test.ts (vitest)
├── package.json               # Scripts bun: dev, build, start, dev:ws, dev:all, lint, type-check, seed, test
├── next.config.ts
├── tsconfig.json
├── eslint.config.mjs
├── vitest.config.ts
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
- Prisma stub (`User` + enums) + seed no-op; dev DB SQLite via `bunx prisma db push`
- Rota `/api/health` (envelope; 503 até serviços configurados) + teste vitest
- `tsconfig.json`, `eslint.config.mjs`, `vitest.config.ts`, `next.config.ts`, `.env.example`
- Documentação de estrutura e setup local

**Pendentes (planejados):**
- Pipeline CI/CD (GitHub Actions) → Vercel
- Infraestrutura Docker Compose
- Migrations Prisma versionadas + tabelas completas (18 entidades, `docs/03-database/entities.md`)
- Autenticação NextAuth.js (Google OAuth, magic link)
- Design system shadcn/ui (claro/escuro)
- Monorepo Turborepo + pnpm (ADR-005, pós-MVP)
