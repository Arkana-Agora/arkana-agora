import type { UserPlan } from "@prisma/client"

import type { ApiError } from "@/lib/api-response"
import {
  checkSocialLimit,
  type LimitCheck,
  type SocialLimit,
} from "@/lib/social/limits"

/**
 * Rate limit middleware (T040/US-021): aplica os checks do T027 nos
 * endpoints sociais com headers `Retry-After`/`X-RateLimit-Remaining`.
 * Fail-open propagado do T027 (Q26): quando o Redis cai o check libera —
 * nunca respondemos 503 por causa do limit.
 */

export function rateLimitHeaders(
  check: LimitCheck,
  limit: number,
): Record<string, string> {
  const headers: Record<string, string> = {
    "X-RateLimit-Limit": String(limit),
    "X-RateLimit-Remaining": String(Math.max(0, check.remaining)),
  }
  if (!check.allowed) {
    const retryAfter = Math.max(
      0,
      Math.ceil((check.resetAt.getTime() - Date.now()) / 1000),
    )
    headers["Retry-After"] = String(retryAfter)
  }
  return headers
}

export type RateLimitOutcome =
  | { allowed: true; headers: Record<string, string>; check: LimitCheck }
  | {
      allowed: false
      headers: Record<string, string>
      response: Response
      check: LimitCheck
    }

export async function enforceSocialLimit(options: {
  limit: SocialLimit
  userId: string
  tier?: UserPlan
  reqId: string
}): Promise<RateLimitOutcome> {
  const tier = options.tier ?? "FREE"
  const check = await checkSocialLimit(options.limit, options.userId, tier)
  const headers = rateLimitHeaders(check, check.max)

  if (check.allowed) {
    return { allowed: true, headers, check }
  }

  const body: ApiError = {
    error: {
      code: "RATE_LIMITED",
      message: "Limite excedido. Tente novamente mais tarde.",
      details: {
        limit: options.limit,
        resetAt: check.resetAt.toISOString(),
      },
    },
    meta: { requestId: options.reqId },
  }

  return {
    allowed: false,
    headers,
    check,
    response: Response.json(body, { status: 429, headers }),
  }
}
