---
title: "E2E Realtime Harness — Project Pattern"
problem_type: pattern
category: testing
components:
  - testing
  - frontend
  - socket-service
tags:
  - patterns
  - e2e
  - playwright
  - realtime
  - websocket
  - route-websocket
  - polling-fallback
  - env-split-brain
  - consent-banner
  - selectors
  - rate-limit
  - prisma
module: realtime / social feed (T075)
date: 2026-10-02
established_in: "Playwright harness for T075 realtime social (2-browser WS test, fallback polling + reconnect) built during Phase 2.5 WebSocket Foundation — green run `npx playwright test tests/e2e/social-realtime.spec.ts` 3 passed / 3 fixme, 2026-10-02"
---

# Pattern: E2E Realtime Harness (Playwright × Next dev × socket-service)

## Problem / When to Use This

Use this pattern whenever you add or repair a Playwright E2E spec in `tests/e2e/` that must exercise **real browser-to-backend realtime behavior** (WebSocket delivery, polling fallback, reconnect) against the local dev stack — i.e. anything that needs *two* live servers (`next dev` on :3000 + `socket-service` on :3003), a shared database, and a shared Redis event bus. It answers the questions that repeatedly broke the Phase 2.5 suite before it went green: *which database does the test process talk to?*, *why does login loop between `/login` and `/dashboard`?*, *why did registration suddenly 429?*, *why do clicks land nowhere?*, *how do I prove the socket actually reconnected?*, and *why does an absolute pill assertion fail on the second run?*. Every gotcha below cost at least one full red→green cycle; they are non-obvious because they live at the seam between four processes (Playwright runner, `next dev`, `socket-service`, Redis) that each load their own env.

> **Scope note:** this covers *browser-driven* realtime E2E. Pure reconnect/room re-join logic (drop → re-join rooms) is covered by `tests/integration/websocket.test.ts` (T074); protocol-level contracts belong in unit/integration tests, not here.

## Source of Truth Files

- `tests/e2e/helpers.ts` — env override, Prisma client, `registerUser`/`cleanupUser`, `csrfHeaders`, `login`/`attachSession`, `ensureProfile`
- `tests/e2e/social-realtime.spec.ts` — the reference spec (T075): 2 browsers, `uiLogin`, `routeWebSocket` block/allow, relative pill assertions
- `playwright.config.ts` — `webServer ×2`, `REDIS_URL`, `AUTH_URL`, hardcoded JWT fallback keys, `workers: 1` / `fullyParallel: false`
- `src/hooks/use-socket.ts` — cursors `postsCursor`/`notificationsCursor` seeded by `INITIAL_CURSOR()` at `Date.now() - POLLING_DEFAULT_SINCE_MS` (5 min), 30s fallback polling suppressed while connected, backoff 1s→30s (manual retry on namespace `CONNECT_ERROR`)
- `src/lib/social/polling-window.ts` — `POLLING_DEFAULT_SINCE_MS = 5 * 60_000` (re-exported by `polling-utils.ts`, which also clamps `since` to `POLLING_MAX_SINCE_MS` = 24h in `resolveSince`)
- `src/lib/rate-limit.ts` — in-memory register limiter (`REGISTER_IP_WINDOW_MS = 60 * 60 * 1000`, `MAX_REGISTER_IP_ATTEMPTS = 3`)
- `docs/plans/20260926120000-sprint2-execution-plan.md` — Execution Log 2026-10-02 "Phase 2.5 executada" (infra E2E + fixes (c)/(d))

## Current Implementation Snapshot

- `playwright.config.ts` declares **two** `webServer` entries: `npm run dev` (url `BASE_URL`, 120s timeout) and `npm run dev:ws` (url `http://localhost:3003/health`, 60s timeout), both `reuseExistingServer: true` and both passing `REDIS_URL` + `JWT_PUBLIC_KEY` (the WS one also `AUTH_URL` and `SOCKET_PORT=3003`); `JWT_PRIVATE_KEY`/`JWT_PUBLIC_KEY` have hardcoded dev fallbacks in the config so a fresh clone runs without an env file.
- `tests/e2e/helpers.ts` force-reads `.env.local` with `dotenv`'s `parse` and overwrites `process.env.DATABASE_URL` **at module load, before the Prisma client is constructed**; the client is a `PrismaClient({ adapter: new PrismaPg({ connectionString }) })` singleton cached on `globalThis.__e2ePrisma`.
- `registerUser()` is idempotent: skips `POST /api/v1/auth/register` when the user exists, then guarantees `emailVerified` (verify-email token from DB → direct `prisma.user.update` fallback) so an orphaned/rate-limited run cannot leave a half-created user.
- `uiLogin()` lives in the spec: `addInitScript(localStorage.setItem("analytics-consent","false"))` → `goto("/login")` → `getByLabel(/e-?mail/i)` → `getByTestId("password")` → `getByRole("button", { name: "Entrar", exact: true })` → `waitForURL(/\/dashboard/)`.
- The fallback test wraps the page in `page.routeWebSocket(/localhost:3003/, ws => wsAllowed ? ws.connectToServer() : ws.close())`, registers `page.on("websocket")` **before** navigation, and resolves a `reconnected` promise from the first `framereceived` after `wsAllowed = true`.
- Spec runs `test.describe.configure({ mode: "serial" })`, seeds the follow edge directly via `prisma.follow.create` (no HTTP emit → no notification consumed, no rate-limit quota), and deletes posts/follows/followRewards/notifications + users in `afterAll`.

