import { describe, it, expect, vi, afterEach } from "vitest"
import { render, screen, fireEvent, cleanup } from "@testing-library/react"
import { FollowUpChat } from "@/components/ai/follow-up-chat"

afterEach(() => {
  cleanup()
})

describe("FollowUpChat", () => {
  it("renders message counter", () => {
    render(<FollowUpChat messages={[]} onSendMessage={vi.fn()} />)
    expect(screen.getByText("10 de 10 mensagens")).toBeTruthy()
  })

  it("renders messages", () => {
    render(
      <FollowUpChat
        messages={[
          { role: "user", content: "Minha pergunta" },
          { role: "assistant", content: "Resposta da IA" },
        ]}
        onSendMessage={vi.fn()}
      />,
    )
    expect(screen.getByText("Minha pergunta")).toBeTruthy()
    expect(screen.getByText("Resposta da IA")).toBeTruthy()
  })

  it("calls onSendMessage when form submitted", () => {
    const onSendMessage = vi.fn()
    const { container } = render(
      <FollowUpChat messages={[]} onSendMessage={onSendMessage} />,
    )
    const input = screen.getByPlaceholderText("Faca uma pergunta...")
    fireEvent.change(input, { target: { value: "Nova pergunta" } })
    const form = container.querySelector("form")
    fireEvent.submit(form!)
    expect(onSendMessage).toHaveBeenCalledWith("Nova pergunta")
  })

  it("disables input during streaming", () => {
    const { container } = render(
      <FollowUpChat messages={[]} onSendMessage={vi.fn()} isStreaming={true} />,
    )
    const input = container.querySelector(
      'input[placeholder="Faca uma pergunta..."]',
    ) as HTMLInputElement
    expect(input).toBeDisabled()
  })

  it("shows new session button", () => {
    const onNewSession = vi.fn()
    render(
      <FollowUpChat
        messages={[]}
        onSendMessage={vi.fn()}
        onNewSession={onNewSession}
      />,
    )
    fireEvent.click(screen.getByText("Nova pergunta"))
    expect(onNewSession).toHaveBeenCalled()
  })
})
