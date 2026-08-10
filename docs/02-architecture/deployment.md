# Estratégia de Deploy — arkana-agora

> Versão: 1.0 | Última atualização: 2025-07-11

---

## 1. Ambientes

| Ambiente | Propósito | URL | Banco de Dados |
|----------|-----------|-----|----------------|
| **Development** | Desenvolvimento local | `http://localhost:3000` | SQLite local |
| **Staging** | Testes e QA | `staging.akashaverso.com.br` | Neon PostgreSQL (staging) |
| **Production** | Produção | `akashaverso.com.br` | Neon PostgreSQL (prod) |

---

## 2. Desenvolvimento Local

### 2.1 Stack Local

```
┌───────────────────────────────────────────────────┐
│              Caddy (port 80/443)                  │
│         SSL automático, proxy reverso              │
└────┬──────────────┬──────────────┬────────────────┘
     │              │              │
     ▼              ▼              ▼
┌──────────┐ ┌──────────┐ ┌──────────────┐
│ Next.js  │ │Socket.io │ │ BullMQ       │
│ :3000    │ │ :3003    │ │ :3005 (fut.) │
└────┬─────┘ └────┬─────┘ └──────┬───────┘
     │            │              │
     ▼            ▼              ▼
┌──────────┐ ┌──────────┐ ┌──────────┐
│ SQLite   │ │ Redis    │ │ File     │
│ (Prisma) │ │ :6379    │ │ Storage  │
└──────────┘ └──────────┘ └──────────┘
```

### 2.2 Comandos de Desenvolvimento

```bash
# Instalar dependências
bun install

# Rodar migrações (dev usa db push para simplicidade)
bunx prisma db push

# Gerar tipos Prisma
bunx prisma generate

# Popular dados iniciais (baralhos, spreads)
bun run seed

# Iniciar aplicação web
bun run dev          # Next.js na porta 3000

# Iniciar Socket.io service
bun run dev:ws       # Socket.io na porta 3003

# Iniciar tudo (com Caddy)
bun run dev:all
```

### 2.3 Variáveis de Ambiente (`.env.local`)

```env
# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_WS_URL=ws://localhost:3003

# Banco (dev)
DATABASE_URL=file:./dev.db

# Auth
NEXTAUTH_SECRET=dev-secret-change-me
NEXTAUTH_URL=http://localhost:3000
GOOGLE_CLIENT_ID=dev-google-id
GOOGLE_CLIENT_SECRET=dev-google-secret
FACEBOOK_CLIENT_ID=dev-fb-id
FACEBOOK_CLIENT_SECRET=dev-fb-secret

# IA
Z_AI_API_KEY=dev-ai-key

# Mercado Pago (sandbox)
MP_ACCESS_TOKEN=TEST-xxxxx
MP_WEBHOOK_URL=http://localhost:3000/api/payments/webhook

# Redis
REDIS_URL=redis://localhost:6379

# Observabilidade
SENTRY_DSN=
POSTHOG_KEY=
```

---

## 3. Staging

### 3.1 Infraestrutura

| Serviço | Provedor | Detalhes |
|---------|----------|----------|
| Web App | **Vercel** (Preview) | Deploy automático em PRs para `main` |
| WebSocket | **Railway** | Instância pequena ($5/mês) |
| PostgreSQL | **Neon** | Branch de banco para staging |
| Redis | **Upstash** | Plano gratuito |
| CDN | Cloudflare | Cache de assets estáticos |
| Pagamentos | **Mercado Pago Sandbox** | Testes sem transações reais |

### 3.2 Deploy de Preview

Toda PR para `main` gera um deploy de preview na Vercel:

```
PR #42 → https://arkana-agora-git-pr-42-team.vercel.app
```

O pipeline de CI executa antes do deploy:

```
Lint → Type Check → Unit Tests → Build → Preview Deploy
```

---

## 4. Produção

### 4.1 Arquitetura de Deploy

