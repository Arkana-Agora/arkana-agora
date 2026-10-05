---
title: "Per-Instance Configure/Resolve/Reset Config Resolver — Project Pattern"
problem_type: pattern
category: backend
components:
  - backend
  - socket-service
tags:
  - patterns
  - configuration
  - redis-url
  - env-parity
  - factory-closure
  - test-isolation
  - socket-service
module: socket-service Redis configuration (lib/redis-url → bus + redis-auth)
date: 2026-10-05
established_in: "Consistency extraction of duplicated configure/resolve blocks in bus.ts and redis-auth.ts (branch sprint2-f2, 2026-10-04): createRedisUrlResolver() with per-instance state, 5 tests in tests/unit/socket-redis-url.test.ts"
---

# Pattern: Per-Instance Configure/Resolve/Reset Config Resolver

## Problem / When to Use This

Several `socket-service` modules need the **same Redis URL with the same rules**: (1) the **validated** env configured at startup (`createSocketServer` → zod `env.REDIS_URL`) wins; (2) `configure(undefined)` means *"explicitly no Redis"* (memory mode) and must **not** silently re-read `process.env`; (3) only a **never-configured** module falls back to `process.env.REDIS_URL` (the Next.js-side / bare-test case); (4) tests must configure and reset each module **independently**. `bus.ts` and `redis-auth.ts` each carried their own copy of the `configured` + `configuredUrl` flags — a classic drift generator: fixing the semantics in one module left the other stale, and a shared singleton would make one module's test configuration contaminate the other. The fix is a tiny factory whose state lives **per instance**: `createRedisUrlResolver()` returns a fresh `{ configure, reset, resolve }` closure, and each module owns one.

## Source of Truth Files

- `socket-service/src/lib/redis-url.ts` — the factory: `createRedisUrlResolver()`, `RedisUrlResolver`
- `socket-service/src/bus.ts` — consumer: `busRedisUrl`, `configureBusRedis()`, `hasRedis()`, `resetRealtimeBus()` (calls `busRedisUrl.reset()`)
- `socket-service/src/redis-auth.ts` — consumer: `authRedisUrl`, `configureRedisAuth()`, `resetRedisAuthForTests()`
- `socket-service/src/server.ts` (`createSocketServer`) — orchestration: `configureBusRedis(env.REDIS_URL)` + `configureRedisAuth(env.REDIS_URL)` immediately after the zod parse (revisão K: after this point no `process.env` reads)
- `tests/unit/socket-redis-url.test.ts` — the 5 semantic cases (env fallback, configure wins, configured-undefined, instance independence, reset)
- `tests/unit/redis-auth-config.test.ts` — consumer regression (`configureRedisAuth(undefined) ignora process.env e não conecta`)
- `tests/integration/realtime-bus.test.ts` — bus regression (24 cases)

## Current Implementation Snapshot

- The factory is 30 lines with a two-field closure:

```typescript
export function createRedisUrlResolver(): RedisUrlResolver {
  let configuredUrl: string | undefined
  let configured = false
  return {
    configure(url: string | undefined): void { configured = true; configuredUrl = url },
    reset(): void { configured = false; configuredUrl = undefined },
    resolve(): string | undefined {
      return configured ? configuredUrl : process.env.REDIS_URL
    },
  }
}
```

- **State semantics (the whole point)** — tri-state, not two-valued:

| State | `resolve()` returns |
|---|---|
| never configured | `process.env.REDIS_URL` (env fallback) |
| `configure(url)` | `url` (validated env wins over process.env) |
| `configure(undefined)` | `undefined` — **env ignored** (explicit memory mode) |
| after `reset()` | `process.env.REDIS_URL` again (re-configurable) |

