// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const prismaMock = vi.hoisted(() => ({
  user: { findUnique: vi.fn() },
  reading: { findUnique: vi.fn() },
  follow: { findUnique: vi.fn() },
  post: { create: vi.fn(), findUnique: vi.fn(), findMany: vi.fn() },
  postHashtag: { createMany: vi.fn(), findMany: vi.fn() },
  comment: { findMany: vi.fn() },
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
}))

const feedMock = vi.hoisted(() => ({
  getFeed: vi.fn(),
}))

const feedCacheMock = vi.hoisted(() => ({
  getCachedFeed: vi.fn(),
  refreshFeedCache: vi.fn(),
}))

const ogMock = vi.hoisted(() => ({
  generatePostOgImage: vi.fn(),
}))

const r2Mock = vi.hoisted(() => ({
  generatePresignedUrl: vi.fn(),
}))

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }))
vi.mock("@/app/api/v1/users/_helpers", () => helpersMock)
vi.mock("@/lib/middleware/rate-limit", () => rateMock)
vi.mock("@/lib/middleware/csrf", () => csrfMock)
vi.mock("@/lib/social/versos", () => versosMock)
vi.mock("@/lib/moderation", () => moderationMock)
vi.mock("@/lib/analytics", () => analyticsMock)
vi.mock("@/lib/feed-cache", () => feedCacheMock)
vi.mock("@/lib/og-image", () => ogMock)
vi.mock("@/lib/r2", () => r2Mock)
vi.mock("@/lib/social/feed-algorithm", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/social/feed-algorithm")>()
  return { ...actual, getFeed: feedMock.getFeed }
})
vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  newReqId: () => "req_test",
}))

function callPost(
  body: unknown,
  url = "http://localhost:3000/api/v1/social/posts",
) {
  return import("@/app/api/v1/social/posts/route").then(({ POST }) =>
    POST(
      new Request(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: typeof body === "string" ? body : JSON.stringify(body),
      }),
    ),
  )
}

function callGetFeed(query = "") {
  return import("@/app/api/v1/social/feed/route").then(({ GET }) =>
    GET(new Request(`http://localhost:3000/api/v1/social/feed${query}`)),
  )
}

function callDetail(id: string) {
  return import("@/app/api/v1/social/posts/[id]/route").then(({ GET }) =>
    GET(new Request(`http://localhost:3000/api/v1/social/posts/${id}`), {
      params: Promise.resolve({ id }),
    }),
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
  readingId: null,
  audience: "public",
  isPinned: false,
  likeCount: 0,
  commentCount: 0,
  commentsDisabled: false,
  isHidden: false,
  createdAt: new Date("2026-09-30T10:00:00Z"),
  updatedAt: new Date("2026-09-30T10:00:00Z"),
  author: { id: "usr_1", name: "Viewer", displayName: null, avatar: null },
}

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
  prismaMock.user.findUnique.mockResolvedValue({ subscriptionTier: "FREE" })
  prismaMock.reading.findUnique.mockResolvedValue({
    id: "rdg_1",
    userId: "usr_1",
  })
  prismaMock.post.create.mockResolvedValue(createdPost)
  prismaMock.postHashtag.createMany.mockResolvedValue({ count: 0 })
  versosMock.earnVersos.mockResolvedValue(10)
  feedMock.getFeed.mockResolvedValue({ posts: [], nextCursor: null })
  feedCacheMock.getCachedFeed.mockResolvedValue(null)
  prismaMock.post.findUnique.mockResolvedValue(null)
  prismaMock.follow.findUnique.mockResolvedValue(null)
})

afterEach(() => {
  vi.resetModules()
})

