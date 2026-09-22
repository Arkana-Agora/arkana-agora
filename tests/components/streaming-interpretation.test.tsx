import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { StreamingInterpretation } from "@/components/ai/streaming-interpretation"

describe("StreamingInterpretation", () => {
  it("renders content text", () => {
    render(
      <StreamingInterpretation
        content="Interpretacao completa"
        isStreaming={false}
      />,
    )
    expect(screen.getByText("Interpretacao completa")).toBeTruthy()
  })

  it("shows streaming indicator when no content", () => {
    render(<StreamingInterpretation content="" isStreaming={true} />)
    expect(screen.getByText("A IA esta escrevendo...")).toBeTruthy()
  })

  it("shows cached notice", () => {
    render(
      <StreamingInterpretation
        content="Cacheada"
        isStreaming={false}
        isCached={true}
      />,
    )
    expect(screen.getByText(/gerada anteriormente/)).toBeTruthy()
  })

  it("shows error with retry button", () => {
    const onRetry = vi.fn()
    render(
      <StreamingInterpretation
        content=""
        isStreaming={false}
        error="Erro ao gerar"
        onRetry={onRetry}
      />,
    )
    expect(screen.getByText("Erro ao gerar")).toBeTruthy()
    screen.getByText("Tentar novamente").click()
    expect(onRetry).toHaveBeenCalled()
  })

  it("shows stop button during streaming", () => {
    const onStop = vi.fn()
    render(
      <StreamingInterpretation
        content="Texto"
        isStreaming={true}
        onStop={onStop}
      />,
    )
    screen.getByText("Parar geracao").click()
    expect(onStop).toHaveBeenCalled()
  })

  it("shows action buttons when done", () => {
    render(<StreamingInterpretation content="Completa" isStreaming={false} />)
    expect(
      screen.getAllByText("Fazer perguntas").length,
    ).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText("Compartilhar").length).toBeGreaterThanOrEqual(1)
  })
})
