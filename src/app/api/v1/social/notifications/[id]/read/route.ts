import { requireAuth } from "@/app/api/v1/users/_helpers"
import { apiError } from "@/lib/api-response"
import { logger, newReqId } from "@/lib/logger"
import { enforceCsrf } from "@/lib/middleware/csrf"
import { enforceSocialLimit } from "@/lib/middleware/rate-limit"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

/**
 * PATCH /api/v1/social/notifications/:id/read (T083/US-023): marca a própria
 * notificação como lida (idempotente). `updateMany` com `userId` no `where`
 * faz ownership + mutação numa query só — inexistente/alheia → 404 uniforme
 * `NOTIFICATION_NOT_FOUND` (anti-enumeração, espelho do T079/T080).
 *
 * Ordem canônica (security.md): CSRF → auth → rate `notification` (60/min,
 * janela compartilhada com `read-all`) → lookup. Revisão R7a: as duas rotas
 * de escrita de notificação não tinham bucket nenhum.
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

  const rate = await enforceSocialLimit({
    limit: "notification",
    userId: auth.userId,
    reqId,
  })
  if (!rate.allowed) return rate.response

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
        undefined,
        rate.headers,
      )
    }

    return Response.json({ data: { read: true } }, { headers: rate.headers })
  } catch (error) {
    logger.error({ err: error, reqId }, "[notifications/read] erro interno")
    return apiError(
      "INTERNAL_ERROR",
      "Erro interno",
      reqId,
      500,
      undefined,
      rate.headers,
    )
  }
}
