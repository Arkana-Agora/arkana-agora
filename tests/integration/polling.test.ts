// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const prismaMock = vi.hoisted(() => ({
  follow: { findMany: vi.fn() },
  post: { findMany: vi.fn() },
  postLike: { findMany: vi.fn() },
  comment: { findMany: vi.fn() },
  notification: { findMany: vi.fn(), count: vi.fn() },
}))

const helpersMock = vi.hoisted(() => ({
  requireAuth: vi.fn(),
}))

const redisMock = vi.hoisted(() => ({ eval: vi.fn() }))
vi.mock("@/lib/redis", () => ({ redis: redisMock }))

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }))
vi.mock("@/app/api/v1/users/_helpers", () => helpersMock)
vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  newReqId: () => "req_test",
}))

const BASE = "http://localhost:3000/api/v1/social/polling"

const ROUTES = {
  posts: () => import("@/app/api/v1/social/polling/posts/route"),
  likes: () => import("@/app/api/v1/social/polling/likes/route"),
  comments: () => import("@/app/api/v1/social/polling/comments/route"),
  notifications: () =>
    import("@/app/api/v1/social/polling/notifications/route"),
} as const

type PollingPath = keyof typeof ROUTES

function callGet(path: PollingPath, query = "") {
  return ROUTES[path]().then(({ GET }) =>
    GET(new Request(`${BASE}/${path}${query}`)),
  )
}

function authOk() {
  helpersMock.requireAuth.mockResolvedValue({ userId: "usr_me" })
}

function authDenied() {
  helpersMock.requireAuth.mockResolvedValue(
    Response.json({ error: { code: "AUTH_TOKEN_INVALID" } }, { status: 401 }),
  )
}

