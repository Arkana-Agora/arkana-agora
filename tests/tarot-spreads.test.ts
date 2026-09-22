import { describe, expect, it } from "vitest"
import { resolveYesNo } from "@/lib/tarot/spreads"
import type { DrawnCard, TarotCard } from "@/types/tarot"

function makeCard(id: string): TarotCard {
  return {
    id,
    deckId: "rws",
    type: "major",
    number: 0,
    name: id,
    keywords: [],
    meaningUp: "",
    meaningReversed: "",
    advice: "",
    imageUrl: "",
  }
}

describe("resolveYesNo", () => {
  it("returns yes/no/maybe with valid answer", () => {
    const cards: DrawnCard[] = [
      { card: makeCard("c1"), isReversed: false, position: 0 },
    ]
    const result = resolveYesNo(cards)
    expect(["yes", "no", "maybe"]).toContain(result.answer)
    expect(typeof result.confidence).toBe("number")
    expect(result.confidence).toBeGreaterThanOrEqual(0)
    expect(result.confidence).toBeLessThanOrEqual(1)
  })

  it("returns consistent result for same seed", () => {
    const cards: DrawnCard[] = [
      { card: makeCard("c1"), isReversed: false, position: 0 },
      { card: makeCard("c2"), isReversed: true, position: 1 },
    ]
    const r1 = resolveYesNo(cards)
    const r2 = resolveYesNo(cards)
    expect(r1.answer).toBe(r2.answer)
    expect(r1.confidence).toBe(r2.confidence)
  })

  it("returns maybe when no cards drawn", () => {
    const result = resolveYesNo([])
    expect(result.answer).toBe("maybe")
    expect(result.confidence).toBe(0)
  })

  it("single upright card returns yes", () => {
    const cards: DrawnCard[] = [
      { card: makeCard("c1"), isReversed: false, position: 0 },
    ]
    const result = resolveYesNo(cards)
    expect(result.answer).toBe("yes")
  })

  it("single reversed card returns no", () => {
    const cards: DrawnCard[] = [
      { card: makeCard("c1"), isReversed: true, position: 0 },
    ]
    const result = resolveYesNo(cards)
    expect(result.answer).toBe("no")
  })

  it("odd number of upright cards (3) returns yes", () => {
    const cards: DrawnCard[] = [
      { card: makeCard("c1"), isReversed: false, position: 0 },
      { card: makeCard("c2"), isReversed: false, position: 1 },
      { card: makeCard("c3"), isReversed: false, position: 2 },
    ]
    const result = resolveYesNo(cards)
    expect(result.answer).toBe("yes")
  })

  it("even number of upright cards (2) returns no", () => {
    const cards: DrawnCard[] = [
      { card: makeCard("c1"), isReversed: false, position: 0 },
      { card: makeCard("c2"), isReversed: false, position: 1 },
    ]
    const result = resolveYesNo(cards)
    expect(result.answer).toBe("no")
  })
})