## Pattern Overview

Treat the harness as a **four-process contract**: pin the test process to the *same* database and env as `next dev`, give both dev servers the *same* Redis so the event bus crosses processes, neutralize UI overlays and quota consumers up front, and make every realtime assertion either *relative to an observed value* or *anchored to a positively-observed socket handshake* — never to an absolute count or to a blocked-socket event.

## Implementation Steps / Gotchas

### Step 1: Pin the test process to the server's database (split-brain prevention)

[File: `tests/e2e/helpers.ts` — must run at module top-level, before any `new PrismaClient()`]

```typescript
import "dotenv/config"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { parse as parseDotenv } from "dotenv"
import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "@prisma/client"

// `next dev` loads .env.local (local DB); the Playwright process inherits
// DATABASE_URL from .env (remote Prisma Postgres) → split-brain.
const localDbUrl = parseDotenv(
  readFileSync(resolve(process.cwd(), ".env.local"), "utf8"),
).DATABASE_URL
if (localDbUrl) process.env.DATABASE_URL = localDbUrl

const globalPrisma =
  globalThis.__e2ePrisma ??
  new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) })
if (process.env.NODE_ENV !== "production") globalThis.__e2ePrisma = globalPrisma
export const prisma = globalPrisma
```

Key points:
- Next.js env precedence (`process.env` > `.env.local` > `.env`) means the **server** silently prefers `.env.local`; the **test process** has no such precedence — `dotenv/config` alone reads `.env` first. Without the override, fixtures are written to the remote DB while assertions read the local one (every "user not found" / phantom-data failure).
- The override must happen **before** the `PrismaClient` is constructed (module body order matters) — re-assigning `DATABASE_URL` later has no effect on the existing adapter.
- Prisma 7 requires the driver adapter (`PrismaPg`); a raw `new PrismaClient()` breaks any spec that imports the helpers.

### Step 2: Make `.env.local` complete for local auth

[File: `.env.local` (not committed — must contain at least)]

```
AUTH_URL=http://localhost:3000
DATABASE_URL=<local connection string>
```

Key points:
- **`AUTH_URL` is mandatory for the dev stack**: without it NextAuth in dev expects a `__Secure-` prefixed cookie (`AUTH_URL=http://localhost:3000` → non-secure `localhost` cookie name), and the mismatch makes the browser loop `/login` ↔ `/dashboard` forever while `waitForURL(/\/dashboard/)` times out.
- Keep `AUTH_URL` aligned with `BASE_URL` — the same value is passed to the `dev:ws` webServer (socket CORS is restricted to `AUTH_URL`).

### Step 3: Declare both webServers with a shared Redis

[File: `playwright.config.ts`]

```typescript
const REDIS_URL = process.env.REDIS_URL ?? "redis://localhost:6379"

webServer: [
  { command: "npm run dev", url: BASE_URL, reuseExistingServer: true,
    timeout: 120_000, env: { JWT_PRIVATE_KEY, JWT_PUBLIC_KEY, REDIS_URL } },
  { command: "npm run dev:ws", url: "http://localhost:3003/health",
    reuseExistingServer: true, timeout: 60_000,
    env: { AUTH_URL: BASE_URL, JWT_PUBLIC_KEY, SOCKET_PORT: "3003", REDIS_URL } },
]
```

Key points:
- **`REDIS_URL` must be set on BOTH entries.** Next.js and `socket-service` are separate processes (ADR-007): an in-memory Event Bus never crosses them, so `emitNewPost` in the API would never reach the browser socket. Redis is the only bridge.
- The WS server's readiness probe is its **`/health` route on :3003**, not the bare port — Playwright must not consider the harness ready before Socket.io can accept a connection.
- `reuseExistingServer: true` + `workers: 1` + `fullyParallel: false` + `test.describe.configure({ mode: "serial" })` keep a single socket-service instance and a single ordering of state-mutating tests.
- Hardcoded `JWT_PRIVATE_KEY`/`JWT_PUBLIC_KEY` fallbacks exist because socket auth is RS256 (ADR-009) and both processes must verify with the **same** key pair; a mismatch fails silently as "socket never connects".

