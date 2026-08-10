# Arkana Agora — Documentation

Operational memory for the project. Read before implementing features, fixing bugs, or changing infrastructure.

## Core source-of-truth docs

- [Infrastructure](infrastructure.md) — providers, topology, deployment model.
- [Architecture](architecture.md) — system overview, stack, module interaction map.
- [Integrations](integrations.md) — external systems and contract references.
- [Environments](environments.md) — environment matrix and deployment context.
- [Glossary](glossary.md) — canonical domain and technical terminology.

## Workflow structure

- [Workflow overrides](workflow/operational-overrides.md) — project-level policy overrides.
- [Runbooks](runbooks/README.md) — operational runbook catalog.
- `brainstorms/` — feature discovery notes.
- `plans/` — execution-ready plans.
- `work-plans/` — phased work plans and execution logs.
- `solutions/` — resolved problems and reusable patterns (`solutions/patterns/`).
- `modules/` — backend module documentation (`modules/README.md`).
- `features/` — frontend feature documentation (`features/README.md`).
- `lambdas/` — Lambda repo documentation (`lambdas/README.md`).
- `decisions/` — ADRs and decision records (`decisions/README.md`).

## Existing knowledge base sections

- `00-overview/` — vision, personas, roadmap, glossary.
- `01-product/` — product requirements.
- `02-architecture/` — deep architecture, decisions, deployment, observability.
- `03-database/` — data model documentation.
- `04-api/` — API contracts.
- `05-ai/` — AI feature documentation.
- `06-features/` — product feature details.
- `07-security/` — security model.
- `08-sprints/` — sprint history.