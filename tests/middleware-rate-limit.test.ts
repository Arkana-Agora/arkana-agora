import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/prisma", () => ({ prisma: {} }))
vi.mock("@/lib/redis", () => ({ redis: undefined }))
vi.mock("@/lib/logger", () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}))

const checkSocialLimit = vi.hoisted(() => vi.fn())

vi.mock("@/lib/social/limits", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/social/limits")>()
  return {
    ...actual,
    checkSocialLimit,
  }
})

import {
  enforceSocialLimit,
  rateLimitHeaders,
} from "@/lib/middleware/rate-limit"

function allowedCheck(remaining: number, max: number) {
  return {
    allowed: true,
    remaining,
    max,
    limit: "post",
    resetAt: new Date(Date.now() + 60_000),
  }
}

function blockedCheck(max: number) {
  return {
    allowed: false,
    remaining: 0,
    max,
    limit: "gift",
    resetAt: new Date(Date.now() + 42_000),
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  checkSocialLimit.mockResolvedValue(allowedCheck(99, 100))
})

describe("rateLimitHeaders (T040)", () => {
  it("emit limit/remaining; Retry-After só quando bloqueado", () => {
    const ok = rateLimitHeaders(
      { allowed: true, remaining: 5, resetAt: new Date(Date.now() + 60_000) },
      10,
    )
    expect(ok).toEqual({
      "X-RateLimit-Limit": "10",
      "X-RateLimit-Remaining": "5",
    })
    expect(ok["Retry-After"]).toBeUndefined()

    const blocked = rateLimitHeaders(
      { allowed: false, remaining: 0, resetAt: new Date(Date.now() + 42_000) },
      10,
    )
    expect(blocked["X-RateLimit-Remaining"]).toBe("0")
    const retryAfter = Number(blocked["Retry-After"])
    expect(retryAfter).toBeGreaterThanOrEqual(0)
    expect(retryAfter).toBeLessThanOrEqual(42)
  })
})

describe("enforceSocialLimit (T040)", () => {
  it("chama o núcleo único com limit/tier e emite headers do resultado", async () => {
    const outcome = await enforceSocialLimit({
      limit: "like",
      userId: "usr_1",
      reqId: "req-1",
    })

    expect(outcome.allowed).toBe(true)
    expect(checkSocialLimit).toHaveBeenCalledWith("like", "usr_1", "FREE")
    expect(outcome.headers).toEqual({
      "X-RateLimit-Limit": "100",
      "X-RateLimit-Remaining": "99",
    })
  })

  it("post é tier-aware: PLUS vê limite 50", async () => {
    checkSocialLimit.mockResolvedValue(allowedCheck(45, 50))

    const outcome = await enforceSocialLimit({
      limit: "post",
      userId: "usr_1",
      tier: "PLUS",
      reqId: "req-1",
    })

    expect(checkSocialLimit).toHaveBeenCalledWith("post", "usr_1", "PLUS")
    expect(outcome.headers["X-RateLimit-Limit"]).toBe("50")
  })

  it("bloqueado → 429 com code RATE_LIMITED, requestId e Retry-After", async () => {
    checkSocialLimit.mockResolvedValue(blockedCheck(10))

    const outcome = await enforceSocialLimit({
      limit: "gift",
      userId: "usr_1",
      reqId: "req-9",
    })

    expect(outcome.allowed).toBe(false)
    if (outcome.allowed) throw new Error("esperava bloqueio")
    expect(outcome.response.status).toBe(429)
    expect(outcome.headers["Retry-After"]).toBeDefined()

    const body = await outcome.response.json()
    expect(body.error.code).toBe("RATE_LIMITED")
    expect(body.error.details.limit).toBe("gift")
    expect(body.meta.requestId).toBe("req-9")
  })

  it("fail-open do T027 propaga: checker liberando nunca vira erro", async () => {
    checkSocialLimit.mockResolvedValue(allowedCheck(30, 30))

    const outcome = await enforceSocialLimit({
      limit: "comment",
      userId: "usr_1",
      reqId: "req-2",
    })

    expect(outcome.allowed).toBe(true)
    expect("response" in outcome).toBe(false)
  })
})
