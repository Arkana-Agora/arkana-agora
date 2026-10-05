// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest"

// ioredis imprime "missing 'error' handler on this Redis client" quando
// ninguém escuta o evento — o singleton de rate limit precisa de listener.

describe("cliente Redis do Next (src/lib/redis.ts)", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it("nasce com um listener de error registrado", async () => {
    vi.stubEnv("REDIS_URL", "redis://localhost:6379")
    vi.resetModules()
    const { redis } = await import("../../src/lib/redis")
    expect(redis).toBeDefined()
    expect(redis!.listenerCount("error")).toBeGreaterThan(0)
    redis?.disconnect()
  })

  it("sem REDIS_URL continua sem cliente (undefined)", async () => {
    vi.unstubAllEnvs()
    delete process.env.REDIS_URL
    delete (globalThis as { redis?: unknown }).redis
    vi.resetModules()
    const { redis } = await import("../../src/lib/redis")
    expect(redis).toBeUndefined()
  })
})
