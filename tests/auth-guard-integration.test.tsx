import { describe, expect, it, vi, beforeEach, afterEach } from "vitest"
import { act, cleanup, render, screen, waitFor } from "@testing-library/react"
import { StrictMode } from "react"

const { mockRouter } = vi.hoisted(() => ({
  mockRouter: { replace: vi.fn() },
}))

vi.mock("next/navigation", () => ({
  useRouter: () => mockRouter,
}))

import { useAuthStore } from "@/stores/auth-store"
import { AuthGuard } from "@/components/auth/auth-guard"

describe("AuthGuard integration (StrictMode + real store)", () => {
  afterEach(() => cleanup())

  beforeEach(() => {
    vi.restoreAllMocks()
    mockRouter.replace.mockReset()
    useAuthStore.setState({
      isAuthenticated: false,
      user: null,
      isLoading: false,
      error: null,
    })
  })

  it("single POST under StrictMode double-mount with real store", async () => {
    let resolveFetch!: (r: Response) => void
    const fetchMock = vi.fn().mockReturnValue(
      new Promise<Response>((r) => {
        resolveFetch = r
      }),
    )
    vi.stubGlobal("fetch", fetchMock)

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

    await act(async () => {
      resolveFetch(
        new Response(
          JSON.stringify({ accessToken: "access-test", expiresIn: 900 }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        ),
      )
    })

    await waitFor(() => {
      expect(screen.getByTestId("protected")).toBeInTheDocument()
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/auth/refresh",
      expect.objectContaining({ method: "POST" }),
    )
  })
})
