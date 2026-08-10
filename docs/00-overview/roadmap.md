# Roadmap -- Arkana Agora

Roadmap de desenvolvimento do projeto `arkana-agora`, organizado em 5 fases ao longo de 26 semanas (aproximadamente 6 meses).

---

## Visao Geral das Fases

```
Fase 0 (Semanas 1-3)   Fase 1 (Semanas 4-8)   Fase 2 (Semanas 9-13)
[INFRA]                 [CORE]                  [SOCIAL]
  |                        |                        |
  v                        v                        v
Monorepo, CI/CD,       Auth, Perfil, Motor       Feed, Seguir,
Docker, DB, Auth base   de Tiragem, IA, Historico  Gifts, Compartilhar


Fase 3 (Semanas 14-20)  Fase 4 (Semanas 21-26)
[MONETIZACAO]           [EVOLUCAO]
  |                        |
  v                        v
Marketplace, Pagamentos,  Notificacoes, Chat,
Assinatura Plus, Versos   IA Avancada, Analytics
```

---

## Fase 0: Fundacao (Semanas 1-3)

> "Preparar o terreno antes de construir."

### Objetivo
Estabelecer a infraestrutura tecnica, ferramentas de desenvolvimento e pipelines de entrega.

### Entregaveis

| # | Entregavel | Semana | Dependencia |
|---|-----------|--------|-------------|
| 0.1 | Inicializacao do monorepo (Turborepo + pnpm) | 1 | -- |
| 0.2 | Configuracao do Next.js 16 + React 19 + TypeScript 5 | 1 | 0.1 |
| 0.3 | Setup do Tailwind CSS 4 + shadcn/ui | 1 | 0.2 |
| 0.4 | Docker Compose (app + PostgreSQL + Redis) | 1 | 0.1 |
| 0.5 | Prisma schema inicial + migrations | 2 | 0.4 |
| 0.6 | NextAuth.js v4 com providers (Google, Facebook) | 2 | 0.2 |
| 0.7 | CI/CD pipeline (GitHub Actions: lint, test, build) | 2 | 0.1 |
| 0.8 | ESLint + Prettier + Husky (pre-commit) | 1 | 0.1 |
| 0.9 | Banco de dados de referencia (cartas, selos, tons) | 2 | 0.5 |
| 0.10 | Estrutura de diretorios e organizacao de modulos | 1 | 0.1 |
| 0.11 | Design system base (cores, tipografia, componentes) | 3 | 0.3 |
| 0.12 | Ambiente de staging (Vercel Preview) | 3 | 0.7 |

### Milestones

- **M0.1** (Semana 1): Monorepo rodando localmente com Docker
- **M0.2** (Semana 2): Auth funcional com Google/Facebook + DB populado
- **M0.3** (Semana 3): Pipeline CI verde, deploy de preview automatico

### Riscos da Fase

| Risco | Probabilidade | Impacto | Mitigacao |
|-------|--------------|---------|----------|
| Incompatibilidade Next.js 16 + libs | Media | Alto | Testar cedo, pinar versoes |
| Complexidade do monorepo | Baixa | Medio | Seguir templates oficiais do Turborepo |

---

## Fase 1: Nucleo (Semanas 4-8)

> "O coracao da plataforma: tirar cartas e receber orientacao."

### Objetivo
Entregar o fluxo principal do produto: cadastro, leitura de cartas com IA e historico.

### Entregaveis

| # | Entregavel | Semana | Dependencia |
|---|-----------|--------|-------------|
| 1.1 | Tela de cadastro completo (nome, data nascimento, genero) | 4 | Fase 0 |
| 1.2 | Tela de login + recuperacao de senha | 4 | 0.6 |
| 1.3 | Perfil basico (nome, foto, bio, arcano pessoal) | 5 | 1.1 |
| 1.4 | Motor de tiragem: selecao aleatoria com animacao | 5 | 0.9 |
| 1.5 | 3 espalhamentos: Carta Unica, Passado/Presente/Futuro, Cruz Celta (5) | 5-6 | 1.4 |
| 1.6 | Componente de carta com animacao de revelacao (Framer Motion) | 5 | 0.3 |
| 1.7 | Tarot do Dia (1 carta automatica) | 6 | 1.4, 1.6 |
| 1.8 | Integracao com z-ai-web-dev-sdk (GPT-4o) | 6 | -- |
| 1.9 | Leitura IA com streaming SSE | 7 | 1.5, 1.8 |
| 1.10 | Historico de tiragens (local + DB) | 7 | 1.5 |
| 1.11 | Calculo de Arcano Pessoal (numerologia pitagorica) | 7 | 1.3 |
| 1.12 | Interpretacao do Arcano Pessoal via IA | 8 | 1.11, 1.8 |
| 1.13 | Limite diario de tiragens (3 gratis / 10 Plus) | 8 | 1.4 |
| 1.14 | Tela de detalhe da tiragem salva | 8 | 1.10 |

