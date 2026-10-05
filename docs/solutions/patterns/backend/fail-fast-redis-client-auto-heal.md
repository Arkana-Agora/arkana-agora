---
title: "Fail-Fast Redis Client with Auto-Heal — Project Pattern"
problem_type: pattern
category: backend
components:
  - backend
  - socket-service
tags:
  - patterns
  - ioredis
  - fail-fast
  - auto-heal
  - event-bus
  - reconnect-backoff
  - redis-pubsub
  - realtime
module: realtime / event bus (socket-service/src/bus.ts)
date: 2026-10-03
established_in: "Event Bus resilience fix for E2E T075 root cause (branch sprint2-f2, 2026-10-03): fail-fast ioredis client (review K / Crítico 4) was permanently killed by a real ECONNRESET — added dead-client detection + background sub reconnect, 4 new tests in tests/integration/realtime-bus.test.ts"
---

# Pattern: Fail-Fast Redis Client with Auto-Heal

## Problem / When to Use This

Use this pattern whenever you create an ioredis client in this repo with the **fail-fast option set** (`retryStrategy: () => null`, `enableOfflineQueue: false`, `maxRetriesPerRequest: 1`) — the set that keeps a `publish`/command from ever hanging a request path. The trap: a client born with `retryStrategy: () => null` **never reconnects on its own**. Real Redis connections do drop (`ECONNRESET` observed with local Memurai ~30 s after boot); after the drop the client sits at `status === "end" || "close"` forever and every subsequent call fails with `Connection is closed` — so a fail-fast publish turns into a **permanently mute** bus (every realtime event lost from that point on, with no operator action to fix it). The pattern therefore has two halves that must ship together: (1) fail-fast **per call** on the request path, (2) self-healing **outside** the request path (detect dead client → discard → new single attempt; background reconnect for subscribers that never publish).

Two consumers already exist: `socket-service/src/bus.ts` (full implementation, both halves) and `src/lib/redis.ts:createRedis` (fail-fast half only — see Planned Extensions).

## Source of Truth Files

- `socket-service/src/bus.ts` — the implementation: `createBusRedisClient`, `connectRedis`, `ensureRedis`, `isBusClientDead`, `discardDeadClients`, `registerSubCloseHandler`, `scheduleBusReconnect`, `resetRealtimeBus`
- `tests/integration/realtime-bus.test.ts` — `describe("auto-recuperação de conexão morta (ECONNRESET)")` (4 cases) + `describe("fail-fast do Redis (Crítico 4)")` (2 cases) — read both before changing anything here
- `src/lib/redis.ts` — the sibling fail-fast client (same option set, error listener, no auto-heal yet)
- `docs/02-architecture/architecture.md` §6.4 ("Conexão Redis — fail-fast por chamada + auto-heal") — the written behavioral contract
- `docs/02-architecture/deployment.md` §4.2 ("Resiliência do Event Bus") — operational description of the same behavior

## Current Implementation Snapshot

