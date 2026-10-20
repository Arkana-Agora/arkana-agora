import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { resolveAIClientConfig } from "@/lib/ai/client"

describe("AI client config (AI_BASE_URL)", () => {
  const originalKey = process.env.AI_API_KEY
  const originalBase = process.env.AI_BASE_URL

  beforeEach(() => {
    process.env.AI_API_KEY = "test-key"
    delete process.env.AI_BASE_URL
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    if (originalKey === undefined) delete process.env.AI_API_KEY
    else process.env.AI_API_KEY = originalKey
    if (originalBase === undefined) delete process.env.AI_BASE_URL
    else process.env.AI_BASE_URL = originalBase
  })

  it("omits baseURL when AI_BASE_URL is unset (OpenAI default)", () => {
    expect(resolveAIClientConfig()).toEqual({ apiKey: "test-key" })
  })

  it("includes baseURL when AI_BASE_URL is set (z.ai/OpenAI-compatible)", () => {
    process.env.AI_BASE_URL = "https://api.z.ai/api/paas/v4"
    expect(resolveAIClientConfig()).toEqual({
      apiKey: "test-key",
      baseURL: "https://api.z.ai/api/paas/v4",
    })
  })

  it("ignores blank AI_BASE_URL", () => {
    process.env.AI_BASE_URL = "   "
    expect(resolveAIClientConfig()).toEqual({ apiKey: "test-key" })
  })

  it("throws when AI_API_KEY is missing", () => {
    delete process.env.AI_API_KEY
    expect(() => resolveAIClientConfig()).toThrow(/AI_API_KEY/)
  })

  it("rejects an invalid URL", () => {
    process.env.AI_BASE_URL = "not a url"
    expect(() => resolveAIClientConfig()).toThrow(/valid URL/)
  })

  it("rejects a non-http(s) scheme", () => {
    process.env.AI_BASE_URL = "ftp://example.com/v1"
    expect(() => resolveAIClientConfig()).toThrow(/http or https/)
  })

  it("rejects http in production (would send the key in cleartext)", () => {
    vi.stubEnv("NODE_ENV", "production")
    process.env.AI_BASE_URL = "http://localhost:8080/v1"
    expect(() => resolveAIClientConfig()).toThrow(/https in production/)
  })

  it("allows http outside production (local OpenAI-compatible server)", () => {
    process.env.AI_BASE_URL = "http://localhost:8080/v1"
    expect(resolveAIClientConfig()).toEqual({
      apiKey: "test-key",
      baseURL: "http://localhost:8080/v1",
    })
  })
})
