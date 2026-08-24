# Admin Health Endpoint Rich Metadata Variant

> **Category**: backend / observability
> **Pattern Type**: Pattern extension
> **Related**: `docs/solutions/patterns/backend/health-check-envelope.md`

## Problem

A simple health check envelope is insufficient for admin dashboards. Admins need:
- Per-service latency metrics (database, Redis, AI, storage)
- Connection pool statistics
- SSL expiry dates
- Memory usage percentages
- Real-time activity status (webhook delivery, active connections)

The basic health envelope provides only `status`, `timestamp`, `version`, and `uptime`. Admin endpoints require richer metadata without breaking the envelope contract.

## Solution

Create a **"rich metadata variant"** of the health envelope:
- Same envelope structure (`data.status`, `data.timestamp`, `data.services`)
- Enhanced per-service metadata fields (`latencyMs`, `connectionPool`, `sslExpiry`, `memoryUsage`, etc.)
- Distinguish between "simple" and "admin" health endpoints with distinct endpoints:
  - `/api/health` — simple envelope (non-admin, monitoring, load balancer probes)
  - `/admin/system/health` — rich metadata variant (admin dashboards, operational insights)

## Key Elements

### 1. Simple Health Envelope (Monitoring/Load Balancer)

```typescript
// GET /api/health
interface HealthEnvelope {
  data: {
    status: 'ok' | 'degraded' | 'error';
    timestamp: string;
    version: string;
    uptime: string;
    services: {
      database: ServiceHealth;
      redis: ServiceHealth;
      ai: ServiceHealth;
    };
  };
}

interface ServiceHealth {
  status: 'ok' | 'error' | 'not-configured';
}

// Implementation
app.get('/api/health', async (req, res) => {
  const dbStatus = await checkDatabase();
  const redisStatus = await checkRedis();
  const aiStatus = await checkAI();

  const overallStatus = overallStatus(dbStatus, redisStatus, aiStatus);

  res.json({
    data: {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      version: process.env.APP_VERSION,
      uptime: formatUptime(process.uptime()),
      services: {
        database: { status: dbStatus },
        redis: { status: redisStatus },
        ai: { status: aiStatus }
      }
    }
  });
});
```

### 2. Admin Health Endpoint (Rich Metadata)

```typescript
// GET /api/v1/admin/system/health
interface AdminHealthResponse {
  data: {
    status: 'healthy' | 'up' | 'degraded' | 'error';
    timestamp: string;
    version: string;
    uptime: string;
    services: {
      database: DatabaseHealth;
      redis: RedisHealth;
      ai: AIHealth;
      mercadopago: MercadoPagoHealth;
      websocket: WebSocketHealth;
      storage: StorageHealth;
    };
    caddy: CaddyHealth; // Reverse proxy status
  };
}

interface DatabaseHealth {
  status: 'ok' | 'error' | 'not-configured' | 'healthy' | 'up' | 'degraded';
  latencyMs: number;
  connectionPool: {
    active: number;
    idle: number;
    max: number;
  };
  protocol?: string;
  port?: number;
  tlsVersion?: string;
}

interface RedisHealth {
  status: 'ok' | 'error' | 'not-configured' | 'healthy' | 'up' | 'degraded';
  latencyMs: number;
  memoryUsage: string; // Percentage (e.g., "45%")
}

interface AIHealth {
  status: 'ok' | 'error' | 'not-configured' | 'healthy' | 'up' | 'degraded';
  latencyMs: number;
  provider: string;
  model: string;
  avgLatencyMs: number;
  errorRate24h: number;
}

interface MercadoPagoHealth {
  status: 'ok' | 'error' | 'not-configured' | 'healthy' | 'up' | 'degraded';
  lastWebhookAt?: string;
}

interface WebSocketHealth {
  status: 'ok' | 'error' | 'not-configured' | 'healthy' | 'up' | 'degraded';
  port: number;
  activeConnections: number;
}

interface StorageHealth {
  status: 'ok' | 'error' | 'not-configured' | 'healthy' | 'up' | 'degraded';
  provider: string;
  usedGB: number;
  totalGB: number;
}

interface CaddyHealth {
  status: 'ok' | 'error' | 'not-configured' | 'healthy' | 'up' | 'degraded';
  sslExpiry?: string;
}
```

### 3. Implementation

