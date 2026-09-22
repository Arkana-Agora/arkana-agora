import { describe, it, expect, vi } from "vitest"
import { render } from "@testing-library/react"
import { InterpretationRequest } from "@/components/ai/interpretation-request"

describe("InterpretationRequest", () => {
  it("renders mode and mood labels", () => {
    const { container } = render(
      <InterpretationRequest onInterpret={vi.fn()} />,
    )
    const text = container.textContent ?? ""
    expect(text).toContain("Geral")
    expect(text).toContain("Amor")
    expect(text).toContain("Carreira")
    expect(text).toContain("Sim/Nao")
    expect(text).toContain("Animado")
    expect(text).toContain("Reflexivo")
    expect(text).toContain("Gerar Interpretacao")
  })

  it("shows usage info when provided", () => {
    const { container } = render(
      <InterpretationRequest
        onInterpret={vi.fn()}
        usage={{ interpretations: 3, dailyLimit: 10, remaining: 7 }}
      />,
    )
    expect(container.textContent).toContain("3 de 10")
  })

  it("shows loading text when isLoading", () => {
    const { container } = render(
      <InterpretationRequest onInterpret={vi.fn()} isLoading />,
    )
    expect(container.textContent).toContain("Gerando...")
  })

  it("has correct structure", () => {
    const { container } = render(
      <InterpretationRequest onInterpret={vi.fn()} />,
    )
    expect(container.querySelector("h3")).toBeTruthy()
    expect(container.querySelectorAll("button").length).toBeGreaterThan(5)
  })
})
