import { apiError } from "@/lib/api-response"
import { logger, newReqId } from "@/lib/logger"
import { prisma } from "@/lib/prisma"
import { POLLING_HEADERS, POLLING_TAKE, guardPolling } from "../polling-utils"

export const dynamic = "force-dynamic"

/**
 * GET /api/v1/social/polling/notifications (T071): notificações do
 * usuário desde `since` + contagem não-lida — fallback REST do evento
 * `notification`.
 */
export async function GET(request: Request): Promise<Response> {
  const reqId = newReqId()

  const guard = await guardPolling(request, reqId)
  if (guard instanceof Response) return guard

  try {
    const [notifications, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where: {
          userId: guard.userId,
          createdAt: {
            gte: guard.since,
            ...(guard.until === null ? {} : { lt: guard.until }),
          },
        },
        orderBy: { createdAt: "desc" },
        take: POLLING_TAKE,
      }),
      prisma.notification.count({
        where: { userId: guard.userId, isRead: false },
      }),
    ])

    return Response.json(
      {
        data: { notifications, unreadCount },
        serverTime: guard.serverTime,
      },
      { headers: POLLING_HEADERS },
    )
  } catch (error) {
    logger.error(
      { err: error, reqId },
      "[polling:notifications] erro ao consultar",
    )
    return apiError(
      "INTERNAL_ERROR",
      "Erro interno",
      reqId,
      500,
      undefined,
      POLLING_HEADERS,
    )
  }
}
