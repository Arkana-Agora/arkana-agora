import { NextResponse } from "next/server"
import { requireAuth } from "@/app/api/v1/users/_helpers"
import { apiError } from "@/lib/api-response"
import { newReqId } from "@/lib/logger"
import { prisma } from "@/lib/prisma"
import { logger } from "@/lib/logger"

export async function GET(request: Request) {
  const reqId = newReqId()

  const authResult = await requireAuth(request, reqId)
  if (authResult instanceof Response) {
    return authResult
  }
  const userId = authResult.userId

  try {
    const profile = await prisma.userProfile.findUnique({
      where: { userId },
      select: { id: true },
    })

    if (!profile) {
      return apiError("NOT_FOUND", "Perfil nao encontrado", reqId, 404)
    }

    const gifts = await prisma.gift.findMany({
      where: { toUserId: userId },
      take: 20,
      orderBy: { createdAt: "desc" },
      include: {
        fromUser: {
          select: {
            id: true,
            name: true,
            avatar: true,
          },
        },
      },
    })

    const totalReceived = await prisma.gift.count({
      where: { toUserId: userId },
    })

    return NextResponse.json({
      gifts: gifts.map((g) => ({
        id: g.id,
        giftId: g.giftId,
        coinCost: g.coinCost,
        recipientEarnsHalf: g.recipientEarnsHalf,
        createdAt: g.createdAt.toISOString(),
        fromUser: g.fromUser,
      })),
      totalReceived,
    })
  } catch (error) {
    logger.error({ err: error }, "[GET /api/v1/social/gifts/received]")
    return apiError("INTERNAL_ERROR", "Erro interno do servidor", reqId, 500)
  }
}
