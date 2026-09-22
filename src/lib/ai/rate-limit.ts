import { prisma } from "@/lib/prisma"

export interface AIDailyUsage {
  id: string
  userId: string
  date: Date
  interpretationCount: number
  followUpCount: number
  createdAt: Date
}

const AI_DAILY_LIMITS: Record<string, number> = {
  FREE: 10,
  PLUS: Number.MAX_SAFE_INTEGER,
}

const FOLLOW_UP_LIMITS: Record<string, number> = {
  FREE: 10,
  PLUS: 30,
}

function todayStart(): Date {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

export async function checkDailyAILimit(
  userId: string,
  tier: string,
): Promise<{
  allowed: boolean
  remaining: number
  totalLimit: number
  tier: string
}> {
  const normalizedTier = tier.toUpperCase()
  const limit =
    normalizedTier in AI_DAILY_LIMITS ? AI_DAILY_LIMITS[normalizedTier]! : 10
  const date = todayStart()

  const usage = await prisma.aIDailyUsage.findUnique({
    where: { userId_date: { userId, date } },
  })

  const currentCount = usage?.interpretationCount ?? 0

  if (currentCount >= limit) {
    return {
      allowed: false,
      remaining: 0,
      totalLimit: limit,
      tier: normalizedTier,
    }
  }

  await prisma.aIDailyUsage.upsert({
    where: { userId_date: { userId, date } },
    create: { userId, date, interpretationCount: 1, followUpCount: 0 },
    update: { interpretationCount: { increment: 1 } },
  })

  const remaining =
    limit === Number.MAX_SAFE_INTEGER
      ? Number.MAX_SAFE_INTEGER
      : limit - currentCount - 1

  return {
    allowed: true,
    remaining,
    totalLimit: limit,
    tier: normalizedTier,
  }
}

export async function checkFollowUpLimit(
  userId: string,
  tier: string,
): Promise<{
  allowed: boolean
  remaining: number
  followUpLimit: number
  tier: string
}> {
  const normalizedTier = tier.toUpperCase()
  const limit =
    normalizedTier in FOLLOW_UP_LIMITS ? FOLLOW_UP_LIMITS[normalizedTier]! : 10
  const date = todayStart()

  const usage = await prisma.aIDailyUsage.findUnique({
    where: { userId_date: { userId, date } },
  })

  const currentCount = usage?.followUpCount ?? 0

  if (currentCount >= limit) {
    return {
      allowed: false,
      remaining: 0,
      followUpLimit: limit,
      tier: normalizedTier,
    }
  }

  await prisma.aIDailyUsage.upsert({
    where: { userId_date: { userId, date } },
    create: { userId, date, interpretationCount: 0, followUpCount: 1 },
    update: { followUpCount: { increment: 1 } },
  })

  const remaining =
    limit === Number.MAX_SAFE_INTEGER
      ? Number.MAX_SAFE_INTEGER
      : limit - currentCount - 1

  return {
    allowed: true,
    remaining,
    followUpLimit: limit,
    tier: normalizedTier,
  }
}
