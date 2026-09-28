import { beforeEach, describe, expect, it, vi } from "vitest"

const prismaMock = vi.hoisted(() => ({
  follow: { findMany: vi.fn() },
  post: { findMany: vi.fn() },
  postLike: { findMany: vi.fn() },
  comment: { findMany: vi.fn() },
}))

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }))

import type { FeedPost } from "@/lib/social/feed-algorithm"
import {
  applyPinnedCap,
  decodeFeedCursor,
  encodeFeedCursor,
  getFeed,
  rankFeedPosts,
} from "@/lib/social/feed-algorithm"

function makePost(id: string, overrides: Partial<FeedPost> = {}): FeedPost {
  const createdAt = overrides.createdAt ?? new Date("2026-09-26T10:00:00Z")
  return {
    id,
    authorId: "author_1",
    type: "text",
    content: "conteudo",
    imageUrls: [],
    readingId: null,
    audience: "public",
    isPinned: false,
    likeCount: 0,
    commentCount: 0,
    commentsDisabled: false,
    isHidden: false,
    updatedAt: createdAt,
    author: {
      id: "author_1",
      name: "Autor",
      displayName: "Autor",
      avatar: null,
      profile: null,
    },
    ...overrides,
    createdAt,
  }
}

function emptySignals() {
  prismaMock.postLike.findMany.mockResolvedValue([])
  prismaMock.comment.findMany.mockResolvedValue([])
}

/**
 * Mock que emula o findMany real: ordena createdAt desc/id desc, aplica o
 * keyset do cursor (branches `lt`, `eq+id lt`, `id in`) e respeita `take`.
 */
function paginateFeedSource(all: FeedPost[]) {
  prismaMock.post.findMany.mockImplementation(
    async (args: {
      where?: { AND?: { OR?: Record<string, unknown>[] }[] }
      take?: number
    }) => {
      let list = [...all]
      const branches = args.where?.AND?.[0]?.OR ?? []
      if (branches.length > 0) {
        list = list.filter((post) =>
          branches.some((branch) => {
            const b = branch as {
              createdAt?: { lt?: Date } | Date
              id?: { in?: string[] } | { lt?: string }
            }
            if (b.id && "in" in b.id && Array.isArray(b.id.in)) {
              return b.id.in.includes(post.id)
            }
            if (
              b.createdAt &&
              !(b.createdAt instanceof Date) &&
              b.createdAt.lt instanceof Date
            ) {
              return post.createdAt.getTime() < b.createdAt.lt.getTime()
            }
            if (
              b.createdAt instanceof Date &&
              b.id &&
              "lt" in b.id &&
              typeof b.id.lt === "string"
            ) {
              return (
                post.createdAt.getTime() === b.createdAt.getTime() &&
                post.id < b.id.lt
              )
            }
            return false
          }),
        )
      }
      list.sort(
        (a, b) =>
          b.createdAt.getTime() - a.createdAt.getTime() ||
          b.id.localeCompare(a.id),
      )
      return list.slice(0, args.take ?? list.length)
    },
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  prismaMock.follow.findMany.mockResolvedValue([])
  prismaMock.post.findMany.mockResolvedValue([])
  emptySignals()
})