### Step 4: Keep dev servers warm — register rate limit is per-process and in-memory

[Files: `src/lib/rate-limit.ts`, `tests/e2e/helpers.ts`]

- The register IP limiter is an **in-memory Map**: `MAX_REGISTER_IP_ATTEMPTS = 3` per `REGISTER_IP_WINDOW_MS = 60 * 60 * 1000` (3/60min), keyed by `register:ip:${ip}` (127.0.0.1 for every local test).
- Consequences: (a) **an orphaned `next dev` between runs keeps its counter** — port 3000 (and 3003) must be free before starting a run, so stale servers neither hold the quota nor serve a different DB; (b) re-running the suite against a warm server is fine because `registerUser` **reuses the existing user** instead of calling the endpoint again.

```typescript
export async function registerUser(request, email, name) {
  const existing = await prisma.user.findFirst({ where: { email } })
  if (!existing) {
    await request.post(`${BASE_URL}/api/v1/auth/register`, { ...csrfHeaders(), data: { /* ... */ } })
  }
  // Guarantee emailVerified — register may have been 429'd or left orphaned.
  const user = await prisma.user.findFirst({ where: { email } })
  if (user && !user.emailVerified) {
    // 1) try the real verify-email token from DB
    // 2) fallback: prisma.user.update({ data: { emailVerified: new Date() } })
  }
}
```

Key points:
- Always verify the user **through the DB afterward** and repair, never trust the HTTP status of `/register` (it may be 429 and still leave a usable row).
- Clean up deterministically in `afterAll` (`cleanupUser` deletes `verificationToken` + `user`; also delete the domain rows you created: posts, follows, followRewards, notifications).

### Step 5: Neutralize the consent banner before the first `goto`

[File: `tests/e2e/social-realtime.spec.ts` — inside `uiLogin()`]

```typescript
async function uiLogin(page: Page, email: string): Promise<void> {
  // AnalyticsConsentBanner renders a backdrop at z-50 that swallows clicks.
  await page.addInitScript(() => {
    localStorage.setItem("analytics-consent", "false")
  })
  await page.goto("/login")
  await page.getByLabel(/e-?mail/i).fill(email)
  await page.getByTestId("password").fill(TEST_PASSWORD)
  await page.getByRole("button", { name: "Entrar", exact: true }).click()
  await page.waitForURL(/\/dashboard/, { timeout: 15_000 })
}
```

Key points:
- `addInitScript` runs before page scripts on **every** navigation of that page — it must be registered before any `goto`, otherwise the banner is already mounted and its `z-50` backdrop intercepts the first click (the classic "element is not clickable / click does nothing" failure).
- Fresh contexts have empty `localStorage`, so **every** `browser.newContext()` needs this — it cannot be set once for the suite.

### Step 6: Selectors that survive this UI

- Password: **`getByTestId("password")`**. `getByLabel(/senha/i)` also matches the aria-label of the "Mostrar senha" (show-password) toggle → strict-mode violation / wrong element.
- Buttons: **`getByRole("button", { name: "Entrar", exact: true })`** — non-exact names collide with nearby links/buttons.
- Accessible names with diacritics: **`getByRole("navigation", { name: /navega[çc][aã]o principal/i })`** — accent/case variants differ between the DOM, translations and tooling; regex-normalize instead of hardcoding one spelling.
- Realtime surfaces are addressed by testid: `feed-container`, `feed-pill`, `unread-notifications-badge` (AppHeader) — the **mobile** nav renders its own badge with `unread-notifications-badge-mobile` (review U, same `aria-label`), so target the desktop testid explicitly or the pair becomes a strict-mode violation.

### Step 7: Block WS selectively and observe the handshake positively

[File: `tests/e2e/social-realtime.spec.ts` — registration **before** any navigation]

```typescript
let wsAllowed = false
let resolveConnected: (() => void) | undefined
const reconnected = new Promise<void>((resolve) => { resolveConnected = resolve })

page.on("websocket", (ws) => {
  if (!ws.url().includes("localhost:3003")) return
  ws.on("framereceived", () => resolveConnected?.())   // positive proof
})

await page.routeWebSocket(/localhost:3003/, (ws) => {
  if (wsAllowed) ws.connectToServer()
  else void ws.close()
})
```