```
                    ┌─────────────────────────────┐
                    │     Cloudflare CDN           │
                    │  akashaverso.com.br          │
                    │  Cache estático, DDoS, WAF   │
                    └──────────┬──────────────────┘
                               │
              ┌────────────────┼────────────────┐
              │                │                │
              ▼                ▼                ▼
     ┌─────────────┐  ┌──────────────┐  ┌──────────────┐
     │   Vercel     │  │   Railway     │  │   Railway     │
     │   (Web)      │  │   (WS)       │  │   (Worker)   │
     │   Next.js    │  │   Socket.io  │  │   BullMQ     │
     │   Serverless │  │   :3003      │  │   (futuro)   │
     └──────┬──────┘  └──────┬───────┘  └──────┬───────┘
            │                │                 │
            ▼                ▼                 ▼
     ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
     │   Neon       │ │   Upstash    │ │  Cloudflare  │
     │  PostgreSQL  │ │    Redis     │ │      R2      │
     │  (Serverless)│ │  (Sessions,  │ │  (Imagens de │
     │              │ │   Cache)     │ │   cartas)    │
     └──────────────┘ └──────────────┘ └──────────────┘
```

### 4.2 Serviços de Produção

| Serviço | Provedor | Plano Estimado | Custo/mês |
|---------|----------|----------------|-----------|
| Web (Next.js) | **Vercel** (Pro) | Serverless, auto-scale | $20 |
| WebSocket | **Railway** | 1 instância (512MB RAM) | $5 |
| PostgreSQL | **Neon** | Pro (0.25 vCPU, 1GB RAM) | $19 |
| Redis | **Upstash** | Pay-as-you-go | ~$5 |
| CDN + DNS | **Cloudflare** | Pro (se necessário) | $0-20 |
| Armazenamento | **Cloudflare R2** | Pay-as-you-go | ~$3 |
| IA (GPT-4o) | **OpenAI** (via z-ai-sdk) | Pay-per-token | Variável |
| Erros | **Sentry** | Team plan | $26 |
| Analytics | **PostHog** | Pay-as-you-go | ~$10 |
| **Total estimado** | | | **~$108/mês** |

### 4.3 Domínios e DNS

```
akashaverso.com.br          → Vercel (web app)
api.akashaverso.com.br     → Vercel (API routes) — alias para o mesmo deploy
ws.akashaverso.com.br      → Railway (Socket.io service)
assets.akashaverso.com.br  → Cloudflare R2 (imagens)
```

**Configuração Cloudflare**:
- DNS: Registros A/CNAME apontando para provedores
- SSL: Full (Strict) — certificados gerenciados pela Cloudflare
- Cache: TTL 1h para HTML, 30d para assets estáticos
- WAF: Regras para proteção contra bots e abuso
- Page Rules: Bypass cache para `/api/*` e `/_next/data/*`

---

## 5. Docker

### 5.1 Dockerfile (Web App)

```dockerfile
# ====================
# Estágio 1: Dependências
# ====================
FROM oven/bun:1 AS deps
WORKDIR /app
COPY package.json bun.lockb ./
RUN bun install --frozen-lockfile --production=false

# ====================
# Estágio 2: Build
# ====================
FROM oven/bun:1 AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN bunx prisma generate
RUN bun run build

# ====================
# Estágio 3: Produção
# ====================
FROM oven/bun:1 AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["bun", "server.js"]
```

### 5.2 Docker Compose (Stack Completa)

```yaml
# docker-compose.yml
version: '3.9'

services:
  web:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=postgresql://akasha:senha@postgres:5432/akasha_verso
      - REDIS_URL=redis://redis:6379
      - NEXTAUTH_SECRET=${NEXTAUTH_SECRET}
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_started

  ws:
    build:
      context: ./services/ws-service
    ports:
      - "3003:3003"
    environment:
      - REDIS_URL=redis://redis:6379
    depends_on:
      - redis

  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: akasha
      POSTGRES_PASSWORD: senha
      POSTGRES_DB: akasha_verso
    volumes:
      - pg_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U akasha"]
      interval: 5s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

  caddy:
    image: caddy:2-alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile
      - caddy_data:/data
    depends_on:
      - web
      - ws

volumes:
  pg_data:
  redis_data:
  caddy_data:
```