describe("POST /api/v1/social/posts — criar post (T051/AC-5)", () => {
  it("CSRF invalido bloqueia antes de auth, rate limit e DB", async () => {
    csrfMock.enforceCsrf.mockReturnValue(
      Response.json(
        { error: { code: "CSRF_TOKEN_INVALID", message: "CSRF invalido" } },
        { status: 403 },
      ),
    )

    const res = await callPost({ type: "text", content: "ola" })

    expect(res.status).toBe(403)
    expect(helpersMock.requireAuth).not.toHaveBeenCalled()
    expect(rateMock.enforceSocialLimit).not.toHaveBeenCalled()
    expect(prismaMock.post.create).not.toHaveBeenCalled()
  })

  it("exige autenticação (401 sem Bearer)", async () => {
    helpersMock.requireAuth.mockResolvedValue(
      Response.json(
        { error: { code: "AUTH_TOKEN_INVALID", message: "Token ausente" } },
        { status: 401 },
      ),
    )

    const res = await callPost({ type: "text", content: "ola" })

    expect(res.status).toBe(401)
    expect(rateMock.enforceSocialLimit).not.toHaveBeenCalled()
    expect(prismaMock.post.create).not.toHaveBeenCalled()
  })

  it("valida o corpo ANTES do rate limit — texto acima de 500 chars → 422", async () => {
    const res = await callPost({ type: "text", content: "x".repeat(501) })

    expect(res.status).toBe(422)
    const body = await res.json()
    expect(body.error.code).toBe("VALIDATION_ERROR")
    expect(rateMock.enforceSocialLimit).not.toHaveBeenCalled()
    expect(prismaMock.post.create).not.toHaveBeenCalled()
  })

  it("type=reading exige readingId → 422", async () => {
    const res = await callPost({ type: "reading", content: "minha leitura" })

    expect(res.status).toBe(422)
    const body = await res.json()
    expect(body.error.code).toBe("VALIDATION_ERROR")
    expect(prismaMock.post.create).not.toHaveBeenCalled()
  })

  it("type=image exige de 1 a 4 imageUrls → 422 sem imagens", async () => {
    const res = await callPost({ type: "image", content: "vejam" })

    expect(res.status).toBe(422)
    expect(prismaMock.post.create).not.toHaveBeenCalled()
  })

  it("aplica rate limit de post (T027/S2-10) com o tier do usuário", async () => {
    prismaMock.user.findUnique.mockResolvedValue({ subscriptionTier: "PLUS" })

    await callPost({ type: "text", content: "ola" })

    expect(rateMock.enforceSocialLimit).toHaveBeenCalledWith({
      limit: "post",
      userId: "usr_1",
      tier: "PLUS",
      reqId: "req_test",
    })
  })

  it("propaga o 429 do rate limit com headers e registra post_limit_hit", async () => {
    rateMock.enforceSocialLimit.mockResolvedValue({
      allowed: false,
      headers: { "Retry-After": "3600" },
      response: Response.json(
        { error: { code: "RATE_LIMITED", message: "Limite excedido" } },
        { status: 429, headers: { "Retry-After": "3600" } },
      ),
      check: { allowed: false, remaining: 0 },
    })

    const res = await callPost({ type: "text", content: "ola" })

    expect(res.status).toBe(429)
    expect(res.headers.get("Retry-After")).toBe("3600")
    expect(analyticsMock.trackPostLimitHit).toHaveBeenCalledWith("FREE", 10)
    expect(prismaMock.post.create).not.toHaveBeenCalled()
  })

  it("moderação bloqueia o post — 403 CONTENT_BLOCKED com flaggedWords (CHK011)", async () => {
    moderationMock.checkContent.mockReturnValue({
      allowed: false,
      flaggedWords: ["golpe"],
    })

    const res = await callPost({ type: "text", content: "meu golpe" })

    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error.code).toBe("CONTENT_BLOCKED")
    expect(body.error.details).toEqual({ flaggedWords: ["golpe"] })
    expect(prismaMock.post.create).not.toHaveBeenCalled()
  })

  it("imageUrls com prefixo de outro usuário → 422", async () => {
    const res = await callPost({
      type: "image",
      content: "vejam",
      imageUrls: ["posts/usr_outro/1-0.webp"],
    })

    expect(res.status).toBe(422)
    const body = await res.json()
    expect(body.error.code).toBe("VALIDATION_ERROR")
    expect(prismaMock.post.create).not.toHaveBeenCalled()
  })

  it("conteudo só com espaços em branco → 422", async () => {
    const res = await callPost({ type: "text", content: "   " })

    expect(res.status).toBe(422)
    const body = await res.json()
    expect(body.error.code).toBe("VALIDATION_ERROR")
    expect(prismaMock.post.create).not.toHaveBeenCalled()
  })

  // A chave tem que ser exatamente o formato do presign T064
  // (`posts/{userId}/{ts}-{i}.{ext}`): prefixo alone não basta — traversal
  // (`..`) passava no startsWith e ia direto pro banco.
  it("imageUrls com traversal (fora do formato do presign) → 422", async () => {
    const res = await callPost({
      type: "image",
      content: "vejam",
      imageUrls: ["posts/usr_1/../usr_outro/1-0.webp"],
    })

    expect(res.status).toBe(422)
    const body = await res.json()
    expect(body.error.code).toBe("VALIDATION_ERROR")
    expect(prismaMock.post.create).not.toHaveBeenCalled()
  })

  it("reading de outro usuário → 403 READING_ACCESS_DENIED sem tocar no DB de posts", async () => {
    prismaMock.reading.findUnique.mockResolvedValue({
      id: "rdg_1",
      userId: "usr_outro",
    })

    const res = await callPost({ type: "reading", readingId: "rdg_1" })

    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error.code).toBe("READING_ACCESS_DENIED")
    expect(prismaMock.$transaction).not.toHaveBeenCalled()
    expect(prismaMock.post.create).not.toHaveBeenCalled()
  })

  it("cria post + hashtags na MESMA transação e responde 201 com contadores em 0", async () => {
    const res = await callPost({
      type: "text",
      content: "tarot #Sigils e #sigils hoje",
      audience: "followers",
      commentsDisabled: true,
    })

    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.data.post.id).toBe("post_new")
    expect(body.data.post.author).toEqual({
      id: "usr_1",
      name: "Viewer",
      displayName: null,
      avatar: null,
    })
    expect(res.headers.get("X-RateLimit-Remaining")).toBe("9")

    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1)
    const createArgs = prismaMock.post.create.mock.calls[0]![0]
    expect(createArgs.data).toMatchObject({
      authorId: "usr_1",
      type: "text",
      content: "tarot #Sigils e #sigils hoje",
      audience: "followers",
      commentsDisabled: true,
    })
    // S2-19: criação NÃO escreve contadores (defaults 0 do schema)
    expect(createArgs.data).not.toHaveProperty("likeCount")
    expect(createArgs.data).not.toHaveProperty("commentCount")
    // Hashtags deduplicadas (case-insensitive) e lowercasadas
    expect(prismaMock.postHashtag.createMany).toHaveBeenCalledWith({
      data: [{ postId: "post_new", tag: "sigils" }],
    })
  })

  it("criação reconstrói o cache de feed do autor (refreshFeedCache)", async () => {
    const res = await callPost({ type: "text", content: "novo post" })

    expect(res.status).toBe(201)
    expect(feedCacheMock.refreshFeedCache).toHaveBeenCalledWith("usr_1")
  })

  it("type=reading paga Versos (T037) dentro da transação", async () => {
    prismaMock.post.create.mockResolvedValue({
      ...createdPost,
      id: "post_rdg",
      type: "reading",
      readingId: "rdg_1",
    })

    const res = await callPost({ type: "reading", readingId: "rdg_1" })

    expect(res.status).toBe(201)
    expect(versosMock.earnVersos).toHaveBeenCalledWith(
      "usr_1",
      "reading",
      expect.anything(),
    )
    expect(analyticsMock.trackPostCreate).toHaveBeenCalledWith("reading", false)
  })

  it("earnVersos retornando null aborta a transação (padrão K2)", async () => {
    versosMock.earnVersos.mockResolvedValue(null)

    const res = await callPost({ type: "reading", readingId: "rdg_1" })

    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error.code).toBe("INTERNAL_ERROR")
    expect(prismaMock.post.create).not.toHaveBeenCalled()
  })

  it("falha de DB vira 500 INTERNAL_ERROR JSON (nunca HTML)", async () => {
    prismaMock.post.create.mockRejectedValue(new Error("db down"))

    const res = await callPost({ type: "text", content: "ola" })

    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error.code).toBe("INTERNAL_ERROR")
    expect(body.meta.requestId).toBe("req_test")
  })

  it("corpo não-JSON → 422 VALIDATION_ERROR", async () => {
    const res = await callPost("{invalid json")

    expect(res.status).toBe(422)
    const body = await res.json()
    expect(body.error.code).toBe("VALIDATION_ERROR")
  })
})