Key points:
- **Blocked attempts die without ever producing a frame** — there is no "close frame" or "error" you can assert on. The only reliable signal of a *successful* reconnect is a `framereceived` on a socket whose URL matches `localhost:3003`; therefore you cannot infer connectivity from the absence/presence of events, only from a positively observed frame.
- **Order matters:** `routeWebSocket` and the `websocket` listener must be installed before `goto` (the client connects early and retries with backoff 1s→30s); a listener attached after reconnect misses the handshake promise forever.
- **Create the event only AFTER `await reconnected`.** While connected, the 30s fallback polling is *suppressed* and there is **no catch-up** on events emitted while the client was offline — a post created before the handshake resolves is simply lost to this assertion.
- Scope the route to `/localhost:3003/` so the app's other sockets (HMR, etc.) keep working.

### Step 8: Assert pills on relative values, never absolutes

```typescript
// First delivery: accept any observed count (initial window is 5 min).
await expect(pill).toHaveText(/^\d+ novos? posts?$/, { timeout: 60_000 })
const before = Number((await pill.textContent())?.match(/^\d+/)?.[0] ?? "0")
expect(before).toBeGreaterThan(0)

// After reconnect: assert the DELTA, not a hardcoded number.
await expect(pill).toHaveText(`${before + 1} novos posts`, { timeout: 60_000 })
```

Key points:
- The cursor (`postsCursor`/`notificationsCursor`, via `INITIAL_CURSOR()`) starts at `Date.now() - POLLING_DEFAULT_SINCE_MS` (5 min), so the **first poll of a serial file also returns posts created by earlier tests in the same file**. An absolute `toHaveText("1 novo post")` passes once and then fails.
- Timeouts: the fallback interval is 30s → allow `60_000` on polling-driven assertions; only the WS path is asserted with `15_000` (delivery must be `< 30s` to prove it came from the socket, not the poller).
- Seed state directly in the DB (`prisma.follow.create`) when you need rooms populated *without* consuming HTTP quota or emitting an unwanted notification.

## Complete Example

A minimal new realtime spec following the pattern:

```typescript
import { expect, test } from "@playwright/test"
import { BASE_URL, csrfHeaders, prisma, registerUser, attachSession, cleanupUser } from "./helpers"

const EMAIL = "e2e-thing@test.com"

test.describe("T0XX: <feature> realtime", () => {
  test.describe.configure({ mode: "serial" })
  let token = ""

  test.beforeAll(async ({ request }) => {
    await registerUser(request, EMAIL, "E2E Thing")       // idempotent + emailVerified guaranteed
    token = (await attachSession(request, EMAIL)).accessToken
  })

  test.afterAll(async () => {
    await prisma.<yourDomainRows>.deleteMany({ where: /* your filter */ })
    await cleanupUser(EMAIL)
  })

  test("event X reaches page Y", async ({ browser, request }) => {
    test.setTimeout(180_000)                              // if you wait on the 30s poller
    const ctx = await browser.newContext()
    const page = await ctx.newPage()
    try {
      await page.addInitScript(() => localStorage.setItem("analytics-consent", "false"))
      await page.goto("/login")
      // ... uiLogin steps (getByTestId("password"), exact button) ...
      await page.goto("/<route>")
      await expect(page.getByTestId("<container>")).toBeVisible()

      const status = await request.post(`${BASE_URL}/api/v1/<trigger>`, {
        headers: { ...csrfHeaders().headers, Authorization: `Bearer ${token}` },
        data: {},
      })
      expect(status).toBe(201)

      const target = page.getByTestId("<badge-or-pill>")
      const before = Number((await target.textContent())?.match(/^\d+/)?.[0] ?? "0")
      await expect(target).toHaveText(`${before + 1} ...`, { timeout: 60_000 })
    } finally {
      await ctx.close()
    }
  })
})
```

Run with: `npx playwright test tests/e2e/<file>.spec.ts` (never bare `npx playwright` from another cwd — `testDir` is `./tests/e2e`).

## Project-Specific Constraints

