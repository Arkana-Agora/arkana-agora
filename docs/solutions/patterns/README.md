# Documentation Maintenance — Pattern Registry

> **Date**: 2026-09-10 | **Updated**: 2026-09-24
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
    - Used in magic-link, forgot-password, verify-email/resend, account, restore-account, register duplicate-email, and login's user-not-found branch; test asserts `>= 240ms`
   - Rate limit (RNF-AUTH-004, 1/min) is separate and implemented in T27 — do not conflate
    - **Implemented**: magic-link (T9), forgot-password (T11), verify-email/resend (T30), account (T15), restore-account (T17), register duplicate branch (T6), login user-not-found (T7)

4. **`docs/solutions/patterns/security/atomic-account-lifecycle-invalidation.md`** (2026-09-05, T15)
   - Credential invalidation + account state change must be ONE `prisma.$transaction` (session revoke + `isActive`/`deletedAt` + single `tokenVersion` bump), Redis mirror best-effort after commit
   - Implemented: `softDeleteAccount`/`revokeAllSessions` in `src/services/token-service.ts`
   - Anti-enumeration no-op must equalize body + `cache-control: no-store` header + jittered 240–400ms floor (headers are a 3rd channel)
   - Route calls ONE service function; never chain `user.update` + `bumpTokenVersion` + `revokeAllSessions` in a route

5. **`docs/solutions/patterns/security/rate-limit-before-user-lookup.md`** (2026-09-24, Current)
   - Anti-enumeration ordering: check **and record** IP + per-email quota **before** `prisma.user.findFirst`, never in a success-only branch — otherwise the 429 itself reveals which emails exist
   - Fixed order: validate body → IP check → record IP → email check → record email → lookup → uniform response; identical 429 code for both dimensions
   - **Implemented**: magic-link, forgot-password, verify-email/resend, register; `src/lib/rate-limit.ts`; tests `tests/verify-email.test.ts`, `tests/forgot-password.test.ts`, `tests/rate-limit.test.ts`

6. **`docs/solutions/patterns/security/validate-callback-url-single-source.md`** (2026-09-24, Current)
   - Single pure `isSafeCallbackPath()` (leading `/` → `decodeURIComponent` malformed→reject → WHATWG `new URL(decoded, base).origin` equality) shared by hook, `AuthSessionBridge`, `consumeStoredCallbackUrl`, `LoginForm`, Google `signIn`
   - Bypass-matrix test suite (29 cases) + stash lifecycle: bridge clears stale/unsafe stash when the param is absent
   - **Implemented**: `src/hooks/use-safe-callback-url.ts`, `tests/safe-callback-url.test.ts`, `tests/login-form.test.tsx`


7. **`docs/solutions/patterns/backend/health-check-envelope.md`** (2026-08-11, established)
   - Base health check envelope with derived status, neutral optional services, time-boxed DB check
   - Per-service checks (database, redis, future AI), status derived from aggregate
   - **Implemented**: `GET /api/health` with Redis as optional service
   - Logging migrated to Pino via `@/lib/logger` with `[health]` prefix

8. **`docs/solutions/patterns/backend/admin-health-rich-metadata.md`** (Pending)
   - Rich metadata variant of health envelope for admin dashboards
   - Per-service metrics: latency, connection pool, SSL expiry, memory usage
   - Distinguishes `/api/health` (simple) vs `/admin/system/health` (rich)
   - **Status**: Documented pattern, not yet implemented

### Observability Patterns

9. **`docs/solutions/patterns/observability/logger-migration-stopgap.md`**
   - Two-phase migration: console.error stopgap → Pino
   - Migration checklist and examples
   - Aligns with observability.md §2.1
   - **Status**: Phase 2 landed for health-check surface (Pino logging via `@/lib/logger`), remaining stopgap in `src/auth/auth.config.ts` (EmailProvider `sendVerificationRequest`) deferred

10. **`docs/solutions/patterns/observability/gate-third-party-analytics-sdk-init.md`** (2026-09-24, Current)
   - Third-party analytics SDK (PostHog): early-return `NODE_ENV === "development"` inside `initAnalytics()` + pin remote-config-toggleable loaders (`disable_session_recording: true`, `capture_dead_clicks: false`, `autocapture: false`)
   - Consent gate (`analytics-consent`) checked **inside** `initAnalytics()` and at every capture site; revoke runs `resetUser()` (`posthog.reset()`) then re-asserts `posthog.opt_out_capturing()` (LGPD — orthogonal and mandatory)
   - **Implemented**: `src/lib/analytics.ts`, `tests/analytics.test.ts` (11 tests)

