import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen, fireEvent, cleanup, act } from "@testing-library/react"
import { DailyTarot } from "@/components/tarot/daily-tarot"

const REVEAL_MS = 1500

describe("DailyTarot", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    cleanup()
  })

  it("renders title and formatted date", () => {
    cleanup()
    render(<DailyTarot />)
    expect(screen.getByText("Tarot do Dia")).toBeInTheDocument()
    expect(screen.getByText(/de \w+ de \d{4}/)).toBeInTheDocument()
  })

  it("mostra o VERSO da carta antes da revelacao (nao vaza o arcano)", () => {
    cleanup()
    render(<DailyTarot />)

    expect(screen.getByText("Virando a carta…")).toBeInTheDocument()
    expect(screen.queryByRole("heading", { level: 3 })).not.toBeInTheDocument()
    expect(screen.queryByText("Arcano do Dia")).not.toBeInTheDocument()
  })

  it("revela a carta do dia apos 1.5s (BR-TIR-003)", () => {
    cleanup()
    render(<DailyTarot />)

    act(() => {
      vi.advanceTimersByTime(REVEAL_MS)
    })

    expect(screen.getByRole("heading", { level: 3 })).toBeInTheDocument()
    expect(screen.getByText("Arcano do Dia")).toBeInTheDocument()
    expect(screen.queryByText("Virando a carta…")).not.toBeInTheDocument()
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

    act(() => {
      vi.advanceTimersByTime(REVEAL_MS)
    })
    const titleBefore = screen.getByRole("heading", { level: 3 }).textContent

    fireEvent.click(screen.getByRole("button", { name: "Atualizar data" }))

    expect(screen.getByRole("heading", { level: 3 }).textContent).toBe(
      titleBefore,
    )
  })

  it("renders upright meaning or inverted indicator", () => {
    cleanup()
    render(<DailyTarot />)

    act(() => {
      vi.advanceTimersByTime(REVEAL_MS)
    })

    const inverted = screen.queryByText("(Invertida)") !== null
    const hasMeaningParagraph = screen
      .getAllByText(/./)
      .some((n) => (n.textContent ?? "").length > 20)
    expect(inverted || hasMeaningParagraph).toBe(true)
  })
})