- [ ] Test process `DATABASE_URL` **must** come from `.env.local`, enforced in `tests/e2e/helpers.ts` at import time, before `new PrismaClient()`.
- [ ] `.env.local` **must** define `AUTH_URL=http://localhost:3000` or NextAuth loops `/login` ↔ `/dashboard` (secure vs non-secure cookie name).
- [ ] `REDIS_URL` **must** be present in **both** `webServer` env blocks — the Event Bus crosses Next ↔ socket-service only through Redis (ADR-007, `docs/02-architecture/architecture.md` §6.4).
- [ ] Socket auth is **RS256 with `JWT_PUBLIC_KEY`** (ADR-009), not `JWT_SECRET`; both servers must share the key pair.
- [ ] Ports 3000 and 3003 must be free (no orphaned `next dev`/`dev:ws`) before a run — the register IP limiter is in-memory, 3 attempts / 60min per process.
- [ ] Registration fixtures go through `registerUser()` only (reuse existing + repair `emailVerified`); never raw `POST /api/v1/auth/register` in a spec body.
- [ ] Every fresh context gets `addInitScript(analytics-consent=false)` **before its first `goto`**.
- [ ] Realtime assertions are **relative** (`before + 1`) or regex-observed (`/^\d+ novos? posts?$/`) — never absolute counts in a serial file.
- [ ] A reconnect claim requires a positively observed `framereceived` on `localhost:3003` **after** flipping `wsAllowed`, and the event that proves delivery is created **after** that handshake.
- [ ] Serial mode + `workers: 1` + `fullyParallel: false` are load-bearing; domain rows and users are cleaned in `afterAll`.

## Anti-Patterns (What NOT to Do)

- ❌ Letting the test process inherit `DATABASE_URL` from `.env` (remote Prisma Postgres) while `next dev` uses `.env.local` — the classic split-brain: fixtures land in the wrong database and every assertion fails "for no reason".
- ❌ Calling `page.goto(...)` before `addInitScript` — the consent backdrop (`z-50`) mounts and swallows the first click.
- ❌ `getByLabel(/senha/i)` for the password field — it also matches the "Mostrar senha" toggle's aria-label.
- ❌ Asserting `toHaveText("1 novo post")` on a pill in a serial suite — the 5-minute `INITIAL_CURSOR()` window includes earlier tests' posts.
- ❌ Inferring "socket reconnected" from a blocked WS close/error, or creating the triggering event *before* awaiting the handshake — blocked attempts emit no frames, and while connected polling is suppressed with **no catch-up**, so the event is lost.
- ❌ Spinning up only `npm run dev` (or starting `dev:ws` without `REDIS_URL`) — the in-memory bus cannot cross processes, so WS delivery never happens and the test "proves" a false negative.
- ❌ Registering test users with raw HTTP calls on every run — burns the 3/60min in-memory IP quota, especially against a warm `next dev`.
- ❌ Leaving a dev server running between runs (`reuseExistingServer: true` will happily reuse a stale one holding the rate-limit counter and possibly a different DB).
- ❌ Removing `workers: 1` / `fullyParallel: false` for "speed" — the specs share a single DB user graph and a single rate-limited IP.

## Related Patterns / Docs

- `docs/solutions/patterns/observability/gate-third-party-analytics-sdk-init.md` — the `analytics-consent` gate the init script pre-satisfies
- `docs/solutions/patterns/auth/set-csrf-cookie-client-side.md` — why `csrfHeaders()` mirrors cookie + header for API calls from the test
- `docs/plans/20260926120000-sprint2-execution-plan.md` — Execution Log 2026-10-02 (Phase 2.5): infra E2E decisions, fixes (c) Prisma adapter/DATABASE_URL and (d) `AUTH_URL` in `.env.local`
- `tests/integration/websocket.test.ts` (T074) — reconnect/room re-join at protocol level (complements, does not overlap, this pattern)
- ADR-007 (separate socket-service) and ADR-009 (RS256 JWT) — the architectural reasons the harness needs two servers, one Redis, one key pair

## Safe Change Checklist for Future AI Work

1. **New realtime spec:** copy the `uiLogin`/`addInitScript`/selector block from `tests/e2e/social-realtime.spec.ts`, import fixtures from `tests/e2e/helpers.ts`, set `mode: "serial"`, and add `afterAll` cleanup for every row you touch.
2. **New server process (new port):** add a third `webServer` entry in `playwright.config.ts` with `REDIS_URL` + `JWT_PUBLIC_KEY` + `AUTH_URL`, a real health URL, and `reuseExistingServer: true`; extend any `routeWebSocket` regex to cover it.
3. **Env changes:** if `.env.local` gains/renames a var the app needs locally (`AUTH_URL`, `DATABASE_URL`, `REDIS_URL`), update Step 2 and confirm the test-process override still reads it.
4. **Assertion changes:** keep all count-based UI assertions relative (`before + N`) and all WS claims anchored on a positively observed `framereceived`.
5. **Verification:** free ports 3000/3003 → `npx playwright test tests/e2e/<file>.spec.ts` must be green twice in a row (the second consecutive run is what catches rate-limit and absolute-assertion regressions), then `npx tsc --noEmit` and `npx eslint tests/e2e`.
