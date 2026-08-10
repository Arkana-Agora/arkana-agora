# Sprint 0 — Infraestrutura Base

> **Projeto**: Arkana Agora  
> **Identificador**: `arkana-agora`  
> **Duração**: 3 semanas  
> **Equipe**: 2 desenvolvedores full-stack  
> **Status**: Planejamento

---

## Objetivo

Preparar toda a infraestrutura técnica necessária para o desenvolvimento acelerado dos próximos sprints. Este sprint estabelece a fundação do monorepo, pipelines de CI/CD, banco de dados, autenticação e design system.

---

## User Stories

| # | User Story | Critério de Aceite |
|---|-----------|-------------------|
| US-001 | Como desenvolvedor, preciso que o monorepo esteja configurado com Turborepo para desenvolvimento paralelo | Monorepo com `pnpm` + Turborepo, builds isolados por pacote, cache funcional |
| US-002 | Como devOps, preciso que o CI/CD esteja configurado no GitHub Actions para automação de testes e deploy | Pipeline executando lint → test → build → deploy em cada push |
| US-003 | Como desenvolvedor, preciso que o Docker Compose suba toda a stack (web, db, redis, ws) com um comando | `docker compose up` sobe todos os serviços sem erros |
| US-004 | Como DBA, preciso que o Prisma schema defina as tabelas base (User, Profile, Subscription) | Migrations aplicáveis, dados persistindo no PostgreSQL |
| US-005 | Como desenvolvedor, preciso que o NextAuth.js esteja configurado com Google OAuth e magic link | Login funcional com Google e envio de magic link por email |
| US-006 | Como designer, preciso que o design system (shadcn/ui) esteja padronizado com temas claro/escuro | Componentes renderizando em ambos os temas, tokens centralizados |

---

## Tasks Detalhadas

### Configuração do Monorepo
- [ ] 1. Inicializar monorepo com Turborepo + pnpm workspaces
- [ ] 2. Configurar `apps/web` (Next.js 16 + TypeScript 5)
- [ ] 3. Configurar `packages/shared` (ui, types, config)
- [ ] 4. Definir estrutura de pastas padrão (feature-based)

### Banco de Dados
- [ ] 5. Setup Docker Compose (web, postgres, redis)
- [ ] 6. Configurar Prisma ORM + PostgreSQL connection
- [ ] 7. Criar migrations iniciais: `User`, `UserProfile`, `Subscription`
- [ ] 8. Configurar seed script para dados de teste

### Autenticação
- [ ] 9. Setup NextAuth.js v4 (Google OAuth, magic link, JWT strategy)
- [ ] 10. Configurar middleware de proteção de rotas
- [ ] 11. Páginas de login/callback funcionais

### Design System
- [ ] 12. Configurar shadcn/ui (New York style, dark/light theme)
- [ ] 13. Definir design tokens: cores (paleta mística), tipografia, espaçamento
- [ ] 14. Criar componentes base: Button, Input, Card, Avatar, Dialog
- [ ] 15. Setup Storybook para documentação visual dos componentes

### CI/CD e Observabilidade
- [ ] 16. GitHub Actions: pipeline lint → test → build → deploy
- [ ] 17. Vercel project setup com ambiente de staging
- [ ] 18. Error tracking (Sentry) setup
- [ ] 19. Logging (Pino.js) configuration
- [ ] 20. Health check endpoint (`/api/health`)

### Documentação e Padrões
- [ ] 21. Environment variables documentadas (`.env.example`)
- [ ] 22. ESLint + Prettier + Husky + lint-staged
- [ ] 23. Landing page base (hero section, footer)
- [ ] 24. README do monorepo com instruções de setup
- [ ] 25. Documentação do setup local (guia passo a passo)

---

## Critérios de Aceite do Sprint

- [x] Monorepo funcional com builds isolados por pacote
- [x] Deploy automático em staging via GitHub Actions → Vercel
- [x] Autenticação funcionando com Google OAuth
- [x] Banco de dados conectado com migrations aplicadas
- [x] Design system com tema claro/escuro operacional
- [x] Health check retornando status 200
- [x] Documentação de setup local completa

---

## Arquitetura Técnica

```
arkana-agora/
├── apps/
│   └── web/          # Next.js 16 (App Router)
├── packages/
│   ├── ui/           # shadcn/ui + tokens
│   ├── types/        # TypeScript interfaces
│   └── config/       # Configurações compartilhadas
├── docker-compose.yml
├── turbo.json
├── pnpm-workspace.yaml
└── .env.example
```

---

## Riscos

| Risco | Probabilidade | Impacto | Mitigação |
|-------|--------------|---------|-----------|
| Configuração Turborepo complexa | Média | Alto | Seguir template oficial, documentar cada passo |
| Compatibilidade Prisma/Postgres | Baixa | Alto | Usar versões testadas, Docker para ambiente idêntico |
| Google OAuth aprovação | Baixa | Médio | Preparar OAuth consent screen com antecedência |
| Tempo de setup maior que estimado | Média | Médio | Focar no essencial, adiar Storybook se necessário |

---

## Estimativa

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

- Repositório monorepo configurado e documentado
- Pipeline CI/CD funcional
- Infraestrutura Docker Compose
- Schema Prisma com tabelas base
- Autenticação NextAuth.js operacional
- Design system com tema claro/escuro
- Landing page base
