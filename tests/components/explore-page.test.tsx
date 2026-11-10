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

import ExplorePage from "@/app/(app)/explorar/page"

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => ({
    push: vi.fn(),
    back: vi.fn(),
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

// Mock the hooks directly
const mockUseTrending = vi.hoisted(() => vi.fn())
const mockUseTrendingHashtags = vi.hoisted(() => vi.fn())
const mockUseExploreSuggestions = vi.hoisted(() => vi.fn())

vi.mock("@/hooks/use-feed", () => ({
  useTrending: mockUseTrending,
  useTrendingHashtags: mockUseTrendingHashtags,
  useExploreSuggestions: mockUseExploreSuggestions,
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

function mockExploreResponse(
  trending: Array<{
    id: string
    authorId: string
    type: string
    content: string
    imageUrls: string[]
    audience: string
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
  }> = [],
  hashtags: Array<{ tag: string; count: number }> = [],
  suggestions: Array<{
    id: string
    name: string
    username: string | null
    avatar: string | null
    role: string
    followersCount: number
  }> = [],
) {
  mockUseTrending.mockReturnValue({
    data: trending,
    isLoading: false,
    error: null,
  })
  mockUseTrendingHashtags.mockReturnValue({
    data: hashtags,
    isLoading: false,
    error: null,
  })
  mockUseExploreSuggestions.mockReturnValue({
    data: suggestions,
    isLoading: false,
    error: null,
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  cleanup()
})

afterEach(() => {
  cleanup()
})

describe("ExplorePage (T126)", () => {
  beforeEach(() => {
    mockExploreResponse()
  })

  it("renderiza a página de explorar com título", async () => {
    render(<ExplorePage />, { wrapper: createWrapper() })
    await waitFor(() => {
      expect(screen.getByText("Explorar")).toBeInTheDocument()
    })
  })

  it("mostra a aba 'Em Alta' ativa por padrão", async () => {
    render(<ExplorePage />, { wrapper: createWrapper() })
    await waitFor(() => {
      expect(
        screen.getByRole("tab", { name: /em alta/i, selected: true }),
      ).toBeInTheDocument()
    })
  })

  it("mostra as tabs 'Hashtags', 'Pessoas', 'Tiragens'", async () => {
    render(<ExplorePage />, { wrapper: createWrapper() })
    await waitFor(() => {
      expect(screen.getByRole("tab", { name: /hashtags/i })).toBeInTheDocument()
      expect(screen.getByRole("tab", { name: /pessoas/i })).toBeInTheDocument()
      // Tiragens tab was removed (YAGNI)
    })
  })

  it("mostra o campo de busca no topo", async () => {
    render(<ExplorePage />, { wrapper: createWrapper() })
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/buscar/i)).toBeInTheDocument()
    })
  })

  it("carrega posts em alta na aba 'Em Alta'", async () => {
    mockExploreResponse([
      {
        id: "post_1",
        authorId: "u1",
        type: "text",
        content: "Post em alta",
        imageUrls: [],
        audience: "public",
        isPinned: false,
        likeCount: 10,
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

    render(<ExplorePage />, { wrapper: createWrapper() })

    await waitFor(() => {
      expect(screen.getByText("Post em alta")).toBeInTheDocument()
    })
  })

  it("carrega hashtags em alta na aba 'Hashtags'", async () => {
    mockExploreResponse([], [{ tag: "tarot", count: 5 }])

    render(<ExplorePage />, { wrapper: createWrapper() })

    // Wait for data to load first
    await waitFor(() => {
      expect(screen.queryByText(/carregando/i)).not.toBeInTheDocument()
    })

    // Clica na aba Hashtags
    const hashtagsTab = screen.getByRole("tab", { name: /hashtags/i })
    fireEvent.click(hashtagsTab)

    await waitFor(() => {
      // The component renders "tarot" without # symbol
      expect(screen.getByText("tarot")).toBeInTheDocument()
      expect(screen.getByText("5 posts")).toBeInTheDocument()
    })
  })

  it("carrega sugestões de pessoas na aba 'Pessoas'", async () => {
    mockExploreResponse(
      [],
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

    render(<ExplorePage />, { wrapper: createWrapper() })

    // Wait for data to load first
    await waitFor(() => {
      expect(screen.queryByText(/carregando/i)).not.toBeInTheDocument()
    })

    // Clica na aba Pessoas
    const pessoasTab = screen.getByRole("tab", { name: /pessoas/i })
    fireEvent.click(pessoasTab)

    await waitFor(() => {
      expect(screen.getByText("Maria Silva")).toBeInTheDocument()
      expect(screen.getByText("@maria")).toBeInTheDocument()
      expect(screen.getByText("100 seguidores")).toBeInTheDocument()
    })
  })

  it("mostra estado de loading enquanto carrega dados", async () => {
    mockUseTrending.mockImplementation(() => ({
      data: undefined,
      isLoading: true,
      error: null,
    }))
    mockUseTrendingHashtags.mockImplementation(() => ({
      data: undefined,
      isLoading: true,
      error: null,
    }))
    mockUseExploreSuggestions.mockImplementation(() => ({
      data: undefined,
      isLoading: true,
      error: null,
    }))

    const { unmount, rerender } = render(<ExplorePage />, {
      wrapper: createWrapper(),
    })

    // Should show initial loading spinner
    expect(screen.getByText(/carregando/i)).toBeInTheDocument()

    // Update loading state
    mockUseTrending.mockImplementation(() => ({
      data: [],
      isLoading: false,
      error: null,
    }))
    mockUseTrendingHashtags.mockImplementation(() => ({
      data: [],
      isLoading: false,
      error: null,
    }))
    mockUseExploreSuggestions.mockImplementation(() => ({
      data: [],
      isLoading: false,
      error: null,
    }))

    // Force re-render
    rerender(<ExplorePage />)

    await waitFor(() => {
      expect(screen.queryByText(/carregando/i)).not.toBeInTheDocument()
    })

    unmount()
  })

  it("mostra erro quando falha ao carregar dados", async () => {
    mockUseTrending.mockImplementation(() => ({
      data: [],
      isLoading: false,
      error: new Error("Erro ao carregar"),
    }))
    mockUseTrendingHashtags.mockImplementation(() => ({
      data: [],
      isLoading: false,
      error: null,
    }))
    mockUseExploreSuggestions.mockImplementation(() => ({
      data: [],
      isLoading: false,
      error: null,
    }))

    render(<ExplorePage />, { wrapper: createWrapper() })

    await waitFor(() => {
      expect(screen.getByText(/erro ao carregar/i)).toBeInTheDocument()
    })
  })
})
