import { requireAuth } from "@/app/api/v1/users/_helpers"
import { apiError } from "@/lib/api-response"
import { logger, newReqId } from "@/lib/logger"
import { getTrendingHashtags } from "@/lib/social/explore"

export const dynamic = "force-dynamic"

const EXPLORE_HEADERS = {
  "Cache-Control": "private, no-store",
  Vary: "Authorization",
} satisfies HeadersInit

/**
 * GET /api/v1/social/explore/hashtags (T054/US-022): top 10 hashtags dos
 * posts públicos da última semana (decisão do dono 2026-09-30), ordenado
 * por `count` desc com desempate alfabético; tags de autores `private`
 * não contam. Resposta fixa → envelope `{ data: { hashtags } }` sem
 * `pagination` (não é rota cursor — S2-18).
 */
export async function GET(request: Request): Promise<Response> {
  const reqId = newReqId()

  const auth = await requireAuth(request, reqId)
  if (auth instanceof Response) return auth

  try {
    const hashtags = await getTrendingHashtags()
    return Response.json({ data: { hashtags } }, { headers: EXPLORE_HEADERS })
  } catch (error) {
    logger.error(
      { err: error, reqId },
      "[explore/hashtags] erro ao montar hashtags",
    )
    return apiError(
      "INTERNAL_ERROR",
      "Erro interno",
      reqId,
      500,
      undefined,
      EXPLORE_HEADERS,
    )
  }
}
