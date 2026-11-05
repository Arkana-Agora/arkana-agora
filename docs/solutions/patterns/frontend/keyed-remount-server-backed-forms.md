---
title: "Keyed Remount for Server-Backed Settings Forms — Project Pattern"
problem_type: pattern
category: frontend
components:
  - frontend
tags:
  - patterns
  - keyed-remount
  - react-query
  - set-state-in-effect
  - forms
  - state-hydration
  - eslint
  - horoscopes
module: horoscopes notification settings (profile, RF-HORO-008)
date: 2026-10-20
established_in: "Sprint 2 Phase 4 T103 (branch sprint2-f4, 2026-10-20): `NotificationSettings` hydrates its form from a React Query GET with a content-keyed remount instead of `useEffect(() => { if (data) setForm(data) }, [data])`, because `react-hooks/set-state-in-effect` is an ERROR in this repo (eslint-plugin-react-hooks@7.1.1 recommended preset via `eslint-config-next/core-web-vitals`)."
---

# Pattern: Keyed Remount for Server-Backed Settings Forms

## Problem / When to Use This

You have a settings form whose initial values come from a React Query `GET`, the user edits locally, and a `PATCH` on Save. The classic hydration idiom — `useEffect(() => { if (data) setForm(data) }, [data])` — is **banned in this repo**: `react-hooks/set-state-in-effect` is registered at `severity: Error` (`ErrorSeverity.Error` + `LintRulePreset.Recommended`) in `eslint-plugin-react-hooks@7.1.1`, and `eslint.config.mjs` inherits it through `eslint-config-next/core-web-vitals` (`eslint-plugin-react-hooks.configs.recommended.rules`). The rule also has a real point: a hydration effect runs after paint (visible flicker of stale/empty values) and resets `useState` after the user may already have interacted.

Reach for this pattern when **all** of these hold: (1) the server owns the form's initial values; (2) local edits must survive background refetches whose payload is **content-identical**; (3) a *real* payload change (invalidation after a successful Save, or a change made in another tab) should **reset the form to server truth**, discarding local edits; (4) the payload is small and JSON-serializable. The trick is to let React itself do the hydration: mount the form child with `key={JSON.stringify(serverObject)}` so a content change produces a brand-new component instance whose `useState` initializer reads the fresh props — zero effects, zero setState-in-render, lint clean.

## Source of Truth Files

- `src/components/horoscopes/notification-settings.tsx` — the pattern itself: parent `NotificationSettings` (queries, loading/error, gating) + child `SettingsForm` (state) mounted at line 142 with `key={JSON.stringify(settings)}`
- `src/hooks/use-horoscopes.ts` — `horoscopeNotificationSettingsSchema` (4 stable fields), `useHoroscopeNotificationSettings` (queryKey `["horoscopes", "notifications", "settings"]`), `useSaveHoroscopeNotificationSettings` (`onSuccess` invalidates that exact key — this is what drives the remount after Save)
- `tests/components/notification-settings.test.tsx` — 6 contract tests, incl. `reflete estado salvo após invalidação do settings` (line 103)
- `eslint.config.mjs` + `node_modules/eslint-plugin-react-hooks` — provenance of the ERROR rule; the only `eslint-disable` for it in `src/` is `src/components/social/followers-modal.tsx:1`
- `src/app/(app)/perfil/own-profile.tsx:29` — mount point of `<NotificationSettings />`
- Written contracts: `docs/06-features/notifications.md` (T103/RF-HORO-008), `docs/06-features/profile.md`
- Contrast implementation: `src/components/profile/privacy-settings.tsx` — the **dirty-flag** alternative (see When NOT to use)

## Current Implementation Snapshot

- **Parent/child split inside one file**: `NotificationSettings` owns `useHoroscopeNotificationSettings()`, renders the error card (`isError`), the loading placeholder (`role="status"`, `isLoading || !settings`), and only mounts the child when `settings` exists — so the child's `useState(settings)` is **never** initialized from `undefined`.
- **Content key**: `<SettingsForm key={JSON.stringify(settings)} settings={settings} />` (line 142). `settings` is the zod-parsed GET payload `{ westernEnabled: boolean, chineseEnabled: boolean, mayaEnabled: boolean, hour: 0–23 }` — fixed shape, no timestamps, no server-generated ids.
- **Child state**: `const [form, setForm] = useState<HoroscopeNotificationSettings>(settings)` (line 37) + `setForm((current) => ({ ...current, [field.key]: ... }))` updates in `onChange` handlers. `save.mutate(form, { onSuccess, onError })` posts the full form; toasts from `sonner`.
- **Zero effects**: the file contains no `useEffect` and no render-adjustment `setState` — `bunx eslint src/components/horoscopes/notification-settings.tsx` exits 0.
- **Lifecycle produced by the key**:
  - first load → child mounts fresh with server state;
  - background refetch returning a content-identical payload → `JSON.stringify` unchanged → React keeps the same instance → in-progress local edits preserved;
  - real change (e.g. `invalidateQueries` after PATCH success returns the new row) → new key string → React unmounts/remounts → `useState` re-initializes from the new props → server truth wins;
  - `undefined`/loading → parent renders the placeholder, child unmounts entirely.
