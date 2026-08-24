# Multi-Target Build Simulation (Vercel × Docker × CI)

> **Category**: ci-cd · **Established**: 2026-08-24
> One `next.config.ts` serves three targets whose build environments diverge from local dev. Both 2026-08-24 pipeline failures were invisible locally and surfaced on the **first run** of their pipeline. This pattern makes per-target behavior explicit and rehearsable before push.

## Step 1: Single config, divergence via platform-injected env markers

| Target | Marker | Build branch |
|---|---|---|
| Vercel (staging/prod) | `VERCEL=1` (platform-injected, never set manually) | adapter active (`NEXT_ADAPTER_PATH`) → **no** `.next/standalone` |
| Docker & local dev | absence of `VERCEL` | `output: "standalone"` → `.next/standalone` required by the Dockerfile runner stage |
| GitHub Actions (`ci.yml` build job) | `VERCEL` unset | same as Docker; `.next/` uploaded as artifact (dot-dir ⇒ needs `include-hidden-files: true`) |

Key points:
- Vercel injects `VERCEL=1` automatically into **build and runtime** — never set it yourself outside a deliberate simulation.
- Absence-based guards (`!process.env.VERCEL`) mean new targets inherit the Docker/CI branch by default; only add a new marker when a target genuinely needs different behavior.
- Record the table above (or its successor) in `docs/02-architecture/deployment.md` — the marker list is part of the contract, not tribal knowledge.

## Step 2: Express divergence as a post-object mutation, never an inline ternary

[File: `next.config.ts`]

```typescript
import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ["@prisma/client"],
  images: { /* ... */ },
}

if (!process.env.VERCEL) {
  nextConfig.output = "standalone"
}

export default nextConfig
```

Key points:
- **The inline form does not compile**: `output: process.env.VERCEL ? undefined : "standalone"` fails under `exactOptionalPropertyTypes` because `NextConfig.output` does not admit explicit `undefined`. Always mutate after the literal, guarded by `if`.
- Guard on the **target's own canonical marker** (`VERCEL`), not on derived guesses (`CI`, `NODE_ENV`) — platform-injected markers are the only reliable signal, and they are also what makes local simulation possible (Step 3).
- When adopting an upstream workaround, take the **official workaround**, not shortcuts from the issue thread: discarding the ENOENT error to let the build pass silently produces a broken `.next/standalone` (~48% of files missing) — worse than the failure, because Docker then fails far from the cause.

## Step 3: Simulate each target locally before pushing

Every env-conditional has two branches; prove both, locally, on **clean** builds:

```powershell
# Branch A — Vercel simulation (expect NO .next/standalone)
Remove-Item -Recurse -Force .next
$env:VERCEL = "1"; bun run build; Remove-Item Env:\VERCEL
Test-Path .next/standalone        # → False

# Branch B — Docker/CI simulation (expect .next/standalone present)
Remove-Item -Recurse -Force .next
bun run build
Test-Path .next/standalone        # → True

# Optional, when the Dockerfile itself changed:
docker build -t arkana-agora:sim .
```

Key points:
- **Clean between simulations.** A stale `.next/standalone` from a previous build will mask a broken guard — the assertion must reflect the current build only.
- Assert an **observable outcome** (directory exists), not exit code alone: both 2026-08-24 failures occurred in builds whose compile step succeeded.
- Unset the simulated variable immediately after the run. A lingering `VERCEL=1` in your shell or `.env` poisons every later local build and any local `docker build`.
- This discipline exists because **new pipelines have zero soak time**: both real failures surfaced on the very first execution of their pipeline (first-ever Vercel deploy; first-ever PR CI run). The simulation is your only pre-push rehearsal.

## Step 4: Pin environment-sensitive defaults in CI steps explicitly

[File: `.github/workflows/ci.yml`]

```yaml
      - uses: actions/upload-artifact@v4
        with:
          name: nextjs-build
          path: .next/
          if-no-files-found: error
          include-hidden-files: true   # obrigatório: .next/ é dot-dir; v4.4+ exclui ocultos por padrão
```

