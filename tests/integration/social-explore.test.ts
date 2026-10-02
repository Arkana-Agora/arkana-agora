// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const prismaMock = vi.hoisted(() => ({
  post: { findMany: vi.fn() },
  postHashtag: { findMany: vi.fn() },
  user: { findMany: vi.fn() },
  follow: { findMany: vi.fn() },
}))

const helpersMock = vi.hoisted(() => ({
  requireAuth: vi.fn(),
}))

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }))
vi.mock("@/app/api/v1/users/_helpers", () => helpersMock)
vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  newReqId: () => "req_test",
}))

function callTrending() {
  return import("@/app/api/v1/social/explore/trending/route").then(({ GET }) =>
    GET(new Request("http://localhost:3000/api/v1/social/explore/trending")),
  )
}

function callHashtags() {
  return import("@/app/api/v1/social/explore/hashtags/route").then(({ GET }) =>
    GET(new Request("http://localhost:3000/api/v1/social/explore/hashtags")),
  )
}

function callSuggestions() {
  return import("@/app/api/v1/social/explore/suggestions/route").then(
    ({ GET }) =>
      GET(
        new Request("http://localhost:3000/api/v1/social/explore/suggestions"),
      ),
  )
}

function callSearch(query: string) {
  return import("@/app/api/v1/social/search/route").then(({ GET }) =>
    GET(new Request(`http://localhost:3000/api/v1/social/search${query}`)),
  )
}

function trendingPost(
  id: string,
  opts: {
    likeCount?: number
    commentCount?: number
    createdAt?: Date
    privateProfile?: boolean
    authorId?: string
    audience?: string
  } = {},
) {
  const createdAt = opts.createdAt ?? new Date("2026-09-25T10:00:00Z")
  return {
    id,
    authorId: opts.authorId ?? "u1",
    type: "text",
    content: "conteudo",
    imageUrls: [],
    readingId: null,
    audience: opts.audience ?? "public",
    isPinned: false,
    likeCount: opts.likeCount ?? 0,
    commentCount: opts.commentCount ?? 0,
    commentsDisabled: false,
    isHidden: false,
    createdAt,
    updatedAt: createdAt,
    author: {
      id: opts.authorId ?? "u1",
      name: "Autor",
      displayName: "Autor",
      avatar: null,
      profile: {
        privacy: {
          profileVisibility: opts.privateProfile ? "private" : "public",
        },
      },
    },
  }
}

function hashtagRow(tag: string, privateProfile = false) {
  return {
    tag,
    post: {
      author: {
        profile: {
          privacy: {
            profileVisibility: privateProfile ? "private" : "public",
          },
        },
      },
    },
  }
}

function suggestionUser(
  id: string,
  opts: {
    role?: "USER" | "PROFESSIONAL" | "ADMIN"
    followers?: number
    privateProfile?: boolean
    createdAt?: Date
  } = {},
) {
  return {
    id,
    name: `User ${id}`,
    avatar: null,
    role: opts.role ?? "USER",
    createdAt: opts.createdAt ?? new Date("2026-09-01T10:00:00Z"),
    profile: {
      username: id,
      privacy: {
        profileVisibility: opts.privateProfile ? "private" : "public",
      },
    },
    _count: { followers: opts.followers ?? 0 },
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.resetModules()
  helpersMock.requireAuth.mockResolvedValue({ userId: "usr_1" })
  prismaMock.post.findMany.mockResolvedValue([])
  prismaMock.postHashtag.findMany.mockResolvedValue([])
  prismaMock.user.findMany.mockResolvedValue([])
  prismaMock.follow.findMany.mockResolvedValue([])
})

afterEach(() => {
  vi.resetModules()
})

