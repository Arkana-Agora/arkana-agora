import { logger, newReqId } from "@/lib/logger"
import { requireAuth } from "@/app/api/v1/users/_helpers"
import { getDailyLimitStatus } from "@/lib/tarot/helpers"
import { apiError } from "@/lib/api-response"

export const dynamic = "force-dynamic"

export async function GET(request: Request): Promise<Response> {
  const reqId = newReqId()

  const auth = await requireAuth(request, reqId)
  if (auth instanceof Response) return auth

  try {
    const { count, tier, limit } = await getDailyLimitStatus(auth.userId)

    return Response.json({
      count,
      totalLimit: limit.remaining + count,
      remaining: limit.remaining,
      tier,
    })
  } catch (err) {
    logger.error({ reqId, err }, "[daily-count] erro ao buscar contagem")
    return apiError("INTERNAL_ERROR", "Erro interno", reqId, 500)
  }
}
