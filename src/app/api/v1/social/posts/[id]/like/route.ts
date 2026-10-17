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
import { earnVersos, VersosSource } from "@/lib/social/versos"
import { trackLike, trackVersosEarned } from "@/lib/analytics"

import { emitLikeUpdated, emitNotification } from "@socket/src/emitters"

export const dynamic = "force-dynamic"

/**
 * Toggle de like (T076/US-023): POST único que curte/descurte (200 nos dois
 * sentidos). Regras:
 * - `Post.likeCount` increment/decrement no MESMO `$transaction` do toggle
 *   (S2-19 — reconciliação em T147).
 * - Auto-like bloqueado (RF-SOC-004): 403 `SELF_LIKE`.
 * - Post invisível (inexistente/`isHidden`/autor banido/soft-deleted/inativo/
 *   gated sem follow) → 404 `POST_NOT_FOUND` com o MESMO predicado do GET
 *   (Q28/anti-timing — nunca revela qual o caso).
 * - Curtidas anônimas (RF-SOC-004): a resposta só expõe `{liked, likeCount}`
 *   — nenhuma lista de quem curtiu.
 * - Notificação ao autor (se ≠ self — implícito pelo 403) com dedupe do par
 *   antes de criar e limpeza no unliked (anti-flood, espelho do unfollow
 *   T043); `earnVersos` (T037) só na criação, **protegido por marcador
 *   `PostLikeReward` (único por par post+user, nunca removido no unlike)**
 *   para evitar farming (SC40/clarifications.md:210-213).
 * - Emits pós-commit fire-and-forget: `like-updated` (room `post:{id}`) +
 *   `notification` (room `user:{authorId}`) — T070/T088, sem duplicar.
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

  const { id: postId } = await params

  const rate = await enforceSocialLimit({
    limit: "like",
    userId: auth.userId,
    reqId,
  })
  if (!rate.allowed) return rate.response

  let liked = false
  let likeCount = 0
  // Row da notificação criada na tx (id/type/message/data) para o emit
  // pós-commit — payload sai da PRÓPRIA row (revisão V5), sem re-derivar.
  let createdNotification = null as {
    id: string
    type: string
    message: string
    data: unknown
  } | null

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
    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: {
        id: true,
        authorId: true,
        audience: true,
        isHidden: true,
        author: { select: POST_DETAIL_AUTHOR_SELECT },
      },
    })
    if (!post || !(await canViewPost(post, auth.userId))) {
      return apiError(
        "POST_NOT_FOUND",
        "Publicacao nao encontrada",
        reqId,
        404,
        undefined,
        rate.headers,
      )
    }
    if (post.authorId === auth.userId) {
      return apiError(
        "SELF_LIKE",
        "Nao e possivel curtir a propria publicacao",
        reqId,
        403,
        { reason: "self_like" },
        rate.headers,
      )
    }

    const liker = await prisma.user.findUnique({
      where: { id: auth.userId },
      select: { name: true, displayName: true },
    })
    if (!liker) {
      return apiError(
        "AUTH_TOKEN_INVALID",
        "Sessao invalida",
        reqId,
        401,
        undefined,
        rate.headers,
      )
    }

    let earnedAmount: number | null = null
    const pairWhere = {
      postId_userId: { postId, userId: auth.userId },
    }
    const notifWhere = {
      userId: post.authorId,
      type: "like",
      data: { equals: { postId, likerId: auth.userId } },
    }

    await prisma.$transaction(async (tx) => {
      const existing = await tx.postLike.findUnique({
        where: pairWhere,
        select: { id: true },
      })

      if (existing) {
        await tx.postLike.delete({ where: pairWhere })
        const updated = await tx.post.update({
          where: { id: postId },
          data: { likeCount: { decrement: 1 } },
          select: { likeCount: true },
        })
        likeCount = updated.likeCount
        liked = false
        // Unliked remove a notificação do par (anti-flood — espelho do
        // unfollow T043): re-liked recria com dedupe.
        await tx.notification.deleteMany({ where: notifWhere })
      } else {
        await tx.postLike.create({ data: { postId, userId: auth.userId } })
        const updated = await tx.post.update({
          where: { id: postId },
          data: { likeCount: { increment: 1 } },
          select: { likeCount: true },
        })
        likeCount = updated.likeCount
        liked = true
        await tx.notification.deleteMany({ where: notifWhere })
        const likerName = liker.displayName ?? liker.name
        const row = await tx.notification.create({
          data: {
            userId: post.authorId,
            type: "like",
            message: `${likerName} curtiu sua publicação`,
            data: { postId, likerId: auth.userId },
          },
        })
        createdNotification = {
          id: row.id,
          type: row.type,
          message: row.message,
          data: row.data,
        }
        // Versos farming protection: check PostLikeReward marker (never deleted on unlike)
        const existingReward = await tx.postLikeReward.findUnique({
          where: { postId_userId: { postId, userId: auth.userId } },
          select: { id: true },
        })
        if (!existingReward) {
          const earned = await earnVersos(auth.userId, VersosSource.Like, tx)
          if (earned === null) {
            logger.error(
              { reqId, userId: auth.userId },
              "[like] earnVersos sem UserProfile — abortando tx",
            )
            throw new Error("like requires UserProfile")
          }
          earnedAmount = earned
          await tx.postLikeReward.create({
            data: { postId, userId: auth.userId },
          })
        }
      }
    })

    logger.info(
      { reqId, userId: auth.userId, postId, liked, likeCount },
      "[like] toggle",
    )

    trackLike(postId)
    if (earnedAmount !== null) {
      trackVersosEarned(VersosSource.Like, earnedAmount)
    }

    // Realtime (T070/T088): fire-and-forget — o 200 não espera o publish.
    void emitLikeUpdated({ postId, newCount: likeCount })
    if (liked && createdNotification !== null) {
      void emitNotification({
        userId: post.authorId,
        notification: {
          id: createdNotification.id,
          type: createdNotification.type,
          message: createdNotification.message,
          data: createdNotification.data,
        },
      })
    }

    return respond()
  } catch (error) {
    try {
      // A tx rollbackou — NAO inferir qual constraint falhou: re-ler a
      // fonte de verdade e responder conforme o estado real (espelho do
      // follow T043). A requisição vencedora cuida da notification.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        (error.code === "P2002" || error.code === "P2025")
      ) {
        const link = await prisma.postLike.findUnique({
          where: { postId_userId: { postId, userId: auth.userId } },
          select: { id: true },
        })
        const fresh = await prisma.post.findUnique({
          where: { id: postId },
          select: { likeCount: true },
        })
        liked = link != null
        likeCount = fresh?.likeCount ?? 0
        logger.info(
          { reqId, userId: auth.userId, postId, code: error.code, liked },
          "[like] corrida resolvida pela fonte de verdade",
        )
        void emitLikeUpdated({ postId, newCount: likeCount })
        return respond()
      }
      logger.error({ err: error, reqId }, "[like] erro interno")
      return internal()
    } catch (handlerError) {
      logger.error(
        { err: handlerError, reqId },
        "[like] falha no handler de erro de corrida",
      )
      return internal()
    }
  }
}