describe("GET /api/v1/social/explore/trending (T053)", () => {
  it("exige autenticação (401) — não consulta posts", async () => {
    helpersMock.requireAuth.mockResolvedValue(
      Response.json(
        { error: { code: "UNAUTHENTICATED", message: "Token ausente" } },
        { status: 401 },
      ),
    )

    const res = await callTrending()

    expect(res.status).toBe(401)
    expect(prismaMock.post.findMany).not.toHaveBeenCalled()
  })

  it("janela de 7 dias, público, não-oculto e autor ativo; cap 100 por likeCount", async () => {
    const res = await callTrending()

    expect(res.status).toBe(200)
    const args = prismaMock.post.findMany.mock.calls[0]![0]!
    expect(args.where).toMatchObject({
      audience: "public",
      isHidden: false,
      author: { isBanned: false, deletedAt: null },
    })
    const gte = args.where.createdAt.gte as Date
    expect(
      Math.abs(gte.getTime() - (Date.now() - 7 * 24 * 60 * 60 * 1000)),
    ).toBeLessThan(10_000)
    expect(args.orderBy).toEqual([
      { likeCount: "desc" },
      { commentCount: "desc" },
      { createdAt: "desc" },
    ])
    expect(args.take).toBe(100)
  })

  it("ordena por engagementScore (likes + comments×2) desc", async () => {
    prismaMock.post.findMany.mockResolvedValue([
      trendingPost("p_likes", { likeCount: 5 }),
      trendingPost("p_comments", { commentCount: 3 }),
      trendingPost("p_top", { likeCount: 5, commentCount: 1 }),
    ])

    const res = await callTrending()

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.posts.map((p: { id: string }) => p.id)).toEqual([
      "p_top",
      "p_comments",
      "p_likes",
    ])
  })

  it("exclui autores com perfil private (decisão do dono 2026-09-30)", async () => {
    prismaMock.post.findMany.mockResolvedValue([
      trendingPost("p_priv", { privateProfile: true, likeCount: 99 }),
      trendingPost("p_pub", { likeCount: 1 }),
    ])

    const res = await callTrending()

    const body = await res.json()
    expect(body.data.posts.map((p: { id: string }) => p.id)).toEqual(["p_pub"])
  })

  it("corta em 20 e responde envelope { data: { posts } } sem pagination", async () => {
    prismaMock.post.findMany.mockResolvedValue(
      Array.from({ length: 25 }, (_, i) =>
        trendingPost(`p${i}`, { likeCount: 25 - i }),
      ),
    )

    const res = await callTrending()

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(Object.keys(body)).toEqual(["data"])
    expect(Object.keys(body.data)).toEqual(["posts"])
    expect(body.data.posts).toHaveLength(20)
    expect(body.data.posts[0].id).toBe("p0")
    expect(res.headers.get("Cache-Control")).toBe("private, no-store")
    expect(res.headers.get("Vary")).toBe("Authorization")
  })

  it("erro de DB vira 500 INTERNAL_ERROR JSON", async () => {
    prismaMock.post.findMany.mockRejectedValue(new Error("db down"))

    const res = await callTrending()

    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error.code).toBe("INTERNAL_ERROR")
    expect(body.meta.requestId).toBe("req_test")
    expect(res.headers.get("Cache-Control")).toBe("private, no-store")
    expect(res.headers.get("Vary")).toBe("Authorization")
  })
})

