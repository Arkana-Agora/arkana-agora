import { apiError } from "@/lib/api-response"
import { logger, newReqId } from "@/lib/logger"
import { prisma } from "@/lib/prisma"
import { POLLING_HEADERS, POLLING_TAKE, guardPolling } from "../polling-utils"

export const dynamic = "force-dynamic"

/**
 * GET /api/v1/social/polling/likes (T071): curtidas recebidas nos posts
 * próprios desde `since` — fallback REST do evento `like-updated`. Só
 * entrega metadados (postId/userId/createdAt); RF-SOC-004 não expõe lista
 * completa de quem curtiu.
 */
export async function GET(request: Request): Promise<Response> {
  const reqId = newReqId()

  const guard = await guardPolling(request, reqId)
  if (guard instanceof Response) return guard

  try {
    const likes = await prisma.postLike.findMany({
      where: {
        createdAt: {
          gte: guard.since,
          ...(guard.until === null ? {} : { lt: guard.until }),
        },
        post: { authorId: guard.userId, isHidden: false },
        // Revisão A1: likers banidos/soft-deleted/inativos não voltam pelo
        // fallback (mesmos predicados do comentário em comments/route.ts)
        user: { isActive: true, isBanned: false, deletedAt: null },
      },
      orderBy: { createdAt: "desc" },
      take: POLLING_TAKE,
      select: { id: true, postId: true, userId: true, createdAt: true },
    })

    return Response.json(
      { data: { likes }, serverTime: guard.serverTime },
      { headers: POLLING_HEADERS },
    )
  } catch (error) {
    logger.error({ err: error, reqId }, "[polling:likes] erro ao consultar")
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
