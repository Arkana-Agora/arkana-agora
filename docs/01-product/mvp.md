# Definicao do MVP -- Arkana Agora

Este documento define o escopo do Minimum Viable Product (MVP) e as features planejadas para V1 e V2 do projeto `arkana-agora`.

---

## Classificacao de Features

### MoSCoW

| Categoria | Definicao |
|-----------|----------|
| **Must Have** | Essencial para o MVP. Sem essa feature, o produto nao tem valor. |
| **Should Have** | Importante, mas o produto funciona sem ela no lancamento. Prevista para V1. |
| **Nice to Have** | Desejavel para diferenciação competitiva. Prevista para V2. |
| **Won't Have** | Fora do escopo das proximas versoes. |

---

## MVP Features (Must Have)

> **Objetivo:** O usuario consegue se cadastrar, fazer uma tiragem de tarot com leitura IA e ver seu Arcano Pessoal. Tudo em 8 semanas.

### MV-001: Autenticacao Social

| Campo | Detalhe |
|-------|---------|
| **Descricao** | Cadastro e login via Google OAuth e Facebook Login |
| **User Stories** | US-001, US-002, US-003, US-004, US-005 |
| **Requisitos** | RF-001, RF-002, RF-003, RF-004, RF-005 |
| **Dependencias** | NextAuth.js v4 configurado |
| **Estimativa** | 3 dias |

### MV-002: Perfil Basico

| Campo | Detalhe |
|-------|---------|
| **Descricao** | Nome, foto, bio, data de nascimento, Arcano Pessoal exibido |
| **User Stories** | US-006, US-007, US-008 |
| **Requisitos** | RF-017, RF-018 |
| **Dependencias** | MV-001, BR-ARC-001 a BR-ARC-005 |
| **Estimativa** | 2 dias |

### MV-003: Motor de Tiragem

| Campo | Detalhe |
|-------|---------|
| **Descricao** | Selecao aleatoria de cartas com animacao de revelacao (Framer Motion), 3 espalhamentos |
| **User Stories** | US-011, US-012, US-017, US-018 |
| **Requisitos** | RF-006, RF-007, RF-008, RF-009, RF-010, RF-011 |
| **Espalhamentos** | Carta Unica (1), Passado/Presente/Futuro (3), Cruz Celta Simplificada (5) |
| **Dependencias** | Banco de dados de 78 cartas RWS |
| **Estimativa** | 5 dias |

### MV-004: Tarot do Dia

| Campo | Detalhe |
|-------|---------|
| **Descricao** | Tiragem automatica de 1 carta por dia com leitura IA simplificada |
| **User Stories** | US-014 |
| **Requisitos** | RF-010 |
| **Dependencias** | MV-003, MV-005 |
| **Estimativa** | 1 dia |

### MV-005: Leitura IA Basica (Streaming)

| Campo | Detalhe |
|-------|---------|
| **Descricao** | Interpretacao de tiragem via GPT-4o com streaming SSE, considerando cartas + posicoes + pergunta |
| **User Stories** | US-013, US-019, US-020, US-021 |
| **Requisitos** | RF-013, RF-014, RF-015, RF-016 |
| **Dependencias** | z-ai-web-dev-sdk integrado |
| **Estimativa** | 4 dias |

### MV-006: Arcano Pessoal

| Campo | Detalhe |
|-------|---------|
| **Descricao** | Calculo automatico via numerologia pitagorica + interpretacao IA |
| **User Stories** | US-023, US-024 |
| **Requisitos** | RF-017, RF-018, RF-019 |
| **Dependencias** | MV-002 |
| **Estimativa** | 2 dias |

### MV-007: Horoscopo do Dia (Ocidental)

| Campo | Detalhe |
|-------|---------|
| **Descricao** | Horoscopo diario para os 12 signos, gerado por IA com cache |
| **User Stories** | US-027 |
| **Requisitos** | RF-020 |
| **Dependencias** | MV-005 |
| **Estimativa** | 2 dias |

### MV-008: Historico Local

| Campo | Detalhe |
|-------|---------|
| **Descricao** | Historico de tiragens salvas no banco de dados, acessivel via menu |
| **User Stories** | US-015 |
| **Requisitos** | -- |
| **Dependencias** | MV-003, MV-005 |
| **Estimativa** | 2 dias |

### MV-009: Limite Diario de Tiragens

| Campo | Detalhe |
|-------|---------|
| **Descricao** | 3 tiragens gratis/dia (reset a meia-noite), 10 para Plus |
| **User Stories** | US-011 |
| **Requisitos** | BR-TIR-001 |
| **Dependencias** | MV-003 |
| **Estimativa** | 1 dia |

