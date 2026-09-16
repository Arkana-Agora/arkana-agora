import { describe, expect, it, vi, beforeEach, afterEach } from "vitest"
import { act, cleanup, render, screen, waitFor } from "@testing-library/react"

const { mockRouter, authState } = vi.hoisted(() => ({
  mockRouter: { replace: vi.fn() },
  authState: { user: null as { role: string } | null, isAuthenticated: false },
}))

vi.mock("next/navigation", () => ({
  useRouter: () => mockRouter,
}))

vi.mock("@/stores/auth-store", () => ({
  useAuthStore: (selector?: (state: Record<string, unknown>) => unknown) => {
    const state = {
      user: authState.user,
      isAuthenticated: authState.isAuthenticated,
      refreshSession: mockRefreshSession,
    }
    return selector ? selector(state) : state
  },
}))

export const mockRefreshSession = vi.fn()
export { mockRouter, authState }

import { AuthGuard } from "@/components/auth/auth-guard"

describe("AuthGuard", () => {
  afterEach(() => cleanup())

  beforeEach(() => {
    mockRefreshSession.mockReset()
    vi.clearAllMocks()
    authState.isAuthenticated = false
    authState.user = null
  })

  describe("authenticated at mount", () => {
    it("renders children without calling refreshSession", () => {
      authState.isAuthenticated = true
      authState.user = { role: "USER" }
      render(
        <AuthGuard>
          <div data-testid="protected">Protected content</div>
        </AuthGuard>,
      )

      expect(screen.getByTestId("protected")).toBeInTheDocument()
      expect(mockRefreshSession).not.toHaveBeenCalled()
    })

    it("blocks when role mismatch and redirects to login", async () => {
      mockRefreshSession.mockResolvedValue(true)
      authState.isAuthenticated = true
      authState.user = { role: "USER" }
      render(
        <AuthGuard requiredRole="ADMIN">
          <div data-testid="protected">Protected content</div>
        </AuthGuard>,
      )

      await waitFor(() => {
        expect(mockRouter.replace).toHaveBeenCalledWith("/login")
      })
      expect(screen.queryByTestId("protected")).not.toBeInTheDocument()
    })

    it("renders children when role matches", () => {
      authState.isAuthenticated = true
      authState.user = { role: "ADMIN" }
      render(
        <AuthGuard requiredRole="ADMIN">
          <div data-testid="protected">Protected content</div>
        </AuthGuard>,
      )

      expect(screen.getByTestId("protected")).toBeInTheDocument()
      expect(mockRouter.replace).not.toHaveBeenCalled()
    })
  })

  describe("not authenticated at mount", () => {
    it("shows loading skeleton while checking and renders children after successful refresh", async () => {
      let resolveRefresh!: (value: boolean) => void
      mockRefreshSession.mockReturnValue(
        new Promise((resolve) => {
          resolveRefresh = resolve
        }),
      )
      render(
        <AuthGuard>
          <div data-testid="protected">Protected content</div>
        </AuthGuard>,
      )

      expect(
        screen.getByRole("status", { name: /verificando sessao/i }),
      ).toBeInTheDocument()
      expect(mockRefreshSession).toHaveBeenCalled()

      await act(async () => {
        resolveRefresh(true)
        authState.isAuthenticated = true
        authState.user = { role: "USER" }
      })

      expect(
        screen.queryByRole("status", { name: /verificando sessao/i }),
      ).not.toBeInTheDocument()
      expect(screen.getByTestId("protected")).toBeInTheDocument()
    })

    it("redirects to /login when refresh fails", async () => {
      mockRefreshSession.mockResolvedValue(false)
      authState.isAuthenticated = false
      authState.user = null
      render(
        <AuthGuard>
          <div data-testid="protected">Protected content</div>
        </AuthGuard>,
      )

      await waitFor(() => {
        expect(mockRouter.replace).toHaveBeenCalledWith("/login")
      })
      expect(screen.queryByTestId("protected")).not.toBeInTheDocument()
    })

    it("redirects to /login when refresh succeeds but requiredRole not met (user null)", async () => {
      mockRefreshSession.mockResolvedValue(true)
      authState.isAuthenticated = true
      authState.user = null
      render(
        <AuthGuard requiredRole="ADMIN">
          <div data-testid="protected">Protected content</div>
        </AuthGuard>,
      )

      await waitFor(() => {
        expect(mockRouter.replace).toHaveBeenCalledWith("/login")
      })
      expect(screen.queryByTestId("protected")).not.toBeInTheDocument()
    })

    it("does not call refreshSession again after first mount", async () => {
      let resolveRefresh!: (value: boolean) => void
      mockRefreshSession.mockReturnValue(
        new Promise((resolve) => {
          resolveRefresh = resolve
        }),
      )
      authState.isAuthenticated = false
      authState.user = null
      render(
        <AuthGuard>
          <div data-testid="protected">Protected content</div>
        </AuthGuard>,
      )

      expect(mockRefreshSession).toHaveBeenCalledTimes(1)

      await act(async () => {
        resolveRefresh(true)
        authState.isAuthenticated = true
        authState.user = { role: "USER" }
      })

      expect(mockRefreshSession).toHaveBeenCalledTimes(1)
      expect(screen.getByTestId("protected")).toBeInTheDocument()
    })
  })
})
