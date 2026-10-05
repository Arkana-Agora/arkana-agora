// @vitest-environment jsdom
import { act, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const apiGetMock = vi.hoisted(() => vi.fn())
let socketHandlers: Record<string, (payload: unknown) => void> = vi.hoisted(
  () => ({}),
)

vi.mock("@/lib/api", () => ({ default: { get: apiGetMock } }))
vi.mock("@/hooks/use-socket", () => ({
  useSocket: (handlers: Record<string, (payload: unknown) => void>) => {
    socketHandlers = handlers
    return undefined
  },
}))
vi.mock("next/navigation", () => ({ usePathname: () => "/dashboard" }))

import { AppHeader } from "@/components/layout/app-header"
import { MobileNav } from "@/components/layout/mobile-nav"
import {
  NotificationsProvider,
  useNotifications,
} from "@/components/social/notifications-provider"

function Probe() {
  const { unreadCount } = useNotifications()
  return <span data-testid="count">{String(unreadCount)}</span>
}

describe("NotificationsProvider (T073)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    socketHandlers = {}
    apiGetMock.mockResolvedValue({
      data: { data: { unreadCount: 3, notifications: [] } },
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it("carrega unreadCount inicial do polling", async () => {
    render(
      <NotificationsProvider>
        <Probe />
      </NotificationsProvider>,
    )

    await waitFor(() =>
      expect(screen.getByTestId("count")).toHaveTextContent("3"),
    )
    expect(apiGetMock).toHaveBeenCalledWith(
      expect.stringContaining("/social/polling/notifications"),
    )
  })

  it("evento notification do WebSocket incrementa o unreadCount", async () => {
    render(
      <NotificationsProvider>
        <Probe />
      </NotificationsProvider>,
    )
    await waitFor(() =>
      expect(screen.getByTestId("count")).toHaveTextContent("3"),
    )

    act(() => {
      socketHandlers["notification"]?.({
        id: "n9",
        type: "like",
        message: "curtiu",
      })
    })

    expect(screen.getByTestId("count")).toHaveTextContent("4")
  })

  it("mesmo id de notification não conta duas vezes", async () => {
    render(
      <NotificationsProvider>
        <Probe />
      </NotificationsProvider>,
    )
    await waitFor(() =>
      expect(screen.getByTestId("count")).toHaveTextContent("3"),
    )

    act(() => {
      socketHandlers["notification"]?.({
        id: "n9",
        type: "like",
        message: "curtiu",
      })
      socketHandlers["notification"]?.({
        id: "n9",
        type: "like",
        message: "curtiu",
      })
    })

    expect(screen.getByTestId("count")).toHaveTextContent("4")
  })

  it("re-dispatch de id já vindo no baseline não incrementa", async () => {
    apiGetMock.mockResolvedValue({
      data: {
        data: {
          unreadCount: 3,
          notifications: [{ id: "nA", type: "follow", message: "seguiu" }],
        },
      },
    })
    render(
      <NotificationsProvider>
        <Probe />
      </NotificationsProvider>,
    )
    await waitFor(() =>
      expect(screen.getByTestId("count")).toHaveTextContent("3"),
    )

    // janela de sobreposição (poll reexecutou após falha/disconnect)
    act(() => {
      socketHandlers["notification"]?.({
        id: "nA",
        type: "follow",
        message: "seguiu",
      })
    })

    expect(screen.getByTestId("count")).toHaveTextContent("3")
  })

  it("ids diferentes continuam incrementando", async () => {
    render(
      <NotificationsProvider>
        <Probe />
      </NotificationsProvider>,
    )
    await waitFor(() =>
      expect(screen.getByTestId("count")).toHaveTextContent("3"),
    )

    act(() => {
      socketHandlers["notification"]?.({ id: "n1", type: "like", message: "a" })
      socketHandlers["notification"]?.({ id: "n2", type: "like", message: "b" })
    })

    expect(screen.getByTestId("count")).toHaveTextContent("5")
  })

  it("falha de polling não derruba o provider (unreadCount 0)", async () => {
    apiGetMock.mockRejectedValue(new Error("offline"))
    render(
      <NotificationsProvider>
        <Probe />
      </NotificationsProvider>,
    )

    await waitFor(() =>
      expect(screen.getByTestId("count")).toHaveTextContent("0"),
    )
  })
})

describe("AppHeader badge (T073)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    socketHandlers = {}
    apiGetMock.mockResolvedValue({
      data: { data: { unreadCount: 3, notifications: [] } },
    })
  })

  it("mostra badge com o unreadCount dentro do provider", async () => {
    render(
      <NotificationsProvider>
        <AppHeader />
      </NotificationsProvider>,
    )

    const badge = await screen.findByLabelText(/notificações não lidas/i)
    expect(badge).toHaveTextContent("3")
  })

  it("renderiza sem provider (contexto default, sem badge)", () => {
    render(<AppHeader />)
    expect(
      screen.queryByLabelText(/notificações não lidas/i),
    ).not.toBeInTheDocument()
  })
})

describe("MobileNav badge (revisão U)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    socketHandlers = {}
    apiGetMock.mockResolvedValue({
      data: { data: { unreadCount: 3, notifications: [] } },
    })
  })

  it("mostra badge mobile com o unreadCount dentro do provider", async () => {
    render(
      <NotificationsProvider>
        <MobileNav />
      </NotificationsProvider>,
    )

    const badge = await screen.findByTestId("unread-notifications-badge-mobile")
    expect(badge).toHaveTextContent("3")
    expect(badge.getAttribute("aria-label")).toMatch(/notificações não lidas/i)
  })

  it("cap do badge em 99+", async () => {
    apiGetMock.mockResolvedValue({
      data: { data: { unreadCount: 150, notifications: [] } },
    })
    render(
      <NotificationsProvider>
        <MobileNav />
      </NotificationsProvider>,
    )

    const badge = await screen.findByTestId("unread-notifications-badge-mobile")
    expect(badge).toHaveTextContent("99+")
  })

  it("renderiza sem provider (contexto default, sem badge mobile)", () => {
    render(<MobileNav />)
    expect(
      screen.queryByTestId("unread-notifications-badge-mobile"),
    ).not.toBeInTheDocument()
  })
})
