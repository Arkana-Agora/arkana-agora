# Auth Module Audit Gaps — Phase 0

**Date**: 2026-09-21
**Auditor**: AI Agent (T001-T005)

---

## T001: Endpoint Audit vs SPEC-001

### ✅ Compliant (12/12 endpoints)

| Endpoint | Status | Notes |
|----------|--------|-------|
| POST /register | ✅ | Zod, bcrypt 12, CSRF, rate limit (3/IP/h), anti-enum |
| POST /login | ✅ | Zod, bcrypt, CSRF, rate limit (5/15min, ADMIN 20), lockout (5 failures), anti-enum |
| POST /refresh | ✅ | Rotation, reuse detection, family revocation, Auth.js bridge |
| POST /logout | ✅ | Single + allDevices, cookie cleanup, Auth.js bridge |
| POST /magic-link | ✅ | Rate limit (3/h email + IP), anti-enum, 15min token |
| POST /magic-link/verify | ✅ | Single-use, 15min, LGPD check, Auth.js bridge |
| POST /forgot-password | ✅ | Rate limit (3/h), anti-enum, timing floor, 1h token |
| POST /reset-password | ✅ | Single-use, bcrypt 12, revokeAllSessions BEFORE write, 410 expired |
| POST /verify-email | ✅ | Single-use, 24h, LGPD check, tokenVersion bump |
| POST /verify-email/resend | ✅ | Rate limit (1/min), anti-enum, equalize timing |
| DELETE /account | ✅ | Soft delete, email confirmation, anti-enum, LGPD window |
| POST /restore-account | ✅ | Rate limit, anti-enum, timing floor |

### ✅ Token Service (T002)

| Check | Status | Evidence |
|-------|--------|----------|
| RS256 signing | ✅ | `token-service.ts:85` — `alg: "RS256"` |
| Access token 15min | ✅ | `token-service.ts:26-30` — configurable, default 900s |
| Refresh token 30d | ✅ | `token-service.ts:31-35` — configurable, default 30 days |
| SHA-256 hash | ✅ | `token-service.ts:243` — `sha256(rawToken)` |
| familyId tracking | ✅ | `token-service.ts:244` — `randomUUID()` per session |
| Reuse detection | ✅ | `token-service.ts:301-309` — checks `replacedByTokenId` BEFORE `revokedAt` |
| Family revocation | ✅ | `token-service.ts:265-270` — `updateMany` on `familyId` |
| Redis mirror | ✅ | `token-service.ts:414-436` — mirrors tokenVersion with TTL |
| DB fallback | ✅ | `token-service.ts:148-150` — falls back to DB when Redis unavailable |
| isActive/deletedAt check | ✅ | `token-service.ts:195-201` — checked on every token verification |

### ✅ Rate Limiting (T003)

| Limit | Spec | Code | Match |
|-------|------|------|-------|
| Login failures | 5/15min | `MAX_CONSECUTIVE_FAILURES=5` | ✅ |
| Login IP (USER) | 5/15min | `MAX_IP_ATTEMPTS=5` | ✅ |
| Login IP (ADMIN) | 20/15min | `MAX_IP_ATTEMPTS_ADMIN=20` | ✅ |
| Register IP | 3/h | `MAX_REGISTER_IP_ATTEMPTS=3` | ✅ |
| Register email | 3/h | `MAX_REGISTER_PER_EMAIL=3` | ✅ |
| Magic link email | 3/h | `MAX_MAGIC_LINK_PER_EMAIL=3` | ✅ |
| Magic link IP | 3/h | `MAX_MAGIC_LINK_IP_ATTEMPTS=3` | ✅ |
| Password reset | 3/h | `MAX_PASSWORD_RESET_PER_EMAIL=3` | ✅ |
| Verify resend | 1/min | `MAX_VERIFY_EMAIL_RESEND_PER_EMAIL=1` | ✅ |

### ⚠️ Known Limitations

| Issue | Severity | Status |
|-------|----------|--------|
| In-memory rate limiter (not Redis) | MEDIUM | Known — `TODO(T25)` in code; acceptable for single-process dev |
| No edge middleware for token validation | MEDIUM | Spec tasks #30-34 exist; code validates at endpoint level |
| No security headers middleware | LOW | Headers set per-response; no global middleware |

---

## Remaining Security Hardening (T005)

| Item | Status | Action Needed |
|------|--------|---------------|
| PII fields identified | ✅ | email, birthDate, name — all in User model |
| LGPD deletion cascades | ✅ | `hard-delete-accounts.ts:114-118` — deletes sessions, userProfile, subscription, verificationTokens |
| Error sanitization | ✅ | All 500 responses return generic "Erro interno" — no stack traces |
| CSRF double-submit | ✅ | `csrf.ts` validates cookie == header |
| Anti-enumeration | ✅ | All sensitive endpoints return uniform responses |
| Timing equalization | ✅ | `equalizeNoopTiming()` with jitter (240-400ms) |
| Single-use tokens | ✅ | `deleteMany` with count check on all token types |
| LGPD window | ✅ | 30-day soft delete + hard delete job |
| Cache-Control: no-store | ✅ | Set on all auth responses |
| Auth.js session bridge | ✅ | ADR-011 compliant |

**No code changes required for Phase 0.** All endpoints are spec-compliant.
