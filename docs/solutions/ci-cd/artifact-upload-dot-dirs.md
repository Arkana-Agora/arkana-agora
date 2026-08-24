# upload-artifact@v4 Reports "No files were found" for Dot-Directories (`.next/`)

> **Category**: ci-cd · **Date**: 2026-08-24 · **Status**: solved

## Problem

First-ever GitHub Actions run on a PR (#135) failed in job `build` at the artifact upload step, despite `bun run build` completing successfully seconds earlier (route table printed).

## Symptoms

```
##[group]Run actions/upload-artifact@v4
  with:
    name: nextjs-build
    path: .next/
    if-no-files-found: error
    include-hidden-files: false      ← default
##[error]No files were found with the provided path: .next/. No artifacts will be uploaded.
```

## Root Cause

Breaking change in `actions/upload-artifact` **v4.4.0** (Aug/2024): dot-prefixed files and directories are **excluded by default** (`include-hidden-files: false`) to avoid accidentally uploading sensitive data like `.git`. Since `.next/` is a hidden directory, the glob matches zero files, and `if-no-files-found: error` turns the empty match into a hard failure. Reference: [actions/upload-artifact#717](https://github.com/actions/upload-artifact/issues/717).

Not a regression from our side — the workflow simply had never executed before (first real CI run), exposing a latent misconfiguration.

## Fix

`.github/workflows/ci.yml`, build job upload step:

```yaml
      - uses: actions/upload-artifact@v4
        with:
          name: nextjs-build
          path: .next/
          if-no-files-found: error
          include-hidden-files: true   # obrigatório: .next/ é dot-dir; v4.4+ exclui ocultos por padrão
```

## Verification

Local YAML parse with resolved inputs (node + `yaml` pkg):

```json
{"name":"nextjs-build","path":".next/","if-no-files-found":"error","include-hidden-files":true}
```

Final proof = re-run of PR #135 going green (Actions cannot run locally).

## Prevention & Gotchas

- Any artifact path that is or contains a dot-prefixed entry (`.next/`, `.github/`, `.turbo/`) needs `include-hidden-files: true`.
- Keep `if-no-files-found: error` — it converted a silent misconfiguration into a diagnosable failure.
- On any action version bump, read the changelog for **default-behavior changes**, not just new features.
- Note: the `nextjs-build` artifact is informational — `deploy-staging` builds remotely via `amondnet/vercel-action` and never downloads it.
- Informational follow-up: runner used bun 1.4.0 (setup-bun fetches latest) vs 1.3.x local/Vercel — consider pinning `bun-version` later.

## References

- Commits `4d737ea` (fix), `2d18975` (docs)
- Execution Log: `docs/plans/20260812203642-sprint-0-completion-plan.md` (2026-08-24, second entry)
- Pattern: `patterns/ci-cd/multi-target-build-simulation.md`
