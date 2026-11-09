import { NextResponse } from "next/server"
import { requireAuth } from "@/app/api/v1/users/_helpers"
import { apiError } from "@/lib/api-response"
import { newReqId } from "@/lib/logger"
import { prisma } from "@/lib/prisma"

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
      select: {
        versosBalance: true,
        versosStreak: true,
        lastClaimAt: true,
      },
    })

    if (!profile) {
      return apiError("NOT_FOUND", "Perfil nao encontrado", reqId, 404)
    }

    return NextResponse.json({
      balance: profile.versosBalance,
      dailyEarned: 0,
      streak: profile.versosStreak,
      lastClaimAt: profile.lastClaimAt?.toISOString() ?? null,
    })
  } catch (error) {
    console.error("[GET /api/v1/social/versos/balance]", error)
    return apiError("INTERNAL_ERROR", "Erro interno do servidor", reqId, 500)
  }
}
