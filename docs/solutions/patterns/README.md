# Documentation Maintenance — Pattern Registry

> **Date**: 2026-09-10
> **Session**: Documentation refresh to align pattern registry with current state

## Context

This refresh ensures the pattern registry reflects all documented solutions in `docs/solutions/`. Pattern status is categorized as:
- **Current** — implemented and actively used
- **Pending** — documented but not yet implemented
- **Resolved** — problem pattern solved, now stable

## Documentation Created

### Security Patterns

1. **`docs/solutions/patterns/security/soft-delete-gdpr-window.md`** (2026-09-05)
   - Soft-delete with 30-day restoration window for GDPR/LGPD compliance
   - Key pattern: `isActive = true AND deletedAt IS NULL` filtering
   - Migration sequence for nullable → NOT NULL columns
   - **Implemented**: T15 (atomic soft-delete), T16 (hard-delete job), T17 (restore endpoint)

2. **`docs/solutions/patterns/security/providerid-normalization-convention.md`**
   - Provider-specific normalization: EMAIL → lowercase email, OAuth → subject ID
   - Aligns with `email @unique` constraint
   - Uses `@@unique([provider, providerId])` composite constraint

3. **`docs/solutions/patterns/security/auth-uniform-response-timing-equalization.md`**
   - Uniform-200 is not enough for anti-enumeration — response timing is a second channel
   - Timing floor (jittered 240–400ms via `equalizeNoopTiming()`) applied unconditionally on both success and no-op branches (centralized in `src/app/api/v1/auth/_helpers.ts` since the 2026-09-18 auth remediation)
   - Used in magic-link, forgot-password, verify-email/resend, account, restore-account, and login's user-not-found branch; test asserts `>= 240ms`
   - Rate limit (RNF-AUTH-004, 1/min) is separate and implemented in T27 — do not conflate
   - **Implemented**: T9, T11, T30, T15 (all four auth endpoints)

4. **`docs/solutions/patterns/security/atomic-account-lifecycle-invalidation.md`** (2026-09-05, T15)
   - Credential invalidation + account state change must be ONE `prisma.$transaction` (session revoke + `isActive`/`deletedAt` + single `tokenVersion` bump), Redis mirror best-effort after commit
   - Implemented: `softDeleteAccount`/`revokeAllSessions` in `src/services/token-service.ts`
   - Anti-enumeration no-op must equalize body + `cache-control: no-store` header + jittered 240–400ms floor (headers are a 3rd channel)
   - Route calls ONE service function; never chain `user.update` + `bumpTokenVersion` + `revokeAllSessions` in a route

### Backend Patterns

5. **`docs/solutions/patterns/backend/health-check-envelope.md`** (2026-08-11, established)
   - Base health check envelope with derived status, neutral optional services, time-boxed DB check
   - Per-service checks (database, redis, future AI), status derived from aggregate
   - **Implemented**: `GET /api/health` with Redis as optional service
   - Logging migrated to Pino via `@/lib/logger` with `[health]` prefix

6. **`docs/solutions/patterns/backend/admin-health-rich-metadata.md`** (Pending)
   - Rich metadata variant of health envelope for admin dashboards
   - Per-service metrics: latency, connection pool, SSL expiry, memory usage
   - Distinguishes `/api/health` (simple) vs `/admin/system/health` (rich)
   - **Status**: Documented pattern, not yet implemented

### Observability Patterns

7. **`docs/solutions/patterns/observability/logger-migration-stopgap.md`**
   - Two-phase migration: console.error stopgap → Pino
   - Migration checklist and examples
   - Aligns with observability.md §2.1
   - **Status**: Phase 2 landed for health-check surface (Pino logging via `@/lib/logger`), remaining stopgap in `src/auth/auth.config.ts:88` deferred

### CI/CD Patterns

