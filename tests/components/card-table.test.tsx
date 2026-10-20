// @vitest-environment jsdom
import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { CardTable } from "@/components/tarot/card-table"
import type { Spread } from "@/types/tarot"

function makeSpread(
  id: string,
  cardCount: number,
  positionNames: string[],
): Spread {
  return {
    id,
    name: id,
    description: "",
    deckType: "tarot",
    cardCount,
    difficulty: "beginner",
    estimatedTime: 1,
    layout: "linear",
    positions: positionNames.map((name, index) => ({
      id: name,
      name,
      description: "",
      gridX: index,
      gridY: 0,
    })),
  }
}

function drawn(positionIndex: number) {
  return {
    cardId: `c-${positionIndex}`,
    positionIndex,
    isReversed: false,
    card: {
      id: `c-${positionIndex}`,
      name: `Carta ${positionIndex}`,
      imageUrl: `/images/${positionIndex}.jpg`,
      meaning: "significado",
      reversedMeaning: "invertido",
    },
  }
}

describe("CardTable dimensoes das cartas", () => {
  it("nao colapsa as cartas para 0x0 (wrapper abs sem width)", () => {
    render(
      <CardTable
        spread={makeSpread("three-card", 3, ["Passado", "Presente", "Futuro"])}
        cards={[drawn(0), drawn(1), drawn(2)]}
      />,
    )

    const cards = screen.getAllByRole("button")
    expect(cards).toHaveLength(3)
    for (const card of cards) {
      expect(card).toHaveStyle({ width: "120px", height: "210px" })
    }
  })

  it("espacamento de 1 carta usa o tamanho large", () => {
    render(
      <CardTable
        spread={makeSpread("single-card", 1, ["Resposta"])}
        cards={[drawn(0)]}
      />,
    )

    expect(screen.getByRole("button")).toHaveStyle({
      width: "180px",
      height: "315px",
    })
  })

  it("espalhamento grande usa o tamanho small para caber na mesa", () => {
    render(
      <CardTable
        spread={makeSpread(
          "celtic-cross",
          10,
          Array.from({ length: 10 }, (_, i) => `P${i}`),
        )}
        cards={Array.from({ length: 10 }, (_, i) => drawn(i))}
      />,
    )

    const cards = screen.getAllByRole("button")
    expect(cards).toHaveLength(10)
    for (const card of cards) {
      expect(card).toHaveStyle({ width: "80px", height: "140px" })
    }
  })

  it("mantem cada carta na posicao percentual do espalhamento", () => {
    render(
      <CardTable
        spread={makeSpread("three-card", 3, ["Passado", "Presente", "Futuro"])}
        cards={[drawn(0), drawn(1), drawn(2)]}
      />,
    )

    const [first, second, third] = screen.getAllByRole("button")
    expect(first?.parentElement).toHaveStyle({ left: "15%" })
    expect(second?.parentElement).toHaveStyle({ left: "50%" })
    expect(third?.parentElement).toHaveStyle({ left: "85%" })
  })
})
