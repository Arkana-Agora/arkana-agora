import { requireAuth } from "@/app/api/v1/users/_helpers"
import { apiError } from "@/lib/api-response"
import { logger, newReqId } from "@/lib/logger"
import { getTrendingPosts } from "@/lib/social/explore"
import { toPublicPost } from "@/lib/social/post-visibility"

export const dynamic = "force-dynamic"

const EXPLORE_HEADERS = {
  "Cache-Control": "private, no-store",
  Vary: "Authorization",
} satisfies HeadersInit

/**
 * GET /api/v1/social/explore/trending (T053/US-022): posts públicos da
 * última semana (decisão do dono 2026-09-30) ordenados por
 * `engagementScore = likeCount + commentCount×2` desc, limit 20; autores
 * inativos/banidos/soft-deleted/ocultos e perfis `private` ficam de fora
 * (regras em `src/lib/social/explore.ts`).
 *
 * Resposta fixa (sem cursor) → envelope `{ data: { posts } }` sem bloco
 * `pagination` (S2-18 cobre rotas cursor; nenhuma query aceita aqui).
 */
export async function GET(request: Request): Promise<Response> {
  const reqId = newReqId()

  const auth = await requireAuth(request, reqId)
  if (auth instanceof Response) return auth

  try {
    const posts = await getTrendingPosts()
    return Response.json(
      { data: { posts: posts.map(toPublicPost) } },
      { headers: EXPLORE_HEADERS },
    )
  } catch (error) {
    logger.error(
      { err: error, reqId },
      "[explore/trending] erro ao montar trending",
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
