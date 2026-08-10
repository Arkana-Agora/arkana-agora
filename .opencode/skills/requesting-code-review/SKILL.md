---
name: requesting-code-review
description: "Use when requesting a focused review with standardized findings format (critical, important, informational) before commit or PR."
---

# Requesting Code Review

Use this skill when you want a consistent, high-signal review request.

## How to use

1. Define review scope:
   - target diff/branch/PR
   - changed file list
2. Ask reviewer to use the template in `code-reviewer.md`.
3. Require severity-labeled findings with concrete recommendations.

## Output requirements

- Findings first, ordered by severity.
- Each finding includes impacted files/symbols.
- Keep summaries short; focus on risks and regressions.
