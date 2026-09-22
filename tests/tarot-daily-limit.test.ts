import { describe, expect, it } from "vitest"
import { checkDailyLimit } from "@/lib/tarot/daily-limit"

describe("checkDailyLimit", () => {
  it("returns allowed=true when user has no readings today", () => {
    const result = checkDailyLimit(0, "FREE")
    expect(result.allowed).toBe(true)
    expect(result.remaining).toBe(3)
    expect(result.tier).toBe("FREE")
  })

  it("returns allowed=true with remaining=1 when user has 2 readings", () => {
    const result = checkDailyLimit(2, "FREE")
    expect(result.allowed).toBe(true)
    expect(result.remaining).toBe(1)
  })

  it("returns allowed=false when user reached daily limit", () => {
    const result = checkDailyLimit(3, "FREE")
    expect(result.allowed).toBe(false)
    expect(result.remaining).toBe(0)
  })

  it("returns allowed=false when user exceeded daily limit", () => {
    const result = checkDailyLimit(5, "FREE")
    expect(result.allowed).toBe(false)
    expect(result.remaining).toBe(0)
  })

  it("returns correct limits for PLUS tier", () => {
    const result = checkDailyLimit(5, "PLUS")
    expect(result.allowed).toBe(true)
    expect(result.remaining).toBe(5)
  })

  it("returns allowed=true for PREMIUM tier with any count", () => {
    const result = checkDailyLimit(100, "PREMIUM")
    expect(result.allowed).toBe(true)
  })

  it("falls back to FREE tier for unknown tier", () => {
    const result = checkDailyLimit(2, "UNKNOWN")
    expect(result.allowed).toBe(true)
    expect(result.remaining).toBe(1)
  })

  it("normalizes lowercase tier to uppercase", () => {
    const result = checkDailyLimit(0, "free")
    expect(result.tier).toBe("FREE")
    expect(result.remaining).toBe(3)
  })
})
