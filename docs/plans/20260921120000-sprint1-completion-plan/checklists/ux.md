# UX Requirements Quality Checklist

Plan: `docs/plans/20260921120000-sprint1-completion-plan.md`

## Page-Level States

- [ ] CHK026 Are loading states defined for every page (skeleton shapes, durations)? [Completeness]
- [ ] CHK027 Are error states defined for every page (error message, retry mechanism)? [Completeness]
- [ ] CHK028 Are empty states defined for every page (CTA text, destination)? [Completeness]
- [ ] CHK029 Is the loading → content → error state transition documented for each page? [Clarity]

## Profile Pages

- [ ] CHK030 Are profile edit form fields explicitly listed (displayName, bio, birthDate, birthPlace)? [Completeness]
- [ ] CHK031 Is auto-save behavior defined (debounce duration, success feedback, error handling)? [Clarity]
- [ ] CHK032 Are privacy toggle options explicitly listed (profile visibility, stats visibility, arcana visibility)? [Completeness]
- [ ] CHK033 Is the public profile page behavior defined when user has no profile data? [Edge Case]
- [ ] CHK034 Is avatar upload UX defined (drag-and-drop zone, preview, crop, progress indicator)? [Clarity]

## Tarot Engine Pages

- [ ] CHK035 Is the reading flow step sequence documented (deck → spread → session → result)? [Clarity]
- [ ] CHK036 Is the card flip animation defined (3D flip duration, easing, trigger)? [Clarity]
- [ ] CHK037 Is the daily limit banner behavior defined (when shown, CTA destination, dismiss behavior)? [Clarity]
- [ ] CHK038 Is the share modal content defined (link format, OG image, social media preview)? [Clarity]
- [ ] CHK039 Is the reading timer behavior defined (count-up vs count-down, pause/resume, completion trigger)? [Clarity]

## Arcana Personal Pages

- [ ] CHK040 Is the arcana calculator form UX defined (input fields, validation, submit behavior)? [Clarity]
- [ ] CHK041 Is the arcana reveal animation defined (transition, duration)? [Clarity]
- [ ] CHK042 Is the AI interpretation integration point defined on the arcana page? [Clarity]

## AI Reading Components

- [ ] CHK043 Is the streaming text effect defined (typing speed, cursor, paragraph breaks)? [Clarity]
- [ ] CHK044 Is the follow-up chat UX defined (message history, input behavior, suggestions)? [Clarity]
- [ ] CHK045 Is the AI usage indicator visual defined (bar/counter, color thresholds)? [Clarity]
- [ ] CHK046 Is the cached interpretation notice behavior defined (badge style, re-interpret CTA)? [Clarity]

## Landing Page

- [ ] CHK047 Are landing page sections explicitly listed (hero, features, pricing, FAQ, footer)? [Completeness]
- [ ] CHK048 Is the pricing section content defined (plan names, features, CTA text)? [Clarity]
- [ ] CHK049 Is the FAQ content defined (questions list)? [Completeness]

## Mobile & PWA

- [ ] CHK050 Is the mobile navigation structure defined (tab order, icons, active states)? [Clarity]
- [ ] CHK051 Is the PWA install prompt behavior defined (when shown, dismiss behavior)? [Clarity]
- [ ] CHK052 Is the offline fallback page content defined? [Clarity]

## Cross-Cutting

- [ ] CHK053 Are toast notification types defined (success, error, warning, info) with sample messages? [Clarity]
- [ ] CHK054 Is the error boundary fallback UI defined (message, retry button)? [Clarity]
- [ ] CHK055 Are responsive breakpoints defined for mobile-first design? [Measurability]
