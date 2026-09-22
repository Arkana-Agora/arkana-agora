import { describe, it, expect, vi } from "vitest"
import { withRetry } from "@/lib/ai/retry"

describe("withRetry", () => {
  it("returns result on first success", async () => {
    const fn = vi.fn().mockResolvedValue("ok")
    const result = await withRetry(fn, 3, 10)
    expect(result).toBe("ok")
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it("retries on failure and succeeds", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("fail 1"))
      .mockResolvedValue("ok")
    const result = await withRetry(fn, 3, 10)
    expect(result).toBe("ok")
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it("retries up to maxRetries times", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("always fail"))
    await expect(withRetry(fn, 3, 10)).rejects.toThrow("always fail")
    expect(fn).toHaveBeenCalledTimes(4) // 1 initial + 3 retries
  })

  it("does not retry on non-retryable errors", async () => {
    const error = new Error("auth failed") as Error & { retryable: boolean }
    error.retryable = false
    const fn = vi.fn().mockRejectedValue(error)
    await expect(withRetry(fn, 3, 10)).rejects.toThrow("auth failed")
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it("retries on retryable errors", async () => {
    const error = new Error("timeout") as Error & { retryable: boolean }
    error.retryable = true
    const fn = vi.fn().mockRejectedValueOnce(error).mockResolvedValue("ok")
    const result = await withRetry(fn, 3, 10)
    expect(result).toBe("ok")
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it("respects custom maxRetries", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("fail"))
    await expect(withRetry(fn, 1, 10)).rejects.toThrow("fail")
    expect(fn).toHaveBeenCalledTimes(2) // 1 initial + 1 retry
  })

  it("does not retry on TypeError", async () => {
    const fn = vi.fn().mockRejectedValue(new TypeError("bad input"))
    await expect(withRetry(fn, 3, 10)).rejects.toThrow("bad input")
    expect(fn).toHaveBeenCalledTimes(1)
  })
})
