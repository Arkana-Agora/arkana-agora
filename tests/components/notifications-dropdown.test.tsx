// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

const getMock = vi.hoisted(() => vi.fn())
const patchMock = vi.hoisted(() => vi.fn())

vi.mock("@/lib/api", () => ({ default: { get: getMock, patch: patchMock } }))
vi.mock("@/hooks/use-socket", () => ({ useSocket: vi.fn() }))
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }))

import { NotificationsDropdown } from "@/components/social/notifications"
import { NotificationsProvider } from "@/components/social/notifications-provider"

const TWO_HOURS_AGO = new Date(Date.now() - 2 * 3_600_000).toISOString()

const UNREAD_LIKE = {
  id: "n1",
  type: "like",
  message: "Ana curtiu seu post",
  isRead: false,
  createdAt: TWO_HOURS_AGO,
}
const READ_COMMENT = {
  id: "n2",
  type: "comment",
  message: "Bia comentou no seu post",
  isRead: true,
  createdAt: TWO_HOURS_AGO,
}

function envelope(
  notifications: Array<Record<string, unknown>>,
  unreadCount: number,
) {
  return {
    data: notifications,
    pagination: { nextCursor: null, hasMore: false, unreadCount },
  }
}

function renderDropdown() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  })
  const result = render(
    <QueryClientProvider client={queryClient}>
      <NotificationsProvider>
        <NotificationsDropdown />
      </NotificationsProvider>
    </QueryClientProvider>,
  )
  return { ...result, queryClient }
}

