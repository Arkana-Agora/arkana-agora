# SPEC-006: Horoscopos -- Tarefas

**Plataforma**: Arkana Agora
**Versao**: MVP

---

## Tarefas de Implementacao

### Dados e Algoritmos

| # | Tarefa | Status | Estimativa (h) | Dependencias |
|---|---|---|---|
| 1 | Criar tabela de dados dos 12 signos ocidentais (com metadados completos) | pending | 1.5 | - |
| 2 | Implementar algoritmo getWesternSign (detencao por data) | pending | 1 | 1 |
| 3 | Criar tabela de dados dos 12 animais do zodiaco chines | pending | 1.5 | - |
| 4 | Criar tabela de Ano Novo Chines (1980-2035) | pending | 2 | - |
| 5 | Implementar algoritmo getChineseZodiac (animal + elemento) | pending | 1.5 | 3, 4 |
| 6 | Criar tabela de dados dos 20 Selos Solares Maias | pending | 1.5 | - |
| 7 | Criar tabela de dados dos 13 Tons Galacticos Maias | pending | 1 | - |
| 8 | Implementar algoritmo gregorianToMayanLongCount (JDN -> Tzolkin) | pending | 3 | 6, 7 |
| 9 | Criar seeds de conteudo de horoscopo para 30 dias (ocidental, diario) | pending | 4 | 1 |
| 10 | Criar seeds de conteudo de horoscopo para 30 dias (chines, diario) | pending | 3 | 3 |
| 11 | Criar seeds de conteudo de horoscopo para 30 dias (maia, diario) | pending | 3 | 6, 7 |

### Backend - API Routes

| # | Tarefa | Status | Estimativa (h) | Dependencias |
|---|---|---|---|
| 12 | Criar schema Prisma para HoroscopeContent, HoroscopeLog, HoroscopeNotification | pending | 1.5 | - |
| 13 | Implementar GET /api/v1/horoscopes/western | pending | 1.5 | 2, 9, 12 |
| 14 | Implementar GET /api/v1/horoscopes/chinese | pending | 1.5 | 5, 10, 12 |
| 15 | Implementar GET /api/v1/horoscopes/maya | pending | 1.5 | 8, 11, 12 |
| 16 | Implementar GET /api/v1/horoscopes/my-horoscope (todos os 3) | pending | 2 | 13, 14, 15 |
| 17 | Implementar GET /api/v1/horoscopes/history | pending | 1 | 12 |
| 18 | Implementar POST /api/v1/ai/horoscope-interpret (streaming) | pending | 2 | SPEC-004 |
| 19 | Implementar cron job de geracao diaria de horoscopos | pending | 3 | 13-15 |
| 20 | Implementar sistema de notificacao de horoscopo diario (push/in-app) | pending | 3 | 19 |

### Frontend - Componentes

| # | Tarefa | Status | Estimativa (h) | Dependencias |
|---|---|---|---|
| 21 | Criar componente HoroscopeLanding com tabs para 3 sistemas | pending | 2.5 | 16 |
| 22 | Criar componente WesternHoroscopeCard com secoes colapsaveis | pending | 2 | 13 |
| 23 | Criar componente ChineseHoroscopeCard | pending | 2 | 14 |
| 24 | Criar componente MayanHoroscopeCard com cores tematicas | pending | 2 | 15 |
| 25 | Criar pagina /horoscopos | pending | 1.5 | 21 |
| 26 | Criar paginas especificas: /horoscopos/ocidental, /chines, /maia | pending | 2 | 22, 23, 24 |
| 27 | Criar pagina /horoscopos/historico com filtros e paginacao | pending | 2 | 17 |

### Testes

| # | Tarefa | Status | Estimativa (h) | Dependencias |
|---|---|---|---|
| 28 | Criar 50 testes unitarios para getWesternSign (datas de fronteira) | pending | 2 | 2 |
| 29 | Criar 30 testes unitarios para getChineseZodiac (incluindo Ano Novo) | pending | 2 | 5 |
| 30 | Criar 20 testes unitarios para gregorianToMayanLongCount (datas de referencia) | pending | 2 | 8 |
| 31 | Criar testes E2E para fluxo de horoscopos | pending | 3 | 25-27 |

---

## Resumo

| Categoria | Total de Tarefas | Horas Estimadas |
|---|---|---|
| Dados e Algoritmos | 11 | 23.5h |
| Backend - API Routes | 9 | 18.5h |
| Frontend - Componentes | 7 | 14h |
| Testes | 4 | 9h |
| **TOTAL** | **31** | **65h** |

---

## Ordem Recomendada de Execucao

1. Tarefas 1, 3, 6-7 (dados de referencia -- paralelizavel)
2. Tarefa 12 (schema Prisma)
3. Tarefas 2, 5, 8 (algoritmos de calculo)
4. Tarefa 4 (tabela de Ano Novo Chines)
5. Tarefas 28-30 (testes unitarios -- validam os algoritmos)
6. Tarefas 9-11 (seeds de conteudo)
7. Tarefas 13-17 (API endpoints)
8. Tarefa 19 (cron job)
9. Tarefas 21-24 (componentes frontend)
10. Tarefas 25-27 (paginas)
11. Tarefa 18 (interpretacao IA)
12. Tarefa 20 (notificacoes)
13. Tarefa 31 (testes E2E)