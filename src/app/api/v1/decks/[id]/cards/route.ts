import { getDeckById, getDeckCards } from "@/lib/tarot/decks"
import { logger, newReqId } from "@/lib/logger"
import { apiError } from "@/lib/api-response"

export const dynamic = "force-dynamic"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const reqId = newReqId()
  const { id } = await params

  try {
    const deck = getDeckById(id)
    if (!deck) {
      logger.info({ reqId, deckId: id }, "[deck-cards] baralho nao encontrado")
      return apiError("NOT_FOUND", "Baralho nao encontrado", reqId, 404)
    }

    const cards = getDeckCards(id)
    return Response.json({ deck, cards })
  } catch (err) {
    logger.error({ reqId, err }, "[deck-cards] erro ao buscar cartas")
    return apiError("INTERNAL_ERROR", "Erro interno", reqId, 500)
  }
}