describe("cursor (T026)", () => {
  it("roundtrip encode/decode", () => {
    const cursor = { createdAt: 1727340000000, id: "abc123" }
    expect(decodeFeedCursor(encodeFeedCursor(cursor))).toEqual(cursor)
  })

  it("roundtrip preserva include de pinned adiados", () => {
    const cursor = { createdAt: 1727340000000, id: "abc123", include: ["p1"] }
    expect(decodeFeedCursor(encodeFeedCursor(cursor))).toEqual(cursor)
  })

  it("encode omit include vazio (formato compacto)", () => {
    const raw = encodeFeedCursor({
      createdAt: 1,
      id: "a",
      include: [],
    })
    expect(JSON.parse(Buffer.from(raw, "base64url").toString("utf8"))).toEqual({
      createdAt: 1,
      id: "a",
    })
  })

  it("decode rejeita string inválida ou shape errado", () => {
    expect(decodeFeedCursor("!!!nao-e-base64!!!")).toBeNull()
    expect(
      decodeFeedCursor(
        Buffer.from(JSON.stringify({ foo: 1 })).toString("base64url"),
      ),
    ).toBeNull()
  })

  it("decode rejeita createdAt não-finito/negativo/fora de faixa e id vazio", () => {
    const encode = (value: unknown, id: unknown = "x") =>
      Buffer.from(JSON.stringify({ createdAt: value, id })).toString(
        "base64url",
      )
    expect(decodeFeedCursor(encode(-1))).toBeNull()
    expect(decodeFeedCursor(encode(9e15))).toBeNull()
    expect(decodeFeedCursor(encode(1727340000000, ""))).toBeNull()
    expect(decodeFeedCursor(encode(null))).toBeNull()
  })

  it("decode ignora include malformado (mantém cursor base)", () => {
    const raw = Buffer.from(
      JSON.stringify({ createdAt: 1, id: "a", include: "nao-e-array" }),
    ).toString("base64url")
    expect(decodeFeedCursor(raw)).toEqual({ createdAt: 1, id: "a" })
  })
})

describe("rankFeedPosts (S2-5: 4 níveis)", () => {
  const ctx = (
    engagement: Record<string, number> = {},
    interacted: string[] = [],
  ) => ({
    engagementByPost: new Map(Object.entries(engagement)),
    interactedPostIds: new Set(interacted),
  })

  it("tier 1: isPinned antes de não-pinned", () => {
    const a = makePost("a")
    const pinned = makePost("b", {
      isPinned: true,
      createdAt: new Date("2026-09-20T00:00:00Z"),
    })
    const ranked = rankFeedPosts([a, pinned], ctx())
    expect(ranked[0]!.id).toBe("b")
  })

  it("tier 2: engagement das últimas 2h (likes + comments×2)", () => {
    const a = makePost("a")
    const b = makePost("b")
    const ranked = rankFeedPosts([a, b], ctx({ b: 5, a: 2 }))
    expect(ranked[0]!.id).toBe("b")
  })

  it("tier 3: createdAt desc com engagement igual", () => {
    const old = makePost("old", { createdAt: new Date("2026-09-20T00:00:00Z") })
    const fresh = makePost("fresh", {
      createdAt: new Date("2026-09-26T00:00:00Z"),
    })
    const ranked = rankFeedPosts([old, fresh], ctx({ old: 3, fresh: 3 }))
    expect(ranked[0]!.id).toBe("fresh")
  })

  it("tier 4: desempate por interação prévia do viewer", () => {
    const a = makePost("a")
    const b = makePost("b")
    const ranked = rankFeedPosts([a, b], ctx({}, ["b"]))
    expect(ranked[0]!.id).toBe("b")
  })
})

describe("applyPinnedCap (tier 1: máx 1/10)", () => {
  it("mantém só o primeiro pinned na página e reporta os adiados", () => {
    const posts = [
      makePost("p1", { isPinned: true }),
      makePost("p2", { isPinned: true }),
      makePost("n1"),
      makePost("n2"),
    ]
    const result = applyPinnedCap(posts, 2)
    expect(result.page.map((p) => p.id)).toEqual(["p1", "n1"])
    expect(result.dropped.map((p) => p.id)).toEqual(["p2", "n2"])
  })

  it("preenche a página quando não há pinned e reporta overflow", () => {
    const posts = [makePost("n1"), makePost("n2"), makePost("n3")]
    const result = applyPinnedCap(posts, 2)
    expect(result.page.map((p) => p.id)).toEqual(["n1", "n2"])
    expect(result.dropped.map((p) => p.id)).toEqual(["n3"])
  })
})

