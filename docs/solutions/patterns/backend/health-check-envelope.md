---
title: "Health Check Envelope — Project Pattern"
problem_type: pattern
category: backend
components:
  - backend
tags:
  - patterns
  - health-check
  - status-endpoint
  - not-configured
  - nextjs-route-handler
  - prisma
  - observability
module: observability / ops baseline
date: 2026-08-11
established_in: "Health endpoint fixed and hardened in the Next.js 16 skeleton (branch dev): envelope with derived status, neutral optional services, 5s time-boxed DB check, central APP_VERSION, vitest coverage — 2026-08-11"
---

# Pattern: Health Check Envelope

> **Logger note (updated 2026-08-24):** the stopgap ended — health-route logging now uses Pino via `@/lib/logger` (`logger.error({ err }, '[health] ...')`). New checks must log through `logger`, keeping the `[health]` prefix.

## Problem / When to Use This

Use this pattern whenever you build or extend a status/health endpoint in this repo: the existing `GET /api/health` (skeleton ops baseline, per `docs/infrastructure.md`, `docs/02-architecture/observability.md` §6.3 and `docs/08-sprints/sprint-0.md`), the planned `GET /admin/system/health` (`docs/04-api/admin.md`), or any future probe endpoint. It answers three recurring questions: (1) how do I add a real service check (Redis, AI provider) without breaking the envelope contract? (2) how do I make optional dependencies degrade nothing when unconfigured? (3) how do I keep the HTTP status, the body `status`, and the version consistent?

## Source of Truth Files

- `src/app/api/health/route.ts` — the implemented envelope (contract in code)
- `src/lib/version.ts` — central version constant
- `tests/health.test.ts` — the vitest contract test
- `src/lib/prisma.ts` — Prisma singleton (must be used, not re-instantiated)
- `docs/02-architecture/observability.md` §6.3 — the written contract (pt-BR): "`database` é a única dependência dura do envelope `{status, timestamp, version, services: { database }}`. HTTP 200 é alcançável assim que o check de banco passa; 503 só em falha dura. `status` no corpo é derivado do check (`ok`/`degraded`) e nunca contradiz o código HTTP. Redis e IA ainda não fazem parte do envelope — quando adicionados, implemente `checkRedis()`/`checkAI()` seguindo o padrão; serviços opcionais não configurados reportam `{ status: 'not-configured' }`, neutro."

## Current Implementation Snapshot

- `GET /api/health` returns `{ status, timestamp, version, services: { database, redis } }`.
- `status` is **derived** from the checks: `degraded` if any configured check reports `error`, else `ok`. Never hardcoded.
- Probes run **in parallel** via `Promise.allSettled([checkDatabase(), checkRedis()])`; a rejected (crashed) probe is logged and treated as `error` so one crash cannot escape `GET`.
- `database` is the only **hard dependency**: probed via `prisma.$queryRaw\`SELECT 1\`` time-boxed with the shared `timeBox()` helper (`DB_CHECK_TIMEOUT_MS = 5_000`); failure is caught, logged via Pino (`logger.error({ err }, "[health] database check failed")`), and returned as `{ status: "error" }`.
- `redis` is an **optional** service: without `REDIS_URL` it returns `{ status: "not-configured" }` (neutral); when configured, a raw TCP `PING` (`node:net`, Redis inline protocol) runs through the same `timeBox()` helper (`REDIS_CHECK_TIMEOUT_MS = 3_000`) and a failure degrades the endpoint.
- HTTP mapping: `200` when no configured check failed; `503` on hard DB failure or a configured-but-failing optional service.
- `version` comes from `APP_VERSION` (`src/lib/version.ts`, reads `pkg.version` from `package.json` at module load) — the route never deep-imports `package.json` itself.
- `export const dynamic = "force-dynamic"` — the endpoint must never be statically cached.
- `tests/health.test.ts` mocks the Prisma singleton (`vi.mock("@/lib/prisma")`) and pins all derivation branches deterministically: db ok + redis not-configured → 200/`ok`; db error → 503/`degraded`; db ok + configured failing redis → 503/`degraded`.

