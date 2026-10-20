// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest"
import { renderHook, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { ReactNode } from "react"

vi.mock("@/lib/api", () => ({
  default: { get: vi.fn(), post: vi.fn() },
}))

async function importModule() {
  return await import("@/hooks/use-social")
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

describe("useNotifications (T038/T082)", () => {
  it("pagina pelo nextCursor no envelope canônico (S2-18)", async () => {
    const { default: authApi } = await import("@/lib/api")
    vi.mocked(authApi.get)
      .mockResolvedValueOnce({
        data: {
          data: {
            notifications: [
              {
                id: "n1",
                type: "like",
                isRead: false,
                createdAt: "2026-09-26T10:00:00Z",
              },
            ],
            unreadCount: 5,
          },
          pagination: { nextCursor: "c2" },
        },
      } as never)
      .mockResolvedValueOnce({
        data: {
          data: {
            notifications: [
              {
                id: "n2",
                type: "comment",
                isRead: true,
                createdAt: "2026-09-25T10:00:00Z",
              },
            ],
            unreadCount: 4,
          },
          pagination: { nextCursor: null },
        },
      } as never)

    const { useNotifications } = await importModule()
    const { result } = renderHook(() => useNotifications(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.pages[0]?.notifications[0]?.id).toBe("n1")
    expect(result.current.data?.pages[0]?.unreadCount).toBe(5)
    expect(result.current.hasNextPage).toBe(true)

    await result.current.fetchNextPage()
    await waitFor(() => expect(result.current.data?.pages).toHaveLength(2))
    expect(result.current.hasNextPage).toBe(false)
    expect(authApi.get).toHaveBeenLastCalledWith("/social/notifications", {
      params: { cursor: "c2" },
    })
  })

  it("rejeita payload inválido", async () => {
    const { default: authApi } = await import("@/lib/api")
    vi.mocked(authApi.get).mockResolvedValue({ data: { nope: true } } as never)

    const { useNotifications } = await importModule()
    const { result } = renderHook(() => useNotifications(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isError).toBe(true))
  })

  it("rejeita o shape flat histórico (S2-18 — só envelope canônico)", async () => {
    const { default: authApi } = await import("@/lib/api")
    vi.mocked(authApi.get).mockResolvedValue({
      data: { notifications: [], nextCursor: null, unreadCount: 0 },
    } as never)

    const { useNotifications } = await importModule()
    const { result } = renderHook(() => useNotifications(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isError).toBe(true))
  })

  it("rejeita data-array histórico (S2-18 — data é objeto)", async () => {
    const { default: authApi } = await import("@/lib/api")
    vi.mocked(authApi.get).mockResolvedValue({
      data: {
        data: [],
        pagination: { nextCursor: null, unreadCount: 0 },
      },
    } as never)

    const { useNotifications } = await importModule()
    const { result } = renderHook(() => useNotifications(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isError).toBe(true))
  })

  it("cursor inicial compõe a queryKey (sem colisão de cache)", async () => {
    const { default: authApi } = await import("@/lib/api")
    vi.mocked(authApi.get).mockResolvedValue({
      data: {
        data: { notifications: [], unreadCount: 0 },
        pagination: { nextCursor: null },
      },
    } as never)

    const { useNotifications } = await importModule()
    const { rerender } = renderHook(
      ({ cursor }: { cursor: string | null }) => useNotifications(cursor),
      { wrapper: createWrapper(), initialProps: { cursor: "c-a" } },
    )

    await waitFor(() => expect(authApi.get).toHaveBeenCalledTimes(1))
    rerender({ cursor: "c-b" })
    await waitFor(() => expect(authApi.get).toHaveBeenCalledTimes(2))
  })
})

describe("useUnreadCount (T038)", () => {
  it("lê unreadCount do envelope canônico (limit=1, unreadOnly)", async () => {
    const { default: authApi } = await import("@/lib/api")
    vi.mocked(authApi.get).mockResolvedValue({
      data: {
        data: {
          notifications: [
            {
              id: "n1",
              type: "follow",
              isRead: false,
              createdAt: "2026-09-26T10:00:00Z",
            },
          ],
          unreadCount: 3,
        },
        pagination: { nextCursor: null },
      },
    } as never)

    const { useUnreadCount } = await importModule()
    const { result } = renderHook(() => useUnreadCount(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toBe(3)
    expect(authApi.get).toHaveBeenCalledWith("/social/notifications", {
      params: { limit: 1, unreadOnly: true },
    })
  })

  it("rejeita envelope sem unreadCount (quebra de contrato S2-18)", async () => {
    const { default: authApi } = await import("@/lib/api")
    vi.mocked(authApi.get).mockResolvedValue({
      data: {
        data: { notifications: [] },
        pagination: { nextCursor: null },
      },
    } as never)

    const { useUnreadCount } = await importModule()
    const { result } = renderHook(() => useUnreadCount(), {
      wrapper: createWrapper(),
    })

    await waitFor(() => expect(result.current.isError).toBe(true))
  })
})