function feedPost(id: string) {
  return { ...createdPost, id, authorId: "usr_2" }
}

describe("GET /api/v1/social/feed — feed (T052/AC-3)", () => {
  it("exige autenticação (401) — não consulta cache nem algoritmo", async () => {
    helpersMock.requireAuth.mockResolvedValue(
      Response.json(
        { error: { code: "UNAUTHENTICATED", message: "Token ausente" } },
        { status: 401 },
      ),
    )

    const res = await callGetFeed()

    expect(res.status).toBe(401)
    expect(feedCacheMock.getCachedFeed).not.toHaveBeenCalled()
    expect(feedMock.getFeed).not.toHaveBeenCalled()
  })

  it("envelope {data, pagination:{nextCursor}} com headers privados (S2-18)", async () => {
    feedMock.getFeed.mockResolvedValue({
      posts: [createdPost],
      nextCursor: "next_abc",
    })

    const res = await callGetFeed()

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(Object.keys(body)).toEqual(["data", "pagination"])
    expect(body.data).toHaveLength(1)
    expect(body.data[0].id).toBe("post_new")
    expect(body.pagination).toEqual({ nextCursor: "next_abc" })
    expect(res.headers.get("Cache-Control")).toBe("private, no-store")
    expect(res.headers.get("Vary")).toBe("Authorization")
  })

  it("limit default 10 quando ausente", async () => {
    const res = await callGetFeed()

    expect(res.status).toBe(200)
    expect(feedMock.getFeed).toHaveBeenCalledWith("usr_1", undefined, 10)
  })

  it("limit explícito repassado ao algoritmo", async () => {
    const res = await callGetFeed("?limit=25")

    expect(res.status).toBe(200)
    expect(feedMock.getFeed).toHaveBeenCalledWith("usr_1", undefined, 25)
  })

  it("limit inválido (0, 51, não-numérico) → 422 VALIDATION_ERROR", async () => {
    for (const query of ["?limit=0", "?limit=51", "?limit=abc"]) {
      const res = await callGetFeed(query)

      expect(res.status).toBe(422)
      const body = await res.json()
      expect(body.error.code).toBe("VALIDATION_ERROR")
      expect(res.headers.get("cache-control")).toBe("private, no-store")
      expect(res.headers.get("vary")).toBe("Authorization")
    }
    expect(feedMock.getFeed).not.toHaveBeenCalled()
  })

  it("cursor repassado ao algoritmo e ao cache", async () => {
    const res = await callGetFeed("?cursor=abc123")

    expect(res.status).toBe(200)
    expect(feedMock.getFeed).toHaveBeenCalledWith("usr_1", "abc123", 10)
    expect(feedCacheMock.getCachedFeed).toHaveBeenCalledWith("usr_1", "abc123")
  })

  it("cache hit serve a página materializada sem chamar o algoritmo", async () => {
    feedCacheMock.getCachedFeed.mockResolvedValue({
      posts: [feedPost("c1"), feedPost("c2")],
      nextCursor: "mat_abc",
    })

    const res = await callGetFeed()

    expect(res.status).toBe(200)
    expect(feedMock.getFeed).not.toHaveBeenCalled()
    const body = await res.json()
    expect(body.data.map((p: { id: string }) => p.id)).toEqual(["c1", "c2"])
    expect(body.pagination.nextCursor).toBe("mat_abc")
  })

  it("cache hit serve a página materializada completa com o cursor do cache (não corta, não reencoda)", async () => {
    feedCacheMock.getCachedFeed.mockResolvedValue({
      posts: [feedPost("c1"), feedPost("c2"), feedPost("c3")],
      nextCursor: "mat_abc",
    })

    const res = await callGetFeed("?limit=2")

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.map((p: { id: string }) => p.id)).toEqual([
      "c1",
      "c2",
      "c3",
    ])
    expect(body.pagination.nextCursor).toBe("mat_abc")
  })

  it("cache miss cai no algoritmo ao vivo", async () => {
    feedCacheMock.getCachedFeed.mockResolvedValue(null)
    feedMock.getFeed.mockResolvedValue({
      posts: [feedPost("live_1")],
      nextCursor: null,
    })

    const res = await callGetFeed()

    expect(res.status).toBe(200)
    expect(feedCacheMock.getCachedFeed).toHaveBeenCalledWith("usr_1", undefined)
    expect(feedMock.getFeed).toHaveBeenCalledTimes(1)
    const body = await res.json()
    expect(body.data[0].id).toBe("live_1")
    expect(body.pagination.nextCursor).toBeNull()
  })

  it("erro no algoritmo → 500 INTERNAL_ERROR JSON", async () => {
    feedMock.getFeed.mockRejectedValue(new Error("db down"))

    const res = await callGetFeed()

    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error.code).toBe("INTERNAL_ERROR")
    expect(body.meta.requestId).toBe("req_test")
    expect(res.headers.get("cache-control")).toBe("private, no-store")
    expect(res.headers.get("vary")).toBe("Authorization")
  })
})

