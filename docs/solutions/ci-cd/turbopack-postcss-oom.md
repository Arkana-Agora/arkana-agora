# Turbopack/PostCSS Build OOM — `Zone Allocation failed - process out of memory` (exit 134)

> **Category**: ci-cd / build · **Date**: 2026-09-23 · **Status**: solved

## Problem

Local `npm run build` (Next 16.3 Turbopack + `@tailwindcss/postcss`) intermittently dies while compiling `src/app/globals.css`:

```
Zone Allocation failed - process out of memory
... child exited with code 134 ...
reading packet length
Foi forçado o cancelamento de uma conexão existente pelo host remoto. (os error 10054)
```

Same session: an earlier `npm run build` can succeed (exit 0) then the next fails — the failure is **environmental** (system memory pressure), not a deterministic code/config bug.

## Symptoms

| Signal | Value observed |
|---|---|
| Exit code (child) | `134` (SIGABRT) |
| Exit code (repro under pressure) | `-1073741571` (`0xC00000FD` stack overflow / zone failure under pressure) |
| File being processed | `src/app/globals.css` via PostCSS worker |
| Free RAM at crash | **273–537 MB** of 8 GB |
| When it happens | Intermittent; also fails when other apps (browser, AV, IDE) hold memory |

## Root Cause

1. **System free RAM exhaustion** — PostCSS/Turbopack worker needs a fresh Node process + zone allocations early (GC traces showed deaths at only ~17–30 MB JS heap, i.e. **native/zone** failure, not the default V8 heap cap). With <512 MB free, `Zone Allocation failed` aborts the worker → parent IPC break (`os error 10054`).
2. **No heap headroom on the build entry** — `next build` uses default heap; worker processes inherit `NODE_OPTIONS` if set, but the script never set one.
3. **Optional local aggravators** — Kaspersky (`avp`) with no project exclusion can kill/hold short-lived Node workers; pagefile contention under low free RAM.

**Not a root cause**: missing `shadcn/tailwind.css` / `tw-animate-css` imports (they resolve); `postcss.config.mjs` plugin list is correct for Tailwind 4.

## Fix

1. **Give the build entry more V8 old-space headroom** in `package.json` (shared by local, CI, and Vercel `npm run build`):

   ```json
   "build": "prisma generate && node --max-old-space-size=4096 node_modules/next/dist/bin/next build"
   ```

   Prefer this over `cross-env` (no extra dep, Windows-safe). **Caveat:** the flag only raises V8 old-space for the process started with it (and does **not** fix native zone failures at ~17–30 MB when free RAM is exhausted). Primary mitigation remains free RAM; this only helps when the failure is heap-cap-related rather than pure `VirtualAlloc` exhaustion.

2. **Free memory before local builds** — close heavy apps (browsers, other Node/Next, Docker if idle). Target **>1 GB free** before `npm run build`. This is the real fix for the observed `Zone Allocation failed` traces.

3. **Kaspersky (Windows)** — optionally exclude `D:\GitHub\arkana-agora\node_modules` and `.next` from on-access scan if builds still abort at low heap.

4. **Vercel / CI** — production logs for this ticket were **runtime `AUTH_URL`**, not build OOM. The same `build` script (with the heap flag) already ships to Vercel and CI. If a platform build still OOMs under memory pressure, raise plan memory or set project env `NODE_OPTIONS=--max-old-space-size=4096`; a huge heap cap with almost no free physical memory will still fail zone allocations.

## Verification

```powershell
# free memory > ~1 GB preferred
$os = Get-CimInstance Win32_OperatingSystem; [int]($os.FreePhysicalMemory/1024)

npm run build          # exit 0, full route table
npx tsc --noEmit
npx vitest run tests/auth-config.test.ts
```

## Gotchas / anti-patterns

- Do **not** treat `exit 134` + `os error 10054` as a broken PostCSS config — same session can build green under more free RAM.
- Do **not** add random Tailwind `@import`s as a “fix” for OOM — imports were never the issue.
- `--max-old-space-size` on the `build` entry is **not** a free-RAM substitute and does not propagate to every spawned child; free memory is the primary fix for zone OOM.
- Production `AUTH_URL é obrigatório em produção` on SSR is a **separate** runtime guard (`src/auth/auth.config.ts`) — see `docs/runbooks/vercel-deploy-auth-url.md`.

## Removal Condition

Remove `--max-old-space-size` from `build` only if Vercel/Next ships a stable fix for Turbopack PostCSS worker zone OOM **and** local builds prove green at moderate free RAM without the flag.

## References

- `package.json` (`build` script)
- `postcss.config.mjs`, `src/app/globals.css`
- `docs/runbooks/vercel-deploy-auth-url.md` (production AUTH_URL runtime — distinct failure)
- `docs/solutions/ci-cd/prisma-v8-cli-regression.md` (prior build failure class)
