// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest"
import { render, screen, fireEvent, cleanup } from "@testing-library/react"
import type { Spread } from "@/types/tarot"

vi.mock("@/lib/api", () => ({ default: { get: vi.fn(), post: vi.fn() } }))

afterEach(() => cleanup())

const mockSpreads = [
  {
    id: "single-card",
    name: "Carta Única",
    description: "Resposta rápida",
    deckType: "tarot" as const,
    cardCount: 1,
    difficulty: "beginner" as const,
    estimatedTime: 1,
    layout: "linear" as const,
    positions: [],
  },
  {
    id: "three-card",
    name: "Três Cartas",
    description: "Passado, Presente e Futuro",
    deckType: "tarot" as const,
    cardCount: 3,
    difficulty: "beginner" as const,
    estimatedTime: 3,
    layout: "linear" as const,
    positions: [],
  },
  {
    id: "celtic-cross",
    name: "Cruz Celta",
    description: "Espalhamento completo",
    deckType: "tarot" as const,
    cardCount: 10,
    difficulty: "advanced" as const,
    estimatedTime: 15,
    layout: "cross" as const,
    positions: [],
  },
] as Spread[]

describe("SpreadSelector", () => {
  async function importComponent() {
    return await import("@/components/tarot/spread-selector")
  }

  it("renders all spreads", async () => {
    const { SpreadSelector } = await importComponent()
    render(<SpreadSelector spreads={mockSpreads} onSelect={vi.fn()} />)

    expect(screen.getByText("Carta Única")).toBeDefined()
    expect(screen.getByText("Três Cartas")).toBeDefined()
    expect(screen.getByText("Cruz Celta")).toBeDefined()
  })

  it("calls onSelect with spread id", async () => {
    const onSelect = vi.fn()
    const { SpreadSelector } = await importComponent()
    render(<SpreadSelector spreads={mockSpreads} onSelect={onSelect} />)

    fireEvent.click(screen.getByText("Três Cartas"))
    expect(onSelect).toHaveBeenCalledWith("three-card")
  })

  it("filters by deckType", async () => {
    const lenormandSpread = {
      ...mockSpreads[0],
      id: "lenormand-3",
      deckType: "lenormand" as const,
    } as Spread
    const { SpreadSelector } = await importComponent()
    render(
      <SpreadSelector
        spreads={[...mockSpreads, lenormandSpread]}
        deckType="lenormand"
        onSelect={vi.fn()}
      />,
    )

    expect(screen.getByText("Carta Única")).toBeDefined()
    expect(screen.queryByText("Três Cartas")).toBeNull()
  })

  it("shows card count and estimated time", async () => {
    const { SpreadSelector } = await importComponent()
    render(<SpreadSelector spreads={mockSpreads} onSelect={vi.fn()} />)

    expect(screen.getByText(/3 cartas/)).toBeDefined()
    expect(screen.getByText(/~3 min/)).toBeDefined()
  })

  it("shows selected spread", async () => {
    const { SpreadSelector } = await importComponent()
    const { container } = render(
      <SpreadSelector
        spreads={mockSpreads}
        selectedSpreadId="celtic-cross"
        onSelect={vi.fn()}
      />,
    )
    const selected = container.querySelector("[data-selected=true]")
    expect(selected).toBeTruthy()
    expect(selected?.textContent).toContain("Cruz Celta")
  })

  it("renders empty state when no spreads match filter", async () => {
    const { SpreadSelector } = await importComponent()
    render(
      <SpreadSelector
        spreads={mockSpreads}
        deckType="lenormand"
        onSelect={vi.fn()}
      />,
    )
    expect(screen.getByText(/nenhum espalhamento/i)).toBeDefined()
  })
})