Key points:
- Any artifact path that **is or contains a dot-prefixed entry** (`.next/`, `.github/`, `.turbo/`) requires `include-hidden-files: true` since upload-artifact v4.4.0 (breaking change; ref actions/upload-artifact#717).
- Pair it with `if-no-files-found: error` so an empty glob fails loudly instead of silently uploading nothing — this flag is what converted a silent misconfiguration into a diagnosable error.
- On any action version bump, read the changelog for **default-behavior changes**, not just new features. Defaults are the invisible half of your pipeline contract.

## Step 5: Document each divergent knob with reason + upstream ref + re-evaluation condition

[File: `docs/02-architecture/deployment.md`]

For every guard or pinned flag, add a note containing: (a) why it exists, (b) the upstream reference (issue/PR number), (c) the condition under which it can be removed. Example (§5.1): the standalone prerequisite note names vercel/next.js#96646 as root cause and PR #97287 (merged, pending stable release) as the removal trigger. Sync the same change into the Execution Log of the active sprint plan.

## Project-Specific Constraints

- [ ] One `next.config.ts` for all targets — divergence via marker-env guards only; never split config files per target.
- [ ] Env-conditionals are written as **post-object `if` mutations**; inline ternaries returning `undefined` violate `exactOptionalPropertyTypes` and do not compile.
- [ ] Guard only on canonical platform markers (`VERCEL`); absence means Docker/CI behavior.
- [ ] Before pushing any config change: clean-build **both branches** of every conditional and assert observable outcomes (`.next/standalone` presence).
- [ ] `upload-artifact@v4` paths containing dot-dirs MUST set `include-hidden-files: true`; keep `if-no-files-found: error` on every upload.
- [ ] Every guard/pinned flag documented in `deployment.md` (§5.1 config, §6.1 pipeline) with upstream reference and removal condition, synced in the same commit.
- [ ] `serverExternalPackages: ["@prisma/client"]` stays — the standalone trace relies on Prisma being external; the runner copies no full `node_modules`.
- [ ] The `nextjs-build` artifact is informational; `deploy-staging` builds remotely via `amondnet/vercel-action` — never couple deploy correctness to the artifact.

## Anti-Patterns (What NOT to Do)

- ❌ `output: process.env.VERCEL ? undefined : "standalone"` — fails under `exactOptionalPropertyTypes`; use the guarded mutation.
- ❌ Swallowing the standalone ENOENT to force green builds — yields a broken `.next/standalone` (~48% of files missing) that explodes later in Docker.
- ❌ Treating a green local `bun run build` as proof for Vercel/Docker/CI — none of the three target environments matches local dev.
- ❌ Uploading dot-prefixed paths without `include-hidden-files: true` — empty glob since v4.4.0.
- ❌ Removing the `VERCEL` guard because PR #97287 merged upstream — wait until it ships in a stable `next` release actually upgraded in `package.json`, then re-simulate both branches.
- ❌ Leaving `VERCEL=1` (or any simulated marker) exported in your shell, `.env`, or compose files — it silently flips every subsequent build onto the wrong branch.
- ❌ `if-no-files-found: warn`/`ignore` on artifact uploads — silent empty uploads defeat the purpose of the artifact.

## Related Docs

- Solutions: `docs/solutions/ci-cd/vercel-build-nft-enoent.md`, `docs/solutions/ci-cd/artifact-upload-dot-dirs.md`
- `docs/02-architecture/deployment.md` §5.1 (standalone prerequisite note) and §6.1 (pipeline snippet)
- `docs/plans/20260812203642-sprint-0-completion-plan.md` — Execution Log entries 2026-08-24
- Upstream: vercel/next.js#96646 · vercel/next.js#97287 · actions/upload-artifact#717

## Safe Change Checklist for Future AI Work

1. Classify the change against the marker table (Step 1): which targets see different behavior?
2. Edit `next.config.ts` with post-object `if` mutations; immediately run `bun run type-check` + `bun run lint`.
3. Simulate before push: clean `.next`, build with `VERCEL=1` → assert no `.next/standalone`; clean again, plain build → assert `.next/standalone` exists; unset the marker right after. Run `docker build` if the Dockerfile changed.
4. If a CI step changed: validate YAML parses with resolved inputs; confirm every dot-dir path sets `include-hidden-files: true`; check the action's changelog for default changes at the pinned version.
5. Sync documentation in the same commit: `deployment.md` §5.1/§6.1 notes + sprint plan Execution Log; final validation is observing the real target pipeline's first run.

## Refresh Notes

- **2026-08-24:** Pattern established from two unplanned fixes recorded in the sprint-0 completion plan Execution Log. Re-evaluate the `VERCEL` guard when vercel/next.js#97287 reaches a stable tracked release.
