# Permissões (RBAC) — Arkana Agora

> **Identificador**: `arkana-agora` | **Módulo**: Controle de Acesso (RBAC) | **Versão**: MVP

---

## Descrição

O sistema de controle de acesso do **Arkana Agora** utiliza o modelo **RBAC (Role-Based Access Control)** para gerenciar permissões de forma granular e escalável. Cada usuário possui um papel (role) que define quais ações ele pode realizar na plataforma.

> **Alinhamento com o schema (fonte da verdade):** os papéis implementados em `prisma/schema.prisma` são `USER`, `PROFESSIONAL` e `ADMIN` (`enum UserRole`); `SUPER_ADMIN` é **planejado** (pós-MVP). O nível de **plano** (`UserPlan`: `FREE`/`PLUS`) é uma **dimensão separada do role** — o antigo `PLUS_USER` corresponde a role `USER` com plano `PLUS`. Nas tabelas abaixo, as colunas `FREE`/`PLUS` representam o plano aplicado sobre a role `USER`.

> **providerId Convention:** For EMAIL provider accounts, `providerId` is set to `email` normalized to lowercase (e.g., "Maria@email.com" → "maria@email.com"), per sprint-0.clarifications.md. For OAuth providers (GOOGLE/FACEBOOK), `providerId` is the OAuth subject ID.

O modelo de permissões é implementado como um middleware no nível da API, verificando o role do usuário autenticado contra a matriz de permissões antes de permitir o acesso a qualquer endpoint. As permissões são combináveis (herança) — um `PROFESSIONAL` herda todas as permissões de `USER`, e assim por diante. Limites de plano (FREE/PLUS) são validados em runtime pelo `UserPlan`. Rate limits são diferenciados por role, garantindo que usuários pagos tenham uma experiência superior.

---

## Papéis (Roles)

| Role | Descrição | Como Obtém |
|---|---|---|
| `USER` (plano `FREE`) | Usuário gratuito com acesso básico | Cadastro padrão |
| `USER` (plano `PLUS`) | Assinante do plano Arkana Plus (mesma role, plano distinto) | Assinatura ativa (R$ 19,90/mês) |
| `PROFESSIONAL` | Profissional verificado (tarólogo, numerólogo, etc.) | Verificação aprovada + plano PLUS |
| `ADMIN` | Administrador da plataforma | Designado internamente |
| `SUPER_ADMIN` **[planejado]** | Administrador supremo, acesso total | Fundador/CTO |

### Hierarquia de Herança

```
USER
  └── PROFESSIONAL
        └── ADMIN
              └── SUPER_ADMIN [planejado]

Plano (dimensão ortogonal ao role):
  FREE → PLUS  (UserPlan — amplia limites/consumo da role USER, não muda o role)
```

---

## Matriz de Permissões

> Colunas: `FREE`/`PLUS` = plano (`UserPlan`) sobre a role `USER`; `PRO` = `PROFESSIONAL`; `ADMIN` = `ADMIN`; `SUPER` = `SUPER_ADMIN` (planejado). Herança: cada coluna à direita inclui as permissões da anterior.

### Autenticação

| Permissão | FREE | PLUS | PRO | ADMIN | SUPER |
|---|---|---|---|---|---|
| `auth.register` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `auth.login` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `auth.delete_account` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `auth.manage_sessions` | ✅ | ✅ | ✅ | ✅ | ✅ |

### Leituras (Readings)

