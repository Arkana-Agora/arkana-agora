# SPEC-003: Motor de Tiragem -- Tarefas

**Plataforma**: Arkana Agora  
**Versao**: MVP

---

## Tarefas de Implementacao

### Dados e Infraestrutura

| # | Tarefa | Status | Estimativa (h) | Dependencias |
|---|---|---|---|
| 1 | Criar arquivos de dados JSON para baralho RWS (78 cartas com significados em portugues) | pending | 8 | - |
| 2 | Criar arquivos de dados JSON para baralho Thoth (78 cartas com significados) | pending | 8 | - |
| 3 | Criar arquivos de dados JSON para baralho Lenormand (36 cartas com significados) | pending | 4 | - |
| 4 | Definir tipos TypeScript para Deck, TarotCard, LenormandCard, Spread | pending | 1.5 | - |
| 5 | Criar schema Prisma para Reading e ReadingCard | pending | 1 | - |
| 6 | Executar migracao do banco | pending | 0.5 | 5 |

### Algoritmos e Logica de Negocio

| # | Tarefa | Status | Estimativa (h) | Dependencias |
|---|---|---|---|
| 7 | Implementar gerador de seed CSPRNG | pending | 1 | - |
| 8 | Implementar algoritmo de embaralhamento Fisher-Yates | pending | 1 | 7 |
| 9 | Implementar funcao drawCards com deteccao de repeticao | pending | 2 | 8 |
| 10 | Implementar logica de limite diario de tiragens | pending | 1.5 | 5 |
| 11 | Implementar logica de espalhamento Sim/Nao (par/impar) | pending | 1 | 9 |
| 12 | Implementar layouts de posicao para todos os espalhamentos | pending | 2 | 4 |

### Backend - API Routes

| # | Tarefa | Status | Estimativa (h) | Dependencias |
|---|---|---|---|
| 13 | Implementar GET /api/v1/decks e GET /api/v1/decks/:id/cards | pending | 2 | 1-4 |
| 14 | Implementar GET /api/v1/spreads | pending | 1.5 | 12 |
| 15 | Implementar POST /api/v1/readings (salvar tiragem) | pending | 2.5 | 5, 9, 10 |
| 16 | Implementar GET /api/v1/readings (listar tiragens do usuario) | pending | 1.5 | 5 |
| 17 | Implementar GET /api/v1/readings/:id (visualizar tiragem) | pending | 1.5 | 5 |
| 18 | Implementar GET /api/v1/readings/daily-count | pending | 1 | 10 |
| 19 | Implementar GET /api/v1/readings/:id/og-image (geracao de imagem OG) | pending | 3 | 17, html-to-image |

### Frontend - Componentes

| # | Tarefa | Status | Estimativa (h) | Dependencias |
|---|---|---|---|
| 20 | Criar componente DeckSelector com grid e selecao visual | pending | 2 | 13 |
| 21 | Criar componente SpreadSelector com filtros e info | pending | 2 | 14 |
| 22 | Criar componente TarotCard com flip 3D (Framer Motion) | pending | 4 | 4 |
| 23 | Criar componente CardTable com layouts de espalhamento responsivos | pending | 3.5 | 12, 22 |
| 24 | Criar componente CardDetailPanel (drawer lateral) | pending | 3 | 22 |
| 25 | Criar componente ReadingSession (wrapper do fluxo) | pending | 3 | 20-24 |
| 26 | Criar componente ReadingTimer com contagem MM:SS | pending | 1.5 | 25 |
| 27 | Criar componente ShareModal com opcoes de compartilhamento | pending | 2.5 | 19 |
| 28 | Criar componente DailyLimitBanner com CTA de upgrade | pending | 1.5 | 10 |

### Estado e Integracao

| # | Tarefa | Status | Estimativa (h) | Dependencias |
|---|---|---|---|
| 29 | Implementar ReadingStore no Zustand com persistencia em sessionStorage | pending | 3 | 9, 12 |
| 30 | Integrar TanStack Query para listagem de tiragens historicas | pending | 1.5 | 16 |
| 31 | Criar pagina /tirar (fluxo deck -> spread -> sessao) | pending | 2.5 | 20, 21, 25 |
| 32 | Criar pagina /minhas-tiragens (historico com paginacao) | pending | 2 | 30 |
| 33 | Criar pagina /tiragem/:id (visualizacao publica) | pending | 2 | 17 |

### Testes e Otimizacao

| # | Tarefa | Status | Estimativa (h) | Dependencias |
|---|---|---|---|
| 34 | Criar testes unitarios para algoritmos de sorteio e espalhamento | pending | 2 | 7-12 |
| 35 | Criar testes de integracao para endpoints de leitura | pending | 2 | 13-18 |
| 36 | Criar testes E2E de fluxo completo de tiragem | pending | 3 | 31 |
| 37 | Otimizar animacoes (GPU acceleration, will-change) e verificar 60fps | pending | 2 | 22, 23 |

---

## Resumo

| Categoria | Total de Tarefas | Horas Estimadas |
|---|---|---|
| Dados e Infraestrutura | 6 | 23h |
| Algoritmos e Logica de Negocio | 6 | 8.5h |
| Backend - API Routes | 7 | 13h |
| Frontend - Componentes | 9 | 23h |
| Estado e Integracao | 5 | 11h |
| Testes e Otimizacao | 4 | 9h |
| **TOTAL** | **37** | **87.5h** |

---

## Ordem Recomendada de Execucao

1. Tarefas 4 (tipos TypeScript) - fundacao
2. Tarefas 1-3 (dados dos baralhos - trabalho pesado paralelizavel)
3. Tarefas 5-6 (schema e migracao)
4. Tarefas 7-9 (algoritmos de sorteio)
5. Tarefas 10-12 (logica de negocio)
6. Tarefas 13-14 (APIs de leitura)
7. Tarefa 29 (ReadingStore)
8. Tarefa 22 (TarotCard - componente central)
9. Tarefa 23 (CardTable com layouts)
10. Tarefa 24 (CardDetailPanel)
11. Tarefas 20-21 (DeckSelector, SpreadSelector)
12. Tarefa 25 (ReadingSession)
13. Tarefas 26, 28 (timer e limite)
14. Tarefas 15-18 (APIs de escrita)
15. Tarefa 31 (pagina /tirar)
16. Tarefas 16, 30, 32 (historico)
17. Tarefas 19, 27 (compartilhamento)
18. Tarefa 33 (pagina publica)
19. Tarefas 34-37 (testes e otimizacao)