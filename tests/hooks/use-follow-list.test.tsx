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
import type { ReactNode } from "react"

vi.mock("@/lib/api", () => ({ default: { get: vi.fn(), post: vi.fn() } }))

import authApi from "@/lib/api"
import { useFollowList } from "@/hooks/use-social"

const getMock = vi.mocked(authApi.get)

let queryClient: QueryClient

function createWrapper() {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )
  }
}

const alicePage = {
  data: [
    {
      userId: "usr_a",
      name: "Alice D",
      username: "alice",
      avatarUrl: null,
      isFollowing: false,
    },
  ],
  pagination: { nextCursor: "cursor_1" },
}

function TestComponent({
  username,
  side,
  q,
  enabled = true,
}: {
  username: string
  side: "followers" | "following"
  q?: string
  enabled?: boolean
}) {
  const list = useFollowList(username, side, q ?? "", enabled)
  return (
    <div>
      <span data-testid="status">
        {list.isLoading
          ? "loading"
          : list.isError
            ? "error"
            : list.data
              ? "success"
              : "empty"}
      </span>
      <span data-testid="count">
        {list.data?.pages.flatMap((p) => p.data).length ?? 0}
      </span>
      {list.hasNextPage && (
        <button
          onClick={() => void list.fetchNextPage()}
          data-testid="load-more"
        >
          Carregar mais
        </button>
      )}
    </div>
  )
}

beforeEach(() => {
  cleanup()
  vi.clearAllMocks()
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  getMock.mockResolvedValue({ data: alicePage })
})

afterEach(() => {
  cleanup()
})

describe("useFollowList hook (T044/T045/T048)", () => {
  it("busca followers com endpoint correto", async () => {
    render(<TestComponent username="alice_user" side="followers" />, {
      wrapper: createWrapper(),
    })
    await waitFor(() =>
      expect(screen.getByTestId("status")).toHaveTextContent("success"),
    )
    expect(getMock).toHaveBeenCalledWith("/users/alice_user/followers", {
      params: {},
    })
  })

  it("busca following com endpoint correto", async () => {
    render(<TestComponent username="alice_user" side="following" />, {
      wrapper: createWrapper(),
    })
    await waitFor(() =>
      expect(screen.getByTestId("status")).toHaveTextContent("success"),
    )
    expect(getMock).toHaveBeenCalledWith("/users/alice_user/following", {
      params: {},
    })
  })

  it("inclui parametro q na busca", async () => {
    render(<TestComponent username="alice_user" side="followers" q="ali" />, {
      wrapper: createWrapper(),
    })
    await waitFor(() =>
      expect(screen.getByTestId("status")).toHaveTextContent("success"),
    )
    expect(getMock).toHaveBeenCalledWith("/users/alice_user/followers", {
      params: { q: "ali" },
    })
  })

  it("inclui cursor na paginacao", async () => {
    getMock.mockResolvedValueOnce({ data: alicePage }).mockResolvedValueOnce({
      data: { data: [], pagination: { nextCursor: null } },
    })
    render(<TestComponent username="alice_user" side="followers" />, {
      wrapper: createWrapper(),
    })
    await waitFor(() =>
      expect(screen.getByTestId("status")).toHaveTextContent("success"),
    )

    fireEvent.click(screen.getByTestId("load-more"))
    await waitFor(() => {
      expect(getMock).toHaveBeenCalledWith("/users/alice_user/followers", {
        params: { cursor: "cursor_1" },
      })
    })
  })

  it("nao busca quando disabled=false", () => {
    render(
      <TestComponent username="alice_user" side="followers" enabled={false} />,
      { wrapper: createWrapper() },
    )
    expect(getMock).not.toHaveBeenCalled()
    expect(screen.getByTestId("status")).toHaveTextContent("empty")
  })

  it("retorna erro quando API falha", async () => {
    getMock.mockRejectedValue(new Error("network"))
    render(<TestComponent username="alice_user" side="followers" />, {
      wrapper: createWrapper(),
    })
    await waitFor(() =>
      expect(screen.getByTestId("status")).toHaveTextContent("error"),
    )
  })
})
