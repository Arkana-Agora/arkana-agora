// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import type { ReactNode } from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

const getMock = vi.hoisted(() => vi.fn())
const postMock = vi.hoisted(() => vi.fn())
let socketHandlers: Record<string, (payload: unknown) => void> = vi.hoisted(
  () => ({}),
)

vi.mock("@/lib/api", () => ({ default: { get: getMock, post: postMock } }))
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }))
vi.mock("@/hooks/use-socket", () => ({
  useSocket: (handlers: Record<string, (payload: unknown) => void>) => {
    socketHandlers = handlers
    return undefined
  },
}))

import { toast } from "sonner"

import { CommentSection } from "@/components/social/comment-section"
import { useSocialStore } from "@/stores/social-store"

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )
  }
}

function author(overrides: Record<string, unknown> = {}) {
  return {
    id: "usr_2",
    name: "Bia Lima",
    displayName: "Bia Luz",
    avatar: null,
    ...overrides,
  }
}

function rootComment(overrides: Record<string, unknown> = {}) {
  return {
    id: "cmt_1",
    postId: "post_1",
    content: "Primeiro comentario",
    likeCount: 2,
    parentCommentId: null,
    createdAt: "2026-10-05T10:00:00.000Z",
    author: author(),
    ...overrides,
  }
}

function replyComment(overrides: Record<string, unknown> = {}) {
  return {
    id: "cmt_2",
    postId: "post_1",
    content: "Resposta boa",
    likeCount: 0,
    parentCommentId: "cmt_1",
    createdAt: "2026-10-05T10:01:00.000Z",
    author: author({ id: "usr_1", name: "Viewer", displayName: null }),
    ...overrides,
  }
}

function envelope(comments: unknown[], nextCursor: string | null = null) {
  return { data: comments, pagination: { nextCursor } }
}

async function renderSection() {
  const view = render(<CommentSection postId="post_1" />, {
    wrapper: createWrapper(),
  })
  return view
}

beforeEach(() => {
  cleanup()
  vi.clearAllMocks()
  socketHandlers = {}
  useSocialStore.setState(useSocialStore.getInitialState())
  getMock.mockResolvedValue({ data: envelope([]) })
  postMock.mockResolvedValue({ data: { data: { comment: rootComment() } } })
})

afterEach(() => {
  cleanup()
})

