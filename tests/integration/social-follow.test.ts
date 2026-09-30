// @vitest-environment node
import { Prisma } from "@prisma/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const prismaMock = vi.hoisted(() => ({
  user: { findUnique: vi.fn() },
  userProfile: { findUnique: vi.fn() },
  follow: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
  },
  followReward: {
    findUnique: vi.fn(),
    create: vi.fn(),
  },
  notification: { create: vi.fn(), deleteMany: vi.fn() },
  $queryRaw: vi.fn(),
  $transaction: vi.fn(),
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
  VersosSource: { Follow: "follow" },
}))

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }))
vi.mock("@/app/api/v1/users/_helpers", () => helpersMock)
vi.mock("@/lib/middleware/rate-limit", () => rateMock)
vi.mock("@/lib/middleware/csrf", () => csrfMock)
vi.mock("@/lib/social/versos", () => versosMock)
vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  newReqId: () => "req_test",
}))

async function callPost(targetId: string) {
  const { POST } = await import("@/app/api/v1/social/follow/[userId]/route")
  return POST(
    new Request(`http://localhost:3000/api/v1/social/follow/${targetId}`, {
      method: "POST",
    }),
    { params: Promise.resolve({ userId: targetId }) },
  )
}

interface FindManyCall {
  where: {
    followingId?: unknown
    followerId?: unknown
    following?: unknown
    follower?: unknown
    OR?: unknown[]
    AND?: { OR: unknown[] }[]
    [key: string]: unknown
  }
  orderBy?: unknown
  take?: number
}

function findManyArgs(which: "first" | "last" = "first"): FindManyCall {
  const calls = prismaMock.follow.findMany.mock.calls
  const call = which === "first" ? calls[0] : calls.at(-1)
  return (call?.[0] ?? {}) as FindManyCall
}

const viewer = {
  id: "usr_1",
  name: "Viewer Name",
  displayName: null,
  maxFollowing: 5000,
}
const target = { id: "usr_target", name: "Target Name" }

beforeEach(() => {
  vi.clearAllMocks()
  vi.resetModules()
  helpersMock.requireAuth.mockResolvedValue({ userId: "usr_1" })
  helpersMock.optionalAuth.mockResolvedValue(null)
  helpersMock.findVisibleProfile.mockImplementation(
    async (usernameRaw: string) => {
      if (
        usernameRaw === "ghost" ||
        usernameRaw === "a%20b" ||
        usernameRaw === "target_private"
      )
        return null
      return {
        profile: {
          userId: "usr_target",
          privacy: null,
          user: { id: "usr_target", isBanned: false, deletedAt: null },
        },
        username: "target",
        showStats: true,
      }
    },
  )
  csrfMock.enforceCsrf.mockReturnValue(null)
  rateMock.enforceSocialLimit.mockResolvedValue({
    allowed: true,
    headers: { "X-RateLimit-Remaining": "19" },
    check: { allowed: true, remaining: 19 },
  })
  prismaMock.$transaction.mockImplementation(
    async (fn: (tx: unknown) => Promise<unknown>) => fn(prismaMock),
  )
  prismaMock.user.findUnique.mockImplementation(
    async (args: { where: { id: string } }) =>
      args.where.id === viewer.id ? viewer : target,
  )
  prismaMock.userProfile.findUnique.mockResolvedValue({
    userId: target.id,
    privacy: null,
  })
  prismaMock.follow.findUnique.mockResolvedValue(null)
  prismaMock.followReward.findUnique.mockResolvedValue(null)
  prismaMock.follow.create.mockResolvedValue({ id: "flw_new" })
  prismaMock.followReward.create.mockResolvedValue({ id: "frw_new" })
  prismaMock.notification.create.mockResolvedValue({ id: "ntf_new" })
  prismaMock.follow.count.mockResolvedValue(3)
  versosMock.earnVersos.mockResolvedValue(15)
  prismaMock.$queryRaw.mockResolvedValue([{ maxFollowing: 5000 }])
  prismaMock.notification.deleteMany.mockResolvedValue({ count: 0 })
})

