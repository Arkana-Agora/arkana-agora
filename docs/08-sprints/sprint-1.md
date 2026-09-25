# Sprint 1 — Core Features

> **Projeto**: Arkana Agora  
> **Identificador**: `arkana-agora`  
> **Duração**: 5 semanas  
> **Equipe**: 2-3 desenvolvedores  
> **Status**: Concluído (parcial — escopo Sprint 1 implementado; itens 1d/1e/2 adiados)  
> **Dependência**: Sprint 0 completo

---

## Objetivo

Entregar o MVP funcional da plataforma Arkana Agora, permitindo que usuários se cadastrem, realizem tiragens de Tarot com interpretação por IA, calculem seu Arcano Pessoal e acessem a plataforma via celular (PWA).

---

## User Stories

| # | User Story | Critério de Aceite | Prioridade |
|---|-----------|-------------------|------------|
| US-010 | Como usuário, quero me cadastrar com email ou Google para acessar a plataforma | Fluxo completo de cadastro, login e sessão persistente | Crítica |
| US-011 | Como usuário, quero criar meu perfil com data de nascimento para calcular meu signo e arcano | Perfil editável, cálculos exibidos automaticamente | Crítica |
| US-012 | Como usuário, quero realizar uma tiragem de 3 cartas para entender meu momento | Seleção animada de cartas, resultado exibido corretamente | Crítica |
| US-013 | Como usuário, quero ver meu tarot do dia ao abrir o app | Carta do dia calculada e exibida na home | Alta |
| US-014 | Como usuário, quero receber uma interpretação IA da minha tiragem | Texto gerado por IA com streaming em tempo real | Crítica |
| US-015 | Como usuário, quero calcular meu Arcano Pessoal com data e nome | Cálculo de Pitágoras correto, resultado detalhado | Alta |
| US-016 | Como usuário, quero ver meu histórico de tiragens | Lista paginada com filtros por data e tipo | Média |
| US-017 | Como usuário, quero acessar a plataforma pelo celular (PWA) | App instalável, funcionando offline para dados em cache | Alta |

---

## Tasks Detalhadas

### Autenticação e Perfil
- [x] 1. Tela de cadastro/login com Google OAuth e email (magic link) — **implementado no Sprint 0 (F2A, ADR-010)**
- [x] 1a. Custom JWT Layer (Sprint 1): access token RS256 de 15 min + refresh token rotativo de 30 dias + `tokenVersion`/revogação server-side — **`src/services/token-service.ts` + `src/lib/rate-limit.ts` + `src/lib/redis.ts` + 8 rotas `/api/v1/auth/*`**
- [x] 1b. Rate limit do magic link (RF-AUTH-003: 3 links/hora) na rota `/api/v1/auth/magic-link` — **implementado**
- [x] 1c. Credentials e-mail/senha — Sprint 1 (ADR-010 §10) — **register/login + LoginForm/RegisterForm/MagicLinkForm/ForgotPasswordForm**
- [ ] 1d. Facebook OAuth — Sprint 1 (ADR-010 §10) — **adiado (fora do escopo implementado)**
- [ ] 1e. Model `Account` + backfill dos pares `provider`/`providerId` (multi-provedor, ADR-010 §5) — **adiado (fora do escopo)**
- [ ] 2. Tela de onboarding pós-cadastro (nome, data de nascimento) — **adiado (fora do escopo)**
- [x] 3. Tela de perfil: editar dados pessoais, upload de avatar — **`/perfil/editar`, ProfileEditForm, AvatarUpload** — **2026-09-24:** `/perfil` deixou de ser redirect e virou página real "Meu perfil" (`OwnProfile`); `/perfil/:username` permanece perfil público
- [x] 4. Cálculo automático de signo zodiacal baseado na data de nascimento — **ProfileAstrology + profile route auto-calc**
- [x] 5. Cálculo automático de Arcano Pessoal no perfil — **`personalArcana` em `User`** (não `UserProfile`) + SPEC-005; recalculado no `PATCH /api/v1/users/me/profile` e persistido (best-effort) por `GET /api/v1/arcana/calculate`

