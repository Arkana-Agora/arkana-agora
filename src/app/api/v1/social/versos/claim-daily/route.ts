import { NextResponse } from "next/server"
import { requireAuth } from "@/app/api/v1/users/_helpers"
import { apiError } from "@/lib/api-response"
import { newReqId, logger } from "@/lib/logger"
import { prisma } from "@/lib/prisma"
import { enforceCsrf } from "@/lib/middleware/csrf"
import { checkSocialLimit } from "@/lib/social/limits"
import { trackGiftClaimDaily, trackVersosEarned } from "@/lib/analytics"
import { VersosSource } from "@/lib/social/versos"

const BASE_CLAIM = 10
const MILESTONES: Record<number, number> = {
  7: 50,
  30: 200,
}

function getMilestoneBonus(streak: number): number {
  return MILESTONES[streak] ?? 0
}

function isSameDay(d1: Date, d2: Date): boolean {
  return (
    d1.getUTCFullYear() === d2.getUTCFullYear() &&
    d1.getUTCMonth() === d2.getUTCMonth() &&
    d1.getUTCDate() === d2.getUTCDate()
  )
}

function daysDiff(d1: Date, d2: Date): number {
  const date1 = new Date(
    Date.UTC(d1.getUTCFullYear(), d1.getUTCMonth(), d1.getUTCDate()),
  )
  const date2 = new Date(
    Date.UTC(d2.getUTCFullYear(), d2.getUTCMonth(), d2.getUTCDate()),
  )
  return Math.floor((date1.getTime() - date2.getTime()) / (1000 * 60 * 60 * 24))
}

export async function POST(request: Request) {
  const reqId = newReqId()

  const authResult = await requireAuth(request, reqId)
  if (authResult instanceof Response) {
    return authResult
  }
  const userId = authResult.userId

  const csrfError = enforceCsrf(request, reqId)
  if (csrfError) return csrfError

  // Rate limiting for claim endpoint
  const rateLimit = await checkSocialLimit("polling", userId)
  if (!rateLimit.allowed) {
    return NextResponse.json(
      {
        error: {
          code: "RATE_LIMIT_EXCEEDED",
          message: "Muitas tentativas. Tente novamente mais tarde.",
        },
        meta: { requestId: reqId },
      },
      { status: 429 },
    )
  }

  try {
    const now = new Date()

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

    if (profile.lastClaimAt && isSameDay(profile.lastClaimAt, now)) {
      return apiError(
        "ALREADY_CLAIMED",
        "Claim diario ja realizado hoje",
        reqId,
        409,
      )
    }

    let newStreak = 1
    if (profile.lastClaimAt) {
      const diff = daysDiff(now, profile.lastClaimAt)
      if (diff === 1) {
        newStreak = profile.versosStreak + 1
      } else if (diff > 1) {
        newStreak = 1
      }
    }

    const bonus = getMilestoneBonus(newStreak)
    const earned = BASE_CLAIM + bonus

    const updated = await prisma.userProfile.update({
      where: { userId },
      data: {
        versosBalance: { increment: earned },
        versosStreak: newStreak,
        lastClaimAt: now,
      },
      select: {
        versosBalance: true,
        versosStreak: true,
        lastClaimAt: true,
      },
    })

    trackGiftClaimDaily(earned, newStreak)
    trackVersosEarned(VersosSource.ClaimDaily, earned)

    return NextResponse.json({
      message: "Claim diario realizado",
      earned,
      newBalance: updated.versosBalance,
      streak: updated.versosStreak,
      lastClaimAt: updated.lastClaimAt?.toISOString() ?? null,
    })
  } catch (error) {
    logger.error({ err: error }, "[POST /api/v1/social/versos/claim-daily]")
    return apiError("INTERNAL_ERROR", "Erro interno do servidor", reqId, 500)
  }
}
