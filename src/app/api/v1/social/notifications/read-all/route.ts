import { requireAuth } from "@/app/api/v1/users/_helpers"
import { apiError } from "@/lib/api-response"
import { logger, newReqId } from "@/lib/logger"
import { enforceCsrf } from "@/lib/middleware/csrf"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

/**
 * PATCH /api/v1/social/notifications/read-all (T084/US-023): marca todas as
 * não-lidas do viewer como lidas (idempotente — `updated: 0` quando não há
 * pendências). Restrito ao próprio usuário pelo `where` (userId sempre
 * presente). Mesma observação de rate do T083 (sem bucket `notification`).
 */
export async function PATCH(request: Request): Promise<Response> {
  const reqId = newReqId()

  const csrfError = enforceCsrf(request, reqId)
  if (csrfError) return csrfError

  const auth = await requireAuth(request, reqId)
  if (auth instanceof Response) return auth

  try {
    const result = await prisma.notification.updateMany({
      where: { userId: auth.userId, isRead: false },
      data: { isRead: true },
    })

    return Response.json({ data: { updated: result.count } })
  } catch (error) {
    logger.error({ err: error, reqId }, "[notifications/read-all] erro interno")
    return apiError("INTERNAL_ERROR", "Erro interno", reqId, 500)
  }
}
