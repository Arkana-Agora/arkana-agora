// @vitest-environment node
import { Prisma } from "@prisma/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// Phase 3 — Interactions (T076–T089): like, comentários, likes de comentário
// e notificações. TDD Red→Green por fatia; S2-19 (contador no MESMO $transaction),
// Q28 (404 uniforme com o GET), RF-SOC-004/005 (auto-like 403, curtidas anônimas).

const prismaMock = vi.hoisted(() => ({
  user: { findUnique: vi.fn() },
  userProfile: { findUnique: vi.fn() },
  follow: { findUnique: vi.fn(), findFirst: vi.fn() },
  notification: {
    create: vi.fn(),
    deleteMany: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  },
  post: { findUnique: vi.fn(), update: vi.fn() },
  postLike: { findUnique: vi.fn(), create: vi.fn(), delete: vi.fn() },
  postLikeReward: { findUnique: vi.fn(), create: vi.fn() },
  comment: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
  },
  commentLike: { findUnique: vi.fn(), create: vi.fn(), delete: vi.fn() },
  commentLikeReward: { findUnique: vi.fn(), create: vi.fn() },
  commentReward: { findUnique: vi.fn(), create: vi.fn() },
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
  VersosSource: {
    Like: "like",
    Comment: "comment",
    Follow: "follow",
    Reading: "reading",
  },
}))

const analyticsMock = vi.hoisted(() => ({
  trackLike: vi.fn(),
  trackComment: vi.fn(),
  trackVersosEarned: vi.fn(),
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
vi.mock("@/lib/analytics", () => analyticsMock)
vi.mock("@socket/src/emitters", () => emittersMock)
vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  newReqId: () => "req_test",
}))

async function callLike(postId: string) {
  const { POST } = await import("@/app/api/v1/social/posts/[id]/like/route")
  return POST(
    new Request(`http://localhost:3000/api/v1/social/posts/${postId}/like`, {
      method: "POST",
    }),
    { params: Promise.resolve({ id: postId }) },
  )
}

async function callComment(postId: string, body: unknown) {
  const { POST } = await import("@/app/api/v1/social/posts/[id]/comments/route")
  return POST(
    new Request(
      `http://localhost:3000/api/v1/social/posts/${postId}/comments`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      },
    ),
    { params: Promise.resolve({ id: postId }) },
  )
}

async function callGetComments(postId: string, query = "") {
  const { GET } = await import("@/app/api/v1/social/posts/[id]/comments/route")
  return GET(
    new Request(
      `http://localhost:3000/api/v1/social/posts/${postId}/comments${query}`,
    ),
    { params: Promise.resolve({ id: postId }) },
  )
}

async function callPatchComment(commentId: string, body: unknown) {
  const { PATCH } = await import("@/app/api/v1/social/comments/[id]/route")
  return PATCH(
    new Request(`http://localhost:3000/api/v1/social/comments/${commentId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id: commentId }) },
  )
}

async function callDeleteComment(commentId: string) {
  const { DELETE } = await import("@/app/api/v1/social/comments/[id]/route")
  return DELETE(
    new Request(`http://localhost:3000/api/v1/social/comments/${commentId}`, {
      method: "DELETE",
    }),
    { params: Promise.resolve({ id: commentId }) },
  )
}

async function callGetNotifications(query = "") {
  const { GET } = await import("@/app/api/v1/social/notifications/route")
  return GET(
    new Request(`http://localhost:3000/api/v1/social/notifications${query}`),
  )
}

async function callPatchRead(notificationId: string) {
  const { PATCH } =
    await import("@/app/api/v1/social/notifications/[id]/read/route")
  return PATCH(
    new Request(
      `http://localhost:3000/api/v1/social/notifications/${notificationId}/read`,
      { method: "PATCH" },
    ),
    { params: Promise.resolve({ id: notificationId }) },
  )
}

async function callPatchReadAll() {
  const { PATCH } =
    await import("@/app/api/v1/social/notifications/read-all/route")
  return PATCH(
    new Request("http://localhost:3000/api/v1/social/notifications/read-all", {
      method: "PATCH",
    }),
  )
}

const rateAllowed = {
  allowed: true,
  headers: { "X-RateLimit-Remaining": "9" },
  check: { allowed: true, remaining: 9 },
}

const author = {
  id: "usr_author",
  name: "Author Name",
  displayName: null,
  avatar: null,
  isBanned: false,
  deletedAt: null,
  isActive: true,
  profile: { privacy: null },
}

const visiblePost = {
  id: "post_1",
  authorId: "usr_author",
  type: "text",
  content: "conteudo",
  audience: "public",
  isHidden: false,
  likeCount: 5,
  commentCount: 0,
  commentsDisabled: false,
  author,
}

