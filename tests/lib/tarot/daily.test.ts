import { describe, expect, it } from "vitest"
import { getDailyTarotCard } from "@/lib/tarot/daily"
import { getDeckCards } from "@/lib/tarot/decks"

describe("getDailyTarotCard", () => {
  it("returns a card from the RWS deck", () => {
    const card = getDailyTarotCard(new Date("2026-09-01T12:00:00"))
    const rwsCards = getDeckCards("rws")
    expect(rwsCards.map((c) => c.id)).toContain(card.id)
    expect(card.name.length).toBeGreaterThan(0)
    expect(card.meaning.length).toBeGreaterThan(0)
    expect(card.reversedMeaning.length).toBeGreaterThan(0)
  })

  it("is deterministic for the same date", () => {
    const d1 = new Date("2026-09-01T12:00:00")
    const d2 = new Date("2026-09-01T23:59:59")
    const a = getDailyTarotCard(d1)
    const b = getDailyTarotCard(d2)
    expect(a.id).toBe(b.id)
    expect(a.isReversed).toBe(b.isReversed)
  })

  it("returns different cards on different days", () => {
    const a = getDailyTarotCard(new Date("2026-09-01T12:00:00"))
    const b = getDailyTarotCard(new Date("2026-09-02T12:00:00"))
    expect(a.id).not.toBe(b.id)
  })

  it("marks even days as reversed and odd days upright", () => {
    const odd = getDailyTarotCard(new Date("2026-09-01T12:00:00"))
    const even = getDailyTarotCard(new Date("2026-09-02T12:00:00"))
    expect(odd.isReversed).toBe(false)
    expect(even.isReversed).toBe(true)
  })

  it("always returns a card within deck bounds across a year", () => {
    const rwsCards = getDeckCards("rws")
    for (let month = 0; month < 12; month++) {
      const date = new Date(2026, month, 15, 12)
      const card = getDailyTarotCard(date)
      const index = rwsCards.findIndex((c) => c.id === card.id)
      expect(index).toBeGreaterThanOrEqual(0)
      expect(index).toBeLessThan(rwsCards.length)
    }
  })
})
