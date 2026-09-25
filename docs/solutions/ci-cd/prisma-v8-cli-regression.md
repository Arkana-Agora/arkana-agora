# Prisma 8 CLI Regression — `prisma generate` / `migrate` Missing + Corrupted Windows Shim

> **Category**: ci-cd / database · **Date**: 2026-09-23 · **Status**: solved

## Problem

Local `npm run build` failed in its `prisma generate` step after a Prisma install landed `prisma@8.0.0-rc.15` while `@prisma/client` stayed at `7.10.0`. Script at incident time: `prisma generate && next build`; the current script also passes `node --max-old-space-size=4096` (heap flag added 2026-09-23 — see `docs/solutions/ci-cd/turbopack-postcss-oom.md`).

## Symptoms

```
prisma generate
> CLI.UNKNOWN_COMMAND
```

Follow-up failure after partial cleanup:

```
Error: Cannot find module '…\node_modules\prisma\dist\prisma.js'
```

## Root Cause

1. **v8 RC CLI surface removed classic verbs.** Prisma 8 Platform CLI has `auth`, `project`, `postgres`, etc. — **no** `generate`, **no** `migrate`, **no** `db`. `npm run build` depends on `generate`, so any v8 CLI install breaks the build while the client package can still be v7 (mismatch).
2. **Windows bin shim corruption (bun artifact).** Leftover `node_modules/.bin/prisma.exe` / `prisma.bunx` pointed at a nonexistent `dist/prisma.js` instead of the correct `build/index.js` entry. Even after pinning back to v7, the stale `.exe` shadowed the good shim, so `npm run` / `npx prisma` still failed with `dist/prisma.js`.

Related gotchas confirmed on this repo:

- **Datasource URL moved.** In Prisma 7 config style, `prisma/schema.prisma` `datasource` block has **no** `url` — the URL lives in `prisma.config.ts` (`defineConfig` from `prisma/config`).
- **`PrismaClientKnownRequestError` import.** From `@prisma/client` as `Prisma.PrismaClientKnownRequestError` (v7 removed `@prisma/client/runtime/library` deep import).
- **`prisma postgres link --force` overwrites `DATABASE_URL`** with the **direct** host. Runtime must keep **pooled** `pooled.db.prisma.io` in `DATABASE_URL`; CLI/migrations use **direct** `db.prisma.io` in `DIRECT_URL` (consumed by `prisma.config.ts`).
- **`exactOptionalPropertyTypes: true`** — no `url: undefined` patterns; throw-if-missing for config URL instead.
- Leftover `.opencode/skills/prisma-*-core-concepts` docs from a v8 `prisma skills sync` advertise `library_version: 8.0.0-rc.15` — **do not re-add** while on v7.

## Fix

1. **Pin CLI to v7** in `package.json`:
   - `"prisma": "^7.10.0"` (devDependencies), aligned with `@prisma/client` / `@prisma/adapter-pg` `^7.10.0`.
   - Remove v8-only scripts (e.g. `postinstall: prisma skills sync`).
2. **Delete corrupted Windows shims** if `dist/prisma.js` appears:
   ```powershell
   Remove-Item -Force node_modules\.bin\prisma.exe, node_modules\.bin\prisma.bunx -ErrorAction SilentlyContinue
   # reinstall to restore correct shim
   npm install
   ```
3. **Prefer the local bin** when `npx prisma` still resolves the bad path:
   ```powershell
   .\node_modules\.bin\prisma generate
   .\node_modules\.bin\prisma migrate status
   ```
4. **Keep connection URLs split**:
   - `.env` → `DATABASE_URL` = pooled host (runtime `@prisma/adapter-pg` in `src/lib/prisma.ts`)
   - `.env` → `DIRECT_URL` = direct host (CLI via `prisma.config.ts`)
5. **After any re-link**, restore the pooled host into `DATABASE_URL` if link overwrote it.

## Verification

```powershell
node -e "console.log(require('./package.json').devDependencies.prisma)"   # ^7.10.0
.\node_modules\.bin\prisma generate                                       # exit 0
.\node_modules\.bin\prisma migrate status                                 # up to date
npx tsc --noEmit                                                          # exit 0
npx vitest run                                                            # green
npm run build                                                             # exit 0 (full route table)
```

## Removal Condition

When Prisma 8 stable ships **with** `generate`/`migrate` (or the app migrates to Platform-only deploy verbs) **and** `@prisma/client` is upgraded in lockstep, re-evaluate the v7 pin. Until then, never run bare `npx prisma@latest` in this repo.

## References

- `package.json` (`build` script, Prisma pins)
- `prisma.config.ts` (`defineConfig`, `url = process.env.DIRECT_URL || process.env.DATABASE_URL`)
- `src/lib/prisma.ts` (`PrismaPg` adapter, pooled `DATABASE_URL`)
- `docs/environments.md` (env matrix + known constraints)
- `docs/03-database/migrations.md` §3.1 (local migrate flow)
