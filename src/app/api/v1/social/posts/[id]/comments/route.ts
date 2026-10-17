import type { Prisma } from "@prisma/client"
import { z } from "zod"

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
import {
  COMMENT_AUTHOR_SELECT,
  REMOVED_COMMENT_CONTENT,
} from "@/lib/social/comments"
import { canComment } from "@/lib/social/privacy"
import { earnVersos, VersosSource } from "@/lib/social/versos"
import { decodeFeedCursor, encodeFeedCursor } from "@/lib/social/feed-algorithm"
import { createCommentSchema } from "@/lib/validators/social"
import { trackComment, trackVersosEarned } from "@/lib/analytics"

import { emitCommentAdded, emitNotification } from "@socket/src/emitters"

export const dynamic = "force-dynamic"

// Mesmos headers do detalhe do post (gated possível — nunca cacheável por
// CDN sem `Vary: Authorization`).
const COMMENTS_HEADERS = {
  "Cache-Control": "private, no-store",
  Vary: "Authorization",
} satisfies Record<string, string>

// RF-SOC-005: lote default 10 raízes; respostas 10 por raiz (espelho do
// preview do detalhe T057), aninhamento de 1 nível.
const COMMENTS_DEFAULT_LIMIT = 10
const COMMENTS_MAX_LIMIT = 50
const REPLIES_TAKE = 10

const commentsQuerySchema = z.object({
  cursor: z.string().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(COMMENTS_MAX_LIMIT).optional(),
})

const COMMENT_AUTHOR_WHERE = {
  isActive: true,
  isBanned: false,
  deletedAt: null,
} satisfies Prisma.UserWhereInput

