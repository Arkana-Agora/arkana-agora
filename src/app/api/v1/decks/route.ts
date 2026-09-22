import { getAvailableDecks } from "@/lib/tarot/decks"
import { logger, newReqId } from "@/lib/logger"
import { apiError } from "@/lib/api-response"

export const dynamic = "force-dynamic"

export async function GET(): Promise<Response> {
  const reqId = newReqId()

  try {
    const decks = getAvailableDecks()
    return Response.json({ decks })
  } catch (err) {
    logger.error({ reqId, err }, "[decks] erro ao listar baralhos")
    return apiError("INTERNAL_ERROR", "Erro interno", reqId, 500)
  }
}
