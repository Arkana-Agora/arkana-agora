# SPEC-005: Arcano Pessoal -- Tarefas

**Plataforma**: Arkana Agora
**Versao**: MVP

---

## Tarefas de Implementacao

### Algoritmos e Logica

| # | Tarefa | Status | Estimativa (h) | Dependencias |
|---|---|---|---|
| 1 | Implementar funcao `reduceToArcana` (reducao pitagorica) | done | 1 | - |
| 2 | Implementar funcao `calculateArcanaByDate` | done | 1 | 1 |
| 3 | Criar tabela pitagorica (PYTHAGOREAN_TABLE) com normalizacao de acentos | done | 1 | - |
| 4 | Implementar funcao `calculateArcanaByName` | done | 1.5 | 1, 3 |
| 5 | Implementar funcao `calculatePersonalArcana` (combinacao) | done | 1 | 2, 4 |
| 6 | Criar objeto ARCANA_MAP com dados completos dos 22 arcanos (0-21) | done | 4 | - |

### Backend

| # | Tarefa | Status | Estimativa (h) | Dependencias |
|---|---|---|---|
| 7 | Adicionar campo `personalArcana` ao schema Profile | done | 0.5 | SPEC-002 |
| 8 | Implementar GET /api/v1/arcana/calculate | done | 1.5 | 5 |
| 9 | Implementar POST /api/v1/ai/arcana-interpret (streaming) | done | 2 | SPEC-004 |
| 19 | Persistir historico de calculos (tabela `ArcanaCalculation` / `arcana_calculations`) no GET /api/v1/arcana/calculate | done | 1.5 | 8 |

### Frontend

| # | Tarefa | Status | Estimativa (h) | Dependencias |
|---|---|---|---|
| 10 | Criar componente ArcanaCalculator (formulario + resultado client-side) | done | 3 | 5, 6 |
| 11 | Criar componente ArcanaDetailCard (card expandido com detalhes) | done | 2 | 6 |
| 12 | Criar componente ArcanaAIInterpretation (integracao com SPEC-004) | done | 2 | 9, SPEC-004 |
| 13 | Criar pagina /meu-arcano com fluxo completo | done | 2 | 10, 11, 12 |
| 14 | Criar pagina /meu-arcano/:arcana (detalhe de qualquer arcano) | done | 1.5 | 11 |

### Testes

| # | Tarefa | Status | Estimativa (h) | Dependencias |
|---|---|---|---|
| 15 | Criar 100 testes unitarios para reducao pitagorica (datas conhecidas) | done | 3 | 1-5 |
| 16 | Criar testes unitarios para tabela pitagorica (nomes com acentos, especiais) | done | 1.5 | 3, 4 |
| 17 | Criar testes de integracao para endpoint /arcana/calculate | done | 1 | 8 |
| 18 | Criar teste E2E de fluxo completo na pagina /meu-arcano | done | 2 | 13 |

---

## Resumo

| Categoria | Total de Tarefas | Horas Estimadas |
|---|---|---|
| Algoritmos e Logica | 6 | 9.5h |
| Backend | 4 | 5.5h |
| Frontend | 5 | 10.5h |
| Testes | 4 | 7.5h |
| **TOTAL** | **19** | **33h** |

---

## Ordem Recomendada de Execucao

1. Tarefa 6 (ARCANA_MAP -- trabalho de conteudo, pode ser paralelizado)
2. Tarefa 3 (tabela pitagorica)
3. Tarefas 1-2 (funcoes de reducao e calculo por data)
4. Tarefa 4 (calculo por nome)
5. Tarefa 5 (combinacao)
6. Tarefas 15-16 (testes unitarios -- validam os algoritmos)
7. Tarefa 7 (campo no Profile)
8. Tarefa 8 (endpoint de calculo)
9. Tarefa 10 (componente principal)
10. Tarefa 11 (card de detalhe)
11. Tarefa 13 (pagina /meu-arcano)
12. Tarefa 9 (endpoint de interpretacao IA)
13. Tarefa 12 (componente de interpretacao)
14. Tarefa 14 (pagina de detalhe de arcano)
15. Tarefas 17-18 (testes restantes)
16. Tarefa 19 (historico de calculos -- persistencia `ArcanaCalculation`, apos Tarefa 8)