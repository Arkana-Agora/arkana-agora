import type { DailyLimitResult } from "@/types/tarot"

const DAILY_LIMITS: Record<string, number> = {
  free: 3,
  plus: 10,
  premium: Number.MAX_SAFE_INTEGER,
}

export function checkDailyLimit(
  countToday: number,
  tier: string,
): DailyLimitResult {
  const limit = Number(DAILY_LIMITS[tier] ?? DAILY_LIMITS.free)
  const remaining = Math.max(0, limit - countToday)

  return {
    allowed: countToday < limit,
    remaining,
    tier,
  }
}
