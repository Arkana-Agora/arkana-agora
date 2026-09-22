import { prisma } from "@/lib/prisma"
import { logger, newReqId } from "@/lib/logger"
import { requireAuth } from "@/app/api/v1/users/_helpers"
import { createReadingSchema } from "@/lib/validators/reading"
import { generateSeed } from "@/lib/tarot/seed"
import { drawCards } from "@/lib/tarot/draw"
import { getDeckCards, getDeckById } from "@/lib/tarot/decks"
import { getDailyLimitStatus, readingWhereForUser } from "@/lib/tarot/helpers"
import { apiError } from "@/lib/api-response"
import spreadsData from "@/data/spreads.json"
import type { Spread } from "@/types/tarot"
import type { Prisma } from "@prisma/client"

const spreads = spreadsData as Spread[]

const MAX_BODY_BYTES = 8_192

export const dynamic = "force-dynamic"

export async function POST(request: Request): Promise<Response> {
  const reqId = newReqId()

  const auth = await requireAuth(request, reqId)
  if (auth instanceof Response) return auth

  const contentLength = Number(request.headers.get("content-length") ?? 0)
  if (contentLength > MAX_BODY_BYTES) {
    return apiError(
      "PAYLOAD_TOO_LARGE",
      "Corpo da requisição muito grande",
      reqId,
      413,
    )
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    logger.info({ reqId }, "[readings:create] body invalido")
    return apiError("VALIDATION_ERROR", "Body invalido", reqId, 422)
  }

  const parsed = createReadingSchema.safeParse(body)
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Dados invalidos"
    logger.info(
      { reqId, errors: parsed.error.issues },
      "[readings:create] validacao falhou",
    )
    return apiError("VALIDATION_ERROR", message, reqId, 422)
  }

  const { deckId, spreadId, title, notes, isPublic } = parsed.data

  const spread = spreads.find((s) => s.id === spreadId)
  if (!spread) {
    logger.info({ reqId, spreadId }, "[readings:create] spread invalido")
    return apiError("VALIDATION_ERROR", "Spread invalido", reqId, 422)
  }

  try {
    const dailyLimit = await getDailyLimitStatus(auth.userId)
    if (!dailyLimit.limit.allowed) {
      logger.info(
        { reqId, userId: auth.userId, tier: dailyLimit.tier },
        "[readings:create] limite diario",
      )
      return apiError(
        "DAILY_LIMIT_REACHED",
        `Limite diario de ${dailyLimit.tier} atingido. Atualize para Premium.`,
        reqId,
        429,
        { remaining: dailyLimit.limit.remaining },
      )
    }

    const cards = getDeckCards(deckId)
    const deck = getDeckById(deckId)
    if (!deck || cards.length === 0) {
      logger.error({ reqId, deckId }, "[readings:create] deck data missing")
      return apiError("INTERNAL_ERROR", "Erro interno", reqId, 500)
    }

    if (spread.cardCount > cards.length) {
      logger.error(
        {
          reqId,
          spreadId,
          cardCount: spread.cardCount,
          deckSize: cards.length,
        },
        "[readings:create] spread cardCount exceeds deck size",
      )
      return apiError(
        "VALIDATION_ERROR",
        "Spread invalido para este baralho",
        reqId,
        422,
      )
    }

    const seed = generateSeed()
    const drawn = drawCards(cards, spread.cardCount, seed)

    const reading = await prisma.$transaction(
      async (tx: Prisma.TransactionClient) => {
        const startOfDay = new Date()
        startOfDay.setHours(0, 0, 0, 0)

        const count = await tx.reading.count({
          where: {
            userId: auth.userId,
            createdAt: { gte: startOfDay },
          },
        })
        if (count >= dailyLimit.limit.absoluteLimit) {
          throw new Error("DAILY_LIMIT_REACHED")
        }

        return tx.reading.create({
          data: {
            userId: auth.userId,
            deckId,
            spreadId,
            title: title ?? null,
            notes: notes ?? null,
            seed,
            duration: 0,
            isPublic: isPublic ?? false,
            cards: {
              createMany: {
                data: drawn.map((d) => ({
                  cardId: d.card.id,
                  positionIndex: d.position,
                  isReversed: d.isReversed,
                })),
              },
            },
          },
          include: { cards: true },
        })
      },
    )

    logger.info({ reqId, readingId: reading.id }, "[readings:create] criada")

    return Response.json(
      {
        reading: {
          id: reading.id,
          cards: reading.cards,
          spread,
          createdAt: reading.createdAt,
        },
      },
      { status: 201 },
    )
  } catch (err) {
    if (err instanceof Error && err.message === "DAILY_LIMIT_REACHED") {
      return apiError(
        "DAILY_LIMIT_REACHED",
        "Limite diario atingido. Atualize para Premium.",
        reqId,
        429,
      )
    }
    logger.error({ reqId, err }, "[readings:create] erro ao criar reading")
    return apiError("INTERNAL_ERROR", "Erro interno", reqId, 500)
  }
}

export async function GET(request: Request): Promise<Response> {
  const reqId = newReqId()

  const auth = await requireAuth(request, reqId)
  if (auth instanceof Response) return auth

  const url = new URL(request.url)
  const page = Math.max(1, Number(url.searchParams.get("page")) || 1)
  const limit = Math.min(
    50,
    Math.max(1, Number(url.searchParams.get("limit")) || 20),
  )
  const deckId = url.searchParams.get("deckId")
  const skip = (page - 1) * limit

  try {
    const where = readingWhereForUser(auth.userId, deckId)

    const [readings, total] = await Promise.all([
      prisma.reading.findMany({
        where,
        include: { cards: true },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.reading.count({ where }),
    ])

    const totalPages = Math.ceil(total / limit)

    return Response.json({
      readings,
      pagination: { page, limit, total, totalPages },
    })
  } catch (err) {
    logger.error({ reqId, err }, "[readings:list] erro ao listar readings")
    return apiError("INTERNAL_ERROR", "Erro interno", reqId, 500)
  }
}