describe("polling endpoints (T071)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.follow.findMany.mockResolvedValue([])
    prismaMock.post.findMany.mockResolvedValue([])
    prismaMock.postLike.findMany.mockResolvedValue([])
    prismaMock.comment.findMany.mockResolvedValue([])
    prismaMock.notification.findMany.mockResolvedValue([])
    prismaMock.notification.count.mockResolvedValue(0)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it("todas exigem autenticação", async () => {
    authDenied()
    for (const path of [
      "posts",
      "likes",
      "comments",
      "notifications",
    ] as const) {
      const res = await callGet(path)
      expect(res.status).toBe(401)
    }
  })

  it("posts: devolve data.posts dos seguidos desde `since`", async () => {
    authOk()
    prismaMock.follow.findMany.mockResolvedValue([
      { followingId: "usr_a" },
      { followingId: "usr_b" },
    ])
    const now = new Date()
    const since = new Date(now.getTime() - 60_000).toISOString()
    prismaMock.post.findMany.mockResolvedValue([
      {
        id: "p1",
        authorId: "usr_a",
        content: "oi",
        author: {
          id: "usr_a",
          name: "A",
          displayName: null,
          avatar: null,
          isBanned: false,
          deletedAt: null,
          isActive: true,
          profile: null,
        },
      },
      {
        id: "p2",
        authorId: "usr_priv",
        content: "oculto",
        author: {
          id: "usr_priv",
          name: "P",
          displayName: null,
          avatar: null,
          isBanned: false,
          deletedAt: null,
          isActive: true,
          profile: { privacy: { profileVisibility: "private" } },
        },
      },
    ])

    const res = await callGet("posts", `?since=${encodeURIComponent(since)}`)
    expect(res.status).toBe(200)
    expect(res.headers.get("Cache-Control")).toBe("private, no-store")
    expect(res.headers.get("Vary")).toBe("Authorization")

    const body = (await res.json()) as {
      data: { posts: Array<{ id: string; author: Record<string, unknown> }> }
    }
    // perfil privado seguido é visível (viewer segue), mas internals
    // do predicado nunca saem na resposta
    expect(body.data.posts.map((p) => p.id)).toEqual(["p1", "p2"])
    expect(body.data.posts[0]!.author).not.toHaveProperty("isBanned")
    expect(body.data.posts[0]!.author).not.toHaveProperty("profile")

    const where = prismaMock.post.findMany.mock.calls[0]?.[0]?.where as {
      authorId: { in: string[] }
      isHidden: boolean
      createdAt: { gte: Date }
    }
    expect(where.authorId.in).toEqual(["usr_a", "usr_b"])
    expect(where.isHidden).toBe(false)
    expect(where.createdAt.gte).toBeInstanceOf(Date)
  })

  it("posts: `since` invalido responde 422", async () => {
    authOk()
    const res = await callGet("posts", "?since=nao-e-data")
    expect(res.status).toBe(422)
    expect(prismaMock.post.findMany).not.toHaveBeenCalled()
  })

  it("posts: sem `since` usa janela default de 5 minutos", async () => {
    authOk()
    const before = Date.now()
    await callGet("posts")
    const gt = (
      prismaMock.post.findMany.mock.calls[0]?.[0]?.where as {
        createdAt: { gte: Date }
      }
    ).createdAt.gte.getTime()
    expect(gt).toBeLessThanOrEqual(before - 4 * 60_000 + 1000)
    expect(gt).toBeGreaterThanOrEqual(before - 6 * 60_000)
  })

  it("posts: `since` antes do teto de 24h e limitado ao teto (integridade C1)", async () => {
    authOk()
    const before = Date.now()
    const res = await callGet(
      "posts",
      `?since=${encodeURIComponent("1970-01-01T00:00:00.000Z")}`,
    )
    expect(res.status).toBe(200)
    const gt = (
      prismaMock.post.findMany.mock.calls[0]?.[0]?.where as {
        createdAt: { gte: Date }
      }
    ).createdAt.gte.getTime()
    // sem teto, gte viraria 1970 → range scan completo do índice a cada poll
    expect(gt).toBeGreaterThanOrEqual(before - 24 * 60 * 60_000 - 1000)
    expect(gt).toBeLessThanOrEqual(before - 23 * 60 * 60_000)
  })

  it("posts: `since` dentro do teto passa inalterado (não regredir janela)", async () => {
    authOk()
    const since = new Date(Date.now() - 60 * 60_000).toISOString()
    await callGet("posts", `?since=${encodeURIComponent(since)}`)
    const gt = (
      prismaMock.post.findMany.mock.calls[0]?.[0]?.where as {
        createdAt: { gte: Date }
      }
    ).createdAt.gte
    expect(gt.toISOString()).toBe(since)
  })

  it("likes: devolve curtidas nos posts próprios desde `since`", async () => {
    authOk()
    prismaMock.postLike.findMany.mockResolvedValue([
      { id: "l1", postId: "p1", userId: "usr_x", createdAt: new Date() },
    ])
    const since = new Date(Date.now() - 60_000).toISOString()
    const res = await callGet("likes", `?since=${encodeURIComponent(since)}`)
    expect(res.status).toBe(200)
    const body = (await res.json()) as { data: { likes: unknown[] } }
    expect(body.data.likes).toHaveLength(1)

    const args = prismaMock.postLike.findMany.mock.calls[0]?.[0] as {
      where: { post: { authorId: string }; createdAt: { gte: Date } }
    }
    expect(args.where.post.authorId).toBe("usr_me")
    expect(args.where.createdAt.gte.toISOString()).toBe(since)
    expect(res.headers.get("Cache-Control")).toBe("private, no-store")
  })

  it("comments: devolve comentários nos posts próprios desde `since`", async () => {
    authOk()
    prismaMock.comment.findMany.mockResolvedValue([
      { id: "c1", postId: "p1", authorId: "usr_x", content: "oi" },
    ])
    const since = new Date(Date.now() - 60_000).toISOString()
    const res = await callGet("comments", `?since=${encodeURIComponent(since)}`)
    expect(res.status).toBe(200)
    const body = (await res.json()) as { data: { comments: unknown[] } }
    expect(body.data.comments).toHaveLength(1)

    const args = prismaMock.comment.findMany.mock.calls[0]?.[0] as {
      where: { post: { authorId: string }; createdAt: { gte: Date } }
    }
    expect(args.where.post.authorId).toBe("usr_me")
    expect(res.headers.get("Cache-Control")).toBe("private, no-store")
  })

  it("notifications: devolve lista + unreadCount", async () => {
    authOk()
    prismaMock.notification.findMany.mockResolvedValue([
      { id: "n1", type: "follow", message: "seguiu você", isRead: false },
    ])
    prismaMock.notification.count.mockResolvedValue(3)
    const since = new Date(Date.now() - 60_000).toISOString()
    const res = await callGet(
      "notifications",
      `?since=${encodeURIComponent(since)}`,
    )
    expect(res.status).toBe(200)
    expect(res.headers.get("Cache-Control")).toBe("private, no-store")

    const body = (await res.json()) as {
      data: { notifications: unknown[]; unreadCount: number }
    }
    expect(body.data.notifications).toHaveLength(1)
    expect(body.data.unreadCount).toBe(3)

    const findArgs = prismaMock.notification.findMany.mock.calls[0]?.[0] as {
      where: { userId: string }
    }
    expect(findArgs.where.userId).toBe("usr_me")
    const countArgs = prismaMock.notification.count.mock.calls[0]?.[0] as {
      where: { userId: string; isRead: boolean }
    }
    expect(countArgs.where).toEqual({ userId: "usr_me", isRead: false })
  })
})

