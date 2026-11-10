import { NextResponse } from "next/server"
import { requireAuth } from "@/app/api/v1/users/_helpers"
import { apiError } from "@/lib/api-response"
import { newReqId, logger } from "@/lib/logger"
import { prisma } from "@/lib/prisma"
import { validateGiftId, getGiftCost, getGiftById } from "@/lib/social/gifts"
import { checkGiftLimit } from "@/lib/social/limits"
import { emitGiftReceived, emitNotification } from "@socket/src/emitters"
import { enforceCsrf } from "@/lib/middleware/csrf"
import { trackGiftSend } from "@/lib/analytics"
import { z } from "zod"

const giftSendSchema = z.object({
  toUserId: z.string().cuid(),
  giftId: z.string().min(1).max(50),
})

export async function POST(request: Request) {
  const reqId = newReqId()

  const authResult = await requireAuth(request, reqId)
  if (authResult instanceof Response) {
    return authResult
  }
  const fromUserId = authResult.userId

  const csrfError = enforceCsrf(request, reqId)
  if (csrfError) return csrfError

  try {
    const body = await request.json()
    const parsed = giftSendSchema.safeParse(body)
    if (!parsed.success) {
      return apiError("VALIDATION_ERROR", "Corpo invalido", reqId, 422)
    }
    const { toUserId, giftId } = parsed.data

    if (fromUserId === toUserId) {
      return apiError(
        "SELF_GIFT",
        "Nao pode enviar presente para si mesmo",
        reqId,
        403,
      )
    }

    if (!validateGiftId(giftId)) {
      return apiError("VALIDATION_ERROR", "Gift invalido", reqId, 422)
    }

    const cost = getGiftCost(giftId)
    if (cost === null) {
      return apiError("VALIDATION_ERROR", "Gift invalido", reqId, 422)
    }

    const rateLimit = await checkGiftLimit(fromUserId)
    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          error: {
            code: "RATE_LIMITED",
            message: "Limite de presentes excedido",
          },
          meta: { requestId: reqId, resetAt: rateLimit.resetAt.toISOString() },
        },
        { status: 429 },
      )
    }

    const [senderProfile, recipient] = await Promise.all([
      prisma.userProfile.findUnique({ where: { userId: fromUserId } }),
      prisma.user.findUnique({
        where: { id: toUserId },
        include: { profile: true },
      }),
    ])

    if (!senderProfile) {
      return apiError(
        "NOT_FOUND",
        "Perfil do remetente nao encontrado",
        reqId,
        404,
      )
    }

    if (!recipient || !recipient.profile) {
      return apiError("NOT_FOUND", "Destinatario nao encontrado", reqId, 404)
    }

    if (senderProfile.versosBalance < cost) {
      return apiError("INSUFFICIENT_VERSOS", "Versos insuficientes", reqId, 403)
    }

    const recipientEarnsHalf = recipient.plan === "PLUS"
    const recipientEarnAmount = recipientEarnsHalf ? Math.floor(cost / 2) : 0

    const gift = getGiftById(giftId)

    await prisma.$transaction(async (tx) => {
      await tx.gift.create({
        data: {
          fromUserId,
          toUserId,
          giftId,
          coinCost: cost,
          recipientEarnsHalf,
        },
      })

      await tx.userProfile.update({
        where: { userId: fromUserId },
        data: { versosBalance: { decrement: cost } },
      })

      if (recipientEarnAmount > 0) {
        await tx.userProfile.update({
          where: { userId: toUserId },
          data: { versosBalance: { increment: recipientEarnAmount } },
        })
      }

      await tx.notification.create({
        data: {
          userId: toUserId,
          type: "GIFT_RECEIVED",
          message: `Voce recebeu um presente: ${gift?.name ?? giftId}`,
          data: { fromUserId, giftId, cost },
        },
      })
    })

    await Promise.allSettled([
      emitGiftReceived({
        toUserId,
        fromUserId,
        giftId,
        giftName: gift?.name ?? giftId,
      }),
      emitNotification({
        userId: toUserId,
        notification: {
          id: crypto.randomUUID(),
          type: "GIFT_RECEIVED",
          message: `Voce recebeu um presente: ${gift?.name ?? giftId}`,
          data: { fromUserId, giftId, cost },
        },
      }),
    ])

    trackGiftSend(giftId, cost, toUserId)

    return NextResponse.json(
      { message: "Presente enviado com sucesso" },
      { status: 200 },
    )
  } catch (error) {
    logger.error(
      { err: error, reqId },
      "[POST /api/v1/social/gifts/send] error",
    )
    return apiError("INTERNAL_ERROR", "Erro interno do servidor", reqId, 500)
  }
}
