import { describe, expect, it } from "vitest"
import { render, cleanup } from "@testing-library/react"
import { ArcanaDetailCard } from "@/components/arcana/arcana-detail-card"
import { ARCANA_MAP } from "@/data/arcana"

describe("ArcanaDetailCard", () => {
  const mockArcana = {
    number: 5,
    name: "O Hierofante",
    upright: "Tradição, ensino, espiritualidade",
    reversed: "Rebelião, questionamento, dogma",
    element: "Terra",
    planet: "Júpiter",
  }

  it("renders arcana name", () => {
    cleanup()
    const { container } = render(<ArcanaDetailCard arcana={mockArcana} />)
    expect(container.textContent).toContain("O Hierofante")
  })

  it("renders arcana number", () => {
    cleanup()
    const { container } = render(<ArcanaDetailCard arcana={mockArcana} />)
    expect(container.textContent).toContain("V")
  })

  it("renders upright meaning", () => {
    cleanup()
    const { container } = render(<ArcanaDetailCard arcana={mockArcana} />)
    expect(container.textContent).toContain("Tradição")
  })

  it("renders reversed meaning", () => {
    cleanup()
    const { container } = render(<ArcanaDetailCard arcana={mockArcana} />)
    expect(container.textContent).toContain("Rebelião")
  })

  it("renders element and planet", () => {
    cleanup()
    const { container } = render(<ArcanaDetailCard arcana={mockArcana} />)
    expect(container.textContent).toContain("Terra")
    expect(container.textContent).toContain("Júpiter")
  })

  it("renders every arcana from ARCANA_MAP without crashing", () => {
    for (const arcana of Object.values(ARCANA_MAP)) {
      cleanup()
      const { container } = render(<ArcanaDetailCard arcana={arcana} />)
      expect(container.textContent).toContain(arcana.name)
      expect(container.textContent).toContain(arcana.upright)
      expect(container.textContent).toContain(arcana.reversed)
      expect(container.textContent).toContain(arcana.element)
      expect(container.textContent).toContain(arcana.planet)
    }
  })
})