function detailPost(overrides: Record<string, unknown> = {}) {
  return {
    id: "post_1",
    authorId: "u_author",
    type: "text",
    content: "ola mundo",
    imageUrls: [],
    readingId: null,
    audience: "public",
    isPinned: false,
    likeCount: 0,
    commentCount: 0,
    commentsDisabled: false,
    isHidden: false,
    createdAt: new Date("2026-09-30T10:00:00Z"),
    updatedAt: new Date("2026-09-30T10:00:00Z"),
    author: {
      id: "u_author",
      name: "Autor",
      displayName: "Autor",
      avatar: null,
      isBanned: false,
      deletedAt: null,
      isActive: true,
      profile: { privacy: { profileVisibility: "public" } },
    },
    comments: [],
    ...overrides,
  }
}

describe("GET /api/v1/social/posts/:id — detalhe (T057)", () => {
  it("exige autenticação (401) — não consulta o post", async () => {
    helpersMock.requireAuth.mockResolvedValue(
      Response.json(
        { error: { code: "UNAUTHENTICATED", message: "Token ausente" } },
        { status: 401 },
      ),
    )

    const res = await callDetail("post_1")

    expect(res.status).toBe(401)
    expect(prismaMock.post.findUnique).not.toHaveBeenCalled()
  })

  it("post inexistente → 404 POST_NOT_FOUND (anti-timing)", async () => {
    prismaMock.post.findUnique.mockResolvedValue(null)

    const res = await callDetail("nao_existe")

    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error.code).toBe("POST_NOT_FOUND")
    expect(prismaMock.follow.findUnique).not.toHaveBeenCalled()
  })

  it("post oculto (isHidden) → 404 POST_NOT_FOUND, sem checar follow", async () => {
    prismaMock.post.findUnique.mockResolvedValue(detailPost({ isHidden: true }))

    const res = await callDetail("post_1")

    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error.code).toBe("POST_NOT_FOUND")
    expect(prismaMock.follow.findUnique).not.toHaveBeenCalled()
  })

  it("autor banido → 404 POST_NOT_FOUND", async () => {
    prismaMock.post.findUnique.mockResolvedValue(
      detailPost({
        author: {
          id: "u_author",
          name: "Autor",
          displayName: "Autor",
          avatar: null,
          isBanned: true,
          deletedAt: null,
          isActive: true,
          profile: { privacy: { profileVisibility: "public" } },
        },
      }),
    )

    const res = await callDetail("post_1")

    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error.code).toBe("POST_NOT_FOUND")
  })

  it("audience followers: 404 sem follow, 200 com follow", async () => {
    prismaMock.post.findUnique.mockResolvedValue(
      detailPost({ audience: "followers" }),
    )

    prismaMock.follow.findUnique.mockResolvedValue(null)
    const denied = await callDetail("post_1")
    expect(denied.status).toBe(404)
    expect((await denied.json()).error.code).toBe("POST_NOT_FOUND")
    expect(prismaMock.follow.findUnique).toHaveBeenCalledWith({
      where: {
        followerId_followingId: {
          followerId: "usr_1",
          followingId: "u_author",
        },
      },
      select: { id: true },
    })

    prismaMock.follow.findUnique.mockResolvedValue({ id: "f1" })
    const allowed = await callDetail("post_1")
    expect(allowed.status).toBe(200)
  })

  it("perfil private do autor: 404 sem follow, 200 com follow", async () => {
    prismaMock.post.findUnique.mockResolvedValue(
      detailPost({
        author: {
          id: "u_author",
          name: "Autor",
          displayName: "Autor",
          avatar: null,
          isBanned: false,
          deletedAt: null,
          isActive: true,
          profile: { privacy: { profileVisibility: "private" } },
        },
      }),
    )

    prismaMock.follow.findUnique.mockResolvedValue(null)
    const denied = await callDetail("post_1")
    expect(denied.status).toBe(404)

    prismaMock.follow.findUnique.mockResolvedValue({ id: "f1" })
    const allowed = await callDetail("post_1")
    expect(allowed.status).toBe(200)
  })

  it("autor vendo o próprio post (followers ou perfil private) → 200 sem follow", async () => {
    prismaMock.post.findUnique.mockResolvedValue(
      detailPost({
        authorId: "usr_1",
        audience: "followers",
        author: {
          id: "usr_1",
          name: "Viewer",
          displayName: "Viewer",
          avatar: null,
          isBanned: false,
          deletedAt: null,
          isActive: true,
          profile: { privacy: { profileVisibility: "private" } },
        },
      }),
    )

    const res = await callDetail("post_1")

    expect(res.status).toBe(200)
    expect(prismaMock.follow.findUnique).not.toHaveBeenCalled()
  })

  it("200: envelope { data: { post, comments } } com raízes e replies aninhados (lote 10, mais recentes primeiro)", async () => {
    prismaMock.post.findUnique.mockResolvedValue(
      detailPost({
        comments: [
          {
            id: "c1",
            content: "comentario raiz",
            parentCommentId: null,
            createdAt: new Date("2026-09-30T11:00:00Z"),
            author: {
              id: "u2",
              name: "Commenter",
              displayName: "Commenter",
              avatar: null,
            },
            replies: [
              {
                id: "r1",
                content: "resposta",
                parentCommentId: "c1",
                createdAt: new Date("2026-09-30T12:00:00Z"),
                author: {
                  id: "u3",
                  name: "Replier",
                  displayName: "Replier",
                  avatar: null,
                },
              },
            ],
          },
        ],
      }),
    )

    const res = await callDetail("post_1")

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(Object.keys(body)).toEqual(["data"])
    expect(Object.keys(body.data)).toEqual(["post", "comments"])
    expect(body.data.post.id).toBe("post_1")
    expect(body.data.post.comments).toBeUndefined()
    expect(body.data.comments).toHaveLength(1)
    expect(body.data.comments[0].replies[0].id).toBe("r1")

    const args = prismaMock.post.findUnique.mock.calls[0]![0]!
    expect(args.include.comments).toMatchObject({
      where: { parentCommentId: null },
      orderBy: { createdAt: "desc" },
      take: 10,
    })
    expect(args.include.comments.include.replies).toMatchObject({
      orderBy: { createdAt: "desc" },
      take: 10,
    })
    expect(prismaMock.follow.findUnique).not.toHaveBeenCalled()
  })

  it("erro de DB → 500 INTERNAL_ERROR JSON", async () => {
    prismaMock.post.findUnique.mockRejectedValue(new Error("db down"))

    const res = await callDetail("post_1")

    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error.code).toBe("INTERNAL_ERROR")
  })
})

