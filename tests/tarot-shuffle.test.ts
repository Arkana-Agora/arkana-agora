import { describe, expect, it } from "vitest"
import { shuffleDeck } from "@/lib/tarot/shuffle"
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

describe("shuffleDeck", () => {
  it("returns same number of cards as input", () => {
    const shuffled = shuffleDeck(mockCards, "test-seed")
    expect(shuffled.length).toBe(mockCards.length)
  })

  it("contains all original cards (no loss)", () => {
    const shuffled = shuffleDeck(mockCards, "test-seed")
    const originalIds = mockCards.map((c) => c.id).sort()
    const shuffledIds = shuffled.map((c) => c.id).sort()
    expect(shuffledIds).toEqual(originalIds)
  })

  it("is deterministic for the same seed", () => {
    const s1 = shuffleDeck(mockCards, "seed-abc")
    const s2 = shuffleDeck(mockCards, "seed-abc")
    expect(s1.map((c) => c.id)).toEqual(s2.map((c) => c.id))
  })

  it("produces different order for different seeds", () => {
    const s1 = shuffleDeck(mockCards, "seed-1")
    const s2 = shuffleDeck(mockCards, "seed-2")
    expect(s1.map((c) => c.id)).not.toEqual(s2.map((c) => c.id))
  })

  it("does not mutate the original array", () => {
    const original = [...mockCards]
    shuffleDeck(mockCards, "test-seed")
    expect(mockCards.map((c) => c.id)).toEqual(original.map((c) => c.id))
  })

  it("works with a single card", () => {
    const single = [mockCards[0]!]
    const shuffled = shuffleDeck(single, "any-seed")
    expect(shuffled.length).toBe(1)
    expect(shuffled[0]!.id).toBe(mockCards[0]!.id)
  })

  it("works with empty array", () => {
    const shuffled = shuffleDeck([], "any-seed")
    expect(shuffled).toEqual([])
  })
})
