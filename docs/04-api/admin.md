# API Admin — arkana-agora

> **Módulo**: `src/app/api/v1/admin/` | **Autenticação**: JWT + role `admin` | **Auditoria**: Todas as ações logadas

> **Health contract:** See `docs/solutions/patterns/backend/health-check-envelope.md` for the envelope pattern. Admin health endpoint (`GET /admin/system/health`) uses a richer variant with per-service metadata (latency, connectionPool, sslExpiry, memoryUsage, etc.) as documented in this endpoint. Both share the same `data` wrapper and status/until/uptime structure.

## Sumário

- [Visão Geral](#visão-geral)
- [GET /admin/users](#get-adminusers)
- [PATCH /admin/users/:id](#patch-adminusersid)
- [PATCH /admin/users/:id/role](#patch-adminusersidrole)
- [DELETE /admin/users/:id](#delete-adminusersid)
- [GET /admin/analytics](#get-adminanalytics)
- [GET /admin/reports](#get-adminreports)
- [POST /admin/reports/:id/resolve](#post-adminreportsidresolve)
- [GET /admin/payments](#get-adminpayments)
- [GET /admin/system/health](#get-adminsystemhealth)

---

## Visão Geral

### Acesso

Todas as rotas admin exigem:

```http
Authorization: Bearer <admin_jwt_token>
X-Admin-Secret: <chave_admin>
```

> Apenas usuários com `role: "admin"` podem acessar. Ações são registradas em log de auditoria.

### Log de Auditoria

Toda ação admin gera registro:

```json
{
  "id": "audit_001",
  "adminId": "usr_admin1",
  "action": "user.role_change",
  "targetId": "usr_target123",
  "details": { "oldRole": "free", "newRole": "admin" },
  "ip": "189.123.45.67",
  "userAgent": "Mozilla/5.0...",
  "timestamp": "2025-01-15T10:30:00Z"
}
```

---

## GET /admin/users

Lista todos os usuários com paginação e filtros.

### Requisição

```http
GET /api/v1/admin/users?page=1&limit=20&role=user&plan=plus&search=maria&sortBy=createdAt&sortOrder=desc
```

### Parâmetros de Query

| Parâmetro | Tipo | Padrão | Descrição |
|-----------|------|--------|-----------|
| `page` | number | 1 | Página atual |
| `limit` | number | 20 | Itens (máx 100) |
| `role` | string | Todos | `user`, `professional`, `admin` |
| `plan` | string | Todos | `free`, `plus` |
| `status` | string | Todos | `active`, `suspended`, `pending_deletion` |
| `search` | string | — | Buscar por nome, email ou username |
| `sortBy` | string | `createdAt` | Campo de ordenação |
| `sortOrder` | string | `desc` | `asc` ou `desc` |
| `registeredAfter` | string | — | Filtrar por data de cadastro (ISO 8601) |
| `registeredBefore` | string | — | Filtrar por data de cadastro (ISO 8601) |

### Resposta — 200 OK

```json
{
  "data": [
    {
      "id": "usr_a1b2c3d4",
      "name": "Maria Silva",
      "email": "maria@email.com",
      "username": "mariatarot",
      "avatar": "/avatars/usr_a1b2c3d4.jpg",
      "role": "user",
      "plan": "plus",
      "status": "active",
      "stats": {
        "totalReadings": 42,
        "aiReadings": 38,
        "followers": 156,
        "following": 89,
        "posts": 15
      },
      "aiUsage": {
        "monthTokens": 247000,
        "monthCost": 1.85
      },
      "createdAt": "2024-06-01T00:00:00Z",
      "lastActiveAt": "2025-01-15T10:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "totalItems": 15234,
    "totalPages": 762
  }
}
```

---

## PATCH /admin/users/:id

Edita dados de um usuário (admin override).

### Requisição

```http
PATCH /api/v1/admin/users/usr_target123
Content-Type: application/json
```

```json
{
  "name": "Maria Silva Santos",
  "plan": "plus",
  "status": "active"
}
```

### Campos editáveis

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `name` | string | Nome do usuário |
| `plan` | string | Plano (`free`, `plus`) |
| `status` | string | Status (`active`, `suspended`) |
| `emailVerified` | boolean | Verificar e-mail manualmente |

### Resposta — 200 OK

```json
{
  "data": {
    "user": {
      "id": "usr_target123",
      "name": "Maria Silva Santos",
      "plan": "plus",
      "status": "active",
      "updatedAt": "2025-01-15T10:30:00Z"
    }
  }
}
```

### Erros

| Status | Código | Descrição |
|--------|--------|-----------|
| 404 | `USER_NOT_FOUND` | Usuário não encontrado |
| 403 | `CANNOT_MODIFY_ADMIN` | Não é possível modificar outro admin |

---

## PATCH /admin/users/:id/role

Altera o papel (role) de um usuário.

### Requisição

```http
PATCH /api/v1/admin/users/usr_target123/role
Content-Type: application/json
```

```json
{
  "role": "professional",
  "reason": "Usuário solicitou venda de produtos esotéricos. Documentação verificada."
}
```

### Roles disponíveis

| Role | Descrição | Permissões |
|------|-----------|------------|
| `user` | Usuário comum | Acesso padrão |
| `professional` | Profissional / vendedor marketplace | Criação de produtos + tudo de user |
| `admin` | Administrador | Acesso total |

### Validação

| Campo | Tipo | Obrigatório | Regras |
|-------|------|-------------|--------|
| `role` | string | Sim | `user`, `professional`, `admin` |
| `reason` | string | Sim | Motivo da alteração (mín 10 chars) |

### Resposta — 200 OK

```json
{
  "data": {
    "user": {
      "id": "usr_target123",
      "role": "professional"
    },
    "auditId": "audit_002"
  }
}
```

### Erros

| Status | Código | Descrição |
|--------|--------|-----------|
| 403 | `CANNOT_MODIFY_SELF_ROLE` | Não é possível alterar o próprio role |
| 403 | `CANNOT_MODIFY_ADMIN` | Não é possível alterar outro admin |

---

## DELETE /admin/users/:id

Suspende uma conta de usuário.

### Requisição

```http
DELETE /api/v1/admin/users/usr_target123
Content-Type: application/json
```

```json
{
  "reason": "Violação dos termos de uso: spam no feed.",
  "duration": "permanent"
}
```

### Validação

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|-------------|-------------|
| `reason` | string | Sim | Motivo da suspensão (mín 10 chars) |
| `duration` | string | Sim | `7d`, `30d`, `permanent` |

### Comportamento

1. Suspende a conta imediatamente
2. Revoga todos os tokens ativos
3. Notifica o usuário por e-mail
4. Registra em log de auditoria
5. Se `permanent`, agenda exclusão em 30 dias

### Resposta — 200 OK

```json
{
  "data": {
    "user": {
      "id": "usr_target123",
      "status": "suspended",
      "suspendedAt": "2025-01-15T10:30:00Z",
      "suspensionDuration": "30d",
      "suspensionEndsAt": "2025-02-14T10:30:00Z"
    },
    "auditId": "audit_003"
  }
}
```

---

## GET /admin/analytics

Dashboard com métricas e analytics.

### Requisição

```http
GET /api/v1/admin/analytics?period=30d
```

### Parâmetros de Query

| Parâmetro | Tipo | Padrão | Descrição |
|-----------|------|--------|-----------|
| `period` | string | `7d` | `24h`, `7d`, `30d`, `90d` |

### Resposta — 200 OK

```json
{
  "data": {
    "overview": {
      "totalUsers": 15234,
      "newUsers": 342,
      "activeUsers": 8901,
      "payingUsers": 2156,
      "conversionRate": 14.2
    },
    "readings": {
      "total": 45678,
      "aiReadings": 38901,
      "manualReadings": 6777,
      "dailyAverage": 1284,
      "mostPopularSpread": "tres_cartas",
      "mostPopularDeck": "rider_waite"
    },
    "social": {
      "totalPosts": 23456,
      "totalComments": 89012,
      "totalLikes": 345678,
      "activeDaily": 3200
    },
    "revenue": {
      "total": 28450.0,
      "subscriptions": 21560.0,
      "marketplace": 6890.0,
      "currency": "BRL",
      "growthPercent": 12.5
    },
    "ai": {
      "totalTokensUsed": 45678900,
      "totalCost": 342.5,
      "averageLatencyMs": 4200,
      "errorRate": 0.3,
      "cacheHitRate": 42.0
    },
    "topCards": [
      { "cardId": "arc_19", "name": "O Sol", "count": 4523 },
      { "cardId": "arc_03", "name": "A Imperatriz", "count": 3891 },
      { "cardId": "arc_01", "name": "O Mago", "count": 3234 }
    ]
  }
}
```

---

## GET /admin/reports

Lista denúncias de moderação.

### Requisição

```http
GET /api/v1/admin/reports?status=pending&page=1&limit=20
```

### Parâmetros de Query

| Parâmetro | Tipo | Padrão | Descrição |
|-----------|------|--------|-----------|
| `status` | string | Todos | `pending`, `reviewing`, `resolved`, `dismissed` |
| `type` | string | Todos | `post`, `comment`, `user`, `ai_content` |
| `page` | number | 1 | Página |
| `limit` | number | 20 | Itens |

### Resposta — 200 OK

```json
{
  "data": [
    {
      "id": "rpt_001",
      "type": "ai_content",
      "resourceId": "rdg_z9y8x7",
      "reporterId": "usr_r1",
      "reporterName": "Ana Costa",
      "reason": "Conteúdo que pode ser prejudicial",
      "description": "A interpretação da IA menciona temas de automutilação.",
      "status": "pending",
      "aiFlag": {
        "flagged": true,
        "category": "self_harm_reference",
        "confidence": 0.87,
        "cvvRedirectTriggered": true
      },
      "createdAt": "2025-01-15T08:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "totalItems": 15,
    "totalPages": 1
  }
}
```

---

## POST /admin/reports/:id/resolve

Resolve uma denúncia.

### Requisição

```http
POST /api/v1/admin/reports/rpt_001/resolve
Content-Type: application/json
```

```json
{
  "action": "resolve",
  "resolution": "content_removed",
  "adminNote": "Conteúdo removido conforme política de moderação. CVV já havia sido acionado. Notificação enviada ao usuário."
}
```

### Ações possíveis

| Ação | Descrição |
|------|-----------|
| `resolve` | Denúncia procedente — aplica ação |
| `dismiss` | Denúncia improcedente — arquiva |

### Resoluções possíveis

| Resolução | Efeito |
|-----------|--------|
| `content_removed` | Remove conteúdo |
| `user_warned` | Adverte o usuário |
| `user_suspended_7d` | Suspensão temporária de 7 dias |
| `user_suspended_30d` | Suspensão temporária de 30 dias |
| `user_banned` | Banimento permanente |
| `no_action` | Apenas registro (com `dismiss`) |

### Resposta — 200 OK

```json
{
  "data": {
    "report": {
      "id": "rpt_001",
      "status": "resolved",
      "resolution": "content_removed",
      "resolvedBy": "usr_admin1",
      "resolvedAt": "2025-01-15T10:30:00Z"
    },
    "actionsTaken": [
      { "type": "content_removed", "resourceId": "rdg_z9y8x7" },
      { "type": "notification_sent", "targetId": "usr_target123" }
    ],
    "auditId": "audit_004"
  }
}
```

---

## GET /admin/payments

Relatórios financeiros.

### Requisição

```http
GET /api/v1/admin/payments?period=30d&type=all
```

### Parâmetros de Query

| Parâmetro | Tipo | Padrão | Descrição |
|-----------|------|--------|-----------|
| `period` | string | `30d` | `7d`, `30d`, `90d`, `1y` |
| `type` | string | `all` | `subscription`, `marketplace`, `all` |

### Resposta — 200 OK

```json
{
  "data": {
    "summary": {
      "totalRevenue": 28450.0,
      "subscriptions": 21560.0,
      "marketplace": 6890.0,
      "currency": "BRL",
      "mercadoPagoFees": 1712.0,
      "netRevenue": 26738.0
    },
    "subscriptions": {
      "activePlus": 2156,
      "newSubscriptions": 124,
      "cancellations": 23,
      "churnRate": 1.1,
      "mrr": 21560.0,
      "arr": 258720.0
    },
    "marketplace": {
      "totalOrders": 892,
      "completedOrders": 756,
      "pendingOrders": 34,
      "refundRequests": 8,
      "totalGMV": 6890.0,
      "commissionRate": 0.1,
      "commissionEarned": 689.0
    },
    "dailyBreakdown": [
      { "date": "2025-01-15", "subscriptions": 780.0, "marketplace": 230.0, "total": 1010.0 },
      { "date": "2025-01-14", "subscriptions": 720.0, "marketplace": 310.0, "total": 1030.0 }
    ]
  }
}
```

---

## GET /admin/system/health

Health check completo do sistema.

### Requisição

```http
GET /api/v1/admin/system/health
```

### Resposta — 200 OK

```json
{
  "data": {
    "status": "healthy",
    "version": "1.0.0",
    "uptime": "15d 8h 32m",
    "timestamp": "2025-01-15T10:30:00Z",
    "services": {
      "database": {
        "status": "up",
        "latencyMs": 12,
        "connectionPool": { "active": 8, "idle": 12, "max": 20 }
      },
      "redis": {
        "status": "up",
        "latencyMs": 2,
        "memoryUsage": "45%"
      },
      "ai": {
        "status": "up",
        "provider": "openai",
        "model": "gpt-4o",
        "avgLatencyMs": 4200,
        "errorRate24h": 0.3
      },
      "mercadopago": {
        "status": "up",
        "lastWebhookAt": "2025-01-15T10:28:00Z"
      },
      "websocket": {
        "status": "up",
        "port": 3003,
        "activeConnections": 234
      },
      "storage": {
        "status": "up",
        "provider": "cloudflare_r2",
        "usedGB": 12.5,
        "totalGB": 100
      }
    },
    "caddy": {
      "status": "up",
      "sslExpiry": "2025-04-15T00:00:00Z"
    }
  }
}
```