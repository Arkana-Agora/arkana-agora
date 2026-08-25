# Runbooks

Operational runbooks catalog for Arkana Agora.

## Runbook index

| Runbook | Operation | Owner | Updated |
|---|---|---|---|
| `vercel-deploy-auth-url.md` | Deploy staging Vercel - Missing AUTH_URL | DevOps | 2026-08-24 |
| `vercel-deploy-github-token.md` | Deploy staging Vercel - Missing GitHub Token | DevOps | 2026-08-24 |
| `vercel-deploy-project-settings.md` | Deploy staging Vercel - "Could not retrieve Project Settings" | DevOps | 2026-08-24 |
| `vercel-build-nft-enoent.md` | Deploy staging Vercel - "ENOENT .next/next-server.js.nft.json" (standalone + adapter) | DevOPS | 2026-08-24 |

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