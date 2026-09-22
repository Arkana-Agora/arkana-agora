// @vitest-environment node
import { describe, expect, it } from "vitest"

async function callSpreads(deckType?: string) {
  const { GET } = await import("@/app/api/v1/spreads/route")
  const url = deckType
    ? `http://localhost:3000/api/v1/spreads?deckType=${deckType}`
    : "http://localhost:3000/api/v1/spreads"
  return GET(new Request(url))
}

describe("GET /api/v1/spreads", () => {
  it("returns list of spreads", async () => {
    const res = await callSpreads()
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body).toHaveProperty("spreads")
    expect(Array.isArray(body.spreads)).toBe(true)
    expect(body.spreads.length).toBeGreaterThanOrEqual(5)
  })

  it("each spread has required fields", async () => {
    const res = await callSpreads()
    const body = await res.json()
    for (const spread of body.spreads) {
      expect(spread).toHaveProperty("id")
      expect(spread).toHaveProperty("name")
      expect(spread).toHaveProperty("description")
      expect(spread).toHaveProperty("deckType")
      expect(spread).toHaveProperty("cardCount")
      expect(spread).toHaveProperty("positions")
      expect(Array.isArray(spread.positions)).toBe(true)
    }
  })

  it("filters by deckType=tarot", async () => {
    const res = await callSpreads("tarot")
    const body = await res.json()
    expect(res.status).toBe(200)
    for (const spread of body.spreads) {
      expect(spread.deckType).toBe("tarot")
    }
  })

  it("filters by deckType=lenormand", async () => {
    const res = await callSpreads("lenormand")
    const body = await res.json()
    expect(res.status).toBe(200)
    for (const spread of body.spreads) {
      expect(spread.deckType).toBe("lenormand")
    }
  })

  it("returns 422 for invalid deckType", async () => {
    const res = await callSpreads("invalid")
    expect(res.status).toBe(422)
  })
})
