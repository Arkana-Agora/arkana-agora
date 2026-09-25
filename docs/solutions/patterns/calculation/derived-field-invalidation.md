# Derived-Field Invalidation Pattern

> **Date**: 2026-09-25 | **Status**: Current | **Pattern Category**: Calculation/Determinism

## Problem

Campos derivados (`personalArcana`, `astrologicalSign`, `mayanKin`) são calculados a partir de fontes primárias (`birthDate`, `name`). Esses campos podem ficar **stale** quando as fontes mudam por caminhos que não disparam recálculo automático:

1. **OAuth enrichment** (`events.signIn`): Google preenche `name`/`displayName`/`avatar` — se o usuário não tinha `name`, o `personalArcana` (que dependia do `name` vazio = `null`) fica inconsistente.
2. **User limpa `birthDate`** via `PATCH /me/profile` com `birthDate: ""` — zera os derivados, mas o código antigo apenas zerava sem recalcular.
3. **Recálculo falha** por `name` vazio — o código antigo **preservava** o valor anterior (arcano "fantasma" baseado em nome que não existe mais).
4. **Cache stale no read**: `GET /arcana/calculate` servia o `personalArcana` cacheado mesmo se ele divergisse do recalculado.

Não há trigger de banco de dados — a invalidação é **lógica de aplicação** e deve ser explícita em cada ponto de mutação/leitura.

## Solution: Invalidação Condicional Explícita em Três Pontos

### 1. PATCH `/me/profile` (Source-of-Truth Write)

Recalcula `personalArcana` **dentro da transação** usando o `name` persistido no momento do write:

```typescript
// src/app/api/v1/users/me/profile/route.ts
const currentUser = await tx.user.findUnique({
  where: { id: userId },
  select: { name: true }
})

if (birthDate !== undefined && birthDate !== "") {
  const recomputed = calculatePersonalArcana(new Date(birthDate), currentUser.name)
  if (recomputed !== null) {
    updateData.personalArcana = recomputed
  } else {
    // Null-out explícito: name vazio → não há base para arcano
    updateData.personalArcana = null
  }
} else if (birthDate === "") {
  // Reset completo: única forma de zerar tudo
  updateData.birthDate = null
  updateData.astrologicalSign = null
  updateData.mayanKin = null
  updateData.personalArcana = null
}
```

**Regras**:
- `birthDate` válida + `name` presente → recalcula e salva
- `birthDate` válida + `name` vazio → **null-out explícito** (`personalArcana: null`)
- `birthDate: ""` → reset completo (zera `birthDate`, `astrologicalSign`, `mayanKin`, `personalArcana`)

### 2. GET `/arcana/calculate` (Read-Path Self-Heal CAS)

Serve o valor canônico cacheado mas **tenta curar** cache stale no read via CAS (Compare-And-Swap):

```typescript
// src/app/api/v1/arcana/calculate/route.ts
const observed = user.personalArcana
const recomputed = calculatePersonalArcana(user.birthDate, user.name)

// Resposta usa o valor canônico (observed se não null, senão recomputed)
const canonical = observed ?? recomputed

// Self-heal CAS: só cura se ninguém mais mudou o campo entre read e write
if (observed !== null && observed !== recomputed) {
  await prisma.user.updateMany({
    where: { id: user.id, personalArcana: observed },
    data: { personalArcana: recomputed }
  })
  logger.info("[arcana/calculate] self-heal CAS: personalArcana curado", {
    userId: user.id,
    observed,
    recomputed
  })
}
```

**Por que CAS?** Garante atomicidade — só atualiza se o valor ainda for o `observed` (ninguém mais escreveu entre o read e o write). Evita race condition onde duas requests simultâneas tentam curar o mesmo cache.

### 3. Enrichment OAuth (`events.signIn` + `enrichment-service`)

Invalida `personalArcana` **apenas quando** há base para recalcular:

```typescript
// src/services/enrichment-service.ts
export async function enrichFromGoogleProfile(
  userId: string,
  googleProfile: GoogleProfile
): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) return

  const nameChanged = googleProfile.name && googleProfile.name !== user.name
  const hasBirthDate = user.birthDate !== null

  if (nameChanged && hasBirthDate) {
    // Só invalida se PODE recalcular (tem birthDate)
    await prisma.user.update({
      where: { id: userId },
      data: { personalArcana: null }
    })
  }
  // Se não tem birthDate, não toca no personalArcana — não há base para recalcular
}
```

**Regras**:
- Nome do Google muda **E** `birthDate` presente → `personalArcana = null` (próximo read recalcula)
- Nome do Google muda **MAS** sem `birthDate` → **não toca** no arcano (evita nulagem espúria)
- Nome não muda → não toca no arcano

## Implementation Files

| File | Role |
|------|------|
| `src/app/api/v1/users/me/profile/route.ts` | PATCH — recálculo transacional + null-out + reset completo |
| `src/app/api/v1/arcana/calculate/route.ts` | GET — self-heal CAS no read |
| `src/services/enrichment-service.ts` | Validação OAuth + invalidação condicional |
| `src/auth/auth.config.ts` | `events.signIn` handler (chama enrichment-service) |
| `tests/me-profile.test.ts` | Testes: recalcula, null-out, reset completo |
| `tests/integration/arcana-calculate.test.ts` | Testes: self-heal CAS |
| `tests/services/enrichment-service.test.ts` | Testes: invalidação condicional |

## Key Invariants

1. **Campo derivado nunca fica stale silenciosamente** — ou é recalculado no write, ou curado no read (CAS), ou invalidado condicionalmente no enrichment.
2. **Null-out explícito evita "arcano fantasma"** — quando a fonte (`name`) desaparece, o derivado é nulado, não preservado.
3. **Reset completo é explícito e único** — `birthDate: ""` é o único caminho que zera todos os derivados de uma vez.
4. **Invalidação OAuth é conservadora** — só invalida quando há `birthDate` para recalcular depois.

## Verification

- `npx vitest run tests/me-profile.test.ts` — recálculo, null-out, reset
- `npx vitest run tests/integration/arcana-calculate.test.ts` — self-heal CAS
- `npx vitest run tests/services/enrichment-service.test.ts` — invalidação condicional

## Related Patterns

- **TZ Determinism** (`docs/solutions/patterns/calculation/tz-determinism-utc-tests.md`) — garante que o recálculo produza o mesmo resultado em qualquer ambiente.

## Anti-Patterns to Avoid

- ❌ Preservar campo derivado quando a fonte some (`name` vazio → `personalArcana` mantido) — cria "arcano fantasma"
- ❌ Invalidar derivado sem verificar se há base para recalcular (ex.: nulificar `personalArcana` sem `birthDate`) — gera recálculo impossível
- ❌ Não curar cache stale no read — usuário vê valor antigo até fazer write
- ❌ Fazer invalidação em trigger de DB — não portável, acopla lógica de negócio ao schema