function prismaError(code: "P2002" | "P2025") {
  return new Prisma.PrismaClientKnownRequestError(`db error ${code}`, {
    code,
    clientVersion: "6.0.0",
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.resetModules()
  helpersMock.requireAuth.mockResolvedValue({ userId: "usr_1" })
  csrfMock.enforceCsrf.mockReturnValue(null)
  rateMock.enforceSocialLimit.mockResolvedValue(rateAllowed)
  prismaMock.$transaction.mockImplementation(
    async (fn: (tx: unknown) => Promise<unknown>) => fn(prismaMock),
  )
  prismaMock.post.findUnique.mockResolvedValue(visiblePost)
  prismaMock.post.update.mockResolvedValue({ likeCount: 6 })
  prismaMock.postLike.findUnique.mockResolvedValue(null)
  prismaMock.postLike.create.mockResolvedValue({ id: "pl_new" })
  prismaMock.postLike.delete.mockResolvedValue({ id: "pl_1" })
  prismaMock.user.findUnique.mockResolvedValue({
    id: "usr_1",
    name: "Viewer Name",
    displayName: null,
  })
  prismaMock.follow.findUnique.mockResolvedValue(null)
  prismaMock.follow.findFirst.mockResolvedValue(null)
  prismaMock.userProfile.findUnique.mockResolvedValue({ privacy: null })
  prismaMock.comment.create.mockImplementation(
    async (args: { data: Record<string, unknown> }) => ({
      id: "cmt_new",
      likeCount: 0,
      createdAt: new Date("2026-10-05T10:00:00Z"),
      author: {
        id: "usr_1",
        name: "Viewer Name",
        displayName: null,
        avatar: null,
      },
      ...args.data,
    }),
  )
  prismaMock.notification.create.mockImplementation(
    async (args: { data: Record<string, unknown> }) => ({
      id: "ntf_new",
      ...args.data,
    }),
  )
  prismaMock.notification.deleteMany.mockResolvedValue({ count: 0 })
  versosMock.earnVersos.mockImplementation(
    async (_userId: string, source: string) => (source === "like" ? 1 : 2),
  )
})

afterEach(() => {
  vi.resetModules()
})

describe("T076 — POST /social/posts/:id/like", () => {
  it("CSRF responde 403 antes do requireAuth", async () => {
    csrfMock.enforceCsrf.mockReturnValue(
      new Response(JSON.stringify({ error: { code: "CSRF_TOKEN_INVALID" } }), {
        status: 403,
      }),
    )

    const res = await callLike("post_1")

    expect(res.status).toBe(403)
    expect(helpersMock.requireAuth).not.toHaveBeenCalled()
  })

  it("sem token responde 401 antes do rate limit", async () => {
    helpersMock.requireAuth.mockResolvedValue(
      new Response(JSON.stringify({ error: { code: "AUTH_TOKEN_INVALID" } }), {
        status: 401,
      }),
    )

    const res = await callLike("post_1")

    expect(res.status).toBe(401)
    expect(rateMock.enforceSocialLimit).not.toHaveBeenCalled()
  })

  it("rate limit esgotado responde 429 sem consultar o post", async () => {
    rateMock.enforceSocialLimit.mockResolvedValue({
      allowed: false,
      response: new Response(
        JSON.stringify({ error: { code: "RATE_LIMITED" } }),
        { status: 429 },
      ),
      headers: {},
    })

    const res = await callLike("post_1")

    expect(res.status).toBe(429)
    expect(prismaMock.post.findUnique).not.toHaveBeenCalled()
  })

  it("post inexistente responde 404 POST_NOT_FOUND uniforme", async () => {
    prismaMock.post.findUnique.mockResolvedValue(null)

    const res = await callLike("post_missing")
    const body = await res.json()

    expect(res.status).toBe(404)
    expect(body.error.code).toBe("POST_NOT_FOUND")
    expect(prismaMock.postLike.create).not.toHaveBeenCalled()
    expect(emittersMock.emitLikeUpdated).not.toHaveBeenCalled()
  })

  it("post oculto responde 404 (mesmo predicado do GET, anti-timing Q28)", async () => {
    prismaMock.post.findUnique.mockResolvedValue({
      ...visiblePost,
      isHidden: true,
    })

    const res = await callLike("post_1")
    const body = await res.json()

    expect(res.status).toBe(404)
    expect(body.error.code).toBe("POST_NOT_FOUND")
  })

  it("post gated sem follow responde 404 uniforme", async () => {
    prismaMock.post.findUnique.mockResolvedValue({
      ...visiblePost,
      audience: "followers",
    })

    const res = await callLike("post_1")
    const body = await res.json()

    expect(res.status).toBe(404)
    expect(body.error.code).toBe("POST_NOT_FOUND")
    expect(prismaMock.follow.findUnique).toHaveBeenCalled()
  })

  it("auto-like responde 403 SELF_LIKE sem criar curtida", async () => {
    prismaMock.post.findUnique.mockResolvedValue({
      ...visiblePost,
      authorId: "usr_1",
      author: { ...author, id: "usr_1" },
    })

    const res = await callLike("post_1")
    const body = await res.json()

    expect(res.status).toBe(403)
    expect(body.error.code).toBe("SELF_LIKE")
    expect(body.error.details).toEqual({ reason: "self_like" })
    expect(prismaMock.postLike.create).not.toHaveBeenCalled()
    expect(prismaMock.notification.create).not.toHaveBeenCalled()
    expect(emittersMock.emitLikeUpdated).not.toHaveBeenCalled()
  })

  it("curtir: cria curtida e incrementa likeCount no MESMO tx (S2-19) + notificação + versos + emits", async () => {
    const res = await callLike("post_1")
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data).toEqual({ liked: true, likeCount: 6 })
    expect(res.headers.get("X-RateLimit-Remaining")).toBe("9")
    expect(rateMock.enforceSocialLimit).toHaveBeenCalledWith(
      expect.objectContaining({ limit: "like", userId: "usr_1" }),
    )

    expect(prismaMock.postLike.create).toHaveBeenCalledWith({
      data: { postId: "post_1", userId: "usr_1" },
    })
    expect(prismaMock.post.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "post_1" },
        data: { likeCount: { increment: 1 } },
      }),
    )

    expect(prismaMock.notification.deleteMany).toHaveBeenCalledWith({
      where: {
        userId: "usr_author",
        type: "like",
        data: { equals: { postId: "post_1", likerId: "usr_1" } },
      },
    })
    expect(prismaMock.notification.create).toHaveBeenCalledWith({
      data: {
        userId: "usr_author",
        type: "like",
        message: "Viewer Name curtiu sua publicação",
        data: { postId: "post_1", likerId: "usr_1" },
      },
    })
    expect(versosMock.earnVersos).toHaveBeenCalledWith(
      "usr_1",
      "like",
      prismaMock,
    )
    expect(analyticsMock.trackLike).toHaveBeenCalledWith("post_1")
    expect(analyticsMock.trackVersosEarned).toHaveBeenCalledWith("like", 1)

    expect(emittersMock.emitLikeUpdated).toHaveBeenCalledWith({
      postId: "post_1",
      newCount: 6,
    })
    expect(emittersMock.emitNotification).toHaveBeenCalledWith({
      userId: "usr_author",
      notification: {
        id: "ntf_new",
        type: "like",
        message: "Viewer Name curtiu sua publicação",
        data: { postId: "post_1", likerId: "usr_1" },
      },
    })
  })

  it("descurtir: remove curtida e decrementa no MESMO tx, sem notificação nem versos", async () => {
    prismaMock.postLike.findUnique.mockResolvedValue({ id: "pl_1" })
    prismaMock.post.update.mockResolvedValue({ likeCount: 4 })

    const res = await callLike("post_1")
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data).toEqual({ liked: false, likeCount: 4 })

    expect(prismaMock.postLike.delete).toHaveBeenCalledWith({
      where: { postId_userId: { postId: "post_1", userId: "usr_1" } },
    })
    expect(prismaMock.post.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "post_1" },
        data: { likeCount: { decrement: 1 } },
      }),
    )
    expect(prismaMock.notification.create).not.toHaveBeenCalled()
    expect(versosMock.earnVersos).not.toHaveBeenCalled()
    expect(emittersMock.emitNotification).not.toHaveBeenCalled()
    expect(emittersMock.emitLikeUpdated).toHaveBeenCalledWith({
      postId: "post_1",
      newCount: 4,
    })
  })

  it("descurtir limpa a notificação do par (anti-flood, espelho do unfollow)", async () => {
    prismaMock.postLike.findUnique.mockResolvedValue({ id: "pl_1" })

    await callLike("post_1")

    expect(prismaMock.notification.deleteMany).toHaveBeenCalledWith({
      where: {
        userId: "usr_author",
        type: "like",
        data: { equals: { postId: "post_1", likerId: "usr_1" } },
      },
    })
  })

  it("corrida P2002 re-ler a fonte de verdade e responde com o estado real", async () => {
    prismaMock.postLike.create.mockRejectedValue(prismaError("P2002"))
    prismaMock.postLike.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: "pl_1" })
    prismaMock.post.findUnique
      .mockResolvedValueOnce(visiblePost)
      .mockResolvedValueOnce({ likeCount: 6 })

    const res = await callLike("post_1")
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data).toEqual({ liked: true, likeCount: 6 })
    expect(emittersMock.emitLikeUpdated).toHaveBeenCalledWith({
      postId: "post_1",
      newCount: 6,
    })
  })

  it("200 não espera o emit (fire-and-forget)", async () => {
    emittersMock.emitLikeUpdated.mockReturnValue(
      new Promise(() => undefined) as never,
    )
    emittersMock.emitNotification.mockReturnValue(
      new Promise(() => undefined) as never,
    )

    const res = await callLike("post_1")

    expect(res.status).toBe(200)
    expect(emittersMock.emitLikeUpdated).toHaveBeenCalledTimes(1)
  })
})

