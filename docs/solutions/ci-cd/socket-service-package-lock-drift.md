# socket-service `package-lock.json` Drift — `npm ci` EUSAGE + `lockfile-sync` Red

> **Category**: ci-cd · **Date**: 2026-10-17 · **Status**: solved

## Problem

CI job failed on `tests/unit/lockfile-sync.test.ts` (1 failed | 2687 passed) and, independently, the `socket-service` Docker image build would break at `npm ci`.

## Symptoms

Vitest:

```
FAIL tests/unit/lockfile-sync.test.ts > socket-service packaging (revisão I-b) > package-lock.json local existe e casa com o name do package.json
AssertionError: expected [ 'dotenv' ] to deeply equal []
Expected: []
Received: [ 'dotenv' ]
```

Docker / `npm ci`:

```
npm error code EUSAGE
npm error `npm ci` can only install packages when your package.json and package-lock.json ... are in sync.
npm error Missing: dotenv@18.0.8 from lock file
```

## Root Cause

Commit `7d8dc3d` added `"dotenv": "^18.0.3"` to `socket-service/package.json` (consumed by `socket-service/src/lib/env.ts`) and created `socket-service/bun.lock`, but did **not** regenerate `socket-service/package-lock.json`. The service carries a **dual lock**: `bun.lock` (bun dev path) and `package-lock.json` (Docker path — `socket-service/Dockerfile` copies `package.json` + `package-lock.json` and runs `npm ci --omit=dev --ignore-scripts`). The dependency set in `package.json` was no longer a subset of `package-lock.json.packages`, so both the contract test and `npm ci` failed.

## Fix

Regenerate the npm lockfile from the service manifest (additive, no churn):

```powershell
# in socket-service/
npm install --package-lock-only --ignore-scripts --no-audit --no-fund
```

Result: **16 insertions** — `packages[""].dependencies.dotenv = "^18.0.3"` and a new `packages["node_modules/dotenv"]` pinned to `18.0.8` (matching `bun.lock` resolution + its sha512 integrity).

## Verification

```powershell
# artifact level (fresh temp dir with only package.json + package-lock.json)
npm ci --omit=dev --ignore-scripts --dry-run   # EXIT=0, "add dotenv 18.0.8", no EUSAGE
# contract level
node --max-old-space-size=4096 node_modules/vitest/vitest.mjs run tests/unit/lockfile-sync.test.ts  # 4/4 passed
```

## Prevention & Gotchas

- **Any edit to `socket-service/package.json` requires regenerating `socket-service/package-lock.json`.** The two locks must stay aligned; `bun.lock` alone is not enough.
- `tests/unit/lockfile-sync.test.ts` is the guard: it asserts (a) lockfile `name` matches, (b) every `package.json` dependency resolves in the lockfile, (c) every socket range equals the root range, (d) `tsx` is a service dep.
- `--package-lock-only` is safe and minimal — it preserves existing locked versions and only adds the missing dependency; it never touches `node_modules`.
- `package-lock.json` is `.prettierignore`d (`.prettierignore` → "# Lockfiles"), so no format gate applies.
- Quick local signal after touching the service manifest: `npm ci --dry-run` in `socket-service/` — `EUSAGE` = drift.

## References

- Commit `7d8dc3d` (introduced the drift: `dotenv` + `bun.lock`, no `package-lock.json`)
- Files: `tests/unit/lockfile-sync.test.ts`, `socket-service/package-lock.json`, `socket-service/Dockerfile`, `socket-service/src/lib/env.ts`
- Docs: `docs/environments.md` (socket-service env loading), `docs/infrastructure.md` (socket-service packaging)
