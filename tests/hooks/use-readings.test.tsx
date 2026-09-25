// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest"
import { renderHook, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { ReactNode } from "react"

vi.mock("@/lib/api", () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}))

async function importModule() {
  return await import("@/hooks/use-readings")
}

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe("useReadings", () => {
  it("fetches readings list", async () => {
    const { default: authApi } = await import("@/lib/api")
    vi.mocked(authApi.get).mockResolvedValue({
      data: {
        readings: [
          {
            id: "r1",
            deckId: "rws",
            spreadId: "three-card",
            seed: "s",
            duration: 0,
            isPublic: false,
            createdAt: "2026-01-01",
            cards: [],
          },
        ],
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      },
    } as never)

    const { useReadings } = await importModule()
    const { result } = renderHook(() => useReadings(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.readings).toHaveLength(1)
    expect(authApi.get).toHaveBeenCalledWith("/readings", { params: {} })
  })

  it("passes pagination params", async () => {
    const { default: authApi } = await import("@/lib/api")
    vi.mocked(authApi.get).mockResolvedValue({
      data: {
        readings: [],
        pagination: { page: 2, limit: 5, total: 0, totalPages: 0 },
      },
    } as never)

    const { useReadings } = await importModule()
    const { result } = renderHook(() => useReadings({ page: 2, limit: 5 }), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(authApi.get).toHaveBeenCalledWith("/readings", {
      params: { page: 2, limit: 5 },
    })
  })
})

describe("useReading", () => {
  it("fetches single reading by id", async () => {
    const { default: authApi } = await import("@/lib/api")
    vi.mocked(authApi.get).mockResolvedValue({
      data: {
        reading: {
          id: "r1",
          deckId: "rws",
          spreadId: "three-card",
          seed: "s",
          duration: 0,
          isPublic: false,
          createdAt: "2026-01-01",
          cards: [],
        },
      },
    } as never)

    const { useReading } = await importModule()
    const { result } = renderHook(() => useReading("r1"), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.reading.id).toBe("r1")
    expect(authApi.get).toHaveBeenCalledWith("/readings/r1")
  })

  it("does not fetch when id is empty", async () => {
    const { default: authApi } = await import("@/lib/api")
    const { useReading } = await importModule()
    const { result } = renderHook(() => useReading(""), {
      wrapper: createWrapper(),
    })

    await new Promise((r) => setTimeout(r, 50))
    expect(result.current.fetchStatus).toBe("idle")
    expect(authApi.get).not.toHaveBeenCalled()
  })
})

describe("useDailyCount", () => {
  it("fetches daily count", async () => {
    const { default: authApi } = await import("@/lib/api")
    vi.mocked(authApi.get).mockResolvedValue({
      data: { count: 2, totalLimit: 3, remaining: 1, tier: "FREE" },
    } as never)

    const { useDailyCount } = await importModule()
    const { result } = renderHook(() => useDailyCount(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.count).toBe(2)
    expect(result.current.data?.remaining).toBe(1)
  })
})

const deckFixture = {
  id: "rws",
  name: "Rider-Waite",
  description: "Baralho classico",
  author: "A.E. Waite",
  year: 1909,
  cardCount: 78,
  hasReversals: true,
  coverImageUrl: "/images/decks/rws-cover.jpg",
  cardBackImageUrl: "/images/decks/rws-back.jpg",
}

const spreadFixture = {
  id: "three-card",
  name: "Tres Cartas",
  description: "Passado, Presente e Futuro",
  deckType: "tarot",
  cardCount: 3,
  difficulty: "beginner",
  estimatedTime: 3,
  layout: "linear",
  positions: [
    {
      id: "past",
      name: "Passado",
      description: "O passado",
      gridX: 0,
      gridY: 0,
    },
  ],
}

describe("useDecks", () => {
  it("unwraps envelope body { decks } instead of treating body as array", async () => {
    const { default: authApi } = await import("@/lib/api")
    vi.mocked(authApi.get).mockResolvedValue({
      data: {
        decks: [deckFixture, { ...deckFixture, id: "thoth", name: "Thoth" }],
      },
    } as never)

    const { useDecks } = await importModule()
    const { result } = renderHook(() => useDecks(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toHaveLength(2)
    expect(result.current.data?.[0]?.id).toBe("rws")
    expect(authApi.get).toHaveBeenCalledWith("/decks")
  })

  it("does not throw decks.map crash when API returns envelope", async () => {
    const { default: authApi } = await import("@/lib/api")
    vi.mocked(authApi.get).mockResolvedValue({
      data: { decks: [] },
    } as never)

    const { useDecks } = await importModule()
    const { result } = renderHook(() => useDecks(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual([])
  })
})

describe("useSpreads", () => {
  it("unwraps envelope body { spreads }", async () => {
    const { default: authApi } = await import("@/lib/api")
    vi.mocked(authApi.get).mockResolvedValue({
      data: {
        spreads: [spreadFixture],
      },
    } as never)

    const { useSpreads } = await importModule()
    const { result } = renderHook(() => useSpreads(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toHaveLength(1)
    expect(authApi.get).toHaveBeenCalledWith("/spreads", { params: {} })
  })

  it("passes deckType filter", async () => {
    const { default: authApi } = await import("@/lib/api")
    vi.mocked(authApi.get).mockResolvedValue({
      data: { spreads: [] },
    } as never)

    const { useSpreads } = await importModule()
    const { result } = renderHook(() => useSpreads("major"), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(authApi.get).toHaveBeenCalledWith("/spreads", {
      params: { deckType: "major" },
    })
  })
})

describe("useCreateReading", () => {
  it("creates reading and returns result", async () => {
    const { default: authApi } = await import("@/lib/api")
    vi.mocked(authApi.post).mockResolvedValue({
      data: {
        reading: {
          id: "r1",
          cards: [],
          spread: spreadFixture,
          createdAt: "2026-01-01",
        },
      },
    } as never)

    const { useCreateReading } = await importModule()
    const { result } = renderHook(() => useCreateReading(), {
      wrapper: createWrapper(),
    })

    result.current.mutate({ deckId: "rws", spreadId: "three-card" })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.reading.id).toBe("r1")
    expect(authApi.post).toHaveBeenCalledWith("/readings", {
      deckId: "rws",
      spreadId: "three-card",
    })
  })
})