---

## 6. CI/CD — GitHub Actions

### 6.1 Pipeline Principal

```yaml
# .github/workflows/ci.yml
name: CI/CD

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  quality:
    name: Qualidade
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v1
      - run: bun install --frozen-lockfile
      - run: bunx prisma generate
      - run: bun run lint
      - run: bun run type-check

  test:
    name: Testes
    runs-on: ubuntu-latest
    needs: quality
    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
          POSTGRES_DB: akasha_test
        ports: ["5432:5432"]
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v1
      - run: bun install --frozen-lockfile
      - run: bunx prisma migrate deploy
        env:
          DATABASE_URL: postgresql://test:test@localhost:5432/akasha_test
      - run: bun run test:coverage
        env:
          DATABASE_URL: postgresql://test:test@localhost:5432/akasha_test
      - uses: codecov/codecov-action@v3
        with:
          files: ./coverage/lcov.info

  build:
    name: Build
    runs-on: ubuntu-latest
    needs: test
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v1
      - run: bun install --frozen-lockfile
      - run: bunx prisma generate
      - run: bun run build
      - uses: actions/upload-artifact@v4
        with:
          name: nextjs-build
          path: .next/

  deploy-staging:
    name: Deploy Staging
    runs-on: ubuntu-latest
    needs: build
    if: github.event_name == 'pull_request'
    # Deploy automático via Vercel (PR preview)

  deploy-production:
    name: Deploy Produção
    runs-on: ubuntu-latest
    needs: build
    if: github.ref == 'refs/heads/main' && github.event_name == 'push'
    steps:
      - uses: actions/checkout@v4
      - uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          vercel-args: '--prod'
```

### 6.2 Fluxo de Deploy

```
PR para main
  │
  ├─ CI: Lint → Type Check → Test → Build
  │
  ├─ ✅ Sucesso → Preview Deploy (Vercel)
  │    └── URL: pr-42-arkana-agora.vercel.app
  │
  └─ Code Review → Merge
       │
       └─ Deploy Produção (Vercel --prod)
            └── URL: akashaverso.com.br
```

---

## 7. Estratégia de Rollback

### 7.1 Web App (Vercel)

A Vercel mantém histórico de deploys. Rollback é instantâneo:

```bash
# Via CLI
vercel rollback [deployment-url]

# Via Dashboard Vercel
# 1. Acessar dashboard.vercel.com
# 2. Selecionar deploy anterior
# 3. Clicar "Promote to Production"
```

**Tempo estimado de rollback**: < 30 segundos

### 7.2 Banco de Dados (Migrações)

```bash
# Rollback de migration
bunx prisma migrate resolve --rolled-back [migration_name]

# Ou, em emergência, aplicar migration reversa manual
bunx prisma migrate deploy --schema=prisma/schema.prisma
```

**Checklist de rollback de migration**:
1. Notificar equipe no Slack
2. Verificar backup mais recente do Neon (point-in-time recovery)
3. Aplicar rollback da migration
4. Verificar integridade dos dados
5. Monitorar logs por erros pós-rollback

### 7.3 Socket.io Service (Railway)

```bash
# Railway permite rollback via CLI
railway up --rollback
# ou via dashboard: selecionar deploy anterior
```

---

## 8. Checklist de Deploy de Produção

- [ ] Todos os testes passando no CI
- [ ] Build sem warnings ou errors
- [ ] Migration do banco testada em staging
- [ ] Backup do banco realizado
- [ ] Variáveis de ambiente verificadas na Vercel/Railway
- [ ] DNS e SSL verificados no Cloudflare
- [ ] Health checks passando (`/api/health`)
- [ ] Sentry release criado
- [ ] PostHog feature flags atualizadas
- [ ] Rate limiting configurado
- [ ] Monitoramento de erros ativo (Slack alerts)

---

*Documento parte do SDD (Software Design Document) do arkana-agora.*