function callOg(id: string, headers: Record<string, string> = {}) {
  return import("@/app/api/v1/social/posts/[id]/og-image/route").then(
    ({ GET }) =>
      GET(
        new Request(
          `http://localhost:3000/api/v1/social/posts/${id}/og-image`,
          {
            headers,
          },
        ),
        { params: Promise.resolve({ id }) },
      ),
  )
}

describe("GET /api/v1/social/posts/:id/og-image (T058)", () => {
  beforeEach(() => {
    ogMock.generatePostOgImage.mockResolvedValue(Buffer.from("png-bytes"))
    helpersMock.optionalAuth.mockResolvedValue(null)
    prismaMock.post.findUnique.mockResolvedValue(null)
    prismaMock.follow.findUnique.mockResolvedValue(null)
  })

  it("post público + anônimo → 200 image/png com cache público e generator correto", async () => {
    prismaMock.post.findUnique.mockResolvedValue(detailPost())

    const res = await callOg("post_1")

    expect(res.status).toBe(200)
    expect(res.headers.get("content-type")).toBe("image/png")
    expect(res.headers.get("cache-control")).toBe(
      "public, max-age=3600, s-maxage=86400",
    )
    expect(res.headers.get("vary")).toBeNull()
    expect(Buffer.from(await res.arrayBuffer()).toString()).toBe("png-bytes")
    expect(ogMock.generatePostOgImage).toHaveBeenCalledWith({
      content: "ola mundo",
      authorName: "Autor",
      type: "text",
    })
    expect(prismaMock.follow.findUnique).not.toHaveBeenCalled()
  })

  it("post público: authorName usa displayName quando presente", async () => {
    prismaMock.post.findUnique.mockResolvedValue(
      detailPost({
        author: {
          id: "u_author",
          name: "Nome Base",
          displayName: "Nome Publico",
          avatar: null,
          isBanned: false,
          deletedAt: null,
          isActive: true,
          profile: { privacy: { profileVisibility: "public" } },
        },
      }),
    )

    const res = await callOg("post_1")

    expect(res.status).toBe(200)
    expect(ogMock.generatePostOgImage).toHaveBeenCalledWith(
      expect.objectContaining({ authorName: "Nome Publico" }),
    )
  })

  it("post followers + anônimo (crawler) → 404 POST_NOT_FOUND (CHK005) — não gera imagem", async () => {
    prismaMock.post.findUnique.mockResolvedValue(
      detailPost({ audience: "followers" }),
    )

    const res = await callOg("post_1")

    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error.code).toBe("POST_NOT_FOUND")
    expect(res.headers.get("cache-control")).toBe("private, no-store")
    expect(res.headers.get("vary")).toBe("Authorization")
    expect(ogMock.generatePostOgImage).not.toHaveBeenCalled()
    expect(prismaMock.follow.findUnique).not.toHaveBeenCalled()
  })

  it("post followers: viewer não seguidor → 404; seguidor → 200 no-store sem Vary", async () => {
    helpersMock.optionalAuth.mockResolvedValue("usr_1")
    prismaMock.post.findUnique.mockResolvedValue(
      detailPost({ audience: "followers" }),
    )

    prismaMock.follow.findUnique.mockResolvedValue(null)
    const denied = await callOg("post_1")
    expect(denied.status).toBe(404)
    expect((await denied.json()).error.code).toBe("POST_NOT_FOUND")
    expect(prismaMock.follow.findUnique).toHaveBeenCalledWith({
      where: {
        followerId_followingId: {
          followerId: "usr_1",
          followingId: "u_author",
        },
      },
      select: { id: true },
    })

    prismaMock.follow.findUnique.mockResolvedValue({ id: "f1" })
    const allowed = await callOg("post_1")
    expect(allowed.status).toBe(200)
    expect(allowed.headers.get("cache-control")).toBe("private, no-store")
    expect(allowed.headers.get("vary")).toBeNull()
  })

  it("perfil private do autor + anônimo → 404 (mesmo com audience public)", async () => {
    prismaMock.post.findUnique.mockResolvedValue(
      detailPost({
        author: {
          id: "u_author",
          name: "Autor",
          displayName: "Autor",
          avatar: null,
          isBanned: false,
          deletedAt: null,
          isActive: true,
          profile: { privacy: { profileVisibility: "private" } },
        },
      }),
    )

    const res = await callOg("post_1")

    expect(res.status).toBe(404)
    expect((await res.json()).error.code).toBe("POST_NOT_FOUND")
  })

  it("post inexistente e isHidden → 404 POST_NOT_FOUND uniforme", async () => {
    prismaMock.post.findUnique.mockResolvedValue(null)
    const missing = await callOg("nao_existe")
    expect(missing.status).toBe(404)
    expect((await missing.json()).error.code).toBe("POST_NOT_FOUND")

    prismaMock.post.findUnique.mockResolvedValue(detailPost({ isHidden: true }))
    const hidden = await callOg("post_1")
    expect(hidden.status).toBe(404)
    expect((await hidden.json()).error.code).toBe("POST_NOT_FOUND")
    expect(ogMock.generatePostOgImage).not.toHaveBeenCalled()
  })

  it("autor vendo o próprio post gated → 200 no-store sem consulta de follow", async () => {
    helpersMock.optionalAuth.mockResolvedValue("usr_1")
    prismaMock.post.findUnique.mockResolvedValue(
      detailPost({
        authorId: "usr_1",
        audience: "followers",
        author: {
          id: "usr_1",
          name: "Viewer",
          displayName: "Viewer",
          avatar: null,
          isBanned: false,
          deletedAt: null,
          isActive: true,
          profile: { privacy: { profileVisibility: "private" } },
        },
      }),
    )

    const res = await callOg("post_1")

    expect(res.status).toBe(200)
    expect(res.headers.get("cache-control")).toBe("private, no-store")
    expect(prismaMock.follow.findUnique).not.toHaveBeenCalled()
  })

  it("generator falha → 500 INTERNAL_ERROR JSON", async () => {
    prismaMock.post.findUnique.mockResolvedValue(detailPost())
    ogMock.generatePostOgImage.mockRejectedValue(new Error("sharp down"))

    const res = await callOg("post_1")

    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error.code).toBe("INTERNAL_ERROR")
    expect(res.headers.get("cache-control")).toBe("private, no-store")
    expect(res.headers.get("vary")).toBe("Authorization")
  })
})

