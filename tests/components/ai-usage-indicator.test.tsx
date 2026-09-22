import { describe, it, expect, vi, afterEach } from "vitest"
import { render, screen, cleanup } from "@testing-library/react"
import { AIUsageIndicator } from "@/components/ai/ai-usage-indicator"

afterEach(() => {
  cleanup()
})

describe("AIUsageIndicator", () => {
  it("shows usage count", () => {
    render(<AIUsageIndicator used={3} total={10} />)
    expect(screen.getByText("3/10")).toBeTruthy()
    expect(screen.getByText(/interpretacoes hoje/)).toBeTruthy()
  })

  it("shows green color when plenty remaining", () => {
    render(<AIUsageIndicator used={2} total={10} />)
    const el = screen.getByText("2/10")
    expect(el.className).toContain("text-green")
  })

  it("shows yellow color when half used", () => {
    render(<AIUsageIndicator used={6} total={10} />)
    const el = screen.getByText("6/10")
    expect(el.className).toContain("text-yellow")
  })

  it("shows red color when almost empty", () => {
    render(<AIUsageIndicator used={9} total={10} />)
    const el = screen.getByText("9/10")
    expect(el.className).toContain("text-red")
  })

  it("shows upgrade button when empty and FREE", () => {
    const onUpgrade = vi.fn()
    render(
      <AIUsageIndicator
        used={10}
        total={10}
        tier="FREE"
        onUpgrade={onUpgrade}
      />,
    )
    screen.getByText("Upgrade").click()
    expect(onUpgrade).toHaveBeenCalled()
  })

  it("does not show upgrade for PLUS tier", () => {
    render(
      <AIUsageIndicator
        used={100}
        total={100}
        tier="PLUS"
        onUpgrade={vi.fn()}
      />,
    )
    expect(screen.queryByText("Upgrade")).toBeNull()
  })
})
