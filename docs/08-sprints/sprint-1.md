# Sprint 1 — Core Features

> **Projeto**: Arkana Agora  
> **Identificador**: `arkana-agora`  
> **Duração**: 5 semanas  
> **Equipe**: 2-3 desenvolvedores  
> **Status**: Planejamento  
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
- [ ] 1a. Custom JWT Layer (Sprint 1): access token RS256 de 15 min + refresh token rotativo de 30 dias + `tokenVersion`/revogação server-side (model `Session`, ADR-009 Gate C; encerra a janela de não-revogação do ADR-010) — **parcial: `src/services/token-service.ts` + `src/lib/rate-limit.ts` + `src/lib/redis.ts` implementados; register (T6), login (T7), refresh (T13) e logout (T14) expostos**
- [ ] 1b. Rate limit do magic link (RF-AUTH-003: 3 links/hora) na rota `/api/v1/auth/magic-link`
- [x] 1c. Credentials e-mail/senha — Sprint 1 (ADR-010 §10) — **parcial: `POST /api/v1/auth/login` implementado (T7)**
- [ ] 1d. Facebook OAuth — Sprint 1 (ADR-010 §10)
- [ ] 1e. Model `Account` + backfill dos pares `provider`/`providerId` (multi-provedor por usuário, ADR-010 §5)
- [ ] 2. Tela de onboarding pós-cadastro (nome, data de nascimento)
- [ ] 3. Tela de perfil: editar dados pessoais, upload de avatar
- [ ] 4. Cálculo automático de signo zodiacal baseado na data de nascimento
- [ ] 5. Cálculo automático de Arcano Pessoal no perfil

### Motor de Tiragem
- [ ] 6. Motor de seleção aleatória de cartas (seed-based para reprodutibilidade)
- [ ] 7. Templates de espalhamento: Carta Única, Três Cartas, Sim/Não
- [ ] 8. Tela de tiragem com animações (Framer Motion: virar carta, revelação)
- [ ] 9. Modal de detalhe da carta (significado direito e esquerdo)
- [ ] 10. Dados completos do baralho Rider-Waite-Smith (78 cartas: 22 Arcanos Maiores + 56 Arcanos Menores)

### Inteligência Artificial
- [ ] 11. Integração com z-ai-web-dev-sdk para leituras tarológicas
- [ ] 12. SSE streaming para resposta IA em tempo real
- [ ] 13. Prompt engineering: interpretações contextuais (posição, cartas vizinhas)
- [ ] 14. Sistema de fallback caso IA esteja indisponível
- [ ] 15. Rate limiting por usuário para chamadas de IA

### Cálculos Esotéricos
- [ ] 16. Cálculo de Arcano Pessoal (método de Pitágoras: soma dígitos da data de nascimento)
- [ ] 17. Tabela numerológica completa integrada (1 a 22)
- [ ] 18. Tarot do dia (cálculo determinístico baseado em data + id do usuário)
- [ ] 19. Algoritmo de signo zodiacal com datas precisas

### Banco de Dados
- [ ] 20. Tabela `Reading`: registro de cada tiragem
- [ ] 21. Tabela `Card`: dados das cartas do baralho
- [ ] 22. Tabela `TarotDeck`: configuração de baralhos disponíveis
- [ ] 23. Tabela `ArcanaCalculation`: histórico de cálculos
- [ ] 24. Seed data: baralhos completos, espalhamentos padrão

### Experiência Mobile (PWA)
- [ ] 25. `manifest.json` com ícones, cores e metadados
- [ ] 26. Service worker para cache de assets e dados
- [ ] 27. Offline fallback page para funcionalidades básicas
- [ ] 28. Responsive design mobile-first em todas as telas
- [ ] 29. Navegação mobile (bottom tabs): Home, Tirar, Histórico, Perfil

### UX e Qualidade
- [ ] 30. Loading states e skeleton screens em todas as telas
- [ ] 31. Toast notifications (sonner) para feedback de ações
- [ ] 32. Error boundaries para tratamento gracioso de erros
- [ ] 33. Página de histórico de tiragens com paginação

### Testes
- [ ] 34. Testes unitários: cálculos numerológicos (Arcano Pessoal, signo)
- [ ] 35. Testes unitários: motor de seleção de cartas
- [ ] 36. Testes E2E: fluxo completo de tiragem (Playwright)
- [ ] 37. Testes E2E: fluxo de cadastro → primeira tiragem

### Marketing e Analytics
- [ ] 38. SEO: meta tags dinâmicas, Open Graph images
- [ ] 39. Analytics: PostHog events (signup, reading, ai_interpretation)
- [ ] 40. Landing page completa: hero, features, pricing, FAQ, footer

---

## Critérios de Aceite do Sprint

- [x] Usuário consegue cadastrar via Google OAuth ou email
- [x] Perfil exibe signo e arcano pessoal calculados automaticamente
- [x] Tiragem de 3 cartas com animação de virar cartas
- [x] Interpretação IA gerada com streaming em tempo real
- [x] Tarot do dia exibido na home logada
- [x] Arcano Pessoal calculado corretamente (método Pitágoras)
- [x] Histórico de tiragens acessível e paginado
- [x] PWA instalável no celular, funcionando em modo offline parcial
- [x] Landing page completa e otimizada para SEO

---

## Dependências

| Dependência | Tipo | Status |
|------------|------|--------|
| Sprint 0 completo | Bloqueante | Necessário |
| z-ai-web-dev-sdk configurada | Externa | Verificar disponibilidade |
| Assets das 78 cartas (Rider-Waite) | Conteúdo | Preparar antes do início |

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