afterEach(() => {
  vi.resetModules()
})

describe("POST /api/v1/social/follow/:userId — seguir (T043/AC-1)", () => {
  it("cria follow, notifica o seguido e recompensa o seguidor com 201", async () => {
    const res = await callPost("usr_target")
    const body = await res.json()

    expect(res.status).toBe(201)
    expect(body).toEqual({
      data: {
        following: true,
        followingCount: 3,
        followersCount: 3,
      },
    })
    expect(res.headers.get("X-RateLimit-Remaining")).toBe("19")

    expect(prismaMock.follow.create).toHaveBeenCalledWith({
      data: { followerId: "usr_1", followingId: "usr_target" },
    })
    expect(prismaMock.notification.create).toHaveBeenCalledWith({
      data: {
        userId: "usr_target",
        type: "follow",
        message: "Viewer Name começou a seguir você",
        data: { followerId: "usr_1" },
      },
    })
    expect(versosMock.earnVersos).toHaveBeenCalledWith(
      "usr_1",
      "follow",
      expect.anything(),
    )
  })

  it("CSRF invalido bloqueia antes de rate limit e DB", async () => {
    csrfMock.enforceCsrf.mockReturnValue(
      Response.json(
        { error: { code: "CSRF_TOKEN_INVALID", message: "CSRF inválido" } },
        { status: 403 },
      ),
    )

    const res = await callPost("usr_target")
    expect(res.status).toBe(403)

    expect(prismaMock.user.findUnique).not.toHaveBeenCalled()
    expect(prismaMock.userProfile.findUnique).not.toHaveBeenCalled()
    expect(prismaMock.follow.create).not.toHaveBeenCalled()
    expect(rateMock.enforceSocialLimit).not.toHaveBeenCalled()
  })

  it("aplica rate limit de follow (20/min) via enforceSocialLimit", async () => {
    await callPost("usr_target")
    expect(rateMock.enforceSocialLimit).toHaveBeenCalledWith({
      limit: "follow",
      userId: "usr_1",
      reqId: "req_test",
    })
  })

  it("retorna 409 CANNOT_FOLLOW_SELF ao seguir a si mesmo", async () => {
    const res = await callPost("usr_1")
    const body = await res.json()
    expect(res.status).toBe(409)
    expect(body.error.code).toBe("CANNOT_FOLLOW_SELF")
    expect(prismaMock.follow.create).not.toHaveBeenCalled()
  })

  it("retorna 404 USER_NOT_FOUND para alvo inexistente", async () => {
    prismaMock.user.findUnique.mockResolvedValue(null)
    const res = await callPost("usr_ghost")
    const body = await res.json()
    expect(res.status).toBe(404)
    expect(body.error.code).toBe("USER_NOT_FOUND")
    expect(prismaMock.follow.create).not.toHaveBeenCalled()
  })

  it("propaga o 429 do rate limit com headers", async () => {
    rateMock.enforceSocialLimit.mockResolvedValue({
      allowed: false,
      headers: { "Retry-After": "42" },
      response: Response.json(
        { error: { code: "RATE_LIMITED", message: "Limite excedido" } },
        { status: 429, headers: { "Retry-After": "42" } },
      ),
      check: { allowed: false, remaining: 0 },
    })
    const res = await callPost("usr_target")
    expect(res.status).toBe(429)
    expect(res.headers.get("Retry-After")).toBe("42")
    expect(prismaMock.follow.create).not.toHaveBeenCalled()
  })
})

