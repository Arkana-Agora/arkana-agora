import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const redisHolder = vi.hoisted(() => ({
  current: undefined as unknown,
}))

const redisMock = vi.hoisted(() => ({
  eval: vi.fn(),
}))

const prismaMock = vi.hoisted(() => ({
  post: { count: vi.fn() },
  gift: { count: vi.fn() },
}))

const loggerWarn = vi.hoisted(() => vi.fn())

vi.mock("@/lib/redis", () => ({
  get redis() {
    return redisHolder.current
  },
}))
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }))
vi.mock("@/lib/logger", () => ({
  logger: { warn: loggerWarn, info: vi.fn(), error: vi.fn() },
}))

import {
  checkCommentLimit,
  checkFollowLimit,
  checkGiftLimit,
  checkLikeLimit,
  checkPostLimit,
  checkUploadLimit,
  POST_LIMIT_BY_TIER,
} from "@/lib/social/limits"

// reply Lua: [allowed, countApósAdd | countAtual, oldestScore | ""]
const ALLOW = (count: number) => [1, count, ""] as const
const DENY = (count: number, oldestScore: number | string = "") =>
  [0, count, String(oldestScore)] as const

beforeEach(() => {
  vi.clearAllMocks()
  redisHolder.current = redisMock
  redisMock.eval.mockResolvedValue(ALLOW(1))
  prismaMock.post.count.mockResolvedValue(0)
  prismaMock.gift.count.mockResolvedValue(0)
})

afterEach(() => {
  redisHolder.current = undefined
})

function evalArgsOfCall(callIndex = 0) {
  // eval(script, 1, key, now, pruneBefore, member, max, ttlMs)
  return redisMock.eval.mock.calls[callIndex]!
}

describe("checkLikeLimit (T027/SC9: 100/min)", () => {
  it("permite abaixo do limite e decrementa remaining", async () => {
    const result = await checkLikeLimit("usr_1")
    expect(result.allowed).toBe(true)
    expect(result.remaining).toBe(99)
    expect(redisMock.eval).toHaveBeenCalledTimes(1)
    expect(evalArgsOfCall()[2]).toBe("rl:like:usr_1")
    expect(evalArgsOfCall()[6]).toBe("100")
  })

  it("bloqueia acima do limite (sem adicionar o membro)", async () => {
    const oldest = Date.now() - 30_000
    redisMock.eval.mockResolvedValue(DENY(101, oldest))
    const result = await checkLikeLimit("usr_1")
    expect(result.allowed).toBe(false)
    expect(result.remaining).toBe(0)
    expect(result.resetAt.getTime()).toBe(oldest + 60_000)
    expect(loggerWarn).not.toHaveBeenCalled()
  })
})

describe("outros limites fixos (T027/SC9)", () => {
  it("comment 30/min, follow 20/min, gift 10/dia, upload 20/dia", async () => {
    const comment = await checkCommentLimit("usr_1")
    expect(comment.remaining).toBe(29)

    const follow = await checkFollowLimit("usr_1")
    expect(follow.remaining).toBe(19)

    const gift = await checkGiftLimit("usr_1")
    expect(gift.remaining).toBe(9)

    const upload = await checkUploadLimit("usr_1")
    expect(upload.remaining).toBe(19)
  })

  it("checkGiftLimit bloqueia no 11º presente do dia", async () => {
    redisMock.eval.mockResolvedValue(DENY(11))
    const result = await checkGiftLimit("usr_1")
    expect(result.allowed).toBe(false)
    expect(result.remaining).toBe(0)
  })
})

describe("janela diária = dia UTC fixo (review: unificar com fallback Prisma)", () => {
  it("daily limits prunam de meia-noite UTC e expiram no fim do dia", async () => {
    await checkGiftLimit("usr_1")

    const [, , , , pruneBefore, , , ttlMs] = evalArgsOfCall()
    const startOfDay = new Date()
    startOfDay.setUTCHours(0, 0, 0, 0)
    expect(Number(pruneBefore)).toBe(startOfDay.getTime())
    const ttl = Number(ttlMs)
    expect(ttl).toBeGreaterThan(0)
    expect(ttl).toBeLessThanOrEqual(86_400_000 + 60_000)
  })

  it("limites de minuto continuam sliding (prune = now - 60s)", async () => {
    await checkLikeLimit("usr_1")

    const [, , , , pruneBefore] = evalArgsOfCall()
    expect(Date.now() - Number(pruneBefore)).toBeGreaterThanOrEqual(59_900)
    expect(Date.now() - Number(pruneBefore)).toBeLessThanOrEqual(60_100)
  })
})

