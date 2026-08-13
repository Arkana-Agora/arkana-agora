# Estratégia de Monorepo — arkana-agora

> Versão: 1.0 | Última atualização: 2026-08-12

---

## 1. Estrutura Atual (MVP — Monolito)

O MVP do arkana-agora é uma aplicação **Next.js 16 monolítica** com toda a lógica em um único projeto na **raiz do repo**:

```
arkana-agora/                   # Raiz do projeto (monolito)
├── src/
│   ├── app/                   # App Router (páginas + API)
│   │   └── api/health/        # GET /api/health (envelope; 200 quando DB ok, 503 em falha)
│   ├── components/            # Componentes React (placeholder — vazio)
│   ├── lib/                   # Utilitários, Prisma (src/lib/prisma.ts; auth/IA pendentes)
│   │   └── version.ts         # APP_VERSION constant
│   ├── services/              # Lógica de negócio (placeholder — vazio)
│   ├── stores/                # Zustand stores (placeholder — vazio)
│   └── types/                 # Tipos TypeScript (placeholder — vazio)
├── prisma/
│   ├── schema.prisma          # Schema (5 models; datasource postgresql)
│   ├── migrations/            # init 20260813000605_init (aplicada)
│   └── seed.ts                # Seed admin + test user (idempotente)
├── public/                    # Assets estáticos (vazio)
├── tests/                     # Testes (tests/health.test.ts, vitest)
├── package.json               # Scripts bun: dev, build, lint, type-check, test, seed
├── next.config.ts             # output: "standalone" + serverExternalPackages
├── tsconfig.json
├── eslint.config.mjs
├── vitest.config.ts
├── Dockerfile                 # multi-stage bun (deps → builder → runner)
├── docker-compose.yml         # postgres + redis + migrate + web
├── .dockerignore
└── .env.example               # Nomes de env vars documentados (sem segredos)
```

**Status:** o esqueleto acima já existe na raiz (bun, Prisma PostgreSQL dev via Docker — `docker compose up -d postgres` + `bunx prisma migrate dev`, rota `/api/health`, vitest, ESLint, Dockerfile + docker-compose + .dockerignore desde a F1). `tailwind.config.ts` ainda **não** foi criado — Tailwind CSS 4 é planejado (`docs/02-architecture/architecture.md` §3.1). `backend/` e `frontend/` na raiz são placeholders vazios e não fazem parte desta estrutura.

**Racional**: Para o MVP, a simplicidade do monolito permite iteração rápida. Não há overhead de configuração de múltiplos pacotes, e o deploy é direto na Vercel.

---

## 2. Estrutura Futura (V1+ — Monorepo)

Quando o projeto evoluir para incluir mobile, admin e microsserviços, a estrutura migrará para:

```
arkana-agora/
├── apps/
│   ├── web/                   # Next.js 16 (aplicação web principal)
│   │   ├── src/
│   │   │   ├── app/           # App Router
│   │   │   ├── components/    # Componentes específicos do web
│   │   │   └── lib/           # Configuração web (auth, prisma)
│   │   ├── next.config.ts
│   │   ├── tailwind.config.ts
│   │   └── package.json
│   │
│   ├── mobile/                # Expo React Native
│   │   ├── src/
│   │   │   ├── app/           # Expo Router
│   │   │   ├── components/    # Componentes nativos
│   │   │   └── screens/       # Telas do app
│   │   ├── app.json
│   │   ├── eas.json           # EAS Build config
│   │   └── package.json
│   │
│   └── admin/                 # Next.js admin panel
│       ├── src/
│       │   ├── app/           # Rotas admin
│       │   └── components/    # Componentes admin
│       └── package.json
│
├── packages/
│   ├── ui/                    # Componentes UI compartilhados (shadcn/ui)
│   │   ├── src/
│   │   │   ├── components/    # Button, Card, Dialog, etc.
│   │   │   ├── primitives/    # Wrappers Radix UI
│   │   │   └── styles/        # Tokens de design
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── api-client/            # Cliente API compartilhado (web + mobile)
│   │   ├── src/
│   │   │   ├── client.ts      # Fetch/axios wrapper com auth
│   │   │   ├── readings.ts    # Endpoints de leituras
│   │   │   ├── social.ts      # Endpoints sociais
│   │   │   ├── auth.ts        # Endpoints de autenticação
│   │   │   └── marketplace.ts # Endpoints de marketplace
│   │   └── package.json
│   │
│   ├── types/                 # Tipos TypeScript compartilhados
│   │   ├── src/
│   │   │   ├── user.ts        # User, UserProfile, UserRole
│   │   │   ├── reading.ts     # Reading, Card, Spread
│   │   │   ├── social.ts      # Post, Comment, Follow
│   │   │   ├── marketplace.ts # Product, Order, Payment
│   │   │   └── index.ts       # Barrel export
│   │   └── package.json
│   │
│   ├── config/                # Configurações compartilhadas
│   │   ├── eslint/            # Regras ESLint compartilhadas
│   │   │   └── base.js
│   │   ├── typescript/        # tsconfig base
│   │   │   └── base.json
│   │   ├── tailwind/          # Config Tailwind compartilhada
│   │   │   └── config.ts
│   │   └── package.json
│   │
│   └── utils/                 # Utilitários compartilhados
│       ├── src/
│       │   ├── date.ts        # Formatação de datas (pt-BR)
│       │   ├── tarot.ts       # Cálculos de arcano, signos
│       │   ├── validation.ts  # Zod schemas compartilhados
│       │   └── format.ts      # Formatação (moeda BRL, etc.)
│       └── package.json
│
├── services/
│   ├── ai-service/            # Microsserviço de IA (futuro)
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   └── prompts/       # Templates de prompts
│   │   └── package.json
│   │
│   ├── ws-service/            # Serviço WebSocket (atual mini-service)
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── handlers/      # Event handlers
│   │   │   └── rooms.ts       # Gerenciamento de salas
│   │   └── package.json
│   │
│   └── worker/                # Jobs em background (futuro)
│       ├── src/
│       │   ├── jobs/          # Definição de jobs
│       │   │   ├── daily-horoscope.ts
│       │   │   ├── email-notifications.ts
│       │   │   └── image-processing.ts
│       │   └── queue.ts       # Config BullMQ
│       └── package.json
│
├── docs/                      # Documentação (SDD, ADRs, etc.)
│   └── sdd/
│       ├── 01-introduction/
│       ├── 02-architecture/
│       ├── 03-database/
│       └── ...
│
├── .specs/                    # Especificações de features
│   ├── readings/
│   ├── social/
│   └── marketplace/
│
├── turbo.json                 # Configuração Turborepo
├── pnpm-workspace.yaml        # Configuração pnpm workspaces
├── package.json                # Package raiz (scripts turbotopo)
└── .github/
    └── workflows/              # CI/CD pipelines
        ├── ci.yml
        └── deploy.yml
```

---

## 3. Ferramentas

### 3.1 Turborepo

**Turbo** é o orquestrador de build do monorepo:

```jsonc
// turbo.json
{
  "$schema": "https://turbo.build/schema.json",
  "globalDependencies": ["**/.env.*local"],
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**", "!.next/cache/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "lint": {
      "dependsOn": ["^build"]
    },
    "test": {
      "dependsOn": ["^build"]
    },
    "type-check": {
      "dependsOn": ["^build"]
    }
  }
}
```

**Benefícios**:
- **Cache de build**: Artefatos cacheados por hash de conteúdo — rebuilds instantâneos quando nada muda
- **Execução paralela**: `turbo run build` executa builds de pacotes independentes em paralelo
- **Topologia de dependências**: Garante que `packages/types` é buildado antes de `packages/api-client`
- **Pipeline incremental**: Apenas pacotes afetados por mudanças são reprocessados

### 3.2 pnpm Workspaces

```yaml
# pnpm-workspace.yaml
packages:
  - "apps/*"
  - "packages/*"
  - "services/*"
```

**Por que pnpm?**
- Instalação **3x mais rápida** que npm
- **Content-addressable storage** — pacotes duplicados são hard-linked, não copiados
- **Strict mode** — impede acesso a dependências não declaradas (evita dependências fantasmas)
- Suporte nativo a **workspaces**

---

## 4. Estratégia de Código Compartilhado

### 4.1 Matriz de Compartilhamento

| Pacote | web | mobile | admin | ws-service | ai-service |
|--------|:---:|:------:|:-----:|:----------:|:----------:|
| `@arkana/types` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `@arkana/ui` | ✅ | ❌* | ✅ | ❌ | ❌ |
| `@arkana/api-client` | ✅ | ✅ | ✅ | ❌ | ❌ |
| `@arkana/utils` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `@arkana/config` | ✅ | ✅ | ✅ | ✅ | ✅ |

