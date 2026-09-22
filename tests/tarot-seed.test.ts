import { describe, expect, it } from "vitest"
import { generateSeed } from "@/lib/tarot/seed"

describe("generateSeed", () => {
  it("returns a string", () => {
    const seed = generateSeed()
    expect(typeof seed).toBe("string")
  })

  it("returns a hex string of 64 characters (256 bits)", () => {
    const seed = generateSeed()
    expect(seed).toMatch(/^[0-9a-f]{64}$/)
  })

  it("generates unique seeds on each call", () => {
    const seeds = new Set(Array.from({ length: 100 }, () => generateSeed()))
    expect(seeds.size).toBe(100)
  })
})