- **Tests**: 6/6 pass via `bun run test tests/components/notification-settings.test.tsx` (through the `test` script — memory flag, see `docs/solutions/ci-cd/turbopack-postcss-oom.md`).
- ⚠️ **Verified test limitation (2026-10-20)**: the `reflete estado salvo após invalidação` test does **not** currently discriminate the pattern — it was run against a copy with the `key` removed and still passed 6/6, because the simulated post-invalidation payload (`{ ...SETTINGS, mayaEnabled: true }`) agrees with the user's local edit (`mayaEnabled` toggled to `true`); either code path ends checked. The remount semantics are React core behavior (`key` change ⇒ new instance), but **no test yet fails when the `key` is removed**. Strengthening it is listed under Planned / Optional Extensions.

## Planned / Optional Extensions (NOT implemented yet)

- **Discriminating remount test**: in `tests/components/notification-settings.test.tsx`, add a case where the invalidation payload **disagrees** with the local edit (user checks `maiaEnabled`, rerender with `mayaEnabled: false`) and assert the checkbox is *unchecked* — only a remount can pull local state backwards to server truth. That is the assertion that would fail with the `key` removed.
- **Canonical key**: if the payload ever gains fields whose JSON key order or value varies per response (server timestamps, request ids), replace `JSON.stringify(settings)` with an explicit serialization of the stable fields (e.g. `` `${settings.hour}|${settings.westernEnabled}|${settings.chineseEnabled}|${settings.mayaEnabled}` ``) so a meaningless diff cannot remount the form.

## Pattern Overview

Split the component in two: the **parent** queries React Query data and renders loading/error states, mounting the form child **only when data exists**; the **child** receives the whole server object as a prop and seeds `useState` from it. Bind the child's identity to the data's content with `key={JSON.stringify(settings)}`. React then performs the hydration for free: same content = same instance (local edits survive), new content = new instance (`useState` re-runs on fresh props). The mutation's `onSuccess` invalidates the query, closing the loop from Save back into server truth — with zero effects and full compliance with `react-hooks/set-state-in-effect`.

## Implementation Steps

### Step 1: Parent queries and gates the child

[File: `src/components/horoscopes/notification-settings.tsx`]

```typescript
export function NotificationSettings() {
  const { data: settings, isLoading, isError } = useHoroscopeNotificationSettings()

  if (isError) {
    return (/* error card */)
  }

  return (
    <Card data-testid="notification-settings">
      {/* header… */}
      <CardContent>
        {isLoading || !settings ? (
          <p className="text-sm text-muted-foreground" role="status">
            Carregando…
          </p>
        ) : (
          <SettingsForm key={JSON.stringify(settings)} settings={settings} />
        )}
      </CardContent>
    </Card>
  )
}
```

Key points:
- Loading/error UI lives in the **parent** — the child never mounts with `undefined`, so its `useState(prop)` initializer needs no `| undefined` handling (keeps `exactOptionalPropertyTypes` simple).
- The `key` goes on the **child element rendered by the parent** — that is the only position where a React `key` controls remount identity.
- Gate on data presence (`isLoading || !settings`), not just `isLoading` — a query can resolve to `undefined` transiently in tests/mocks.

### Step 2: Child holds state, seeded once from props

[File: `src/components/horoscopes/notification-settings.tsx`]

```typescript
interface SettingsFormProps {
  settings: HoroscopeNotificationSettings
}

function SettingsForm({ settings }: SettingsFormProps) {
  const save = useSaveHoroscopeNotificationSettings()
  const [form, setForm] = useState<HoroscopeNotificationSettings>(settings)

  const handleSave = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    save.mutate(form, {
      onSuccess: () => toast.success("Preferências de notificação salvas"),
      onError: () => toast.error("Não foi possível salvar as preferências"),
    })
  }
  // …controlled inputs bound to `form`, `onChange` → setForm(current => …)
}
```