8. **`docs/solutions/patterns/ci-cd/multi-target-build-simulation.md`** (2026-08-24)
   - Single `next.config.ts` serving three targets (Vercel, Docker, CI) via `VERCEL=1` marker
   - Post-object mutation pattern, never inline ternary
   - Local simulation before push (assert `.next/standalone` presence)
   - `upload-artifact@v4` requires `include-hidden-files: true` for dot-dirs
   - **Status**: Current and actively used

9. **`docs/solutions/ci-cd/artifact-upload-dot-dirs.md`** (2026-08-24, Resolved)
   - Fix for `upload-artifact@v4.4.0` breaking change — dot-dirs excluded by default
   - Requires `include-hidden-files: true` for `.next/`, `.github/`, `.turbo/`
   - **Status**: Solved, historical reference for future dot-dir uploads

10. **`docs/solutions/ci-cd/vercel-build-nft-enoent.md`** (2026-08-24, Resolved)
    - Fix for Vercel build failing with ENOENT when adapter active + standalone enabled
    - `VERCEL=1` guard prevents standalone emission in Vercel builds
    - Removal condition: vercel/next.js#97287 reaches stable tracked release
    - **Status**: Solved with documented re-evaluation condition

### Operations Patterns

11. **`docs/solutions/operations/health-endpoint-contract.md`** (2026-08-11, Resolved)
    - Problem/solution for health endpoint contract violation
    - Fix: derived status, time-boxed DB check, APP_VERSION from `src/lib/version.ts`, Pino logging
    - **Status**: Fully resolved, Redis as optional service, Pino logging active

## Pattern Coverage

| Pattern Category | Files Created | Status |
|------------------|--------------|--------|
| Security | 4 | 3 Current, 1 Pending (account lifecycle) |
| Backend | 2 | 1 Current, 1 Pending (admin health) |
| Observability | 1 | 1 Current (partially) |
| CI/CD | 3 | 1 Current, 2 Resolved |
| Operations | 1 | 1 Resolved |
| **Total** | **11** | **6 Current, 2 Pending, 3 Resolved** |

## Related Changes

### Schema Changes

- `prisma/schema.prisma`: Added `deletedAt DateTime?` to User model
- `prisma/schema.prisma`: Updated header with providerId and soft-delete conventions

### Documentation Updates

- `docs/08-sprints/sprint-0.clarifications.md`: Documented H-2 and H-3 resolutions
- `docs/03-database/entities.md`: Added deletedAt field and providerId convention
- `docs/04-api/authentication.md`: Added providerId normalization and LGPD soft-delete semantics
- `docs/07-security/permissions.md`: Added providerId convention note
- `docs/02-architecture/architecture.md`: Added versioned routes annotation
- `docs/04-api/admin.md`: Clarified admin health contract
- `docs/00-overview/roadmap.md`: Added concrete calendar dates

## Pattern Reuse

These patterns should be referenced in:
- `docs/01-product/requirements.md` (RNF-005, RNF-006, LGPD)
- `docs/02-architecture/architecture.md` (auth, security, observability sections)
- `docs/07-security/permissions.md` (RBAC with soft-delete aware queries)
- `docs/08-sprints/sprint-1.md` (auth implementation tasks)

## Verification

- ✅ TypeScript validation passed (0 errors)
- ✅ Lint passed (0 errors)
- ✅ All commits successful
- ✅ Pattern files created with complete documentation

## Next Steps

1. **Run `/pwf-doc update`** to propagate learned patterns to stale docs
2. **Integrate patterns into Sprint 1 auth implementation**:
   - Use providerId normalization convention
   - Implement soft-delete for account deletion
   - Use admin health pattern for admin endpoints
 3. **Document ADR-005 migration path** for versioned routes

## Sources

- `docs/08-sprints/sprint-0.clarifications.md` (H-2 and H-3 resolutions)
- `docs/07-security/permissions.md` (RBAC with plan dimension)
- `docs/04-api/authentication.md` (auth providerId convention)
- `docs/solutions/patterns/backend/health-check-envelope.md` (base envelope pattern)
- `docs/02-architecture/observability.md` (Pino logger specification)
- `docs/07-security/lgpd.md` (GDPR/LGPD compliance)