describe("getFeed (T026)", () => {
  it("0 following → fallback explore: só públicos, não-hidden", async () => {
    prismaMock.post.findMany.mockResolvedValue([
      makePost("p1", { createdAt: new Date("2026-09-26T11:00:00Z") }),
      makePost("p2", { createdAt: new Date("2026-09-26T10:00:00Z") }),
    ])

    const page = await getFeed("viewer_1")

    const where = prismaMock.post.findMany.mock.calls[0]![0].where
    expect(where.isHidden).toBe(false)
    expect(where.OR).toEqual([
      { audience: "public" },
      { audience: "followers", authorId: { in: [] } },
    ])
    expect(page.posts.map((p) => p.id)).toEqual(["p1", "p2"])
    expect(page.nextCursor).toBeNull() // 2 candidatos < take (10)
  })

  it("inclui followers-posts de quem o viewer segue", async () => {
    prismaMock.follow.findMany.mockResolvedValue([
      { followingId: "author_2" },
      { followingId: "author_3" },
    ])
    prismaMock.post.findMany.mockResolvedValue([makePost("p1")])

    await getFeed("viewer_1")

    const where = prismaMock.post.findMany.mock.calls[0]![0].where
    expect(where.OR).toEqual([
      { audience: "public" },
      { audience: "followers", authorId: { in: ["author_2", "author_3"] } },
    ])
  })

  it("S2-15: descarta post de perfil PRIVATE de quem não é seguido", async () => {
    prismaMock.post.findMany.mockResolvedValue([
      makePost("privado", {
        authorId: "author_priv",
        author: {
          id: "author_priv",
          name: "Privada",
          displayName: "Privada",
          avatar: null,
          profile: { privacy: { profileVisibility: "PRIVATE" } },
        },
      }),
      makePost("publico"),
    ])

    const page = await getFeed("viewer_1")

    expect(page.posts.map((p) => p.id)).toEqual(["publico"])
  })

  it("S2-15: mantém post PRIVATE de quem o viewer segue", async () => {
    prismaMock.follow.findMany.mockResolvedValue([
      { followingId: "author_priv" },
    ])
    prismaMock.post.findMany.mockResolvedValue([
      makePost("privado", {
        authorId: "author_priv",
        author: {
          id: "author_priv",
          name: "Privada",
          displayName: "Privada",
          avatar: null,
          profile: { privacy: { profileVisibility: "PRIVATE" } },
        },
      }),
    ])

    const page = await getFeed("viewer_1")

    expect(page.posts.map((p) => p.id)).toEqual(["privado"])
  })

  it("cursor vira keyset (createdAt, id) no where", async () => {
    const cursor = encodeFeedCursor({ createdAt: 1727340000000, id: "abc" })
    prismaMock.post.findMany.mockResolvedValue([makePost("p1")])

    await getFeed("viewer_1", cursor, 10)

    const where = prismaMock.post.findMany.mock.calls[0]![0].where
    expect(where.AND).toEqual([
      {
        OR: [
          { createdAt: { lt: new Date(1727340000000) } },
          { createdAt: new Date(1727340000000), id: { lt: "abc" } },
        ],
      },
    ])
  })

  it("engagement 2h + interação prévia alimentam o ranking", async () => {
    const t = new Date("2026-09-26T12:00:00Z")
    prismaMock.post.findMany.mockResolvedValue([
      makePost("calmo", { createdAt: t }),
      makePost("quente", { createdAt: new Date("2026-09-26T11:00:00Z") }),
    ])
    prismaMock.postLike.findMany.mockImplementation(
      async (args: { where: Record<string, unknown> }) => {
        if (args.where.userId) return [{ postId: "quente" }]
        return [{ postId: "quente" }, { postId: "quente" }]
      },
    )
    prismaMock.comment.findMany.mockImplementation(
      async (args: { where: Record<string, unknown> }) => {
        if (args.where.authorId) return [{ postId: "calmo" }]
        return [{ postId: "quente" }]
      },
    )

    const page = await getFeed("viewer_1")

    // engagement: quente=2+2+2=6 > calmo=0 → primeiro, mesmo mais antigo
    expect(page.posts[0]!.id).toBe("quente")
    expect(page.posts[1]!.id).toBe("calmo")
  })

  it("pinned máximo 1 por página de 10", async () => {
    const posts = [
      makePost("pin1", {
        isPinned: true,
        createdAt: new Date("2026-09-26T10:00:09Z"),
      }),
      makePost("pin2", {
        isPinned: true,
        createdAt: new Date("2026-09-26T10:00:08Z"),
      }),
      ...Array.from({ length: 12 }, (_, i) =>
        makePost(`n${i}`, {
          createdAt: new Date(Date.UTC(2026, 8, 26, 9, 0, i)),
        }),
      ),
    ]
    paginateFeedSource(posts) // janela real = take(10)

    const page = await getFeed("viewer_1")

    const pinnedInPage = page.posts.filter((p) => p.isPinned)
    expect(pinnedInPage).toHaveLength(1)
    expect(pinnedInPage[0]!.id).toBe("pin1")
  })

  it("emite nextCursor com o menor exibido quando há candidatos excedentes", async () => {
    const posts = Array.from({ length: 30 }, (_, i) =>
      makePost(`p${i}`, {
        createdAt: new Date(Date.UTC(2026, 8, 26, 8, 0, i)),
      }),
    )
    paginateFeedSource(posts)

    const page = await getFeed("viewer_1")

    expect(page.posts).toHaveLength(10)
    expect(page.nextCursor).not.toBeNull()
    const decoded = decodeFeedCursor(page.nextCursor!)
    expect(decoded).not.toBeNull()
    expect(decoded!.id).toBe("p20") // menor (createdAt, id) exibido
    expect(decoded!.include).toBeUndefined()
    // p0..p19 permanecem alcançáveis: janela exata = página, nada foi lido
    // e deixado de fora (regressão do CRIT de paginação com multiplicador)
  })

  it("paginação é lossless: 30 posts em páginas sem repetir nem pular", async () => {
    const all = Array.from({ length: 30 }, (_, i) =>
      makePost(`p${String(i).padStart(2, "0")}`, {
        createdAt: new Date(Date.UTC(2026, 8, 26, 8, 0, i)),
      }),
    )
    paginateFeedSource(all)

    const seen: string[] = []
    let pageCursor: string | undefined
    for (let pageCount = 0; pageCount < 10; pageCount++) {
      const result = await getFeed("viewer_1", pageCursor)
      seen.push(...result.posts.map((p) => p.id))
      pageCursor = result.nextCursor ?? undefined
      if (!pageCursor) break
    }

    expect(seen).toHaveLength(30)
    expect(new Set(seen).size).toBe(30)
  })

  it("pinned adiado viaja no cursor (include) e é servido na página seguinte", async () => {
    const older = Array.from({ length: 9 }, (_, i) =>
      makePost(`n${i}`, {
        createdAt: new Date(Date.UTC(2026, 8, 26, 9, 0, i)),
      }),
    )
    const pinB = makePost("pin_b", {
      isPinned: true,
      createdAt: new Date(Date.UTC(2026, 8, 26, 10, 0, 0)),
    })
    const pinA = makePost("pin_a", {
      isPinned: true,
      createdAt: new Date(Date.UTC(2026, 8, 26, 10, 0, 1)),
    })
    paginateFeedSource([...older, pinB, pinA])

    const page1 = await getFeed("viewer_1")

    expect(page1.posts.filter((p) => p.isPinned).map((p) => p.id)).toEqual([
      "pin_a",
    ])
    const decoded1 = decodeFeedCursor(page1.nextCursor!)
    expect(decoded1).not.toBeNull()
    expect(decoded1!.include).toEqual(["pin_b"])

    const page2 = await getFeed("viewer_1", page1.nextCursor!)

    expect(page2.posts.map((p) => p.id)).toEqual(["pin_b", "n0"])
    expect(page2.nextCursor).toBeNull()
  })

  it("cursor inválido → página vazia sem próximo cursor (não reinicia no topo)", async () => {
    paginateFeedSource([
      makePost("p1", { createdAt: new Date("2026-09-26T10:00:00Z") }),
    ])

    const page = await getFeed("viewer_1", "!!!cursor-invalido!!!")

    expect(page.posts).toEqual([])
    expect(page.nextCursor).toBeNull()
  })

  it("filtra posts de autores banidos ou soft-deleted (contrato do where)", async () => {
    await getFeed("viewer_1")

    const firstCallWhere = prismaMock.post.findMany.mock.calls[0]![0].where
    expect(firstCallWhere.author).toEqual({
      isBanned: false,
      deletedAt: null,
    })
  })
})
