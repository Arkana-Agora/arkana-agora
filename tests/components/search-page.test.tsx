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
import React from "react"

import SearchPage from "@/app/(app)/busca/page"

const routerPush = vi.fn()
const routerBack = vi.fn()

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => ({
    push: routerPush,
    back: routerBack,
  })),
  useSearchParams: vi.fn(() => ({
    get: vi.fn((key: string) => (key === "q" ? "tarot" : null)),
  })),
  Link: ({
    href,
    children,
    className,
  }: {
    href: string
    children: React.ReactNode
    className?: string
  }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}))

vi.mock("next-auth/react", () => ({
  useSession: vi.fn(() => ({
    data: {
      user: { id: "usr_1", name: "Test User", image: null },
      accessToken: "token",
    },
  })),
  getSession: vi.fn(),
}))

// Mock the useSearch hook directly
const mockUseSearch = vi.hoisted(() => vi.fn())

vi.mock("@/hooks/use-feed", () => ({
  useSearch: mockUseSearch,
}))

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  })
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
  Wrapper.displayName = "QueryClientWrapper"
  return Wrapper
}

function mockSearchResponse(
  posts: Array<{
    id: string
    authorId: string
    type: "text" | "image" | "reading"
    content: string
    imageUrls: string[]
    audience: "public" | "followers"
    isPinned: boolean
    likeCount: number
    commentCount: number
    createdAt: string
    author: {
      id: string
      name: string
      displayName: string
      avatar: string | null
      profile: {
        privacy: {
          profileVisibility: string
        }
      }
    }
    [key: string]: unknown
  }> = [],
  users: Array<{
    id: string
    name: string
    username: string | null
    avatar: string | null
    role: string
    followersCount: number
  }> = [],
  hashtags: Array<{ tag: string; count: number }> = [],
) {
  mockUseSearch.mockReturnValue({
    data: { posts, users, hashtags },
    isLoading: false,
    error: null,
  })
}

function mockSearchError(errorMessage: string = "Network error") {
  mockUseSearch.mockReturnValue({
    data: { posts: [], users: [], hashtags: [] },
    isLoading: false,
    error: new Error(errorMessage),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  routerPush.mockClear()
  routerBack.mockClear()
  cleanup()
})

afterEach(() => {
  cleanup()
})

describe("SearchPage (T127)", () => {
  beforeEach(() => {
    mockSearchResponse()
  })

  it("renderiza a página de busca com título", async () => {
    render(<SearchPage />, { wrapper: createWrapper() })

    await waitFor(() => {
      expect(screen.queryByText(/carregando/i)).not.toBeInTheDocument()
    })

    await waitFor(() => {
      expect(screen.getByText("Busca")).toBeInTheDocument()
    })
  })

  it("mostra o campo de busca com o termo da query", async () => {
    render(<SearchPage />, { wrapper: createWrapper() })

    await waitFor(() => {
      expect(screen.queryByText(/carregando/i)).not.toBeInTheDocument()
    })

    await waitFor(() => {
      const input = screen.getByPlaceholderText(
        /buscar posts, pessoas, hashtags/i,
      )
      expect(input).toHaveValue("tarot")
    })
  })

  it("mostra posts nos resultados da busca", async () => {
    mockSearchResponse([
      {
        id: "post_1",
        authorId: "u1",
        type: "text",
        content: "Post sobre tarot",
        imageUrls: [],
        audience: "public",
        isPinned: false,
        likeCount: 5,
        commentCount: 2,
        createdAt: "2026-09-25T10:00:00Z",
        author: {
          id: "u1",
          name: "Autor 1",
          displayName: "Autor 1",
          avatar: null,
          profile: { privacy: { profileVisibility: "public" } },
        },
      },
    ])

    render(<SearchPage />, { wrapper: createWrapper() })

    await waitFor(() => {
      expect(screen.queryByText(/carregando/i)).not.toBeInTheDocument()
    })

    await waitFor(() => {
      expect(screen.getByText("Post sobre tarot")).toBeInTheDocument()
    })
  })

  it("mostra usuários nos resultados da busca", async () => {
    mockSearchResponse(
      [],
      [
        {
          id: "u2",
          name: "Maria Silva",
          username: "maria",
          avatar: null,
          role: "USER",
          followersCount: 100,
        },
      ],
    )

    render(<SearchPage />, { wrapper: createWrapper() })

    await waitFor(() => {
      expect(screen.queryByText(/carregando/i)).not.toBeInTheDocument()
    })

    await waitFor(() => {
      fireEvent.click(screen.getByRole("tab", { name: /pessoas/i }))
    })

    await waitFor(() => {
      expect(screen.getByText("Maria Silva")).toBeInTheDocument()
      expect(screen.getByText("@maria")).toBeInTheDocument()
    })
  })

  it("mostra hashtags nos resultados da busca", async () => {
    mockSearchResponse([], [], [{ tag: "tarot", count: 5 }])

    render(<SearchPage />, { wrapper: createWrapper() })

    await waitFor(() => {
      expect(screen.queryByText(/carregando/i)).not.toBeInTheDocument()
    })

    await waitFor(() => {
      fireEvent.click(screen.getByRole("tab", { name: /hashtags/i }))
    })

    await waitFor(() => {
      expect(screen.getByText("tarot")).toBeInTheDocument()
      expect(screen.getByText("5 posts")).toBeInTheDocument()
    })
  })

  it("mostra estado vazio quando não há resultados", async () => {
    mockSearchResponse([], [], [])

    render(<SearchPage />, { wrapper: createWrapper() })

    await waitFor(() => {
      expect(screen.queryByText(/carregando/i)).not.toBeInTheDocument()
    })

    await waitFor(() => {
      expect(
        screen.getByText(/nenhum resultado encontrado para/i),
      ).toBeInTheDocument()
    })
  })

  it("mostra loading enquanto carrega", async () => {
    const loadingRef = { current: true }

    mockUseSearch.mockImplementation(() => ({
      data: { posts: [], users: [], hashtags: [] },
      isLoading: loadingRef.current,
      error: null,
    }))

    const { unmount, rerender } = render(<SearchPage />, {
      wrapper: createWrapper(),
    })

    expect(screen.getByText(/carregando/i)).toBeInTheDocument()

    loadingRef.current = false
    mockUseSearch.mockImplementation(() => ({
      data: { posts: [], users: [], hashtags: [] },
      isLoading: false,
      error: null,
    }))

    // Trigger re-render by calling rerender with new component
    rerender(<SearchPage />)

    await waitFor(() => {
      expect(screen.queryByText(/carregando/i)).not.toBeInTheDocument()
    })

    unmount()
  })

  it("mostra erro quando falha ao carregar", async () => {
    mockSearchError("Erro ao buscar")

    render(<SearchPage />, { wrapper: createWrapper() })

    await waitFor(() => {
      expect(screen.queryByText(/carregando/i)).not.toBeInTheDocument()
    })

    await waitFor(() => {
      expect(screen.getByText(/erro ao buscar/i)).toBeInTheDocument()
    })
  })

  it("navega para a busca ao submeter o formulário", async () => {
    render(<SearchPage />, { wrapper: createWrapper() })

    await waitFor(() => {
      expect(screen.queryByText(/carregando/i)).not.toBeInTheDocument()
    })

    const input = screen.getByPlaceholderText(
      /buscar posts, pessoas, hashtags/i,
    )
    fireEvent.change(input, { target: { value: "novo termo" } })
    fireEvent.submit(input.closest("form")!)

    await waitFor(() => {
      expect(routerPush).toHaveBeenCalledWith("/busca?q=novo%20termo")
    })
  })
})
