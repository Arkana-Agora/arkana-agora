// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest"
import { renderHook, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { ReactNode } from "react"

vi.mock("@/lib/api", () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn() },
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

function createWrapperWith(queryClient: QueryClient) {
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

describe("useHoroscopeHistory (T038/T095 — envelope S2-18)", () => {
  it("pagina por cursor via getNextPageParam", async () => {
    const { default: authApi } = await import("@/lib/api")
    vi.mocked(authApi.get)
      .mockResolvedValueOnce({
        data: {
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
          },
          pagination: { nextCursor: "cursor-2" },
        },
      } as never)
      .mockResolvedValueOnce({
        data: {
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
          },
          pagination: { nextCursor: null },
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
    expect(result.current.data?.pages[1]?.data.entries[0]?.id).toBe("h2")
    expect(result.current.hasNextPage).toBe(false)
    expect(authApi.get).toHaveBeenLastCalledWith("/horoscopes/history", {
      params: { cursor: "cursor-2" },
    })
  })

  it("primeira pagina nao envia cursor (cursor vive so no pageParam)", async () => {
    const { default: authApi } = await import("@/lib/api")
    vi.mocked(authApi.get).mockResolvedValue({
      data: { data: { entries: [] }, pagination: { nextCursor: null } },
    } as never)

    const { useHoroscopeHistory } = await importModule()
    const { result } = renderHook(() => useHoroscopeHistory(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(authApi.get).toHaveBeenCalledWith("/horoscopes/history", {
      params: {},
    })
  })

  it("rejeita payload flat legado (fora do envelope S2-18)", async () => {
    const { default: authApi } = await import("@/lib/api")
    vi.mocked(authApi.get).mockResolvedValue({
      data: { entries: [], nextCursor: null },
    } as never)

    const { useHoroscopeHistory } = await importModule()
    const { result } = renderHook(() => useHoroscopeHistory(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isError).toBe(true))
  })
})

describe("useHoroscopes com sign/targetSign (T092)", () => {
  it("envia sign e targetSign nos params e expõe compatibility da matriz T090", async () => {
    const { default: authApi } = await import("@/lib/api")
    vi.mocked(authApi.get).mockResolvedValue({
      data: {
        horoscope: HOROSCOPE,
        compatibility: {
          targetSignId: "leao",
          love: 88,
          friendship: 83,
          work: 85,
          overall: 85,
        },
      },
    } as never)

    const { useHoroscopes } = await importModule()
    const { result } = renderHook(
      () =>
        useHoroscopes("western", "daily", undefined, {
          sign: "aries",
          targetSign: "leao",
        }),
      { wrapper: createWrapper() },
    )

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(authApi.get).toHaveBeenCalledWith("/horoscopes/western", {
      params: { period: "daily", sign: "aries", targetSign: "leao" },
    })
    // flat preservado (contrato existente) + compatibility opcional
    expect(result.current.data?.signId).toBe("aries")
    expect(result.current.data?.compatibility).toEqual({
      targetSignId: "leao",
      love: 88,
      friendship: 83,
      work: 85,
      overall: 85,
    })
  })

  it("queryKey isola sign (sem colisão de cache entre signos)", async () => {
    const { default: authApi } = await import("@/lib/api")
    vi.mocked(authApi.get).mockResolvedValue({
      data: { horoscope: HOROSCOPE },
    } as never)

    const { useHoroscopes } = await importModule()
    const { rerender } = renderHook(
      ({ sign }: { sign: string }) =>
        useHoroscopes("western", "daily", undefined, { sign }),
      { wrapper: createWrapper(), initialProps: { sign: "aries" } },
    )

    await waitFor(() => expect(authApi.get).toHaveBeenCalledTimes(1))
    rerender({ sign: "touro" })
    await waitFor(() => expect(authApi.get).toHaveBeenCalledTimes(2))
    expect(authApi.get).toHaveBeenLastCalledWith("/horoscopes/western", {
      params: { period: "daily", sign: "touro" },
    })
  })
})

describe("useHoroscopeHistory com filtros (T096)", () => {
  it("envia type/period e compõe a queryKey", async () => {
    const { default: authApi } = await import("@/lib/api")
    vi.mocked(authApi.get).mockResolvedValue({
      data: { data: { entries: [] }, pagination: { nextCursor: null } },
    } as never)

    const { useHoroscopeHistory } = await importModule()
    const { result } = renderHook(
      () => useHoroscopeHistory({ type: "western", period: "daily" }),
      { wrapper: createWrapper() },
    )

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(authApi.get).toHaveBeenCalledWith("/horoscopes/history", {
      params: { type: "western", period: "daily" },
    })
  })

  it("mudança de filtro refaz a busca (queryKey nova)", async () => {
    const { default: authApi } = await import("@/lib/api")
    vi.mocked(authApi.get).mockResolvedValue({
      data: { data: { entries: [] }, pagination: { nextCursor: null } },
    } as never)

    const { useHoroscopeHistory } = await importModule()
    const { rerender } = renderHook(
      ({ type }: { type: "western" | "maya" | undefined }) =>
        useHoroscopeHistory(type ? { type } : undefined),
      {
        wrapper: createWrapper(),
        initialProps: { type: undefined as "western" | "maya" | undefined },
      },
    )

    await waitFor(() => expect(authApi.get).toHaveBeenCalledTimes(1))
    rerender({ type: "maya" })
    await waitFor(() => expect(authApi.get).toHaveBeenCalledTimes(2))
    expect(authApi.get).toHaveBeenLastCalledWith("/horoscopes/history", {
      params: { type: "maya" },
    })
  })
})

const SETTINGS = {
  westernEnabled: true,
  chineseEnabled: false,
  mayaEnabled: false,
  hour: 7,
}

describe("useHoroscopeNotificationSettings (T103)", () => {
  it("GET /horoscopes/notifications/settings devolve settings validados", async () => {
    const { default: authApi } = await import("@/lib/api")
    vi.mocked(authApi.get).mockResolvedValue({
      data: { data: { settings: SETTINGS } },
    } as never)

    const { useHoroscopeNotificationSettings } = await importModule()
    const { result } = renderHook(() => useHoroscopeNotificationSettings(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(authApi.get).toHaveBeenCalledWith(
      "/horoscopes/notifications/settings",
    )
    expect(result.current.data).toEqual(SETTINGS)
  })

  it("rejeita settings fora do contrato (hour fora de 0–23)", async () => {
    const { default: authApi } = await import("@/lib/api")
    vi.mocked(authApi.get).mockResolvedValue({
      data: { data: { settings: { ...SETTINGS, hour: 24 } } },
    } as never)

    const { useHoroscopeNotificationSettings } = await importModule()
    const { result } = renderHook(() => useHoroscopeNotificationSettings(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isError).toBe(true))
  })
})

describe("useSaveHoroscopeNotificationSettings (T103)", () => {
  it("PATCH com o patch e invalida o settings no sucesso", async () => {
    const { default: authApi } = await import("@/lib/api")
    vi.mocked(authApi.patch).mockResolvedValue({
      data: { data: { settings: { ...SETTINGS, hour: 10 } } },
    } as never)

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    const invalidate = vi.spyOn(queryClient, "invalidateQueries")

    const { useSaveHoroscopeNotificationSettings } = await importModule()
    const { result } = renderHook(
      () => useSaveHoroscopeNotificationSettings(),
      {
        wrapper: createWrapperWith(queryClient),
      },
    )

    await result.current.mutateAsync({ hour: 10 })

    expect(authApi.patch).toHaveBeenCalledWith(
      "/horoscopes/notifications/settings",
      { hour: 10 },
    )
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: ["horoscopes", "notifications", "settings"],
    })
  })

  it("valida o patch via Zod antes de chamar a API", async () => {
    const { default: authApi } = await import("@/lib/api")

    const { useSaveHoroscopeNotificationSettings } = await importModule()
    const { result } = renderHook(
      () => useSaveHoroscopeNotificationSettings(),
      {
        wrapper: createWrapper(),
      },
    )

    await expect(result.current.mutateAsync({ hour: 24 })).rejects.toThrow()
    expect(authApi.patch).not.toHaveBeenCalled()
  })

  it("rejeita patch vazio (ao menos um campo)", async () => {
    const { default: authApi } = await import("@/lib/api")

    const { useSaveHoroscopeNotificationSettings } = await importModule()
    const { result } = renderHook(
      () => useSaveHoroscopeNotificationSettings(),
      {
        wrapper: createWrapper(),
      },
    )

    await expect(result.current.mutateAsync({})).rejects.toThrow()
    expect(authApi.patch).not.toHaveBeenCalled()
  })
})