describe("T077 — POST /social/posts/:id/comments", () => {
  it("corpo não-JSON responde 422 antes do rate limit", async () => {
    const { POST } =
      await import("@/app/api/v1/social/posts/[id]/comments/route")
    const res = await POST(
      new Request("http://localhost:3000/api/v1/social/posts/post_1/comments", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "nao-json",
      }),
      { params: Promise.resolve({ id: "post_1" }) },
    )

    expect(res.status).toBe(422)
    expect(rateMock.enforceSocialLimit).not.toHaveBeenCalled()
  })

  it("content acima de 300 responde 422 antes do rate limit", async () => {
    const res = await callComment("post_1", { content: "x".repeat(301) })
    const body = await res.json()

    expect(res.status).toBe(422)
    expect(body.error.code).toBe("VALIDATION_ERROR")
    expect(rateMock.enforceSocialLimit).not.toHaveBeenCalled()
    expect(prismaMock.comment.create).not.toHaveBeenCalled()
  })

  it("rate limit esgotado responde 429 sem consultar o post", async () => {
    rateMock.enforceSocialLimit.mockResolvedValue({
      allowed: false,
      response: new Response(
        JSON.stringify({ error: { code: "RATE_LIMITED" } }),
        { status: 429 },
      ),
      headers: {},
    })

    const res = await callComment("post_1", { content: "oi" })

    expect(res.status).toBe(429)
    expect(prismaMock.post.findUnique).not.toHaveBeenCalled()
  })

  it("post invisível responde 404 POST_NOT_FOUND uniforme (Q28)", async () => {
    prismaMock.post.findUnique.mockResolvedValue(null)

    const res = await callComment("post_1", { content: "oi" })
    const body = await res.json()

    expect(res.status).toBe(404)
    expect(body.error.code).toBe("POST_NOT_FOUND")
    expect(prismaMock.comment.create).not.toHaveBeenCalled()
  })

  it("post com commentsDisabled responde 403 COMMENTS_DISABLED", async () => {
    prismaMock.post.findUnique.mockResolvedValue({
      ...visiblePost,
      commentsDisabled: true,
    })

    const res = await callComment("post_1", { content: "oi" })
    const body = await res.json()

    expect(res.status).toBe(403)
    expect(body.error.code).toBe("COMMENTS_DISABLED")
    expect(prismaMock.comment.create).not.toHaveBeenCalled()
  })

  it("autor com whoCanComment=nobody responde 403 WHO_CAN_COMMENT", async () => {
    prismaMock.post.findUnique.mockResolvedValue({
      ...visiblePost,
      author: { ...author, profile: { privacy: { whoCanComment: "nobody" } } },
    })

    const res = await callComment("post_1", { content: "oi" })
    const body = await res.json()

    expect(res.status).toBe(403)
    expect(body.error.code).toBe("WHO_CAN_COMMENT")
    expect(body.error.details).toEqual({ reason: "privacy_nobody" })
    expect(prismaMock.comment.create).not.toHaveBeenCalled()
  })

  it("privacy do autor inválida é fail-closed (403) — via autor do próprio post", async () => {
    // Privacy malformada também torna o post "gated" (hasPrivateProfile
    // fail-closed) → para TERCEIROS o 404 anti-timing vem antes. O 403
    // privacy_invalid é alcançável pelo autor (exceção do predicado).
    prismaMock.post.findUnique.mockResolvedValue({
      ...visiblePost,
      authorId: "usr_1",
      author: {
        ...author,
        id: "usr_1",
        profile: { privacy: { whoCanComment: "invalid_value" } },
      },
    })

    const res = await callComment("post_1", { content: "oi" })
    const body = await res.json()

    expect(res.status).toBe(403)
    expect(body.error.code).toBe("WHO_CAN_COMMENT")
    expect(body.error.details).toEqual({ reason: "privacy_invalid" })
  })

  it("whoCanComment=following sem follow do autor responde 403", async () => {
    prismaMock.post.findUnique.mockResolvedValue({
      ...visiblePost,
      author: {
        ...author,
        profile: { privacy: { whoCanComment: "following" } },
      },
    })

    const res = await callComment("post_1", { content: "oi" })
    const body = await res.json()

    expect(res.status).toBe(403)
    expect(body.error.code).toBe("WHO_CAN_COMMENT")
    expect(body.error.details).toEqual({ reason: "privacy_following" })
    expect(prismaMock.follow.findFirst).toHaveBeenCalledWith({
      where: { followerId: "usr_author", followingId: "usr_1" },
      select: { id: true },
    })
  })

  it("whoCanComment=following com follow do autor é permitido", async () => {
    prismaMock.post.findUnique.mockResolvedValue({
      ...visiblePost,
      author: {
        ...author,
        profile: { privacy: { whoCanComment: "following" } },
      },
    })
    prismaMock.follow.findFirst.mockResolvedValue({ id: "flw_1" })

    const res = await callComment("post_1", { content: "oi" })

    expect(res.status).toBe(201)
  })

  it("parent inexistente responde 422 em parentCommentId", async () => {
    prismaMock.comment.findUnique.mockResolvedValue(null)

    const res = await callComment("post_1", {
      content: "resposta",
      parentCommentId: "cmt_missing",
    })
    const body = await res.json()

    expect(res.status).toBe(422)
    expect(body.error.details).toEqual([
      { field: "parentCommentId", message: expect.any(String) },
    ])
    expect(prismaMock.comment.create).not.toHaveBeenCalled()
  })

  it("parent de outro post responde 422 (mesmo post, anti-enumeration)", async () => {
    prismaMock.comment.findUnique.mockResolvedValue({
      id: "cmt_p",
      postId: "post_OTHER",
      authorId: "usr_parent",
      parentCommentId: null,
    })

    const res = await callComment("post_1", {
      content: "resposta",
      parentCommentId: "cmt_p",
    })
    const body = await res.json()

    expect(res.status).toBe(422)
    expect(body.error.details).toEqual([
      { field: "parentCommentId", message: expect.any(String) },
    ])
    expect(prismaMock.comment.create).not.toHaveBeenCalled()
  })

  it("resposta a resposta (nível 2) responde 422 — aninhamento de 1 nível", async () => {
    prismaMock.comment.findUnique.mockResolvedValue({
      id: "cmt_p",
      postId: "post_1",
      authorId: "usr_parent",
      parentCommentId: "cmt_root",
    })

    const res = await callComment("post_1", {
      content: "resposta",
      parentCommentId: "cmt_p",
    })

    expect(res.status).toBe(422)
    expect(prismaMock.comment.create).not.toHaveBeenCalled()
  })

  it("raiz: cria comentário e incrementa commentCount no MESMO tx (S2-19) + notificação + versos + emits", async () => {
    const res = await callComment("post_1", { content: "que bela leitura" })
    const body = await res.json()

    expect(res.status).toBe(201)
    expect(body.data.comment).toMatchObject({
      id: "cmt_new",
      postId: "post_1",
      authorId: "usr_1",
      content: "que bela leitura",
      parentCommentId: null,
      author: { id: "usr_1", name: "Viewer Name" },
    })
    expect(res.headers.get("X-RateLimit-Remaining")).toBe("9")
    expect(rateMock.enforceSocialLimit).toHaveBeenCalledWith(
      expect.objectContaining({ limit: "comment", userId: "usr_1" }),
    )

    expect(prismaMock.comment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          postId: "post_1",
          authorId: "usr_1",
          content: "que bela leitura",
          parentCommentId: null,
        },
      }),
    )
    expect(prismaMock.post.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "post_1" },
        data: { commentCount: { increment: 1 } },
      }),
    )
    expect(prismaMock.notification.create).toHaveBeenCalledTimes(1)
    expect(prismaMock.notification.create).toHaveBeenCalledWith({
      data: {
        userId: "usr_author",
        type: "comment",
        message: "Viewer Name comentou no seu post",
        data: { postId: "post_1", commentId: "cmt_new" },
      },
    })
    expect(versosMock.earnVersos).toHaveBeenCalledWith(
      "usr_1",
      "comment",
      prismaMock,
    )
    expect(analyticsMock.trackComment).toHaveBeenCalledWith("post_1", false)
    expect(analyticsMock.trackVersosEarned).toHaveBeenCalledWith("comment", 2)

    expect(emittersMock.emitCommentAdded).toHaveBeenCalledWith({
      postId: "post_1",
      commentId: "cmt_new",
      authorName: "Viewer Name",
      text: "que bela leitura",
      postAuthorId: "usr_author",
    })
    expect(emittersMock.emitNotification).toHaveBeenCalledTimes(1)
    expect(emittersMock.emitNotification).toHaveBeenCalledWith({
      userId: "usr_author",
      notification: {
        id: "ntf_new",
        type: "comment",
        message: "Viewer Name comentou no seu post",
        data: { postId: "post_1", commentId: "cmt_new" },
      },
    })
  })

  it("resposta notifica o autor do post e o autor do comentário pai (mensagens distintas)", async () => {
    prismaMock.comment.findUnique.mockResolvedValue({
      id: "cmt_p",
      postId: "post_1",
      authorId: "usr_parent",
      parentCommentId: null,
    })

    const res = await callComment("post_1", {
      content: "concordo!",
      parentCommentId: "cmt_p",
    })

    expect(res.status).toBe(201)
    expect(prismaMock.comment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ parentCommentId: "cmt_p" }),
      }),
    )
    expect(prismaMock.notification.create).toHaveBeenCalledTimes(2)
    expect(prismaMock.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: "usr_author",
          message: "Viewer Name comentou no seu post",
        }),
      }),
    )
    expect(prismaMock.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: "usr_parent",
          message: "Viewer Name respondeu ao seu comentário",
        }),
      }),
    )
    expect(emittersMock.emitNotification).toHaveBeenCalledTimes(2)
    expect(analyticsMock.trackComment).toHaveBeenCalledWith("post_1", true)
    expect(emittersMock.emitCommentAdded).toHaveBeenCalledWith(
      expect.objectContaining({ postAuthorId: "usr_author" }),
    )
  })

  it("responder ao próprio comentário notifica só o autor do post", async () => {
    prismaMock.comment.findUnique.mockResolvedValue({
      id: "cmt_p",
      postId: "post_1",
      authorId: "usr_1",
      parentCommentId: null,
    })

    const res = await callComment("post_1", {
      content: "auto-resposta",
      parentCommentId: "cmt_p",
    })

    expect(res.status).toBe(201)
    expect(prismaMock.notification.create).toHaveBeenCalledTimes(1)
    expect(prismaMock.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ userId: "usr_author" }),
      }),
    )
  })

  it("comentar no próprio post não cria notificação para si mesmo", async () => {
    prismaMock.post.findUnique.mockResolvedValue({
      ...visiblePost,
      authorId: "usr_1",
      author: { ...author, id: "usr_1" },
    })

    const res = await callComment("post_1", { content: "meu post" })

    expect(res.status).toBe(201)
    expect(prismaMock.notification.create).not.toHaveBeenCalled()
    expect(emittersMock.emitNotification).not.toHaveBeenCalled()
    expect(emittersMock.emitCommentAdded).toHaveBeenCalledWith(
      expect.objectContaining({ postAuthorId: "usr_1" }),
    )
  })

  it("earnVersos sem UserProfile aborta a tx (K2) e responde 500", async () => {
    versosMock.earnVersos.mockResolvedValue(null)

    const res = await callComment("post_1", { content: "oi" })
    const body = await res.json()

    expect(res.status).toBe(500)
    expect(body.error.code).toBe("INTERNAL_ERROR")
    expect(emittersMock.emitCommentAdded).not.toHaveBeenCalled()
  })

  it("201 não espera os emits (fire-and-forget)", async () => {
    emittersMock.emitCommentAdded.mockReturnValue(
      new Promise(() => undefined) as never,
    )

    const res = await callComment("post_1", { content: "oi" })

    expect(res.status).toBe(201)
    expect(emittersMock.emitCommentAdded).toHaveBeenCalledTimes(1)
  })
})

