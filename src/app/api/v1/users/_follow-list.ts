import { findVisibleProfile, optionalAuth } from "@/app/api/v1/users/_helpers"
import { apiError } from "@/lib/api-response"
import { logger } from "@/lib/logger"
import { listFollows, type FollowListSide } from "@/lib/social/follow-lists"
import { usernameSchema } from "@/lib/validators/profile"
import { z } from "zod"

/**
 * Handler compartilhado das listas sociais (T044 followers / T045
 * following): usa findVisibleProfile (valida username, honra perfil
 * privado/statsVisibility, LGPD), valida query params (cursor/q/limit
 * com zod), pagina por cursor e responde o envelope
 * `{ data, pagination: { nextCursor } }` (S2-18/SC30).
 */
const followListQuerySchema = z.object({
  cursor: z.string().max(200).optional(),
  q: z.string().max(50).optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
})

export async function handleFollowList(
  request: Request,
  usernameRaw: string,
  side: FollowListSide,
  reqId: string,
): Promise<Response> {
  const parsed = usernameSchema.safeParse(usernameRaw)
  if (!parsed.success) {
    logger.info({ reqId, side }, "[follow-list] username invalido")
    return apiError("VALIDATION_ERROR", "Username invalido", reqId, 422)
  }

  // Validação da query ANTES do banco: 422 não depende de disponibilidade
  // de DB e elimina o oráculo 404/422 (perfil inexistente x stats privados).
  const parsedQuery = followListQuerySchema.safeParse(
    Object.fromEntries(new URL(request.url).searchParams),
  )
  if (!parsedQuery.success) {
    logger.info(
      { reqId, side, issues: parsedQuery.error.flatten() },
      "[follow-list] query invalida",
    )
    return apiError("VALIDATION_ERROR", "Query params invalidos", reqId, 422)
  }

  try {
    // findVisibleProfile faz acesso a banco — dentro do try para garantir o
    // envelope JSON { error, meta.requestId } em qualquer falha.
    const visible = await findVisibleProfile(parsed.data, reqId)
    if (!visible) {
      logger.info(
        { reqId, side, username: usernameRaw },
        "[follow-list] perfil nao visivel",
      )
      return apiError("USER_NOT_FOUND", "Usuario nao encontrado", reqId, 404)
    }

    const viewerId = await optionalAuth(request)

    // SC38: statsVisibility "private" esconde as listas sociais de todo
    // mundo, exceto o proprio dono (viewerId === userId do perfil).
    if (!visible.showStats && viewerId !== visible.profile.userId) {
      logger.info(
        { reqId, side, username: usernameRaw },
        "[follow-list] statsVisibility privado",
      )
      return apiError("USER_NOT_FOUND", "Usuario nao encontrado", reqId, 404)
    }

    const page = await listFollows({
      side,
      targetUserId: visible.profile.userId,
      cursor: parsedQuery.data.cursor ?? null,
      q: parsedQuery.data.q ?? null,
      ...(parsedQuery.data.limit !== undefined
        ? { limit: parsedQuery.data.limit }
        : {}),
      viewerId,
    })

    // Resposta depende do viewer (isFollowing, stats do dono): impede que
    // cache/CDN compartilhado sirva o estado de um usuário a outro.
    return Response.json(
      {
        data: page.data,
        pagination: { nextCursor: page.nextCursor },
      },
      {
        headers: {
          "Cache-Control": "private, no-store",
          Vary: "Authorization",
        },
      },
    )
  } catch (error) {
    logger.error({ err: error, reqId, side }, "[follow-list] erro interno")
    return apiError("INTERNAL_ERROR", "Erro interno", reqId, 500)
  }
}
