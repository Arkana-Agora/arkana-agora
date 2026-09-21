# Clarifications — Sprint 1 Completion Plan

## Source Plan
- `docs/plans/20260921120000-sprint1-completion-plan.md`

## Session 2026-09-21

- **Q1: NFRs & Rate Limits** — Quais targets de performance e limites de rate limiting além do auth?
  - Recommendation: P95 < 500ms para todas as APIs, rate limits definidos por módulo.
  - Final Answer: **P95 < 500ms para todas as APIs.** Rate limits: readings 3/dia free (10 Plus), AI 10/dia free + 3 interpretações tiragem, profile updates 10/min.
  - Impact on Plan: Adicionar seção NFRs ao plano; atualizar ACs com targets mensuráveis; adicionar rate limiting checks em T046 (readings) e T075 (AI interpret).

- **Q2: UX Empty/Error States** — Como tratar estados de empty/error/loading para profile, tarot, arcana?
  - Recommendation: Definir estados para todas as páginas com padrão shadcn/ui.
  - Final Answer: **Definir estados para todas as páginas.** Profile: skeleton + retry; Tarot: empty state com CTA; Arcana: skeleton; IA: error toast + retry. Padrão shadcn/ui.
  - Impact on Plan: Adicionar sub-bullets de empty/error/loading states em T023-T029 (profile), T051-T064 (tarot), T099-T103 (arcana).

- **Q3: AI Failure Modes** — Qual estratégia de fallback para interpretações IA quando z-ai-web-dev-sdk falha?
  - Recommendation: Retry manual + cache fallback.
  - Final Answer: **Retry manual + cache fallback.** Se IA falhar, mostrar mensagem de erro com opção de retry. Se cache hit, mostrar interpretação cached com badge. Sem fallback automático com texto genérico.
  - Impact on Plan: Atualizar T075/T077 para incluir retry logic; T084 (CachedInterpretationNotice) já cobre cache fallback; adicionar error state ao StreamingInterpretation (T081).

- **Q4: Avatar Upload Edge Cases** — Como tratar falhas de upload de avatar (R2 downtime, arquivo > 5MB, formato inválido)?
  - Recommendation: Retry + manter avatar anterior.
  - Final Answer: **Retry automático 1x; se falhar, mostrar erro com opção de retry manual. Manter avatar anterior se houver.** Validação client-side: max 5MB, formatos aceitos (JPEG, PNG, WebP).
  - Impact on Plan: Atualizar T027 (avatar-upload.tsx) para incluir validação client-side e retry logic; T015 (avatar/confirm) para manter avatar anterior em caso de falha.

- **Q5: Landing Page Pricing** — A landing page inclui 'pricing' mas não há sistema de pagamento. Como mostrar?
  - Recommendation: Planos estáticos + CTA "Em breve".
  - Final Answer: **Planos estáticos + CTA "Em breve".** Mostrar planos Free (ilimitado) e Premium (futuro) com CTA "Em breve". Sem links de pagamento.
  - Impact on Plan: Atualizar T116 (landing page) para incluir seção de pricing estática com CTA "Em breve".

## Coverage Summary

| Category | Status | Notes |
|----------|--------|-------|
| 1. Functional scope & success criteria | **Resolved** | ACs existentes + NFRs adicionados |
| 2. Domain/data model & lifecycle | **Partial** | Schema descrito; lifecycle de readings/interpretações implicitamente claro |
| 3. UX/interaction flows | **Resolved** | Empty/error/loading states definidos por página |
| 4. NFRs | **Resolved** | P95 < 500ms todas as APIs; rate limits definidos |
| 5. Integration boundaries & failure modes | **Resolved** | AI fallback: retry + cache; Avatar: retry + manter anterior |
| 6. Edge cases & concurrency | **Resolved** | Avatar upload edge cases tratados |
| 7. Terminology consistency | **Clear** | Sem alteração necessária |
| 8. Completion signals | **Clear** | Sem alteração necessária |

## Deferred Items

- **Reading lifecycle states** — O plano assume readings são criadas e imutáveis. Se no futuro houver "reading in progress" (session ativa), isso será tratado em Sprint 2.
- **Multi-device session management** — Autenticação já suporta múltiplas sessões via tokenVersion. Não há necessidade de Gerenciamento de sessões no Profile no MVP.