### CI/CD Patterns

11. **`docs/solutions/patterns/ci-cd/multi-target-build-simulation.md`** (2026-08-24)
   - Single `next.config.ts` serving three targets (Vercel, Docker, CI) via `VERCEL=1` marker
   - Post-object mutation pattern, never inline ternary
   - Local simulation before push (assert `.next/standalone` presence)
   - `upload-artifact@v4` requires `include-hidden-files: true` for dot-dirs
   - **Status**: Current and actively used

12. **`docs/solutions/ci-cd/artifact-upload-dot-dirs.md`** (2026-08-24, Resolved)
   - Fix for `upload-artifact@v4.4.0` breaking change — dot-dirs excluded by default
   - Requires `include-hidden-files: true` for `.next/`, `.github/`, `.turbo/`
   - **Status**: Solved, historical reference for future dot-dir uploads

13. **`docs/solutions/ci-cd/vercel-build-nft-enoent.md`** (2026-08-24, Resolved)
    - Fix for Vercel build failing with ENOENT when adapter active + standalone enabled
    - `VERCEL=1` guard prevents standalone emission in Vercel builds
    - Removal condition: vercel/next.js#97287 reaches stable tracked release
    - **Status**: Solved with documented re-evaluation condition

### Operations Patterns

14. **`docs/solutions/operations/health-endpoint-contract.md`** (2026-08-11, Resolved)
    - Problem/solution for health endpoint contract violation
    - Fix: derived status, time-boxed DB check, APP_VERSION from `src/lib/version.ts`, Pino logging
    - **Status**: Fully resolved, Redis as optional service, Pino logging active

15. **`docs/solutions/ci-cd/prisma-v8-cli-regression.md`** (2026-09-23, Resolved)
    - `prisma@8` RC CLI removes `generate`/`migrate` → `npm run build` fails `CLI.UNKNOWN_COMMAND`; leftover Windows `node_modules/.bin/prisma.exe` can keep pointing at missing `dist/prisma.js`
    - Fix: pin `prisma@^7`, delete corrupt shims, keep pooled `DATABASE_URL` vs direct `DIRECT_URL` split for Prisma Postgres
    - **Status**: Solved; pin must stay until v8 restores classic verbs (or Platform-only migration)

16. **`docs/solutions/ci-cd/turbopack-postcss-oom.md`** (2026-09-23, Resolved)
    - Intermittent `Zone Allocation failed - process out of memory` / exit 134 + IPC `os error 10054` on `globals.css` (PostCSS worker) under low free RAM
    - Fix: `node --max-old-space-size=4096` on `build` script; free RAM >1 GB before local builds; distinct from production `AUTH_URL` runtime guard
    - **Status**: Solved for local; remove flag only after Turbopack PostCSS zone OOM is stable upstream

### Auth Patterns

17. **`docs/solutions/patterns/auth/set-csrf-cookie-client-side.md`** (2026-09-23, Current)
    - Never `cookies().set()` in Next 16 Server Components — cookie must be set client-side via `ensureCsrfCookie()` (`src/lib/csrf-client.ts`) from the `auth-store` immediately before POST (store-authoritative; form mount `useEffect` warm-up removed)
    - Double-submit: cookie `csrf-token`/`__Host-csrf-token` vs header `x-csrf-token`; 403 `CSRF_TOKEN_INVALID`
    - **Implemented**: plain `login`/`register` pages (no RSC cookie writes) + store-authoritative `ensureCsrfCookie()`; shared `src/lib/csrf-cookie-name.ts`; round-trip test `tests/csrf-client.test.ts` (6 tests)

18. **`docs/solutions/patterns/auth/single-flight-token-refresh.md`** (2026-09-24, Current)
    - Single shared client module for 401-triggered refresh **and** session access-token lookup: concurrent refreshes coalesce into one `POST /api/v1/auth/refresh`; 401 retry sets `_retry` so `getSession()` cannot overwrite a just-refreshed token
    - Access-token TTL cache 60s; `network_error`/`server_error` keep the logged-in user; logout clears token+session caches
    - **Implemented**: `src/lib/auth-refresh.ts`, `src/lib/api.ts`, `src/stores/auth-store.ts`; tests `tests/auth-refresh.test.ts` (12), `tests/api.test.ts`, `tests/auth-store.test.ts` (81)

## Pattern Coverage

