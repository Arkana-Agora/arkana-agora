// @vitest-environment node
import { describe, expect, it } from "vitest"

async function callDecks() {
  const { GET } = await import("@/app/api/v1/decks/route")
  return GET()
}

async function callDeckCards(deckId: string) {
  const { GET } = await import("@/app/api/v1/decks/[id]/cards/route")
  return GET(
    new Request(`http://localhost:3000/api/v1/decks/${deckId}/cards`),
    { params: Promise.resolve({ id: deckId }) },
  )
}

describe("GET /api/v1/decks", () => {
  it("returns list of available decks", async () => {
    const res = await callDecks()
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body).toHaveProperty("decks")
    expect(Array.isArray(body.decks)).toBe(true)
    expect(body.decks.length).toBeGreaterThanOrEqual(3)
  })

  it("each deck has required fields", async () => {
    const res = await callDecks()
    const body = await res.json()
    for (const deck of body.decks) {
      expect(deck).toHaveProperty("id")
      expect(deck).toHaveProperty("name")
      expect(deck).toHaveProperty("description")
      expect(deck).toHaveProperty("cardCount")
      expect(deck).toHaveProperty("hasReversals")
    }
  })

  it("returns decks with known ids", async () => {
    const res = await callDecks()
    const body = await res.json()
    const ids = body.decks.map((d: { id: string }) => d.id)
    expect(ids).toContain("rws")
    expect(ids).toContain("thoth")
    expect(ids).toContain("lenormand")
  })
})

describe("GET /api/v1/decks/:id/cards", () => {
  it("returns cards for valid deck", async () => {
    const res = await callDeckCards("rws")
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body).toHaveProperty("deck")
    expect(body).toHaveProperty("cards")
    expect(Array.isArray(body.cards)).toBe(true)
    expect(body.cards.length).toBe(78)
  })

  it("each card has required fields", async () => {
    const res = await callDeckCards("rws")
    const body = await res.json()
    for (const card of body.cards) {
      expect(card).toHaveProperty("id")
      expect(card).toHaveProperty("deckId")
      expect(card).toHaveProperty("type")
      expect(card).toHaveProperty("name")
      expect(card).toHaveProperty("meaningUp")
      expect(card).toHaveProperty("meaningReversed")
    }
  })

  it("returns 404 for unknown deck", async () => {
    const res = await callDeckCards("nonexistent")
    expect(res.status).toBe(404)
  })

  it("returns thoth cards", async () => {
    const res = await callDeckCards("thoth")
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.cards.length).toBe(78)
  })

  it("returns lenormand cards", async () => {
    const res = await callDeckCards("lenormand")
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.cards.length).toBe(36)
  })
})