## Planned / Optional Extensions (NOT implemented yet)

- Real `checkAI()` added to `services`, per `observability.md` §6.3. Unconfigured optional services report `{ status: "not-configured" }` (neutral — never degrade the endpoint) and configured-but-failing services report `error` (degrade).
- The `GET /admin/system/health` endpoint specified in `docs/04-api/admin.md` — reuse the same envelope shape and derivation rule.

## Pattern Overview

Build every status endpoint as an envelope: an object of named service checks, each a small `Promise<ServiceStatus>` function; derive the top-level `status` from the aggregate; map failures to HTTP only on hard dependency failure; time-box every check; report version from a central constant; and pin the whole contract with a vitest test that asserts the derivation rule, not concrete DB state.

## Implementation Steps

### Step 1: Define the per-service check type and function

[File: `src/app/api/health/route.ts` — or the equivalent route for a new status endpoint]

```typescript
type DatabaseStatus = { status: "ok" } | { status: "error" };

const DB_CHECK_TIMEOUT_MS = 5_000;

async function checkDatabase(): Promise<DatabaseStatus> {
  try {
    await Promise.race([
      prisma.$queryRaw`SELECT 1`,
      new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error("database check timed out")),
          DB_CHECK_TIMEOUT_MS,
        ),
      ),
    ]);
    return { status: "ok" };
  } catch (error) {
    console.error("[health] database check failed", error);
    return { status: "error" };
  }
}
```

Key points:
- Every check **must** be time-boxed with `Promise.race` + `setTimeout` (a hanging probe hangs the endpoint).
- Every check **must** catch and log (`console.error` with a `[health]` prefix) and return a status object — never let it throw out of `GET`.
- Use `prisma` from `@/lib/prisma` (the singleton). Do NOT instantiate `new PrismaClient()` in the route: Next.js dev imports route handlers on **every request**, so module-level instantiation is only safe through the singleton.

## Complete Example

Adding a real Redis check while keeping the contract (the exact next step the docs mandate):

```typescript
type RedisStatus =
  | { status: "ok" }
  | { status: "error" }
  | { status: "not-configured" };

const REDIS_CHECK_TIMEOUT_MS = 3_000;

async function checkRedis(): Promise<RedisStatus> {
  // Not yet configured → neutral, does NOT degrade the endpoint
  if (!process.env.REDIS_URL) return { status: "not-configured" };
  try {
    // ... time-boxed probe (Promise.race + setTimeout), same shape as checkDatabase
    return { status: "ok" };
  } catch (error) {
    console.error("[health] redis check failed", error);
    return { status: "error" };
  }
}
```

Note the one asymmetry: an *unconfigured* check returns `not-configured` (neutral); a *configured-but-failing* check returns `error` (degrades). The `services` map then becomes:

```typescript
const services = {
  database: await checkDatabase(),
  redis: await checkRedis(),
  ai: await checkAI(), // same pattern
};
```

And the test asserts: `["not-configured", "ok", "error"]` contains `body.services.redis.status`, plus `if (body.services.redis.status === "error") → body.status === "degraded"`.

## Project-Specific Constraints

