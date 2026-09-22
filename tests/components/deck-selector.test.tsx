// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest"
import { render, screen, fireEvent, cleanup } from "@testing-library/react"
import type { Deck } from "@/types/tarot"

vi.mock("@/lib/api", () => ({ default: { get: vi.fn(), post: vi.fn() } }))

afterEach(() => cleanup())

const mockDecks = [
  {
    id: "rws",
    name: "Rider-Waite-Smith",
    description: "O baralho clássico",
    author: "A.E. Waite",
    year: 1909,
    cardCount: 78,
    hasReversals: true,
    coverImageUrl: "/decks/rws/cover.jpg",
    cardBackImageUrl: "/decks/rws/back.jpg",
  },
  {
    id: "thoth",
    name: "Thoth",
    description: "Baralho de Aleister Crowley",
    author: "Aleister Crowley",
    year: 1943,
    cardCount: 78,
    hasReversals: false,
    coverImageUrl: "/decks/thoth/cover.jpg",
    cardBackImageUrl: "/decks/thoth/back.jpg",
  },
  {
    id: "lenormand",
    name: "Lenormand",
    description: "36 cartas de Lenormand",
    author: "Madame Lenormand",
    year: 1845,
    cardCount: 36,
    hasReversals: false,
    coverImageUrl: "/decks/lenormand/cover.jpg",
    cardBackImageUrl: "/decks/lenormand/back.jpg",
  },
] as Deck[]

describe("DeckSelector", () => {
  async function importComponent() {
    return await import("@/components/tarot/deck-selector")
  }

  it("renders all deck options", async () => {
    const { DeckSelector } = await importComponent()
    render(<DeckSelector decks={mockDecks} onSelect={vi.fn()} />)

    expect(screen.getByText("Rider-Waite-Smith")).toBeDefined()
    expect(screen.getByText("Thoth")).toBeDefined()
    expect(screen.getByText("Lenormand")).toBeDefined()
  })

  it("calls onSelect with deck id when clicked", async () => {
    const onSelect = vi.fn()
    const { DeckSelector } = await importComponent()
    render(<DeckSelector decks={mockDecks} onSelect={onSelect} />)

    fireEvent.click(screen.getByText("Rider-Waite-Smith"))
    expect(onSelect).toHaveBeenCalledWith("rws")
  })

  it("shows deck description", async () => {
    const { DeckSelector } = await importComponent()
    render(<DeckSelector decks={mockDecks} onSelect={vi.fn()} />)

    expect(screen.getByText("O baralho clássico")).toBeDefined()
  })

  it("shows card count", async () => {
    const { DeckSelector } = await importComponent()
    render(<DeckSelector decks={mockDecks} onSelect={vi.fn()} />)

    const matches = screen.getAllByText(/78 cartas/)
    expect(matches.length).toBeGreaterThanOrEqual(2)
  })

  it("highlights selected deck", async () => {
    const { DeckSelector } = await importComponent()
    const { container } = render(
      <DeckSelector
        decks={mockDecks}
        selectedDeckId="thoth"
        onSelect={vi.fn()}
      />,
    )
    const selected = container.querySelector("[data-selected=true]")
    expect(selected).toBeTruthy()
    expect(selected?.textContent).toContain("Thoth")
  })

  it("renders empty state when no decks", async () => {
    const { DeckSelector } = await importComponent()
    render(<DeckSelector decks={[]} onSelect={vi.fn()} />)
    expect(screen.getByText(/nenhum baralho/i)).toBeDefined()
  })
})
