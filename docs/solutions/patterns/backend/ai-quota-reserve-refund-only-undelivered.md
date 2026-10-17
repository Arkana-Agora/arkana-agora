---
title: "AI Quota: Reserve Before SSE Stream, Refund Only on Zero Delivery — Project Pattern"
problem_type: pattern
category: backend
components:
  - backend
tags:
  - patterns
  - ai-quota
  - sse-streaming
  - refund
  - compensation
  - fail-fast
  - quota-exploit
  - one-shot-refund
  - sprint2-f3
module: ai (src/app/api/v1/ai/_helpers.ts → interpret, arcana-interpret, follow-up)
date: 2026-10-16
established_in: "SPRINT2-F3 post-review security fix (2026-10-16): refund conditioned on fullText === '' instead of 'any stream error', closing the abort-and-refund free-generation exploit; shared createQuotaReservation helper + requireAIClient fail-fast + follow-up user-turn compensation; 9 cases (3 per route) across tests/integration/{ai-interpret,ai-followup,arcana-interpret}.test.ts"
---

# Pattern: AI Quota — Reserve Before Stream, Refund Only on Zero Delivery

## Problem / When to Use This

Use this pattern whenever a **rate-limited paid-generation endpoint reserves quota BEFORE an SSE stream starts** (the reservation must be up-front to prevent concurrency overshoot — two parallel requests must not both pass the check), and therefore needs a **compensation (refund) path when generation fails**. The trap is deciding *when* to refund: the natural instinct — "refund on any stream error" — is an **exploit**. The client controls when the stream ends: `POST → read tokens → abort (botão Parar / fechar aba / drop connection) → quota refunded → repeat` yields **unlimited free generations**, bypassing the daily plan limit entirely with unbounded provider cost. The refund MUST instead be conditioned on **zero delivery to the client (`fullText === ""`)** — no token was ever enqueued, so the user received nothing and paying would be wrong. A failure *after* the first token was delivered is a cost the user already consumed; it is never refunded. Two supporting pieces make this safe: (1) a **fail-fast** `requireAIClient` that returns 503 *before* quota is touched (config failures like a missing `AI_API_KEY` must not burn plan quota), and (2) for flows that **persist a user turn at stream start** (follow-up chat), a **compensation delete** of that persisted row when refunding, so a retry does not duplicate history. Three consumers already share the helper: `src/app/api/v1/ai/interpret/route.ts`, `src/app/api/v1/ai/arcana-interpret/route.ts`, `src/app/api/v1/ai/follow-up/route.ts`.

## Source of Truth Files

- `src/app/api/v1/ai/_helpers.ts` — `createQuotaReservation(reqId, userId, kind)` (one-shot `markConsumed()`/`tryRefund(scope)`), `requireAIClient(reqId, scope)` (503 before quota), `sseResponse(stream)`
- `src/app/api/v1/ai/interpret/route.ts` — reserve → fail-fast → `checkAndIncrementDailyUsage` → `markConsumed()` → stream; refund only `if (fullText === "")`
- `src/app/api/v1/ai/arcana-interpret/route.ts` — same shape, interpretation kind
- `src/app/api/v1/ai/follow-up/route.ts` — same shape, `followUp` kind, **plus** `prisma.followUpMessage.deleteMany({ where: { id: userMessageId } })` compensation before `tryRefund`
- `src/services/ai-service.ts` — `refundInterpretationQuota(userId)` / `refundFollowUpQuota(userId)` (decrement with `gt: 0` guard), `checkAndIncrementDailyUsage`, `checkAndIncrementFollowUpUsage`
- `tests/integration/ai-interpret.test.ts` — describe `quota devolvida quando a geracao falha (bug da tiragem)`: 503-no-consume, zero-token refund, **partial-delivery no-refund** (async generator yields one chunk then throws)
- `tests/integration/ai-followup.test.ts` — describe `quota devolvida quando a geracao falha (follow-up)`: 503, refund + `deleteMany` compensation, partial-delivery no-refund (keeps message)
- `tests/integration/arcana-interpret.test.ts` — describe `quota devolvida quando a geracao falha (arcana)`: same 3-case trio
- `docs/04-api/ai.md` — §Reserva e devolução de quota (written contract: reserve-before-stream, refund-only-on-zero-delivery, one-shot, follow-up compensation)

## Current Implementation Snapshot