describe("GET /api/v1/social/explore/hashtags (T054)", () => {
  it("erro de DB vira 500 INTERNAL_ERROR JSON com headers privados", async () => {
    prismaMock.postHashtag.findMany.mockRejectedValue(new Error("db down"))

    const res = await callHashtags()

    expect(res.status).toBe(500)
    expect((await res.json()).error.code).toBe("INTERNAL_ERROR")
    expect(res.headers.get("Cache-Control")).toBe("private, no-store")
    expect(res.headers.get("Vary")).toBe("Authorization")
  })

  it("query de hashtags limita take com headroom pós-filtro (não varre a semana)", async () => {
    const res = await callHashtags()

    expect(res.status).toBe(200)
    const args = prismaMock.postHashtag.findMany.mock.calls[0]![0]!
    expect(args.take).toBe(100)
  })
  it("exige autenticação (401) — não consulta hashtags", async () => {
    helpersMock.requireAuth.mockResolvedValue(
      Response.json(
        { error: { code: "UNAUTHENTICATED", message: "Token ausente" } },
        { status: 401 },
      ),
    )

    const res = await callHashtags()

    expect(res.status).toBe(401)
    expect(prismaMock.postHashtag.findMany).not.toHaveBeenCalled()
  })

  it("filtra posts públicos da semana com autor ativo e lê privacy do autor", async () => {
    const res = await callHashtags()

    expect(res.status).toBe(200)
    const args = prismaMock.postHashtag.findMany.mock.calls[0]![0]!
    expect(args.where.post).toMatchObject({
      audience: "public",
      isHidden: false,
      author: { isBanned: false, deletedAt: null },
    })
    const gte = args.where.post.createdAt.gte as Date
    expect(
      Math.abs(gte.getTime() - (Date.now() - 7 * 24 * 60 * 60 * 1000)),
    ).toBeLessThan(10_000)
    expect(args.select).toEqual({
      tag: true,
      post: {
        select: {
          author: { select: { profile: { select: { privacy: true } } } },
        },
      },
    })
  })

  it("agrupa por tag (sem contagem de autores private), ordena count desc com desempate por tag e corta em 10", async () => {
    const singles = [
      "luz",
      "lua",
      "carta",
      "signo",
      "mes",
      "ano",
      "vida",
      "alma",
      "chakra",
      "energia",
      "espirito",
    ]
    prismaMock.postHashtag.findMany.mockResolvedValue([
      hashtagRow("tarot", true),
      hashtagRow("tarot"),
      hashtagRow("tarot"),
      hashtagRow("amor"),
      hashtagRow("amor"),
      hashtagRow("amor"),
      ...singles.map((tag) => hashtagRow(tag)),
    ])

    const res = await callHashtags()

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(Object.keys(body)).toEqual(["data"])
    expect(body.data.hashtags).toHaveLength(10)
    expect(body.data.hashtags[0]).toEqual({ tag: "amor", count: 3 })
    expect(body.data.hashtags[1]).toEqual({ tag: "tarot", count: 2 })
    const rest = body.data.hashtags
      .slice(2)
      .map((h: { tag: string; count: number }) => h.tag)
    expect(rest).toEqual([
      "alma",
      "ano",
      "carta",
      "chakra",
      "energia",
      "espirito",
      "lua",
      "luz",
    ])
  })
})

describe("GET /api/v1/social/explore/suggestions (T055)", () => {
  it("erro de DB vira 500 INTERNAL_ERROR JSON com headers privados", async () => {
    prismaMock.follow.findMany.mockRejectedValue(new Error("db down"))
    prismaMock.user.findMany.mockRejectedValue(new Error("db down"))

    const res = await callSuggestions()

    expect(res.status).toBe(500)
    expect((await res.json()).error.code).toBe("INTERNAL_ERROR")
    expect(res.headers.get("Cache-Control")).toBe("private, no-store")
    expect(res.headers.get("Vary")).toBe("Authorization")
  })
  it("exige autenticação (401) — não consulta follows nem usuários", async () => {
    helpersMock.requireAuth.mockResolvedValue(
      Response.json(
        { error: { code: "UNAUTHENTICATED", message: "Token ausente" } },
        { status: 401 },
      ),
    )

    const res = await callSuggestions()

    expect(res.status).toBe(401)
    expect(prismaMock.follow.findMany).not.toHaveBeenCalled()
    expect(prismaMock.user.findMany).not.toHaveBeenCalled()
  })

  it("exclui self, já-seguidos, banidos, inativos e soft-deleted no where", async () => {
    prismaMock.follow.findMany.mockResolvedValue([
      { followingId: "u2" },
      { followingId: "u3" },
    ])

    const res = await callSuggestions()

    expect(res.status).toBe(200)
    expect(prismaMock.follow.findMany).toHaveBeenCalledWith({
      where: { followerId: "usr_1" },
      select: { followingId: true },
    })
    const args = prismaMock.user.findMany.mock.calls[0]![0]!
    expect(args.where).toEqual({
      id: { not: "usr_1", notIn: ["u2", "u3"] },
      isBanned: false,
      deletedAt: null,
      isActive: true,
    })
    expect(args.orderBy).toEqual([
      { followers: { _count: "desc" } },
      { createdAt: "desc" },
    ])
    expect(args.take).toBe(200)
  })

  it("profissionais primeiro, depois followersCount desc, e corta em 10", async () => {
    prismaMock.user.findMany.mockResolvedValue([
      suggestionUser("free_top", { followers: 900 }),
      suggestionUser("pro_low", { role: "PROFESSIONAL", followers: 1 }),
      suggestionUser("plus_mid", { followers: 500 }),
      suggestionUser("pro_top", { role: "PROFESSIONAL", followers: 50 }),
      suggestionUser("admin", { role: "ADMIN", followers: 999 }),
      suggestionUser("free_low", { followers: 10 }),
    ])

    const res = await callSuggestions()

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.users.map((u: { id: string }) => u.id)).toEqual([
      "pro_top",
      "pro_low",
      "admin",
      "free_top",
      "plus_mid",
      "free_low",
    ])
  })

  it("exclui perfil private, limita a 10 e mapeia followersCount (sem vazar privacy)", async () => {
    prismaMock.user.findMany.mockResolvedValue([
      suggestionUser("priv", { followers: 999, privateProfile: true }),
      ...Array.from({ length: 12 }, (_, i) =>
        suggestionUser(`u${String(i).padStart(2, "0")}`, {
          followers: 100 - i,
        }),
      ),
    ])

    const res = await callSuggestions()

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(Object.keys(body)).toEqual(["data"])
    expect(Object.keys(body.data)).toEqual(["users"])
    expect(body.data.users).toHaveLength(10)
    const ids = body.data.users.map((u: { id: string }) => u.id)
    expect(ids).not.toContain("priv")
    expect(ids[0]).toBe("u00")
    expect(body.data.users[0]).toEqual({
      id: "u00",
      name: "User u00",
      username: "u00",
      avatar: null,
      role: "USER",
      followersCount: 100,
    })
  })
})

