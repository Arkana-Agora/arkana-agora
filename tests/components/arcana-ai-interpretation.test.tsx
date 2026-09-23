import { describe, expect, it, vi } from "vitest"
import { render, screen, fireEvent, cleanup } from "@testing-library/react"
import { ArcanaAIInterpretation } from "@/components/arcana/arcana-ai-interpretation"

describe("ArcanaAIInterpretation", () => {
  it("renders interpret button when not streaming", () => {
    cleanup()
    const { container } = render(
      <ArcanaAIInterpretation onInterpret={() => {}} />,
    )
    const buttons = container.querySelectorAll("button")
    const texts = Array.from(buttons).map((b) => b.textContent ?? "")
    expect(texts.some((t) => t.includes("Interpretar"))).toBe(true)
  })

  it("calls onInterpret when clicked", () => {
    cleanup()
    const onInterpret = vi.fn()
    render(<ArcanaAIInterpretation onInterpret={onInterpret} />)
    fireEvent.click(screen.getByRole("button", { name: "Interpretar com IA" }))
    expect(onInterpret).toHaveBeenCalledOnce()
  })

  it("shows streaming content when provided", () => {
    cleanup()
    const { container } = render(
      <ArcanaAIInterpretation streamingContent="O Hierofante governa..." />,
    )
    expect(container.textContent).toContain("O Hierofante governa...")
    expect(
      screen.queryByRole("button", { name: "Interpretar com IA" }),
    ).not.toBeInTheDocument()
  })

  it("shows loading indicator when streaming", () => {
    cleanup()
    const { container } = render(<ArcanaAIInterpretation isStreaming={true} />)
    expect(container.textContent).toContain("Gerando")
  })

  it("disables button while streaming", () => {
    cleanup()
    const onInterpret = vi.fn()
    const { container } = render(
      <ArcanaAIInterpretation isStreaming onInterpret={onInterpret} />,
    )
    const button = container.querySelector("button") as HTMLButtonElement
    expect(button.disabled).toBe(true)
    fireEvent.click(button)
    expect(onInterpret).not.toHaveBeenCalled()
  })
})