- `createQuotaReservation(reqId, userId, kind: "interpretation" | "followUp")` returns `{ markConsumed(), tryRefund(scope) }` over a closure `let consumed = false`: `markConsumed()` flips it true right after the daily/follow-up limit check passes; `tryRefund` is **one-shot** (returns early if `!consumed`, then sets `consumed = false` before awaiting the refund) so a stream-catch and an outer catch firing together can never double-decrement.
- Route order (all three AI routes): auth (Bearer `requireAuth`) → JSON → Zod → `createQuotaReservation` → context lookup → **`requireAIClient` 503 fail-fast** → `checkAndIncrement*Usage` (429 if not allowed) → `quota.markConsumed()` → prompt/cache → `ReadableStream` → `sseResponse`.
- Inside the stream catch: `logger.error` → **`if (fullText === "") { await quota.tryRefund(...) }`** → enqueue `{ type: "error", code: "AI_SERVICE_UNAVAILABLE", retryable: true }` → `controller.close()`. `fullText` accumulates every enqueued token, so `fullText === ""` is precisely "zero delivery".
- The outer (pre-stream) catch also calls `tryRefund` — harmless if the stream never started because `consumed` is still false or already spent (one-shot).
- Follow-up compensation: the user message row is created at stream start and its `id` captured in `userMessageId`; on zero-delivery failure the route runs `prisma.followUpMessage.deleteMany({ where: { id: userMessageId } })` (itself wrapped in try/catch that only logs) **before** `tryRefund`, so a retry re-posts the turn instead of duplicating it in `conversationHistory`.
- Refunds delegate to `refundInterpretationQuota` / `refundFollowUpQuota` (`src/services/ai-service.ts`), which decrement with a `gt: 0` guard; a refund failure is logged, never surfaced to the client.
- Tests mock the AI client's `create` with `vi.fn().mockImplementation(async function* () { yield { choices: [{ delta: { content: "parcial" } }] }; throw new Error("provider boom after delivery") })` to simulate partial delivery; assertions distinguish `mockUsageUpdateMany` (refund) called vs not called, and `mockFollowUpDeleteMany` called vs not called.

## Planned / Optional Extensions (NOT implemented yet)

- A shared stream-error handler (e.g. `finalizeFailedStream({ quota, fullText, compensate? })` in `_helpers.ts`) to collapse the three near-identical catch blocks — today each route hand-writes the `fullText === ""` gate + compensation + error frame.
- Emit a distinct SSE error code for "failed after partial delivery" (client already got tokens; `retryable` semantics differ from a zero-token failure) — currently both paths emit the same `AI_SERVICE_UNAVAILABLE` frame.

## Pattern Overview

Reserve quota up-front (before the SSE stream, to block concurrency overshoot), but gate the failure refund on **proof of zero delivery** (`fullText === ""`), make the refund one-shot via a closure helper, fail fast on client-initiation errors before any quota touch, and compensate any rows persisted at stream start so retries stay idempotent.

## Implementation Steps

### Step 1: One-shot reservation helper

[File: `src/app/api/v1/ai/_helpers.ts` — `createQuotaReservation`]

```typescript
export function createQuotaReservation(
  reqId: string,
  userId: string,
  kind: "interpretation" | "followUp",
): QuotaReservation {
  let consumed = false
  return {
    markConsumed() {
      consumed = true
    },
    async tryRefund(scope: string) {
      if (!consumed) return
      consumed = false
      try {
        if (kind === "followUp") {
          await refundFollowUpQuota(userId)
        } else {
          await refundInterpretationQuota(userId)
        }
      } catch (refundErr) {
        logger.error({ reqId, err: refundErr }, `[${scope}] falha ao devolver quota`)
      }
    },
  }
}
```

Key points:
- The helper never decides *whether* to refund — the caller decides (only `fullText === ""`); the helper only enforces **at most one** refund per request.
- Set `consumed = false` **before** the `await` inside `tryRefund` — two concurrent catch paths (stream catch + outer catch) must not both decrement.
- Swallow refund errors with `logger.error`: a Redis/DB hiccup during compensation must not replace the original failure with a 500.

### Step 2: Fail-fast AI client BEFORE quota consumption

[File: `src/app/api/v1/ai/interpret/route.ts` (same in arcana-interpret, follow-up)]

