import { describe, expect, it } from "vitest"
import { checkDailyLimit } from "@/lib/tarot/daily-limit"

describe("checkDailyLimit", () => {
  it("returns allowed=true when user has no readings today", () => {
    const result = checkDailyLimit(0, "free")
    expect(result.allowed).toBe(true)
    expect(result.remaining).toBe(3)
    expect(result.tier).toBe("free")
  })

  it("returns allowed=true with remaining=1 when user has 2 readings", () => {
    const result = checkDailyLimit(2, "free")
    expect(result.allowed).toBe(true)
    expect(result.remaining).toBe(1)
  })

  it("returns allowed=false when user reached daily limit", () => {
    const result = checkDailyLimit(3, "free")
    expect(result.allowed).toBe(false)
    expect(result.remaining).toBe(0)
  })

  it("returns allowed=false when user exceeded daily limit", () => {
    const result = checkDailyLimit(5, "free")
    expect(result.allowed).toBe(false)
    expect(result.remaining).toBe(0)
  })

  it("returns correct limits for plus tier", () => {
    const result = checkDailyLimit(5, "plus")
    expect(result.allowed).toBe(true)
    expect(result.remaining).toBe(5)
  })

  it("returns allowed=true for premium tier with any count", () => {
    const result = checkDailyLimit(100, "premium")
    expect(result.allowed).toBe(true)
  })

  it("falls back to free tier for unknown tier", () => {
    const result = checkDailyLimit(2, "unknown")
    expect(result.allowed).toBe(true)
    expect(result.remaining).toBe(1)
  })
})