- `createBusRedisClient(url)` (`socket-service/src/bus.ts`) returns `new Redis(url, { lazyConnect: true, enableOfflineQueue: false, maxRetriesPerRequest: 1, retryStrategy: () => null, commandTimeout: 2000, connectTimeout: 3000 })` — one attempt per call, no offline queue, no embedded connection retry.
- `connectRedis()` increments `busConnectAttempts`, builds the pub client, `await pub.connect()`, `sub = pub.duplicate()`, attaches `error`/`message` handlers, calls `registerSubCloseHandler(sub)`, `await sub.connect()`, `await sub.subscribe(REALTIME_CHANNEL, AUTH_KICK_CHANNEL)`, then assigns `pubClient`/`subClient`. On any throw it disconnects the partial `sub`/`pub` and rethrows (nothing half-open is left behind).
- `ensureRedis()` is the single entry point used by `publishRealtime`, `publishAuthKick`, `subscribeRealtime`, `subscribeAuthKick` and the background reconnect: if `hasRedis()` is false → `null` (in-process `memoryBus` takes over); if a cached `redisReady` exists, it awaits it (settled failures become `null`) and calls `discardDeadClients()` when `isBusClientDead(settled)` **or** `isBusClientDead(subClient)`; then starts a fresh `connectRedis()` if `redisReady === null`.
- `isBusClientDead(client)` → `client.status === "end" || client.status === "close"` (the states ioredis reaches after `ECONNRESET`/disconnect when it will never retry again).
- `discardDeadClients()` is **synchronous**: reads `pubClient`/`subClient`, nulls `pubClient`/`subClient`/`redisReady`, then fire-and-forget `quit()` on both wrapped in try/catch.
- A rejected attempt is never cached: `void attempt.catch(() => { if (redisReady === attempt) redisReady = null })` — the next call re-attempts instead of inheriting the old failure.
- `registerSubCloseHandler(sub)` subscribes `close` **and** `end` → `scheduleBusReconnect(sub)`.
- `scheduleBusReconnect(sub)` guards `busShuttingDown`, `reconnectTimer !== null` and `sub !== subClient`, then `setTimeout` with `delay = reconnectFailures === 0 ? 1000 : Math.min(1000 * 2 ** reconnectFailures, 30_000)`; inside the timer it re-checks the guards, runs `void ensureRedis()`, resets `reconnectFailures = 0` on success or increments and re-schedules while `reconnectFailures <= 5`.
- `resetRealtimeBus()` sets `busShuttingDown = true`, clears `reconnectTimer`, awaits the pending attempt, quits both clients, then resets `busShuttingDown = false` and `reconnectFailures = 0`.
- `publishRealtime`/`publishAuthKick` wrap everything in `try/catch` → `logger.warn` (fire-and-forget: a bus failure never breaks the business action that triggered the emit).
- Test exports: `injectBusClientsForTests(pub, sub)` (assigns clients + `redisReady = Promise.resolve(pub)` + `registerSubCloseHandler(sub)`), `busConnectAttemptsForTests()`, `isRedisAttemptPendingForTests()`, `configureBusRedis(url)`.
- Tests mirror real ioredis: fake clients are `EventEmitter`s whose `status` actually changes to `"close"` before `emit("close")`.
- Without `REDIS_URL` (`configureBusRedis(undefined)` or no env), none of this participates — `ensureRedis()` returns `null` immediately and delivery goes through the in-process `memoryBus`.

## Planned / Optional Extensions (NOT implemented yet)

- **Apply the same auto-heal to the Next.js singleton** `src/lib/redis.ts:createRedis` — it already carries the identical fail-fast option set (plus a `logger.warn` `error` listener pinned by `tests/unit/redis-client.test.ts`) but has **no** dead-client detection: after an `ECONNRESET` the module-level singleton would be dead for the process lifetime, breaking `src/services/token-service.ts` (auth tokenVersion mirror), `src/lib/feed-cache.ts` and `src/lib/social/limits.ts`. If that is implemented, reuse `isBusClientDead`-style detection before each command batch (or recreate the singleton on dead status) rather than enabling ioredis auto-reconnect.

## Pattern Overview

Keep fail-fast semantics **per call** (single attempt, no offline queue, explicit timeouts) and add healing **outside** the call: a synchronous dead-client check + discard at the top of the accessor, a never-cached rejected promise, and — for subscribers that never publish — a guarded background reconnect with exponential backoff and a failure cap.

## Implementation Steps

### Step 1: Create the client with the fail-fast option set

[File: `socket-service/src/bus.ts` — `createBusRedisClient`]

```typescript
export function createBusRedisClient(url: string): Redis {
  return new Redis(url, {
    lazyConnect: true,
    enableOfflineQueue: false,
    maxRetriesPerRequest: 1,
    retryStrategy: () => null,
    commandTimeout: 2000,
    connectTimeout: 3000,
  })
}
```

Key points:
- This set is pinned by `describe("fail-fast do Redis (Crítico 4)")` → `it("cliente do bus nasce com opções fail-fast")`. Do not drop `commandTimeout`/`connectTimeout` — they bound the worst case on the request path.
- Always attach an `error` listener (`client.on("error", ...)`) — ioredis warns loudly otherwise, and the failure must land in `logger.warn`.
- In `socket-service` use the local `pino` logger (`const logger = pino({ name: "socket-service" })`), **never** `@/lib/logger`: the Docker image copies only `socket-service/` (fronteira I-c) and the root logger pulls Prisma.

