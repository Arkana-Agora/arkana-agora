import { z } from "zod"

import { requireAuth } from "@/app/api/v1/users/_helpers"
import { apiError } from "@/lib/api-response"
import { logger, newReqId } from "@/lib/logger"
import { prisma } from "@/lib/prisma"
import { decodeFeedCursor, encodeFeedCursor } from "@/lib/social/feed-algorithm"

export const dynamic = "force-dynamic"

// Dados pessoais do viewer — nunca cacheável por CDN sem `Vary:
// Authorization` (mesmo header da T078).
const NOTIFICATIONS_HEADERS = {
  "Cache-Control": "private, no-store",
  Vary: "Authorization",
} satisfies Record<string, string>

// docs/04-api/social.md: lote default 20, máx 50.
const NOTIFICATIONS_DEFAULT_LIMIT = 20
const NOTIFICATIONS_MAX_LIMIT = 50

const booleanParam = z
  .enum(["true", "false"])
  .transform((value) => value === "true")
  .optional()

const notificationsQuerySchema = z.object({
  cursor: z.string().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(NOTIFICATIONS_MAX_LIMIT).optional(),
  // Plano T082: filtro `isRead`; contrato do `useUnreadCount` (T038) usa
  // `unreadOnly=true` — os dois convivem; `unreadOnly` é o alias mais
  // estrito e prevalece (equivale a `isRead=false`).
  isRead: booleanParam,
  unreadOnly: booleanParam,
})

/**
 * GET /api/v1/social/notifications (T082/US-023): lista de notificações do
 * viewer com cursor keyset `(createdAt, id)` (mesmo formato do feed),
 * filtros `isRead`/`unreadOnly` e `unreadCount` SEMPRE presente — envelope
 * S2-18 `{ data: { notifications, unreadCount }, pagination: { nextCursor } }`
 * (o rascunho flat/`pagination.unreadCount` em docs/04-api/social.md é a
 * divergência já marcada; a sincronização de docs ocorre no fim da fase).
 * Rows cruas (colunas reais `id/type/message/data/isRead/createdAt`),
 * espelho de `GET /social/polling/notifications` (T071). Cursor inválido →
 * página vazia sem restart (contrato do feed, T026); `unreadCount` continua
 * sendo entregue. Leitura sem rate limit próprio (regra das rotas GET).
 */
export async function GET(request: Request): Promise<Response> {
  const reqId = newReqId()

  const auth = await requireAuth(request, reqId)
  if (auth instanceof Response) return auth

  const parsed = notificationsQuerySchema.safeParse(
    Object.fromEntries(new URL(request.url).searchParams),
  )
  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", "Query params invalidos", reqId, 422)
  }
  const { cursor, limit, isRead, unreadOnly } = parsed.data
  const take = limit ?? NOTIFICATIONS_DEFAULT_LIMIT

  try {
    const isReadFilter =
      unreadOnly === true ? false : isRead !== undefined ? isRead : undefined

    const unreadCount = await prisma.notification.count({
      where: { userId: auth.userId, isRead: false },
    })

    const respond = (notifications: unknown[], nextCursor: string | null) =>
      Response.json(
        { data: { notifications, unreadCount }, pagination: { nextCursor } },
        { headers: NOTIFICATIONS_HEADERS },
      )

    const parsedCursor = cursor ? decodeFeedCursor(cursor) : null
    if (cursor && !parsedCursor) {
      return respond([], null)
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

    const rows = await prisma.notification.findMany({
      where: {
        userId: auth.userId,
        ...(isReadFilter === undefined ? {} : { isRead: isReadFilter }),
        ...(keyset.length > 0 ? { AND: keyset } : {}),
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

    return respond(shown, nextCursor)
  } catch (error) {
    logger.error({ err: error, reqId }, "[notifications] erro interno")
    return apiError(
      "INTERNAL_ERROR",
      "Erro interno",
      reqId,
      500,
      undefined,
      NOTIFICATIONS_HEADERS,
    )
  }
}
