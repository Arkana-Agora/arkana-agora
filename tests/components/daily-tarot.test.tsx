import { describe, expect, it } from "vitest"
import { render, screen, fireEvent, cleanup } from "@testing-library/react"
import { DailyTarot } from "@/components/tarot/daily-tarot"

describe("DailyTarot", () => {
  it("renders title and formatted date", () => {
    cleanup()
    render(<DailyTarot />)
    expect(screen.getByText("Tarot do Dia")).toBeInTheDocument()
    expect(screen.getByText(/de \w+ de \d{4}/)).toBeInTheDocument()
  })

  it("renders daily card when available", () => {
    cleanup()
    render(<DailyTarot />)
    expect(screen.getByText("Arcano do Dia")).toBeInTheDocument()
    expect(screen.getByRole("heading", { level: 3 })).toBeInTheDocument()
  })

  it("has refresh button with accessible label", () => {
    cleanup()
    render(<DailyTarot />)
    expect(
      screen.getByRole("button", { name: "Atualizar data" }),
    ).toBeInTheDocument()
  })

  it("keeps card stable after refresh on same day", () => {
    cleanup()
    render(<DailyTarot />)
    const titleBefore = screen.getByRole("heading", { level: 3 }).textContent

    fireEvent.click(screen.getByRole("button", { name: "Atualizar data" }))

    expect(screen.getByRole("heading", { level: 3 }).textContent).toBe(
      titleBefore,
    )
  })

  it("renders upright meaning or inverted indicator", () => {
    cleanup()
    const { container } = render(<DailyTarot />)
    const text = container.textContent ?? ""
    const inverted = text.includes("(Invertida)")
    const hasMeaningParagraph = screen
      .getAllByText(/./)
      .some((n) => (n.textContent ?? "").length > 20)
    expect(inverted || hasMeaningParagraph).toBe(true)
  })
})