### Motor de Tiragem
- [x] 6. Motor de seleção aleatória de cartas (seed-based para reprodutibilidade) — **`src/lib/tarot/{seed,shuffle,draw}.ts`**
- [x] 7. Templates de espalhamento: Carta Única, Três Cartas, Sim/Não — **`src/data/spreads.json` + `spreads.ts`**
- [x] 8. Tela de tiragem com animações (Framer Motion: virar carta, revelação) — **TarotCard 3D + ReadingSession + `/tirar`**
- [x] 9. Modal de detalhe da carta (significado direito e esquerdo) — **CardDetailPanel**
- [x] 10. Dados completos do baralho Rider-Waite-Smith (78 cartas) — **`src/data/decks/rws.json`**

### Inteligência Artificial
- [x] 11. Integração com SDK IA para leituras tarológicas — **`openai` SDK (`src/lib/ai/client.ts`), models em `src/lib/ai/models.ts`**
- [x] 12. SSE streaming para resposta IA em tempo real — **`/api/v1/ai/{interpret,follow-up}` + ReadingAIPanel**
- [x] 13. Prompt engineering: interpretações contextuais (posição, cartas vizinhas) — **`src/lib/ai/prompts` builder**
- [x] 14. Sistema de fallback caso IA esteja indisponível — **retry + cache fallback (`ai-service`)**
- [x] 15. Rate limiting por usuário para chamadas de IA — **`src/lib/ai/rate-limit.ts`**

### Cálculos Esotéricos
- [x] 16. Cálculo de Arcano Pessoal (método de Pitágoras) — **`src/lib/arcana` + `/api/v1/arcana/calculate`; `/meu-arcano` pré-preenche a partir do arcano salvo; cálculo TZ-independente (getters UTC)**
- [x] 17. Tabela numerológica completa integrada (1 a 22) — **PYTHAGOREAN_TABLE + ARCANA_MAP**
- [x] 18. Tarot do dia (cálculo determinístico data + id) — **`src/lib/tarot/daily.ts` + DailyTarot**
- [x] 19. Algoritmo de signo zodiacal com datas precisas — **profile-astrology calc**

### Banco de Dados
- [x] 20. Tabela `Reading`: registro de cada tiragem — **Prisma model Reading**
- [x] 21. Tabela `Card`: dados das cartas do baralho — **JSON decks + ReadingCard (cards via deck JSON)**
- [x] 22. Tabela `TarotDeck`: configuração de baralhos disponíveis — **deck JSON + `src/lib/tarot/decks.ts` (não model Prisma dedicado)**
- [x] 23. Tabela `ArcanaCalculation`: histórico de cálculos — **criada (`arcana_calculations`); persistida em `GET /api/v1/arcana/calculate`**
- [x] 24. Seed data: baralhos completos, espalhamentos padrão — **`rws/thoth/lenormand.json` + `spreads.json`**

### Experiência Mobile (PWA)
- [x] 25. `manifest.json` com ícones, cores e metadados — **T106**
- [x] 26. Service worker para cache de assets e dados — **T107**
- [x] 27. Offline fallback page para funcionalidades básicas — **T108**
- [x] 28. Responsive design mobile-first em todas as telas — **shadcn + Tailwind**
- [x] 29. Navegação mobile (bottom tabs): Home, Tirar, Histórico, Perfil — **T110 MobileNav** — **2026-09-24:** adicionado `AppHeader` desktop (5 itens, active-state prefix via `isAppNavActive` de `src/lib/navigation.ts`) + `BackLink` compartilhado; MobileNav permanece mobile-only (4 itens, exact-match)

### UX e Qualidade
- [x] 30. Loading states e skeleton screens em todas as telas — **T111 Skeleton + skeletons nas páginas**
- [x] 31. Toast notifications (sonner) para feedback de ações — **T112**
- [x] 32. Error boundaries para tratamento gracioso de erros — **T113**
- [x] 33. Página de histórico de tiragens com paginação — **`/minhas-tiragens` prev/next**

