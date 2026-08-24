# Logger Migration: console.error to Pino

> **Category**: observability / logging
> **Pattern Type**: Migration pattern
> **Related**: `docs/02-architecture/observability.md`, `docs/solutions/patterns/backend/health-check-envelope.md`

## Problem

Until `src/lib/logger.ts` (Pino) is implemented, health-check pattern and other logging uses `console.error` with `[health]` prefix as a stopgap. This approach:
- Doesn't provide structured logging (JSON output)
- Lacks middleware support
- Doesn't integrate with observability stack (Sentry, PostHog)
- Can't be easily filtered by log aggregation tools

## Solution

Adopt a **two-phase migration pattern**:
1. **Phase 1 (current)**: Use `console.error` with `[health]` prefix as a stopgap
2. **Phase 2 (future)**: Migrate to Pino when `src/lib/logger.ts` lands

Both patterns coexist during the transition, ensuring no logging gaps.

## Key Elements

### 1. Phase 1: console.error Stopgap

```typescript
// src/app/api/health/route.ts
app.get('/api/health', async (req, res) => {
  try {
    // ... health check logic ...

    // Use console.error with [health] prefix
    console.error('[health] Database status: ok');
    console.error('[health] Redis status: ok');
    console.error('[health] AI status: not-configured');

    res.json({ data: { status: 'ok', ... } });
  } catch (error) {
    console.error('[health] Health check failed:', error);
    res.status(503).json({ data: { status: 'error' } });
  }
});

// docs/solutions/patterns/backend/health-check-envelope.md
# Pattern: Health Check Envelope

> **Logger note:** This pattern currently uses `console.error` with `[health]` prefix as a stopgap. When `src/lib/logger.ts` (Pino) lands, migrate to `logger.error('[health] ...')` to align with observability.md §2.1.
```

**Gotcha:** Always use a consistent prefix (`[health]`) to distinguish from other console.error calls.

### 2. Phase 2: Pino Migration

```typescript
// src/lib/logger.ts (future)
import pino from 'pino';
import { version } from '@/lib/version';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'SYS:standard',
      ignore: 'pid,hostname'
    }
  }
});

// health-check-envelope.md pattern (updated)
# Pattern: Health Check Envelope

> **Logger note:** When `src/lib/logger.ts` (Pino) lands, migrate from `console.error` to `logger.error('[health] ...')` to align with observability.md §2.1.

// src/app/api/health/route.ts (migrated)
import { logger } from '@/lib/logger';

app.get('/api/health', async (req, res) => {
  try {
    // ... health check logic ...

    logger.info('Health check successful', {
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: process.env.APP_VERSION
    });

    res.json({ data: { status: 'ok', ... } });
  } catch (error) {
    logger.error({ error }, 'Health check failed');
    res.status(503).json({ data: { status: 'error' } });
  }
});
```

### 3. Migrate Pattern Documentation

```markdown
<!-- docs/solutions/patterns/backend/health-check-envelope.md -->
# Pattern: Health Check Envelope

> **Logger note:** This pattern uses `console.error` with `[health]` prefix as a stopgap. When `src/lib/logger.ts` lands, migrate to `logger.error('[health] ...')` to align with observability.md §2.1.

## Problem / When to Use This

Use this pattern whenever you build or extend a status/health endpoint...

## Source of Truth Files

- `src/app/api/health/route.ts` — the implemented envelope (contract in code)
- `src/lib/version.ts` — central version constant
- `tests/health.test.ts` — the vitest contract test
```

### 4. Migration Checklist

```typescript
// docs/solutions/patterns/backend/logger-migration.md
## Migration Checklist

When migrating from console.error to Pino:

- [ ] Create `src/lib/logger.ts` with Pino configuration
- [ ] Add `logger.error('[health] ...')` for health check pattern
- [ ] Update all `console.error` calls to `logger.error` with context
- [ ] Test JSON logging output (avoid `JSON.stringify` when using Pino)
- [ ] Configure log level based on environment (`process.env.LOG_LEVEL`)
- [ ] Add structured context to log messages (status, timestamp, version)
- [ ] Verify integration with Sentry (Pino middleware)
- [ ] Verify integration with PostHog (if applicable)
- [ ] Update documentation to reflect new pattern

## Examples

### Before (console.error)

```typescript
console.error('[health] Database status: ok');
console.error('[health] Redis status: error');
console.error('[health] AI status: not-configured');
```

### After (Pino)

```typescript
logger.info('Health check successful', {
  services: {
    database: { status: 'ok' },
    redis: { status: 'error' },
    ai: { status: 'not-configured' }
  },
  timestamp: new Date().toISOString(),
  version: process.env.APP_VERSION
});

// Or for errors
logger.error({
  error,
  service: 'database',
  timestamp: new Date().toISOString()
}, 'Health check failed');
```
```

## When to Use

- **Current phase**: Use `console.error` with `[health]` prefix for health-check patterns
- **Future phase**: Migrate to Pino when `src/lib/logger.ts` is implemented
- **Both phases**: Maintain consistent logging style during migration

## Related Patterns

- **Health Check Envelope**: Uses console.error stopgap (see migration notes)
- **Observability Stack**: Pino + Sentry + PostHog (see `docs/02-architecture/observability.md`)

## Gotchas

1. **JSON structure**: Pino outputs JSON by default. Don't use `JSON.stringify` for log messages.

2. **Error context**: Pass error objects directly to `logger.error({ error })`. Pino automatically extracts stack traces.

3. **Log levels**: Use appropriate levels (info for successful checks, error for failures).

4. **Structured context**: Add context objects to logs for filtering and analysis (status, timestamp, version).

5. **Environment-specific**: Configure log level based on environment (`production` → `error`, `development` → `debug`).

6. **Performance**: Pino is ~5x faster than Winston (per `observability.md` §2.1). Use it as soon as available.

7. **Backward compatibility**: Keep console.error logs during migration to avoid log gaps.

## Sources

- `docs/02-architecture/observability.md` (Pino logger specification)
- `docs/solutions/patterns/backend/health-check-envelope.md` (console.error stopgap note)
- `docs/02-architecture/deployment.md` (logger note for health checks)
- `docs/08-sprints/sprint-0.md` (Sprint 1 auth implementation notes)

## Status Update

- **2026-08-24:** Phase 2 landed for the health-check surface — `src/lib/logger.ts` (Pino + pino-pretty em dev, redact de secrets, reqId helper) existe e `src/app/api/health/route.ts` loga via `logger.error({ err }, "[health] ...")`. Remaining known stopgap: `console.log("[auth:magic-link] ...")` em `src/auth/auth.config.ts:88` (fora do escopo da fase de observabilidade; migrar quando o fluxo de auth for tocado).
