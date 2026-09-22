// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest"
import { render, screen, fireEvent, cleanup } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import type { ReactNode } from "react"

vi.mock("@/lib/api", () => ({ default: { get: vi.fn(), post: vi.fn() } }))

function createWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  }
}

afterEach(() => {
  cleanup()
})

describe("DailyLimitBanner", () => {
  it("shows remaining count when remaining > 0", async () => {
    const { DailyLimitBanner } =
      await import("@/components/tarot/daily-limit-banner")
    render(<DailyLimitBanner limit={3} remaining={2} tier="FREE" />, {
      wrapper: createWrapper(),
    })
    expect(screen.getByText(/2 restantes/)).toBeDefined()
  })

  it("shows remaining count when remaining === limit", async () => {
    const { DailyLimitBanner } =
      await import("@/components/tarot/daily-limit-banner")
    render(<DailyLimitBanner limit={3} remaining={3} tier="FREE" />, {
      wrapper: createWrapper(),
    })
    expect(screen.getByText(/3 restantes/)).toBeDefined()
  })

  it("renders limit-reached banner without upgrade when no onUpgrade", async () => {
    const { DailyLimitBanner } =
      await import("@/components/tarot/daily-limit-banner")
    render(<DailyLimitBanner limit={3} remaining={0} tier="FREE" />, {
      wrapper: createWrapper(),
    })
    expect(screen.getByText(/limite diário atingido/i)).toBeDefined()
    expect(screen.getByText(/FREE/i)).toBeDefined()
  })

  it("calls onUpgrade when CTA clicked", async () => {
    const onUpgrade = vi.fn()
    const { DailyLimitBanner } =
      await import("@/components/tarot/daily-limit-banner")
    render(
      <DailyLimitBanner
        limit={3}
        remaining={0}
        tier="FREE"
        onUpgrade={onUpgrade}
      />,
      { wrapper: createWrapper() },
    )
    fireEvent.click(screen.getByRole("button", { name: /upgrade/i }))
    expect(onUpgrade).toHaveBeenCalledOnce()
  })
})
