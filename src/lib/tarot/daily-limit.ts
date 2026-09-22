import type { DailyLimitResult } from "@/types/tarot"

const DAILY_LIMITS: Record<string, number> = {
  FREE: 3,
  PLUS: 10,
  PREMIUM: Number.MAX_SAFE_INTEGER,
}

export function checkDailyLimit(
  countToday: number,
  tier: string,
): DailyLimitResult {
  const normalizedTier = tier.toUpperCase()
  const limit =
    normalizedTier in DAILY_LIMITS ? DAILY_LIMITS[normalizedTier]! : 3
  const remaining = Math.max(0, limit - countToday)

  return {
    allowed: countToday < limit,
    remaining,
    absoluteLimit: limit,
    tier: normalizedTier,
  }
}