> \* Mobile utilizará componentes nativos (Tamagui ou NativeWind), mas pode importar lógica de `@arkana/ui/primitives`

### 4.2 Versionamento

- **Estratégia**: Changesets (`@changesets/cli`)
- **Versionamento semântico**: SemVer para pacotes públicos
- **Coordenação de releases**: Todas as mudanças são coordenadas em um único release do monorepo
- **Changelog automático**: Gerado a partir dos changesets

```bash
# Fluxo de versionamento
pnpm changeset          # Cria changeset descrevendo a mudança
pnpm changeset version  # Bumpeia versões e atualiza changelogs
pnpm changeset publish  # Publica pacotes no registry
```

### 4.3 Convenções de Nomenclatura

- **Pacotes**: `@arkana/{nome}` — ex: `@arkana/types`, `@arkana/ui`
- **Apps**: sem prefixo — ex: `web`, `mobile`, `admin`
- **Services**: sem prefixo — ex: `ai-service`, `ws-service`

---

## 5. Caminho de Migração (Monolito → Monorepo)

### Fase 0: Preparação (Sprint atual)
- [x] Estrutura de pastas do monolito organizada por domínio
- [ ] Tipos extraídos para `src/types/` (preparação para `packages/types`)
- [ ] Utilitários isolados em `src/lib/` (preparação para `packages/utils`)
- [ ] Componentes UI identificáveis como compartilháveis ou específicos

### Fase 1: Extração de Pacotes (Sprint 3-4)
- [ ] Inicializar Turborepo e pnpm workspaces
- [ ] Extrair `packages/types` a partir de `src/types/`
- [ ] Extrair `packages/utils` a partir de `src/lib/utils/`
- [ ] Extrair `packages/config` (ESLint, TS, Tailwind)
- [ ] Atualizar imports no app web para usar pacotes

### Fase 2: Api Client Compartilhado (Sprint 5-6)
- [ ] Extrair `packages/api-client` com lógica de fetch e endpoints
- [ ] Refatorar web app para usar `@arkana/api-client`
- [ ] Adicionar `apps/mobile/` (Expo) consumindo `@arkana/api-client`

### Fase 3: Microsserviços (Sprint 7-8)
- [ ] Mover ws-service para `services/ws-service/`
- [ ] Criar `services/ai-service/` (separar lógica IA do web)
- [ ] Criar `services/worker/` (jobs em background com BullMQ)
- [ ] Configurar Event Bus inter-service (Redis Pub/Sub)

### Fase 4: Admin e Expansão (Sprint 9+)
- [ ] Adicionar `apps/admin/` (painel administrativo)
- [ ] Configurar CI/CD com Turborepo
- [ ] Configurar deploy independente por app/service

### Diagrama da Migração

```
Sprint 0-2          Sprint 3-4          Sprint 5-6          Sprint 7+
┌──────────┐      ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│ Monolito  │ ──▶ │ Monolito +   │──▶ │ Monorepo +   │──▶ │ Monorepo     │
│ (Next.js) │      │ packages/*   │    │ + mobile     │    │ completo     │
│           │      │              │    │              │    │              │
│ src/      │      │ packages/    │    │ apps/web/    │    │ apps/web/    │
│  types/   │      │  types/ ✅   │    │ apps/mobile/ │    │ apps/mobile/ │
│  lib/     │      │  utils/ ✅   │    │ apps/admin/  │    │ apps/admin/  │
│  ...      │      │  config/ ✅  │    │ packages/*   │    │ services/*   │
└──────────┘      └──────────────┘    └──────────────┘    └──────────────┘
```

---

## 6. Scripts do Turbotopo

```jsonc
// package.json (raiz)
{
  "scripts": {
    "dev": "turbo run dev",
    "dev:web": "turbo run dev --filter=web",
    "dev:mobile": "turbo run dev --filter=mobile",
    "build": "turbo run build",
    "test": "turbo run test",
    "lint": "turbo run lint",
    "type-check": "turbo run type-check",
    "clean": "turbo run clean && rm -rf node_modules"
  }
}
```

---

*Documento parte do SDD (Software Design Document) do arkana-agora.*
