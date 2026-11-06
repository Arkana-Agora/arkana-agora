import { z } from "zod"

import { requireAuth } from "@/app/api/v1/users/_helpers"
import { apiError } from "@/lib/api-response"
import { logger, newReqId } from "@/lib/logger"
import { prisma } from "@/lib/prisma"
import { decodeFeedCursor, encodeFeedCursor } from "@/lib/social/feed-algorithm"
import { HOROSCOPE_TYPES, PROMPT_PERIODS } from "@/lib/horoscopes/prompts"

export const dynamic = "force-dynamic"

const DEFAULT_LIMIT = 20
const MAX_LIMIT = 50

const historyQuerySchema = z.object({
  cursor: z.string().max(500).optional(),
  limit: z.coerce.number().int().min(1).max(MAX_LIMIT).optional(),
  type: z.enum(HOROSCOPE_TYPES).optional(),
  period: z.enum(PROMPT_PERIODS).optional(),
})

/**
 * GET /api/v1/horoscopes/history (T095/RF-HORO-007/US-024): histórico de
 * horóscopos consultados pelo viewer com paginação por cursor keyset
 * `(createdAt, id)` (mesmo formato do feed/notifications). Filtros
 * opcionais `type`/`period`. Envelope S2-18
 * `{ data: { entries }, pagination: { nextCursor } }`. Cursor inválido →
 * página vazia sem restart (contrato do feed, T026).
 */
export async function GET(request: Request): Promise<Response> {
  const reqId = newReqId()

  const auth = await requireAuth(request, reqId)
  if (auth instanceof Response) return auth

  const parsed = historyQuerySchema.safeParse(
    Object.fromEntries(new URL(request.url).searchParams),
  )
  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", "Query params invalidos", reqId, 422)
  }
  const { cursor, limit, type, period } = parsed.data
  const take = limit ?? DEFAULT_LIMIT

  const respond = (entries: unknown[], nextCursor: string | null) =>
    Response.json({ data: { entries }, pagination: { nextCursor } })

  try {
    const decoded = cursor ? decodeFeedCursor(cursor) : null
    if (cursor && !decoded) {
      return respond([], null)
    }

    const rows = await prisma.horoscopeEntry.findMany({
      where: {
        userId: auth.userId,
        ...(type === undefined ? {} : { type }),
        ...(period === undefined ? {} : { period }),
        ...(decoded
          ? {
              AND: [
                {
                  OR: [
                    { createdAt: { lt: new Date(decoded.createdAt) } },
                    {
                      createdAt: new Date(decoded.createdAt),
                      id: { lt: decoded.id },
                    },
                  ],
                },
              ],
            }
          : {}),
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: take + 1,
    })

    const hasMore = rows.length > take
    const shown = rows.slice(0, take)
    const last = shown[shown.length - 1]
    const nextCursor =
      hasMore && last
        ? encodeFeedCursor({ createdAt: last.createdAt.getTime(), id: last.id })
        : null

    const entries = shown.map((row) => ({
      id: row.id,
      type: row.type,
      signId: row.signId,
      element: row.element,
      period: row.period,
      createdAt: row.createdAt,
    }))

    return respond(entries, nextCursor)
  } catch (err) {
    logger.error(
      { reqId, err },
      "[horoscopes:history] erro ao listar historico",
    )
    return apiError("INTERNAL_ERROR", "Erro interno", reqId, 500)
  }
}
