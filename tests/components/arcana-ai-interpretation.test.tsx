import { describe, it, expect } from "vitest"
import { render } from "@testing-library/react"
import { ArcanaAIInterpretation } from "@/components/arcana/arcana-ai-interpretation"

describe("ArcanaAIInterpretation", () => {
  it("renders interpret button when not streaming", () => {
    const { container } = render(
      <ArcanaAIInterpretation onInterpret={() => {}} />,
    )
    const buttons = container.querySelectorAll("button")
    const texts = Array.from(buttons).map((b) => b.textContent ?? "")
    expect(texts.some((t) => t.includes("Interpretar"))).toBe(true)
  })

  it("shows streaming content when provided", () => {
    const { container } = render(
      <ArcanaAIInterpretation streamingContent="O Hierofante governa..." />,
    )
    expect(container.textContent).toContain("O Hierofante governa...")
  })

  it("shows loading indicator when streaming", () => {
    const { container } = render(<ArcanaAIInterpretation isStreaming={true} />)
    expect(container.textContent).toContain("Gerando")
  })
})