- [ ] Top-level `status` is **derived** from the checks (`ok`/`degraded`) and must never contradict the HTTP code (pinned by `tests/health.test.ts`). With only `database` in the envelope today, `degraded` ⇔ DB check `error`.
- [ ] `not-configured` is **neutral** — it never contributes to the failure aggregate and never triggers 503. Applies to optional services (Redis, AI) once they join the envelope (contract per `observability.md` §6.3); not in the envelope today.
- [ ] HTTP mapping: `200` when no check failed; `503` only on a hard (configured-but-failing) dependency.
- [ ] Every check is time-boxed with `Promise.race` + `setTimeout` (DB uses `DB_CHECK_TIMEOUT_MS = 5_000`).
- [ ] Prisma access goes through the `@/lib/prisma` singleton — never `new PrismaClient()` in a route (route handlers are imported per request in dev).
- [ ] Prisma 6 does **not** throw at import when `DATABASE_URL` is missing; errors surface only on query. Therefore env-guards cannot protect the endpoint — the `try/catch` around the probe is the only reliable guard.
- [ ] `export const dynamic = "force-dynamic"` on every health route.
- [ ] Version comes from `APP_VERSION` (`src/lib/version.ts`), never a per-route deep import of `package.json`.
- [ ] Failure logging uses `console.error` with a `[health]` prefix.
- [ ] Health tests live in `tests/`, use vitest, import the `GET` handler directly, and assert the derivation rule rather than a concrete DB state.

## Anti-Patterns (What NOT to Do)

- ❌ Returning 503 (or `degraded`) when an optional service reports `not-configured` — it is neutral by contract.
- ❌ Hardcoding `status: "ok"` in the body — it must be derived from the checks.
- ❌ Guarding the DB check with `if (!process.env.DATABASE_URL) return ...` — Prisma 6 does not throw at import; the guard gives false confidence and the query still fails at runtime.
- ❌ Instantiating `new PrismaClient()` inside the route module instead of importing the `@/lib/prisma` singleton.
- ❌ Letting a probe run without a `Promise.race` timeout — a hung DB/Redis call hangs the whole endpoint.
- ❌ Deep-importing `package.json` from a route to get the version.
- ❌ Making the test depend on a specific DB state (e.g. asserting 200 unconditionally) — the CI DB may be down.

## Related Patterns / Docs

- `docs/02-architecture/observability.md` §6.3 — the written contract this pattern implements
- `docs/infrastructure.md` (ops baseline) and `docs/08-sprints/sprint-0.md` — where the endpoint is the documented operational baseline
- `docs/04-api/admin.md` — planned `GET /admin/system/health` (next consumer of this pattern)
- `src/lib/prisma.ts` — the singleton constraint referenced above
- `docs/solutions/operations/health-endpoint-contract.md` — the problem/solution that established this pattern

## Safe Change Checklist for Future AI Work

1. **Adding a service check:** extend the status union type (e.g. `RedisStatus`), write `checkRedis()` with `Promise.race` timeout + catch + `console.error("[health] ...")`, add `redis: await checkRedis()` to the `services` map.
2. **Updating the test:** extend the local `HealthBody` type in `tests/health.test.ts` and assert the new service's possible statuses and the degradation rule.
3. **Cross-layer sync:** if the status vocabulary (`ok`/`error`/`not-configured`, `ok`/`degraded`) or HTTP mapping changes, update `docs/02-architecture/observability.md` §6.3 in the same change.
4. **Verification:** `bun test` (vitest), `bun run type-check`, and a manual `bun run dev` + `curl http://localhost:3000/api/health` with the dev DB up (expect 200/`ok`) and stopped (expect 503/`degraded`).

## Refresh Notes

- **2026-08-12:** Implementation snapshot updated to match the code — the envelope currently ships `services: { database }` only; Redis/AI `not-configured` stubs were removed in the route refactor (commit `094082b`) and are now documented as planned extensions with the neutral-`not-configured` semantics preserved for when they join. Constraint/anti-pattern wording made pattern-generic (`hasFailure` no longer exists in code). Source-of-truth quote synced with `observability.md` §6.3.
- **2026-08-24:** Redis joined the envelope exactly per this pattern's Complete Example (parallel `Promise.allSettled` probes, `REDIS_URL` gate, neutral `not-configured`, time-boxed TCP PING). Logging migrated from the `console.error` stopgap to Pino (`@/lib/logger`) — the `[health]` prefix is preserved as a message convention. Tests upgraded to deterministic mocked-Prisma branch coverage. Snapshot and logger note updated accordingly.
