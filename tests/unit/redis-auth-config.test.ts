import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const createBusRedisClientMock = vi.hoisted(() => vi.fn())

vi.mock("../../socket-service/src/bus", () => ({
  createBusRedisClient: createBusRedisClientMock,
}))

import {
  configureRedisAuth,
  getCachedTokenVersion,
  resetRedisAuthForTests,
} from "../../socket-service/src/redis-auth"

// Revisao K: redis-auth usa a fonte unica configurada (env validada do
// createSocketServer) e so cai em process.env quando nunca configurado.

function fakeClient(getValue: string | null): {
  connect: ReturnType<typeof vi.fn>
  get: ReturnType<typeof vi.fn>
  on: ReturnType<typeof vi.fn>
  disconnect: ReturnType<typeof vi.fn>
} {
  return {
    connect: vi.fn().mockResolvedValue(undefined),
    get: vi.fn().mockResolvedValue(getValue),
    on: vi.fn(),
    disconnect: vi.fn(),
  }
}

describe("redis-auth — fonte unica de REDIS_URL (revisao K)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetRedisAuthForTests()
  })

  afterEach(() => {
    resetRedisAuthForTests()
  })

  it("configureRedisAuth(undefined) ignora process.env e não conecta", async () => {
    process.env.REDIS_URL = "redis://localhost:6379"
    try {
      createBusRedisClientMock.mockReturnValue(fakeClient("7"))
      configureRedisAuth(undefined)
      await expect(getCachedTokenVersion("u1")).resolves.toBeNull()
      expect(createBusRedisClientMock).not.toHaveBeenCalled()
    } finally {
      delete process.env.REDIS_URL
    }
  })

  it("configureRedisAuth(url) usa a URL configurada, não process.env", async () => {
    delete process.env.REDIS_URL
    const client = fakeClient(null)
    createBusRedisClientMock.mockReturnValue(client)
    configureRedisAuth("redis://127.0.0.1:6390")
    await expect(getCachedTokenVersion("u1")).resolves.toBeNull()
    expect(createBusRedisClientMock).toHaveBeenCalledWith(
      "redis://127.0.0.1:6390",
    )
  })

  it("sem configuração explícita cai em process.env (lado Next/token-service)", async () => {
    process.env.REDIS_URL = "redis://process-env:6379"
    try {
      const client = fakeClient("3")
      createBusRedisClientMock.mockReturnValue(client)
      await expect(getCachedTokenVersion("u1")).resolves.toBe(3)
      expect(createBusRedisClientMock).toHaveBeenCalledWith(
        "redis://process-env:6379",
      )
    } finally {
      delete process.env.REDIS_URL
    }
  })
})
