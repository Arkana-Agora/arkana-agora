# Vercel Deploy Fails with `ENOENT .next/next-server.js.nft.json` (standalone + adapter)

> **Category**: ci-cd / nextjs · **Date**: 2026-08-24 · **Status**: solved

## Problem

First-ever Vercel deploy of the repo (commit `a8cfd9e`, Next 16.3.0 + Turbopack, `output: "standalone"` in `next.config.ts` for Docker) failed at the very end of an otherwise green build.

## Symptoms

```
✓ Compiled successfully
✓ Generating static pages (5/5)
Running onBuildComplete from Vercel
> Build error occurred
Error: ENOENT: no such file or directory, open '/vercel/path0/.next/next-server.js.nft.json'
```

Local `bun run build` passed every time — failure was Vercel-only and deterministic.

## Root Cause

Upstream regression [vercel/next.js#96646](https://github.com/vercel/next.js/issues/96646) (introduced by #93684 in 16.3.0): when a build **adapter** is active (`NEXT_ADAPTER_PATH`, injected by Vercel), Rust skips emitting the whole-server NFT files (`next-server.js.nft.json`) on the premise "adapters don't read them" — but the `output: 'standalone'` finalizer (`copyTracedFiles`) still reads that file **unguarded**. Minimal failing condition: adapter active + standalone enabled. Local builds have no adapter → file is emitted → no error. Works fine on ≤16.2.x.

## Fix

`next.config.ts` — standalone only outside Vercel:

```ts
if (!process.env.VERCEL) {
  nextConfig.output = "standalone"
}
```

Vercel sets `VERCEL=1` in build/runtime; Docker and CI don't, so `.next/standalone` keeps being produced for the Dockerfile runner stage (`COPY --from=builder /app/.next/standalone ./`).

**Typing gotcha:** the inline form `output: process.env.VERCEL ? undefined : "standalone"` does **not compile** under `exactOptionalPropertyTypes` (strict flag adopted in this repo). Use post-object conditional mutation.

**Anti-pattern discarded (measured upstream):** swallowing/guarding the ENOENT read yields exit 0 but a broken `.next/standalone` missing ~48% of traced files (incl. parts of `next` itself) that crashes at boot in Docker.

## Verification

Clean-build both branches locally before pushing:

```powershell
Remove-Item -Recurse -Force .next
$env:VERCEL = "1"; bun run build; Remove-Item Env:\VERCEL
Test-Path .next/standalone        # → False (caminho Vercel)

Remove-Item -Recurse -Force .next
bun run build
Test-Path .next/standalone        # → True (Docker/CI)
```

Plus lint/type-check/test gates. Final proof = Vercel deploy concluding `onBuildComplete`.

## Removal Condition

Re-evaluate when vercel/next.js fix PR [#97287](https://github.com/vercel/next.js/pull/97287) (merged) reaches a **stable** `next` release actually pinned in `package.json` — then remove the guard and re-simulate both targets.

## References

- Commits `2821c34` (fix), `1f85adf` (docs)
- Execution Log: `docs/plans/20260812203642-sprint-0-completion-plan.md` (2026-08-24, first entry)
- `docs/02-architecture/deployment.md` §5.1 (invariant note)
- Pattern: `patterns/ci-cd/multi-target-build-simulation.md`