describe("checkPostLimit tier-aware (T027/SC17)", () => {
  it("FREE = 10/dia e PLUS = 50/dia", async () => {
    expect(POST_LIMIT_BY_TIER.FREE).toBe(10)
    expect(POST_LIMIT_BY_TIER.PLUS).toBe(50)

    redisMock.eval.mockResolvedValue(ALLOW(5))
    const free = await checkPostLimit("usr_1", "FREE")
    expect(free.remaining).toBe(5)

    redisMock.eval.mockResolvedValue(ALLOW(5))
    const plus = await checkPostLimit("usr_1", "PLUS")
    expect(plus.remaining).toBe(45)
  })
})

describe("fail-open Q26 (T027)", () => {
  it("Redis down + daily → fallback de contagem via Prisma", async () => {
    redisMock.eval.mockRejectedValue(new Error("redis down"))
    prismaMock.post.count.mockResolvedValue(9)

    const result = await checkPostLimit("usr_1", "FREE")

    expect(result.allowed).toBe(true)
    expect(result.remaining).toBe(1)
    expect(prismaMock.post.count).toHaveBeenCalledWith({
      where: {
        authorId: "usr_1",
        createdAt: { gte: expect.any(Date) },
      },
    })
    expect(loggerWarn).toHaveBeenCalledWith(
      expect.objectContaining({ limit: "post" }),
      "rate_limiter_redis_error",
    )
  })

  it("Redis down + Prisma count atingiu o limite do gift", async () => {
    redisMock.eval.mockRejectedValue(new Error("redis down"))
    prismaMock.gift.count.mockResolvedValue(10)

    const result = await checkGiftLimit("usr_1")

    expect(result.allowed).toBe(false)
    expect(result.remaining).toBe(0)
  })

  it("Redis down + Prisma também falha → libera com bypass", async () => {
    redisMock.eval.mockRejectedValue(new Error("redis down"))
    prismaMock.gift.count.mockRejectedValue(new Error("db down"))

    const result = await checkGiftLimit("usr_1")

    expect(result.allowed).toBe(true)
    expect(loggerWarn).toHaveBeenCalledWith(
      expect.objectContaining({ limit: "gift" }),
      "rate_limiter_bypass",
    )
  })

  it("Redis down em limite de minuto → libera direto (sem Prisma)", async () => {
    redisMock.eval.mockRejectedValue(new Error("redis down"))

    const result = await checkCommentLimit("usr_1")

    expect(result.allowed).toBe(true)
    expect(result.remaining).toBe(30)
    expect(prismaMock.post.count).not.toHaveBeenCalled()
    expect(loggerWarn).toHaveBeenCalledWith(
      expect.objectContaining({ limit: "comment" }),
      "rate_limiter_bypass",
    )
  })

  it("Redis não configurado + minuto → libera com bypass", async () => {
    redisHolder.current = undefined

    const result = await checkLikeLimit("usr_1")

    expect(result.allowed).toBe(true)
    expect(result.remaining).toBe(100)
    expect(loggerWarn).toHaveBeenCalledWith(
      expect.objectContaining({ reason: "redis_not_configured" }),
      "rate_limiter_bypass",
    )
  })

  it("Redis não configurado + daily post → fallback Prisma (review: era bypass)", async () => {
    redisHolder.current = undefined
    prismaMock.post.count.mockResolvedValue(3)

    const result = await checkPostLimit("usr_1", "FREE")

    expect(result.allowed).toBe(true)
    expect(result.remaining).toBe(7)
    expect(prismaMock.post.count).toHaveBeenCalledTimes(1)
    expect(loggerWarn).not.toHaveBeenCalled()
  })

  it("Redis não configurado + daily gift → fallback Prisma (review: era bypass)", async () => {
    redisHolder.current = undefined
    prismaMock.gift.count.mockResolvedValue(10)

    const result = await checkGiftLimit("usr_1")

    expect(result.allowed).toBe(false)
    expect(result.remaining).toBe(0)
  })

  it("Redis não configurado + upload → bypass logado (sem backing table)", async () => {
    redisHolder.current = undefined

    const result = await checkUploadLimit("usr_1")

    expect(result.allowed).toBe(true)
    expect(loggerWarn).toHaveBeenCalledWith(
      expect.objectContaining({
        limit: "upload",
        reason: "redis_not_configured",
      }),
      "rate_limiter_bypass",
    )
  })
})
