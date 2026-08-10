---
name: test-driven-development
description: "Optional TDD workflow; use only when user explicitly requests TDD/tests (red-green-refactor with minimal scope)."
---

# Test-Driven Development (Optional)

This skill is opt-in.

## Activation rule

Apply only when the user explicitly asks for TDD/tests (e.g., "use TDD", "write tests first", "test-first").

## Core loop

1. Red: write a failing test for the target behavior.
2. Green: implement minimal code to pass.
3. Refactor: clean implementation while keeping tests green.

## Guardrails

- Keep scope small per cycle.
- Avoid broad speculative test suites.
- Preserve existing project rules when tests are not desired globally.
