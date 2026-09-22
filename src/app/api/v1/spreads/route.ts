import spreadsData from "@/data/spreads.json"
import { logger, newReqId } from "@/lib/logger"
import { apiError } from "@/lib/api-response"
import type { Spread } from "@/types/tarot"

const VALID_DECK_TYPES = new Set(["tarot", "lenormand"])

export const dynamic = "force-dynamic"

export async function GET(request: Request): Promise<Response> {
  const reqId = newReqId()
  const url = new URL(request.url)
  const deckType = url.searchParams.get("deckType")

  try {
    let spreads = spreadsData as Spread[]

    if (deckType) {
      if (!VALID_DECK_TYPES.has(deckType)) {
        logger.info({ reqId, deckType }, "[spreads] deckType invalido")
        return apiError(
          "VALIDATION_ERROR",
          "deckType invalido. Valores validos: tarot, lenormand",
          reqId,
          422,
        )
      }
      spreads = spreads.filter((s) => s.deckType === deckType)
    }

    return Response.json({ spreads })
  } catch (err) {
    logger.error({ reqId, err }, "[spreads] erro ao listar espalhamentos")
    return apiError("INTERNAL_ERROR", "Erro interno", reqId, 500)
  }
}