function commentRow(index: number, baseMs: number) {
  return {
    id: `cmt_${index}`,
    postId: "post_1",
    authorId: "usr_author",
    content: `comentario ${index}`,
    parentCommentId: null,
    likeCount: 0,
    createdAt: new Date(baseMs - index * 1000),
    author: {
      id: "usr_author",
      name: "Author Name",
      displayName: null,
      avatar: null,
    },
    replies: [],
  }
}

describe("T078 — GET /social/posts/:id/comments", () => {
  it("sem token responde 401 antes de consultar o banco", async () => {
    helpersMock.requireAuth.mockResolvedValue(
      new Response(JSON.stringify({ error: { code: "AUTH_TOKEN_INVALID" } }), {
        status: 401,
      }),
    )

    const res = await callGetComments("post_1")

    expect(res.status).toBe(401)
    expect(prismaMock.post.findUnique).not.toHaveBeenCalled()
  })

  it("query inválida responde 422 antes de consultar o banco", async () => {
    const res = await callGetComments("post_1", "?limit=0")
    const body = await res.json()

    expect(res.status).toBe(422)
    expect(body.error.code).toBe("VALIDATION_ERROR")
    expect(prismaMock.post.findUnique).not.toHaveBeenCalled()
  })

  it("post invisível responde 404 POST_NOT_FOUND uniforme", async () => {
    prismaMock.post.findUnique.mockResolvedValue(null)

    const res = await callGetComments("post_1")
    const body = await res.json()

    expect(res.status).toBe(404)
    expect(body.error.code).toBe("POST_NOT_FOUND")
    expect(prismaMock.comment.findMany).not.toHaveBeenCalled()
  })

  it("lote default 10 com envelope S2-18, replies aninhados e headers privados", async () => {
    const base = Date.parse("2026-10-05T10:00:00Z")
    const rows = Array.from({ length: 11 }, (_, i) => commentRow(i, base))
    prismaMock.comment.findMany.mockResolvedValue(rows)

    const res = await callGetComments("post_1")
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data).toHaveLength(10)
    expect(typeof body.pagination.nextCursor).toBe("string")
    expect(res.headers.get("Cache-Control")).toBe("private, no-store")
    expect(res.headers.get("Vary")).toBe("Authorization")

    expect(prismaMock.comment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          postId: "post_1",
          parentCommentId: null,
          author: { isActive: true, isBanned: false, deletedAt: null },
          content: { not: "[removido]" },
        }),
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 11,
        include: expect.objectContaining({
          author: { select: expect.any(Object) },
          replies: expect.objectContaining({
            where: expect.objectContaining({
              author: { isActive: true, isBanned: false, deletedAt: null },
              content: { not: "[removido]" },
            }),
            orderBy: [{ createdAt: "desc" }, { id: "desc" }],
            take: 10,
          }),
        }),
      }),
    )
  })

  it("página esgotada devolve nextCursor null", async () => {
    const base = Date.parse("2026-10-05T10:00:00Z")
    prismaMock.comment.findMany.mockResolvedValue([
      commentRow(0, base),
      commentRow(1, base),
    ])

    const res = await callGetComments("post_1")
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data).toHaveLength(2)
    expect(body.pagination.nextCursor).toBeNull()
  })

  it("cursor vira keyset createdAt < cursor no where", async () => {
    const { encodeFeedCursor } = await import("@/lib/social/feed-algorithm")
    const cursor = encodeFeedCursor({
      createdAt: Date.parse("2026-10-05T09:00:00Z"),
      id: "cmt_50",
    })
    prismaMock.comment.findMany.mockResolvedValue([commentRow(0, Date.now())])

    const res = await callGetComments("post_1", `?cursor=${cursor}`)
    const body = await res.json()

    expect(res.status).toBe(200)
    const args = prismaMock.comment.findMany.mock.calls[0]?.[0] as {
      where: { AND?: { OR: unknown[] }[] }
    }
    expect(args.where.AND).toEqual([
      {
        OR: [
          { createdAt: { lt: new Date(Date.parse("2026-10-05T09:00:00Z")) } },
          {
            createdAt: new Date(Date.parse("2026-10-05T09:00:00Z")),
            id: { lt: "cmt_50" },
          },
        ],
      },
    ])
    expect(body.pagination.nextCursor).toBeNull()
  })

  it("cursor inválido devolve página vazia sem consultar o banco", async () => {
    const res = await callGetComments("post_1", "?cursor=garbage!!")
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data).toEqual([])
    expect(body.pagination.nextCursor).toBeNull()
    expect(prismaMock.comment.findMany).not.toHaveBeenCalled()
  })
})

