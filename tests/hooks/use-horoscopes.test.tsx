// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest"
import { renderHook, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { ReactNode } from "react"

vi.mock("@/lib/api", () => ({
  default: { get: vi.fn(), post: vi.fn() },
}))

async function importModule() {
  return await import("@/hooks/use-horoscopes")
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

const HOROSCOPE = {
  type: "western",
  signId: "aries",
  period: "daily",
  date: "2026-09-26",
  content: {
    general: "texto".repeat(40),
    love: "amor",
    career: "carreira",
    health: "saude",
    luckyNumber: 7,
    luckyColor: "turquesa",
    mood: "sereno",
    compatibility: "leao",
    date: "2026-09-26",
    fallback: true,
  },
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe("useHoroscopes (T038)", () => {
  it("busca /horoscopes/western com period e date", async () => {
    const { default: authApi } = await import("@/lib/api")
    vi.mocked(authApi.get).mockResolvedValue({
      data: { horoscope: HOROSCOPE },
    } as never)

    const { useHoroscopes } = await importModule()
    const { result } = renderHook(
      () => useHoroscopes("western", "daily", "2026-09-26"),
      { wrapper: createWrapper() },
    )

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(authApi.get).toHaveBeenCalledWith("/horoscopes/western", {
      params: { period: "daily", date: "2026-09-26" },
    })
    expect(result.current.data?.signId).toBe("aries")
    expect(result.current.data?.content.fallback).toBe(true)
  })

  it("omite date quando ausente e aceita payload sem envelope", async () => {
    const { default: authApi } = await import("@/lib/api")
    vi.mocked(authApi.get).mockResolvedValue({ data: HOROSCOPE } as never)

    const { useHoroscopes } = await importModule()
    const { result } = renderHook(() => useHoroscopes("maya", "weekly"), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(authApi.get).toHaveBeenCalledWith("/horoscopes/maya", {
      params: { period: "weekly" },
    })
  })

  it("marca erro quando a resposta não bate com o schema", async () => {
    const { default: authApi } = await import("@/lib/api")
    vi.mocked(authApi.get).mockResolvedValue({ data: { foo: 1 } } as never)

    const { useHoroscopes } = await importModule()
    const { result } = renderHook(() => useHoroscopes("chinese", "daily"), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isError).toBe(true))
  })
})

describe("useMyHoroscope (T038/T094)", () => {
  it("agrega western/chinese/mayan em /horoscopes/my-horoscope", async () => {
    const { default: authApi } = await import("@/lib/api")
    vi.mocked(authApi.get).mockResolvedValue({
      data: { western: HOROSCOPE, chinese: null, mayan: null },
    } as never)

    const { useMyHoroscope } = await importModule()
    const { result } = renderHook(() => useMyHoroscope(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(authApi.get).toHaveBeenCalledWith("/horoscopes/my-horoscope")
    expect(result.current.data?.western?.signId).toBe("aries")
    expect(result.current.data?.chinese).toBeNull()
    expect(result.current.data?.mayan).toBeNull()
  })

  it("rejeita payload que não é o agregado dos 3 sistemas", async () => {
    const { default: authApi } = await import("@/lib/api")
    vi.mocked(authApi.get).mockResolvedValue({
      data: HOROSCOPE,
    } as never)

    const { useMyHoroscope } = await importModule()
    const { result } = renderHook(() => useMyHoroscope(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isError).toBe(true))
  })
})

describe("useHoroscopeHistory (T038)", () => {
  it("pagina por cursor via getNextPageParam", async () => {
    const { default: authApi } = await import("@/lib/api")
    vi.mocked(authApi.get)
      .mockResolvedValueOnce({
        data: {
          entries: [
            {
              id: "h1",
              type: "western",
              signId: "aries",
              period: "daily",
              createdAt: "2026-09-25",
            },
          ],
          nextCursor: "cursor-2",
        },
      } as never)
      .mockResolvedValueOnce({
        data: {
          entries: [
            {
              id: "h2",
              type: "western",
              signId: "aries",
              period: "daily",
              createdAt: "2026-09-24",
            },
          ],
          nextCursor: null,
        },
      } as never)

    const { useHoroscopeHistory } = await importModule()
    const { result } = renderHook(() => useHoroscopeHistory(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.pages).toHaveLength(1)
    expect(result.current.hasNextPage).toBe(true)

    await result.current.fetchNextPage()
    await waitFor(() => expect(result.current.data?.pages).toHaveLength(2))
    expect(result.current.data?.pages[1]?.entries[0]?.id).toBe("h2")
    expect(result.current.hasNextPage).toBe(false)
    expect(authApi.get).toHaveBeenLastCalledWith("/horoscopes/history", {
      params: { cursor: "cursor-2" },
    })
  })

  it("cursor inicial compõe a queryKey (sem colisão de cache)", async () => {
    const { default: authApi } = await import("@/lib/api")
    vi.mocked(authApi.get).mockResolvedValue({
      data: { entries: [], nextCursor: null },
    } as never)

    const { useHoroscopeHistory } = await importModule()
    const { rerender } = renderHook(
      ({ cursor }: { cursor: string | null }) => useHoroscopeHistory(cursor),
      { wrapper: createWrapper(), initialProps: { cursor: "h-a" } },
    )

    await waitFor(() => expect(authApi.get).toHaveBeenCalledTimes(1))
    rerender({ cursor: "h-b" })
    await waitFor(() => expect(authApi.get).toHaveBeenCalledTimes(2))
  })
})
