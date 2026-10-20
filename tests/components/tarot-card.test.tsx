// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { TarotCard } from "@/components/tarot/tarot-card"

function imgSrcs(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll("img")).map(
    (img) => img.getAttribute("src") ?? "",
  )
}

describe("TarotCard verso/frente (BR-TIR-002, spec 003 §1.4)", () => {
  const front = "/images/decks/rws/rws-major-0.jpg"
  const back = "/images/decks/rws-back.jpg"

  it("mostra a imagem de VERSO quando a carta esta virada para baixo", () => {
    const { container } = render(
      <TarotCard
        name="O Louco"
        imageUrl={front}
        backImageUrl={back}
        isFlipped={false}
      />,
    )

    const srcs = imgSrcs(container)
    expect(srcs.some((s) => s.includes("rws-back.jpg"))).toBe(true)
    expect(srcs.some((s) => s.includes("rws-major-0.jpg"))).toBe(false)
  })

  it("mostra a FRENTE (imagem + nome + orientacao) quando revelada", () => {
    const { container } = render(
      <TarotCard
        name="O Louco"
        imageUrl={front}
        backImageUrl={back}
        isFlipped
        isReversed
      />,
    )

    const srcs = imgSrcs(container)
    expect(srcs.some((s) => s.includes("rws-major-0.jpg"))).toBe(true)
    expect(screen.getByText("O Louco")).toBeInTheDocument()
    expect(screen.getByText("Invertida")).toBeInTheDocument()
  })

  it("rotaciona a frente 180° quando a carta esta invertida (spec 003 §1.4)", () => {
    const { container } = render(
      <TarotCard
        name="O Louco"
        imageUrl={front}
        backImageUrl={back}
        isFlipped
        isReversed
      />,
    )

    const face = container.querySelector('img[src*="rws-major-0.jpg"]')
    expect(face?.parentElement?.className).toContain("rotate-180")
  })

  it("nao rotaciona a frente quando a carta esta ereta", () => {
    const { container } = render(
      <TarotCard
        name="O Louco"
        imageUrl={front}
        backImageUrl={back}
        isFlipped
      />,
    )

    const face = container.querySelector('img[src*="rws-major-0.jpg"]')
    expect(face?.parentElement?.className ?? "").not.toContain("rotate-180")
  })

  it("e acessivel por teclado (role button + Enter/Space disparam o flip)", () => {
    const onFlip = vi.fn()
    render(
      <TarotCard
        name="O Louco"
        imageUrl={front}
        backImageUrl={back}
        isFlipped={false}
        onFlip={onFlip}
      />,
    )

    const button = screen.getByRole("button", { name: "Virar carta: O Louco" })
    expect(button).toHaveAttribute("aria-pressed", "false")

    fireEvent.keyDown(button, { key: "Enter" })
    fireEvent.keyDown(button, { key: " " })
    expect(onFlip).toHaveBeenCalledTimes(2)
  })
})