| Pattern Category | Files Created | Status |
|------------------|--------------|--------|
| Security | 6 | 5 Current, 1 Pending (account lifecycle) |
| Backend | 2 | 1 Current, 1 Pending (admin health) |
| Observability | 2 | 2 Current |
| CI/CD | 5 | 1 Current, 4 Resolved |
| Operations | 1 | 1 Resolved |
| Auth | 2 | 2 Current |
| **Calculation/Determinism** | **2** | **2 Current** |
| **Total** | **20** | **13 Current, 2 Pending, 5 Resolved** |

## Related Changes

### Schema Changes

- `prisma/schema.prisma`: Added `deletedAt DateTime?` to User model
- `prisma/schema.prisma`: Updated header with providerId and soft-delete conventions

### Documentation Updates

- `docs/08-sprints/sprint-0.clarifications.md`: Documented H-2 and H-3 resolutions
- `docs/07-security/permissions.md`: Added providerId convention note
- `docs/04-api/authentication.md`: Added providerId normalization and LGPD soft-delete semantics
- `docs/02-architecture/architecture.md`: Added versioned routes annotation
- `docs/04-api/admin.md`: Clarified admin health contract
- `docs/00-overview/roadmap.md`: Added concrete calendar dates

### New Patterns (2026-09-25)

19. **`docs/solutions/patterns/calculation/tz-determinism-utc-tests.md`** (2026-09-25, Current)
    - **Problem**: Cálculos de data (arcano pessoal, signo zodiacal, kin maya) divergiam entre dev (BRT, UTC-3) e prod (UTC) quando usavam getters locais (`getFullYear`/`getMonth`/`getDate`). Um usuário nascido perto da meia-noite tinha arcano persistido diferente do recalculado em outro ambiente.
    - **Solution**: Todas as funções de cálculo (`calculateArcanaByDate`, `calculatePersonalArcana`, `calculateZodiacSign`, `calculateKinMaya`) usam **getters UTC** (`getUTCFullYear`/`getUTCMonth`/`getUTCDate`). Testes forçam `process.env.TZ = "UTC"` no setup global (`vitest.setup.ts`) para garantir determinismo cross-env.
    - **Implementation**: `src/lib/arcana/calculate.ts`, `src/lib/calculations/zodiac.ts`, `src/lib/calculations/kin-maya.ts`; `tests/arcana.test.ts` (100+ cases), `vitest.setup.ts` exporta `process.env.TZ = "UTC"`.
    - **Key invariant**: O mesmo `birthDate` (ISO string) **sempre** produz o mesmo resultado numérico, independente do TZ do runtime.

20. **`docs/solutions/patterns/calculation/derived-field-invalidation.md`** (2026-09-25, Current)
    - **Problem**: Campos derivados (`personalArcana`, `astrologicalSign`, `mayanKin`) calculados a partir de `birthDate` + `name` podem ficar stale quando as fontes mudam (ex.: OAuth enriquece `name`; usuário limpa `birthDate`; recálculo falha por `name` vazio). Não há trigger de DB — a invalidação é lógica de aplicação.
    - **Solution**: Padrão de **invalidação condicional explícita** em três pontos:
      1. **PATCH `/me/profile`** (source-of-truth write): recalcula `personalArcana` via `calculatePersonalArcana(bd, currentUser.name)` dentro da transação; se retorna `null` (nome vazio) → **null-out explícito** (`personalArcana: null`); `birthDate: ""` → reset completo (zera todos os derivados).
      2. **GET `/arcana/calculate`** (read-path self-heal): serve cache canônico mas executa CAS `updateMany({ where: { id, personalArcana: observed }, data: { personalArcana: recomputed } })` para curar stale cache no read.
      3. **Enrichment OAuth** (`events.signIn` + `enrichment-service`): invalida `personalArcana` **apenas quando** nome do Google muda **E** `birthDate` presente no usuário. Se não há `birthDate`, não há base para recalcular → não toca no arcano.
    - **Implementation**: `src/app/api/v1/users/me/profile/route.ts`, `src/app/api/v1/arcana/calculate/route.ts`, `src/services/enrichment-service.ts`, `src/auth/auth.config.ts` (`events.signIn`).
    - **Key invariant**: Campo derivado **nunca** fica stale silenciosamente — ou é recalculado no write, ou curado no read (CAS), ou invalidado condicionalmente no enrichment. Null-out explícito evita "arcano fantasma" quando a fonte (`name`) desaparece.

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
