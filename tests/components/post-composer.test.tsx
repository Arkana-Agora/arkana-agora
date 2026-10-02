// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { ReactNode } from "react"

vi.mock("@/lib/api", () => ({ default: { get: vi.fn(), post: vi.fn() } }))
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

import authApi from "@/lib/api"
import { toast } from "sonner"
import { PostComposer } from "@/components/social/post-composer"

const getMock = vi.mocked(authApi.get)
const postMock = vi.mocked(authApi.post)
const toastMock = vi.mocked(toast)

// envelope real de POST /social/posts com um post válido p/ feedPostSchema
const validPost = {
  id: "p1",
  authorId: "u1",
  type: "text",
  content: "ola feed",
  audience: "public",
  likeCount: 0,
  commentCount: 0,
  createdAt: "2026-10-01T12:00:00.000Z",
  author: { id: "u1", name: "Alice" },
}

let queryClient: QueryClient

function createWrapper() {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )
  }
}

function renderComposer(props: { onClose?: () => void } = {}) {
  return render(<PostComposer isOpen onClose={props.onClose ?? vi.fn()} />, {
    wrapper: createWrapper(),
  })
}

function changeTextarea(value: string) {
  fireEvent.change(screen.getByRole("textbox"), {
    target: { value },
  })
}