### Milestones

- **M1.1** (Semana 5): Usuario consegue se cadastrar e fazer primeira tiragem
- **M1.2** (Semana 7): Leitura IA com streaming funcional
- **M1.3** (Semana 8): Historico + Arcano Pessoal + Tarot do Dia -- MVP funcional

### Riscos da Fase

| Risco | Probabilidade | Impacto | Mitigacao |
|-------|--------------|---------|----------|
| Latencia alta no streaming IA | Media | Alto | Timeout, fallback, cache |
| Complexidade das animacoes de carta | Baixa | Baixo | Usar Framer Motion pre-built |
| Calculo de arcano pessoal com erros | Baixa | Alto | Testes unitarios com datas de referencia |

---

## Fase 2: Social (Semanas 9-13)

> "Ninguem caminha sozinho no caminho do autoconhecimento."

### Objetivo
Adicionar camada social basica: feed, seguimento, compartilhamento e sistema de gifts.

### Entregaveis

| # | Entregavel | Semana | Dependencia |
|---|-----------|--------|-------------|
| 2.1 | Modelo de dados social (follows, versos, gifts) | 9 | 0.5 |
| 2.2 | Criacao de Versos (tiragem compartilhavel) | 9 | 1.5 |
| 2.3 | Feed cronologico dos usuarios seguidos | 10 | 2.2 |
| 2.4 | Acao de seguir/deixar de seguir usuario | 10 | 2.1 |
| 2.5 | Lista de seguidores e seguindo no perfil | 10 | 2.4 |
| 2.6 | Sistema de Gifts (selecao, envio, notificacao) | 11 | 2.1 |
| 2.7 | Catalogo de gifts virtuais (5 iniciais) | 11 | 2.6 |
| 2.8 | Compartilhamento externo (link, redes sociais) | 11 | 2.2 |
| 2.9 | Curte e comentarios em versos | 12 | 2.2 |
| 2.10 | Moderacao basica (report, filtro de palavras) | 12 | 2.9 |
| 2.11 | Explorar/discovery de versos populares | 13 | 2.3 |
| 2.12 | Perfil publico acessivel por URL | 13 | 1.3 |

### Milestones

- **M2.1** (Semana 10): Feed funcional com versos e seguimento
- **M2.2** (Semana 12): Gifts e interacoes (curtir, comentar)
- **M2.3** (Semana 13): Discovery + moderacao basica -- social completo

### Riscos da Fase

| Risco | Probabilidade | Impacto | Mitigacao |
|-------|--------------|---------|----------|
| Abuso no feed (spam, conteudo ofensivo) | Alta | Medio | Moderacao pre-MVP, filtros |
| Performance do feed com muitos versos | Media | Alto | Paginacao, TanStack Query cache |

---

## Fase 3: Monetizacao (Semanas 14-20)

> "Sustentabilidade para que a plataforma cresca."

### Objetivo
Implementar marketplace para profissionais, sistema de pagamentos e assinatura Arkana Plus.

### Entregaveis

| # | Entregavel | Semana | Dependencia |
|---|-----------|--------|-------------|
| 3.1 | Modelo de dados do marketplace (servicos, pedidos, avaliacoes) | 14 | 0.5 |
| 3.2 | Cadastro de profissional (verificacao) | 14 | 1.3 |
| 3.3 | Catalogo de servicos do profissional | 15 | 3.2 |
| 3.4 | Integracao com Mercado Pago (sandbox) | 15 | -- |
| 3.5 | Fluxo de compra de servico (checkout) | 16 | 3.3, 3.4 |
| 3.6 | Sistema de avaliacoes pos-compra | 16 | 3.5 |
| 3.7 | Plano Arkana Plus (R$19,90/mes, R$179,90/ano) | 17 | 3.4 |
| 3.8 | Trial de 7 dias com cancelamento facilitado | 17 | 3.7 |
| 3.9 | Tela de checkout de assinatura | 17 | 3.7 |
| 3.10 | Beneficios Plus: tiragens ilimitadas, espalhamentos exclusivos | 18 | 3.7 |
| 3.11 | Saque de profissionais via Mercado Pago | 18 | 3.5 |
| 3.12 | Dispute automatica (7 dias) | 19 | 3.5 |
| 3.13 | Baralho Cigano (Lenormand 36 cartas) | 19 | 1.4 |
| 3.14 | Kin Maya (calculadora + interpretacao IA) | 19 | 1.8 |
| 3.15 | Horoscopo Chines (12 animais x 5 elementos) | 20 | 1.8 |
| 3.16 | Dashboard basico do profissional | 20 | 3.2 |

