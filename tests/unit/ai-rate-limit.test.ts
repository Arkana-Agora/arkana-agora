import { describe, it, expect, vi, beforeEach } from "vitest"
import {
  checkDailyAILimit,
  checkFollowUpLimit,
  type AIDailyUsage,
} from "@/lib/ai/rate-limit"

vi.mock("@/lib/prisma", () => ({
  prisma: {
    aIDailyUsage: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
  },
}))

import { prisma } from "@/lib/prisma"
const mockFindUnique = vi.mocked(prisma.aIDailyUsage.findUnique)
const mockUpsert = vi.mocked(prisma.aIDailyUsage.upsert)

function makeUsage(overrides: Partial<AIDailyUsage> = {}): AIDailyUsage {
  return {
    id: "usage-1",
    userId: "user-1",
    date: new Date("2026-09-22T00:00:00Z"),
    interpretationCount: 0,
    followUpCount: 0,
    createdAt: new Date(),
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe("checkDailyAILimit", () => {
  it("allows interpretation when no usage exists", async () => {
    mockFindUnique.mockResolvedValue(null)
    mockUpsert.mockResolvedValue(makeUsage({ interpretationCount: 1 }))

    const result = await checkDailyAILimit("user-1", "FREE")
    expect(result.allowed).toBe(true)
    expect(result.remaining).toBe(9)
    expect(result.totalLimit).toBe(10)
    expect(result.tier).toBe("FREE")
  })

  it("allows interpretation when under limit", async () => {
    mockFindUnique.mockResolvedValue(makeUsage({ interpretationCount: 5 }))
    mockUpsert.mockResolvedValue(makeUsage({ interpretationCount: 6 }))

    const result = await checkDailyAILimit("user-1", "FREE")
    expect(result.allowed).toBe(true)
    expect(result.remaining).toBe(4)
  })

  it("denies interpretation when at limit", async () => {
    mockFindUnique.mockResolvedValue(makeUsage({ interpretationCount: 10 }))

    const result = await checkDailyAILimit("user-1", "FREE")
    expect(result.allowed).toBe(false)
    expect(result.remaining).toBe(0)
    expect(result.totalLimit).toBe(10)
    expect(mockUpsert).not.toHaveBeenCalled()
  })

  it("allows unlimited for PLUS tier", async () => {
    mockFindUnique.mockResolvedValue(makeUsage({ interpretationCount: 100 }))
    mockUpsert.mockResolvedValue(makeUsage({ interpretationCount: 101 }))

    const result = await checkDailyAILimit("user-1", "PLUS")
    expect(result.allowed).toBe(true)
    expect(result.remaining).toBe(Number.MAX_SAFE_INTEGER)
    expect(result.totalLimit).toBe(Number.MAX_SAFE_INTEGER)
  })

  it("upserts the usage count on allowed", async () => {
    mockFindUnique.mockResolvedValue(makeUsage({ interpretationCount: 3 }))
    mockUpsert.mockResolvedValue(makeUsage({ interpretationCount: 4 }))

    await checkDailyAILimit("user-1", "FREE")

    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId_date: expect.any(Object) }),
        create: expect.objectContaining({ interpretationCount: 1 }),
        update: expect.objectContaining({
          interpretationCount: { increment: 1 },
        }),
      }),
    )
  })

  it("does not upsert when at limit", async () => {
    mockFindUnique.mockResolvedValue(makeUsage({ interpretationCount: 10 }))

    await checkDailyAILimit("user-1", "FREE")
    expect(mockUpsert).not.toHaveBeenCalled()
  })
})

describe("checkFollowUpLimit", () => {
  it("allows follow-up when under session limit", async () => {
    mockFindUnique.mockResolvedValue(makeUsage({ followUpCount: 3 }))

    const result = await checkFollowUpLimit("user-1", "FREE")
    expect(result.allowed).toBe(true)
    expect(result.remaining).toBe(6)
    expect(result.followUpLimit).toBe(10)
  })

  it("denies follow-up when at session limit", async () => {
    mockFindUnique.mockResolvedValue(makeUsage({ followUpCount: 10 }))

    const result = await checkFollowUpLimit("user-1", "FREE")
    expect(result.allowed).toBe(false)
    expect(result.remaining).toBe(0)
  })

  it("allows 30 follow-ups for PLUS tier", async () => {
    mockFindUnique.mockResolvedValue(makeUsage({ followUpCount: 25 }))

    const result = await checkFollowUpLimit("user-1", "PLUS")
    expect(result.allowed).toBe(true)
    expect(result.remaining).toBe(4)
    expect(result.followUpLimit).toBe(30)
  })

  it("upserts follow-up count on allowed", async () => {
    mockFindUnique.mockResolvedValue(makeUsage({ followUpCount: 2 }))
    mockUpsert.mockResolvedValue(makeUsage({ followUpCount: 3 }))

    await checkFollowUpLimit("user-1", "FREE")

    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ followUpCount: 1 }),
        update: expect.objectContaining({ followUpCount: { increment: 1 } }),
      }),
    )
  })

  it("does not upsert when at follow-up limit", async () => {
    mockFindUnique.mockResolvedValue(makeUsage({ followUpCount: 10 }))

    await checkFollowUpLimit("user-1", "FREE")
    expect(mockUpsert).not.toHaveBeenCalled()
  })
})