### Step 2: Detect death and discard synchronously in the accessor

[File: `socket-service/src/bus.ts` — `isBusClientDead`, `discardDeadClients`, `ensureRedis`]

```typescript
function isBusClientDead(client: Redis | null): boolean {
  if (client === null) return false
  return client.status === "end" || client.status === "close"
}

function discardDeadClients(): void {
  const pub = pubClient
  const sub = subClient
  pubClient = null
  subClient = null
  redisReady = null
  try { void sub?.quit().catch(() => {}) } catch { /* já fechado */ }
  try { void pub?.quit().catch(() => {}) } catch { /* já fechado */ }
}

async function ensureRedis(): Promise<Redis | null> {
  if (!hasRedis()) return null
  if (redisReady !== null) {
    const settled: Redis | null = await redisReady.catch(() => null)
    if (isBusClientDead(settled) || isBusClientDead(subClient)) {
      discardDeadClients()
    }
  }
  if (redisReady === null) {
    const attempt = connectRedis()
    redisReady = attempt
    // Promise rejeitada nunca fica cacheada
    void attempt.catch(() => {
      if (redisReady === attempt) redisReady = null
    })
  }
  return redisReady
}
```

Key points:
- `discardDeadClients()` is **synchronous on purpose** — two concurrent publishes detecting the same death must not both spawn a connection (nulling `pubClient`/`subClient`/`redisReady` in one atomic synchronous step prevents the leak).
- Check **both** pub and sub: a live pub with a dead sub is still a broken bus.
- The rejected-promise cleanup must compare `redisReady === attempt` so it never clobbers a newer attempt.

### Step 3: Single attempt per call — no synchronous retry

[File: `socket-service/src/bus.ts` — `publishRealtime` / `publishAuthKick`]

```typescript
export async function publishRealtime(message: RealtimeMessage): Promise<void> {
  try {
    const pub = await ensureRedis()
    if (pub !== null) {
      await pub.publish(REALTIME_CHANNEL, JSON.stringify(message))
    } else {
      memoryBus.emit(MEMORY_EVENT, message)
    }
  } catch (err) {
    logger.warn({ err, event: message.event }, "[realtime-bus] publish falhou")
  }
}
```

Key points:
- One `ensureRedis()` call = at most one `connectRedis()` attempt. **Never** wrap it in a retry loop — that is exactly the hang the fail-fast decision (revisão K / Crítico 4) forbids.
- Failure is logged and swallowed (fire-and-forget), so the business action that triggered the emit still succeeds.

### Step 4: Reconnect subscribers in the background (they never publish)

[File: `socket-service/src/bus.ts` — `registerSubCloseHandler`, `scheduleBusReconnect`]

```typescript
function registerSubCloseHandler(sub: Redis): void {
  const onClose = (): void => scheduleBusReconnect(sub)
  sub.on("close", onClose)
  sub.on("end", onClose)
}

function scheduleBusReconnect(sub: Redis): void {
  if (busShuttingDown || reconnectTimer !== null) return
  if (sub !== subClient) return
  const delay =
    reconnectFailures === 0 ? 1000 : Math.min(1000 * 2 ** reconnectFailures, 30_000)
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null
    if (busShuttingDown || sub !== subClient) return
    void ensureRedis().then(
      () => { reconnectFailures = 0 },
      () => {
        reconnectFailures++
        if (reconnectFailures <= 5 && !busShuttingDown) scheduleBusReconnect(sub)
      },
    )
  }, delay)
}
```

Key points:
- Attach the handler inside `connectRedis()` (after `sub = pub.duplicate()`, before/around `sub.connect()`) so every generated sub is covered — including the one `injectBusClientsForTests` registers.
- Backoff 1 s → 30 s (`1000 * 2 ** reconnectFailures`, capped), **max 5 consecutive failures**, single pending timer (`reconnectTimer !== null` guard).
- `sub !== subClient` in both the event handler and inside the timer ignores a client that was already replaced (stale timer must not reconnect an orphan).
- Required because the socket-service side **only subscribes**: without this, one `ECONNRESET` leaves it mute forever — no publish ever comes to trigger Step 2's detection.

### Step 5: Shutdown/test reset must cancel the reconnect machinery

[File: `socket-service/src/bus.ts` — `resetRealtimeBus`]