describe("POST /api/v1/social/follow/:userId — toggle unfollow (T043/AC-2)", () => {
  beforeEach(() => {
    prismaMock.follow.findUnique.mockResolvedValue({
      id: "flw_1",
      followerId: "usr_1",
      followingId: "usr_target",
    })
    prismaMock.follow.count.mockResolvedValue(2)
  })

  it("remove o follow existente com 200 e nao recompensa de novo", async () => {
    const res = await callPost("usr_target")
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toEqual({
      data: {
        following: false,
        followingCount: 2,
        followersCount: 2,
      },
    })
    expect(prismaMock.follow.delete).toHaveBeenCalledWith({
      where: {
        followerId_followingId: {
          followerId: "usr_1",
          followingId: "usr_target",
        },
      },
    })
    expect(prismaMock.follow.create).not.toHaveBeenCalled()
    expect(prismaMock.notification.create).not.toHaveBeenCalled()
    expect(versosMock.earnVersos).not.toHaveBeenCalled()
  })
})

describe("POST /api/v1/social/follow/:userId — privacidade (T049/S2-14)", () => {
  it("retorna 403 FOLLOW_NOT_ALLOWED quando whoCanFollow nega", async () => {
    prismaMock.userProfile.findUnique.mockResolvedValue({
      userId: "usr_target",
      privacy: { whoCanFollow: "nobody" },
    })
    const res = await callPost("usr_target")
    const body = await res.json()

    expect(res.status).toBe(403)
    expect(body.error.code).toBe("FOLLOW_NOT_ALLOWED")
    expect(body.error.details).toEqual({ reason: "privacy_nobody" })
    expect(prismaMock.follow.create).not.toHaveBeenCalled()
    expect(versosMock.earnVersos).not.toHaveBeenCalled()
  })

  it("retorna 403 com reason privacy_following quando o alvo so segue quem ele ja segue", async () => {
    prismaMock.userProfile.findUnique.mockResolvedValue({
      userId: "usr_target",
      privacy: { whoCanFollow: "following" },
    })
    prismaMock.follow.findFirst.mockResolvedValue(null)
    const res = await callPost("usr_target")
    const body = await res.json()

    expect(res.status).toBe(403)
    expect(body.error.code).toBe("FOLLOW_NOT_ALLOWED")
    expect(body.error.details).toEqual({ reason: "privacy_following" })
    expect(prismaMock.follow.findFirst).toHaveBeenCalledWith({
      where: { followerId: "usr_target", followingId: "usr_1" },
      select: { id: true },
    })
    expect(prismaMock.follow.create).not.toHaveBeenCalled()
  })
})

describe("POST /api/v1/social/follow/:userId — maxFollowing (T043)", () => {
  it("retorna 409 MAX_FOLLOWING_REACHED no cap de seguindo", async () => {
    prismaMock.follow.count.mockResolvedValue(5000)
    const res = await callPost("usr_target")
    const body = await res.json()

    expect(res.status).toBe(409)
    expect(body.error.code).toBe("MAX_FOLLOWING_REACHED")
    expect(prismaMock.follow.create).not.toHaveBeenCalled()
    expect(versosMock.earnVersos).not.toHaveBeenCalled()
  })
})

function prismaError(code: "P2002" | "P2025") {
  return new Prisma.PrismaClientKnownRequestError(`db error ${code}`, {
    code,
    clientVersion: "6.0.0",
  })
}