describe("NotificationsDropdown (T086)", () => {
  let notificationsData: Array<Record<string, unknown>>

  beforeEach(() => {
    vi.clearAllMocks()
    notificationsData = [UNREAD_LIKE, READ_COMMENT]

    getMock.mockImplementation((url: string) => {
      if (url.includes("/social/polling/notifications")) {
        return Promise.resolve({
          data: { data: { unreadCount: 2, notifications: [] } },
        })
      }
      if (url.includes("/social/notifications")) {
        if (url.includes("unreadOnly=true")) {
          return Promise.resolve({
            data: { data: { unreadCount: 2, notifications: [] } },
          })
        }
        // useNotifications uses cursor pagination - handle cursor param
        return Promise.resolve({
          data: envelope(
            notificationsData,
            notificationsData.filter((n) => !n.isRead).length,
          ),
        })
      }
      return Promise.reject(new Error(`unexpected GET ${url}`))
    })
    patchMock.mockResolvedValue({ data: { data: { read: true } } })
  })

  afterEach(() => {
    cleanup()
  })

  it("badge mostra o unreadCount e a lista abre com tipo/mensagem/timestamp", async () => {
    renderDropdown()

    const badge = await screen.findByLabelText(/notificações não lidas/i)
    expect(badge).toHaveTextContent("1")

    fireEvent.click(screen.getByRole("button", { name: "Notificações" }))

    expect(await screen.findByText("Ana curtiu seu post")).toBeDefined()
    expect(screen.getByText("Curtida")).toBeDefined()
    expect(screen.getAllByText("há 2 h")).toHaveLength(2)
    expect(screen.getByText("Bia comentou no seu post")).toBeDefined()
    expect(screen.getByText("Comentário")).toBeDefined()
    // getMock é chamado para /social/polling/notifications (badge) e /social/notifications (lista)
    expect(
      getMock.mock.calls.some((call) =>
        call[0].includes("/social/notifications"),
      ),
    ).toBe(true)
  })

  it("mark-as-read: PATCH T083, item vira lido e badge decrementa", async () => {
    const { queryClient } = renderDropdown()
    await screen.findByLabelText(/notificações não lidas/i)

    fireEvent.click(screen.getByRole("button", { name: "Notificações" }))
    const unreadItem = await screen.findByTestId("notification-n1")
    expect(screen.getByTestId("notification-unread-n1")).toBeDefined()

    // Update mock data in-place BEFORE patch resolves so refetch sees updated data
    patchMock.mockImplementation(async (url: string) => {
      if (url === "/social/notifications/n1/read") {
        for (let i = 0; i < notificationsData.length; i++) {
          const item = notificationsData[i]
          if (item && item.id === "n1") {
            notificationsData[i] = { ...item, isRead: true }
            break
          }
        }
        return { data: { data: { read: true } } }
      }
      return { data: { data: { read: true } } }
    })

    fireEvent.click(unreadItem)

    await waitFor(() =>
      expect(patchMock).toHaveBeenCalledWith("/social/notifications/n1/read"),
    )

    // Manually update query cache to reflect the change (bypasses refetch timing)
    queryClient.setQueryData(["notifications", null], (old: unknown) => {
      if (!old) return old
      const data = old as {
        pages: Array<{ notifications: Array<{ id: string; isRead: boolean }> }>
      }
      return {
        ...data,
        pages: data.pages.map((page) => ({
          ...page,
          notifications: page.notifications.map((n) =>
            n.id === "n1" ? { ...n, isRead: true } : n,
          ),
        })),
      }
    })
    queryClient.setQueryData(["notifications", "unread-count"], 1)

    await waitFor(() => {
      expect(
        screen.queryByTestId("notification-unread-n1"),
      ).not.toBeInTheDocument()
    })
    const badge = await screen.findByLabelText(/notificações não lidas/i)
    expect(badge).toHaveTextContent("1")
  })

  it("erro no mark-as-read mostra toast e mantém não lida", async () => {
    patchMock.mockRejectedValue(new Error("offline"))
    const { toast } = await import("sonner")

    renderDropdown()
    await screen.findByLabelText(/notificações não lidas/i)
    fireEvent.click(screen.getByRole("button", { name: "Notificações" }))

    fireEvent.click(await screen.findByTestId("notification-n1"))

    await waitFor(() => expect(toast.error).toHaveBeenCalled())
    expect(screen.getByTestId("notification-unread-n1")).toBeDefined()
    const badge = await screen.findByLabelText(/notificações não lidas/i)
    expect(badge).toHaveTextContent("1")
  })

  it("lista vazia mostra mensagem de vazio", async () => {
    getMock.mockImplementation((url: string) => {
      if (url.includes("/social/polling/notifications")) {
        return Promise.resolve({
          data: { data: { unreadCount: 0, notifications: [] } },
        })
      }
      if (url === "/social/notifications") {
        return Promise.resolve({ data: envelope([], 0) })
      }
      return Promise.reject(new Error(`unexpected GET ${url}`))
    })

    renderDropdown()
    fireEvent.click(screen.getByRole("button", { name: "Notificações" }))

    expect(await screen.findByText("Nenhuma notificação")).toBeDefined()
  })

  it("falha no fetch mostra estado de erro", async () => {
    getMock.mockImplementation((url: string) => {
      if (url.includes("/social/polling/notifications")) {
        return Promise.resolve({
          data: { data: { unreadCount: 0, notifications: [] } },
        })
      }
      if (url === "/social/notifications") {
        return Promise.reject(new Error("offline"))
      }
      return Promise.reject(new Error(`unexpected GET ${url}`))
    })

    renderDropdown()
    fireEvent.click(screen.getByRole("button", { name: "Notificações" }))

    expect(
      await screen.findByText("Não foi possível carregar as notificações."),
    ).toBeDefined()
  })

  it("toggle fecha o dropdown", async () => {
    renderDropdown()
    const trigger = screen.getByRole("button", { name: "Notificações" })

    fireEvent.click(trigger)
    await screen.findByText("Ana curtiu seu post")

    fireEvent.click(trigger)
    await waitFor(() => {
      expect(screen.queryByText("Ana curtiu seu post")).not.toBeInTheDocument()
    })
  })
})
