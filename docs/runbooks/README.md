# Runbooks

Operational runbooks catalog for Arkana Agora.

## Runbook index

| Runbook | Operation | Owner | Updated |
|---|---|---|---|
| `vercel-deploy-auth-url.md` | Deploy/Vercel runtime - Missing AUTH_URL (SSR guard) | DevOps | 2026-09-23 |
| `vercel-deploy-github-token.md` | Deploy staging Vercel - Missing GitHub Token | DevOps | 2026-08-24 |
| `vercel-deploy-project-settings.md` † | Deploy staging Vercel - "Could not retrieve Project Settings" | DevOps | 2026-08-24 |
| `vercel-build-nft-enoent.md` * | Deploy staging Vercel - "ENOENT .next/next-server.js.nft.json" (standalone + adapter) | DevOps | 2026-08-24 |
| `turbopack-postcss-oom.md` * | Local build - Zone Allocation OOM / exit 134 on `globals.css` | DevOps | 2026-09-23 |
| `local-jwt-session-decryption.md` | Local runtime - JWTSessionError no matching decryption secret | Dev | 2026-09-23 |
| `jwt-public-key-missing-all-401.md` | Runtime - all API calls 401 / infinite refresh / login flicker (JWT_PUBLIC_KEY ausente) | Dev/DevOps | 2026-09-24 |

\* Pattern solution (not a full runbook): `docs/solutions/ci-cd/vercel-build-nft-enoent.md`, `docs/solutions/ci-cd/turbopack-postcss-oom.md`.
† Listed historically but the file does not exist yet (planned; never committed).

## Ownership and escalation

Define who owns each runbook, who is on-call, and the escalation path for issues.

## Required runbook template sections

Every runbook should include:

1. **Summary** — what this runbook covers.
2. **Trigger** — symptoms/conditions that indicate this runbook applies.
3. **Preconditions** — access, tools, and credentials required.
4. **Steps** — ordered recovery/operation steps with expected outcomes.
5. **Escalation** — when and who to escalate to.
6. **Post-incident** — verification, cleanup, and follow-up actions.