describe("POST /api/v1/social/follow/:userId — revisões (I1/K2/K3/SC39)", () => {
  it("re-follow não paga Versos de novo quando o marker já existe (K2/K6)", async () => {
    prismaMock.followReward.findUnique.mockResolvedValue({
      id: "frw_1",
      followerId: "usr_1",
      followingId: "usr_target",
    })

    const res = await callPost("usr_target")

    expect(res.status).toBe(201)
    expect(versosMock.earnVersos).not.toHaveBeenCalled()
    expect(prismaMock.followReward.create).not.toHaveBeenCalled()
    expect(prismaMock.follow.create).toHaveBeenCalled()
  })

  it("earnVersos null aborta a tx e devolve 500 com rate headers (K2)", async () => {
    versosMock.earnVersos.mockResolvedValue(null)

    const res = await callPost("usr_target")
    const body = await res.json()

    expect(res.status).toBe(500)
    expect(body.error.code).toBe("INTERNAL_ERROR")
    expect(res.headers.get("X-RateLimit-Remaining")).toBe("19")
  })

  it("corrida P2002 re-ler a fonte de verdade e devolve 201 following:true (K3)", async () => {
    prismaMock.follow.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: "flw_race" })
    prismaMock.follow.create.mockRejectedValueOnce(prismaError("P2002"))

    const res = await callPost("usr_target")
    const body = await res.json()

    expect(res.status).toBe(201)
    expect(body.data).toEqual({
      following: true,
      followingCount: 3,
      followersCount: 3,
    })
    expect(res.headers.get("X-RateLimit-Remaining")).toBe("19")
  })

  it("corrida P2025 re-ler a fonte de verdade e devolve 200 following:false (K3)", async () => {
    prismaMock.follow.findUnique
      .mockResolvedValueOnce({
        id: "flw_1",
        followerId: "usr_1",
        followingId: "usr_target",
      })
      .mockResolvedValueOnce({
        id: "flw_1",
        followerId: "usr_1",
        followingId: "usr_target",
      })
      .mockResolvedValueOnce(null)
    prismaMock.follow.delete.mockRejectedValueOnce(prismaError("P2025"))

    const res = await callPost("usr_target")
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data).toEqual({
      following: false,
      followingCount: 3,
      followersCount: 3,
    })
  })

  it("falha na re-query do handler de corrida devolve 500 JSON (I2)", async () => {
    prismaMock.follow.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockRejectedValueOnce(new Error("db down"))
    prismaMock.follow.create.mockRejectedValueOnce(prismaError("P2002"))

    const res = await callPost("usr_target")
    const body = await res.json()

    expect(res.status).toBe(500)
    expect(body.error.code).toBe("INTERNAL_ERROR")
    expect(res.headers.get("X-RateLimit-Remaining")).toBe("19")
  })

  it("contagens do toggle filtram banidos/soft-deleted como as listas e o profile (SC39)", async () => {
    await callPost("usr_target")

    const countCalls = prismaMock.follow.count.mock.calls.map((c) => c[0])
    expect(countCalls).toContainEqual({
      where: {
        followerId: "usr_target",
        following: { isActive: true, isBanned: false, deletedAt: null },
      },
    })
    expect(countCalls).toContainEqual({
      where: {
        followingId: "usr_target",
        follower: { isActive: true, isBanned: false, deletedAt: null },
      },
    })
  })

  it("retorna 404 para alvo banido sem consultar privacidade", async () => {
    prismaMock.user.findUnique.mockImplementation(
      async (args: { where: { id: string } }) =>
        args.where.id === viewer.id
          ? viewer
          : { ...target, isBanned: true, deletedAt: null },
    )

    const res = await callPost("usr_target")
    const body = await res.json()

    expect(res.status).toBe(404)
    expect(body.error.code).toBe("USER_NOT_FOUND")
    expect(prismaMock.userProfile.findUnique).not.toHaveBeenCalled()
    expect(prismaMock.follow.create).not.toHaveBeenCalled()
  })

  it("401 do viewer carrega os rate headers (I2)", async () => {
    prismaMock.user.findUnique.mockImplementation(
      async (args: { where: { id: string } }) =>
        args.where.id === viewer.id ? null : target,
    )

    const res = await callPost("usr_target")
    const body = await res.json()

    expect(res.status).toBe(401)
    expect(body.error.code).toBe("AUTH_TOKEN_INVALID")
    expect(res.headers.get("X-RateLimit-Remaining")).toBe("19")
  })
})

