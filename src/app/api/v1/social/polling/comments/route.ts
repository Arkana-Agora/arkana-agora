import { apiError } from "@/lib/api-response"
import { logger, newReqId } from "@/lib/logger"
import { prisma } from "@/lib/prisma"
import { POLLING_HEADERS, POLLING_TAKE, guardPolling } from "../polling-utils"

export const dynamic = "force-dynamic"

/**
 * GET /api/v1/social/polling/comments (T071): comentários recebidos nos
 * posts próprios desde `since` — fallback REST do evento `comment-added`.
 */
export async function GET(request: Request): Promise<Response> {
  const reqId = newReqId()

  const guard = await guardPolling(request, reqId)
  if (guard instanceof Response) return guard

  try {
    const comments = await prisma.comment.findMany({
      where: {
        createdAt: {
          gte: guard.since,
          ...(guard.until === null ? {} : { lt: guard.until }),
        },
        post: { authorId: guard.userId, isHidden: false },
        // Revisão R: mesmos predicados do detalhe — autores de comentários
        // banidos/soft-deleted/inativos não voltam pelo fallback
        author: { isActive: true, isBanned: false, deletedAt: null },
      },
      orderBy: { createdAt: "desc" },
      take: POLLING_TAKE,
      select: {
        id: true,
        postId: true,
        authorId: true,
        parentCommentId: true,
        content: true,
        createdAt: true,
      },
    })

    return Response.json(
      { data: { comments }, serverTime: guard.serverTime },
      { headers: POLLING_HEADERS },
    )
  } catch (error) {
    logger.error({ err: error, reqId }, "[polling:comments] erro ao consultar")
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