describe("T079 — PATCH /social/comments/:id", () => {
  const ownComment = {
    id: "cmt_1",
    postId: "post_1",
    authorId: "usr_1",
    parentCommentId: null,
    content: "conteudo original",
    likeCount: 0,
    createdAt: new Date(Date.now() - 60_000),
  }

  beforeEach(() => {
    prismaMock.comment.findUnique.mockResolvedValue(ownComment)
    prismaMock.comment.update.mockResolvedValue({
      ...ownComment,
      content: "conteudo editado",
      author: {
        id: "usr_1",
        name: "Viewer Name",
        displayName: null,
        avatar: null,
      },
    })
  })

  it("content acima de 300 chars responde 422 antes do rate", async () => {
    const res = await callPatchComment("cmt_1", {
      content: "x".repeat(301),
    })
    const body = await res.json()

    expect(res.status).toBe(422)
    expect(body.error.code).toBe("VALIDATION_ERROR")
    expect(rateMock.enforceSocialLimit).not.toHaveBeenCalled()
  })

  it("rate esgotado devolve a resposta do limiter sem consultar o comentário", async () => {
    rateMock.enforceSocialLimit.mockResolvedValue({
      allowed: false,
      response: new Response(null, { status: 429 }),
    })

    const res = await callPatchComment("cmt_1", { content: "novo" })

    expect(res.status).toBe(429)
    expect(prismaMock.comment.findUnique).not.toHaveBeenCalled()
  })

  it("comentário inexistente responde 404 COMMENT_NOT_FOUND", async () => {
    prismaMock.comment.findUnique.mockResolvedValue(null)

    const res = await callPatchComment("cmt_missing", { content: "novo" })
    const body = await res.json()

    expect(res.status).toBe(404)
    expect(body.error.code).toBe("COMMENT_NOT_FOUND")
    expect(prismaMock.comment.update).not.toHaveBeenCalled()
  })

  it("comentário de outro autor responde 404 uniforme (anti-enumeração)", async () => {
    prismaMock.comment.findUnique.mockResolvedValue({
      ...ownComment,
      authorId: "usr_other",
    })

    const res = await callPatchComment("cmt_1", { content: "novo" })
    const body = await res.json()

    expect(res.status).toBe(404)
    expect(body.error.code).toBe("COMMENT_NOT_FOUND")
    expect(prismaMock.comment.update).not.toHaveBeenCalled()
  })

  it("fora da janela de 15min responde 403 COMMENT_EDIT_EXPIRED", async () => {
    prismaMock.comment.findUnique.mockResolvedValue({
      ...ownComment,
      createdAt: new Date(Date.now() - 16 * 60_000),
    })

    const res = await callPatchComment("cmt_1", { content: "novo" })
    const body = await res.json()

    expect(res.status).toBe(403)
    expect(body.error.code).toBe("COMMENT_EDIT_EXPIRED")
    expect(prismaMock.comment.update).not.toHaveBeenCalled()
  })

  it("comentário já removido responde 404 (não reeditável)", async () => {
    prismaMock.comment.findUnique.mockResolvedValue({
      ...ownComment,
      content: "[removido]",
    })

    const res = await callPatchComment("cmt_1", { content: "novo" })
    const body = await res.json()

    expect(res.status).toBe(404)
    expect(body.error.code).toBe("COMMENT_NOT_FOUND")
    expect(prismaMock.comment.update).not.toHaveBeenCalled()
  })

  it("edicao dentro da janela atualiza o conteúdo e devolve 200", async () => {
    const res = await callPatchComment("cmt_1", { content: "conteudo editado" })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(prismaMock.comment.update).toHaveBeenCalledWith({
      where: { id: "cmt_1" },
      data: { content: "conteudo editado" },
      include: { author: expect.anything() },
    })
    expect(body.data.comment.content).toBe("conteudo editado")
    expect(prismaMock.post.update).not.toHaveBeenCalled()
    expect(emittersMock.emitCommentAdded).not.toHaveBeenCalled()
    expect(emittersMock.emitNotification).not.toHaveBeenCalled()
    expect(res.headers.get("X-RateLimit-Remaining")).toBe("9")
    expect(rateMock.enforceSocialLimit).toHaveBeenCalledWith(
      expect.objectContaining({ limit: "comment", userId: "usr_1" }),
    )
  })
})

