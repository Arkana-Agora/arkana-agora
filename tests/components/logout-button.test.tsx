import { describe, it, expect, vi, beforeEach } from "vitest"
import {
  render,
  screen,
  fireEvent,
  waitFor,
  cleanup,
} from "@testing-library/react"

const { mockReplace, mockRefresh, mockLogout } = vi.hoisted(() => ({
  mockReplace: vi.fn(),
  mockRefresh: vi.fn(),
  mockLogout: vi.fn(),
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: mockReplace,
    refresh: mockRefresh,
  }),
}))

vi.mock("@/stores/auth-store", () => ({
  useAuthStore: (selector?: (state: Record<string, unknown>) => unknown) => {
    const state = { logout: mockLogout }
    return typeof selector === "function" ? selector(state) : state
  },
}))

import { LogoutButton } from "@/components/auth/logout-button"

describe("LogoutButton", () => {
  beforeEach(() => {
    cleanup()
    vi.clearAllMocks()
    mockLogout.mockResolvedValue(undefined)
  })

  it("renders enabled Sair button", () => {
    render(<LogoutButton />)
    const button = screen.getByRole("button", { name: /^sair$/i })
    expect(button).toBeEnabled()
  })

  it("calls logout, navigates to /login and refreshes", async () => {
    render(<LogoutButton />)

    fireEvent.click(screen.getByRole("button", { name: /^sair$/i }))

    await waitFor(() => expect(mockLogout).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/login"))
    expect(mockRefresh).toHaveBeenCalledTimes(1)
    expect(screen.getByRole("button", { name: /^sair$/i })).toBeEnabled()
  })

  it("shows Saindo... and disables while logout is pending", async () => {
    let resolveLogout: () => void = () => undefined
    mockLogout.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveLogout = resolve
        }),
    )

    render(<LogoutButton />)
    fireEvent.click(screen.getByRole("button", { name: /^sair$/i }))

    expect(screen.getByRole("button", { name: /saindo/i })).toBeDisabled()
    expect(mockReplace).not.toHaveBeenCalled()

    resolveLogout()

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/login"))
    expect(screen.getByRole("button", { name: /^sair$/i })).toBeEnabled()
  })

  it("navigates to /login even when logout rejects (finally branch)", async () => {
    mockLogout.mockRejectedValue(new Error("network down"))

    render(<LogoutButton />)
    fireEvent.click(screen.getByRole("button", { name: /^sair$/i }))

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/login"))
    expect(mockRefresh).toHaveBeenCalledTimes(1)
    expect(screen.getByRole("button", { name: /^sair$/i })).toBeEnabled()
  })
})