```typescript
// Fail-fast: se o cliente IA não inicializa (ex.: AI_API_KEY ausente),
// responde 503 ANTES de consumir a quota diária.
const aiClientOrResponse = requireAIClient(reqId, "ai/interpret")
if (aiClientOrResponse instanceof Response) return aiClientOrResponse
const aiClient = aiClientOrResponse

const limitResult = await checkAndIncrementDailyUsage(auth.userId, ctx.tier)
if (!limitResult.allowed) { /* 429 AI_DAILY_LIMIT_REACHED */ }
quota.markConsumed()
```

Key points:
- `requireAIClient` catches `getAIClient()` throwing (missing `AI_API_KEY`, bad config) and returns `apiError("AI_SERVICE_UNAVAILABLE", ..., 503)` — **before** `checkAndIncrement*Usage`, so a misconfigured deployment burns zero user quota.
- `quota.markConsumed()` goes **only** after the limit check *passes* — a 429 never marks consumption, so its path needs no refund.
- Ordering is the security property: reserve/charge as late as possible before the observable work, refund as narrowly as possible after failure.

### Step 3: Refund gated on zero delivery, inside the stream catch

[File: `src/app/api/v1/ai/interpret/route.ts`]

```typescript
} catch (error) {
  logger.error({ reqId, err: error instanceof Error ? error : new Error(String(error)) },
    "[ai/interpret] erro no streaming")
  if (fullText === "") {
    await quota.tryRefund("ai/interpret")
  }
  controller.enqueue(encoder.encode(
    `data: ${JSON.stringify({ type: "error", code: "AI_SERVICE_UNAVAILABLE",
      message: "Nao foi possivel gerar a interpretacao agora. Tente novamente em alguns minutos.",
      retryable: true })}\n\n`))
  controller.close()
}
```

Key points:
- The **only** refund condition is `fullText === ""` — "any stream error" is wrong because the client can force the error (abort) after reading tokens.
- `fullText` must be declared outside the `for await` loop (in the `start(controller)` scope) and appended for every enqueued token — it is the delivery ledger.
- The error frame is still enqueued on the no-refund path (the client gets told the stream failed either way); refunding is independent of error reporting.
- Keep the outer pre-stream catch calling `tryRefund` — it covers context/persist failures after `markConsumed()`; one-shot semantics make the overlap safe.

### Step 4: Compensate persisted side effects when refunding (follow-up)

[File: `src/app/api/v1/ai/follow-up/route.ts`]

```typescript
const userMessage = await prisma.followUpMessage.create({
  data: { interpretationId, role: "user", content: message },
})
userMessageId = userMessage.id
// ... stream ...
} catch (error) {
  // ...
  if (fullText === "") {
    // Nada entregue: compensa a mensagem do usuário persistida
    // (senão o retry duplica o turno no histórico) e devolve a quota.
    if (userMessageId) {
      try {
        await prisma.followUpMessage.deleteMany({ where: { id: userMessageId } })
      } catch (deleteErr) {
        logger.error({ reqId, err: deleteErr }, "[ai/follow-up] falha ao remover mensagem do usuario")
      }
    }
    await quota.tryRefund("ai/follow-up")
  }
  // ...
}
```

Key points:
- Refund and compensation share the same `fullText === ""` gate — if tokens were delivered, both the quota **and** the persisted user turn stay (the turn is real history).
- `deleteMany` by the **captured id** (not by `interpretationId` + content) — precise, idempotent, and cannot delete another user's/turn's rows.
- Compensation delete is itself try/catch-logged: a delete failure must not swallow the refund or the error frame.
- Capture `userMessageId` in a variable declared outside the try (route/`start` scope) — inside-callback `let` scoping is fine here because it's assigned before the stream loop, but the outer catch must be able to see it.

### Step 5: Pin the exploit closed with partial-delivery tests

[Files: `tests/integration/ai-interpret.test.ts`, `tests/integration/ai-followup.test.ts`, `tests/integration/arcana-interpret.test.ts`]

```typescript
it("does NOT refund quota when failure happens after tokens were delivered (abort forcável)", async () => {
  mockReading()
  mockGetAIClient.mockReturnValue({
    chat: {
      completions: {
        create: vi.fn().mockImplementation(async function* () {
          yield { choices: [{ delta: { content: "parcial" } }] }
          throw new Error("provider boom after delivery")
        }),
      },
    },
  } as never)

  const res = await POST(makeRequest({ readingId: "reading-1", mode: "general" }))
  const text = await res.text()
  expect(text).toContain('"type":"error"')

  expect(mockUsageUpsert).toHaveBeenCalled()
  expect(mockUsageUpdateMany).not.toHaveBeenCalled() // NÃO devolve
})
```