| Permissão | FREE | PLUS | PRO | ADMIN | SUPER |
|---|---|---|---|---|---|
| `readings.draw_free` | ✅ (3/dia) | ✅ (∞) | ✅ (∞) | ✅ (∞) | ✅ (∞) |
| `readings.draw_premium_spreads` | ❌ | ✅ | ✅ | ✅ | ✅ |
| `readings.save` | ✅ (10) | ✅ (∞) | ✅ (∞) | ✅ (∞) | ✅ (∞) |
| `readings.share` | ✅ (marca d'água) | ✅ (sem marca) | ✅ (sem marca) | ✅ (sem marca) | ✅ (sem marca) |
| `readings.history` | ✅ (30 dias) | ✅ (ilimitado) | ✅ (ilimitado) | ✅ (ilimitado) | ✅ (ilimitado) |
| `readings.ai_interpretation` | ✅ (básica) | ✅ (avançada) | ✅ (avançada) | ✅ (avançada) | ✅ (avançada) |
| `readings.lenormand` | ❌ | ✅ | ✅ | ✅ | ✅ |
| `readings.daily` | ✅ | ✅ (estendida) | ✅ (estendida) | ✅ (estendida) | ✅ (estendida) |
| `readings.love` | ❌ | ✅ | ✅ | ✅ | ✅ |

### Social

| Permissão | FREE | PLUS | PRO | ADMIN | SUPER |
|---|---|---|---|---|---|
| `social.follow` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `social.post` | ✅ (5/dia) | ✅ (∞) | ✅ (∞) | ✅ (∞) | ✅ (∞) |
| `social.comment` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `social.gift.send` | ❌ | ✅ | ✅ | ✅ | ✅ |
| `social.gift.receive` | ✅ | ✅ | ✅ | ✅ | ✅ |

### Marketplace

| Permissão | FREE | PLUS | PRO | ADMIN | SUPER |
|---|---|---|---|---|---|
| `marketplace.browse` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `marketplace.buy` | ✅ | ✅ (10% off) | ✅ (10% off) | ✅ | ✅ |
| `marketplace.sell` | ❌ | ✅ | ✅ | ✅ | ✅ |
| `marketplace.manage_products` | ❌ | ❌ | ✅ | ✅ | ✅ |

### Profissional

| Permissão | FREE | PLUS | PRO | ADMIN | SUPER |
|---|---|---|---|---|---|
| `pro.profile` | ❌ | ❌ | ✅ | ✅ | ✅ |
| `pro.booking.manage` | ❌ | ❌ | ✅ | ✅ | ✅ |
| `pro.revenue.view` | ❌ | ❌ | ✅ | ✅ | ✅ |
| `pro.revenue.withdraw` | ❌ | ❌ | ✅ | ✅ | ✅ |

### Admin

| Permissão | FREE | PLUS | PRO | ADMIN | SUPER |
|---|---|---|---|---|---|
| `admin.manage_users` | ❌ | ❌ | ❌ | ✅ | ✅ |
| `admin.view_analytics` | ❌ | ❌ | ❌ | ✅ | ✅ |
| `admin.manage_content` | ❌ | ❌ | ❌ | ✅ | ✅ |
| `admin.manage_payments` | ❌ | ❌ | ❌ | ✅ | ✅ |
| `admin.manage_professionals` | ❌ | ❌ | ❌ | ✅ | ✅ |
| `admin.manage_marketplace` | ❌ | ❌ | ❌ | ✅ | ✅ |
| `admin.view_logs` | ❌ | ❌ | ❌ | ✅ | ✅ |
| `admin.manage_roles` | ❌ | ❌ | ❌ | ❌ | ✅ |
| `admin.manage_platform` | ❌ | ❌ | ❌ | ❌ | ✅ |

---

## Upgrade para Profissional

### Requisitos

| Requisito | Descrição |
|---|---|
| Conta ativa | Mínimo 30 dias desde o cadastro |
| Plano Plus | Assinatura Arkana Plus ativa |
| Perfil completo | Nome, bio, foto, data de nascimento preenchidos |
| Documentação | CPF e comprovante de experiência/certificação |
| Especialidades | Pelo menos 1 especialidade declarada |
| Sem sanções | Nenhuma denúncia confirmada nos últimos 90 dias |

### Benefícios do Upgrade

- Perfil profissional verificado com selo diferenciado
- Sistema de agendamento e consultas pagas
- Repartição de receita (70% do valor da consulta)
- Listagem prioritária na busca de profissionais
- Acesso a métricas avançadas de desempenho
- Prioridade no suporte

---

## Rate Limits por Role

| Endpoint | FREE | PLUS | PRO | ADMIN | SUPER |
|---|---|---|---|---|---|
| `GET /api/*` (geral) | 100/min | 300/min | 300/min | 600/min | 600/min |
| `POST /api/*` (geral) | 50/min | 150/min | 150/min | 600/min | 600/min |
| `POST /api/readings` | 10/min | Ilimitado* | Ilimitado* | Ilimitado* | Ilimitado* |
| `POST /api/social/posts` | 5/hora | Ilimitado* | Ilimitado* | 600/min | 600/min |
| `POST /api/auth/login` | 5/15min | 5/15min | 5/15min | 20/15min | 20/15min |

> \* Ilimitado com soft limit de 100/min para proteção contra abuso.

---

## Implementação

### Middleware de Permissão

```typescript
import { Request, Response, NextFunction } from 'express';
import { Permission } from '../enums/permissions.enum';
import { RoleHierarchy } from '../constants/roles.constants';

function requirePermission(permission: Permission) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const userRole = req.user?.role;
    const userPlan = req.user?.plan; // vindo da sessão

    if (!userRole) {
      return res.status(401).json({ error: 'Não autenticado' });
    }

    // Role-based permission check
    const hasPermission = RoleHierarchy[userRole]?.includes(permission);

    if (!hasPermission) {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    // Plan-based concession (PLUS users get premium permissions)
    if (permission === 'readings.draw_premium_spreads' && userPlan === 'FREE') {
      return res.status(403).json({ error: 'Recurso exclusivo para assinatura PLUS' });
    }

    next();
  };
}

// Uso no controller
router.post('/readings', requirePermission('readings.draw_free'), createReading);
```

### Constantes de Role

```typescript
enum UserRole {
  USER = 'USER',
  PROFESSIONAL = 'PROFESSIONAL',
  ADMIN = 'ADMIN',
  SUPER_ADMIN = 'SUPER_ADMIN', // [planejado — ainda não está em prisma/schema.prisma]
}

const RoleHierarchy: Record<UserRole, Permission[]> = {
  [UserRole.USER]: [
    // FREE + PLUS: concessões do plano PLUS são validadas em runtime pelo UserPlan
    'auth.register', 'auth.login', 'auth.delete_account',
    'readings.draw_free', 'readings.save', 'readings.share',
    'readings.history', 'readings.ai_interpretation', 'readings.daily',
    'readings.draw_premium_spreads', 'readings.lenormand', 'readings.love',
    'social.follow', 'social.post', 'social.comment', 'social.gift.receive',
    'social.gift.send', 'marketplace.browse', 'marketplace.buy', 'marketplace.sell',
  ],
  [UserRole.PROFESSIONAL]: [
    // Herda tudo de USER +
    'pro.profile', 'pro.booking.manage', 'pro.revenue.view',
    'pro.revenue.withdraw', 'marketplace.manage_products',
  ],
  [UserRole.ADMIN]: [
    // Herda tudo de PROFESSIONAL +
    'admin.manage_users', 'admin.view_analytics', 'admin.manage_content',
    'admin.manage_payments', 'admin.manage_professionals',
    'admin.manage_marketplace', 'admin.view_logs',
  ],
  [UserRole.SUPER_ADMIN]: [
    // Herda tudo de ADMIN +
    'admin.manage_roles', 'admin.manage_platform',
  ],
};
```

---

## Critérios de Aceite

- **CA-01**: Um usuário `USER` (plano `FREE`) deve ser bloqueado ao tentar acessar qualquer endpoint com permissão de plano `PLUS` ou role superior (HTTP 403)
- **CA-02**: O rate limit de `USER` (plano `FREE`) (100 req/min em GET) deve retornar HTTP 429 com header `Retry-After` quando excedido
- **CA-03**: O upgrade de plano `FREE`→`PLUS` e de role `USER`→`PROFESSIONAL` deve refletir nas permissões em menos de 1 segundo após a aprovação
- **CA-04**: Todas as rotas de admin devem estar protegidas pelo middleware de permissão, sem exceções
- **CA-05**: O middleware deve adicionar menos de 5ms de latência por requisição