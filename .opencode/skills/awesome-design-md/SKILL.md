---
name: awesome-design-md
description: "Apply a brand-matching DESIGN.md design system when building UI. Use when the user names a brand aesthetic (Linear, Stripe, Vercel, Notion, Apple...), asks to 'build UI like X', requests a DESIGN.md, or when a project already has a DESIGN.md at root. Vendored workflow from VoltAgent/awesome-design-md (getdesign.md) + Google Stitch DESIGN.md format. Triggers: DESIGN.md, look like Linear/Stripe/Notion, brand design system, design tokens, matching UI."
---

# Awesome DESIGN.md

> **Provenance:** Workflow adapted from
> [`VoltAgent/awesome-design-md`](https://github.com/VoltAgent/awesome-design-md)
> (MIT) and the Google Stitch
> [DESIGN.md specification](https://stitch.withgoogle.com/docs/design-md/specification/).
> The collection lives at [getdesign.md](https://getdesign.md/).

Teaches coding agents to generate UI that stays visually consistent with a real
brand design language by reading a plain-text `DESIGN.md` file — no Figma
export, no JSON schema, no tooling. Markdown is the format LLMs read best.

## When to use

- User says "make it look like Linear / Stripe / Vercel / Notion / Apple / ..."
- User asks for a `DESIGN.md` or mentions brand design tokens
- Project root already contains a `DESIGN.md` (always read it before building UI)
- A redesign needs a concrete visual language instead of a free-form aesthetic guess
- Complementary to `taste-skill`: this skill supplies the **brand system**;
  `taste-skill` supplies the **anti-slop discipline** (layout, motion, pre-flight)

## When NOT to use

- Pure backend / API / database work with no UI surface
- Internal admin tooling where brand fidelity is explicitly irrelevant
- The brief already pins an official design-system package (Material, Carbon,
  Fluent, Polaris, Primer, Radix Themes) — use that package's own tokens
  instead of a scraped brand analysis

## Core concept

| File | Who reads it | What it defines |
|------|--------------|-----------------|
| `AGENTS.md` | Coding agents | How to build the project |
| `DESIGN.md` | Design agents / coding agents | How the project should look and feel |

Drop a `DESIGN.md` into the project root and tell the agent to follow it.
`DESIGN.md` is additive to (never a replacement for) `AGENTS.md`.

## Flow

### Step 1: Check for an existing DESIGN.md

```bash
ls DESIGN.md 2>/dev/null || ls design.md 2>/dev/null
```

If present, **read it fully before any UI work** and treat its tokens as law
(colors, type scale, radii, spacing, component states, do's/don'ts). Do not
re-invent a palette that the file already defines.

### Step 2: Resolve the brand reference (when none exists)

1. Identify the brand/aesthetic the user named or implied
   (e.g. "Linear-style dark SaaS", "Stripe-like pricing page").
2. Fetch the matching analysis from the collection:
   - Catalog: `https://github.com/VoltAgent/awesome-design-md/tree/main/design-md`
   - Direct file pattern:
     `https://raw.githubusercontent.com/VoltAgent/awesome-design-md/main/design-md/<brand>/DESIGN.md`
   - Browser catalog: `https://getdesign.md/<brand>/design-md`
3. If no exact brand matches, pick the closest aesthetic family from the
   catalog (e.g. dark technical → `linear.app` or `vercel`; warm editorial →
   `notion`; premium consumer → `apple`) and say so explicitly in the design read.
4. If the collection cannot be fetched (offline), fall back to authoring a
   minimal DESIGN.md yourself (Step 4) from the brief.

Well-known slugs include: `claude`, `cursor`, `elevenlabs`, `figma`,
`linear.app`, `mintlify`, `notion`, `posthog`, `raycast`, `resend`,
`sanity`, `spotify`, `stripe`, `supabase`, `tesla`, `vercel`, `warp`,
`wise`, and 60+ more — browse the catalog when unsure.

### Step 3: Install the DESIGN.md into the project

1. Download the chosen `DESIGN.md`.
2. Write it to the **project root** as `DESIGN.md` (exact filename).
3. Confirm with the user only if the file would overwrite an existing one;
   otherwise proceed — the file is inert documentation until the agent reads it.
4. In the implementation session, state one line:
   `"Following DESIGN.md (<brand>): <primary> accent on <canvas>, <type family>, <density read>."`

### Step 4: Author a custom DESIGN.md (no catalog match)

When the brief has brand assets (logo colors, existing CSS variables, Figma
tokens) or the user wants a unique language, write a `DESIGN.md` following the
Stitch-compatible structure below. Keep it under ~400 lines; agents read it
fully on every UI task, so density beats completeness.

Required sections (in order):

1. **Visual Theme & Atmosphere** — mood, density, design philosophy (prose)
2. **Color Palette & Roles** — semantic name + hex + functional role
3. **Typography Rules** — font families + full hierarchy table
4. **Component Stylings** — buttons, cards, inputs, nav, with states
5. **Layout Principles** — spacing scale, grid, whitespace philosophy
6. **Depth & Elevation** — shadow system, surface hierarchy
7. **Do's and Don'ts** — guardrails and anti-patterns
8. **Responsive Behavior** — breakpoints, touch targets, collapse strategy
9. **Agent Prompt Guide** — quick color reference + ready-to-use prompts

Frontmatter shape (YAML, as used by the collection):

```yaml
---
version: alpha
name: <Brand>-design-analysis
description: "One-paragraph atmosphere read: canvas, ink, accent, type, density."
colors:
  primary: "#5e6ad2"
  on-primary: "#ffffff"
  canvas: "#010102"
  surface-1: "#0f1011"
  ink: "#f7f8f8"
  ink-muted: "#d0d6e0"
  hairline: "#23252a"
typography:
  display-lg:
    fontFamily: "..."
    fontSize: 56px
    fontWeight: 600
    lineHeight: 1.10
    letterSpacing: -1.8px
  body:
    fontFamily: "..."
    fontSize: 16px
    fontWeight: 400
    lineHeight: 1.50
rounded:
  md: 8px
  lg: 12px
  pill: 9999px
---
```

### Step 5: Build UI from the DESIGN.md

Mapping tokens to implementation:

1. **Colors** → CSS variables or Tailwind theme tokens first; never hardcode
   hexes in components. Map semantic roles (`primary`, `surface-1`, `ink-muted`)
   to component usage, not raw hex lookup.
2. **Typography** → font-family + size/weight/leading/tracking per role.
   Self-host fonts (`next/font` or `@font-face` + `font-display: swap`).
3. **Radii / spacing** → one scale only; no mixed sharp/pill systems unless
   the DESIGN.md documents the rule (e.g. pill buttons + 12px cards).
4. **Components** → match states listed in the file (hover, focus, disabled,
   loading). If the file is silent, use `taste-skill` state rules
   (loading skeleton, empty, error, tactile `:active`).
5. **Do's and Don'ts** → hard constraints. Violating them fails the pre-flight
   check even if the layout looks fine.
6. **Light/dark** → if the DESIGN.md is dark-first, lock the page dark; do
   not invent a light variant unless the file provides one
   (`preview-dark.html` in the collection shows both when available).

### Step 6: Verify against the DESIGN.md

Before claiming UI work done, audit:

- [ ] Accent color used consistently (no second accent sneaked in)
- [ ] Type hierarchy matches the scale (no ad-hoc font sizes)
- [ ] Corner-radius scale is consistent across the page
- [ ] Component states from the file are implemented
- [ ] Do's/Don'ts list has no violations
- [ ] Theme is locked (no section-level light/dark flips)

Report evidence: which DESIGN.md was used (brand + source URL or "custom"),
and the verification checklist result.

## Interaction with other design skills

| Situation | Lead skill | Support |
|-----------|------------|---------|
| Brand system selection / tokens | this skill | — |
| Anti-slop layout, motion, pre-flight | `taste-skill` | consumes tokens from this skill |
| UI/a11y rule audit after implementation | `web-design-guidelines` | run after this skill's build |
| Figma pixel comparison | `agents/design/figma-design-sync` | uses DESIGN.md as written spec |
| Iterative layout refinement | `agents/design/design-iterator` | — |

Order for a full design pass:
1. `awesome-design-md` (or existing `DESIGN.md`) → tokens and brand language
2. `taste-skill` → structure, variance dials, motion, content density
3. build
4. `web-design-guidelines` → compliance review
5. design agents on demand (`design-iterator`, `figma-design-sync`)

## Hard rules

- Never invent brand colors/type when a `DESIGN.md` already defines them.
- Never mix two brands' DESIGN.md files in one project.
- Collection files analyze **publicly visible** CSS; they are inspiration +
  token reference, not a license to claim brand ownership. For client work,
  treat them as a starting point and substitute proprietary fonts with
  free equivalents when licensing matters (document the substitution).
- `DESIGN.md` lives at project root only — do not scatter copies into
  `docs/` (that tree is the plugin's operational memory, see docs-scope rules).
- Do not create a `DESIGN.md` unless the user asked for UI work that needs one,
  the project already expects one, or the user explicitly requested it
  (see no-unsolicited-markdown rule; DESIGN.md is a project artifact, not a
  summary file — still confirm intent when ambiguous).
