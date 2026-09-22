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

  it("generates deterministic seed from input", () => {
    const seed1 = generateSeed("user-123", "rws", 1000)
    const seed2 = generateSeed("user-123", "rws", 1000)
    expect(seed1).toBe(seed2)
  })

  it("generates different seeds for different inputs", () => {
    const seed1 = generateSeed("user-123", "rws", 1000)
    const seed2 = generateSeed("user-456", "rws", 1000)
    expect(seed1).not.toBe(seed2)
  })

  it("generates different seeds for different deck IDs", () => {
    const seed1 = generateSeed("user-123", "rws", 1000)
    const seed2 = generateSeed("user-123", "thoth", 1000)
    expect(seed1).not.toBe(seed2)
  })

  it("generates different seeds for different timestamps", () => {
    const seed1 = generateSeed("user-123", "rws", 1000)
    const seed2 = generateSeed("user-123", "rws", 2000)
    expect(seed1).not.toBe(seed2)
  })
})
