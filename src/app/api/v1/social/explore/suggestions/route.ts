import { requireAuth } from "@/app/api/v1/users/_helpers"
import { apiError } from "@/lib/api-response"
import { logger, newReqId } from "@/lib/logger"
import { getExploreSuggestions } from "@/lib/social/explore"

export const dynamic = "force-dynamic"

const EXPLORE_HEADERS = {
  "Cache-Control": "private, no-store",
  Vary: "Authorization",
} satisfies HeadersInit

/**
 * GET /api/v1/social/explore/suggestions (T055/US-022): perfis para
 * seguir — exclui o próprio viewer, já-seguidos, banidos, inativos,
 * soft-deleted e perfis `private`; ordem: profissionais
 * (`UserRole.PROFESSIONAL`) primeiro, depois `followersCount` desc
 * (decisão do dono 2026-09-30 — sprint-2 task 31 "perfis populares,
 * profissionais"); limit 10. Resposta fixa → envelope `{ data: { users } }`
 * sem `pagination` (não é rota cursor — S2-18).
 */
export async function GET(request: Request): Promise<Response> {
  const reqId = newReqId()

  const auth = await requireAuth(request, reqId)
  if (auth instanceof Response) return auth

  try {
    const users = await getExploreSuggestions(auth.userId)
    return Response.json({ data: { users } }, { headers: EXPLORE_HEADERS })
  } catch (error) {
    logger.error(
      { err: error, reqId },
      "[explore/suggestions] erro ao montar sugestoes",
    )
    return apiError(
      "INTERNAL_ERROR",
      "Erro interno",
      reqId,
      500,
      undefined,
      EXPLORE_HEADERS,
    )
  }
}