function callPresign(body: unknown, headers: Record<string, string> = {}) {
  return import("@/app/api/v1/social/posts/images/presign/route").then(
    ({ POST }) =>
      POST(
        new Request(
          "http://localhost:3000/api/v1/social/posts/images/presign",
          {
            method: "POST",
            headers: { "content-type": "application/json", ...headers },
            body: typeof body === "string" ? body : JSON.stringify(body),
          },
        ),
      ),
  )
}

describe("POST /api/v1/social/posts/images/presign (T064)", () => {
  beforeEach(() => {
    r2Mock.generatePresignedUrl.mockResolvedValue(
      "https://r2.example/put?sig=x",
    )
  })

  it("CSRF inválido bloqueia antes de auth e presign", async () => {
    csrfMock.enforceCsrf.mockReturnValue(
      Response.json(
        { error: { code: "CSRF_TOKEN_INVALID", message: "CSRF invalido" } },
        { status: 403 },
      ),
    )

    const res = await callPresign({ images: [{ contentType: "image/png" }] })

    expect(res.status).toBe(403)
    expect(helpersMock.requireAuth).not.toHaveBeenCalled()
    expect(r2Mock.generatePresignedUrl).not.toHaveBeenCalled()
  })

  it("exige autenticação (401) — não presigna", async () => {
    helpersMock.requireAuth.mockResolvedValue(
      Response.json(
        { error: { code: "UNAUTHENTICATED", message: "Token ausente" } },
        { status: 401 },
      ),
    )

    const res = await callPresign({ images: [{ contentType: "image/png" }] })

    expect(res.status).toBe(401)
    expect(r2Mock.generatePresignedUrl).not.toHaveBeenCalled()
  })

  it("corpo não-JSON → 422 VALIDATION_ERROR", async () => {
    const res = await callPresign("nao-e-json")

    expect(res.status).toBe(422)
    const body = await res.json()
    expect(body.error.code).toBe("VALIDATION_ERROR")
  })

  it("Zod rejeita contentType fora de jpeg/png/webp, lista vazia e >4 imagens → 422 com details", async () => {
    const gif = await callPresign({ images: [{ contentType: "image/gif" }] })
    expect(gif.status).toBe(422)
    const gifBody = await gif.json()
    expect(gifBody.error.code).toBe("VALIDATION_ERROR")
    expect(gifBody.error.details[0].field).toBe("images.0.contentType")

    const empty = await callPresign({ images: [] })
    expect(empty.status).toBe(422)

    const five = await callPresign({
      images: Array.from({ length: 5 }, () => ({
        contentType: "image/png",
      })),
    })
    expect(five.status).toBe(422)
    expect(r2Mock.generatePresignedUrl).not.toHaveBeenCalled()
  })

  it("ignora Content-Length do request presign (é o do JSON, não da imagem; 5MB é do PUT - S2-12)", async () => {
    const res = await callPresign(
      { images: [{ contentType: "image/png" }] },
      { "content-length": String(6 * 1024 * 1024) },
    )

    expect(res.status).toBe(200)
    expect(r2Mock.generatePresignedUrl).toHaveBeenCalledOnce()
  })

  it("rate limit upload negado → 429 (rate.response)", async () => {
    rateMock.enforceSocialLimit.mockResolvedValue({
      allowed: false,
      headers: { "Retry-After": "10" },
      check: { allowed: false, remaining: 0 },
      response: Response.json(
        {
          error: {
            code: "RATE_LIMITED",
            message: "Limite excedido. Tente novamente mais tarde.",
          },
        },
        { status: 429, headers: { "Retry-After": "10" } },
      ),
    })

    const res = await callPresign({ images: [{ contentType: "image/png" }] })

    expect(res.status).toBe(429)
    expect(r2Mock.generatePresignedUrl).not.toHaveBeenCalled()
  })

  it("sucesso: keys posts/{userId}/{ts}-{i}.{ext}, presign por imagem, envelope { uploads } + headers de rate", async () => {
    const res = await callPresign({
      images: [{ contentType: "image/jpeg" }, { contentType: "image/webp" }],
    })

    expect(res.status).toBe(200)
    expect(res.headers.get("x-ratelimit-remaining")).toBe("9")
    const body = await res.json()
    expect(Object.keys(body)).toEqual(["uploads"])
    expect(body.uploads).toHaveLength(2)
    for (const [i, upload] of body.uploads.entries()) {
      expect(upload.uploadUrl).toBe("https://r2.example/put?sig=x")
      expect(upload.key).toMatch(
        new RegExp(`^posts/usr_1/\\d+-${i}\\.(jpg|webp)$`),
      )
    }
    expect(rateMock.enforceSocialLimit).toHaveBeenCalledWith(
      expect.objectContaining({ limit: "upload", userId: "usr_1" }),
    )
    expect(r2Mock.generatePresignedUrl).toHaveBeenCalledTimes(2)
    expect(r2Mock.generatePresignedUrl).toHaveBeenCalledWith(
      body.uploads[0].key,
      "image/jpeg",
    )
  })

  it("erro do R2 → 500 INTERNAL_ERROR JSON", async () => {
    r2Mock.generatePresignedUrl.mockRejectedValue(new Error("r2 down"))

    const res = await callPresign({ images: [{ contentType: "image/png" }] })

    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error.code).toBe("INTERNAL_ERROR")
  })
})
