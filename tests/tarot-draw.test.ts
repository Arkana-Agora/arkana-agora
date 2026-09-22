import { describe, expect, it } from "vitest"
import { drawCards } from "@/lib/tarot/draw"
import type { TarotCard } from "@/types/tarot"

const mockCards: TarotCard[] = Array.from({ length: 78 }, (_, i) => ({
  id: `card-${i}`,
  deckId: "rws",
  type: i < 22 ? "major" : "minor",
  number: i < 22 ? i : i - 22,
  name: `Card ${i}`,
  keywords: [],
  meaningUp: "",
  meaningReversed: "",
  advice: "",
  imageUrl: "",
}))

describe("drawCards", () => {
  it("returns requested number of cards", () => {
    const drawn = drawCards(mockCards, 3, "test-seed")
    expect(drawn.length).toBe(3)
  })

  it("each drawn card has card, isReversed, and position", () => {
    const drawn = drawCards(mockCards, 3, "test-seed")
    for (const d of drawn) {
      expect(d).toHaveProperty("card")
      expect(d).toHaveProperty("isReversed")
      expect(d).toHaveProperty("position")
      expect(typeof d.isReversed).toBe("boolean")
      expect(typeof d.position).toBe("number")
    }
  })

  it("positions are sequential (0, 1, 2, ...)", () => {
    const drawn = drawCards(mockCards, 5, "test-seed")
    expect(drawn.map((d) => d.position)).toEqual([0, 1, 2, 3, 4])
  })

  it("no duplicate cards in a single draw", () => {
    const drawn = drawCards(mockCards, 10, "test-seed")
    const ids = drawn.map((d) => d.card.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it("is deterministic for the same seed", () => {
    const d1 = drawCards(mockCards, 5, "seed-xyz")
    const d2 = drawCards(mockCards, 5, "seed-xyz")
    expect(d1.map((d) => d.card.id)).toEqual(d2.map((d) => d.card.id))
    expect(d1.map((d) => d.isReversed)).toEqual(d2.map((d) => d.isReversed))
  })

  it("produces different draws for different seeds", () => {
    const d1 = drawCards(mockCards, 5, "seed-1")
    const d2 = drawCards(mockCards, 5, "seed-2")
    expect(d1.map((d) => d.card.id)).not.toEqual(d2.map((d) => d.card.id))
  })

  it("throws when requesting more cards than available", () => {
    const smallDeck = mockCards.slice(0, 5)
    expect(() => drawCards(smallDeck, 10, "test-seed")).toThrow()
  })

  it("can draw all cards from deck", () => {
    const drawn = drawCards(mockCards, 78, "test-seed")
    expect(drawn.length).toBe(78)
    const ids = drawn.map((d) => d.card.id)
    expect(new Set(ids).size).toBe(78)
  })
})