describe("T080 — DELETE /social/comments/:id", () => {
  const ownComment = {
    id: "cmt_1",
    postId: "post_1",
    authorId: "usr_1",
    parentCommentId: null,
    content: "conteudo original",
    likeCount: 0,
    createdAt: new Date(Date.now() - 60_000),
  }

  beforeEach(() => {
    prismaMock.comment.findUnique.mockResolvedValue(ownComment)
    prismaMock.comment.update.mockResolvedValue({
      ...ownComment,
      content: "[removido]",
    })
    prismaMock.post.update.mockResolvedValue({ commentCount: 4 })
  })

  it("comentário inexistente responde 404 COMMENT_NOT_FOUND", async () => {
    prismaMock.comment.findUnique.mockResolvedValue(null)

    const res = await callDeleteComment("cmt_missing")
    const body = await res.json()

    expect(res.status).toBe(404)
    expect(body.error.code).toBe("COMMENT_NOT_FOUND")
    expect(prismaMock.comment.update).not.toHaveBeenCalled()
  })

  it("remover comentário de outro autor responde 404 sem tocar no contador", async () => {
    prismaMock.comment.findUnique.mockResolvedValue({
      ...ownComment,
      authorId: "usr_other",
    })

    const res = await callDeleteComment("cmt_1")
    const body = await res.json()

    expect(res.status).toBe(404)
    expect(body.error.code).toBe("COMMENT_NOT_FOUND")
    expect(prismaMock.comment.update).not.toHaveBeenCalled()
    expect(prismaMock.post.update).not.toHaveBeenCalled()
  })

  it("segundo delete é idempotente (404) sem duplo decremento", async () => {
    prismaMock.comment.findUnique.mockResolvedValue({
      ...ownComment,
      content: "[removido]",
    })

    const res = await callDeleteComment("cmt_1")
    const body = await res.json()

    expect(res.status).toBe(404)
    expect(body.error.code).toBe("COMMENT_NOT_FOUND")
    expect(prismaMock.comment.update).not.toHaveBeenCalled()
    expect(prismaMock.post.update).not.toHaveBeenCalled()
  })

  it("soft delete + commentCount −1 no MESMO tx → 200", async () => {
    const res = await callDeleteComment("cmt_1")
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1)
    expect(prismaMock.comment.update).toHaveBeenCalledWith({
      where: { id: "cmt_1" },
      data: { content: "[removido]" },
    })
    expect(prismaMock.post.update).toHaveBeenCalledWith({
      where: { id: "post_1" },
      data: { commentCount: { decrement: 1 } },
    })
    expect(body.data.deleted).toBe(true)
    expect(emittersMock.emitCommentAdded).not.toHaveBeenCalled()
    expect(emittersMock.emitNotification).not.toHaveBeenCalled()
    expect(res.headers.get("X-RateLimit-Remaining")).toBe("9")
  })
})

