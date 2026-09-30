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

import authApi from "@/lib/api"
import {
  FollowersModal,
  FollowingModal,
} from "@/components/social/followers-modal"

const getMock = vi.mocked(authApi.get)

let queryClient: QueryClient

function createWrapper() {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )
  }
}

const alicePage = {
  data: [
    {
      userId: "usr_a",
      name: "Alice D",
      username: "alice",
      avatarUrl: null,
      isFollowing: false,
    },
  ],
  pagination: { nextCursor: "cursor_1" },
}

beforeEach(() => {
  cleanup()
  vi.clearAllMocks()
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  getMock.mockResolvedValue({ data: alicePage })
})

afterEach(() => {
  cleanup()
})

describe("FollowersModal (T048)", () => {
  it("renderiza lista com avatar, nome, username e botao", async () => {
    render(<FollowersModal open onClose={() => {}} username="alice_user" />, {
      wrapper: createWrapper(),
    })
    expect(await screen.findByText("Alice D")).toBeDefined()
    expect(screen.getByText("alice")).toBeDefined()
    expect(screen.getByRole("button", { name: "Seguir" })).toBeDefined()
    expect(screen.getByRole("dialog", { name: "Seguidores" })).toBeDefined()
  })

  it("nao busca nem renderiza quando fechado", () => {
    render(
      <FollowersModal open={false} onClose={() => {}} username="alice_user" />,
      { wrapper: createWrapper() },
    )
    expect(getMock).not.toHaveBeenCalled()
    expect(screen.queryByRole("dialog")).toBeNull()
  })

  it("busca por nome apos debounce de 300ms com ?q=", async () => {
    render(<FollowersModal open onClose={() => {}} username="alice_user" />, {
      wrapper: createWrapper(),
    })
    await screen.findByText("Alice D")

    const input = screen.getByLabelText("Buscar por nome")
    fireEvent.change(input, { target: { value: "ali" } })

    await waitFor(
      () => {
        expect(getMock).toHaveBeenCalledWith("/users/alice_user/followers", {
          params: { q: "ali" },
        })
      },
      { timeout: 2000 },
    )
  })

  it("input de busca tem maxLength=50", () => {
    render(<FollowersModal open onClose={() => {}} username="alice_user" />, {
      wrapper: createWrapper(),
    })
    const input = screen.getByLabelText("Buscar por nome")
    expect(input).toHaveAttribute("maxLength", "50")
  })

  it("reset de busca ao fechar e reabrir o modal", async () => {
    const { rerender } = render(
      <FollowersModal open onClose={() => {}} username="alice_user" />,
      { wrapper: createWrapper() },
    )
    await screen.findByText("Alice D")

    const input = screen.getByLabelText("Buscar por nome")
    fireEvent.change(input, { target: { value: "ali" } })
    expect(input).toHaveValue("ali")

    // Fecha e reabre
    rerender(
      <FollowersModal open={false} onClose={() => {}} username="alice_user" />,
    )
    rerender(<FollowersModal open onClose={() => {}} username="alice_user" />)
    await screen.findByText("Alice D")
    expect(screen.getByLabelText("Buscar por nome")).toHaveValue("")
  })

  it("carrega a proxima pagina via cursor no botao Carregar mais", async () => {
    getMock.mockResolvedValueOnce({ data: alicePage }).mockResolvedValueOnce({
      data: {
        data: [
          {
            userId: "usr_b",
            name: "Bob D",
            username: "bob",
            avatarUrl: null,
            isFollowing: true,
          },
        ],
        pagination: { nextCursor: null },
      },
    })
    render(<FollowersModal open onClose={() => {}} username="alice_user" />, {
      wrapper: createWrapper(),
    })
    await screen.findByText("Alice D")

    fireEvent.click(screen.getByRole("button", { name: "Carregar mais" }))
    expect(await screen.findByText("Bob D")).toBeDefined()
    expect(getMock).toHaveBeenCalledWith("/users/alice_user/followers", {
      params: { cursor: "cursor_1" },
    })
  })

  it("mostra empty state com acentos quando a lista vem vazia", async () => {
    getMock.mockResolvedValue({
      data: { data: [], pagination: { nextCursor: null } },
    })
    render(<FollowersModal open onClose={() => {}} username="alice_user" />, {
      wrapper: createWrapper(),
    })
    expect(await screen.findByText("Nenhum seguidor ainda")).toBeDefined()
  })

  it("oculta a propria linha quando currentUserId bate (self-row)", async () => {
    getMock.mockResolvedValue({
      data: {
        data: [
          {
            userId: "usr_me",
            name: "Eu",
            username: "me",
            avatarUrl: null,
            isFollowing: false,
          },
          {
            userId: "usr_other",
            name: "Outro",
            username: "other",
            avatarUrl: null,
            isFollowing: false,
          },
        ],
        pagination: { nextCursor: null },
      },
    })
    render(
      <FollowersModal
        open
        onClose={() => {}}
        username="alice_user"
        currentUserId="usr_me"
      />,
      { wrapper: createWrapper() },
    )
    expect(await screen.findByText("Outro")).toBeDefined()
    expect(screen.queryByText("Eu")).not.toBeInTheDocument()
  })

  it("fecha com tecla Escape", async () => {
    const onClose = vi.fn()
    render(<FollowersModal open onClose={onClose} username="alice_user" />, {
      wrapper: createWrapper(),
    })
    await screen.findByText("Alice D")

    fireEvent.keyDown(document, { key: "Escape" })
    await waitFor(() => expect(onClose).toHaveBeenCalled())
  })

  it("foca input de busca ao abrir", async () => {
    render(<FollowersModal open onClose={() => {}} username="alice_user" />, {
      wrapper: createWrapper(),
    })
    await screen.findByText("Alice D")
    expect(screen.getByLabelText("Buscar por nome")).toHaveFocus()
  })

  it("mostra erro com botao Tentar novamente", async () => {
    getMock.mockRejectedValue(new Error("network"))
    render(<FollowersModal open onClose={() => {}} username="alice_user" />, {
      wrapper: createWrapper(),
    })
    expect(
      await screen.findByText("Não foi possível carregar a lista"),
    ).toBeDefined()
    expect(
      screen.getByRole("button", { name: "Tentar novamente" }),
    ).toBeDefined()
  })
})

describe("FollowingModal (T048)", () => {
  it("consulta /users/:username/following", async () => {
    render(<FollowingModal open onClose={() => {}} username="alice_user" />, {
      wrapper: createWrapper(),
    })
    expect(await screen.findByText("Alice D")).toBeDefined()
    expect(getMock).toHaveBeenCalledWith("/users/alice_user/following", {
      params: {},
    })
    expect(screen.getByRole("dialog", { name: "Seguindo" })).toBeDefined()
  })

  it("mostra empty state do lado following com acentos", async () => {
    getMock.mockResolvedValue({
      data: { data: [], pagination: { nextCursor: null } },
    })
    render(<FollowingModal open onClose={() => {}} username="alice_user" />, {
      wrapper: createWrapper(),
    })
    expect(await screen.findByText("Ainda não segue ninguém")).toBeDefined()
  })
})
