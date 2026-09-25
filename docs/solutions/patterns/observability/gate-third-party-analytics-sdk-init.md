---
title: "Gate Third-Party Analytics SDK Init — Project Pattern"
problem_type: pattern
category: observability
components:
  - frontend
tags:
  - patterns
  - posthog
  - third-party-sdk
  - dev-gate
  - remote-config
  - consent
  - lgpd
  - session-recording
  - dead-clicks
module: analytics
date: 2026-09-24
established_in: "Bugfix batch 3 (2026-09-24): PostHog init early-returns in development and explicitly disables remote-config-toggleable external script loaders; consent gate unchanged"
---

# Pattern: Gate Third-Party Analytics SDK Init (dev skip + explicit remote-config disables)

> **Related**: `docs/02-architecture/observability.md` §4, `docs/solutions/patterns/observability/logger-migration-stopgap.md`, `docs/infrastructure.md` (Sentry DSN gate — analogous credential gate)

## Problem

Client-side analytics SDKs (PostHog in this project) can **lazy-load external scripts** from their own domains — session recorder, dead-clicks observer (`us.i.posthog.com`). Two failure modes showed up in local dev:

1. **Console/network noise**: adblockers or network policy block those external fetches, spewing failures on every page load during `bun run dev`.
2. **Remote config override**: PostHog's *remote config* (fetched at runtime from their servers) can **re-enable features you believed were off**, silently loading external scripts again even though local defaults look correct.

You need an init path that (a) does not run at all in development, (b) pins every remote-config-toggleable loader to an explicit local value, and (c) preserves the existing LGPD consent gate untouched.

## Solution

Three **orthogonal layers** inside `initAnalytics()` in `src/lib/analytics.ts`:

1. **Guard chain** (order matters): SSR/idempotency → `NODE_ENV === "development"` early return → **consent check** (`hasConsent()`) → missing-key warn+return → `posthog.init(...)` → `initialized = true`.
2. **Explicit local disables** for anything that lazy-loads external scripts: `disable_session_recording: true`, `capture_dead_clicks: false`, `autocapture: false`, `debug: false` — set in init options so remote config cannot turn them back on.
3. **Consent also enforced at use sites**: `track*`/`setUserProperties` no-op unless `initialized && hasConsent()`; boot uses `initAnalyticsWithConsent()`; banner writes via `setAnalyticsConsent()`.

## Key Elements

### 1. Guard chain lives inside `initAnalytics()` — not at the caller

`src/lib/analytics.ts`:

```typescript
export function initAnalytics() {
  if (typeof window === "undefined" || initialized) return

  if (process.env.NODE_ENV === "development") return
  if (!hasConsent()) return

  if (!PH_API_KEY) {
    console.warn("[Analytics] PostHog key not configured")
    return
  }

  posthog.init(PH_API_KEY, {
    api_host: PH_HOST,
    debug: false,
    capture_pageview: true,
    capture_pageleave: true,
    persistence: "localStorage",
    autocapture: false,
    disable_session_recording: true,
    capture_dead_clicks: false,
  })

  initialized = true
}
```

Key points:
- Every caller is covered automatically: `providers.tsx` boot effect, `initAnalyticsWithConsent()`, `setAnalyticsConsent(true)`, tests.
- Consent is checked **inside** init (defense-in-depth) so a future direct call cannot start PostHog unconsented.
- Dev early-return leaves `initialized === false`, so `track()` double-protects.
- Dev check runs *before* the missing-key warn — dev never logs `[Analytics] PostHog key not configured`.

### 2. Pin every external-script-loading option explicitly

Any posthog-js option whose feature lazy-loads a remote script must be set **locally in `init` options**, never left to dashboard/remote-config defaults:

| Option | Value | External script it would load |
|--------|-------|-------------------------------|
| `disable_session_recording` | `true` | session recorder |
| `capture_dead_clicks` | `false` | dead-clicks observer |
| `autocapture` | `false` | (implicit DOM wiring; kept off by project policy) |
| `debug` | `false` | verbose console output masking real errors |

### 3. Consent gate stays orthogonal (LGPD)