```typescript
// src/app/api/v1/admin/system/health/route.ts
app.get('/api/v1/admin/system/health', async (req, res) => {
  try {
    // Check all services in parallel
    const [dbHealth, redisHealth, aiHealth, mpHealth, wsHealth, storageHealth] =
      await Promise.all([
        checkDatabaseHealth(),
        checkRedisHealth(),
        checkAIHealth(),
        checkMercadoPagoHealth(),
        checkWebSocketHealth(),
        checkStorageHealth()
      ]);

    // Caddy reverse proxy (local container check)
    const caddyHealth = await checkCaddyHealth();

    // Aggregate overall status
    const overallStatus = aggregateAdminHealthStatus([
      dbHealth,
      redisHealth,
      aiHealth,
      mpHealth,
      wsHealth,
      storageHealth,
      caddyHealth
    ]);

    res.json({
      data: {
        status: overallStatus,
        timestamp: new Date().toISOString(),
        version: process.env.APP_VERSION,
        uptime: formatUptime(process.uptime()),
        services: {
          database: dbHealth,
          redis: redisHealth,
          ai: aiHealth,
          mercadopago: mpHealth,
          websocket: wsHealth,
          storage: storageHealth
        },
        caddy: caddyHealth
      }
    });
  } catch (error) {
    res.status(500).json({
      data: {
        status: 'error',
        timestamp: new Date().toISOString(),
        version: process.env.APP_VERSION,
        uptime: formatUptime(process.uptime()),
        services: {
          database: { status: 'error' },
          redis: { status: 'error' },
          ai: { status: 'error' },
          mercadopago: { status: 'error' },
          websocket: { status: 'error' },
          storage: { status: 'error' }
        },
        caddy: { status: 'error' }
      }
    });
  }
});

async function checkDatabaseHealth(): Promise<DatabaseHealth> {
  const start = Date.now();

  try {
    await prisma.$queryRaw`SELECT 1`; // Simple connectivity check
    const latency = Date.now() - start;

    // Get connection pool stats
    const poolStats = await prisma.$queryRaw`
      SELECT num_active_connections, num_idle_connections
      FROM pg_stat_activity
      LIMIT 1
    `;

    return {
      status: 'ok',
      latencyMs: latency,
      connectionPool: {
        active: Number(poolStats[0]?.num_active_connections || 0),
        idle: Number(poolStats[0]?.num_idle_connections || 0),
        max: 20 // Prisma default
      },
      protocol: 'postgresql',
      port: 5432,
      tlsVersion: 'TLSv1.3'
    };
  } catch (error) {
    return {
      status: 'error',
      latencyMs: 0,
      connectionPool: { active: 0, idle: 0, max: 20 }
    };
  }
}

async function checkRedisHealth(): Promise<RedisHealth> {
  const start = Date.now();

  try {
    await redis.ping();
    const latency = Date.now() - start;

    // Get memory usage
    const info = await redis.info('memory');
    const usedMemory = info.match(/used_memory_human:(.*)/)?.[1] || '0';
    const totalMemory = info.match(/total_memory_human:(.*)/)?.[1] || '0';

    // Calculate percentage
    const memoryUsage = `${Math.round((parseFloat(usedMemory) / parseFloat(totalMemory)) * 100)}%`;

    return {
      status: 'ok',
      latencyMs: latency,
      memoryUsage: memoryUsage
    };
  } catch (error) {
    return {
      status: 'error',
      latencyMs: 0,
      memoryUsage: '0%'
    };
  }
}
```

### 4. Logging

```typescript
// Admin health endpoint uses logger, not console.error
import { logger } from '@/lib/logger';

app.get('/api/v1/admin/system/health', (req, res) => {
  logger.info('Admin health check requested', {
    userId: req.user.id,
    timestamp: new Date().toISOString()
  });

  // ... health check logic ...
});
```

**Gotcha:** When `src/lib/logger.ts` (Pino) lands, migrate from `console.error` to `logger.error('[health] ...')`. See `docs/solutions/patterns/backend/health-check-envelope.md` for migration notes.

## When to Use

- Admin dashboards requiring detailed service status
- Operational monitoring beyond load balancer probes
- Troubleshooting performance issues with per-service latency
- Audit logging of system health checks
- Integration with dashboard/alerting tools

## Related Patterns

- **Health Check Envelope**: The base envelope pattern (`docs/solutions/patterns/backend/health-check-envelope.md`)
- **Observability Patterns**: `docs/02-architecture/observability.md` (Pino, Sentry, PostHog)

## Gotchas

1. **Performance impact**: Rich health checks can be slow (e.g., measuring latency, connection pool stats). Run checks in parallel and use timeouts.

2. **Metric collection**: Avoid excessive data collection. Include only metrics that drive operational decisions.

3. **Auth requirement**: Admin health endpoints should require admin role (`role: "admin"`).

4. **Consistency**: Use the same service status values ('ok', 'error', 'degraded') across simple and admin health endpoints.

5. **Timeout handling**: Always set timeouts for external service checks (Redis, AI, storage).

6. **Backward compatibility**: Keep `/api/health` simple. Don't add rich metadata to the simple endpoint.

7. **Caddy check**: Caddy is a local container. Use Docker API or HTTP health check with appropriate timeouts.

## Sources

- `docs/solutions/patterns/backend/health-check-envelope.md` (base envelope pattern)
- `docs/04-api/admin.md` (admin health endpoint specification)
- `docs/02-architecture/deployment.md` (Caddy reverse proxy setup)
- `docs/02-architecture/scalability.md` (connection pool monitoring)
- `docs/02-architecture/observability.md` (Pino logger setup)
