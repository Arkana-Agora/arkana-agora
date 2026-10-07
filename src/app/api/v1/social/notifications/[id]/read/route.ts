import { requireAuth } from "@/app/api/v1/users/_helpers"
import { apiError } from "@/lib/api-response"
import { logger, newReqId } from "@/lib/logger"
import { enforceCsrf } from "@/lib/middleware/csrf"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

/**
 * PATCH /api/v1/social/notifications/:id/read (T083/US-023): marca a própria
 * notificação como lida (idempotente). `updateMany` com `userId` no `where`
 * faz ownership + mutação numa query só — inexistente/alheia → 404 uniforme
 * `NOTIFICATION_NOT_FOUND` (anti-enumeração, espelho do T079/T080). Sem
 * rate bucket dedicado (S2-10 não prevê `notification`; precedente:
 * `DELETE /users/me/avatar`) — pendência de política, anotada na sincronia
 * de docs da fase.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const reqId = newReqId()

  const csrfError = enforceCsrf(request, reqId)
  if (csrfError) return csrfError

  const auth = await requireAuth(request, reqId)
  if (auth instanceof Response) return auth

  const { id: notificationId } = await params

  try {
    const result = await prisma.notification.updateMany({
      where: { id: notificationId, userId: auth.userId },
      data: { isRead: true },
    })

    if (result.count === 0) {
      return apiError(
        "NOTIFICATION_NOT_FOUND",
        "Notificacao nao encontrada",
        reqId,
        404,
      )
    }

    return Response.json({ data: { read: true } })
  } catch (error) {
    logger.error({ err: error, reqId }, "[notifications/read] erro interno")
    return apiError("INTERNAL_ERROR", "Erro interno", reqId, 500)
  }
}
