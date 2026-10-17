// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import type { ReactNode } from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

vi.mock("next-auth/react", () => ({
  getSession: vi.fn().mockResolvedValue(null),
  useSession: vi.fn(() => ({ data: null })),
}))

const getMock = vi.hoisted(() => vi.fn())
const postMock = vi.hoisted(() => vi.fn())

vi.mock("@/lib/api", () => ({ default: { get: getMock, post: postMock } }))
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }))

import { PostCard } from "@/components/social/post-card"
import type { FeedPost } from "@/hooks/use-feed"
import { useSocialStore } from "@/stores/social-store"

function makePost(overrides: Record<string, unknown> = {}): FeedPost {
  return {
    id: "p1",
    authorId: "u2",
    type: "text",
    content: "Bom dia @ana, lindo #tarot",
    imageUrls: [],
    readingId: null,
    audience: "public",
    isPinned: false,
    likeCount: 3,
    commentCount: 1,
    commentsDisabled: false,
    isHidden: false,
    createdAt: new Date(Date.now() - 5 * 60_000).toISOString(),
    updatedAt: new Date().toISOString(),
    author: {
      id: "u2",
      name: "Ana Silva",
      displayName: "Ana",
      avatar: "https://r2.test/avatar.png",
      profile: { privacy: { profileVisibility: "public" } },
    },
    ...overrides,
  } as FeedPost
}

beforeEach(() => {
  cleanup()
  vi.clearAllMocks()
  useSocialStore.setState(useSocialStore.getInitialState())
  getMock.mockResolvedValue({
    data: { data: [], pagination: { nextCursor: null } },
  })
  postMock.mockResolvedValue({
    data: { data: { liked: true, likeCount: 4 } },
  })
})

afterEach(() => {
  cleanup()
})

describe("PostCard (T059)", () => {
  it("renderiza avatar, nome (displayName ?? name) e timestamp relativo", () => {
    render(<PostCard post={makePost()} />)

    expect(screen.getByText("Ana")).toBeDefined()
    expect(screen.getByText("há 5 min")).toBeDefined()
    expect(screen.getByRole("img", { name: "Foto de Ana" })).toBeDefined()
  })

  it("fallback de avatar mostra as iniciais quando sem foto", () => {
    const post = makePost({
      author: {
        id: "u2",
        name: "Ana Silva",
        displayName: null,
        avatar: null,
      },
    })
    render(<PostCard post={post} />)

    expect(screen.getByText("Ana Silva")).toBeDefined()
    expect(screen.queryByRole("img")).toBeNull()
  })

  it("linkifica menções e hashtags clicáveis (T031)", () => {
    render(<PostCard post={makePost()} />)

    const mencao = screen.getByRole("link", { name: "@ana" })
    expect(mencao.getAttribute("href")).toBe("/perfil/ana")
    const hashtag = screen.getByRole("link", { name: "#tarot" })
    expect(hashtag.getAttribute("href")).toBe("/explorar?tag=tarot")
  })

  it("escapa HTML do conteúdo (não injeta elementos)", () => {
    render(
      <PostCard
        post={makePost({ content: '<script>alert("xss")</script> ok' })}
      />,
    )

    expect(document.querySelector("script")).toBeNull()
    expect(screen.getByText(/ ok$/)).toBeDefined()
  })

  it("renderiza o grid de imagens quando houver imageUrls", () => {
    render(
      <PostCard
        post={makePost({
          imageUrls: [
            "posts/u2/1-a.jpg",
            "posts/u2/1-b.png",
            "posts/u2/1-c.webp",
          ],
        })}
      />,
    )

    const images = screen
      .getAllByRole("img")
      .filter((img) => img.getAttribute("src")?.includes("posts/"))
    expect(images).toHaveLength(3)
  })

  it("preview de tiragem linka /tiragem/:id", () => {
    render(
      <PostCard post={makePost({ type: "reading", readingId: "rdg_9" })} />,
    )

    const link = screen.getByRole("link", { name: /Ver tiragem/ })
    expect(link.getAttribute("href")).toBe("/tiragem/rdg_9")
  })

  it("barra de ações mostra contagens e compartilha via ShareModal", async () => {
    render(<PostCard post={makePost()} />)

    expect(screen.getByRole("button", { name: /Curtir.*3/ })).toBeDefined()
    expect(screen.getByRole("button", { name: /Comentar.*1/ })).toBeDefined()
    expect(screen.queryByRole("dialog")).toBeNull()

    fireEvent.click(screen.getByRole("button", { name: /Compartilhar/ }))
    expect(screen.getByRole("dialog")).toBeDefined()

    fireEvent.click(screen.getByRole("button", { name: "Fechar" }))
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
  })

  it("badge de audiência 'Seguidores' quando audience=followers", () => {
    render(<PostCard post={makePost({ audience: "followers" })} />)

    expect(screen.getByText("Seguidores")).toBeDefined()
  })
})