---

## V1 Features (Should Have)

> **Objetivo:** Adicionar camada social, baralho cigano, sistemas esotericos adicionais, marketplace e monetizacao.

### V1-001: Feed Social

| Campo | Detalhe |
|-------|---------|
| **Descricao** | Feed cronologico com versos de usuarios seguidos e sugestoes |
| **User Stories** | US-033, US-034 |
| **Estimativa** | 5 dias |

### V1-002: Seguir Usuarios

| Campo | Detalhe |
|-------|---------|
| **Descricao** | Acao de seguir/deixar de seguir, lista de seguidores e seguindo |
| **User Stories** | US-035, US-009 |
| **Estimativa** | 3 dias |

### V1-003: Marketplace

| Campo | Detalhe |
|-------|---------|
| **Descricao** | Catalogo de profissionais, cadastro de servicos, checkout, avaliacoes |
| **User Stories** | US-039, US-040, US-041, US-042, US-043 |
| **Estimativa** | 10 dias |

### V1-004: Gifts

| Campo | Detalhe |
|-------|---------|
| **Descricao** | Sistema de presentes virtuais entre usuarios |
| **User Stories** | US-037 |
| **Estimativa** | 3 dias |

### V1-005: Baralho Cigano (Lenormand)

| Campo | Detalhe |
|-------|---------|
| **Descricao** | 36 cartas Lenormand com espalhamentos proprios e leitura IA |
| **User Stories** | US-016 |
| **Estimativa** | 5 dias |

### V1-006: Kin Maya

| Campo | Detalhe |
|-------|---------|
| **Descricao** | Calculadora de Kin Maya (Tzolkin) com interpretacao IA |
| **User Stories** | US-029, US-030 |
| **Estimativa** | 4 dias |

### V1-007: Horoscopo Chines

| Campo | Detalhe |
|-------|---------|
| **Descricao** | Calculo de signo e elemento chines com interpretacao IA |
| **User Stories** | US-031 |
| **Estimativa** | 3 dias |

### V1-008: Notificacoes

| Campo | Detalhe |
|-------|---------|
| **Descricao** | Notificacoes in-app e push para novos seguidores, curtidas, pedidos de marketplace |
| **Estimativa** | 3 dias |

### V1-009: PWA

| Campo | Detalhe |
|-------|---------|
| **Descricao** | Manifest, service worker, instalacao no home screen, cache basico |
| **Estimativa** | 2 dias |

### V1-010: Arkana Plus

| Campo | Detalhe |
|-------|---------|
| **Descricao** | Assinatura mensal/anual via Mercado Pago com trial de 7 dias |
| **User Stories** | US-044, US-045, US-046, US-047, US-048 |
| **Estimativa** | 5 days |

---

## V2 Features (Nice to Have)

> **Objetivo:** Diferenciar-se com recursos avancados e expandir o ecossistema.

| ID | Feature | Descricao | Estimativa |
|----|---------|-----------|-----------|
| V2-001 | Chat Real-Time | Chat entre usuario e profissional durante leituras do marketplace | 8 dias |
| V2-002 | Geracao de Artes IA | Capa visual gerada por IA para versos compartilhados | 5 dias |
| V2-003 | Horoscopo Maia Completo | Leitura aprofundada combinando Selo Solar + Tom Galactico com interpretacao diaria | 4 dias |
| V2-004 | Academy/Cursos | Conteudo educativo sobre tarot, numerologia e calendarios esotericos | 10 dias |
| V2-005 | Analytics Avancado | Dashboard de insights pessoais (padroes de tiragem, arcanos recorrentes, etc.) | 5 dias |
| V2-006 | Versao Desktop App | Aplicacao desktop via Tauri com funcionalidades offline avancadas | 8 dias |
| V2-007 | Horoscopo Semanal | Horoscopo semanal por signo com leitura IA | 2 dias |
| V2-008 | Comparar Arcanos | Ferramenta de comparacao de Arcano Pessoal entre usuarios | 2 dias |
| V2-009 | Moderacao por IA | Classificacao automatica de conteudo reportado | 4 dias |
| V2-010 | Multi-idioma | Suporte a ingles e espanhol | 8 dias |

---

## Timeline do MVP (8 Semanas)

