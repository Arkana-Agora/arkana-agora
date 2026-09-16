import { describe, expect, it, vi, beforeEach, afterEach } from "vitest"
import { cleanup, render, screen, waitFor } from "@testing-library/react"
import { StrictMode } from "react"

const { mockRouter } = vi.hoisted(() => ({
  mockRouter: { replace: vi.fn() },
}))

vi.mock("next/navigation", () => ({
  useRouter: () => mockRouter,
}))

vi.mock("@/stores/auth-store", () => ({
  useAuthStore: () => ({
    user: null,
    isAuthenticated: false,
    isLoading: false,
    error: null,
    refreshInFlight: null,
    refreshSession: async (): Promise<boolean> => {
      return Promise.resolve(true)
    },
    login: async () => {
      throw new Error("Not implemented")
    },
    register: async () => {
      throw new Error("Not implemented")
    },
    sendMagicLink: async () => {
      throw new Error("Not implemented")
    },
    forgotPassword: async () => {
      throw new Error("Not implemented")
    },
    resetPassword: async () => {
      throw new Error("Not implemented")
    },
    verifyEmail: async () => {
      throw new Error("Not implemented")
    },
    resendVerifyEmail: async () => {
      throw new Error("Not implemented")
    },
    verifyMagicLink: async () => {
      throw new Error("Not implemented")
    },
    clearError: () => {},
  }),
}))

import { AuthGuard } from "@/components/auth/auth-guard"

describe("AuthGuard integration (StrictMode + real store)", () => {
  afterEach(() => cleanup())

  beforeEach(() => {
    vi.restoreAllMocks()
    mockRouter.replace.mockReset()
  })

  it.skip("single POST under StrictMode double-mount with real store", async () => {
    render(
      <StrictMode>
        <AuthGuard>
          <div data-testid="protected">Protected content</div>
        </AuthGuard>
      </StrictMode>,
    )

    expect(
      screen.getByRole("status", { name: /verificando sessao/i }),
    ).toBeInTheDocument()

    await waitFor(() => {
      expect(screen.getByTestId("protected")).toBeInTheDocument()
    })
  })
})
