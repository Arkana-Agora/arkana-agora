import { describe, expect, it } from "vitest"
import { calculatePersonalArcana } from "@/lib/arcana/calculate"

describe("calculatePersonalArcana", () => {
  it("returns a number between 1 and 22", () => {
    const result = calculatePersonalArcana(
      new Date(Date.UTC(1990, 5, 15)),
      "Maria",
    )
    expect(result).toBeGreaterThanOrEqual(1)
    expect(result).toBeLessThanOrEqual(22)
  })

  it("returns same result for same inputs", () => {
    const r1 = calculatePersonalArcana(new Date(Date.UTC(1985, 0, 1)), "João")
    const r2 = calculatePersonalArcana(new Date(Date.UTC(1985, 0, 1)), "João")
    expect(r1).toBe(r2)
  })

  it("returns different results for different names", () => {
    const r1 = calculatePersonalArcana(new Date(Date.UTC(1990, 0, 1)), "Ana")
    const r2 = calculatePersonalArcana(new Date(Date.UTC(1990, 0, 1)), "Pedro")
    expect(r1).not.toBe(r2)
  })
})