describe("GET /api/v1/social/search (T056)", () => {
  it("exige autenticação (401) — não roda nenhuma query", async () => {
    helpersMock.requireAuth.mockResolvedValue(
      Response.json(
        { error: { code: "UNAUTHENTICATED", message: "Token ausente" } },
        { status: 401 },
      ),
    )

    const res = await callSearch("?q=maria")

    expect(res.status).toBe(401)
    expect(prismaMock.follow.findMany).not.toHaveBeenCalled()
    expect(prismaMock.post.findMany).not.toHaveBeenCalled()
    expect(prismaMock.user.findMany).not.toHaveBeenCalled()
    expect(prismaMock.postHashtag.findMany).not.toHaveBeenCalled()
  })

  it("q ausente ou com menos de 2 caracteres → 422 VALIDATION_ERROR", async () => {
    for (const query of ["", "?q=", "?q=a"]) {
      const res = await callSearch(query)

      expect(res.status).toBe(422)
      const body = await res.json()
      expect(body.error.code).toBe("VALIDATION_ERROR")
      expect(res.headers.get("Cache-Control")).toBe("private, no-store")
      expect(res.headers.get("Vary")).toBe("Authorization")
    }
    expect(prismaMock.post.findMany).not.toHaveBeenCalled()
    expect(prismaMock.user.findMany).not.toHaveBeenCalled()
  })

  it("q acima de 50 caracteres → 422 VALIDATION_ERROR (limite do contrato)", async () => {
    const res = await callSearch(`?q=${"a".repeat(51)}`)

    expect(res.status).toBe(422)
    const body = await res.json()
    expect(body.error.code).toBe("VALIDATION_ERROR")
    expect(res.headers.get("Cache-Control")).toBe("private, no-store")
    expect(res.headers.get("Vary")).toBe("Authorization")
    expect(prismaMock.post.findMany).not.toHaveBeenCalled()
    expect(prismaMock.user.findMany).not.toHaveBeenCalled()
  })

  it("posts: conteúdo case-insensitive com predicado S2-15 (público OU followers de quem sigo), autor ativo, ordenação por recência", async () => {
    prismaMock.follow.findMany.mockResolvedValue([{ followingId: "u_f" }])

    const res = await callSearch("?q=maria")

    expect(res.status).toBe(200)
    const args = prismaMock.post.findMany.mock.calls[0]![0]!
    expect(args.where).toMatchObject({
      content: { contains: "maria", mode: "insensitive" },
      isHidden: false,
      author: { isBanned: false, deletedAt: null },
      OR: [
        { audience: "public" },
        { audience: "followers", authorId: { in: ["u_f"] } },
      ],
    })
    expect(args.orderBy).toEqual([{ createdAt: "desc" }, { id: "desc" }])
    expect(args.take).toBe(20)
  })

  it("perfis privados filtrados não encurtam a página: busca em lotes até completar 20", async () => {
    prismaMock.follow.findMany.mockResolvedValue([])
    const privados = Array.from({ length: 20 }, (_, i) =>
      trendingPost(`pv${i}`, { privateProfile: true }),
    )
    const publicos = Array.from({ length: 20 }, (_, i) =>
      trendingPost(`pp${i}`),
    )
    prismaMock.post.findMany
      .mockResolvedValueOnce(privados)
      .mockResolvedValueOnce(publicos)

    const res = await callSearch("?q=maria")

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.posts).toHaveLength(20)
    expect(prismaMock.post.findMany).toHaveBeenCalledTimes(2)
  })

  it("usuários: nome OU username case-insensitive, ativos, ordena por followers, limit 20", async () => {
    const res = await callSearch("?q=MARIA")

    expect(res.status).toBe(200)
    const args = prismaMock.user.findMany.mock.calls[0]![0]!
    expect(args.where).toEqual({
      isActive: true,
      isBanned: false,
      deletedAt: null,
      OR: [
        { name: { contains: "MARIA", mode: "insensitive" } },
        { profile: { username: { contains: "MARIA", mode: "insensitive" } } },
      ],
    })
    expect(args.orderBy).toEqual([
      { followers: { _count: "desc" } },
      { createdAt: "desc" },
    ])
    expect(args.take).toBe(20)
  })

  it("hashtags: tag lowercase em posts públicos com autor ativo (sem janela de tempo)", async () => {
    const res = await callSearch("?q=TaRoT")

    expect(res.status).toBe(200)
    const args = prismaMock.postHashtag.findMany.mock.calls[0]![0]!
    expect(args.where).toEqual({
      tag: { contains: "tarot" },
      post: {
        audience: "public",
        isHidden: false,
        author: { isBanned: false, deletedAt: null, isActive: true },
      },
    })
    expect(args.where.post.createdAt).toBeUndefined()
  })

  it("hashtags da busca limitam take com headroom pós-filtro (não varre o histórico)", async () => {
    const res = await callSearch("?q=TaRoT")

    expect(res.status).toBe(200)
    const args = prismaMock.postHashtag.findMany.mock.calls[0]![0]!
    expect(args.take).toBe(200)
  })

  it("filtra perfis/private por S2-15, agrupa hashtags e envolve em { data: { posts, users, hashtags } }", async () => {
    prismaMock.follow.findMany.mockResolvedValue([{ followingId: "u_f" }])
    prismaMock.post.findMany.mockResolvedValue([
      trendingPost("p_pub"),
      trendingPost("p_priv", { privateProfile: true, likeCount: 99 }),
      trendingPost("p_fol", {
        audience: "followers",
        authorId: "u_f",
        privateProfile: true,
      }),
    ])
    prismaMock.user.findMany.mockResolvedValue([
      {
        id: "u_maria",
        name: "Maria Silva",
        displayName: "Maria",
        avatar: "/a.png",
        role: "USER",
        createdAt: new Date("2026-09-01T10:00:00Z"),
        profile: {
          username: "mariatarot",
          privacy: { profileVisibility: "public" },
        },
        _count: { followers: 5 },
      },
      suggestionUser("u_priv", { privateProfile: true, followers: 50 }),
    ])
    prismaMock.postHashtag.findMany.mockResolvedValue([
      hashtagRow("tarot"),
      hashtagRow("tarot"),
      hashtagRow("amor"),
      hashtagRow("amor", true),
    ])

    const res = await callSearch("?q=maria")

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(Object.keys(body)).toEqual(["data"])
    expect(Object.keys(body.data)).toEqual(["posts", "users", "hashtags"])
    expect(body.data.posts.map((p: { id: string }) => p.id)).toEqual([
      "p_pub",
      "p_fol",
    ])
    expect(body.data.users).toEqual([
      {
        id: "u_maria",
        name: "Maria",
        username: "mariatarot",
        avatar: "/a.png",
        role: "USER",
        followersCount: 5,
      },
    ])
    expect(body.data.hashtags).toEqual([
      { tag: "tarot", count: 2 },
      { tag: "amor", count: 1 },
    ])
    expect(res.headers.get("Cache-Control")).toBe("private, no-store")
  })
})