describe("rate limit de polling (revisao O)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.follow.findMany.mockResolvedValue([])
    prismaMock.post.findMany.mockResolvedValue([])
    prismaMock.postLike.findMany.mockResolvedValue([])
    prismaMock.comment.findMany.mockResolvedValue([])
    prismaMock.notification.findMany.mockResolvedValue([])
    prismaMock.notification.count.mockResolvedValue(0)
    redisMock.eval.mockResolvedValue([1, 1, ""])
  })

  it("as 4 rotas passam pelo limite rl:polling (200)", async () => {
    authOk()
    for (const path of [
      "posts",
      "likes",
      "comments",
      "notifications",
    ] as const) {
      redisMock.eval.mockClear()
      redisMock.eval.mockResolvedValue([1, 1, ""])
      const res = await callGet(path)
      expect(res.status).toBe(200)
      expect(redisMock.eval.mock.calls[0]?.[2]).toBe("rl:polling:usr_me")
    }
  })

  it("429 + Retry-After quando o limite de polling estoura", async () => {
    authOk()
    redisMock.eval.mockResolvedValue([0, 61, String(Date.now() - 1000)])
    const res = await callGet("posts")
    expect(res.status).toBe(429)
    expect(res.headers.get("Retry-After")).not.toBeNull()
    expect(redisMock.eval.mock.calls[0]?.[2]).toBe("rl:polling:usr_me")
  })

  it("401 continua vindo antes do rate limit", async () => {
    authDenied()
    const res = await callGet("posts")
    expect(res.status).toBe(401)
    expect(redisMock.eval).not.toHaveBeenCalled()
  })
})

describe("polling/comments - filtro de autor (revisao R)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.comment.findMany.mockResolvedValue([])
  })

  it("oculta coment�rios de autores banidos/soft-deleted/inativos", async () => {
    authOk()
    const res = await callGet("comments")
    expect(res.status).toBe(200)
    const args = prismaMock.comment.findMany.mock.calls[0]![0]!
    expect(args.where.author).toEqual({
      isActive: true,
      isBanned: false,
      deletedAt: null,
    })
  })
})

describe("serverTime no envelope (revisao S)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.follow.findMany.mockResolvedValue([])
    prismaMock.post.findMany.mockResolvedValue([])
    prismaMock.postLike.findMany.mockResolvedValue([])
    prismaMock.comment.findMany.mockResolvedValue([])
    prismaMock.notification.findMany.mockResolvedValue([])
    prismaMock.notification.count.mockResolvedValue(0)
  })

  it("as 4 rotas devolvem serverTime top-level (relogio do servidor)", async () => {
    authOk()
    for (const path of [
      "posts",
      "likes",
      "comments",
      "notifications",
    ] as const) {
      const before = Date.now()
      const res = await callGet(path)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(typeof body.serverTime).toBe("string")
      const serverTime = new Date(body.serverTime).getTime()
      expect(Number.isNaN(serverTime)).toBe(false)
      expect(serverTime).toBeGreaterThanOrEqual(before)
      expect(serverTime).toBeLessThanOrEqual(Date.now())
    }
  })
})

