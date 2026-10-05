// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// Wiring T088 (pull-forward parcial na Phase 2.5): as rotas de criação de
// post e de follow publicam no Event Bus via emitters (T070).

const prismaMock = vi.hoisted(() => ({
  user: { findUnique: vi.fn() },
  userProfile: { findUnique: vi.fn() },
  reading: { findUnique: vi.fn() },
  follow: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
  },
  followReward: { findUnique: vi.fn(), create: vi.fn() },
  notification: { create: vi.fn(), deleteMany: vi.fn() },
  post: { create: vi.fn(), findUnique: vi.fn() },
  postHashtag: { createMany: vi.fn() },
  $transaction: vi.fn(),
  $queryRaw: vi.fn(),
}))

const helpersMock = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  optionalAuth: vi.fn(),
  findVisibleProfile: vi.fn(),
}))

const rateMock = vi.hoisted(() => ({
  enforceSocialLimit: vi.fn(),
}))

const csrfMock = vi.hoisted(() => ({
  enforceCsrf: vi.fn(),
}))

const versosMock = vi.hoisted(() => ({
  earnVersos: vi.fn(),
  VersosSource: { Follow: "follow", Reading: "reading" },
}))

const moderationMock = vi.hoisted(() => ({
  checkContent: vi.fn(),
}))

const analyticsMock = vi.hoisted(() => ({
  trackPostCreate: vi.fn(),
  trackPostLimitHit: vi.fn(),
  trackFollow: vi.fn(),
  trackVersosEarned: vi.fn(),
}))

const feedCacheMock = vi.hoisted(() => ({
  refreshFeedCache: vi.fn(),
}))

const emittersMock = vi.hoisted(() => ({
  emitNewPost: vi.fn(),
  emitFollowUpdate: vi.fn(),
  emitNotification: vi.fn(),
  emitLikeUpdated: vi.fn(),
  emitCommentAdded: vi.fn(),
  emitCommentLikeUpdated: vi.fn(),
  emitGiftReceived: vi.fn(),
}))

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }))
vi.mock("@/app/api/v1/users/_helpers", () => helpersMock)
vi.mock("@/lib/middleware/rate-limit", () => rateMock)
vi.mock("@/lib/middleware/csrf", () => csrfMock)
vi.mock("@/lib/social/versos", () => versosMock)
vi.mock("@/lib/moderation", () => moderationMock)
vi.mock("@/lib/analytics", () => analyticsMock)
vi.mock("@/lib/feed-cache", () => feedCacheMock)
vi.mock("@socket/src/emitters", () => emittersMock)
vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  newReqId: () => "req_test",
}))

