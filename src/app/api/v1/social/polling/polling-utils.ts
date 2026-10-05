import { z } from "zod"

import { requireAuth } from "@/app/api/v1/users/_helpers"
import { apiError } from "@/lib/api-response"
import { enforceSocialLimit } from "@/lib/middleware/rate-limit"
import {
  POLLING_DEFAULT_SINCE_MS,
  POLLING_MAX_SINCE_MS,
  POLLING_TAKE,
} from "@/lib/social/polling-window"

// Base compartilhada das rotas de polling (plano T071) — fallback REST do
// WebSocket (useSocket, T072): o cliente pergunta "o que mudou desde
// `since`?" a cada 30s quando não conectado.

export { POLLING_DEFAULT_SINCE_MS, POLLING_MAX_SINCE_MS, POLLING_TAKE }

export const POLLING_HEADERS = {
  "Cache-Control": "private, no-store",
  Vary: "Authorization",
} satisfies HeadersInit

// Revisão A1: teto da consulta de follows — paridade com
// MAX_FANOUT_FOLLOWERS do fanout realtime (socket-service emitters.ts);
// sem teto o `in: followingIds` varreria a lista inteira do usuário.
export const POLLING_FOLLOW_TAKE = 500

const isoSchema = z.string().datetime({ offset: true })

export type SinceResult = { since: Date } | { invalid: true }

/**
 * `?since=` ISO-8601 opcional — ausente cai na janela default de 5 min;
 * formato inválido → 422 (o cliente deve mandar o timestamp do último
 * poll, sempre ISO). Amplitude limitada a POLLING_MAX_SINCE_MS (24h):
 * `since` mais antigo é limitado ao teto (integridade C1 — sem piso o
 * planner varre o índice inteiro a cada poll; clamp em vez de 422 para
 * o cliente de cursor velho se auto-curar avançando o cursor).
 */
export function resolveSince(searchParams: URLSearchParams): SinceResult {
  const raw = searchParams.get("since")
  if (raw === null) {
    return { since: new Date(Date.now() - POLLING_DEFAULT_SINCE_MS) }
  }
  const parsed = isoSchema.safeParse(raw)
  if (!parsed.success) {
    return { invalid: true }
  }
  const requested = new Date(parsed.data).getTime()
  const floor = Date.now() - POLLING_MAX_SINCE_MS
  return { since: new Date(requested < floor ? floor : requested) }
}

export type UntilResult = { until: Date | null } | { invalid: true }

/**
 * `?until=` ISO-8601 opcional (revisão I-1 — drenagem de backlog):
 * teto superior da janela, usado pelo hook quando a página veio cheia
 * (>= POLLING_TAKE) para varrer o resto sem avançar o `since`. Ausente
 * → `null` (contrato antigo preservado); inválido → 422.
 */
export function resolveUntil(searchParams: URLSearchParams): UntilResult {
  const raw = searchParams.get("until")
  if (raw === null) {
    return { until: null }
  }
  const parsed = isoSchema.safeParse(raw)
  if (!parsed.success) {
    return { invalid: true }
  }
  return { until: new Date(parsed.data) }
}

export interface PollingContext {
  userId: string
  since: Date
  /**
   * Revisão I-1: teto opcional da janela (drenagem de backlog > POLLING_TAKE)
   * — combinado ao `since` como `createdAt: { gte, lt }` (revisão A1:
   * `gte` inclusivo para não perder fronteira de mesmo ms; o cliente
   * deduplica por id).
   */
  until: Date | null
  /**
   * Revisão S: relógio do SERVIDOR capturado ANTES da query — o cliente
   * usa como cursor (o mais antigo entre `sentAt` local e este valor) e
   * nunca pula janela por skew de relógio.
   */
  serverTime: string
}

/**
 * Guard comum das 4 rotas de polling (revisão S — consolidação): auth →
 * rate limit de "polling" → `since` → `until` → `serverTime`. Retorna o
 * `Response` pronto (401/429/422) quando algum estágio reprova; caso
 * contrário o contexto para a query.
 */
export async function guardPolling(
  request: Request,
  reqId: string,
): Promise<PollingContext | Response> {
  const auth = await requireAuth(request, reqId)
  if (auth instanceof Response) return auth

  const rate = await enforceSocialLimit({
    limit: "polling",
    userId: auth.userId,
    reqId,
  })
  if (!rate.allowed) return rate.response

  const { searchParams } = new URL(request.url)
  const since = resolveSince(searchParams)
  if ("invalid" in since) {
    return apiError(
      "VALIDATION_ERROR",
      "Dados invalidos",
      reqId,
      422,
      [{ field: "since", message: "since deve ser uma data ISO-8601" }],
      POLLING_HEADERS,
    )
  }

  const until = resolveUntil(searchParams)
  if ("invalid" in until) {
    return apiError(
      "VALIDATION_ERROR",
      "Dados invalidos",
      reqId,
      422,
      [{ field: "until", message: "until deve ser uma data ISO-8601" }],
      POLLING_HEADERS,
    )
  }

  return {
    userId: auth.userId,
    since: since.since,
    until: until.until,
    serverTime: new Date().toISOString(),
  }
}
