import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import FeedPage from "@/app/(app)/feed/page"
import { emitPendingPost } from "@/hooks/use-feed"

vi.mock("@/lib/api", () => ({
  default: { get: vi.fn(), post: vi.fn() },
}))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock("next-auth/react", () => ({
  getSession: vi.fn().mockResolvedValue(null),
  useSession: vi.fn(() => ({ data: null })),
}))

import api from "@/lib/api"

const getMock = vi.mocked(api.get)

const POST = {
  id: "p1",
  authorId: "u1",
  content: "ola feed",
  author: {
    id: "u1",
    name: "Ana",
    username: "ana",
    avatar: null,
    role: "READER",
    isBanned: false,
    isActive: true,
    privacy: "public",
  },
  audience: "public",
  type: "text",
  commentsDisabled: false,
  readingId: null,
  imageUrls: [],
  likeCount: 0,
  commentCount: 0,
  liked: false,
  shareCount: 0,
  createdAt: new Date().toISOString(),
}

function pageOf(posts: (typeof POST)[]) {
  return { data: { data: posts, pagination: { nextCursor: null } } }
}

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={client}>
      <FeedPage />
    </QueryClientProvider>,
  )
}

// IntersectionObserver capturado para disparar o sentinel manualmente.
const observers: Array<(entries: Array<{ isIntersecting: boolean }>) => void> =
  []
vi.stubGlobal(
  "IntersectionObserver",
  class {
    cb: (entries: Array<{ isIntersecting: boolean }>) => void
    constructor(cb: (entries: Array<{ isIntersecting: boolean }>) => void) {
      this.cb = cb
      observers.push(cb)
    }
    observe() {}
    disconnect() {}
  },
)

describe("FeedPage (T061/US-022)", () => {
  beforeEach(() => {
    observers.length = 0
    getMock.mockReset()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it("mostra skeleton durante o carregamento", () => {
    getMock.mockReturnValue(new Promise(() => {}))
    renderPage()
    expect(screen.getByTestId("feed-skeleton")).toBeTruthy()
  })

  it("renderiza PostCards e a barra de criacao rapida", async () => {
    getMock.mockResolvedValue(pageOf([POST]))
    renderPage()
    expect(await screen.findByTestId("post-p1")).toBeTruthy()
    expect(
      screen.getByRole("button", { name: /o que voce quer compartilhar/i }),
    ).toBeTruthy()
  })

  it("estado vazio com CTA que abre o composer", async () => {
    getMock.mockResolvedValue(pageOf([]))
    renderPage()
    const cta = await screen.findByRole("button", { name: /criar publicacao/i })
    fireEvent.click(cta)
    expect(screen.getByRole("dialog")).toBeTruthy()
  })

  it("erro de rede mostra mensagem e botao tentar novamente", async () => {
    getMock.mockRejectedValueOnce(new Error("offline"))
    renderPage()
    const retry = await screen.findByRole("button", {
      name: /tentar novamente/i,
    })
    getMock.mockResolvedValue(pageOf([POST]))
    fireEvent.click(retry)
    expect(await screen.findByTestId("post-p1")).toBeTruthy()
  })

  // Review Phase 2: erro num refetch (pull-to-refresh) com dados já
  // carregados não pode trocar a lista pelo painel de erro — mantém os
  // posts e mostra um banner inline de "atualizar".
  it("erro no refresh com dados carregados mantém a lista e mostra banner", async () => {
    getMock.mockResolvedValue(pageOf([POST]))
    renderPage()
    await screen.findByTestId("post-p1")

    getMock.mockRejectedValueOnce(new Error("offline"))
    const el = screen.getByTestId("feed-container")
    fireEvent.touchStart(el, { touches: [{ clientY: 0 }] })
    fireEvent.touchMove(el, { touches: [{ clientY: 120 }] })
    fireEvent.touchEnd(el)

    const banner = await screen.findByRole("alert")
    expect(banner.textContent).toMatch(/atualizar o feed/i)
    expect(screen.getByTestId("post-p1")).toBeTruthy()
  })

  it("pagina seguinte ao cruzar o sentinel (infinite scroll)", async () => {
    getMock.mockResolvedValue(pageOf([]))
    // first page returns one post + nextCursor so hasNextPage=true
    getMock.mockResolvedValueOnce({
      data: {
        data: [POST],
        pagination: { nextCursor: "c1" },
      },
    })
    renderPage()
    await screen.findByTestId("post-p1")
    expect(observers.length).toBeGreaterThan(0)
    act(() => {
      observers[0]?.([{ isIntersecting: true }])
    })
    await waitFor(() =>
      expect(getMock.mock.calls.length).toBeGreaterThanOrEqual(2),
    )
    expect(getMock.mock.calls[1]?.[1]).toEqual({ params: { cursor: "c1" } })
  })

  it("pull-to-refresh refaz o fetch", async () => {
    getMock.mockResolvedValue(pageOf([POST]))
    renderPage()
    await screen.findByTestId("post-p1")
    const el = screen.getByTestId("feed-container")
    fireEvent.touchStart(el, { touches: [{ clientY: 0 }] })
    fireEvent.touchMove(el, { touches: [{ clientY: 120 }] })
    fireEvent.touchEnd(el)
    await waitFor(() =>
      expect(getMock.mock.calls.length).toBeGreaterThanOrEqual(2),
    )
  })

  it("pill de novos posts insere com dedup ao clicar (Q27)", async () => {
    getMock.mockResolvedValue(pageOf([POST]))
    renderPage()
    await screen.findByTestId("post-p1")
    act(() => {
      emitPendingPost({
        id: "p2",
        authorId: "u1",
        content: "novo post",
        author: POST.author,
        audience: "public",
        type: "text",
        commentsDisabled: false,
        readingId: null,
        imageUrls: [],
        likeCount: 0,
        commentCount: 0,
        liked: false,
        shareCount: 0,
        createdAt: new Date().toISOString(),
      })
    })
    const pill = await screen.findByRole("button", { name: /1 novo post/i })
    fireEvent.click(pill)
    expect(await screen.findByTestId("post-p2")).toBeTruthy()
    // dedup: não duplica se emitir de novo
    act(() => {
      emitPendingPost({
        id: "p2",
        authorId: "u1",
        content: "novo post",
        author: POST.author,
        audience: "public",
        type: "text",
        commentsDisabled: false,
        readingId: null,
        imageUrls: [],
        likeCount: 0,
        commentCount: 0,
        liked: false,
        shareCount: 0,
        createdAt: new Date().toISOString(),
      })
    })
    await waitFor(() =>
      expect(screen.getAllByTestId("post-p2")).toHaveLength(1),
    )
  })
})
