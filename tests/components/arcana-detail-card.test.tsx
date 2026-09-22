import { describe, it, expect } from "vitest"
import { render } from "@testing-library/react"
import { ArcanaDetailCard } from "@/components/arcana/arcana-detail-card"

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
    const { container } = render(<ArcanaDetailCard arcana={mockArcana} />)
    expect(container.textContent).toContain("O Hierofante")
  })

  it("renders arcana number", () => {
    const { container } = render(<ArcanaDetailCard arcana={mockArcana} />)
    expect(container.textContent).toContain("V")
  })

  it("renders upright meaning", () => {
    const { container } = render(<ArcanaDetailCard arcana={mockArcana} />)
    expect(container.textContent).toContain("Tradição")
  })

  it("renders reversed meaning", () => {
    const { container } = render(<ArcanaDetailCard arcana={mockArcana} />)
    expect(container.textContent).toContain("Rebelião")
  })

  it("renders element and planet", () => {
    const { container } = render(<ArcanaDetailCard arcana={mockArcana} />)
    expect(container.textContent).toContain("Terra")
    expect(container.textContent).toContain("Júpiter")
  })
})