/**
 * POST /api/v1/social/posts/:id/comments (T077/US-023): cria comentário ou
 * resposta (1 nível — RF-SOC-005). Regras:
 * - Ordem canônica (security.md): CSRF → auth → Zod (espelho do POST
 *   /social/posts) → rate `comment` (30/min) → lookup do post (404 uniforme
 *   Q28, mesmo predicado do GET) → `commentsDisabled` (403
 *   `COMMENTS_DISABLED`) → `whoCanComment` do autor (403 `WHO_CAN_COMMENT`,
 *   fail-closed) → parent no mesmo post/nível-1 (422 uniforme).
 * - `Post.commentCount` +1 no MESMO `$transaction` do insert (S2-19).
 * - Notifica o autor do post ("comentou no seu post") e, em resposta, o
 *   autor do comentário pai ("respondeu ao seu comentário") — nunca ao
 *   próprio comentarista (RF-SOC-005); destinatários distintos (pai == autor
 *   do post → só uma notificação, com a mensagem de resposta).
 * - `earnVersos` (T037: comment=2) no mesmo tx; null = sem UserProfile →
 *   aborta (K2).
 * - Emits pós-commit fire-and-forget: `comment-added` (room `post:{id}` +
 *   `user:{postAuthorId}`) + `notification` (rooms dos notificados) — T070.
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

  let rawBody: unknown
  try {
    rawBody = await request.json()
  } catch {
    return apiError("VALIDATION_ERROR", "Corpo invalido", reqId, 422)
  }

  const parsed = createCommentSchema.safeParse(rawBody)
  if (!parsed.success) {
    return apiError(
      "VALIDATION_ERROR",
      "Dados invalidos",
      reqId,
      422,
      parsed.error.errors.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message,
      })),
    )
  }
  const input = parsed.data

  const { id: postId } = await params

  const rate = await enforceSocialLimit({
    limit: "comment",
    userId: auth.userId,
    reqId,
  })
  if (!rate.allowed) return rate.response

  let commentId = ""
  let createdComment = null as Prisma.CommentGetPayload<{
    include: { author: { select: typeof COMMENT_AUTHOR_SELECT } }
  }> | null
  const createdNotifications = [] as {
    id: string
    type: string
    message: string
    data: unknown
    userId: string
  }[]

  try {
    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: {
        id: true,
        authorId: true,
        audience: true,
        isHidden: true,
        commentsDisabled: true,
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
    if (post.commentsDisabled) {
      return apiError(
        "COMMENTS_DISABLED",
        "Comentarios desativados nesta publicacao",
        reqId,
        403,
        { reason: "post_comments_disabled" },
        rate.headers,
      )
    }
    const decision = await canComment(
      { id: auth.userId },
      { id: post.authorId },
      post.author.profile,
    )
    if (!decision.allowed) {
      return apiError(
        "WHO_CAN_COMMENT",
        "Este autor nao permite comentarios",
        reqId,
        403,
        { reason: decision.reason },
        rate.headers,
      )
    }

    let parent = null as {
      id: string
      postId: string
      authorId: string
      parentCommentId: string | null
    } | null
    if (input.parentCommentId !== undefined) {
      parent = await prisma.comment.findUnique({
        where: { id: input.parentCommentId },
        select: {
          id: true,
          postId: true,
          authorId: true,
          parentCommentId: true,
        },
      })
      // Uniforme para "não existe" / "de outro post" / "resposta de
      // resposta" — não revela a existência de ids alheios (anti-enumeration)
      if (!parent || parent.postId !== postId || parent.parentCommentId) {
        return apiError(
          "VALIDATION_ERROR",
          "Comentario pai invalido",
          reqId,
          422,
          [{ field: "parentCommentId", message: "Comentario pai invalido" }],
          rate.headers,
        )
      }
    }

    const commentAuthor = await prisma.user.findUnique({
      where: { id: auth.userId },
      select: { name: true, displayName: true },
    })
    if (!commentAuthor) {
      return apiError(
        "AUTH_TOKEN_INVALID",
        "Sessao invalida",
        reqId,
        401,
        undefined,
        rate.headers,
      )
    }
    const authorName = commentAuthor.displayName ?? commentAuthor.name

    // Destinatários (RF-SOC-005): autor do post +, em resposta, autor do
    // pai; nunca ao próprio comentarista; pai == autor do post → um só.
    const targets: { userId: string; message: string }[] = []
    const postAuthorNotified = post.authorId !== auth.userId
    if (parent === null) {
      if (postAuthorNotified) {
        targets.push({
          userId: post.authorId,
          message: `${authorName} comentou no seu post`,
        })
      }
    } else if (parent.authorId === post.authorId) {
      if (postAuthorNotified) {
        targets.push({
          userId: post.authorId,
          message: `${authorName} respondeu ao seu comentário`,
        })
      }
    } else {
      if (postAuthorNotified) {
        targets.push({
          userId: post.authorId,
          message: `${authorName} comentou no seu post`,
        })
      }
      if (parent.authorId !== auth.userId) {
        targets.push({
          userId: parent.authorId,
          message: `${authorName} respondeu ao seu comentário`,
        })
      }
    }

    let earnedAmount: number | null = null

    await prisma.$transaction(async (tx) => {
      const row = await tx.comment.create({
        data: {
          postId,
          authorId: auth.userId,
          content: input.content,
          parentCommentId: parent?.id ?? null,
        },
        include: { author: { select: COMMENT_AUTHOR_SELECT } },
      })
      commentId = row.id
      createdComment = row

      // S2-19: contador no MESMO tx do insert
      await tx.post.update({
        where: { id: postId },
        data: { commentCount: { increment: 1 } },
      })

      for (const target of targets) {
        const notif = await tx.notification.create({
          data: {
            userId: target.userId,
            type: "comment",
            message: target.message,
            data: { postId, commentId: row.id },
          },
        })
        createdNotifications.push({
          id: notif.id,
          type: notif.type,
          message: notif.message,
          data: notif.data,
          userId: target.userId,
        })
      }

      // Versos farming protection: check CommentReward marker (one per user+post, never deleted on comment delete)
      const existingReward = await tx.commentReward.findUnique({
        where: { postId_userId: { postId, userId: auth.userId } },
        select: { id: true },
      })
      if (!existingReward) {
        const earned = await earnVersos(auth.userId, VersosSource.Comment, tx)
        if (earned === null) {
          logger.error(
            { reqId, userId: auth.userId },
            "[comments] earnVersos sem UserProfile — abortando tx",
          )
          throw new Error("comment requires UserProfile")
        }
        earnedAmount = earned
        await tx.commentReward.create({
          data: { postId, userId: auth.userId },
        })
      }
    })

    // Row criada na tx (com include de author) vai na resposta 201
    logger.info(
      { reqId, userId: auth.userId, postId, commentId },
      "[comments] criado",
    )

    trackComment(postId, parent !== null)
    if (earnedAmount !== null) {
      trackVersosEarned(VersosSource.Comment, earnedAmount)
    }

    // Realtime (T070): fire-and-forget — o 201 não espera o publish
    void emitCommentAdded({
      postId,
      commentId,
      authorName,
      text: input.content,
      postAuthorId: post.authorId,
    })
    for (const notif of createdNotifications) {
      void emitNotification({
        userId: notif.userId,
        notification: {
          id: notif.id,
          type: notif.type,
          message: notif.message,
          data: notif.data,
        },
      })
    }

    return Response.json(
      { data: { comment: createdComment } },
      { status: 201, headers: rate.headers },
    )
  } catch (error) {
    logger.error({ err: error, reqId }, "[comments] erro interno")
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

/**
 * GET /api/v1/social/posts/:id/comments (T078/US-023): lista raízes com
 * respostas aninhadas de 1 nível (RF-SOC-005), mais recentes primeiro,
 * lote default 10, cursor keyset `(createdAt, id)` no MESMO formato do
 * feed. Envelope S2-18 `{ data: [...], pagination: { nextCursor } }` — o
 * rascunho offset deste documento (docs/04-api/social.md) foi superado pela
 * nota de divergência do próprio doc. Autores banidos/soft-deleted/
 * inativos são filtrados (LGPD, mesma regra do detalhe T057). Post invisível
 * → 404 `POST_NOT_FOUND` uniforme (Q28).
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const reqId = newReqId()

  const auth = await requireAuth(request, reqId)
  if (auth instanceof Response) return auth

  const parsedQuery = commentsQuerySchema.safeParse(
    Object.fromEntries(new URL(request.url).searchParams),
  )
  if (!parsedQuery.success) {
    return apiError("VALIDATION_ERROR", "Query params invalidos", reqId, 422)
  }
  const limit = parsedQuery.data.limit ?? COMMENTS_DEFAULT_LIMIT

  const { id: postId } = await params

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
        COMMENTS_HEADERS,
      )
    }

    // Cursor inválido → página vazia sem restart no topo (contrato do
    // feed T026 — evita duplicar conteúdo em loop)
    const cursorRaw = parsedQuery.data.cursor
    const parsedCursor = cursorRaw ? decodeFeedCursor(cursorRaw) : null
    if (cursorRaw && !parsedCursor) {
      return Response.json(
        { data: [], pagination: { nextCursor: null } },
        { headers: COMMENTS_HEADERS },
      )
    }

    const keyset = parsedCursor
      ? [
          {
            OR: [
              { createdAt: { lt: new Date(parsedCursor.createdAt) } },
              {
                createdAt: new Date(parsedCursor.createdAt),
                id: { lt: parsedCursor.id },
              },
            ],
          },
        ]
      : []

    const rows = await prisma.comment.findMany({
      where: {
        postId,
        parentCommentId: null,
        author: COMMENT_AUTHOR_WHERE,
        content: { not: REMOVED_COMMENT_CONTENT },
        ...(keyset.length > 0 ? { AND: keyset } : {}),
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
      include: {
        author: { select: COMMENT_AUTHOR_SELECT },
        replies: {
          where: {
            author: COMMENT_AUTHOR_WHERE,
            content: { not: REMOVED_COMMENT_CONTENT },
          },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          take: REPLIES_TAKE,
          include: { author: { select: COMMENT_AUTHOR_SELECT } },
        },
      },
    })

    const hasMore = rows.length > limit
    const shown = rows.slice(0, limit)
    const last = shown[shown.length - 1]
    const nextCursor =
      hasMore && last
        ? encodeFeedCursor({ createdAt: last.createdAt.getTime(), id: last.id })
        : null

    return Response.json(
      { data: shown, pagination: { nextCursor } },
      { headers: COMMENTS_HEADERS },
    )
  } catch (error) {
    logger.error({ err: error, reqId }, "[comments/get] erro interno")
    return apiError(
      "INTERNAL_ERROR",
      "Erro interno",
      reqId,
      500,
      undefined,
      COMMENTS_HEADERS,
    )
  }
}
