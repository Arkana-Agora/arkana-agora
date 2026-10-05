// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest"
import { act, renderHook, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { ReactNode } from "react"

vi.mock("@/lib/api", () => ({
  default: { get: vi.fn(), post: vi.fn() },
}))

async function importModule() {
  return await import("@/hooks/use-feed")
}

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )
  }
}

function basePost(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    authorId: "u2",
    type: "text",
    content: `conteudo ${id}`,
    imageUrls: [],
    readingId: null,
    audience: "public",
    isPinned: false,
    likeCount: 0,
    commentCount: 0,
    commentsDisabled: false,
    isHidden: false,
    createdAt: "2026-09-30T10:00:00.000Z",
    updatedAt: "2026-09-30T10:00:00.000Z",
    author: {
      id: "u2",
      name: "Autor",
      displayName: null,
      avatar: null,
      profile: { privacy: { profileVisibility: "public" } },
    },
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe("useFeed (T062/Q27)", () => {
  it("pagina pelo nextCursor no envelope { data, pagination }", async () => {
    const { default: authApi } = await import("@/lib/api")
    vi.mocked(authApi.get)
      .mockResolvedValueOnce({
        data: { data: [basePost("p1")], pagination: { nextCursor: "c2" } },
      } as never)
      .mockResolvedValueOnce({
        data: { data: [basePost("p2")], pagination: { nextCursor: null } },
      } as never)

    const { useFeed } = await importModule()
    const { result } = renderHook(() => useFeed(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.pages[0]?.posts[0]?.id).toBe("p1")
    expect(result.current.hasNextPage).toBe(true)

    await result.current.fetchNextPage()
    await waitFor(() => expect(result.current.data?.pages).toHaveLength(2))
    expect(result.current.hasNextPage).toBe(false)
    expect(authApi.get).toHaveBeenLastCalledWith("/social/feed", {
      params: { cursor: "c2" },
    })
  })

  it("cursor inicial compõe a queryKey (sem colisão de cache)", async () => {
    const { default: authApi } = await import("@/lib/api")
    vi.mocked(authApi.get).mockResolvedValue({
      data: { data: [], pagination: { nextCursor: null } },
    } as never)

    const { useFeed } = await importModule()
    const { rerender } = renderHook(
      ({ cursor }: { cursor: string | null }) => useFeed(cursor),
      { wrapper: createWrapper(), initialProps: { cursor: "c-a" } },
    )

    await waitFor(() => expect(authApi.get).toHaveBeenCalledTimes(1))
    rerender({ cursor: "c-b" })
    await waitFor(() => expect(authApi.get).toHaveBeenCalledTimes(2))
  })

  it("payload inválido → isError", async () => {
    const { default: authApi } = await import("@/lib/api")
    vi.mocked(authApi.get).mockResolvedValue({ data: { nope: true } } as never)

    const { useFeed } = await importModule()
    const { result } = renderHook(() => useFeed(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isError).toBe(true))
  })

  it("emitPendingPost acumula com dedup; flushPending insere na primeira página e limpa", async () => {
    const { default: authApi } = await import("@/lib/api")
    vi.mocked(authApi.get).mockResolvedValue({
      data: { data: [basePost("p2")], pagination: { nextCursor: null } },
    } as never)

    const { useFeed, emitPendingPost } = await importModule()
    const { result } = renderHook(() => useFeed(), {
      wrapper: createWrapper(),
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.pendingPosts).toHaveLength(0)

    const novo = basePost("p1") as never
    act(() => {
      emitPendingPost(novo)
      emitPendingPost(novo)
    })
    expect(result.current.pendingPosts).toHaveLength(1)
    expect(result.current.pendingPosts[0]?.id).toBe("p1")

    act(() => {
      result.current.flushPending()
    })
    await waitFor(() => expect(result.current.pendingPosts).toHaveLength(0))
    const posts = result.current.data?.pages[0]?.posts ?? []
    expect(posts.map((p) => p.id)).toEqual(["p1", "p2"])
  })

  it("fila de pendentes tem cap de 50 - mantem os mais novos (revisao T)", async () => {
    const { default: authApi } = await import("@/lib/api")
    vi.mocked(authApi.get).mockResolvedValue({
      data: { data: [], pagination: { nextCursor: null } },
    } as never)

    const { useFeed, emitPendingPost } = await importModule()
    const { result } = renderHook(() => useFeed(), {
      wrapper: createWrapper(),
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    act(() => {
      for (let i = 0; i < 60; i += 1) {
        emitPendingPost(basePost(`p${i}`) as never)
      }
    })
    expect(result.current.pendingPosts).toHaveLength(50)
    expect(result.current.pendingPosts[0]?.id).toBe("p59")
    expect(result.current.pendingPosts[49]?.id).toBe("p10")
  })
  it("flushPending antes de os dados carregarem mantém os pendentes (não descarta)", async () => {
    const { default: authApi } = await import("@/lib/api")
    let resolveFeed!: (value: unknown) => void
    vi.mocked(authApi.get).mockReturnValue(
      new Promise((resolve) => {
        resolveFeed = resolve
      }) as never,
    )

    const { useFeed, emitPendingPost } = await importModule()
    const { result } = renderHook(() => useFeed(), {
      wrapper: createWrapper(),
    })

    act(() => {
      emitPendingPost(basePost("px") as never)
    })
    expect(result.current.pendingPosts).toHaveLength(1)

    act(() => {
      result.current.flushPending()
    })
    expect(result.current.pendingPosts).toHaveLength(1)

    resolveFeed({
      data: { data: [basePost("p9")], pagination: { nextCursor: null } },
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.pendingPosts).toHaveLength(1)
  })

  it("flushPending deduplica contra TODAS as páginas carregadas (não só a primeira)", async () => {
    const { default: authApi } = await import("@/lib/api")
    vi.mocked(authApi.get)
      .mockResolvedValueOnce({
        data: { data: [basePost("p1")], pagination: { nextCursor: "c2" } },
      } as never)
      .mockResolvedValueOnce({
        data: { data: [basePost("p2")], pagination: { nextCursor: null } },
      } as never)

    const { useFeed, emitPendingPost } = await importModule()
    const { result } = renderHook(() => useFeed(), {
      wrapper: createWrapper(),
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    await result.current.fetchNextPage()
    await waitFor(() => expect(result.current.data?.pages).toHaveLength(2))

    // p2 já está visível na página 2: não pode ser reinserida no topo da 1
    act(() => {
      emitPendingPost(basePost("p2") as never)
    })
    act(() => {
      result.current.flushPending()
    })
    await waitFor(() => expect(result.current.pendingPosts).toHaveLength(0))

    const firstPage = result.current.data?.pages[0]?.posts ?? []
    expect(firstPage.map((post) => post.id)).toEqual(["p1"])
    const allIds = (result.current.data?.pages ?? []).flatMap((page) =>
      page.posts.map((post) => post.id),
    )
    expect(allIds.filter((id) => id === "p2")).toHaveLength(1)
  })

  it("feedPostSchema rejeita type/audience fora do contrato e datetime inválido", async () => {
    const { feedPostSchema } = await importModule()

    expect(
      feedPostSchema.safeParse(basePost("px", { type: "video" })).success,
    ).toBe(false)
    expect(
      feedPostSchema.safeParse(basePost("px", { audience: "secret" })).success,
    ).toBe(false)
    expect(
      feedPostSchema.safeParse(basePost("px", { createdAt: "30/09/2026" }))
        .success,
    ).toBe(false)
    expect(feedPostSchema.safeParse(basePost("px")).success).toBe(true)
  })
})

describe("useCreatePost (T062)", () => {
  it("POST /social/posts com o body e invalida o feed", async () => {
    const { default: authApi } = await import("@/lib/api")
    vi.mocked(authApi.get).mockResolvedValue({
      data: { data: [basePost("p1")], pagination: { nextCursor: null } },
    } as never)
    vi.mocked(authApi.post).mockResolvedValue({
      data: { data: { post: basePost("p_new") } },
    } as never)

    const { useFeed, useCreatePost } = await importModule()
    const { result } = renderHook(
      () => ({ feed: useFeed(), create: useCreatePost() }),
      { wrapper: createWrapper() },
    )
    await waitFor(() => expect(result.current.feed.isSuccess).toBe(true))
    vi.mocked(authApi.get).mockClear()

    act(() => {
      result.current.create.mutate({
        type: "text",
        content: "ola feed",
        audience: "public",
      })
    })
    await waitFor(() => expect(result.current.create.isSuccess).toBe(true))

    expect(authApi.post).toHaveBeenCalledWith("/social/posts", {
      type: "text",
      content: "ola feed",
      audience: "public",
    })
    await waitFor(() => expect(authApi.get).toHaveBeenCalledTimes(1))
    expect(authApi.get).toHaveBeenCalledWith("/social/feed", {
      params: {},
    })
  })
})

describe("useTrending (T062)", () => {
  it("lê { data: { posts } }", async () => {
    const { default: authApi } = await import("@/lib/api")
    vi.mocked(authApi.get).mockResolvedValue({
      data: { data: { posts: [basePost("t1"), basePost("t2")] } },
    } as never)

    const { useTrending } = await importModule()
    const { result } = renderHook(() => useTrending(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.map((p) => p.id)).toEqual(["t1", "t2"])
    expect(authApi.get).toHaveBeenCalledWith("/social/explore/trending")
  })
})

describe("useExploreSuggestions (T062)", () => {
  it("lê { data: { users } }", async () => {
    const { default: authApi } = await import("@/lib/api")
    vi.mocked(authApi.get).mockResolvedValue({
      data: {
        data: {
          users: [
            {
              id: "u3",
              name: "Ana",
              username: "ana",
              avatar: null,
              role: "USER",
              followersCount: 12,
            },
          ],
        },
      },
    } as never)

    const { useExploreSuggestions } = await importModule()
    const { result } = renderHook(() => useExploreSuggestions(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.[0]?.id).toBe("u3")
    expect(authApi.get).toHaveBeenCalledWith("/social/explore/suggestions")
  })
})

describe("useSearch (T062)", () => {
  it("q com menos de 2 chars não busca; q>=2 busca com { params: { q } }", async () => {
    const { default: authApi } = await import("@/lib/api")
    vi.mocked(authApi.get).mockResolvedValue({
      data: { data: { posts: [], users: [], hashtags: [] } },
    } as never)

    const { useSearch } = await importModule()
    const { result, rerender } = renderHook(
      ({ q }: { q: string }) => useSearch(q),
      { wrapper: createWrapper(), initialProps: { q: "a" } },
    )

    await act(async () => {})
    expect(authApi.get).not.toHaveBeenCalled()

    rerender({ q: "ana" })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(authApi.get).toHaveBeenCalledWith("/social/search", {
      params: { q: "ana" },
    })
  })

  it("lê { data: { posts, users, hashtags } }", async () => {
    const { default: authApi } = await import("@/lib/api")
    vi.mocked(authApi.get).mockResolvedValue({
      data: {
        data: {
          posts: [basePost("s1")],
          users: [
            {
              id: "u4",
              name: "Bia",
              username: "bia",
              avatar: null,
              role: "PROFESSIONAL",
              followersCount: 7,
            },
          ],
          hashtags: [{ tag: "amor", count: 3 }],
        },
      },
    } as never)

    const { useSearch } = await importModule()
    const { result } = renderHook(() => useSearch("amor"), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.posts[0]?.id).toBe("s1")
    expect(result.current.data?.users[0]?.id).toBe("u4")
    expect(result.current.data?.hashtags[0]).toEqual({ tag: "amor", count: 3 })
  })
})
