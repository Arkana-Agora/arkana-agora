# TZ Determinism via `process.env.TZ=UTC` in Tests

> **Date**: 2026-09-25 | **Status**: Current | **Pattern Category**: Calculation/Determinism

## Problem

Cálculos de data (arcano pessoal, signo zodiacal, kin maya) divergiam entre ambientes:
- **Dev**: BRT (UTC-3) — getters locais (`getFullYear`/`getMonth`/`getDate`) usam o timezone do sistema
- **Prod**: UTC — getters locais produzem valores diferentes para o mesmo `birthDate` ISO string

Um usuário nascido perto da meia-noite (ex.: `1990-06-15T23:30:00Z`) tinha:
- Em dev (BRT): dia 15 → arcano X
- Em prod (UTC): dia 16 → arcano Y

O arcano **persistido no banco** (calculado em prod) não batia com o **exibido na tela** (calculado em dev), fazendo o `/meu-arcano` "pular" de carta ao recarregar.

## Solution

**Todas as funções de cálculo usam getters UTC** — o resultado é independente do timezone do runtime:

```typescript
// src/lib/arcana/calculate.ts
export function calculateArcanaByDate(birthDate: Date): number {
  const year = birthDate.getUTCFullYear()
  const month = birthDate.getUTCMonth() + 1
  const day = birthDate.getUTCDate()
  // ... redução pitagórica dos dígitos de AAAAMMDD
}

export function calculatePersonalArcana(birthDate: Date, name: string): number | null {
  if (!birthDate || !name) return null
  const dateArcana = calculateArcanaByDate(birthDate)
  const nameArcana = calculateArcanaByName(name)
  return reduceToArcana(dateArcana + nameArcana)
}
```

```typescript
// src/lib/calculations/zodiac.ts
export function calculateZodiacSign(birthDate: Date): string {
  const month = birthDate.getUTCMonth() + 1
  const day = birthDate.getUTCDate()
  // ... lookup na tabela de signos
}
```

```typescript
// src/lib/calculations/kin-maya.ts
export function calculateKinMaya(birthDate: Date): number {
  const ref = new Date(Date.UTC(1954, 6, 26)) // 26/07/1954 = Kin 1
  const diff = birthDate.getTime() - ref.getTime()
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  return ((days % 260) + 260) % 260 + 1
}
```

**Testes forçam `process.env.TZ = "UTC"`** no setup global para garantir determinismo cross-env:

```typescript
// vitest.setup.ts
process.env.TZ = "UTC"
```

## Implementation Files

| File | Role |
|------|------|
| `src/lib/arcana/calculate.ts` | `calculateArcanaByDate`, `calculatePersonalArcana`, `explainPersonalArcana` — getters UTC |
| `src/lib/calculations/zodiac.ts` | `calculateZodiacSign` — getters UTC (já usava UTC antes do fix) |
| `src/lib/calculations/kin-maya.ts` | `calculateKinMaya` — getters UTC via `Date.UTC` |
| `tests/arcana.test.ts` | 100+ casos de redução pitagórica (datas conhecidas) |
| `vitest.setup.ts` | `process.env.TZ = "UTC"` global |

## Key Invariant

> O mesmo `birthDate` (ISO string) **sempre** produz o mesmo resultado numérico, independente do TZ do runtime.

## Verification

- `npx vitest run tests/arcana.test.ts` — 100+ testes passando
- `npx vitest run tests/integration/arcana-calculate.test.ts` — endpoint integration tests
- Manual: `TZ=UTC node -e "..."` vs `TZ=America/Sao_Paulo node -e "..."` → mesmo output

## Related Patterns

- **Derived-field invalidation** (`docs/solutions/patterns/calculation/derived-field-invalidation.md`) — como os campos derivados (`personalArcana`, `astrologicalSign`, `mayanKin`) são mantidos consistentes quando as fontes (`birthDate`, `name`) mudam.

## Anti-Patterns to Avoid

- ❌ Usar `getFullYear()`/`getMonth()`/`getDate()` em cálculos de data que precisam ser determinísticos cross-env
- ❌ Confiar no `Date` parser sem especificar UTC (`new Date("1990-06-15")` é ambíguo — use `new Date("1990-06-15T00:00:00Z")`)
- ❌ Não forçar `process.env.TZ = "UTC"` nos testes — testes passam local mas falham em CI/prod