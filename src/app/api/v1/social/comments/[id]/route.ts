import { requireAuth } from "@/app/api/v1/users/_helpers"
import { apiError } from "@/lib/api-response"
import { logger, newReqId } from "@/lib/logger"
import { enforceSocialLimit } from "@/lib/middleware/rate-limit"
import { enforceCsrf } from "@/lib/middleware/csrf"
import { prisma } from "@/lib/prisma"
import {
  COMMENT_AUTHOR_SELECT,
  REMOVED_COMMENT_CONTENT,
} from "@/lib/social/comments"
import { updateCommentSchema } from "@/lib/validators/social"

export const dynamic = "force-dynamic"

// RF-SOC-005 / CHK003: o autor pode editar a própria resposta apenas nos
// primeiros 15 minutos; remoção (soft delete) não tem janela.
const EDIT_WINDOW_MS = 15 * 60 * 1000

/**
 * PATCH /api/v1/social/comments/:id (T079/US-023): edição da própria
 * resposta (reply) dentro da janela de 15 min (CHK003). Ordem canônica
 * (security.md): CSRF → auth → Zod → rate `comment` → lookup (404 uniforme
 * para inexistente/alheio/removido) → janela (403 `COMMENT_EDIT_EXPIRED`).
 * Sem transaction (update único, sem contadores — S2-19 é só no DELETE
 * em T080) e sem emit (o plano não prevê evento de edição).
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

  let rawBody: unknown
  try {
    rawBody = await request.json()
  } catch {
    return apiError("VALIDATION_ERROR", "Corpo invalido", reqId, 422)
  }

  const parsed = updateCommentSchema.safeParse(rawBody)
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

  const { id: commentId } = await params

  const rate = await enforceSocialLimit({
    limit: "comment",
    userId: auth.userId,
    reqId,
  })
  if (!rate.allowed) return rate.response

  try {
    const result = await prisma.$transaction(async (tx) => {
      const comment = await tx.comment.findUnique({
        where: { id: commentId },
        select: { id: true, authorId: true, content: true, createdAt: true },
      })
      if (
        !comment ||
        comment.authorId !== auth.userId ||
        comment.content === REMOVED_COMMENT_CONTENT
      ) {
        return { success: false, reason: "not_found" }
      }

      if (Date.now() - comment.createdAt.getTime() > EDIT_WINDOW_MS) {
        return { success: false, reason: "expired" }
      }

      const updated = await tx.comment.update({
        where: { id: commentId },
        data: { content: parsed.data.content },
        include: { author: { select: COMMENT_AUTHOR_SELECT } },
      })

      return { success: true, comment: updated }
    })

    if (!result.success) {
      if (result.reason === "expired") {
        return apiError(
          "COMMENT_EDIT_EXPIRED",
          "Janela de edicao expirada",
          reqId,
          403,
          undefined,
          rate.headers,
        )
      }
      return apiError(
        "COMMENT_NOT_FOUND",
        "Comentario nao encontrado",
        reqId,
        404,
        undefined,
        rate.headers,
      )
    }

    return Response.json(
      { data: { comment: result.comment } },
      { status: 200, headers: rate.headers },
    )
  } catch (error) {
    logger.error({ err: error, reqId }, "[comments/patch] erro interno")
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
 * DELETE /api/v1/social/comments/:id (T080/US-023): soft delete da própria
 * resposta (sem janela) — content → "[removido]" e `Post.commentCount` −1
 * no MESMO `$transaction` (S2-19). Segundo delete → 404 uniforme (marcação
 * `[removido]`), sem duplo decremento. Sem emit (sem evento documentado).
 */
export async function DELETE(
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
    limit: "comment",
    userId: auth.userId,
    reqId,
  })
  if (!rate.allowed) return rate.response

  try {
    const result = await prisma.$transaction(async (tx) => {
      const comment = await tx.comment.findUnique({
        where: { id: commentId },
        select: { id: true, postId: true, authorId: true, content: true },
      })
      if (
        !comment ||
        comment.authorId !== auth.userId ||
        comment.content === REMOVED_COMMENT_CONTENT
      ) {
        return { success: false }
      }

      await tx.comment.update({
        where: { id: commentId },
        data: { content: REMOVED_COMMENT_CONTENT },
      })

      await tx.post.update({
        where: { id: comment.postId },
        data: { commentCount: { decrement: 1 } },
      })

      return { success: true }
    })

    if (!result.success) {
      return apiError(
        "COMMENT_NOT_FOUND",
        "Comentario nao encontrado",
        reqId,
        404,
        undefined,
        rate.headers,
      )
    }

    return Response.json(
      { data: { deleted: true } },
      { status: 200, headers: rate.headers },
    )
  } catch (error) {
    logger.error({ err: error, reqId }, "[comments/delete] erro interno")
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
