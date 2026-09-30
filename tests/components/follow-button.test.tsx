// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { ComponentProps, ReactNode } from "react"

vi.mock("@/lib/api", () => ({ default: { get: vi.fn(), post: vi.fn() } }))
vi.mock("sonner", () => ({
  toast: { error: vi.fn() },
}))

import authApi from "@/lib/api"
import { toast } from "sonner"
import { FollowButton } from "@/components/social/follow-button"

const postMock = vi.mocked(authApi.post)
const toastMock = vi.mocked(toast)

let queryClient: QueryClient

function createWrapper() {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )
  }
}

function renderButton(
  props: Partial<ComponentProps<typeof FollowButton>> = {},
) {
  return render(
    <FollowButton
      targetUserId="usr_target"
      username="target_user"
      initialFollowing={false}
      {...props}
    />,
    { wrapper: createWrapper() },
  )
}

beforeEach(() => {
  cleanup()
  vi.clearAllMocks()
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
})

afterEach(() => {
  cleanup()
})

describe("FollowButton (T047/AC-1/AC-2)", () => {
  it("renderiza Seguir quando nao segue", () => {
    renderButton()
    expect(screen.getByRole("button", { name: "Seguir" })).toBeDefined()
  })

  it("renderiza Deixar de seguir quando ja segue", () => {
    renderButton({ initialFollowing: true })
    expect(
      screen.getByRole("button", { name: "Deixar de seguir" }),
    ).toBeDefined()
  })

  it("estado inicial derivado do cache do profile (isFollowing)", () => {
    queryClient.setQueryData(["profile", "target_user"], { isFollowing: true })
    renderButton({ initialFollowing: false })
    expect(
      screen.getByRole("button", { name: "Deixar de seguir" }),
    ).toBeDefined()
  })

  it("fica disabled enquanto a mutacao esta pendente", async () => {
    postMock.mockReturnValue(new Promise(() => {}) as never)
    renderButton()
    const btn = screen.getByRole("button", { name: "Seguir" })
    fireEvent.click(btn)
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Deixar de seguir" }),
      ).toBeDefined()
    })
    expect(
      screen.getByRole("button", { name: "Deixar de seguir" }),
    ).toHaveProperty("disabled", true)
  })

  it("chama POST /social/follow/:userId", async () => {
    postMock.mockResolvedValue({
      data: {
        data: { following: true, followingCount: 1, followersCount: 7 },
      },
    })
    renderButton()
    fireEvent.click(screen.getByRole("button", { name: "Seguir" }))
    await waitFor(() => {
      expect(postMock).toHaveBeenCalledWith("/social/follow/usr_target")
    })
  })

  it("atualiza otimisticamente o cache do profile via TanStack Query", async () => {
    queryClient.setQueryData(["profile", "target_user"], {
      isFollowing: false,
    })
    postMock.mockReturnValue(new Promise(() => {}) as never)
    renderButton()
    fireEvent.click(screen.getByRole("button", { name: "Seguir" }))

    expect(
      screen.getByRole("button", { name: "Deixar de seguir" }),
    ).toBeDefined()
    await waitFor(() => {
      const cached = queryClient.getQueryData(["profile", "target_user"]) as {
        isFollowing?: boolean
      }
      expect(cached.isFollowing).toBe(true)
    })
  })

  it("reverte o estado otimistico quando a mutacao falha", async () => {
    queryClient.setQueryData(["profile", "target_user"], {
      isFollowing: false,
    })
    postMock.mockRejectedValue(new Error("network"))
    renderButton()
    fireEvent.click(screen.getByRole("button", { name: "Seguir" }))
    expect(
      screen.getByRole("button", { name: "Deixar de seguir" }),
    ).toBeDefined()

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Seguir" })).toBeDefined()
    })
    await waitFor(() => {
      const cached = queryClient.getQueryData(["profile", "target_user"]) as {
        isFollowing?: boolean
      }
      expect(cached.isFollowing).toBe(false)
    })
    expect(toastMock.error).toHaveBeenCalledWith(
      "Não foi possível atualizar o seguimento. Tente novamente.",
    )
  })

  it("invalida cache de follows no onSettled", async () => {
    queryClient.setQueryData(["follows", "target_user", "followers", ""], {
      data: [],
      pagination: { nextCursor: null },
    })
    postMock.mockResolvedValue({
      data: {
        data: { following: true, followingCount: 1, followersCount: 7 },
      },
    })
    renderButton()
    fireEvent.click(screen.getByRole("button", { name: "Seguir" }))
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Deixar de seguir" }),
      ).toBeDefined()
    })
    await waitFor(() => {
      const state = queryClient.getQueryState([
        "follows",
        "target_user",
        "followers",
        "",
      ])
      expect(state?.isInvalidated).toBe(true)
    })
  })
})
