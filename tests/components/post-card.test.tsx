// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"

vi.mock("next-auth/react", () => ({
  getSession: vi.fn().mockResolvedValue(null),
  useSession: vi.fn(() => ({ data: null })),
}))

import { PostCard } from "@/components/social/post-card"
import type { FeedPost } from "@/hooks/use-feed"

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