beforeEach(() => {
  cleanup()
  vi.clearAllMocks()
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  getMock.mockResolvedValue({ data: { readings: [] } } as never)
  postMock.mockResolvedValue({
    data: { data: { post: validPost } },
  } as never)
  if (!("createObjectURL" in URL)) {
    Object.defineProperty(URL, "createObjectURL", {
      value: vi.fn(() => "blob:preview"),
      configurable: true,
    })
    Object.defineProperty(URL, "revokeObjectURL", {
      value: vi.fn(),
      configurable: true,
    })
  }
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }))
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe("PostComposer (T060/RF-SOC-003)", () => {
  it("abre com abas Texto/Imagem/Tiragem e contador 0/500", () => {
    renderComposer()

    expect(screen.getByRole("button", { name: "Texto" })).toBeDefined()
    expect(screen.getByRole("button", { name: "Imagem" })).toBeDefined()
    expect(screen.getByRole("button", { name: "Tiragem" })).toBeDefined()
    expect(screen.getByText("0/500")).toBeDefined()
    expect(screen.getByRole("textbox")).toHaveProperty("maxLength", 500)
  })

  it("trocar de aba muda o limite (300 imagem, 200 tiragem)", () => {
    renderComposer()

    fireEvent.click(screen.getByRole("button", { name: "Imagem" }))
    expect(screen.getByText("0/300")).toBeDefined()
    expect(screen.getByRole("textbox")).toHaveProperty("maxLength", 300)

    fireEvent.click(screen.getByRole("button", { name: "Tiragem" }))
    expect(screen.getByText("0/200")).toBeDefined()
    expect(screen.getByRole("textbox")).toHaveProperty("maxLength", 200)
  })

  it("seletor de audiência: público por padrão; alterna para Apenas seguidores", () => {
    renderComposer()

    const publico = screen.getByRole("radio", { name: /Publico/ })
    const seguidores = screen.getByRole("radio", { name: /Apenas seguidores/ })
    expect((publico as HTMLInputElement).checked).toBe(true)

    fireEvent.click(seguidores)
    expect((seguidores as HTMLInputElement).checked).toBe(true)
  })

  it("toggle de comentários desativados", () => {
    renderComposer()

    const toggle = screen.getByRole("checkbox", {
      name: /Desativar comentarios/,
    })
    expect((toggle as HTMLInputElement).checked).toBe(false)
    fireEvent.click(toggle)
    expect((toggle as HTMLInputElement).checked).toBe(true)
  })

  it("menção @ abre busca de usuarios com debounce 300ms e insere o username", async () => {
    getMock.mockImplementation((url: string) => {
      if (url === "/social/search") {
        return Promise.resolve({
          data: {
            data: {
              posts: [],
              users: [
                {
                  id: "u9",
                  name: "Ana",
                  username: "ana",
                  avatar: null,
                  role: "USER",
                  followersCount: 1,
                },
              ],
              hashtags: [],
            },
          },
        } as never)
      }
      return Promise.resolve({ data: { readings: [] } } as never)
    })

    renderComposer()
    changeTextarea("oi @an")

    await waitFor(
      () =>
        expect(getMock).toHaveBeenCalledWith("/social/search", {
          params: { q: "an" },
        }),
      { timeout: 2000 },
    )

    const opcao = await screen.findByRole("button", { name: /@ana/ })
    fireEvent.click(opcao)
    expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe(
      "oi @ana ",
    )
  })

  it("hashtag # abre dropdown com as hashtags populares e insere a tag", async () => {
    getMock.mockImplementation((url: string) => {
      if (url === "/social/explore/hashtags") {
        return Promise.resolve({
          data: { data: { hashtags: [{ tag: "tarot", count: 9 }] } },
        } as never)
      }
      return Promise.resolve({ data: { readings: [] } } as never)
    })

    renderComposer()
    changeTextarea("veja #ta")

    const opcao = await screen.findByRole("button", { name: /#tarot/ })
    fireEvent.click(opcao)
    expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe(
      "veja #tarot ",
    )
  })

  // Regressão (review Phase 2): o word do `#` era lowercased no handler e o
  // insert fazia lastIndexOf("#tarot") case-sensitive no conteúdo original
  // ("#Tarot") → não achava e a inserção silenciava.
  it("hashtag digitada com maiúscula ainda insere a tag canônica", async () => {
    getMock.mockImplementation((url: string) => {
      if (url === "/social/explore/hashtags") {
        return Promise.resolve({
          data: { data: { hashtags: [{ tag: "tarot", count: 9 }] } },
        } as never)
      }
      return Promise.resolve({ data: { readings: [] } } as never)
    })

    renderComposer()
    changeTextarea("vejo #Tarot")

    const opcao = await screen.findByRole("button", { name: /#tarot/ })
    fireEvent.click(opcao)
    expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe(
      "vejo #tarot ",
    )
  })

  it("rejeita arquivo fora de jpeg/png/webp sem chamar presign", async () => {
    renderComposer()
    fireEvent.click(screen.getByRole("button", { name: "Imagem" }))

    const file = new File(["x"], "doc.gif", { type: "image/gif" })
    fireEvent.change(screen.getByLabelText(/Adicionar imagens/), {
      target: { files: [file] },
    })

    await waitFor(() => expect(toastMock.error).toHaveBeenCalled())
    expect(postMock).not.toHaveBeenCalled()
  })

  it("aba Imagem sem chave de upload: só texto não habilita Publicar", () => {
    renderComposer()
    fireEvent.click(screen.getByRole("button", { name: "Imagem" }))
    changeTextarea("texto sem imagem")

    expect(screen.getByRole("button", { name: "Publicar" })).toHaveProperty(
      "disabled",
      true,
    )
    expect(postMock).not.toHaveBeenCalled()
  })

  it("rejeita arquivo maior que 5MB sem chamar presign", async () => {
    renderComposer()
    fireEvent.click(screen.getByRole("button", { name: "Imagem" }))

    const big = new File([new ArrayBuffer(6 * 1024 * 1024)], "big.png", {
      type: "image/png",
    })
    fireEvent.change(screen.getByLabelText(/Adicionar imagens/), {
      target: { files: [big] },
    })

    await waitFor(() => expect(toastMock.error).toHaveBeenCalled())
    expect(postMock).not.toHaveBeenCalled()
  })

  it("upload feliz: presign + PUT R2 e envia imageUrls na criacao", async () => {
    postMock.mockImplementation((url: string) => {
      if (url === "/social/posts/images/presign") {
        return Promise.resolve({
          data: {
            uploads: [
              { uploadUrl: "https://r2.example/put", key: "posts/u1/1-0.png" },
            ],
          },
        } as never)
      }
      return Promise.resolve({
        data: { data: { post: { ...validPost, type: "image" } } },
      } as never)
    })

    renderComposer()
    fireEvent.click(screen.getByRole("button", { name: "Imagem" }))
    const file = new File(["png"], "foto.png", { type: "image/png" })
    fireEvent.change(screen.getByLabelText(/Adicionar imagens/), {
      target: { files: [file] },
    })

    await waitFor(() =>
      expect(postMock).toHaveBeenCalledWith("/social/posts/images/presign", {
        images: [{ contentType: "image/png" }],
      }),
    )
    await waitFor(() =>
      expect(vi.mocked(globalThis.fetch)).toHaveBeenCalledWith(
        "https://r2.example/put",
        expect.objectContaining({ method: "PUT" }),
      ),
    )

    changeTextarea("com imagem")
    fireEvent.click(screen.getByRole("button", { name: "Publicar" }))

    await waitFor(() =>
      expect(postMock).toHaveBeenCalledWith(
        "/social/posts",
        expect.objectContaining({
          type: "image",
          imageUrls: ["posts/u1/1-0.png"],
          content: "com imagem",
        }),
      ),
    )
    expect(toastMock.success).toHaveBeenCalled()
  })

  it("2 imagens no mesmo lote: UM presign para as duas (não queima cota 2×)", async () => {
    postMock.mockImplementation((url: string) => {
      if (url === "/social/posts/images/presign") {
        return Promise.resolve({
          data: {
            uploads: [
              { uploadUrl: "https://r2.example/put1", key: "posts/u1/1-0.png" },
              { uploadUrl: "https://r2.example/put2", key: "posts/u1/1-1.png" },
            ],
          },
        } as never)
      }
      return Promise.resolve({
        data: { data: { post: { ...validPost, type: "image" } } },
      } as never)
    })

    renderComposer()
    fireEvent.click(screen.getByRole("button", { name: "Imagem" }))
    const files = [
      new File(["a"], "a.png", { type: "image/png" }),
      new File(["b"], "b.png", { type: "image/png" }),
    ]
    fireEvent.change(screen.getByLabelText(/Adicionar imagens/), {
      target: { files },
    })

    await waitFor(() => expect(postMock).toHaveBeenCalledTimes(1))
    expect(postMock).toHaveBeenCalledWith("/social/posts/images/presign", {
      images: [{ contentType: "image/png" }, { contentType: "image/png" }],
    })
    await waitFor(() =>
      expect(vi.mocked(globalThis.fetch)).toHaveBeenCalledTimes(2),
    )
  })

  it("submeter texto fecha o modal e publica com audience/commentsDisabled", async () => {
    const onClose = vi.fn()
    renderComposer({ onClose })

    changeTextarea("ola feed")
    fireEvent.click(screen.getByRole("radio", { name: /Apenas seguidores/ }))
    fireEvent.click(
      screen.getByRole("checkbox", { name: /Desativar comentarios/ }),
    )
    fireEvent.click(screen.getByRole("button", { name: "Publicar" }))

    await waitFor(() =>
      expect(postMock).toHaveBeenCalledWith("/social/posts", {
        type: "text",
        content: "ola feed",
        audience: "followers",
        commentsDisabled: true,
      }),
    )
    expect(onClose).toHaveBeenCalled()
  })

  it("erro do servidor exibe a mensagem da API (CONTENT_BLOCKED) em vez do generico", async () => {
    postMock.mockRejectedValue({
      response: {
        data: {
          error: { code: "CONTENT_BLOCKED", message: "Conteudo nao permitido" },
        },
      },
    })

    renderComposer()
    changeTextarea("conteudo bloqueado")
    fireEvent.click(screen.getByRole("button", { name: "Publicar" }))

    await waitFor(() =>
      expect(toastMock.error).toHaveBeenCalledWith("Conteudo nao permitido"),
    )
  })

  it("aba Tiragem sem tiragem selecionada mantém Publicar desabilitado", async () => {
    renderComposer()

    fireEvent.click(screen.getByRole("button", { name: "Tiragem" }))
    expect(screen.getByRole("button", { name: "Publicar" })).toHaveProperty(
      "disabled",
      true,
    )
    expect(postMock).not.toHaveBeenCalled()
  })
})
