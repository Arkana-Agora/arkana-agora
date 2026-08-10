# SPEC-010: Painel Administrativo -- Design Tecnico

**Plataforma**: Arkana Agora
**Versao**: MVP

---

## 1. Layout e Navegacao

### 1.1 AdminLayout
- Layout fixo com sidebar esquerda (256px) e conteudo principal
- Sidebar colapsavel (icone apenas) em telas menores
- Header com: busca global, notificacoes do admin, avatar com dropdown (perfil, logout)
- Footer com: versao da plataforma, link para documentacao interna
- Protegido por AuthGuard com validacao de role (admin ou superadmin)
- Background: tema escuro (dark mode) para diferenciar da plataforma principal

### 1.2 Menu de Navegacao

```
Dashboard
Usuarios
  |-- Lista de Usuarios
  |-- Suspensos
  |-- Deletados (LGPD)
Conteudo
  |-- Moderacao
  |-- Denuncias
  |-- Perfis Profissionais
Financeiro
  |-- Receita
  |-- Transacoes
  |-- Reembolsos
Marketplace
  |-- Categorias
  |-- Disputas
Sistema
  |-- Saude
  |-- Jobs
  |-- Auditoria
  |-- Configuracoes (SuperAdmin)
```

---

## 2. Componentes de Dashboard

### 2.1 MetricCard
- Card com titulo, valor grande, variacao percentual em relacao ao periodo anterior
- Icone tematico no canto
- Variacao: verde (positivo), vermelho (negativo), cinza (neutro)
- Exemplo: "Total de Usuarios" | "12.456" | "+8.3% vs mes anterior"
- Clicavel: navega para a pagina de detalhe

### 2.2 LineChart (Recharts)
- Grafico de linha para evolucao temporal
- Tooltips com dados detalhados no hover
- Selecao de periodo: 7d, 30d, 90d, 12m
- Multiplas series (usuarios, receita)

### 2.3 BarChart
- Grafico de barras para comparacao categorica
- Utilizado para: tiragens por dia da semana, receita por metodo de pagamento
- Cores alinhadas ao tema dark

### 2.4 PieChart
- Grafico de pizza para distribuicao percentual
- Utilizado para: distribuicao por plano, distribuicao por signo
- Labels com percentual e valor absoluto

### 2.5 FunnelChart
- Funil de conversao: cadastro (100%) -> verificacao (80%) -> primeira tiragem (45%) -> assinatura (5%)
- Cada etapa com contagem absoluta e percentual
- Taxa de conversao entre etapas exibida

---

## 3. Componentes de Gerenciamento

### 3.1 UsersDataTable
- Tabela com TanStack Table: ordenacao multipla, filtros globais, selecao em lote
- Colunas: checkbox, avatar+nome, email, plano (badge), status (badge), cadastro, ultima atividade, acoes
- Filtros: input de busca, select de plano, select de status, date range
- Acoes em lote (toolbar acima da tabela): suspender, reativar, alterar plano, exportar
- Paginacao server-side (50 por pagina)
- Row expansion: ao clicar na linha, expande com detalhes do usuario

### 3.2 ModerationQueue
- Lista em formato de cards (nao tabela)
- Cada card: tipo de conteudo (post/comentario/review), autor, preview, motivo da denuncia, contagem de denuncias, timestamp
- Acoes rapidas: aprovar (verde), rejeitar (vermelho), excluir (laranja), pausar para revisao
- Filtros: tipo, status (pendente, revisado, resolvido)
- Ordenacao: mais denunciados primeiro
- Ao aprovar/rejeitar: modal de confirmacao com campo de motivo (obrigatorio para rejeicao)

### 3.3 AuditLogTable
- Tabela somente leitura com todas as acoes administrativas
- Colunas: timestamp, admin (nome), acao, alvo, detalhes (expandivel)
- Filtros: admin, tipo de acao, data
- Exportacao em CSV

---

## 4. API Endpoints

### Dashboard

