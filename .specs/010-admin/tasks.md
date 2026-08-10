# SPEC-010: Painel Administrativo -- Tarefas

**Plataforma**: Arkana Agora
**Versao**: MVP

---

## Tarefas de Implementacao

### Infraestrutura e Seguranca

| # | Tarefa | Status | Estimativa (h) | Dependencias |
|---|---|---|---|
| 1 | Criar schema Prisma: AuditLog, Report, SystemConfig, MetricsSnapshot | pending | 1.5 | - |
| 2 | Adicionar relacoes de User com AuditLog e Report | pending | 0.5 | 1, SPEC-001 |
| 3 | Criar middleware de verificacao de role (admin/superadmin) | pending | 1.5 | SPEC-001 |
| 4 | Criar AdminLayout com sidebar, header e tema escuro | pending | 3 | 3 |
| 5 | Criar AuthGuard com validacao de role para rotas admin | pending | 1 | 3 |

### Dashboard

| # | Tarefa | Status | Estimativa (h) | Dependencias |
|---|---|---|---|
| 6 | Criar cron job de pre-agregacao de metricas diarias (01:00 BRT) | pending | 2.5 | 1 |
| 7 | Implementar GET /api/v1/admin/dashboard/overview | pending | 1.5 | 6 |
| 8 | Implementar GET /api/v1/admin/dashboard/* (growth, engagement, revenue, funnel) | pending | 3 | 6 |
| 9 | Criar componente MetricCard com variacao percentual | pending | 1.5 | - |
| 10 | Criar graficos: LineChart, BarChart, PieChart, FunnelChart (Recharts) | pending | 4 | 8 |
| 11 | Criar pagina AdminDashboardPage com todos os graficos | pending | 3 | 7-10 |

### Gerenciamento de Usuarios

| # | Tarefa | Status | Estimativa (h) | Dependencias |
|---|---|---|---|
| 12 | Implementar GET /api/v1/admin/users (listagem com filtros e paginacao) | pending | 2.5 | 3 |
| 13 | Implementar PATCH suspend/reactivate/role e DELETE | pending | 2 | 3 |
| 14 | Implementar POST bulk-action (acao em lote) | pending | 1.5 | 13 |
| 15 | Criar componente UsersDataTable (TanStack Table) | pending | 3.5 | 12 |
| 16 | Criar componente UserDetailPage com abas (perfil, login history, pagamentos) | pending | 3 | 12, 13 |

### Moderacao

| # | Tarefa | Status | Estimativa (h) | Dependencias |
|---|---|---|---|
| 17 | Implementar sistema de denuncias (Report): criar, listar, resolver | pending | 2 | 1 |
| 18 | Implementar GET /api/v1/admin/moderation/queue | pending | 1.5 | 17 |
| 19 | Implementar POST approve/reject e DELETE para moderacao | pending | 2 | 18 |
| 20 | Implementar auto-moderacao (pausar conteudo com 5+ denuncias) | pending | 1 | 17 |
| 21 | Criar componente ModerationQueue (cards com acoes rapidas) | pending | 3 | 18, 19 |
| 22 | Criar componente ProVerificationPage | pending | 2 | SPEC-002 |

### Financeiro

| # | Tarefa | Status | Estimativa (h) | Dependencias |
|---|---|---|---|
| 23 | Implementar GET /api/v1/admin/finance/* (summary, transactions, refunds) | pending | 3 | SPEC-009 |
| 24 | Implementar GET /api/v1/admin/finance/export (CSV) | pending | 1.5 | 23 |
| 25 | Criar componente FinancePage com graficos e tabela | pending | 2.5 | 23 |

### Sistema

| # | Tarefa | Status | Estimativa (h) | Dependencias |
|---|---|---|---|
| 26 | Implementar GET /api/v1/admin/system/health (checks de integracao) | pending | 2 | - |
| 27 | Implementar GET /api/v1/admin/system/jobs (status dos crons) | pending | 1.5 | - |
| 28 | Implementar GET /api/v1/admin/audit-log | pending | 1.5 | 1 |
| 29 | Criar componente SystemHealthPage com indicadores | pending | 2 | 26 |
| 30 | Criar componente JobsPage com lista de jobs | pending | 1.5 | 27 |
| 31 | Criar componente AuditLogPage (tabela somente leitura) | pending | 2 | 28 |

### Configuracoes (SuperAdmin)

| # | Tarefa | Status | Estimativa (h) | Dependencias |
|---|---|---|---|
| 32 | Implementar GET/PATCH /api/v1/admin/config | pending | 2 | 1 |
| 33 | Criar componente ConfigPage (feature flags, precos, limites) | pending | 2.5 | 32 |

### Testes

| # | Tarefa | Status | Estimativa (h) | Dependencias |
|---|---|---|---|
| 34 | Criar testes de integracao para endpoints de gerenciamento de usuarios | pending | 2 | 12-14 |
| 35 | Criar testes de integracao para moderacao e denuncias | pending | 2 | 17-20 |
| 36 | Criar testes de integracao para metricas e financeiro | pending | 1.5 | 7-8, 23 |
| 37 | Criar testes E2E de fluxo: login admin -> suspender usuario -> verificar log de auditoria | pending | 3 | 3-5, 12-16, 28 |

---

## Resumo

| Categoria | Total de Tarefas | Horas Estimadas |
|---|---|---|
| Infraestrutura e Seguranca | 5 | 7.5h |
| Dashboard | 6 | 15.5h |
| Gerenciamento de Usuarios | 5 | 12.5h |
| Moderacao | 6 | 11.5h |
| Financeiro | 3 | 7h |
| Sistema | 6 | 10.5h |
| Configuracoes (SuperAdmin) | 2 | 4.5h |
| Testes | 4 | 8.5h |
| **TOTAL** | **37** | **77.5h** |

---

## Ordem Recomendada de Execucao

1. Tarefas 1-3 (schema, relacoes, middleware de role)
2. Tarefa 4 (AdminLayout)
3. Tarefa 5 (AuthGuard admin)
4. Tarefa 6 (cron de metricas)
5. Tarefas 7-8 (APIs de dashboard)
6. Tarefas 9-10 (componentes de graficos)
7. Tarefa 11 (pagina do dashboard)
8. Tarefas 12-14 (APIs de usuarios)
9. Tarefas 15-16 (componentes de usuarios)
10. Tarefas 17-20 (moderacao backend)
11. Tarefas 21-22 (moderacao frontend)
12. Tarefas 23-24 (financeiro)
13. Tarefa 25 (pagina financeiro)
14. Tarefas 26-28 (sistema)
15. Tarefas 29-31 (paginas de sistema)
16. Tarefas 32-33 (configuracoes)
17. Tarefas 34-37 (testes)