### Milestones

- **M3.1** (Semana 16): Marketplace funcional com primeira compra
- **M3.2** (Semana 18): Arkana Plus com trial ativo
- **M3.3** (Semana 20): Baralho Cigano + Kin Maya + Horoscopo Chines -- conteudo expandido

### Riscos da Fase

| Risco | Probabilidade | Impacto | Mitigacao |
|-------|--------------|---------|----------|
| Rejeicao de integracao Mercado Pago | Baixa | Critico | Sandbox desde Fase 0, docs de referencia |
| Baixa adesao ao Plus | Media | Alto | A/B test de precos, onboarding claro |
| Baixa oferta de profissionais | Alta | Alto | Convite manual de tarologos, incentivo inicial |

---

## Fase 4: Evolucao (Semanas 21-26)

> "Aprimorar, expandir e consolidar."

### Objetivo
Recursos avancados: notificacoes push, chat real-time, IA generativa avancada, analytics e moderação melhorada.

### Entregaveis

| # | Entregavel | Semana | Dependencia |
|---|-----------|--------|-------------|
| 4.1 | Notificacoes push (PWA + web-push) | 21 | 2.3 |
| 4.2 | Sistema de notificacoes in-app | 21 | 2.1 |
| 4.3 | Chat real-time entre usuario e profissional (Socket.io) | 22 | 3.2 |
| 4.4 | IA generativa avancada: leituras com contexto historico | 23 | 1.9 |
| 4.5 | IA generativa: versos escritos pelo usuario com sugestao IA | 23 | 2.2 |
| 4.6 | Horoscopo Maia completo (20 Selos x 13 Tons) | 23 | 1.8 |
| 4.7 | Dashboard de analytics para admin | 24 | 0.5 |
| 4.8 | Painel de moderacao (conteudo reportado) | 24 | 2.10 |
| 4.9 | IA de moderacao (classificacao automatica de conteudo) | 25 | 4.8 |
| 4.10 | Otimizacao de performance (Core Web Vitals) | 25 | -- |
| 4.11 | PWA completo (manifest, service worker, offline parcial) | 25 | 0.2 |
| 4.12 | Geração de artes IA para versos (cover image) | 26 | 1.8 |
| 4.13 | Academy/cursos (MVP de conteudo educativo) | 26 | -- |
| 4.14 | Versao desktop app (Tauri/Electron) -- estudo de viabilidade | 26 | 4.11 |

### Milestones

- **M4.1** (Semana 22): Notificacoes push funcionais
- **M4.2** (Semana 24): Chat real-time + analytics admin
- **M4.3** (Semana 26): IA avancada + moderacao IA + PWA completo

### Riscos da Fase

| Risco | Probabilidade | Impacto | Mitigacao |
|-------|--------------|---------|----------|
| Custo de IA generativa fora do orcamento | Media | Alto | Cache agressivo, limites por usuario |
| Complexidade do chat real-time | Alta | Medio | Socket.io bem estabelecido, WebSockets como fallback |
| Moderacao IA com falsos positivos | Media | Medio | Threshold ajustavel, revisao humana |

---

## Dependencias entre Fases

```
Fase 0 -----> Fase 1 -----> Fase 2 -----> Fase 3 -----> Fase 4
 (infra)       (core)       (social)     (money)      (scale)

Nota: Fases 3 e 4 tem dependencias parciais.
      Alguns itens da Fase 4 (PWA, analytics) podem iniciar
      em paralelo com a Fase 3.
```

## Recursos Estimados por Fase

| Fase | Semanas | Devs (FE) | Devs (BE) | Designer | QA |
|------|---------|-----------|-----------|----------|----
| 0    | 3       | 1         | 1         | 1        | 0  |
| 1    | 5       | 1         | 1         | 1        | 1  |
| 2    | 5       | 2         | 1         | 1        | 1  |
| 3    | 7       | 2         | 2         | 1        | 1  |
| 4    | 6       | 2         | 2         | 1        | 1  |

---

*Documento: roadmap.md | Versao: 1.0.0 | Identificador: arkana-agora*