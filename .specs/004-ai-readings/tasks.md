# SPEC-004: Leituras por IA -- Tarefas

**Plataforma**: Arkana Agora
**Versao**: MVP

---

## Tarefas de Implementacao

### Infraestrutura e Configuracao

| # | Tarefa | Status | Estimativa (h) | Dependencias |
|---|---|---|---|
| 1 | Configurar SDK de IA (OpenAI; desvio do plano z-ai-web-dev-sdk) | done | 1.5 | - |
| 2 | Criar schema Prisma para Interpretation, FollowUpMessage, AIDailyUsage | done | 1 | SPEC-003 (Reading) |
| 3 | Executar migracao do banco | done | 0.5 | 2 |
| 4 | Criar modulo de calculo de cache hash (SHA-256) | done | 1 | - |
| 5 | Criar modulo de rate limiting diario para IA | done | 1.5 | 2 |

### Backend - Pipeline de IA

| # | Tarefa | Status | Estimativa (h) | Dependencias |
|---|---|---|---|
| 6 | Criar templates de prompt de sistema (base + modos) | done | 2 | 1 |
| 7 | Criar construtor de prompt de usuario (cartas, posicoes, perfil) | done | 2 | 6, SPEC-003 |
| 8 | Implementar POST /api/v1/ai/interpret com SSE streaming | done | 4 | 4, 5, 7 |
| 9 | Implementar cache de interpretacoes (busca e salvamento) | done | 2 | 4, 8 |
| 10 | Implementar POST /api/v1/ai/follow-up com SSE streaming | done | 3 | 8 |
| 11 | Implementar GET /api/v1/ai/usage | done | 1 | 5 |
| 12 | Implementar retry com backoff exponencial para falhas de API | done | 1.5 | 8 |

### Frontend - Componentes

| # | Tarefa | Status | Estimativa (h) | Dependencias |
|---|---|---|---|
| 13 | Criar componente InterpretationRequest (modo, mood, pergunta) | done | 2 | 8 |
| 14 | Criar componente StreamingInterpretation com efeito maquina de escrever | done | 3 | 8 |
| 15 | Criar componente FollowUpChat com historico e sugestoes | done | 3 | 10 |
| 16 | Criar componente AIUsageIndicator (barra/contador) | done | 1.5 | 11 |
| 17 | Criar componente CachedInterpretationNotice | done | 0.5 | 9 |
| 18 | Integrar componentes na pagina de sessao de leitura | done | 3 | 13-17, SPEC-003 |

### Testes

| # | Tarefa | Status | Estimativa (h) | Dependencias |
|---|---|---|---|
| 19 | Criar testes unitarios para construtor de prompts | done | 2 | 7 |
| 20 | Criar testes unitarios para calculo de cache hash | done | 1 | 4 |
| 21 | Criar testes de integracao para endpoint de interpretacao | done | 2 | 8, 9 |
| 22 | Criar testes de integracao para follow-up | done | 1.5 | 10 |
| 23 | Criar teste E2E de fluxo completo: tiragem -> interpretacao -> follow-up | done | 3 | 18 |

---

## Resumo

| Categoria | Total de Tarefas | Horas Estimadas |
|---|---|---|
| Infraestrutura e Configuracao | 5 | 5.5h |
| Backend - Pipeline de IA | 7 | 16.5h |
| Frontend - Componentes | 6 | 13h |
| Testes | 5 | 9.5h |
| **TOTAL** | **23** | **44.5h** |

---

## Ordem Recomendada de Execucao

1. Tarefas 1 (configuracao do SDK)
2. Tarefas 2-3 (schema e migracao)
3. Tarefas 4-5 (cache hash e rate limiting)
4. Tarefas 6-7 (templates e construtor de prompts)
5. Tarefa 8 (endpoint principal de interpretacao com SSE)
6. Tarefa 12 (retry com backoff)
7. Tarefa 9 (cache)
8. Tarefa 10 (follow-up)
9. Tarefa 11 (uso diario)
10. Tarefas 13-14 (componentes principais no frontend)
11. Tarefa 15 (chat de follow-up)
12. Tarefas 16-17 (indicadores)
13. Tarefa 18 (integracao na pagina)
14. Tarefas 19-23 (testes)