# Documentation Maintenance — Pattern Registry

> **Date**: 2026-08-11
> **Session**: Unplanned work to fix critical issues and document reusable patterns

## Context

This session addressed and documented multiple cross-cutting concerns:
- GDPR/LGPD soft-delete implementation
- Auth provider ID normalization conventions
- Admin health endpoint rich metadata variant
- Logger migration pattern (console.error → Pino)

## Documentation Created

### Security Patterns

1. **`docs/solutions/patterns/security/soft-delete-gdpr-window.md`**
   - Soft-delete with 30-day restoration window for GDPR/LGPD compliance
   - Key pattern: `isActive = true AND deletedAt IS NULL` filtering
   - Migration sequence for nullable → NOT NULL columns

2. **`docs/solutions/patterns/security/providerid-normalization-convention.md`**
   - Provider-specific normalization: EMAIL → lowercase email, OAuth → subject ID
   - Aligns with `email @unique` constraint
   - Uses `@@unique([provider, providerId])` composite constraint

### Backend Patterns

3. **`docs/solutions/patterns/backend/admin-health-rich-metadata.md`**
   - Rich metadata variant of health envelope for admin dashboards
   - Per-service metrics: latency, connection pool, SSL expiry, memory usage
   - Distinguishes `/api/health` (simple) vs `/admin/system/health` (rich)

### Observability Patterns

4. **`docs/solutions/patterns/observability/logger-migration-stopgap.md`**
   - Two-phase migration: console.error stopgap → Pino
   - Migration checklist and examples
   - Aligns with observability.md §2.1

### Security Patterns (3)

5. **`docs/solutions/patterns/security/auth-uniform-response-timing-equalization.md`**
   - Uniform-200 is not enough for anti-enumeration — response timing is a second channel
   - Timing floor (`NOOP_EQUALIZE_MS = 250`) on the no-op branch via `equalizeNoopTiming()`
   - Used in magic-link, forgot-password, verify-email/resend; test asserts `>= 240ms`
   - Rate limit (RNF-AUTH-004, 1/min) is separate and deferred to T27 — do not conflate

6. **`docs/solutions/patterns/security/atomic-account-lifecycle-invalidation.md`** _(2026-09-05, T15)_
   - Credential invalidation + account state change must be ONE `prisma.$transaction` (session revoke + `isActive`/`deletedAt` + single `tokenVersion` bump), Redis mirror best-effort after commit
   - Implemented: `softDeleteAccount`/`revokeAllSessions` in `src/services/token-service.ts`
   - Anti-enumeration no-op must equalize body + `cache-control: no-store` header + 250ms floor (headers are a 3rd channel)
   - Route calls ONE service function; never chain `user.update` + `bumpTokenVersion` + `revokeAllSessions` in a route

## Pattern Coverage

| Pattern Category | Files Created | Key Learnings |
|------------------|--------------|---------------|
| Security | 4 | GDPR soft-delete, providerId normalization, uniform-response timing equalization, atomic account lifecycle invalidation |
| Backend | 1 | Admin health rich metadata |
| Observability | 1 | Logger migration pattern |
| **Total** | **6** | **6 reusable patterns** |

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
