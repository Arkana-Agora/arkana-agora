import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const redisHolder = vi.hoisted(() => ({ current: undefined as unknown }))

const redisMock = vi.hoisted(() => ({
  get: vi.fn(),
  set: vi.fn(),
  del: vi.fn(),
}))

const prismaMock = vi.hoisted(() => ({
  follow: { count: vi.fn() },
}))

const getFeedMock = vi.hoisted(() => vi.fn())

vi.mock("@/lib/redis", () => ({
  get redis() {
    return redisHolder.current
  },
}))
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }))
vi.mock("@/lib/social/feed-algorithm", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/social/feed-algorithm")>()
  return { getFeed: getFeedMock, FEED_MAX_LIMIT: actual.FEED_MAX_LIMIT }
})
vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

import {
  FEED_CACHE_TTL_SECONDS,
  getCachedFeed,
  MATERIALIZE_FOLLOWING_THRESHOLD,
  refreshFeedCache,
} from "@/lib/feed-cache"

// Payload realista: JSON round-trip do Redis (datas viram string)
const cachedPost = {
  id: "p1",
  authorId: "usr_2",
  createdAt: "2026-09-26T10:00:00.000Z",
  updatedAt: "2026-09-26T10:00:00.000Z",
  isPinned: false,
  isHidden: false,
  type: "text",
  content: "ola",
  author: { id: "usr_2", name: "Ana", avatar: null, profile: null },
}

beforeEach(() => {
  vi.clearAllMocks()
  redisHolder.current = redisMock
  prismaMock.follow.count.mockResolvedValue(0)
  getFeedMock.mockResolvedValue({ posts: [{ id: "p1" }], nextCursor: null })
  redisMock.get.mockResolvedValue(null)
  redisMock.set.mockResolvedValue("OK")
  redisMock.del.mockResolvedValue(1)
})

afterEach(() => {
  redisHolder.current = undefined
})

describe("refreshFeedCache (T030/S2-18)", () => {
  it("materializa feed para >1000 following com TTL de 5 min", async () => {
    prismaMock.follow.count.mockResolvedValue(
      MATERIALIZE_FOLLOWING_THRESHOLD + 1,
    )

    const refreshed = await refreshFeedCache("usr_1")

    expect(refreshed).toBe(true)
    expect(getFeedMock).toHaveBeenCalledWith("usr_1", undefined, 50)
    expect(redisMock.set).toHaveBeenCalledWith(
      "feed:cache:usr_1",
      JSON.stringify({ posts: [{ id: "p1" }], nextCursor: null }),
      "EX",
      5 * 60,
    )
    expect(FEED_CACHE_TTL_SECONDS).toBe(300)
  })

  it("abaixo do threshold não materializa e limpa cache antigo", async () => {
    prismaMock.follow.count.mockResolvedValue(MATERIALIZE_FOLLOWING_THRESHOLD)

    const refreshed = await refreshFeedCache("usr_1")

    expect(refreshed).toBe(false)
    expect(getFeedMock).not.toHaveBeenCalled()
    expect(redisMock.del).toHaveBeenCalledWith("feed:cache:usr_1")
  })

  it("sem Redis não materializa (mesmo acima do threshold)", async () => {
    redisHolder.current = undefined
    prismaMock.follow.count.mockResolvedValue(2000)

    const refreshed = await refreshFeedCache("usr_1")

    expect(refreshed).toBe(false)
    expect(getFeedMock).not.toHaveBeenCalled()
  })

  it("falha no getFeed vira false (fail-soft)", async () => {
    prismaMock.follow.count.mockResolvedValue(2000)
    getFeedMock.mockRejectedValue(new Error("db down"))

    const refreshed = await refreshFeedCache("usr_1")

    expect(refreshed).toBe(false)
    expect(redisMock.set).not.toHaveBeenCalled()
  })
})

describe("getCachedFeed (T030)", () => {
  it("hit retorna a página materializada com createdAt/updatedAt como Date", async () => {
    redisMock.get.mockResolvedValue(
      JSON.stringify({ posts: [cachedPost], nextCursor: "abc" }),
    )

    const page = await getCachedFeed("usr_1")

    expect(page?.nextCursor).toBe("abc")
    expect(page?.posts).toHaveLength(1)
    expect(page?.posts[0]?.id).toBe("p1")
    expect(page?.posts[0]?.createdAt).toBeInstanceOf(Date)
    expect(page?.posts[0]?.createdAt.toISOString()).toBe(
      "2026-09-26T10:00:00.000Z",
    )
    expect(page?.posts[0]?.updatedAt).toBeInstanceOf(Date)
  })

  it("cursor além da página materializada → miss (usa getFeed)", async () => {
    const page = await getCachedFeed("usr_1", "cursor-qualquer")

    expect(page).toBeNull()
    expect(redisMock.get).not.toHaveBeenCalled()
  })

  it("sem Redis → miss", async () => {
    redisHolder.current = undefined
    expect(await getCachedFeed("usr_1")).toBeNull()
  })

  it("JSON inválido ou shape errado → miss", async () => {
    redisMock.get.mockResolvedValue("{quebrado")
    expect(await getCachedFeed("usr_1")).toBeNull()

    redisMock.get.mockResolvedValue(JSON.stringify({ foo: 1 }))
    expect(await getCachedFeed("usr_1")).toBeNull()

    // post incompleto (sem datas/autor) → miss, não payload torto
    redisMock.get.mockResolvedValue(
      JSON.stringify({ posts: [{ id: "p1" }], nextCursor: null }),
    )
    expect(await getCachedFeed("usr_1")).toBeNull()

    // data impossível → miss (z.coerce.date rejeita)
    redisMock.get.mockResolvedValue(
      JSON.stringify({
        posts: [{ ...cachedPost, createdAt: "nao-e-data" }],
        nextCursor: null,
      }),
    )
    expect(await getCachedFeed("usr_1")).toBeNull()
  })
})