describe("POST /api/v1/social/follow/:userId — segurança (SC38/lock/TOCTOU/dedupe)", () => {
  it("SC38: follow omite contadores quando target statsVisibility=private", async () => {
    prismaMock.userProfile.findUnique.mockResolvedValue({
      userId: target.id,
      privacy: { statsVisibility: "private" },
    })
    const res = await callPost("usr_target")
    const body = await res.json()

    expect(res.status).toBe(201)
    expect(body.data).toEqual({ following: true })
  })

  it("SC38: unfollow omite contadores quando target statsVisibility=private", async () => {
    prismaMock.userProfile.findUnique.mockResolvedValue({
      userId: target.id,
      privacy: { statsVisibility: "private" },
    })
    prismaMock.follow.findUnique.mockResolvedValue({ id: "flw_1" })

    const res = await callPost("usr_target")
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data).toEqual({ following: false })
  })

  it("contagens do toggle respondem o ESTADO DO ALVO (SC39 subject change)", async () => {
    prismaMock.follow.count.mockImplementation(
      async (args: { where: { followerId?: string } }) =>
        args.where.followerId === "usr_target" ? 12 : 34,
    )

    const res = await callPost("usr_target")
    const body = await res.json()

    expect(body.data.followingCount).toBe(12)
    expect(body.data.followersCount).toBe(34)
  })

  it("unfollow não é bloqueado por whoCanFollow do alvo (I1) — privacy ainda consultada para SC38", async () => {
    prismaMock.userProfile.findUnique.mockResolvedValue({
      userId: "usr_target",
      privacy: { whoCanFollow: "nobody" },
    })
    prismaMock.follow.findUnique.mockResolvedValue({ id: "flw_1" })

    const res = await callPost("usr_target")
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data.following).toBe(false)
    expect(prismaMock.follow.delete).toHaveBeenCalled()
  })

  it("follow deduplica notificação do par antes de criar (anti-flood)", async () => {
    await callPost("usr_target")

    expect(prismaMock.notification.deleteMany).toHaveBeenCalledWith({
      where: {
        userId: "usr_target",
        type: "follow",
        data: { equals: { followerId: "usr_1" } },
      },
    })
    const delOrder =
      prismaMock.notification.deleteMany.mock.invocationCallOrder[0]!
    const createOrder =
      prismaMock.notification.create.mock.invocationCallOrder[0]!
    expect(delOrder).toBeLessThan(createOrder)
  })

  it("unfollow remove notificação do par e nao cria", async () => {
    prismaMock.follow.findUnique.mockResolvedValue({ id: "flw_1" })

    await callPost("usr_target")

    expect(prismaMock.notification.deleteMany).toHaveBeenCalledWith({
      where: {
        userId: "usr_target",
        type: "follow",
        data: { equals: { followerId: "usr_1" } },
      },
    })
    expect(prismaMock.notification.create).not.toHaveBeenCalled()
  })

  it("lock FOR UPDATE do viewer antes do count no caminho de follow", async () => {
    await callPost("usr_target")

    expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(1)
    const calls = prismaMock.$queryRaw.mock.calls
    expect(calls.length).toBeGreaterThan(0)
    const [strings, viewerId] = calls[0]!
    expect(strings.join("")).toContain("FOR UPDATE")
    expect(viewerId).toBe("usr_1")
    const lockOrder = prismaMock.$queryRaw.mock.invocationCallOrder[0]!
    const countOrder = prismaMock.follow.count.mock.invocationCallOrder[0]!
    expect(lockOrder).toBeLessThan(countOrder)
  })

  it("cap usa valor lido sob lock (nao o valor pre-tx)", async () => {
    prismaMock.$queryRaw.mockResolvedValue([{ maxFollowing: 1 }])
    prismaMock.follow.count.mockResolvedValue(1)

    const res = await callPost("usr_target")
    const body = await res.json()

    expect(res.status).toBe(409)
    expect(body.error.code).toBe("MAX_FOLLOWING_REACHED")
    expect(body.error.details).toEqual({ max: 1 })
  })

  it("TOCTOU: alvo banido dentro da tx aborta com 404 e sem create", async () => {
    let targetReads = 0
    prismaMock.user.findUnique.mockImplementation(
      async (args: { where: { id: string } }) => {
        if (args.where.id === viewer.id) return viewer
        targetReads++
        if (targetReads === 1) return target
        return { ...target, isBanned: true, deletedAt: null }
      },
    )

    const res = await callPost("usr_target")
    const body = await res.json()

    expect(res.status).toBe(404)
    expect(body.error.code).toBe("USER_NOT_FOUND")
    expect(prismaMock.follow.create).not.toHaveBeenCalled()
  })
})

