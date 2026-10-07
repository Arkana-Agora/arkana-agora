import { Prisma } from "@prisma/client"

import { requireAuth } from "@/app/api/v1/users/_helpers"
import { apiError } from "@/lib/api-response"
import { logger, newReqId } from "@/lib/logger"
import { enforceSocialLimit } from "@/lib/middleware/rate-limit"
import { enforceCsrf } from "@/lib/middleware/csrf"
import { prisma } from "@/lib/prisma"
import {
  canViewPost,
  POST_DETAIL_AUTHOR_SELECT,
} from "@/lib/social/post-visibility"
import { REMOVED_COMMENT_CONTENT } from "@/lib/social/comments"

import { emitCommentLikeUpdated } from "@socket/src/emitters"

export const dynamic = "force-dynamic"

/**
 * Toggle de like de comentário (T081/US-023): POST único curte/descurte
 * (200 nos dois sentidos), espelho do like de post (T076) SEM os itens que
 * o plano T081 não manda: auto-like, Notification, earnVersos e analytics.
 * Regras:
 * - `Comment.likeCount` increment/decrement no MESMO `$transaction` do
 *   toggle (S2-19 — reconciliação em T147).
 * - Comentário invisível (inexistente/removido/post inaudível pelo MESMO
 *   predicado do GET/Q28) → 404 `COMMENT_NOT_FOUND` uniforme.
 * - RF-SOC-005: a resposta só expõe `{liked, likeCount}` — nenhuma lista
 *   de quem curtiu; rate limit `checkLikeLimit` (T027, bucket `like`).
 * - Emits pós-commit fire-and-forget: `comment-like-updated` (room
 *   `post:{postId}`) — T070/T088, sem Notification.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const reqId = newReqId()

  const csrfError = enforceCsrf(request, reqId)
  if (csrfError) return csrfError

  const auth = await requireAuth(request, reqId)
  if (auth instanceof Response) return auth

  const { id: commentId } = await params

  const rate = await enforceSocialLimit({
    limit: "like",
    userId: auth.userId,
    reqId,
  })
  if (!rate.allowed) return rate.response

  let liked = false
  let likeCount = 0

  const respond = () =>
    Response.json({ data: { liked, likeCount } }, { headers: rate.headers })
  const internal = () =>
    apiError(
      "INTERNAL_ERROR",
      "Erro interno",
      reqId,
      500,
      undefined,
      rate.headers,
    )

  try {
    const comment = await prisma.comment.findUnique({
      where: { id: commentId },
      select: {
        id: true,
        postId: true,
        content: true,
        post: {
          select: {
            id: true,
            authorId: true,
            audience: true,
            isHidden: true,
            author: { select: POST_DETAIL_AUTHOR_SELECT },
          },
        },
      },
    })
    if (
      !comment ||
      comment.content === REMOVED_COMMENT_CONTENT ||
      !(await canViewPost(comment.post, auth.userId))
    ) {
      return apiError(
        "COMMENT_NOT_FOUND",
        "Comentario nao encontrado",
        reqId,
        404,
        undefined,
        rate.headers,
      )
    }

    const pairWhere = {
      commentId_userId: { commentId, userId: auth.userId },
    }

    await prisma.$transaction(async (tx) => {
      const existing = await tx.commentLike.findUnique({
        where: pairWhere,
        select: { id: true },
      })

      if (existing) {
        await tx.commentLike.delete({ where: pairWhere })
        const updated = await tx.comment.update({
          where: { id: commentId },
          data: { likeCount: { decrement: 1 } },
          select: { likeCount: true },
        })
        likeCount = updated.likeCount
        liked = false
      } else {
        await tx.commentLike.create({
          data: { commentId, userId: auth.userId },
        })
        const updated = await tx.comment.update({
          where: { id: commentId },
          data: { likeCount: { increment: 1 } },
          select: { likeCount: true },
        })
        likeCount = updated.likeCount
        liked = true
      }
    })

    logger.info(
      { reqId, userId: auth.userId, commentId, liked, likeCount },
      "[comment-like] toggle",
    )

    // Realtime (T070/T088): fire-and-forget — o 200 não espera o publish.
    void emitCommentLikeUpdated({
      commentId,
      postId: comment.postId,
      newCount: likeCount,
    })

    return respond()
  } catch (error) {
    try {
      // A tx rollbackou — NAO inferir qual constraint falhou: re-ler a
      // fonte de verdade e responder conforme o estado real (espelho do
      // like de post T076).
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        (error.code === "P2002" || error.code === "P2025")
      ) {
        const link = await prisma.commentLike.findUnique({
          where: { commentId_userId: { commentId, userId: auth.userId } },
          select: { id: true },
        })
        const fresh = await prisma.comment.findUnique({
          where: { id: commentId },
          select: { postId: true, likeCount: true },
        })
        liked = link != null
        likeCount = fresh?.likeCount ?? 0
        logger.info(
          { reqId, userId: auth.userId, commentId, code: error.code, liked },
          "[comment-like] corrida resolvida pela fonte de verdade",
        )
        void emitCommentLikeUpdated({
          commentId,
          postId: fresh?.postId ?? "",
          newCount: likeCount,
        })
        return respond()
      }
      logger.error({ err: error, reqId }, "[comment-like] erro interno")
      return internal()
    } catch (handlerError) {
      logger.error(
        { err: handlerError, reqId },
        "[comment-like] falha no handler de erro de corrida",
      )
      return internal()
    }
  }
}