- Storage key: `analytics-consent` (localStorage, `"true"`/`"false"` — exported as `ANALYTICS_CONSENT_STORAGE_KEY` from `src/lib/analytics.ts`; `consent-banner.tsx` imports it instead of hardcoding the string).
- Enforcement points: inside `initAnalytics()`; `track()` / `setUserProperties()`; boot via `initAnalyticsWithConsent()` in `providers.tsx`; banner UI calls `setAnalyticsConsent()` in `consent-banner.tsx`.
- Revocation (in `setAnalyticsConsent(false)`, after writing `"false"`): `resetUser()` **first** (`posthog.reset()` deletes the SDK-persisted consent key `__ph_opt_in_out_*`) → `posthog.opt_out_capturing()` **after** (re-assert; idempotent belt-and-suspenders). Reversing the order silently wipes the opt-out and the SDK keeps capturing.
- Re-grant (in `setAnalyticsConsent(true)`): `initAnalytics()` if `!initialized` → `posthog.opt_in_capturing({ captureEventName: false })` when `initialized` — clears a persisted opt-out **in place**, no reload, no `$opt_in` event; guarded by `initialized` so the dev/missing-key paths never call it.
- **`resetUser()` is consent-aware on its own** — it re-asserts `opt_out_capturing()` after `posthog.reset()` whenever `localStorage["analytics-consent"] !== "true"`. This is what makes the **logout/delete path** safe: `logout()` and `deleteAccount()` (`src/stores/auth-store.ts`) call `resetUser()` directly, never `setAnalyticsConsent()`, and without the re-assert a logout would silently re-enable auto-capture for a user who had revoked consent.
- The dev gate is **additive** — it never replaces or bypasses consent.

### 3.1 Consent-aware identity reset — the ordering contract

`src/lib/analytics.ts`:

```typescript
export function resetUser() {
  if (!initialized) return
  posthog.reset() // deletes __ph_opt_in_out_* → would re-enable capture
  if (!hasConsent()) {
    try {
      posthog.opt_out_capturing() // re-assert; SDK may be mid-init
    } catch { /* our localStorage gate still blocks track() */ }
  }
}
```

Rules that must hold:

- **`reset()` before `opt_out_capturing()`** — never the reverse.
- The check inside `resetUser()` reads **our** key (`analytics-consent`), not the SDK's; the SDK key is gone by then.
- Consent changes go only through `setAnalyticsConsent()`; identity resets on session end go only through `resetUser()` — both share the same ordering contract.
- Identity reset belongs in the logout/delete cleanup sequence: `resetAuthApiSessionCache()` + `resetUser()` + Cache Storage purge (`arkana-agora-*`).

### 4. Test recipe for env-dependent SDK init

`tests/analytics.test.ts` — module-level `initialized` flag and `PH_API_KEY` read at import time force a reset per test; `afterEach` restores `NODE_ENV`:

```typescript
afterEach(() => {
  setNodeEnv(originalEnv)
  clearMocks()
})

it("does not init PostHog in development", async () => {
  setNodeEnv("development")
  localStorage.setItem("analytics-consent", "true")
  const { initAnalytics } = await loadAnalytics()
  initAnalytics()
  expect(init).not.toHaveBeenCalled()
})

it("inits outside development with recording and dead clicks disabled", async () => {
  setNodeEnv("test")
  localStorage.setItem("analytics-consent", "true")
  const { initAnalytics } = await loadAnalytics()
  initAnalytics()
  expect(init).toHaveBeenCalledWith(
    "phc_test_token",
    expect.objectContaining({
      disable_session_recording: true,
      capture_dead_clicks: false,
      autocapture: false,
    }),
  )
})
```

Key points: `vi.mock("posthog-js")` at top; assert on **init options**, not behavior after init; restore original `NODE_ENV` in `afterEach` (not end-of-test statements).

### 4.1 Order-pinning test recipe (revocation ordering)

Ordering cannot be asserted with `toHaveBeenCalled()` — push a label into a `callOrder: string[]` from every mocked SDK method and assert on indices/array equality:

```typescript
expect(callOrder.indexOf("reset")).toBeLessThan(callOrder.indexOf("opt_out"))
// logout path with revoked consent:
expect(callOrder).toEqual(["reset", "opt_out"])
// logout path with granted consent:
expect(callOrder).toEqual(["reset"])
```

Also pin: revoke→re-grant captures without a second `init` (`init` called once, `opt_in_capturing` called with `{ captureEventName: false }`).

## When to Use

