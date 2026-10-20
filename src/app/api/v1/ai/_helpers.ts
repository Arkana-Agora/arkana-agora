import { logger } from "@/lib/logger"
import { apiError } from "@/lib/api-response"
import { getAIClient, type AIClient } from "@/lib/ai/client"
import {
  refundInterpretationQuota,
  refundFollowUpQuota,
} from "@/services/ai-service"

// Fail-fast + devolução de quota compartilhados pelas rotas
// POST /api/v1/ai/{interpret,arcana-interpret,follow-up}. Antes desta
// extração os três routes duplicavam o mesmo try/catch (~100 linhas) e
// já tinham divergido (só o interpret cobria "não devolve em sucesso").

export function requireAIClient(
  reqId: string,
  scope: string,
): AIClient | Response {
  try {
    return getAIClient()
  } catch (err) {
    logger.error({ reqId, err }, `[${scope}] cliente IA indisponivel`)
    return apiError(
      "AI_SERVICE_UNAVAILABLE",
      "Servico de IA indisponivel no momento",
      reqId,
      503,
    )
  }
}

export interface QuotaReservation {
  markConsumed(): void
  tryRefund(scope: string): Promise<void>
}

// A quota é reservada antes do stream (anti-concorrência); a devolução é
// one-shot e só quando NADA foi entregue ao cliente (fullText vazio).
// Cancelamento do cliente depois de tokens entregues NÃO devolve — seria
// forcável para gerar sem pagar quota (review de segurança, SPRINT2-F3).
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
        logger.error(
          { reqId, err: refundErr },
          `[${scope}] falha ao devolver quota`,
        )
      }
    },
  }
}

export function sseResponse(stream: ReadableStream<Uint8Array>): Response {
  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  })
}