- Two instances coexist in one process: `busRedisUrl` (bus.ts) and `authRedisUrl` (redis-auth.ts) — configuring one leaves the other untouched (test: `instâncias são independentes (bus e auth configuram separado)`).
- `bus.ts`: `configureBusRedis(url)` delegates to `busRedisUrl.configure(url)`; `hasRedis() = Boolean(resolveRedisUrl())` gates the whole fail-fast/auto-heal machinery (memory `EventEmitter` bus when false); `resetRealtimeBus()` calls `busRedisUrl.reset()` alongside its client teardown.
- `redis-auth.ts`: `configureRedisAuth(url)` delegates; `resetRedisAuthForTests()` resets the resolver **and** disconnects the singleton client.
- `server.ts:91-92`: `configureBusRedis(env.REDIS_URL)` / `configureRedisAuth(env.REDIS_URL)` run once, right after the zod env parse — the only legitimate configure site in production.
- Tests construct their own instance directly (`createRedisUrlResolver()` in `socket-redis-url.test.ts`) and save/delete `process.env.REDIS_URL` in `beforeEach`/`afterEach`.

## Planned / Optional Extensions (NOT implemented yet)

- Reuse the same factory on the Next.js side: `src/lib/redis.ts:createRedis` still reads `process.env.REDIS_URL` directly at module load with no configure/reset (singleton, untestable without env mutation). Adopting the resolver there would give `src/lib/redis.ts` the same validated-env-wins + reset-for-tests story as `socket-service`.
- Generalize to `createConfigResolver(readFallback: () => string | undefined)` if a second config key (e.g. `AUTH_URL`, `JWT_PUBLIC_KEY`) needs the same tri-state treatment — today only `REDIS_URL` has consumers.

## Pattern Overview

Put "explicit configuration wins, env only as never-configured fallback" behind a factory that returns fresh closure state per call; every module instantiates its own resolver, exposes a delegating `configure*` and a matching `reset*`, and the startup orchestrator configures all of them from the validated env exactly once.

## Implementation Steps

### Step 1: Create the factory with per-instance closure state

[File: `socket-service/src/lib/redis-url.ts`]

```typescript
export interface RedisUrlResolver {
  configure(url: string | undefined): void
  reset(): void
  resolve(): string | undefined
}

export function createRedisUrlResolver(): RedisUrlResolver {
  let configuredUrl: string | undefined
  let configured = false
  return {
    configure(url: string | undefined): void {
      configured = true
      configuredUrl = url
    },
    reset(): void {
      configured = false
      configuredUrl = undefined
    },
    resolve(): string | undefined {
      return configured ? configuredUrl : process.env.REDIS_URL
    },
  }
}
```

Key points:
- The separate `configured` flag is mandatory: `configuredUrl ?? process.env.REDIS_URL` would conflate "configured with `undefined`" (explicit no-Redis) with "never configured" (env fallback) — memory mode would silently become Redis mode.
- `resolve()` reads `process.env` **lazily**, at call time — never snapshot env at module load (tests mutate it).
- The file carries a header comment explaining the per-instance decision (bus and auth configure/reset independently) — keep it.

### Step 2: One instance per consumer module, delegating configure/reset

[Files: `socket-service/src/bus.ts`, `socket-service/src/redis-auth.ts`]

```typescript
// bus.ts
const busRedisUrl = createRedisUrlResolver()

export function configureBusRedis(url: string | undefined): void {
  busRedisUrl.configure(url)
}
function resolveRedisUrl(): string | undefined { return busRedisUrl.resolve() }
function hasRedis(): boolean { return Boolean(resolveRedisUrl()) }

// resetRealtimeBus() chama: busRedisUrl.reset()   (junto com o teardown dos clientes)
```

```typescript
// redis-auth.ts
const authRedisUrl = createRedisUrlResolver()

export function configureRedisAuth(url: string | undefined): void {
  authRedisUrl.configure(url)
}
function resolveRedisUrl(): string | undefined { return authRedisUrl.resolve() }

// resetRedisAuthForTests() chama: authRedisUrl.reset() + disconnect do client
```