describe("until — drenagem de backlog >50 (revisao I-1)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.follow.findMany.mockResolvedValue([])
    prismaMock.post.findMany.mockResolvedValue([])
    prismaMock.postLike.findMany.mockResolvedValue([])
    prismaMock.comment.findMany.mockResolvedValue([])
    prismaMock.notification.findMany.mockResolvedValue([])
    prismaMock.notification.count.mockResolvedValue(0)
  })

  it("posts: `until` invalido responde 422 (field until)", async () => {
    authOk()
    const res = await callGet("posts", "?until=nao-e-data")
    expect(res.status).toBe(422)
    const body = (await res.json()) as {
      error: { details?: Array<{ field: string }> }
    }
    expect(body.error.details?.[0]?.field).toBe("until")
    expect(prismaMock.post.findMany).not.toHaveBeenCalled()
  })

  it("posts: `until` combina gte(since) + lt(until) no where", async () => {
    authOk()
    const until = new Date(Date.now() - 30_000).toISOString()
    const res = await callGet("posts", `?until=${encodeURIComponent(until)}`)
    expect(res.status).toBe(200)
    const where = prismaMock.post.findMany.mock.calls[0]?.[0]?.where as {
      createdAt: { gte: Date; lt?: Date }
    }
    expect(where.createdAt.gte).toBeInstanceOf(Date)
    expect(where.createdAt.lt).toBeInstanceOf(Date)
    expect(where.createdAt.lt?.toISOString()).toBe(until)
  })

  it("posts: sem `until` não há lt (contrato antigo preservado)", async () => {
    authOk()
    const res = await callGet("posts")
    expect(res.status).toBe(200)
    const where = prismaMock.post.findMany.mock.calls[0]?.[0]?.where as {
      createdAt: Record<string, unknown>
    }
    expect(where.createdAt).not.toHaveProperty("lt")
  })

  it("notifications: `until` vira createdAt lt", async () => {
    authOk()
    const until = new Date(Date.now() - 10_000).toISOString()
    const res = await callGet(
      "notifications",
      `?until=${encodeURIComponent(until)}`,
    )
    expect(res.status).toBe(200)
    const where = prismaMock.notification.findMany.mock.calls[0]?.[0]
      ?.where as { createdAt: { gte: Date; lt?: Date } }
    expect(where.createdAt.lt).toBeInstanceOf(Date)
    expect(where.createdAt.lt?.toISOString()).toBe(until)
  })
})

describe("integridade A1 (revisão 2026-10-04)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.follow.findMany.mockResolvedValue([])
    prismaMock.post.findMany.mockResolvedValue([])
    prismaMock.postLike.findMany.mockResolvedValue([])
    prismaMock.comment.findMany.mockResolvedValue([])
    prismaMock.notification.findMany.mockResolvedValue([])
    prismaMock.notification.count.mockResolvedValue(0)
    helpersMock.requireAuth.mockResolvedValue({ userId: "usr_me" })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it("as 4 rotas usam gte no cursor `since` — linha no mesmo ms não se perde (I1)", async () => {
    const since = new Date(Date.now() - 60_000).toISOString()
    for (const path of [
      "posts",
      "likes",
      "comments",
      "notifications",
    ] as const) {
      const res = await callGet(path, `?since=${encodeURIComponent(since)}`)
      expect(res.status).toBe(200)
    }
    const extract = (calls: unknown[][]) => {
      const first = calls[0]?.[0] as {
        where: { createdAt: Record<string, unknown> }
      }
      return first.where.createdAt
    }
    for (const [label, calls] of [
      ["posts", prismaMock.post.findMany.mock.calls],
      ["likes", prismaMock.postLike.findMany.mock.calls],
      ["comments", prismaMock.comment.findMany.mock.calls],
      ["notifications", prismaMock.notification.findMany.mock.calls],
    ] as const) {
      const createdAt = extract(calls)
      expect(createdAt, label).toHaveProperty("gte")
      expect(createdAt, label).not.toHaveProperty("gt")
      expect(createdAt.gte, label).toBeInstanceOf(Date)
    }
  })

  it("posts: consulta de seguidos limita `take` (A1 — sem teto varreria todos os follows)", async () => {
    const res = await callGet("posts")
    expect(res.status).toBe(200)
    expect(prismaMock.follow.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: expect.any(Number) }),
    )
    const args = prismaMock.follow.findMany.mock.calls[0]?.[0] as {
      take: number
    }
    expect(args.take).toBeGreaterThan(0)
  })

  it("likes: filtra liker banido/inativo/deletado (A1)", async () => {
    const res = await callGet("likes")
    expect(res.status).toBe(200)
    const where = prismaMock.postLike.findMany.mock.calls[0]?.[0]?.where as {
      user?: unknown
    }
    expect(where.user).toEqual({
      isActive: true,
      isBanned: false,
      deletedAt: null,
    })
  })
})