```
Semana 1-2: Fundacao (Fase 0 parcial)
  |- Monorepo, Next.js, Tailwind, shadcn/ui
  |- Docker, Prisma, banco de dados
  |- NextAuth.js (Google + Facebook)
  |- Banco de dados de cartas RWS

Semana 3-4: Auth + Perfil
  |- Cadastro completo (US-001 a US-005)
  |- Perfil basico com Arcano Pessoal (US-006 a US-008, US-023, US-024)
  |- Design system completo

Semana 4-5: Motor de Tiragem
  |- Componente de carta com animacao (US-012)
  |- 3 espalhamentos (US-011)
  |- Detalhes da carta (US-017)
  |- Limite diario (BR-TIR-001)

Semana 5-6: IA + Streaming
  |- Integracao z-ai-web-dev-sdk (US-019)
  |- Leitura com streaming SSE
  |- Pergunta contextual (US-013)
  |- Fallback de leitura basica

Semana 6-7: Tarot do Dia + Historico
  |- Tarot do Dia automatico (US-014)
  |- Historico de tiragens (US-015)
  |- Salvar favoritos

Semana 7-8: Horoscopo + Polimento
  |- Horoscopo do dia (US-027)
  |- Testes E2E
  |- Correcoes de bug
  |- Deploy de producao
  |- Performance audit (Core Web Vitals)
```

---

## Caminho Critico (Critical Path)

O caminho critico do MVP e a sequencia de dependencias que, se atrasada, atrasa o lancamento:

```
Monorepo + Next.js (3d)
  -> Auth + Perfil (5d)
    -> Motor de Tiragem (5d)
      -> Integracao IA (4d)
        -> Tarot do Dia + Historico (3d)
          -> Horoscopo + QA (5d)

Total caminho critico: ~25 dias uteis (5 semanas)
Buffer para imprevistos: ~15 dias uteis (3 semanas)
Total: 8 semanas
```

## Estimativa de Recursos (MVP)

| Papel | Quantidade | Horas/Semana | Total (8 sem) |
|-------|-----------|-------------|----------------|
| Desenvolvedor Front-end | 1 | 40h | 320h |
| Desenvolvedor Back-end | 1 | 40h | 320h |
| Designer UI/UX | 1 | 20h | 160h |
| QA | 1 (part-time sem 3) | 20h | 100h |
| Product Owner | 1 | 10h | 80h |
| **Total** | | | **~980h** |

### Custo Estimado (MVP)

| Recurso | Custo Mensal | Custo Total (2 meses) |
|---------|-------------|---------------------|
| Dev Front-end | R$8.000 | R$16.000 |
| Dev Back-end | R$8.000 | R$16.000 |
| Designer | R$4.000 | R$8.000 |
| QA (part-time) | R$2.500 | R$5.000 |
| Infra (Vercel, DB, IA) | R$1.500 | R$3.000 |
| **Total** | **R$24.000** | **R$48.000** |

### Custos Recorrentes Pos-MVP

| Item | Custo Mensal Estimado |
|------|---------------------|
| Vercel (Pro) | R$400 |
| PostgreSQL (Supabase/Neon) | R$200 |
| OpenAI API (GPT-4o) | R$2.000 - R$8.000 (escala com uso) |
| Mercado Pago (taxa transacao) | 4,99% + R$0,49 por transacao |
| Redis (cache) | R$150 |
| Monitoramento (Sentry) | R$300 |
| **Total** | **R$3.050 - R$9.050** |

---

## Features Fora do Escopo (Won't Have)

| Feature | Motivo |
|---------|--------|
| App nativo iOS/Android | PWA cobre a necessidade inicial com menor custo |
| Videochamada integrada | Complexidade alta; profissionais podem usar ferramentas externas |
| Multi-idioma no MVP | Foco no mercado brasileiro (pt-BR) |
| Blockchain/NFT | Sem demanda identificada no publico-alvo |
| Gamificacao (pontos, niveis) | Distracao do proposito central; possivel V2+ |
| API publica para terceiros | Sem demanda inicial; possivel V2+ |

---

## Sucesso do MVP: Criterios de Lancamento

O MVP estara pronto para lancamento quando todos os criterios a seguir forem atendidos:

1. **Funcional**: Todas as 9 features MVP estao implementadas e testadas
2. **Performance**: FCP < 1,5s, LCP < 2,5s, CLS < 0,1 em redes 4G
3. **IA**: Leitura streaming com inicio em < 3s e sem interrupcoes em 95% das requisicoes
4. **Auth**: Cadastro Google + Facebook + Email funcional com confirmacao
5. **Seguranca**: Todos os endpoints protegidos, LGPD (consentimento + exclusao) implementado
6. **Testes**: Cobertura minima de 60% no backend, testes E2E dos fluxos criticos
7. **Deploy**: Pipeline CI/CD verde, deploy automatico em staging e producao

---

*Documento: mvp.md | Versao: 1.0.0 | Identificador: arkana-agora*