describe("T081 — POST /social/comments/:id/like", () => {
  const liveComment = {
    id: "cmt_1",
    postId: "post_1",
    authorId: "usr_author",
    parentCommentId: null,
    content: "conteudo",
    likeCount: 0,
    createdAt: new Date("2026-10-05T09:00:00Z"),
    post: visiblePost,
  }

  beforeEach(() => {
    prismaMock.comment.findUnique.mockResolvedValue(liveComment)
    prismaMock.commentLike.findUnique.mockResolvedValue(null)
    prismaMock.commentLike.create.mockResolvedValue({ id: "cl_new" })
    prismaMock.commentLike.delete.mockResolvedValue({ id: "cl_1" })
    prismaMock.comment.update.mockResolvedValue({ likeCount: 1 })
  })

  async function callCommentLike(commentId: string) {
    const { POST } =
      await import("@/app/api/v1/social/comments/[id]/like/route")
    return POST(
      new Request(
        `http://localhost:3000/api/v1/social/comments/${commentId}/like`,
        {
          method: "POST",
        },
      ),
      { params: Promise.resolve({ id: commentId }) },
    )
  }

  it("CSRF responde 403 antes do requireAuth", async () => {
    csrfMock.enforceCsrf.mockReturnValue(
      new Response(JSON.stringify({ error: { code: "CSRF_TOKEN_INVALID" } }), {
        status: 403,
        headers: { "content-type": "application/json" },
      }),
    )

    const res = await callCommentLike("cmt_1")

    expect(res.status).toBe(403)
    expect(helpersMock.requireAuth).not.toHaveBeenCalled()
  })

  it("sessão inválida responde 401 sem tocar no banco", async () => {
    helpersMock.requireAuth.mockResolvedValue(
      new Response(JSON.stringify({ error: { code: "AUTH_TOKEN_INVALID" } }), {
        status: 401,
        headers: { "content-type": "application/json" },
      }),
    )

    const res = await callCommentLike("cmt_1")

    expect(res.status).toBe(401)
    expect(prismaMock.comment.findUnique).not.toHaveBeenCalled()
  })

  it("rate esgotado devolve a resposta do limiter antes do lookup", async () => {
    rateMock.enforceSocialLimit.mockResolvedValue({
      allowed: false,
      response: new Response(null, { status: 429 }),
    })

    const res = await callCommentLike("cmt_1")

    expect(res.status).toBe(429)
    expect(prismaMock.comment.findUnique).not.toHaveBeenCalled()
  })

  it("comentário inexistente responde 404 COMMENT_NOT_FOUND", async () => {
    prismaMock.comment.findUnique.mockResolvedValue(null)

    const res = await callCommentLike("cmt_missing")
    const body = await res.json()

    expect(res.status).toBe(404)
    expect(body.error.code).toBe("COMMENT_NOT_FOUND")
    expect(prismaMock.commentLike.create).not.toHaveBeenCalled()
  })

  it("comentário removido responde 404 uniforme", async () => {
    prismaMock.comment.findUnique.mockResolvedValue({
      ...liveComment,
      content: "[removido]",
    })

    const res = await callCommentLike("cmt_1")
    const body = await res.json()

    expect(res.status).toBe(404)
    expect(body.error.code).toBe("COMMENT_NOT_FOUND")
    expect(prismaMock.commentLike.create).not.toHaveBeenCalled()
  })

  it("post invisível responde 404 COMMENT_NOT_FOUND (mesmo predicado do GET)", async () => {
    prismaMock.comment.findUnique.mockResolvedValue({
      ...liveComment,
      post: { ...visiblePost, isHidden: true },
    })

    const res = await callCommentLike("cmt_1")
    const body = await res.json()

    expect(res.status).toBe(404)
    expect(body.error.code).toBe("COMMENT_NOT_FOUND")
    expect(prismaMock.commentLike.create).not.toHaveBeenCalled()
  })

  it("like: cria o par e incrementa Comment.likeCount na MESMA tx → 200", async () => {
    const res = await callCommentLike("cmt_1")
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1)
    expect(prismaMock.commentLike.create).toHaveBeenCalledWith({
      data: { commentId: "cmt_1", userId: "usr_1" },
    })
    expect(prismaMock.comment.update).toHaveBeenCalledWith({
      where: { id: "cmt_1" },
      data: { likeCount: { increment: 1 } },
      select: { likeCount: true },
    })
    expect(body.data).toEqual({ liked: true, likeCount: 1 })
    expect(emittersMock.emitCommentLikeUpdated).toHaveBeenCalledWith({
      commentId: "cmt_1",
      postId: "post_1",
      newCount: 1,
    })
    expect(emittersMock.emitNotification).not.toHaveBeenCalled()
    expect(versosMock.earnVersos).not.toHaveBeenCalled()
    expect(res.headers.get("X-RateLimit-Remaining")).toBe("9")
    expect(rateMock.enforceSocialLimit).toHaveBeenCalledWith(
      expect.objectContaining({ limit: "like", userId: "usr_1" }),
    )
  })

  it("unlike: apaga o par e decrementa na MESMA tx → 200", async () => {
    prismaMock.commentLike.findUnique.mockResolvedValue({ id: "cl_1" })
    prismaMock.comment.update.mockResolvedValue({ likeCount: 0 })

    const res = await callCommentLike("cmt_1")
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(prismaMock.commentLike.delete).toHaveBeenCalledWith({
      where: { commentId_userId: { commentId: "cmt_1", userId: "usr_1" } },
    })
    expect(prismaMock.comment.update).toHaveBeenCalledWith({
      where: { id: "cmt_1" },
      data: { likeCount: { decrement: 1 } },
      select: { likeCount: true },
    })
    expect(prismaMock.commentLike.create).not.toHaveBeenCalled()
    expect(body.data).toEqual({ liked: false, likeCount: 0 })
    expect(emittersMock.emitCommentLikeUpdated).toHaveBeenCalledWith({
      commentId: "cmt_1",
      postId: "post_1",
      newCount: 0,
    })
  })

  it("corrida P2002 re-ler a fonte de verdade e responde o estado real", async () => {
    prismaMock.commentLike.create.mockRejectedValue(prismaError("P2002"))
    prismaMock.commentLike.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: "cl_winner" })
    prismaMock.comment.findUnique.mockResolvedValue({
      ...liveComment,
      likeCount: 1,
    })

    const res = await callCommentLike("cmt_1")
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data).toEqual({ liked: true, likeCount: 1 })
    expect(emittersMock.emitCommentLikeUpdated).toHaveBeenCalledWith({
      commentId: "cmt_1",
      postId: "post_1",
      newCount: 1,
    })
  })

  it("corrida P2025 re-ler a fonte de verdade e responde o estado real", async () => {
    prismaMock.commentLike.findUnique
      .mockResolvedValueOnce({ id: "cl_1" }) // try block: existing like
      .mockResolvedValueOnce(null) // race branch: record was deleted
    prismaMock.commentLike.delete.mockRejectedValueOnce(prismaError("P2025"))
    prismaMock.comment.findUnique.mockResolvedValue({
      ...liveComment,
      likeCount: 0,
    })

    const res = await callCommentLike("cmt_1")
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data).toEqual({ liked: false, likeCount: 0 })
    expect(emittersMock.emitCommentLikeUpdated).toHaveBeenCalledWith({
      commentId: "cmt_1",
      postId: "post_1",
      newCount: 0,
    })
  })

  it("falha na re-query do handler de corrida devolve 500 JSON com rate.headers", async () => {
    prismaMock.commentLike.findUnique.mockResolvedValueOnce(null)
    prismaMock.commentLike.create.mockRejectedValueOnce(prismaError("P2002"))
    prismaMock.comment.findUnique.mockRejectedValueOnce(new Error("db down"))

    const res = await callCommentLike("cmt_1")
    const body = await res.json()

    expect(res.status).toBe(500)
    expect(body.error.code).toBe("INTERNAL_ERROR")
    expect(res.headers.get("X-RateLimit-Remaining")).toBeDefined()
  })

  it("a resposta só expõe contagem — RF-SOC-005 sem lista de quem curtiu", async () => {
    // Reset mocks for clean happy path
    prismaMock.commentLike.create.mockResolvedValue({ id: "cl_new" })
    prismaMock.comment.update.mockResolvedValue({ likeCount: 1 })

    const res = await callCommentLike("cmt_1")
    const body = await res.json()

    expect(Object.keys(body.data).sort()).toEqual(["likeCount", "liked"])
  })
})

