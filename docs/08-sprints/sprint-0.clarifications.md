# Clarifications — Sprint 0

## Source Plan
- `docs/08-sprints/sprint-0.md`

## Session 2025-08-11
- Q: For EMAIL provider accounts (not OAuth), what should the `providerId` field contain?
  - Recommendation: `email` (normalized lowercase, verified uniqueness in database via `email @unique` constraint)
  - Final Answer: Option A — `email` normalized to lowercase (e.g., `"maria@email.com"` → `"maria@email.com"`)
  - Impact on Plan: Updates Prisma schema `providerId` default/convention; authentication.md to document that EMAIL accounts set `providerId = email` (normalized); entities.md to reflect this convention. Aligns with existing `email @unique` constraint.

- Q: For LGPD compliance (30-day deletion window), what mechanism should we use to track and restore deleted users?
  - Recommendation: Add `deletedAt DateTime?` to User model (soft delete with `isActive = false` AND `deletedAt IS NOT NULL`)
  - Final Answer: Option A — soft delete with `deletedAt DateTime?` (existing `isActive` flag + new `deletedAt` for restoration window)
  - Impact on Plan: Adds `deletedAt DateTime?` to User model (nullable timestamp). Queries filter `isActive = true AND deletedAt IS NULL` to retrieve active users. Restoration endpoint sets `deletedAt = NULL` and `isActive = true` within 30-day window. Entities.md to document constraint.

## Coverage Summary
| Category | Status | Notes |
|----------|--------|-------|
| Functional scope and success criteria | Clear | Not applicable |
| Domain/data model and lifecycle transitions | **Resolved** | H-2 and H-3 resolved |
| UX/interaction flows | Clear | Not applicable |
| NFRs (security, performance, reliability, observability) | Clear | Not applicable |
| Integration boundaries and failure modes | Clear | Not applicable |
| Edge cases and conflict/concurrency handling | Clear | Not applicable |
| Terminology consistency | **Resolved** | Both ambiguities resolved |
| Completion signals (objective done criteria) | Clear | Not applicable |

## Deferred Items
- None — all ambiguities resolved.

## Next Steps
- Update sprint-0.md to reflect both decisions
- Implement in Sprint 1 auth implementation:
  - Prisma schema: `deletedAt DateTime?` to User model
  - Auth routes: set `providerId = email` (normalized) on EMAIL accounts
  - Restoration endpoint: within 30-day window restore via `deletedAt = NULL`