describe("PostCard — base de imagens NEXT_PUBLIC_R2_PUBLIC_URL", () => {
  const KEY = "NEXT_PUBLIC_R2_PUBLIC_URL"
  let previous: string | undefined

  beforeEach(() => {
    previous = process.env[KEY]
  })

  afterEach(() => {
    if (previous === undefined) delete process.env[KEY]
    else process.env[KEY] = previous
    vi.resetModules()
  })

  async function renderFresh(overrides: Record<string, unknown>) {
    vi.resetModules()
    const { PostCard: FreshPostCard } =
      await import("@/components/social/post-card")
    render(<FreshPostCard post={makePost(overrides)} />)
    return screen.getAllByRole("img").map((img) => img.getAttribute("src"))
  }

  it("monta src absoluta com NEXT_PUBLIC_R2_PUBLIC_URL", async () => {
    process.env[KEY] = "https://assets.example.com"
    const srcs = await renderFresh({ imageUrls: ["posts/u2/1-a.jpg"] })
    expect(srcs).toContain("https://assets.example.com/posts/u2/1-a.jpg")
  })

  it("env vazia cai no fallback https://r2.arkanaagora.com", async () => {
    process.env[KEY] = ""
    const srcs = await renderFresh({ imageUrls: ["posts/u2/1-a.jpg"] })
    expect(srcs).toContain("https://r2.arkanaagora.com/posts/u2/1-a.jpg")
  })

  it("chave que já é URL absoluta passa adiante", async () => {
    delete process.env[KEY]
    const srcs = await renderFresh({
      imageUrls: ["https://cdn.example.com/x.jpg"],
    })
    expect(srcs).toContain("https://cdn.example.com/x.jpg")
  })
})

describe("PostCard — like e comentários ligados (T085, T076/T077)", () => {
  function createWrapper() {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    })
    return function Wrapper({ children }: { children: ReactNode }) {
      return (
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      )
    }
  }

  it("curtir otimiza no SocialStore e reconcilia com o servidor", async () => {
    render(<PostCard post={makePost()} />)

    const likeButton = screen.getByRole("button", {
      name: /Curtir, 3 curtidas/,
    })
    fireEvent.click(likeButton)

    // otimista: contador 3 → 4 antes da resposta
    expect(
      screen.getByRole("button", { name: /Curtir, 4 curtidas/ }),
    ).toBeDefined()
    expect(
      screen
        .getByRole("button", { name: /Curtir, 4 curtidas/ })
        .getAttribute("aria-pressed"),
    ).toBe("true")
    expect(postMock).toHaveBeenCalledWith("/social/posts/p1/like")
    expect(useSocialStore.getState().postLikes["p1"]).toEqual({
      liked: true,
      likeCount: 4,
    })

    await waitFor(() => expect(postMock).toHaveBeenCalledTimes(1))
  })

  it("falha no like reverte o overlay e mostra toast", async () => {
    postMock.mockRejectedValue(new Error("offline"))
    const { toast: toastMock } = await import("sonner")

    render(<PostCard post={makePost()} />)
    fireEvent.click(screen.getByRole("button", { name: /Curtir, 3 curtidas/ }))

    await waitFor(() => expect(toastMock.error).toHaveBeenCalled())
    expect(
      screen.getByRole("button", { name: /Curtir, 3 curtidas/ }),
    ).toBeDefined()
    expect(useSocialStore.getState().postLikes["p1"]).toEqual({
      liked: false,
      likeCount: 3,
    })
  })

  it("botão Comentar alterna a CommentSection", async () => {
    render(<PostCard post={makePost()} />, { wrapper: createWrapper() })

    expect(screen.queryByPlaceholderText(/comentario/)).toBeNull()

    fireEvent.click(screen.getByRole("button", { name: /Comentar, 1/ }))
    expect(await screen.findByPlaceholderText(/comentario/)).toBeDefined()
    expect(getMock).toHaveBeenCalledWith(
      "/social/posts/p1/comments",
      expect.anything(),
    )

    fireEvent.click(screen.getByRole("button", { name: /Comentar, 1/ }))
    await waitFor(() =>
      expect(screen.queryByPlaceholderText(/comentario/)).toBeNull(),
    )
  })

  it("post com commentsDisabled mantém o botão inerte", async () => {
    render(<PostCard post={makePost({ commentsDisabled: true })} />, {
      wrapper: createWrapper(),
    })

    const button = screen.getByRole("button", { name: /Comentar, 1/ })
    expect(button.getAttribute("aria-disabled")).toBe("true")

    fireEvent.click(button)
    expect(screen.queryByPlaceholderText(/comentario/)).toBeNull()
    expect(getMock).not.toHaveBeenCalled()
  })

  it("descurte quando já havia sido curtido neste ciclo", async () => {
    postMock.mockResolvedValueOnce({
      data: { data: { liked: true, likeCount: 4 } },
    })
    postMock.mockResolvedValueOnce({
      data: { data: { liked: false, likeCount: 3 } },
    })
    render(<PostCard post={makePost()} />)

    const button = screen.getByRole("button", { name: /Curtir, 3 curtidas/ })
    fireEvent.click(button)
    expect(
      screen.getByRole("button", { name: /Curtir, 4 curtidas/ }),
    ).toBeDefined()
    await waitFor(() => expect(postMock).toHaveBeenCalledTimes(1))

    fireEvent.click(screen.getByRole("button", { name: /Curtir, 4 curtidas/ }))
    await waitFor(() => expect(postMock).toHaveBeenCalledTimes(2))
    expect(
      await screen.findByRole("button", { name: /Curtir, 3 curtidas/ }),
    ).toBeDefined()
    expect(useSocialStore.getState().postLikes["p1"]).toEqual({
      liked: false,
      likeCount: 3,
    })
  })
})