- Wiring a **new browser-side third-party analytics/telemetry SDK** (e.g., planned Vercel Analytics) that makes outbound calls on init.
- **Enabling or disabling a PostHog capability that lazy-loads external scripts** (session recording, dead clicks, surveys, toolbar, autocapture).
- Debugging **console/network noise from analytics domains** during local development.
- Any client-side feature gated on `NODE_ENV` that performs third-party fetches.

## When NOT to Use (Anti-Patterns)

- ❌ **Don't rely on the PostHog dashboard / remote config** to keep session recording or dead clicks off — remote config can re-enable them; always pin the local init option.
- ❌ **Don't put the dev gate only at the caller** (`providers.tsx` or the consent banner) — put it inside `initAnalytics()` so every entry path is covered.
- ❌ **Don't remove or bypass the `analytics-consent` gate** — consent is checked inside `initAnalytics()` and at every capture site; the banner must call `setAnalyticsConsent()`, never raw `localStorage.setItem` (see `docs/07-security/lgpd.md`).
- ❌ **Don't init the SDK at module top-level / import time** — init must stay a guarded function (`initAnalytics()`), never a side effect of importing `@/lib/analytics`.
- ❌ **Don't apply this pattern to server-side SDKs** — Sentry server/edge init is **credential-gated** (disabled without `SENTRY_DSN`), a different pattern; don't conflate env-gating with DSN-gating.
- ❌ **Don't use the dev skip to avoid verifying a feature you actually need in local dev** without adding an explicit, temporary override — silently dead features in dev hide regressions.

## Source of Truth Files

- `src/lib/analytics.ts` — guard chain + init options (canonical)
- `tests/analytics.test.ts` — env-branch and option assertions
- `src/components/providers.tsx` — boot path via `initAnalyticsWithConsent()`
- `src/components/analytics/consent-banner.tsx` — LGPD consent UI (calls `setAnalyticsConsent`)
- `docs/02-architecture/observability.md` §4.1 — config snippet kept in sync with code

## Project-Specific Constraints

- [ ] Guard order in `initAnalytics()` must stay: SSR/idempotency → `NODE_ENV === "development"` → consent → missing key → `posthog.init` → `initialized = true`.
- [ ] Consent storage key is exactly `analytics-consent` (string `"true"`) — shared by `analytics.ts` and banner; never rename unilaterally.
- [ ] Env vars: `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN` (required), `NEXT_PUBLIC_POSTHOG_HOST` (default `https://app.posthog.com`).
- [ ] Tests: `vi.resetModules()` + dynamic import per case (module-level `initialized` flag); override `process.env.NODE_ENV` via `Object.defineProperty`; mock `posthog-js`; restore `NODE_ENV` in `afterEach`.
- [ ] Docs sync: any change to init options/guards must update `observability.md` §4.1 and the PostHog bullet in `docs/infrastructure.md`.

## Safe Change Checklist for Future AI Work

1. Edit the guard chain / init options in `src/lib/analytics.ts` `initAnalytics()` — preserve guard order; add explicit local values for any new external-script-loading option (comment naming the remote-config risk).
2. If the init flow changes, re-verify consent enforcement still holds inside `initAnalytics()`, at `track()`, and via `setAnalyticsConsent()` / banner.
3. Extend `tests/analytics.test.ts`: new env branch → `setNodeEnv(...)` + `loadAnalytics()` + assert `init` call count and option values; restore `NODE_ENV` in `afterEach`.
4. Sync docs: `docs/02-architecture/observability.md` §4.1 snippet, `docs/infrastructure.md` PostHog bullet.
5. Verify: run `tests/analytics.test.ts` (vitest), then `bun run type-check` and `bun run lint`.

## Related Patterns / Docs

- `docs/02-architecture/observability.md` §4 (PostHog events, consent gate, funnels)
- `docs/solutions/patterns/observability/logger-migration-stopgap.md` (adjacent observability pattern)
- `docs/infrastructure.md` — Sentry **DSN credential gate** (analogous conditional-init family: PostHog = env gate, Sentry = credential gate)
- `docs/07-security/lgpd.md` — consent requirement this pattern must not weaken
- `docs/work-plans/20260921120000-sprint1-completion-work-plan.md` — origin: local dev defect "PostHog recorder/network console noise from `us.i.posthog.com`"
