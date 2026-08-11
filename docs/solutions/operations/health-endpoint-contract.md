---
title: "Health endpoint contract: derived status + neutral optional services"
problem_type: solution
category: operations
components:
  - backend
tags:
  - health-check
  - api-contract
  - not-configured
  - prisma
  - nextjs-route-handler
  - observability
module: observability / ops baseline
date: 2026-08-11
resolved_in: "Health endpoint fix, branch dev, 2026-08-11"
---

# Problem

`GET /api/health` (Next.js 16 skeleton, `src/app/api/health/route.ts`) violated the documented contract and was unsafe:

- The docs (README, `docs/infrastructure.md`, `docs/environments.md`, `docs/02-architecture/observability.md` §6.3) stated the endpoint returns **503 until Redis/AI are configured** — but the code returned a **hardcoded `status: "ok"` with HTTP 200** regardless of real service state. The body could claim `ok` while the database was down.
- The DB probe had **no timeout**: a hung query hangs the endpoint forever.
- The DB probe had **no error handling/logging**: without a local `.env` (`DATABASE_URL`), the query rejection escaped as an unhandled error (no JSON response).
- The version came from a **deep relative `package.json` import** in the route file.

# Root Cause

- Docs described a *planned* contract (503 until everything is wired) while the skeleton shipped a *placeholder* implementation — the two drifted.
- Multi-agent review (Important findings) flagged: "top-level status must be derived from checks; `not-configured` services are neutral and must not force 503".
- Empirical facts discovered during review:
  - **Prisma 6 does NOT throw at import when `DATABASE_URL` is missing** — the error surfaces only on query. Env-guards cannot protect the endpoint; the `try/catch` around the probe is the only reliable guard.
  - **Next.js dev imports route handlers on every request** — module-level `new PrismaClient()` in a route is only safe through the `@/lib/prisma` singleton.

# Fix

Applied in `src/app/api/health/route.ts` + `tests/health.test.ts` + new `src/lib/version.ts`:

- `status` in the body is **derived** from the checks (`ok` when none failed, `degraded` when any is `error`) and never contradicts the HTTP code.
- `redis`/`ai` report `{ status: "not-configured" }` — **neutral**: they never contribute to the failure aggregate. HTTP 200 is reachable as soon as the DB check passes; 503 only on hard DB failure.
- DB check is **time-boxed** (`Promise.race` + `setTimeout`, `DB_CHECK_TIMEOUT_MS = 5_000`) and **catches + logs** failures (`console.error("[health] database check failed", error)`).
- Version comes from `APP_VERSION` (`src/lib/version.ts`, reads `pkg.version` from `../../package.json` at module load) — routes never deep-import `package.json`.
- `tests/health.test.ts` pins the contract **DB-state-agnostically**: asserts envelope shape, `version === APP_VERSION`, redis/ai exactly `not-configured`, and the derivation rule (`ok` ⇔ 200, `degraded` ⇔ 503).

# Verification

- `Command:` `npm run type-check` / `npm run lint` / `npm test`
- `Result:` exit 0 / 0 / 0 (1 test passed)

# Prevention

- Reusable how-to captured in `docs/solutions/patterns/backend/health-check-envelope.md`.
- Written contract updated repo-wide (`observability.md` §6.3, `sprint-0.md`, `infrastructure.md`, etc.) to match the implemented behavior.
- Future service checks (Redis, AI) must follow the pattern doc; the next consumer is the planned `GET /admin/system/health` (`docs/04-api/admin.md`).

# Related Docs

- `docs/solutions/patterns/backend/health-check-envelope.md` — the prescriptive pattern
- `src/app/api/health/route.ts`, `src/lib/version.ts`, `tests/health.test.ts` — implementation
- `docs/02-architecture/observability.md` §6.3 — written contract
