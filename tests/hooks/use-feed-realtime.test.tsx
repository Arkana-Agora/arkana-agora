// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { act, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const getMock = vi.hoisted(() => vi.fn())
let socketHandlers: Record<string, (payload: unknown) => void> = vi.hoisted(
  () => ({}),
)
let pollingPosts: unknown[] = vi.hoisted(() => [])

vi.mock("@/lib/api", () => ({ default: { get: getMock } }))
vi.mock("@/hooks/use-socket", () => ({
  useSocket: (handlers: Record<string, (payload: unknown) => void>) => {
    socketHandlers = handlers
    return undefined
  },
}))

import { useFeed, useFeedRealtime } from "@/hooks/use-feed"

function Probe() {
  useFeedRealtime()
  const { pendingPosts } = useFeed()
  return <div data-testid="count">{String(pendingPosts.length)}</div>
}

function renderProbe() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={client}>
      <Probe />
    </QueryClientProvider>,
  )
}

function makePost(id: string, content = `post ${id}`) {
  return {
    id,
    authorId: "u2",
    type: "text",
    content,
    imageUrls: [],
    readingId: null,
    audience: "public",
    isPinned: false,
    likeCount: 0,
    commentCount: 0,
    commentsDisabled: false,
    isHidden: false,
    createdAt: "2026-10-02T10:00:00.000Z",
    updatedAt: "2026-10-02T10:00:00.000Z",
    author: { id: "u2", name: "Autor", displayName: null, avatar: null },
  }
}

const eventOf = (postId: string) => ({
  postId,
  authorId: "u2",
  preview: "post novo",
})

function pollingCalls() {
  return getMock.mock.calls.filter((call) =>
    String(call[0]).startsWith("/social/polling/posts"),
  )
}

function detailCalls() {
  return getMock.mock.calls.filter((call) =>
    String(call[0]).startsWith("/social/posts/"),
  )
}

describe("useFeedRealtime — batch de new-post → pill (T072/Q27, revisao Q: sem N+1)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    socketHandlers = {}
    pollingPosts = []
    getMock.mockImplementation((url: string) => {
      if (url.startsWith("/social/polling/posts")) {
        return Promise.resolve({ data: { data: { posts: pollingPosts } } })
      }
      return Promise.resolve({
        data: { data: [], pagination: { nextCursor: null } },
      })
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it("evento new-post enfileira via UMA chamada de polling (sem GET por evento)", async () => {
    pollingPosts = [makePost("p9")]
    renderProbe()

    act(() => {
      socketHandlers["new-post"]?.(eventOf("p9"))
    })

    await waitFor(() =>
      expect(screen.getByTestId("count")).toHaveTextContent("1"),
    )
    expect(pollingCalls()).toHaveLength(1)
    expect(pollingCalls()[0]?.[1]).toEqual({
      params: { since: expect.any(String) },
    })
    expect(detailCalls()).toHaveLength(0)
  })

  it("rajada de 3 eventos distintos → 1 chamada de polling e 3 pills", async () => {
    pollingPosts = [makePost("p1"), makePost("p2"), makePost("p3")]
    renderProbe()

    act(() => {
      socketHandlers["new-post"]?.(eventOf("p1"))
      socketHandlers["new-post"]?.(eventOf("p2"))
      socketHandlers["new-post"]?.(eventOf("p3"))
    })

    await waitFor(() =>
      expect(screen.getByTestId("count")).toHaveTextContent("3"),
    )
    expect(pollingCalls()).toHaveLength(1)
    expect(detailCalls()).toHaveLength(0)
  })

  it("eventos repetidos do mesmo post são deduplicados", async () => {
    pollingPosts = [makePost("p9")]
    renderProbe()

    act(() => {
      socketHandlers["new-post"]?.(eventOf("p9"))
      socketHandlers["new-post"]?.(eventOf("p9"))
    })
    await waitFor(() =>
      expect(screen.getByTestId("count")).toHaveTextContent("1"),
    )
    expect(pollingCalls()).toHaveLength(1)
    expect(screen.getByTestId("count")).toHaveTextContent("1")
  })

  it("falha no polling não derruba a fila (mantém 0)", async () => {
    getMock.mockImplementation((url: string) => {
      if (url.startsWith("/social/polling/posts")) {
        return Promise.reject(new Error("500"))
      }
      return Promise.resolve({
        data: { data: [], pagination: { nextCursor: null } },
      })
    })
    renderProbe()

    act(() => {
      socketHandlers["new-post"]?.(eventOf("p404"))
    })
    await waitFor(() => expect(pollingCalls()).toHaveLength(1))
    expect(screen.getByTestId("count")).toHaveTextContent("0")
  })

  it("falha re-agenda o retry: sem novo evento o lote volta e a pill aparece (R1)", async () => {
    let calls = 0
    getMock.mockImplementation((url: string) => {
      if (url.startsWith("/social/polling/posts")) {
        calls += 1
        if (calls === 1) return Promise.reject(new Error("500"))
        return Promise.resolve({ data: { data: { posts: pollingPosts } } })
      }
      return Promise.resolve({
        data: { data: [], pagination: { nextCursor: null } },
      })
    })
    pollingPosts = [makePost("p50")]
    renderProbe()

    act(() => {
      socketHandlers["new-post"]?.(eventOf("p50"))
    })
    await waitFor(() => expect(pollingCalls()).toHaveLength(1))
    expect(screen.getByTestId("count")).toHaveTextContent("0")

    // retry re-agendado pelo próprio catch — nenhum evento novo
    await waitFor(() => expect(pollingCalls()).toHaveLength(2), {
      timeout: 6000,
    })
    await waitFor(() =>
      expect(screen.getByTestId("count")).toHaveTextContent("1"),
    )
  })

  it("cursor avança pelo serverTime (min) — não pelo relógio do cliente (R1)", async () => {
    const serverTime1 = new Date(Date.now() - 120_000).toISOString()
    pollingPosts = [makePost("p1")]
    getMock.mockImplementation((url: string) => {
      if (url.startsWith("/social/polling/posts")) {
        return Promise.resolve({
          data: { data: { posts: pollingPosts }, serverTime: serverTime1 },
        })
      }
      return Promise.resolve({
        data: { data: [], pagination: { nextCursor: null } },
      })
    })
    renderProbe()

    act(() => {
      socketHandlers["new-post"]?.(eventOf("p1"))
    })
    await waitFor(() =>
      expect(screen.getByTestId("count")).toHaveTextContent("1"),
    )
    expect(pollingCalls()).toHaveLength(1)

    act(() => {
      socketHandlers["new-post"]?.(eventOf("p2"))
    })
    await waitFor(() => expect(pollingCalls()).toHaveLength(2))
    const since2 = (pollingCalls()[1]?.[1] as { params: { since: string } })
      .params.since
    expect(since2).toBe(serverTime1)
  })
})