describe("CommentSection (T085)", () => {
  it("lista raízes e respostas de nível 1 com autor e contagem de like", async () => {
    getMock.mockResolvedValue({
      data: envelope([rootComment({ replies: [replyComment()] })]),
    })

    await renderSection()

    expect(await screen.findByText("Primeiro comentario")).toBeDefined()
    expect(screen.getByText("Resposta boa")).toBeDefined()
    expect(screen.getByText("Bia Luz")).toBeDefined()
    expect(
      screen.getByRole("button", { name: "Curtir comentário, 2 curtidas" }),
    ).toBeDefined()
    expect(screen.getByRole("heading", { name: "Comentários" })).toBeDefined()
  })

  it("curtida do comentário já vem do servidor (viewerHasLiked) — R6", async () => {
    getMock.mockResolvedValue({
      data: envelope([
        rootComment({ likeCount: 2, viewerHasLiked: true }),
        rootComment({
          id: "cmt_7",
          content: "Segundo comentario",
          likeCount: 5,
        }),
      ]),
    })

    await renderSection()
    expect(await screen.findByText("Primeiro comentario")).toBeDefined()

    expect(
      screen
        .getByRole("button", { name: "Curtir comentário, 2 curtidas" })
        .getAttribute("aria-pressed"),
    ).toBe("true")
    expect(
      screen
        .getByRole("button", { name: "Curtir comentário, 5 curtidas" })
        .getAttribute("aria-pressed"),
    ).toBe("false")
  })

  it("cria comentário raiz, exibe na hora (store) e limpa o input", async () => {
    postMock.mockResolvedValue({
      data: { data: { comment: rootComment({ content: "novo comentario" }) } },
    })
    await renderSection()

    const input = await screen.findByPlaceholderText(/comentario/)
    fireEvent.change(input, { target: { value: "novo comentario" } })
    fireEvent.click(screen.getByRole("button", { name: "Comentar" }))

    await waitFor(() =>
      expect(postMock).toHaveBeenCalledWith("/social/posts/post_1/comments", {
        content: "novo comentario",
      }),
    )
    expect(await screen.findByText("novo comentario")).toBeDefined()
    expect((input as HTMLInputElement).value).toBe("")
    expect(useSocialStore.getState().postComments["post_1"]).toHaveLength(1)
  })

  it("input respeita o limite de 300 caracteres (RF-SOC-005)", async () => {
    await renderSection()

    const input = await screen.findByPlaceholderText(/comentario/)
    expect(input.getAttribute("maxlength")).toBe("300")
  })

  it("apos o refetch, remove do store os comentarios que o servidor ja trouxe", async () => {
    getMock.mockResolvedValue({
      data: envelope([rootComment({ id: "cmt_1" })]),
    })
    useSocialStore.setState({
      postComments: {
        post_1: [
          {
            id: "cmt_1",
            postId: "post_1",
            content: "Primeiro comentario",
            likeCount: 2,
            parentCommentId: null,
            createdAt: "2026-10-05T10:00:00.000Z",
            author: author(),
          },
          {
            id: "cmt_7",
            postId: "post_1",
            content: "ainda otimista",
            likeCount: 0,
            parentCommentId: null,
            createdAt: "2026-10-05T10:05:00.000Z",
            author: author({ id: "usr_9", name: "Eu", displayName: null }),
          },
        ],
      },
    })

    await renderSection()

    expect(await screen.findByText("Primeiro comentario")).toBeDefined()
    await waitFor(() =>
      expect(
        useSocialStore.getState().postComments["post_1"]?.map((c) => c.id),
      ).toEqual(["cmt_7"]),
    )
    expect(await screen.findByText("ainda otimista")).toBeDefined()
  })

  it("‘Carregar mais’ pagina por cursor", async () => {
    getMock.mockResolvedValueOnce({
      data: envelope(
        [rootComment({ id: "cmt_1", content: "Primeiro" })],
        "cur_2",
      ),
    })
    getMock.mockResolvedValueOnce({
      data: envelope([rootComment({ id: "cmt_9", content: "Segundo" })]),
    })

    await renderSection()

    expect(await screen.findByText("Primeiro")).toBeDefined()
    fireEvent.click(screen.getByRole("button", { name: "Carregar mais" }))

    expect(await screen.findByText("Segundo")).toBeDefined()
    expect(getMock).toHaveBeenLastCalledWith("/social/posts/post_1/comments", {
      params: { cursor: "cur_2" },
    })
  })

  it("responder envia parentCommentId (1 nível)", async () => {
    getMock.mockResolvedValue({ data: envelope([rootComment()]) })
    postMock.mockResolvedValue({
      data: {
        data: {
          comment: replyComment({ content: "minha resposta" }),
        },
      },
    })

    await renderSection()

    fireEvent.click(await screen.findByRole("button", { name: "Responder" }))
    expect(screen.getByText(/Respondendo a Bia Luz/)).toBeDefined()

    const input = screen.getByPlaceholderText(/comentario/)
    fireEvent.change(input, { target: { value: "minha resposta" } })
    fireEvent.click(screen.getByRole("button", { name: "Comentar" }))

    await waitFor(() =>
      expect(postMock).toHaveBeenCalledWith("/social/posts/post_1/comments", {
        content: "minha resposta",
        parentCommentId: "cmt_1",
      }),
    )
    expect(await screen.findByText("minha resposta")).toBeDefined()
  })

  it("like de comentário chama o endpoint T081 e reconcilia a contagem", async () => {
    getMock.mockResolvedValue({ data: envelope([rootComment()]) })
    postMock.mockResolvedValue({
      data: { data: { liked: true, likeCount: 3 } },
    })

    await renderSection()

    fireEvent.click(
      await screen.findByRole("button", {
        name: "Curtir comentário, 2 curtidas",
      }),
    )

    await waitFor(() =>
      expect(postMock).toHaveBeenCalledWith("/social/comments/cmt_1/like"),
    )
    expect(
      await screen.findByRole("button", {
        name: "Curtir comentário, 3 curtidas",
      }),
    ).toBeDefined()
  })

  it("lista vazia mantém o composer utilizável", async () => {
    await renderSection()

    expect(await screen.findByPlaceholderText(/comentario/)).toBeDefined()
    expect(screen.queryByRole("button", { name: "Carregar mais" })).toBeNull()
  })

  it("erro de criação mostra toast e preserva o texto digitado", async () => {
    postMock.mockRejectedValue(new Error("offline"))

    await renderSection()

    const input = await screen.findByPlaceholderText(/comentario/)
    fireEvent.change(input, { target: { value: "tentativa" } })
    fireEvent.click(screen.getByRole("button", { name: "Comentar" }))

    await waitFor(() => expect(toast.error).toHaveBeenCalled())
    expect((input as HTMLInputElement).value).toBe("tentativa")
    expect(useSocialStore.getState().postComments["post_1"]).toBeUndefined()
  })

  it("comment-added de outro usuario refetcha os comentarios deste post (R3c)", async () => {
    getMock.mockResolvedValue({ data: envelope([rootComment()]) })

    await renderSection()
    expect(await screen.findByText("Primeiro comentario")).toBeDefined()

    const callsBefore = getMock.mock.calls.length

    act(() => {
      socketHandlers["comment-added"]?.({
        postId: "post_1",
        commentId: "cmt_5",
        authorName: "Alguem",
        text: "comentario de fora",
      })
    })

    await waitFor(() =>
      expect(getMock.mock.calls.length).toBeGreaterThan(callsBefore),
    )
    expect(getMock).toHaveBeenLastCalledWith("/social/posts/post_1/comments", {
      params: {},
    })
  })

  it("comment-added de OUTRO post nao refetcha este post", async () => {
    getMock.mockResolvedValue({ data: envelope([rootComment()]) })

    await renderSection()
    expect(await screen.findByText("Primeiro comentario")).toBeDefined()

    const callsBefore = getMock.mock.calls.length

    act(() => {
      socketHandlers["comment-added"]?.({
        postId: "post_999",
        commentId: "cmt_5",
        authorName: "Alguem",
        text: "comentario de outro post",
      })
    })

    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(getMock.mock.calls.length).toBe(callsBefore)
  })

  it("resposta fora do contrato na criacao vira erro (sem otimismo, texto preservado) (R5)", async () => {
    getMock.mockResolvedValue({ data: envelope([]) })
    postMock.mockResolvedValue({ data: { inesperado: true } })

    await renderSection()

    const input = await screen.findByPlaceholderText(/comentario/)
    fireEvent.change(input, { target: { value: "vai falhar" } })
    fireEvent.click(screen.getByRole("button", { name: "Comentar" }))

    await waitFor(() => expect(toast.error).toHaveBeenCalled())
    expect(useSocialStore.getState().postComments["post_1"]).toBeUndefined()
    expect((input as HTMLInputElement).value).toBe("vai falhar")
  })

  it("resposta fora do contrato no like desfaz a cura otimista (R5)", async () => {
    getMock.mockResolvedValue({
      data: envelope([rootComment({ likeCount: 2 })]),
    })
    postMock.mockResolvedValue({ data: { inesperado: true } })

    await renderSection()

    fireEvent.click(
      await screen.findByRole("button", {
        name: "Curtir comentário, 2 curtidas",
      }),
    )

    await waitFor(() => expect(toast.error).toHaveBeenCalled())
    expect(
      await screen.findByRole("button", {
        name: "Curtir comentário, 2 curtidas",
      }),
    ).toBeDefined()
    expect(useSocialStore.getState().commentLikes["cmt_1"]).toEqual({
      liked: false,
      likeCount: 2,
    })
  })
})