Key points:
- Delete any local `configured`/`configuredUrl` flags — the module should own **only** the resolver instance, not the state logic.
- Every module exposing `configure*` must expose a matching `reset*` used by tests; a configure without a reset leaks configuration across test files in the same worker.
- Consumers gate behavior with `Boolean(resolve())` (`hasRedis()`, `getCachedTokenVersion` early `null`) — no direct env reads left in the module.

### Step 3: Configure once from the validated env at startup

[File: `socket-service/src/server.ts` — inside `createSocketServer`]

```typescript
// Fonte única (revisão K): bus, espelho de tokenVersion e adapter leem
// a env VALIDADA do Zod — process.env não é consultado por nenhum deles
// depois deste ponto (inclui REDIS_URL ausente → memória/sem adapter).
configureBusRedis(env.REDIS_URL)
configureRedisAuth(env.REDIS_URL)
```

Key points:
- The call site passes `env.REDIS_URL` (zod-validated, `socket-service/src/lib/env.ts` — `REDIS_URL` é opcional), **never** `process.env.REDIS_URL`.
- Configure happens before any client is created; `env.REDIS_URL === undefined` therefore correctly pins memory mode even when the ambient env var exists.
- Adding a new Redis consumer? Add its `configureX(env.REDIS_URL)` line right here, next to the existing two.

### Step 4: Pin the semantics with the 5 required tests

[File: `tests/unit/socket-redis-url.test.ts`]

```typescript
it("sem configure cai em process.env.REDIS_URL", ...)
it("configure(url) tem prioridade sobre process.env", ...)
it("configure(undefined) conta como configurado e ignora process.env", ...)
it("instâncias são independentes (bus e auth configuram separado)", ...)
it("reset volta ao fallback de process.env e permite reconfigurar", ...)
```

Key points:
- `beforeEach`/`afterEach` must `delete process.env.REDIS_URL` (and re-set it inside individual cases) — env mutation without cleanup is the classic cross-test flake here.
- The "instances are independent" case creates **two** resolvers, configures one, and asserts the other still falls back to env — this is what makes a shared-singleton refactor fail loudly.
- Consumer regressions stay in their own files: `tests/unit/redis-auth-config.test.ts` (`configureRedisAuth(undefined) ignora process.env e não conecta`) and `tests/integration/realtime-bus.test.ts` (bus behavior incl. `resetRealtimeBus`).

## Complete Example

Adding a new socket-service module that needs Redis (`socket-service/src/queue.ts`):

```typescript
import { createRedisUrlResolver } from "./lib/redis-url"

const queueRedisUrl = createRedisUrlResolver()

/** Configura com a env VALIDADA (chamar de createSocketServer). */
export function configureQueueRedis(url: string | undefined): void {
  queueRedisUrl.configure(url)
}

export async function publishJob(job: unknown): Promise<void> {
  const url = queueRedisUrl.resolve()
  if (!url) return // memória / sem Redis — mesmo gate de hasRedis()
  // ... createBusRedisClient(url) + publish
}

/** Testes: derruba a configuração (e o client, se houver). */
export function resetQueueForTests(): void {
  queueRedisUrl.reset()
}
```

```typescript
// socket-service/src/server.ts — configure com a env validada, junto dos vizinhos
configureBusRedis(env.REDIS_URL)
configureRedisAuth(env.REDIS_URL)
configureQueueRedis(env.REDIS_URL)
```

```typescript
// tests/unit/socket-queue.test.ts
afterEach(() => { delete process.env.REDIS_URL; resetQueueForTests() })
```

## Project-Specific Constraints