| Metodo | Endpoint | Descricao | Role |
---|---|---|---|
| GET | /api/v1/admin/dashboard/overview | Metricas do dashboard | admin |
| GET | /api/v1/admin/dashboard/growth | Dados de crescimento (grafico) | admin |
| GET | /api/v1/admin/dashboard/engagement | Dados de engajamento | admin |
| GET | /api/v1/admin/dashboard/revenue | Dados de receita | admin |
| GET | /api/v1/admin/dashboard/funnel | Funil de conversao | admin |

### Usuarios

| Metodo | Endpoint | Descricao | Role |
---|---|---|---|
| GET | /api/v1/admin/users | Listar usuarios | admin |
| GET | /api/v1/admin/users/:id | Detalhe do usuario | admin |
| PATCH | /api/v1/admin/users/:id/suspend | Suspender usuario | admin |
| PATCH | /api/v1/admin/users/:id/reactivate | Reativar usuario | admin |
| PATCH | /api/v1/admin/users/:id/role | Alterar plano/role | superadmin |
| DELETE | /api/v1/admin/users/:id | Excluir permanentemente | superadmin |
| GET | /api/v1/admin/users/:id/logins | Historico de logins | admin |
| POST | /api/v1/admin/users/bulk-action | Acao em lote | admin |

### Moderacao

| Metodo | Endpoint | Descricao | Role |
---|---|---|---|
| GET | /api/v1/admin/moderation/queue | Fila de moderacao | admin |
| POST | /api/v1/admin/moderation/:id/approve | Aprovar conteudo | admin |
| POST | /api/v1/admin/moderation/:id/reject | Rejeitar conteudo | admin |
| DELETE | /api/v1/admin/moderation/:id | Excluir conteudo | admin |
| GET | /api/v1/admin/reports | Lista de denuncias | admin |
| GET | /api/v1/admin/pro-verification | Perfis aguardando verificacao | admin |
| PATCH | /api/v1/admin/pro-verification/:id | Aprovar/rejeitar perfil profissional | admin |

### Financeiro

| Metodo | Endpoint | Descricao | Role |
---|---|---|---|
| GET | /api/v1/admin/finance/summary | Resumo financeiro | admin |
| GET | /api/v1/admin/finance/transactions | Lista de transacoes | admin |
| GET | /api/v1/admin/finance/refunds | Lista de reembolsos | admin |
| GET | /api/v1/admin/finance/export | Exportar CSV | admin |

### Sistema

| Metodo | Endpoint | Descricao | Role |
---|---|---|---|
| GET | /api/v1/admin/system/health | Saude do sistema | admin |
| GET | /api/v1/admin/system/jobs | Status dos cron jobs | admin |
| GET | /api/v1/admin/audit-log | Log de auditoria | admin |
| GET | /api/v1/admin/config | Configuracoes do sistema | superadmin |
| PATCH | /api/v1/admin/config | Atualizar configuracoes | superadmin |

---

## 5. Database Schema

### Tabelas adicionais para o Admin:

```prisma
model AuditLog {
  id        String   @id @default(cuid())
  adminId   String   // quem executou a acao
  action    String   // 'user.suspend' | 'content.reject' | etc.
  targetType String  // 'user' | 'post' | 'comment' | 'review'
  targetId  String
  details   Json?
  createdAt DateTime @default(now())

  admin     User     @relation('AdminActions', fields: [adminId], references: [id])

  @@index([action, createdAt])
  @@index([targetType, targetId])
  @@map('audit_logs')
}

model Report {
  id          String   @id @default(cuid())
  reporterId  String
  targetType  String   // 'post' | 'comment' | 'review' | 'user'
  targetId    String
  reason      String   // 'offensive' | 'spam' | 'harassment' | 'copyright' | 'other'
  description String?  @db.Text
  status      String   @default('pending') // 'pending' | 'reviewing' | 'resolved' | 'dismissed'
  resolvedBy  String?
  resolvedAt  DateTime?
  createdAt   DateTime @default(now())

  reporter    User     @relation(fields: [reporterId], references: [id])
 resolver    User?    @relation('ResolvedReports', fields: [resolvedBy], references: [id])

  @@index([targetType, targetId])
  @@index([status, createdAt])
  @@map('reports')
}

model SystemConfig {
  id    String @id @default('default')
  data  Json   // { plusPriceMonthly: 1990, dailyFreeReadings: 3, ... }
  updatedAt DateTime @updatedAt

  @@map('system_configs')
}

model MetricsSnapshot {
  id              String   @id @default(cuid())
  date            String   // '2025-01-15'
  totalUsers      Int
  newUsers        Int
  plusUsers       Int
  dailyReadings   Int
  aiInterpretations Int
  postsCreated    Int
  mrr             Int      // em centavos
  dau             Int
  createdAt       DateTime @default(now())

  @@unique([date])
  @@map('metrics_snapshots')
}
```

---

## 6. Pre-agregacao de Metricas

### Cron Job Diario (01:00 BRT)

```typescript
async function generateDailyMetrics() {
  const yesterday = subDays(new Date(), 1);
  const dateStr = format(yesterday, 'yyyy-MM-dd');

  const totalUsers = await prisma.user.count({ where: { deletedAt: null } });
  const newUsers = await prisma.user.count({
    where: { createdAt: { gte: startOfDay(yesterday), lt: endOfDay(yesterday) } },
  });
  const plusUsers = await prisma.user.count({ where: { role: 'plus' } });
  const dailyReadings = await prisma.reading.count({
    where: { createdAt: { gte: startOfDay(yesterday), lt: endOfDay(yesterday) } },
  });
  const mrr = await calculateMRR();

  await prisma.metricsSnapshot.upsert({
    where: { date: dateStr },
    create: { date: dateStr, totalUsers, newUsers, plusUsers, dailyReadings, mrr },
    update: { totalUsers, newUsers, plusUsers, dailyReadings, mrr },
  });
}
```

---

## 7. Rotas da Aplicacao

| Rota | Componente | Role | Descricao |
---|---|---|---|
| `/admin` | AdminDashboardPage | admin | Dashboard principal |
| `/admin/usuarios` | UsersListPage | admin | Lista de usuarios |
| `/admin/usuarios/:id` | UserDetailPage | admin | Detalhe do usuario |
| `/admin/moderacao` | ModerationPage | admin | Fila de moderacao |
| `/admin/denuncias` | ReportsPage | admin | Denuncias |
| `/admin/verificacao-pro` | ProVerificationPage | admin | Perfis profissionais |
| `/admin/financeiro` | FinancePage | admin | Visao financeira |
| `/admin/financeiro/transacoes` | TransactionsPage | admin | Lista de transacoes |
| `/admin/sistema/saude` | SystemHealthPage | admin | Saude do sistema |
| `/admin/sistema/jobs` | JobsPage | admin | Cron jobs |
| `/admin/sistema/auditoria` | AuditLogPage | admin | Log de auditoria |
| `/admin/sistema/configuracoes` | ConfigPage | superadmin | Configuracoes |

---

## 8. Seguranca

### 8.1 Protecao de Rotas
- Todas as rotas `/admin/*` exigem role `admin` ou `superadmin`
- Rotas de `/admin/sistema/configuracoes` exigem role `superadmin`
- Validacao de role em middleware de API (server-side) E no AuthGuard (client-side)

### 8.2 Rate Limiting Admin
- Endpoints de admin: maximo 100 requisicoes por minuto por admin
- Endpoints de bulk action: maximo 10 por minuto
- Exportacao CSV: maximo 5 por hora

### 8.3 Log de Acesso
- Todo acesso a rotas de admin e registrado (rota, IP, user agent, timestamp)
- Acoes destrutivas (exclusao, suspensao) exigem confirmacao com digitacao de palavra-chave ("CONFIRMAR")