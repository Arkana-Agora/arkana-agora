import { z } from "zod"

import { requireAuth } from "@/app/api/v1/users/_helpers"
import { apiError } from "@/lib/api-response"
import { logger, newReqId } from "@/lib/logger"
import { searchSocial } from "@/lib/social/search"
import { toPublicPost } from "@/lib/social/post-visibility"

export const dynamic = "force-dynamic"

const SEARCH_HEADERS = {
  "Cache-Control": "private, no-store",
  Vary: "Authorization",
} satisfies HeadersInit

// mín 2, máx 50 caracteres — precedente do contrato `GET /users/search`
// e da lista de seguidores (`GET /users/:id/follow-list`, `q` ≤ 50)
const searchQuerySchema = z.object({
  q: z.string().trim().min(2).max(50),
})

/**
 * GET /api/v1/social/search (T056/US-022): busca unificada com abas
 * posts/usuários/hashtags. `q` obrigatório (≥2 chars). Posts honram S2-15
 * (público OU followers de quem sigo + perfil `private` só para
 * seguidores), hashtags sem janela (diferente do trending). Resposta fixa
 * por seção (limit 20) → envelope `{ data: { posts, users, hashtags } }`
 * sem `pagination` (não é rota cursor — S2-18).
 */
export async function GET(request: Request): Promise<Response> {
  const reqId = newReqId()

  const auth = await requireAuth(request, reqId)
  if (auth instanceof Response) return auth

  const { searchParams } = new URL(request.url)
  const parsed = searchQuerySchema.safeParse({
    q: searchParams.get("q") ?? undefined,
  })
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
      SEARCH_HEADERS,
    )
  }

  try {
    const { posts, users, hashtags } = await searchSocial(
      auth.userId,
      parsed.data.q,
    )
    return Response.json(
      { data: { posts: posts.map(toPublicPost), users, hashtags } },
      { headers: SEARCH_HEADERS },
    )
  } catch (error) {
    logger.error({ err: error, reqId }, "[search] erro na busca")
    return apiError(
      "INTERNAL_ERROR",
      "Erro interno",
      reqId,
      500,
      undefined,
      SEARCH_HEADERS,
    )
  }
}
