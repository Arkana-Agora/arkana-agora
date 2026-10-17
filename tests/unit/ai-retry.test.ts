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

  it("does not retry on OpenAI billing exhausted error (credit_balance_exhausted)", async () => {
    const error = Object.assign(
      new Error("429 You have no credits remaining"),
      { name: "RateLimitError", status: 429, code: "credit_balance_exhausted" },
    )
    const fn = vi.fn().mockRejectedValue(error)
    await expect(withRetry(fn, 3, 10)).rejects.toThrow("no credits")
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it("does not retry on OpenAI insufficient_quota error", async () => {
    const error = Object.assign(new Error("429 insufficient_quota"), {
      status: 429,
      code: "insufficient_quota",
    })
    const fn = vi.fn().mockRejectedValue(error)
    await expect(withRetry(fn, 3, 10)).rejects.toThrow("insufficient_quota")
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it("does not retry when nested error.code is credit_balance_exhausted", async () => {
    const error = Object.assign(new Error("429 rate limit"), {
      status: 429,
      error: { code: "credit_balance_exhausted" },
    })
    const fn = vi.fn().mockRejectedValue(error)
    await expect(withRetry(fn, 3, 10)).rejects.toThrow("rate limit")
    expect(fn).toHaveBeenCalledTimes(1)
  })
})
