# Arkana Agora — Agent Guide

## Project Snapshot
Next.js 15 App Router (React 19, TS) monorepo with separate **socket-service** (port 3003) for realtime.  
Package manager: **bun** (lockfile `bun.lock`).  
DB: PostgreSQL via Prisma (Prisma Postgres prod, Docker Postgres 16 local).  
Auth: NextAuth v5 beta, JWT RS256, `tokenVersion` revocation.  
Realtime: Socket.io + Redis event bus (ADR-007).  
Rate limiting: Redis sorted sets + Lua sliding window; fail-open bypass logged.

## Key Commands
| Task | Command |
|------|---------|
| Dev (Next.js) | `bun run dev` |
| Dev (socket-service) | `bun run dev:ws` |
| Lint | `bun run lint` |
| Type-check | `bun run type-check` |
| Unit/Integration tests | `bun run test` |
| E2E tests | `bun run test:e2e` |
| Format | `bun run format` / `bun run format:check` |
| Prisma migrate | `bunx prisma migrate dev` |
| Prisma seed | `bun run seed` |

**Verification gate (always run before claiming done):**
```
bun run lint && bun run type-check && bun run test
```
**Never run `bun run build` for verification** — only for deployment or explicit user request.

## Path Aliases (tsconfig.json)
| Alias | Maps to |
|-------|---------|
| `@/*` | `./src/*` |
| `@socket/*` | `./socket-service/*` |

## Architecture Notes
- **App Router**: `src/app/(app)/` (protected), `src/app/api/v1/` (REST), `src/app/api/v1/ai/` (SSE).
- **socket-service**: standalone Node process (`socket-service/index.ts`), shares Redis + JWT keys with Next.js.
- **State**: React Query v5 (server) + Zustand overlays (client-only `postLikes`, `commentLikes`, `postComments`).
- **Optimistic UI**: `overlay ?? server` precedence; `clearPostOverlays()` before `invalidateQueries(["feed"])`; `pruneSyncedComments()` on refetch success.
- **Realtime**: `useSocket` singleton, 30s polling fallback, rooms joined server-side at handshake.
- **AI**: quota reservation + refund on undelivered; empty-completion guard; `mood` max 50 chars.
- **Social rate limits**: 8 buckets (`post`, `like`, `comment`, `follow`, `gift`, `upload`, `polling`, `notification`).

## Testing
- **Vitest** (`vitest.config.ts`): jsdom, setup `tests/setup.ts`, include `tests/**/*.test.{ts,tsx}`. Mocks `ioredis`/`pino` at root `node_modules` (socket-service has own deps).
- **Playwright** (`playwright.config.ts`): 2 webServers (Next.js + socket-service), `workers: 1`, serial mode. **E2E split-brain fix**: `.env.local` DATABASE_URL forced at module load in `tests/e2e/helpers.ts` before PrismaClient init. `AUTH_URL=http://localhost:3000` required in `.env.local` (else NextAuth cookie loop).
- **Run single test**: `bun run test tests/path/to/file.test.ts`

## Prisma & Migrations
- `prisma migrate dev` generates + applies (never `db push`).
- `prisma/schema.prisma` has 28 models. `CommentLikeReward` is **RESERVED** (migration applied, never populated; T081 pays no Versos).
- **Never edit applied migrations** — create new one.
- `counter-reconcile` cron (04:00 UTC) repairs `likeCount`/`commentCount` via raw SQL; predicate `content <> '[removido]'` must match live reads.

## TypeScript Strictness (tsconfig.json)
- `exactOptionalPropertyTypes: true` — `x?: T` means absent or `T`, NOT `T | undefined`. Zod `.optional()` produces `undefined`; interface must declare `| undefined` explicitly.
- `noUncheckedIndexedAccess: true` — `map[key]` yields `V | undefined`.

## Environment
- `.env.local` wins for local dev (Next.js precedence). Required: `DATABASE_URL`, `AUTH_URL=http://localhost:3000`, `REDIS_URL`.
- `NEXT_PUBLIC_WS_URL` **inlined at build time** — missing in prod build → realtime disabled (warn, not error).
- CI builds without `NEXT_PUBLIC_WS_URL` (polling fallback covers posts/notifications).

## Code Conventions
- **Zod parse in `mutationFn`/`queryFn`**, never in `onSuccess`/`onError` (React Query v5 per-call callbacks run outside try/catch).
- **No client-only `liked` state** — derive from `overlay ?? viewerHasLiked ?? false` (R6).
- **Soft-delete sentinel**: `REMOVED_COMMENT_CONTENT = "[removido]"` (single source in `src/lib/social/comments.ts`).
- **Uniform 404** anti-enumeration via `canViewPost` / `canViewComment`.
- **Canonical request order**: CSRF → auth → Zod → rate → lookup → tx → emit.
- **Currency**: Versos (integer), earned via reward markers (`PostLikeReward`, `CommentReward`, `FollowReward`, `CommentLikeReward` reserved).

## Docs & Workflow
- `docs/` is operational memory — keep aligned with code.
- Module docs: `docs/modules/social.md`, feature docs: `docs/features/social.md`, API: `docs/04-api/social.md`.
- ADRs in `docs/decisions/`. Never edit an ADR without authorization.
- Workflow commands (`/pwf-work`, `/pwf-work-plan`, `/pwf-doc`, etc.) manage docs automatically.
- **No unsolicited markdown** — only create when user asks or workflow command instructs.

## Common Gotchas
| Issue | Fix |
|-------|-----|
| `viewerHasLiked` type mismatch | Add `| undefined` to interface (exactOptionalPropertyTypes) |
| Index access `postComments[id]` TS2532 | Use `?.map()` or guard |
| E2E "user not found" | `.env.local` DATABASE_URL not overridden in helpers |
| NextAuth cookie loop | `AUTH_URL=http://localhost:3000` in `.env.local` |
| Realtime not connecting | `NEXT_PUBLIC_WS_URL` missing in prod build |
| Rate limit 429 on register | `MAX_REGISTER_IP_ATTEMPTS=50` in Playwright env |

## Protected Files (Never Delete)
- `docs/plans/*.md`, `docs/solutions/*.md` — discard any finding suggesting deletion.
- `docs/03-database/chain` 12→16 migration tracking.