async function callCreatePost(body: unknown) {
  const { POST } = await import("@/app/api/v1/social/posts/route")
  return POST(
    new Request("http://localhost:3000/api/v1/social/posts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  )
}

async function callFollow(targetId: string) {
  const { POST } = await import("@/app/api/v1/social/follow/[userId]/route")
  return POST(
    new Request(`http://localhost:3000/api/v1/social/follow/${targetId}`, {
      method: "POST",
    }),
    { params: Promise.resolve({ userId: targetId }) },
  )
}

const rateAllowed = {
  allowed: true,
  headers: { "X-RateLimit-Remaining": "9" },
  check: { allowed: true, remaining: 9 },
}

const createdPost = {
  id: "post_new",
  authorId: "usr_1",
  type: "text",
  content: "ola mundo",
  imageUrls: [],
  audience: "public",
  likeCount: 0,
  commentCount: 0,
  createdAt: new Date("2026-10-01T10:00:00Z"),
  updatedAt: new Date("2026-10-01T10:00:00Z"),
  author: { id: "usr_1", name: "Viewer", displayName: null, avatar: null },
}

const viewer = {
  id: "usr_1",
  name: "Viewer Name",
  displayName: null,
  maxFollowing: 5000,
}

const target = { id: "usr_target", isBanned: false, deletedAt: null }

beforeEach(() => {
  vi.clearAllMocks()
  vi.resetModules()
  helpersMock.requireAuth.mockResolvedValue({ userId: "usr_1" })
  csrfMock.enforceCsrf.mockReturnValue(null)
  rateMock.enforceSocialLimit.mockResolvedValue(rateAllowed)
  moderationMock.checkContent.mockReturnValue({
    allowed: true,
    flaggedWords: [],
  })
  prismaMock.$transaction.mockImplementation(
    async (fn: (tx: unknown) => Promise<unknown>) => fn(prismaMock),
  )
  prismaMock.user.findUnique.mockImplementation(
    async (args: { where: { id: string } }) => {
      if (args.where.id === "usr_1") {
        return { ...viewer, subscriptionTier: "FREE" }
      }
      return target
    },
  )
  prismaMock.userProfile.findUnique.mockResolvedValue({
    userId: "usr_target",
    privacy: null,
  })
  prismaMock.post.create.mockImplementation(
    async (args: { data: { content?: string } }) => ({
      ...createdPost,
      content: args.data.content ?? "",
    }),
  )
  prismaMock.postHashtag.createMany.mockResolvedValue({ count: 0 })
  prismaMock.follow.findUnique.mockResolvedValue(null)
  prismaMock.followReward.findUnique.mockResolvedValue(null)
  prismaMock.follow.create.mockResolvedValue({ id: "flw_new" })
  prismaMock.followReward.create.mockResolvedValue({ id: "frw_new" })
  // Prisma devolve a row completa (echo do que foi escrito + id gerado) —
  // o emit da notificação lê id/type/message/data da própria row (V5).
  prismaMock.notification.create.mockImplementation(
    async (args: { data: Record<string, unknown> }) => ({
      id: "ntf_new",
      ...args.data,
    }),
  )
  prismaMock.notification.deleteMany.mockResolvedValue({ count: 0 })
  prismaMock.follow.count.mockResolvedValue(3)
  prismaMock.$queryRaw.mockResolvedValue([{ maxFollowing: 5000 }])
  versosMock.earnVersos.mockResolvedValue(15)
  feedCacheMock.refreshFeedCache.mockResolvedValue(undefined)
})

afterEach(() => {
  vi.resetModules()
})

describe("T088 parcial — emitNewPost em POST /social/posts", () => {
  it("post criado publica new-post para as rooms dos seguidores", async () => {
    const res = await callCreatePost({ content: "ola mundo", type: "text" })
    expect(res.status).toBe(201)

    expect(emittersMock.emitNewPost).toHaveBeenCalledTimes(1)
    expect(emittersMock.emitNewPost).toHaveBeenCalledWith({
      authorId: "usr_1",
      postId: "post_new",
      preview: "ola mundo",
    })
  })

  it("preview truncado em 120 caracteres", async () => {
    const long = "x".repeat(300)
    await callCreatePost({ content: long, type: "text" })

    const call = emittersMock.emitNewPost.mock.calls[0]?.[0] as {
      preview: string
    }
    expect(call.preview).toHaveLength(120)
  })

  it("falha de criação (4xx) não emite", async () => {
    const res = await callCreatePost({ content: "", type: "text" })
    expect(res.status).toBe(422)
    expect(emittersMock.emitNewPost).not.toHaveBeenCalled()
  })

  it("201 nao espera emitNewPost nem refreshFeedCache (fire-and-forget)", async () => {
    emittersMock.emitNewPost.mockReturnValue(
      new Promise(() => undefined) as never,
    )
    feedCacheMock.refreshFeedCache.mockReturnValue(
      new Promise(() => undefined) as never,
    )

    const res = await callCreatePost({ content: "async", type: "text" })

    expect(res.status).toBe(201)
    expect(emittersMock.emitNewPost).toHaveBeenCalledTimes(1)
  })
})

describe("T088 parcial — emitFollowUpdate/emitNotification em follow", () => {
  it("follow 201 emite follow-update e notification para o alvo", async () => {
    const res = await callFollow("usr_target")
    expect(res.status).toBe(201)

    expect(emittersMock.emitFollowUpdate).toHaveBeenCalledWith({
      followerId: "usr_1",
      followingId: "usr_target",
      isFollowing: true,
    })
    expect(emittersMock.emitNotification).toHaveBeenCalledWith({
      userId: "usr_target",
      notification: {
        id: "ntf_new",
        type: "follow",
        message: "Viewer Name começou a seguir você",
        data: { followerId: "usr_1" },
      },
    })
  })

  it("unfollow 200 emite follow-update sem notification", async () => {
    prismaMock.follow.findUnique.mockResolvedValue({ id: "flw_1" })
    prismaMock.follow.delete.mockResolvedValue({ id: "flw_1" })

    const res = await callFollow("usr_target")
    expect(res.status).toBe(200)

    expect(emittersMock.emitFollowUpdate).toHaveBeenCalledWith({
      followerId: "usr_1",
      followingId: "usr_target",
      isFollowing: false,
    })
    expect(emittersMock.emitNotification).not.toHaveBeenCalled()
  })

  it("409 self-follow não emite", async () => {
    const res = await callFollow("usr_1")
    expect(res.status).toBe(409)
    expect(emittersMock.emitFollowUpdate).not.toHaveBeenCalled()
    expect(emittersMock.emitNotification).not.toHaveBeenCalled()
  })
})