Key points:
- `useState(settings)` runs **once per mount** — the remount (Step 1's key) is the only thing that re-runs it. Do not add an effect "to keep it in sync".
- The state type is the zod-inferred server type (`HoroscopeNotificationSettings`) — the form is a superset-free copy of the payload, not a different shape (the PATCH accepts the same fields).
- `save.mutate(form)` sends the **full** form; the route's partial-zod contract tolerates it (`docs/06-features/notifications.md`).

### Step 3: Mutation invalidates the read — the remount trigger

[File: `src/hooks/use-horoscopes.ts`]

```typescript
export function useSaveHoroscopeNotificationSettings() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (patch: HoroscopeNotificationPatch) => {
      const payload = horoscopeNotificationPatchSchema.parse(patch)
      const res = await authApi.patch("/horoscopes/notifications/settings", payload)
      return horoscopeNotificationSettingsSchema.parse(res.data.data.settings)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["horoscopes", "notifications", "settings"],
      })
    },
  })
}
```

Key points:
- The invalidation key **must match** the `useHoroscopeNotificationSettings` key exactly — if they drift, the form silently never remounts after Save and keeps local state forever.
- Zod parse stays inside `mutationFn`/`queryFn` (never in `onSuccess`/`onError` — React Query v5 per-call callbacks run outside try/catch, see `AGENTS.md`).
- The refetched payload differs from what the user submitted **only if the server normalized something** (defaults, clamping); otherwise key strings may be identical and no remount occurs — which is fine, local state already equals server truth.

### Step 4: Pin the behavior with tests

[File: `tests/components/notification-settings.test.tsx`]

- First render from GET → three checkboxes + hour value (fresh mount).
- Loading (`data: undefined`) → `role="status"` and **no** checkboxes (child not mounted).
- Error → message, no checkbox.
- Edit + save → `mutate` receives the complete form (local state is authoritative until Save).
- Pending → button disabled.
- Invalidation (`reflete estado salvo após invalidação do settings`) → after `mockUseSettings` returns changed data + `rerender`, the changed checkbox reflects the server. (Currently non-discriminating — see Planned Extensions for the strengthening.)

Key points:
- Mock the hooks module (`vi.mock("@/hooks/use-horoscopes", …)`) and drive "refetch" by swapping the mock return value + `rerender()` — no query client needed.
- A pattern pinning test must make server and local state **disagree**, otherwise it passes with or without the key.

### Step 5: Verify against the lint gate

```
bunx eslint src/components/horoscopes/notification-settings.tsx   # exit 0
bun run lint && bun run type-check && bun run test               # repo gate
```

Key points:
- If you find yourself typing `eslint-disable react-hooks/set-state-in-effect`, stop and reconsider — the precedents for that escape hatch are `src/components/social/followers-modal.tsx` (state is *local-only* by design, reset on modal close, never server-backed) and are documented at the disable site.

## Complete Example

A new server-backed form (e.g. AI preferences `{ model, dailyLimit }`), following the same steps:

```typescript
// src/hooks/use-ai-preferences.ts
export const aiPreferencesSchema = z.object({
  model: z.string(),
  dailyLimit: z.number().int().min(1).max(50),
})

export function useAiPreferences() {
  return useQuery({
    queryKey: ["ai", "preferences"],
    queryFn: async () => {
      const res = await authApi.get("/ai/preferences")
      return aiPreferencesSchema.parse(res.data.data.preferences)
    },
  })
}

export function useSaveAiPreferences() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (patch: Partial<z.infer<typeof aiPreferencesSchema>>) => {
      const res = await authApi.patch("/ai/preferences", patch)
      return aiPreferencesSchema.parse(res.data.data.preferences)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["ai", "preferences"] })
    },
  })
}

// src/components/ai/ai-preferences.tsx
function PreferencesForm({ preferences }: { preferences: AiPreferences }) {
  const [form, setForm] = useState<AiPreferences>(preferences)
  const save = useSaveAiPreferences()
  // …controlled inputs; save.mutate(form)
}

export function AiPreferences() {
  const { data, isLoading, isError } = useAiPreferences()
  if (isError) return (/* error card */)
  if (isLoading || !data) return <p role="status">Carregando…</p>
  return <PreferencesForm key={JSON.stringify(data)} preferences={data} />
}
```

## Project-Specific Constraints

- [ ] **`react-hooks/set-state-in-effect` is an ERROR** — never write `useEffect(() => { if (data) setX(data) }, [data])` (or any setState-in-effect) for form hydration; this pattern or the dirty-flag variant below are the sanctioned alternatives.
- [ ] The child mounts **only when data exists**; `useState(prop)` must receive a defined payload (no `| undefined` state gymnastics).
- [ ] The `key` payload must contain only **stable, user-meaningful fields** — no `updatedAt`, no server request ids, no randomized values (any of these remount on every refetch and wipe edits).
- [ ] The key must be on the **child element rendered by the parent**, and the state to reset must live **inside** that keyed component (state kept in the parent survives the child's remount).
- [ ] Mutation `onSuccess` invalidates the **same queryKey** the parent queries — the remount loop depends on it.
- [ ] Zod parse in `mutationFn`/`queryFn`, never in `onSuccess`/`onError` (React Query v5, `AGENTS.md`).
- [ ] Loading/error UI stays in the parent (tests address it via `role="status"` / error text and assert no checkbox exists).
- [ ] A test that claims to pin the remount must make server payload and local edit **disagree** (otherwise it passes without the key — verified 2026-10-20).
- [ ] Verification: `bunx eslint <component>`, then the repo gate `bun run lint && bun run type-check && bun run test` — **never** `bun run build` for verification.

## Anti-Patterns (What NOT to Do)

- ❌ `useEffect(() => { if (data) setForm(data) }, [data])` — lint error, post-paint flicker, resets after user interaction.
- ❌ Hydration via render adjustment (`if (form !== data) setForm(data)` in the component body) — still a setState-on-every-divergence hack that clobber edits on any refetch; the keyed remount already encodes "when should we reset?" in the key itself.
- ❌ `/* eslint-disable react-hooks/set-state-in-effect */` on a **server-backed** form — the one legitimate disable in `src/` (`followers-modal.tsx`) is local-only state with a justification comment; a settings form has server truth to converge to.
- ❌ Keying on non-content values (`key={isLoading ? "a" : "b"}`, index, a `Date`) or on a payload containing volatile fields — remounts become random and eat edits.
- ❌ Keeping the form state in the parent while the keyed component only renders it — remounting the view then resets nothing.
- ❌ Using this pattern when **local edits must survive a real server change** (multi-tab, changed elsewhere, server rejected/normalized the save): a remount discards them. Use the dirty-flag variant (`privacy-settings.tsx`: `settings = isDirty && localSettings ? localSettings : toSettings(profile?.privacy)`) so server truth is the base only until the first edit.
- ❌ Using this pattern for non-serializable state (`File`, `Date`, functions) — `JSON.stringify` silently drops/mangles them and the key lies.
- ❌ Forgetting the invalidation in `onSuccess` — Save appears to work but the form never re-converges to server truth until a full reload.
- ❌ Assuming the current `reflete estado salvo após invalidação` test protects the `key` — it does not (payload agrees with the edit); add the disagreeing-payload test before relying on it.

## Related Patterns / Docs

- `docs/solutions/patterns/frontend/optimistic-viewer-overlay.md` — the sibling pattern for **viewer-owned** state on a shared refetched cache (`overlay ?? server`); this pattern is the inverse: server-owned state that *yields* to local edits until a real change.
- `src/components/profile/privacy-settings.tsx` — the dirty-flag alternative when local edits must survive server changes.
- `src/components/social/followers-modal.tsx:1` — the documented `eslint-disable` escape hatch (local-only modal reset, not server-backed).
- `docs/06-features/notifications.md` (T103/RF-HORO-008 contract), `docs/06-features/profile.md` (mount point), `docs/04-api/*` for the matching `GET`/`PATCH`.
- `tests/components/notification-settings.test.tsx` — contract tests for this pattern.

## Safe Change Checklist for Future AI Work

1. **Payload shape**: if `horoscopeNotificationSettingsSchema` (`src/hooks/use-horoscopes.ts`) gains a field, decide whether it is stable *before* it enters `JSON.stringify(settings)`; volatile fields ⇒ use an explicit stable key instead.
2. **Query key drift**: change `queryKey` in `useHoroscopeNotificationSettings` ⇒ mirror it in `useSaveHoroscopeNotificationSettings`'s `invalidateQueries` (and any other consumer).
3. **Form fields**: new toggle ⇒ extend `TOGGLE_FIELDS`/inputs in `src/components/horoscopes/notification-settings.tsx` and the `SETTINGS` fixture in the test.
4. **Test hardening**: add the disagreeing-payload remount test (Planned Extension) if the pattern is reused or the key logic changes.
5. **Lint/verify**: `bunx eslint src/components/horoscopes/notification-settings.tsx`, then `bun run lint && bun run type-check && bun run test tests/components/notification-settings.test.tsx`.
6. **Docs**: `docs/06-features/notifications.md` gets a one-line note if the hydration/`key` mechanism changes.
