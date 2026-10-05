import { apiError } from "@/lib/api-response"
import { logger, newReqId } from "@/lib/logger"
import { POST_INCLUDE } from "@/lib/social/feed-algorithm"
import { toPublicPost } from "@/lib/social/post-visibility"
import { prisma } from "@/lib/prisma"
import {
  POLLING_FOLLOW_TAKE,
  POLLING_HEADERS,
  POLLING_TAKE,
  guardPolling,
} from "../polling-utils"

export const dynamic = "force-dynamic"

/**
 * GET /api/v1/social/polling/posts (T071): posts dos seguidos criados
 * desde `since` — fallback REST do realtime (T072). Só retorna conteúdo de
 * quem o viewer segue (audience public/followers; o viewer segue todos os
 * autores), `isHidden` excluído e autor ativo; internals do predicado
 * saem via `toPublicPost`.
 */
export async function GET(request: Request): Promise<Response> {
  const reqId = newReqId()

  const guard = await guardPolling(request, reqId)
  if (guard instanceof Response) return guard

  try {
    const following = await prisma.follow.findMany({
      where: { followerId: guard.userId },
      select: { followingId: true },
      take: POLLING_FOLLOW_TAKE,
    })
    const followingIds = following.map((f) => f.followingId)

    const posts = await prisma.post.findMany({
      where: {
        authorId: { in: followingIds },
        isHidden: false,
        audience: { in: ["public", "followers"] },
        createdAt: {
          gte: guard.since,
          ...(guard.until === null ? {} : { lt: guard.until }),
        },
        author: { isActive: true, isBanned: false, deletedAt: null },
      },
      orderBy: { createdAt: "desc" },
      take: POLLING_TAKE,
      include: { author: { select: POST_INCLUDE.author.select } },
    })

    return Response.json(
      {
        data: { posts: posts.map(toPublicPost) },
        serverTime: guard.serverTime,
      },
      { headers: POLLING_HEADERS },
    )
  } catch (error) {
    logger.error({ err: error, reqId }, "[polling:posts] erro ao consultar")
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
