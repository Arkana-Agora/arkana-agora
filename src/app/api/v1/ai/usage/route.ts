import { logger, newReqId } from "@/lib/logger"
import { requireAuth } from "@/app/api/v1/users/_helpers"
import { apiError } from "@/lib/api-response"
import { getUsageStats } from "@/services/ai-service"

export const dynamic = "force-dynamic"

export async function GET(request: Request): Promise<Response> {
  const reqId = newReqId()

  const auth = await requireAuth(request, reqId)
  if (auth instanceof Response) return auth

  try {
    const stats = await getUsageStats(auth.userId)
    return Response.json(stats)
  } catch (err) {
    logger.error({ reqId, err }, "[ai/usage] erro ao buscar uso de IA")
    return apiError("INTERNAL_ERROR", "Erro interno", reqId, 500)
  }
}
