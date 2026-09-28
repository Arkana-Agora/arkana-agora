import { beforeEach, describe, expect, it, vi } from "vitest"

const prismaMock = vi.hoisted(() => ({ $queryRaw: vi.fn() }))
const refreshFeedCacheMock = vi.hoisted(() => vi.fn())

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }))
vi.mock("@/lib/feed-cache", () => ({
  refreshFeedCache: refreshFeedCacheMock,
  MATERIALIZE_FOLLOWING_THRESHOLD: 1000,
}))
vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

import {
  FEED_CACHE_REFRESH_CRON,
  runFeedCacheRefresh,
} from "@/jobs/feed-cache-refresh"

beforeEach(() => {
  vi.clearAllMocks()
  prismaMock.$queryRaw.mockResolvedValue([])
  refreshFeedCacheMock.mockResolvedValue(true)
})

describe("runFeedCacheRefresh (T042)", () => {
  it("cron de 5 minutos", () => {
    expect(FEED_CACHE_REFRESH_CRON).toBe("*/5 * * * *")
  })

  it("refresca candidatos >1000 passing o COUNT(*) do SQL (sem recount)", async () => {
    prismaMock.$queryRaw.mockResolvedValue([
      { followerId: "usr_heavy_1", following: 1200 },
      { followerId: "usr_heavy_2", following: 1001 },
    ])
    refreshFeedCacheMock
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false)

    const summary = await runFeedCacheRefresh()

    expect(summary).toEqual({ candidates: 2, refreshed: 1 })
    expect(refreshFeedCacheMock).toHaveBeenCalledTimes(2)
    expect(refreshFeedCacheMock).toHaveBeenCalledWith("usr_heavy_1", 1200)
    expect(refreshFeedCacheMock).toHaveBeenCalledWith("usr_heavy_2", 1001)
  })

  it("sem candidatos não refresca nada", async () => {
    const summary = await runFeedCacheRefresh()

    expect(summary).toEqual({ candidates: 0, refreshed: 0 })
    expect(refreshFeedCacheMock).not.toHaveBeenCalled()
  })
})