async function callGetList(
  username: string,
  side: "followers" | "following",
  search = "",
) {
  const mod =
    side === "followers"
      ? await import("@/app/api/v1/users/[username]/followers/route")
      : await import("@/app/api/v1/users/[username]/following/route")
  const qs = search ? `?q=${encodeURIComponent(search)}` : ""
  return mod.GET(
    new Request(`http://localhost:3000/api/v1/users/${username}/${side}${qs}`),
    { params: Promise.resolve({ username }) },
  )
}

const followerRows = [
  {
    id: "fl_1",
    followerId: "usr_a",
    followingId: "usr_target",
    createdAt: new Date("2026-09-27T10:00:00Z"),
    follower: {
      id: "usr_a",
      name: "Alice",
      displayName: "Alice D",
      avatar: null,
      profile: { username: "alice" },
    },
  },
  {
    id: "fl_2",
    followerId: "usr_b",
    followingId: "usr_target",
    createdAt: new Date("2026-09-26T10:00:00Z"),
    follower: {
      id: "usr_b",
      name: "Bob",
      displayName: "Bob D",
      avatar: "/a.png",
      profile: { username: "bob" },
    },
  },
]

describe("GET /api/v1/users/:username/followers (T044/S2-18)", () => {
  beforeEach(() => {
    prismaMock.userProfile.findUnique.mockResolvedValue({
      userId: "usr_target",
      privacy: null,
    })
    prismaMock.follow.findMany.mockResolvedValue(followerRows)
  })

  it("retorna lista no envelope { data, pagination: { nextCursor } }", async () => {
    const res = await callGetList("target", "followers")
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data).toEqual([
      {
        userId: "usr_a",
        name: "Alice D",
        username: "alice",
        avatarUrl: null,
      },
      {
        userId: "usr_b",
        name: "Bob D",
        username: "bob",
        avatarUrl: "/a.png",
      },
    ])
    expect(body.pagination).toEqual({ nextCursor: null })

    const args = findManyArgs()
    expect(args.where.followingId).toBe("usr_target")
    expect(args.where.follower).toEqual({
      isActive: true,
      isBanned: false,
      deletedAt: null,
    })
    expect(args.orderBy).toEqual([{ createdAt: "desc" }, { id: "desc" }])
    expect(args.take).toBe(21)
  })

  it("pagina com cursor keyset (createdAt, id)", async () => {
    const { encodeFeedCursor } = await import("@/lib/social/feed-algorithm")
    const cursor = encodeFeedCursor({
      createdAt: new Date("2026-09-27T10:00:00Z").getTime(),
      id: "fl_1",
    })
    const { GET } =
      await import("@/app/api/v1/users/[username]/followers/route")
    const res = await GET(
      new Request(
        `http://localhost:3000/api/v1/users/target/followers?cursor=${cursor}`,
      ),
      { params: Promise.resolve({ username: "target" }) },
    )
    expect(res.status).toBe(200)

    const args = findManyArgs("last")
    expect(args.where.AND?.[0]?.OR?.[0]).toEqual({
      createdAt: { lt: new Date("2026-09-27T10:00:00Z") },
    })
    expect(args.where.AND?.[0]?.OR?.[1]).toEqual({
      createdAt: new Date("2026-09-27T10:00:00Z"),
      id: { lt: "fl_1" },
    })
  })

  it("combina ?q= com cursor — keyset nao sobrescreve o filtro de busca", async () => {
    const { encodeFeedCursor } = await import("@/lib/social/feed-algorithm")
    const cursor = encodeFeedCursor({
      createdAt: new Date("2026-09-27T10:00:00Z").getTime(),
      id: "fl_1",
    })
    const { GET } =
      await import("@/app/api/v1/users/[username]/followers/route")
    await GET(
      new Request(
        `http://localhost:3000/api/v1/users/target/followers?q=ali&cursor=${cursor}`,
      ),
      { params: Promise.resolve({ username: "target" }) },
    )
    const args = findManyArgs()
    expect(args.where.AND).toHaveLength(2)
    expect(args.where.AND?.[0]?.OR).toEqual([
      { follower: { name: { contains: "ali", mode: "insensitive" } } },
      {
        follower: {
          profile: { username: { contains: "ali", mode: "insensitive" } },
        },
      },
    ])
    expect(args.where.AND?.[1]?.OR?.[0]).toEqual({
      createdAt: { lt: new Date("2026-09-27T10:00:00Z") },
    })
  })

  it("cursor invalido devolve pagina vazia sem consultar o banco", async () => {
    const { GET } =
      await import("@/app/api/v1/users/[username]/followers/route")
    const res = await GET(
      new Request(
        "http://localhost:3000/api/v1/users/target/followers?cursor=%21%21%21",
      ),
      { params: Promise.resolve({ username: "target" }) },
    )
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.data).toEqual([])
    expect(body.pagination).toEqual({ nextCursor: null })
    expect(prismaMock.follow.findMany).not.toHaveBeenCalled()
  })

  it("filtra por ?q= em nome ou username (case-insensitive)", async () => {
    prismaMock.follow.findMany.mockResolvedValue([followerRows[0]])
    await callGetList("target", "followers", "ali")
    const args = findManyArgs()
    expect(args.where.AND?.[0]?.OR).toEqual([
      { follower: { name: { contains: "ali", mode: "insensitive" } } },
      {
        follower: {
          profile: { username: { contains: "ali", mode: "insensitive" } },
        },
      },
    ])
  })

  it("retorna 404 USER_NOT_FOUND para username inexistente", async () => {
    prismaMock.userProfile.findUnique.mockResolvedValue(null)
    const res = await callGetList("ghost", "followers")
    const body = await res.json()
    expect(res.status).toBe(404)
    expect(body.error.code).toBe("USER_NOT_FOUND")
  })

  it("retorna 404 para perfil privado", async () => {
    const res = await callGetList("target_private", "followers")
    expect(res.status).toBe(404)
  })

  it("retorna 422 para username invalido", async () => {
    const res = await callGetList("a%20b", "followers")
    expect(res.status).toBe(422)
  })

  it("retorna 500 com envelope JSON quando findVisibleProfile falha", async () => {
    helpersMock.findVisibleProfile.mockRejectedValue(new Error("db down"))

    const res = await callGetList("target", "followers")
    const body = await res.json()

    expect(res.status).toBe(500)
    expect(body.error.code).toBe("INTERNAL_ERROR")
    expect(body.meta.requestId).toBe("req_test")
  })

  it("valida query params ANTES de consultar o banco", async () => {
    const { GET } =
      await import("@/app/api/v1/users/[username]/followers/route")
    const res = await GET(
      new Request(
        "http://localhost:3000/api/v1/users/target/followers?limit=999",
      ),
      { params: Promise.resolve({ username: "target" }) },
    )

    expect(res.status).toBe(422)
    expect(helpersMock.findVisibleProfile).not.toHaveBeenCalled()
  })

  it("username inexistente + query invalida tambem devolve 422 (sem oraculo 404/422)", async () => {
    const { GET } =
      await import("@/app/api/v1/users/[username]/followers/route")
    const res = await GET(
      new Request(
        "http://localhost:3000/api/v1/users/ghost/followers?limit=999",
      ),
      { params: Promise.resolve({ username: "ghost" }) },
    )

    expect(res.status).toBe(422)
  })

  it("inclui isFollowing por item quando autenticado — direção viewer→item", async () => {
    helpersMock.optionalAuth.mockResolvedValue("usr_me")
    prismaMock.follow.findMany.mockImplementation(
      (args: {
        where: {
          followerId?: string | { in: string[] }
          followingId?: string | { in: string[] }
        }
      }) => {
        if (
          args.where.followerId === "usr_me" &&
          typeof args.where.followingId === "object" &&
          args.where.followingId?.in
        ) {
          return [{ followerId: "usr_me", followingId: "usr_a" }]
        }
        return followerRows
      },
    )
    const res = await callGetList("target", "followers")
    const body = await res.json()
    expect(body.data[0].isFollowing).toBe(true)
    expect(body.data[1].isFollowing).toBe(false)
    const isFollowingArgs = findManyArgs("last")
    expect(isFollowingArgs.where).toEqual({
      followerId: "usr_me",
      followingId: { in: ["usr_a", "usr_b"] },
    })
  })
})