### Testes
- [x] 34. Testes unitários: cálculos numerológicos (Arcano Pessoal, signo) — **`tests/arcana.test.ts` + arcana component tests**
- [x] 35. Testes unitários: motor de seleção de cartas — **`tests/tarot-*.test.ts` + `tests/lib/tarot/daily.test.ts`**
- [x] 36. Testes E2E: fluxo completo de tiragem (Playwright) — **`tests/e2e/tarot-flows.spec.ts` (T065)**
- [x] 37. Testes E2E: fluxo de cadastro → primeira tiragem — **`tests/e2e/full-flow.spec.ts` (T118) + `auth-flow.spec.ts`**

### Marketing e Analytics
- [x] 38. SEO: meta tags dinâmicas, Open Graph images — **T114 generateMetadata + og-image route (T050 sharp)**
- [x] 39. Analytics: PostHog events (signup, reading, ai_interpretation) — **T115 `src/lib/analytics.ts` + consent banner**
- [x] 40. Landing page completa: hero, features, pricing, FAQ, footer — **T116**

---

## Critérios de Aceite do Sprint

- [x] Usuário consegue cadastrar via Google OAuth ou email
- [x] Perfil exibe signo e arcano pessoal calculados automaticamente
- [x] Tiragem de 3 cartas com animação de virar cartas
- [x] Interpretação IA gerada com streaming em tempo real
- [x] Tarot do dia exibido na home logada (`/dashboard`)
- [x] Arcano Pessoal calculado corretamente (método Pitágoras)
- [x] Histórico de tiragens acessível e paginado
- [x] PWA instalável no celular, funcionando em modo offline parcial
- [x] Landing page completa e otimizada para SEO

> **Nota de escopo**: itens 1d (Facebook OAuth), 1e (model Account) e 2 (onboarding page) **não implementados** no escopo atual — adiados. Task 23 (`ArcanaCalculation`) implementada (`prisma/migrations/20260923183900_add_arcana_calculations`).

---

## Dependências

| Dependência | Tipo | Status |
|------------|------|--------|
| Sprint 0 completo | Bloqueante | Atendido |
| SDK de IA configurada (OpenAI; openai SDK) | Externa | Configurado (`AI_API_KEY`/`AI_MODEL`) |
| Assets das 78 cartas (Rider-Waite) | Conteúdo | Embutidos em `src/data/decks/*.json` |

---

## Riscos

| Risco | Probabilidade | Impacto | Mitigação |
|-------|--------------|---------|-----------|
| Qualidade das interpretações IA | Média | Alto | Iterar prompts, testar com tarólogos |
| Latência SSE streaming | Média | Médio | Timeout configs, loading animado |
| Animações de cartas complexas | Baixa | Baixo | Usar Framer Motion, testar em devices lentos |
| PWA cache staleness | Média | Médio | Cache invalidation strategy, versioning |

---

## Estimativa

| Módulo | Horas | Dias Úteis |
|--------|-------|-------------|
| Auth + Perfil | 48h | 6d |
| Motor de Tiragem | 56h | 7d |
| IA (SSE + prompts) | 48h | 6d |
| Cálculos Esotéricos | 24h | 3d |
| DB + Seeds | 16h | 2d |
| PWA + Mobile | 40h | 5d |
| UX + Loading States | 24h | 3d |
| Testes | 24h | 3d |
| Landing + SEO | 24h | 3d |
| **Total** | **~304h** | **38d (5 semanas)** |

---

## Entregáveis

- Plataforma funcional com auth, perfil e tiragem de Tarot
- Interpretação IA com streaming em tempo real
- Tarot do dia e Arcano Pessoal calculados
- PWA instalável no celular
- Landing page completa com SEO
- Suíte de testes (unitários + E2E)
