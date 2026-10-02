import { z } from "zod"

import { requireAuth } from "@/app/api/v1/users/_helpers"
import { apiError } from "@/lib/api-response"
import { getCachedFeed } from "@/lib/feed-cache"
import { logger, newReqId } from "@/lib/logger"
import {
  FEED_DEFAULT_LIMIT,
  FEED_MAX_LIMIT,
  getFeed,
} from "@/lib/social/feed-algorithm"
import { toPublicPost } from "@/lib/social/post-visibility"

export const dynamic = "force-dynamic"

// Feed é estritamente pessoal (viewer + following): nunca cache público.
const PRIVATE_HEADERS = {
  "Cache-Control": "private, no-store",
  Vary: "Authorization",
} satisfies HeadersInit

const feedQuerySchema = z.object({
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(FEED_MAX_LIMIT).optional(),
})

/**
 * GET /api/v1/social/feed (T052/AC-3): feed personalizado do viewer.
 *
 * - Autenticação obrigatória (MVP autenticado, S2-13).
 * - Cache Redis (T030/S2-18) é consultado primeiro; hit serve a página
 *   materializada COMPLETA (o `nextCursor` é o pivot do algoritmo, que já
 *   embute o `include`), miss cai no `getFeed` ao vivo — `limit` vale só
 *   para a paginação ao vivo (review C1: cortar o cache reencodava o
 *   cursor pelo último do ranking e duplicava/pulava posts).
 * - Ordenação/ranking S2-5 + predicado de visibilidade S2-15 (perfil
 *   `private` só para seguidores) vivem dentro de `getFeed`.
 * - Envelope `{ data, pagination: { nextCursor } }` (S2-18): sem `hasMore`/
 *   `limit` — o próprio `nextCursor` nulo encerra a paginação.
 * - `?type=` de filtro fica adiado (decisão do dono 2026-09-30; doc
 *   docs/04-api/social.md atualizado na fase de docs).
 */
export async function GET(request: Request): Promise<Response> {
  const reqId = newReqId()

  const auth = await requireAuth(request, reqId)
  if (auth instanceof Response) return auth

  const { searchParams } = new URL(request.url)
  const parsed = feedQuerySchema.safeParse({
    cursor: searchParams.get("cursor") ?? undefined,
    limit: searchParams.get("limit") ?? undefined,
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
      PRIVATE_HEADERS,
    )
  }

  const { cursor } = parsed.data
  const limit = parsed.data.limit ?? FEED_DEFAULT_LIMIT

  try {
    const cached = await getCachedFeed(auth.userId, cursor)
    if (cached) {
      // Página materializada servida por inteiro: `cached.nextCursor` já é
      // o pivot (minTuple + include) devolvido pelo algoritmo. Cortar no
      // `limit` e reencodar pelo último do ranking duplicava/pulava posts
      // na página seguinte (review C1); `limit` segue valendo para a
      // paginação ao vivo.
      return Response.json(
        {
          data: cached.posts.map(toPublicPost),
          pagination: { nextCursor: cached.nextCursor },
        },
        { headers: PRIVATE_HEADERS },
      )
    }

    const page = await getFeed(auth.userId, cursor, limit)
    return Response.json(
      {
        data: page.posts.map(toPublicPost),
        pagination: { nextCursor: page.nextCursor },
      },
      { headers: PRIVATE_HEADERS },
    )
  } catch (error) {
    logger.error({ err: error, reqId }, "[feed] erro ao montar feed")
    return apiError(
      "INTERNAL_ERROR",
      "Erro interno",
      reqId,
      500,
      undefined,
      PRIVATE_HEADERS,
    )
  }
}