describe("T082 — GET /social/notifications", () => {
  function notificationRow(index: number, baseMs = Date.now()) {
    return {
      id: `ntf_${index}`,
      userId: "usr_1",
      type: index % 2 === 0 ? "like" : "follow",
      message: `notificacao ${index}`,
      data: { postId: `post_${index}` },
      isRead: index % 3 === 0,
      createdAt: new Date(baseMs - index * 1000),
    }
  }

  beforeEach(() => {
    prismaMock.notification.findMany.mockResolvedValue([notificationRow(0)])
    prismaMock.notification.count.mockResolvedValue(3)
  })

  it("sessão inválida responde 401 sem tocar no banco", async () => {
    helpersMock.requireAuth.mockResolvedValue(
      new Response(JSON.stringify({ error: { code: "AUTH_TOKEN_INVALID" } }), {
        status: 401,
        headers: { "content-type": "application/json" },
      }),
    )

    const res = await callGetNotifications()

    expect(res.status).toBe(401)
    expect(prismaMock.notification.findMany).not.toHaveBeenCalled()
  })

  it("limit inválido responde 422 antes do banco", async () => {
    const res = await callGetNotifications("?limit=0")
    const body = await res.json()

    expect(res.status).toBe(422)
    expect(body.error.code).toBe("VALIDATION_ERROR")
    expect(prismaMock.notification.findMany).not.toHaveBeenCalled()
  })

  it("default: lote 20, ordenação desc e unreadCount no envelope", async () => {
    const res = await callGetNotifications()
    const body = await res.json()

    expect(res.status).toBe(200)
    const args = prismaMock.notification.findMany.mock.calls[0]?.[0] as {
      where: { userId: string }
      orderBy: unknown[]
      take: number
    }
    expect(args.where).toEqual({ userId: "usr_1" })
    expect(args.orderBy).toEqual([{ createdAt: "desc" }, { id: "desc" }])
    expect(args.take).toBe(21)
    expect(prismaMock.notification.count).toHaveBeenCalledWith({
      where: { userId: "usr_1", isRead: false },
    })
    expect(body.data.notifications).toHaveLength(1)
    const [first] = body.data.notifications as Array<{
      id: string
      type: string
      message: string
      isRead: boolean
      data: unknown
      createdAt: string
    }>
    expect(first?.id).toBe("ntf_0")
    expect(first?.type).toBe("like")
    expect(first?.message).toBe("notificacao 0")
    expect(first?.isRead).toBe(true)
    expect(first?.data).toEqual({ postId: "post_0" })
    expect(typeof first?.createdAt).toBe("string")
    expect(body.data.unreadCount).toBe(3)
    expect(body.pagination.nextCursor).toBeNull()
    expect(res.headers.get("Cache-Control")).toBe("private, no-store")
    expect(res.headers.get("Vary")).toBe("Authorization")
  })

  it("unreadOnly=true filtra não lidas (contrato do useUnreadCount)", async () => {
    await callGetNotifications("?unreadOnly=true")
    const args = prismaMock.notification.findMany.mock.calls[0]?.[0] as {
      where: { isRead?: boolean }
    }

    expect(args.where.isRead).toBe(false)
  })

  it("isRead=true filtra lidas (parâmetro do plano)", async () => {
    await callGetNotifications("?isRead=true")
    const args = prismaMock.notification.findMany.mock.calls[0]?.[0] as {
      where: { isRead?: boolean }
    }

    expect(args.where.isRead).toBe(true)
  })

  it("página cheia devolve nextCursor (lote 20 + cursor keyset)", async () => {
    prismaMock.notification.findMany.mockResolvedValue(
      Array.from({ length: 21 }, (_, i) => notificationRow(i)),
    )

    const res = await callGetNotifications()
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data.notifications).toHaveLength(20)
    expect(body.pagination.nextCursor).toEqual(expect.any(String))
  })

  it("cursor keyset aplica OR de (createdAt, id)", async () => {
    const cursor = Buffer.from(
      JSON.stringify({
        createdAt: Date.parse("2026-10-05T09:00:00Z"),
        id: "ntf_50",
      }),
    ).toString("base64url")

    await callGetNotifications(`?cursor=${cursor}`)
    const args = prismaMock.notification.findMany.mock.calls[0]?.[0] as {
      where: { AND?: { OR: unknown[] }[] }
    }

    expect(args.where.AND).toEqual([
      {
        OR: [
          { createdAt: { lt: new Date(Date.parse("2026-10-05T09:00:00Z")) } },
          {
            createdAt: new Date(Date.parse("2026-10-05T09:00:00Z")),
            id: { lt: "ntf_50" },
          },
        ],
      },
    ])
  })

  it("cursor inválido devolve página vazia sem consultar o banco", async () => {
    const res = await callGetNotifications("?cursor=garbage!!")
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data.notifications).toEqual([])
    expect(body.data.unreadCount).toBe(3)
    expect(body.pagination.nextCursor).toBeNull()
    expect(prismaMock.notification.findMany).not.toHaveBeenCalled()
  })
})

describe("T083 — PATCH /social/notifications/:id/read", () => {
  beforeEach(() => {
    prismaMock.notification.updateMany.mockResolvedValue({ count: 1 })
  })

  it("CSRF responde 403 antes do requireAuth", async () => {
    csrfMock.enforceCsrf.mockReturnValue(
      new Response(JSON.stringify({ error: { code: "CSRF_TOKEN_INVALID" } }), {
        status: 403,
        headers: { "content-type": "application/json" },
      }),
    )

    const res = await callPatchRead("ntf_1")

    expect(res.status).toBe(403)
    expect(helpersMock.requireAuth).not.toHaveBeenCalled()
  })

  it("sessão inválida responde 401 sem tocar no banco", async () => {
    helpersMock.requireAuth.mockResolvedValue(
      new Response(JSON.stringify({ error: { code: "AUTH_TOKEN_INVALID" } }), {
        status: 401,
        headers: { "content-type": "application/json" },
      }),
    )

    const res = await callPatchRead("ntf_1")

    expect(res.status).toBe(401)
    expect(prismaMock.notification.updateMany).not.toHaveBeenCalled()
  })

  it("notificação inexistente ou de outro usuário responde 404 uniforme", async () => {
    prismaMock.notification.updateMany.mockResolvedValue({ count: 0 })

    const res = await callPatchRead("ntf_alheia")
    const body = await res.json()

    expect(res.status).toBe(404)
    expect(body.error.code).toBe("NOTIFICATION_NOT_FOUND")
  })

  it("marca como lida restrito ao próprio usuário → 200", async () => {
    const res = await callPatchRead("ntf_1")
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(prismaMock.notification.updateMany).toHaveBeenCalledWith({
      where: { id: "ntf_1", userId: "usr_1" },
      data: { isRead: true },
    })
    expect(body.data).toEqual({ read: true })
  })

  it("já lida é idempotente → 200", async () => {
    const res = await callPatchRead("ntf_1")

    expect(res.status).toBe(200)
    expect((await res.json()).data).toEqual({ read: true })
  })
})

describe("T084 — PATCH /social/notifications/read-all", () => {
  beforeEach(() => {
    prismaMock.notification.updateMany.mockResolvedValue({ count: 3 })
  })

  it("CSRF responde 403 antes do requireAuth", async () => {
    csrfMock.enforceCsrf.mockReturnValue(
      new Response(JSON.stringify({ error: { code: "CSRF_TOKEN_INVALID" } }), {
        status: 403,
        headers: { "content-type": "application/json" },
      }),
    )

    const res = await callPatchReadAll()

    expect(res.status).toBe(403)
    expect(helpersMock.requireAuth).not.toHaveBeenCalled()
  })

  it("sessão inválida responde 401 sem tocar no banco", async () => {
    helpersMock.requireAuth.mockResolvedValue(
      new Response(JSON.stringify({ error: { code: "AUTH_TOKEN_INVALID" } }), {
        status: 401,
        headers: { "content-type": "application/json" },
      }),
    )

    const res = await callPatchReadAll()

    expect(res.status).toBe(401)
    expect(prismaMock.notification.updateMany).not.toHaveBeenCalled()
  })

  it("marca todas as não-lidas do usuário → 200 com contagem", async () => {
    const res = await callPatchReadAll()
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(prismaMock.notification.updateMany).toHaveBeenCalledWith({
      where: { userId: "usr_1", isRead: false },
      data: { isRead: true },
    })
    expect(body.data).toEqual({ updated: 3 })
  })

  it("nada a marcar devolve updated: 0 (idempotente)", async () => {
    prismaMock.notification.updateMany.mockResolvedValue({ count: 0 })

    const res = await callPatchReadAll()
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data).toEqual({ updated: 0 })
  })
})