- [ ] Tri-state semantics are fixed: `configured ? configuredUrl : process.env.REDIS_URL` — never `??`.
- [ ] **One resolver instance per module** (bus owns `busRedisUrl`, auth owns `authRedisUrl`); no cross-module shared instance.
- [ ] The only production configure site is `createSocketServer` (`socket-service/src/server.ts:91-92`) passing zod-validated `env.REDIS_URL`; after that point no `process.env` reads (revisão K).
- [ ] Every `configureX` has a matching `resetX` invoked from the module's test-teardown (`resetRealtimeBus`, `resetRedisAuthForTests`).
- [ ] Helper stays in `socket-service/src/lib/` with zero `@/` imports — the Docker image copies only `socket-service/` (fronteira I-c; enforced by `tests/unit/socket-service-boundary.test.ts`).
- [ ] Tests that rely on env fallback save/delete `process.env.REDIS_URL` in `beforeEach`/`afterEach`.
- [ ] Memory mode gate is `Boolean(resolve())` (`hasRedis()` / early `null` in `getCachedTokenVersion`) — Redis machinery never runs without a resolved URL.
- [ ] `resolve()` is called lazily at use time, never cached at module load.

## Anti-Patterns (What NOT to Do)

- ❌ `configuredUrl ?? process.env.REDIS_URL` — `configure(undefined)` (explicit memory mode) would fall back to env and silently re-enable Redis.
- ❌ One shared resolver instance imported by both bus and auth — one module's test configure contaminates the other and independent reset becomes impossible (the exact duplication bug this factory replaced).
- ❌ Reading `process.env.REDIS_URL` directly inside `bus.ts`/`redis-auth.ts` — bypasses the validated env and breaks the "configured undefined" case (test `configureRedisAuth(undefined) ignora process.env e não conecta` fails).
- ❌ Calling `configureX(process.env.REDIS_URL)` at a call site — configure only ever receives the zod-validated `env.REDIS_URL`.
- ❌ Exposing `configureX` without `resetX` — configuration leaks across test files sharing a worker.
- ❌ Snapshotting the env value at module load (`const url = process.env.REDIS_URL`) — configure() would arrive too late and tests could not mutate env.
- ❌ Hand-copying the two flags into a new module instead of calling `createRedisUrlResolver()` — reintroduces the drift this pattern removed.

## Related Patterns / Docs

- `docs/solutions/patterns/backend/fail-fast-redis-client-auto-heal.md` — the bus machinery this resolver gates (`hasRedis()` → memory fallback)
- `socket-service/src/lib/env.ts` + `tests/unit/socket-env.test.ts` — zod env (REDIS_URL opcional) feeding Step 3
- `docs/02-architecture/architecture.md` §6.4 and `docs/02-architecture/deployment.md` §4.2 — Redis/memory contract the resolver implements
- `tests/unit/socket-service-boundary.test.ts` — fronteira I-c (no `@/` value imports inside `socket-service/`)
- `src/lib/redis.ts` — Next-side sibling that still reads env directly (adoption pending, see Planned Extensions)

## Safe Change Checklist for Future AI Work

1. **New Redis consumer in socket-service**: instantiate `createRedisUrlResolver()` in the module, export `configureX`/`resetX`, and wire `configureX(env.REDIS_URL)` into `createSocketServer` next to the existing two calls (`socket-service/src/server.ts`).
2. **Contract change** (e.g. fallback rules): edit `socket-service/src/lib/redis-url.ts` first, then the 5 cases in `tests/unit/socket-redis-url.test.ts` — they pin the semantics.
3. **Consumer regressions**: `tests/unit/redis-auth-config.test.ts` (auth) and `tests/integration/realtime-bus.test.ts` (bus, incl. `resetRealtimeBus`) must stay green — they catch a consumer dropping its `reset*` delegation.
4. **Docs sync**: behavior changes to the env/memory contract propagate to `docs/02-architecture/architecture.md` §6.4 and `docs/02-architecture/deployment.md` §4.2.
5. **Verification**: `bun run test tests/unit/socket-redis-url.test.ts tests/unit/redis-auth-config.test.ts tests/integration/realtime-bus.test.ts` (via the `test` script — it carries `--max-old-space-size=4096`, never bare `npx vitest run`), then `bun run type-check` and `bun run lint`; full suite before merge: `bun run test`.