describe("GET /api/v1/users/:username/following (T045/S2-18)", () => {
  beforeEach(() => {
    prismaMock.userProfile.findUnique.mockResolvedValue({
      userId: "usr_target",
      privacy: null,
    })
    prismaMock.follow.findMany.mockResolvedValue([
      {
        id: "fl_9",
        followerId: "usr_target",
        followingId: "usr_c",
        createdAt: new Date("2026-09-27T10:00:00Z"),
        following: {
          id: "usr_c",
          name: "Carol",
          displayName: "Carol D",
          avatar: null,
          profile: { username: "carol" },
        },
      },
    ])
  })

  it("retorna lista de seguindo no envelope S2-18", async () => {
    const res = await callGetList("target", "following")
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data).toEqual([
      {
        userId: "usr_c",
        name: "Carol D",
        username: "carol",
        avatarUrl: null,
      },
    ])
    expect(body.pagination).toEqual({ nextCursor: null })

    const args = findManyArgs()
    expect(args.where.followerId).toBe("usr_target")
    expect(args.where.following).toBeTruthy()
  })

  it("retorna 404 para username inexistente", async () => {
    prismaMock.userProfile.findUnique.mockResolvedValue(null)
    const res = await callGetList("ghost", "following")
    expect(res.status).toBe(404)
  })
})

describe("GET listas sociais — SC38 statsVisibility (revisão)", () => {
  const hiddenStatsVisible = {
    profile: {
      userId: "usr_target",
      privacy: { statsVisibility: "private" },
      user: { id: "usr_target", isBanned: false, deletedAt: null },
    },
    username: "target",
    showStats: false,
  }

  it("404 para anônimo quando statsVisibility é private", async () => {
    helpersMock.findVisibleProfile.mockResolvedValue(hiddenStatsVisible)
    const res = await callGetList("target", "followers")
    const body = await res.json()

    expect(res.status).toBe(404)
    expect(body.error.code).toBe("USER_NOT_FOUND")
    expect(prismaMock.follow.findMany).not.toHaveBeenCalled()
  })

  it("dono autenticado vê a própria lista mesmo com statsVisibility private", async () => {
    helpersMock.findVisibleProfile.mockResolvedValue(hiddenStatsVisible)
    helpersMock.optionalAuth.mockResolvedValue("usr_target")

    const res = await callGetList("target", "followers")

    expect(res.status).toBe(200)
    expect(prismaMock.follow.findMany).toHaveBeenCalled()
  })
})
