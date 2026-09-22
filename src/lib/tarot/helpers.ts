import type { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { checkDailyLimit } from "@/lib/tarot/daily-limit"

interface DailyLimitStatus {
  count: number
  tier: string
  limit: ReturnType<typeof checkDailyLimit>
}

export async function getDailyLimitStatus(
  userId: string,
): Promise<DailyLimitStatus> {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const [count, user] = await Promise.all([
    prisma.reading.count({
      where: { userId, createdAt: { gte: today } },
    }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { plan: true },
    }),
  ])

  const tier = user?.plan ?? "FREE"
  const limit = checkDailyLimit(count, tier)

  return { count, tier, limit }
}

export function readingWhereForUser(
  userId: string,
  deckId?: string | null,
): Prisma.ReadingWhereInput {
  const where: Prisma.ReadingWhereInput = { userId }
  if (deckId) where.deckId = deckId
  return where
}
