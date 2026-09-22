import { describe, it, expect } from "vitest"
import { computeCacheHash, CACHE_TTL_SECONDS } from "@/lib/ai/cache"

describe("computeCacheHash", () => {
  const baseInput = {
    deckId: "rws",
    spreadId: "three-card",
    cards: [
      { cardId: "rws-major-0", positionIndex: 0, isReversed: false },
      { cardId: "rws-major-16", positionIndex: 1, isReversed: true },
      { cardId: "rws-major-17", positionIndex: 2, isReversed: false },
    ],
    mode: "general" as const,
    mood: "reflexivo",
    modelVersion: "gpt-4o-2024-08-06",
  }

  it("returns a string hash", () => {
    const hash = computeCacheHash(baseInput)
    expect(typeof hash).toBe("string")
    expect(hash.length).toBeGreaterThan(0)
  })

  it("returns consistent hash for same inputs", () => {
    const hash1 = computeCacheHash(baseInput)
    const hash2 = computeCacheHash(baseInput)
    expect(hash1).toBe(hash2)
  })

  it("returns different hash when deckId changes", () => {
    const hash1 = computeCacheHash(baseInput)
    const hash2 = computeCacheHash({ ...baseInput, deckId: "thoth" })
    expect(hash1).not.toBe(hash2)
  })

  it("returns different hash when spreadId changes", () => {
    const hash1 = computeCacheHash(baseInput)
    const hash2 = computeCacheHash({ ...baseInput, spreadId: "celtic-cross" })
    expect(hash1).not.toBe(hash2)
  })

  it("returns different hash when mode changes", () => {
    const hash1 = computeCacheHash(baseInput)
    const hash2 = computeCacheHash({ ...baseInput, mode: "love" })
    expect(hash1).not.toBe(hash2)
  })

  it("returns different hash when mood changes", () => {
    const hash1 = computeCacheHash(baseInput)
    const hash2 = computeCacheHash({ ...baseInput, mood: "ansioso" })
    expect(hash1).not.toBe(hash2)
  })

  it("returns different hash when modelVersion changes", () => {
    const hash1 = computeCacheHash(baseInput)
    const hash2 = computeCacheHash({
      ...baseInput,
      modelVersion: "gpt-4o-2024-12-01",
    })
    expect(hash1).not.toBe(hash2)
  })

  it("returns different hash when card orientations change", () => {
    const hash1 = computeCacheHash(baseInput)
    const hash2 = computeCacheHash({
      ...baseInput,
      cards: [
        { cardId: "rws-major-0", positionIndex: 0, isReversed: true },
        { cardId: "rws-major-16", positionIndex: 1, isReversed: false },
        { cardId: "rws-major-17", positionIndex: 2, isReversed: false },
      ],
    })
    expect(hash1).not.toBe(hash2)
  })

  it("returns same hash when card array order differs but positions match", () => {
    const hash1 = computeCacheHash(baseInput)
    const hash2 = computeCacheHash({
      ...baseInput,
      cards: [
        { cardId: "rws-major-17", positionIndex: 2, isReversed: false },
        { cardId: "rws-major-0", positionIndex: 0, isReversed: false },
        { cardId: "rws-major-16", positionIndex: 1, isReversed: true },
      ],
    })
    expect(hash1).toBe(hash2)
  })

  it("returns different hash when cards swap positions", () => {
    const hash1 = computeCacheHash(baseInput)
    const hash2 = computeCacheHash({
      ...baseInput,
      cards: [
        { cardId: "rws-major-16", positionIndex: 0, isReversed: true },
        { cardId: "rws-major-0", positionIndex: 1, isReversed: false },
        { cardId: "rws-major-17", positionIndex: 2, isReversed: false },
      ],
    })
    expect(hash1).not.toBe(hash2)
  })

  it("returns different hash when question is present vs absent", () => {
    const hash1 = computeCacheHash(baseInput)
    const hash2 = computeCacheHash({ ...baseInput, question: "Sim ou não?" })
    expect(hash1).not.toBe(hash2)
  })

  it("handles empty cards array", () => {
    const hash = computeCacheHash({ ...baseInput, cards: [] })
    expect(typeof hash).toBe("string")
    expect(hash.length).toBeGreaterThan(0)
  })

  it("handles optional mood as undefined", () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { mood: _mood, ...withoutMood } = baseInput
    const hash = computeCacheHash(withoutMood)
    expect(typeof hash).toBe("string")
    expect(hash.length).toBeGreaterThan(0)
  })

  it("handles optional question as undefined", () => {
    const hash = computeCacheHash({ ...baseInput })
    expect(typeof hash).toBe("string")
  })

  it("handles yesno mode", () => {
    const hash = computeCacheHash({
      ...baseInput,
      mode: "yesno",
      question: "Vou conseguir a vaga?",
    })
    expect(typeof hash).toBe("string")
  })
})

describe("CACHE_TTL_SECONDS", () => {
  it("equals 30 days in seconds", () => {
    expect(CACHE_TTL_SECONDS).toBe(30 * 24 * 60 * 60)
  })
})