Required cases (already implemented per route — extend, don't delete):
1. AI client fails to init → 503 `AI_SERVICE_UNAVAILABLE`, `mockUsageUpsert` and `mockUsageUpdateMany` **not** called (fail-fast, zero quota touch);
2. provider rejects before any token (`create` rejects) → refund fires (`mockUsageUpdateMany` with `{ interpretationCount | followUpCount: { decrement: 1 } }`), and for follow-up `mockFollowUpDeleteMany` called with `{ where: { id: "msg-1" } }`;
3. **partial delivery** (async generator yields one chunk then throws) → `mockUsageUpdateMany` **not** called, and for follow-up `mockFollowUpDeleteMany` **not** called (message kept);
4. successful generation → `mockUsageUpdateMany` not called (no refund on success).

Key points:
- Case 3 is the exploit regression — without it, a well-meaning refactor back to "refund on any error" passes CI while reopening unlimited free generations.
- Assert refund via the usage `updateMany` decrement, not via a return value (the route still answers 200 + an SSE error frame on generation failure).

## Complete Example

End-to-end shape for a new rate-limited streaming paid-generation endpoint:

```typescript
// src/app/api/v1/ai/_helpers.ts (já existe — reutilize, não copie)
const quota = createQuotaReservation(reqId, auth.userId, "interpretation")
try {
  const ctx = await getXContext(...)                       // 1. dados
  if ("error" in ctx) return apiError(ctx.error, "...", reqId, ctx.status)

  const aiClientOrResponse = requireAIClient(reqId, "ai/novo") // 2. fail-fast 503
  if (aiClientOrResponse instanceof Response) return aiClientOrResponse
  const aiClient = aiClientOrResponse

  const limitResult = await checkAndIncrementDailyUsage(auth.userId, ctx.tier) // 3. cobra
  if (!limitResult.allowed) return apiError("AI_DAILY_LIMIT_REACHED", "...", reqId, 429)
  quota.markConsumed()                                    // 4. marca consumo

  const stream = new ReadableStream({
    async start(controller) {
      const persistedId = /* id de row persistida no início do stream, se houver */ null
      let fullText = ""                                   // 5. ledger de entrega
      try {
        for await (const chunk of aiResponse) {
          const token = chunk.choices[0]?.delta?.content ?? ""
          if (token) { fullText += token; controller.enqueue(/* token frame */) }
        }
        controller.close()
      } catch (error) {
        logger.error({ reqId, err: error }, "[ai/novo] erro no streaming")
        if (fullText === "") {                            // 6. SÓ sem entrega
          if (persistedId) await deletePersistedTurn(persistedId) // 7. compensa
          await quota.tryRefund("ai/novo")                // 8. one-shot refund
        }
        controller.enqueue(/* error frame AI_SERVICE_UNAVAILABLE retryable */)
        controller.close()
      }
    },
  })
  return sseResponse(stream)
} catch (err) {
  logger.error({ reqId, err }, "[ai/novo] erro interno")
  await quota.tryRefund("ai/novo")                        // one-shot: seguro
  return apiError("INTERNAL_ERROR", "Erro interno", reqId, 500)
}
```

## Project-Specific Constraints

- [ ] Quota is reserved/charged (`checkAndIncrementDailyUsage` / `checkAndIncrementFollowUpUsage`) **before** the SSE stream opens — never lazily per token (concurrency overshoot).
- [ ] `requireAIClient(reqId, scope)` 503 runs **before** any quota increment — config/provider-init failures cost the user nothing (pinned by the 503 tests asserting `mockUsageUpsert` not called).
- [ ] `quota.markConsumed()` only after the limit check passes; 429 paths never mark consumption.
- [ ] The **only** refund condition is `fullText === ""` — never "any stream error", never client abort, never `controller.error`.
- [ ] Refund is one-shot via `createQuotaReservation` (`src/app/api/v1/ai/_helpers.ts`) — do not call `refundInterpretationQuota`/`refundFollowUpQuota` directly from routes.
- [ ] Follow-up zero-delivery failure also deletes the persisted user turn: `prisma.followUpMessage.deleteMany({ where: { id: userMessageId } })` by the **captured id**, before `tryRefund`.
- [ ] Refund/compensation failures are `logger.error`-swallowed — never surface as a second error to the client.
- [ ] Streams still emit `{ type: "error", code: "AI_SERVICE_UNAVAILABLE", retryable: true }` on failure regardless of refund outcome.
- [ ] All three routes (`interpret`, `arcana-interpret`, `follow-up`) stay in lockstep on this contract — a new AI streaming route must use the same helper and gates.
- [ ] Tests keep the partial-delivery no-refund case in each of `tests/integration/{ai-interpret,ai-followup,arcana-interpret}.test.ts`.

## Anti-Patterns (What NOT to Do)

- ❌ Refunding on "any stream error" or on client abort/cancel — `POST → read tokens → abort → refund → repeat` = unlimited free generations bypassing the plan limit, with unbounded provider cost.
- ❌ Using a boolean like `sawError` or catching outside the stream to decide the refund — delivery (`fullText`) is the only valid signal.
- ❌ Refunding before checking `fullText` "just to be generous to the user" — the user who received tokens already consumed the paid good.
- ❌ Calling `refundInterpretationQuota`/`refundFollowUpQuota` directly in a route (bypassing `createQuotaReservation`) — loses one-shot protection; stream catch + outer catch can double-decrement.
- ❌ Skipping the follow-up `deleteMany` compensation when refunding — the retry appends a duplicate user turn to `conversationHistory`.
- ❌ Deleting the user turn on the **partial-delivery** path — tokens were delivered, the turn is real history.
- ❌ Reserving quota after the stream starts or per chunk — two concurrent requests both pass the check and overshoot the daily limit.
- ❌ Letting `requireAIClient` run *after* `checkAndIncrement*Usage` — a missing `AI_API_KEY` would burn the user's daily quota on every request.
- ❌ Removing the "abort forcável" test during refactors — it is the only thing pinning the exploit closed.

## Related Patterns / Docs

- `docs/04-api/ai.md` — §Reserva e devolução de quota (written contract: reserve-before-stream, refund-only-on-zero-delivery, one-shot, follow-up compensation, affected routes)
- `docs/solutions/patterns/security/rate-limit-before-user-lookup.md` — sibling ordering rule: cheap/charged gate before expensive or observable operation
- `src/app/api/v1/ai/_helpers.ts` — the shared `createQuotaReservation` / `requireAIClient` / `sseResponse` helpers (source of truth for the semantics)
- `src/services/ai-service.ts` — `refundInterpretationQuota` / `refundFollowUpQuota` (`gt: 0` guarded decrements), `checkAndIncrement*Usage`

## Safe Change Checklist for Future AI Work

1. **New AI streaming endpoint**: import `createQuotaReservation`, `requireAIClient`, `sseResponse` from `src/app/api/v1/ai/_helpers.ts`; follow the Complete Example ordering (fail-fast → charge → markConsumed → stream → `fullText === ""` gate → optional compensation → one-shot refund).
2. **Any change to the catch block**: verify the refund condition is still literally `fullText === ""` and that `fullText` is appended for every enqueued token; if the stream gains a pre-first-token side effect (persisted row), add a matching compensation under the same gate.
3. **Refund logic change**: touch `createQuotaReservation` in `_helpers.ts` once — all three routes share it; keep one-shot (`consumed = false` before the `await`) and error-swallowing semantics.
4. **Test sync**: keep/extend the 3-case trio (503-no-consume, zero-token refund+compensation, partial-delivery no-refund) plus success-no-refund in `tests/integration/ai-interpret.test.ts`, `tests/integration/ai-followup.test.ts`, `tests/integration/arcana-interpret.test.ts`.
5. **Docs sync**: update `docs/04-api/ai.md` §Reserva e devolução de quota to match any contract change (it is the written source of truth for this behavior).
6. **Verification**: `bun run test tests/integration/ai-interpret.test.ts tests/integration/ai-followup.test.ts tests/integration/arcana-interpret.test.ts` (run through the `test` **script** — it carries `--max-old-space-size=4096`, never bare `npx vitest run`, see `docs/solutions/ci-cd/turbopack-postcss-oom.md`), then `bun run type-check` and `bun run lint`; full suite before merge: `bun run test`.