```typescript
export async function resetRealtimeBus(): Promise<void> {
  busShuttingDown = true
  if (reconnectTimer !== null) { clearTimeout(reconnectTimer); reconnectTimer = null }
  // ... await pending attempt, quit pub/sub, then:
  busShuttingDown = false
  reconnectFailures = 0
}
```

Key points:
- `busShuttingDown` is checked at schedule time **and** inside the timer — a timer queued before shutdown still no-ops.
- Awaiting the pending attempt before quitting clients avoids leaking sockets created by an attempt that completes during reset.

### Step 6: Export test hooks and pin the behavior with tests

[Files: `socket-service/src/bus.ts` exports; `tests/integration/realtime-bus.test.ts`]

```typescript
export function injectBusClientsForTests(pub: Redis, sub: Redis): void {
  pubClient = pub
  subClient = sub
  redisReady = Promise.resolve(pub)
  registerSubCloseHandler(sub)
}
export function busConnectAttemptsForTests(): number { return busConnectAttempts }
```

Required cases (already implemented — extend, don't delete):
1. dead pub → `busConnectAttemptsForTests()` grows after a publish (discard + new attempt);
2. dead sub + alive pub → also reconnects (both sides checked);
3. `close` on sub with **no publish in the process** → fake timers advance 1500 ms → attempt count grows (background reconector works);
4. failed attempt does not wedge the next publish (second publish attempts again).

Key points:
- Fake clients **must** be `EventEmitter`s and must flip `status` (`sub.status = "close"; sub.emit("close")`) like real ioredis — a plain object proves nothing about the `close`/`end` wiring.
- Keep `injectBusClientsForTests` calling `registerSubCloseHandler`, otherwise case 3 silently stops covering the reconector.

## Complete Example

End-to-end shape of a new fail-fast-with-auto-heal client (mirrors `socket-service/src/bus.ts`; the Redis-URL gate and memory fallback come from `configureBusRedis`/`hasRedis`):

```typescript
let client: Redis | null = null
let ready: Promise<Redis> | null = null
let failures = 0
let timer: ReturnType<typeof setTimeout> | null = null
let shuttingDown = false

function isDead(c: Redis | null): boolean {
  return c !== null && (c.status === "end" || c.status === "close")
}

async function ensure(): Promise<Redis | null> {
  if (ready !== null) {
    const settled = await ready.catch(() => null)
    if (isDead(settled)) { client = null; ready = null } // discard síncrono
  }
  if (ready === null) {
    const attempt = createBusRedisClient(url).connect().then((c) => { client = c; return c })
    ready = attempt
    void attempt.catch(() => { if (ready === attempt) ready = null }) // nunca cacheia falha
  }
  return ready
}

function scheduleReconnect(): void {           // fora do request path
  if (shuttingDown || timer !== null) return
  timer = setTimeout(() => {
    timer = null
    if (shuttingDown) return
    void ensure().then(() => { failures = 0 }, () => {
      if (++failures <= 5) scheduleReconnect()  // 1s → 30s (2^n)
    })
  }, failures === 0 ? 1000 : Math.min(1000 * 2 ** failures, 30_000))
}

// no subscriber: c.on("close", scheduleReconnect); c.on("end", scheduleReconnect)
```

Caller contract: `publish`/command path = `try { const c = await ensure(); ... } catch { logger.warn(...) }` — exactly one attempt, failure swallowed.

## Project-Specific Constraints

- [ ] Fail-fast option set is fixed: `lazyConnect: true`, `enableOfflineQueue: false`, `maxRetriesPerRequest: 1`, `retryStrategy: () => null`, `commandTimeout: 2000`, `connectTimeout: 3000` (`createBusRedisClient`; asserted by `it("cliente do bus nasce com opções fail-fast")`).
- [ ] **No synchronous retry on the request path** — one `connectRedis()` per `ensureRedis()` call; healing happens via discard-on-next-use or the background timer only.
- [ ] A rejected `redisReady` is cleared in `.catch` (guarded by `redisReady === attempt`) — never cached.
- [ ] `discardDeadClients()` stays synchronous; it must null `pubClient`, `subClient` **and** `redisReady` together.
- [ ] Reconnect timer is deduped (`reconnectTimer !== null`), gated by `busShuttingDown`, identity-checked (`sub !== subClient`), capped at 5 failures, delay `min(1000 * 2 ** failures, 30_000)`.
- [ ] `resetRealtimeBus()` clears the timer, awaits the pending attempt, quits clients, resets `reconnectFailures` — tests depend on this being leak-free (`afterEach` in every describe).
- [ ] Socket-service logging uses the local `pino` instance — `@/lib/logger` is forbidden inside `socket-service/` (Docker image boundary, fronteira I-c).
- [ ] Memory mode (`hasRedis() === false`) short-circuits everything — none of the Redis machinery may run without a URL.
- [ ] Fire-and-forget: `publishRealtime`/`publishAuthKick` must never throw; failures go to `logger.warn`.
- [ ] Test fakes are `EventEmitter`s whose `status` mutates like real ioredis; connect-attempt assertions go through `busConnectAttemptsForTests()`.

## Anti-Patterns (What NOT to Do)

- ❌ Adding a `for`/`while` retry loop around `connectRedis()` inside `ensureRedis()` or `publishRealtime` — reintroduces exactly the request-path hang that `retryStrategy: () => null` exists to prevent (revisão K / Crítico 4).
- ❌ Assuming ioredis will reconnect by itself — with `retryStrategy: () => null` it will not; the client is dead after the first connection loss.
- ❌ Making `discardDeadClients()` async or awaiting `quit()` inside it — opens a window where two concurrent publishes each spawn a connection.
- ❌ Caching the rejected `redisReady` (or leaving the failed attempt in place) — the bus then inherits one failure forever.
- ❌ Scheduling the reconnect without the `busShuttingDown` / `reconnectTimer` / `sub !== subClient` guards — timer leaks in tests and orphaned reconnects of replaced clients.
- ❌ Giving the subscriber no `close`/`end` handler — the socket-service never publishes, so nothing else would ever trigger a reconnect.
- ❌ Importing `@/lib/logger` from `socket-service/src/bus.ts` — breaks the standalone Docker image build.
- ❌ Asserting reconnect with dumb object fakes (no `EventEmitter`, no `status` transition) — the test passes while the real wiring is broken.

## Related Patterns / Docs

- `docs/02-architecture/architecture.md` §6.4 — written contract: "Conexão Redis — fail-fast por chamada + auto-heal"
- `docs/02-architecture/deployment.md` §4.2 "Resiliência do Event Bus" — operational view (ECONNRESET root cause, E2E T075)
- `docs/solutions/patterns/testing/e2e-realtime-harness.md` — the harness where the ECONNRESET was observed
- `docs/infrastructure.md` (Event Bus row) and `docs/glossary.md` (Event Bus entry) — one-line summaries that must stay in sync
- `src/lib/redis.ts` + `tests/unit/redis-client.test.ts` — the sibling fail-fast client (auto-heal pending)

## Safe Change Checklist for Future AI Work

1. **Client options**: edit `createBusRedisClient()` in `socket-service/src/bus.ts`, then run `it("cliente do bus nasce com opções fail-fast")` — it pins the whole set; update the test only if the decision itself changed (requires review sign-off, it is a K/Crítico-4 decision).
2. **New connection path**: any new code that builds a bus client must go through `connectRedis()` (so `registerSubCloseHandler` is attached) — never `new Redis(...)` ad hoc inside `bus.ts`.
3. **Test exports**: if you rename/restructure the module state, update `injectBusClientsForTests`, `busConnectAttemptsForTests`, `isRedisAttemptPendingForTests` together — `tests/integration/realtime-bus.test.ts` imports all three.
4. **Cross-layer docs**: behavior changes must be reflected in `docs/02-architecture/architecture.md` §6.4, `docs/02-architecture/deployment.md` §4.2, `docs/infrastructure.md` (Event Bus row) and `docs/glossary.md` in the same change.
5. **Verification**: `bun run test tests/integration/realtime-bus.test.ts` (targeted; the `test` **script** carries `--max-old-space-size=4096` — never bare `npx vitest run`, see `docs/solutions/ci-cd/turbopack-postcss-oom.md`), then `bun run type-check` and `bun run lint`; full-suite before merge: `bun run test`.
