// @vitest-environment node
import { generateKeyPairSync } from "node:crypto"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// Revisao K: o Redis adapter do Server lê env.REDIS_URL (a env validada
// pelo Zod), nunca process.env — fonte unica dentro do socket-service.

const redisConstructorCalls: string[] = []
const redisInstances: Array<{ errorCount: number }> = []

vi.mock("ioredis", () => {
  class MockRedis {
    errorCount = 0
    constructor(url?: unknown) {
      if (typeof url === "string") redisConstructorCalls.push(url)
      redisInstances.push(this)
    }
    on(event?: unknown): this {
      if (event === "error") this.errorCount++
      return this
    }
    once(): this {
      return this
    }
    connect(): Promise<void> {
      return Promise.resolve()
    }
    duplicate(): MockRedis {
      return new MockRedis()
    }
    subscribe(): Promise<void> {
      return Promise.resolve()
    }
    psubscribe(): Promise<void> {
      return Promise.resolve()
    }
    publish(): Promise<void> {
      return Promise.resolve()
    }
    quit(): Promise<void> {
      return Promise.resolve()
    }
    disconnect(): void {}
    get(): Promise<string | null> {
      return Promise.resolve(null)
    }
  }
  return { default: MockRedis }
})

import { createSocketServer } from "../../socket-service/src/server"
import type { SocketEnv } from "../../socket-service/src/lib/env"
import { resetRealtimeBus } from "../../socket-service/src/bus"

const { publicKey, privateKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
})
const JWT_PUBLIC_KEY = publicKey.export({
  type: "spki",
  format: "pem",
}) as string
void privateKey

const ENV_URL = "redis://env-redis:6379"
const PROCESS_URL = "redis://process-redis:6379"

describe("Redis adapter usa env.REDIS_URL (revisao K)", () => {
  const originalRedisUrl = process.env.REDIS_URL

  beforeEach(async () => {
    redisConstructorCalls.length = 0
    redisInstances.length = 0
    delete process.env.REDIS_URL
    await resetRealtimeBus()
  })

  afterEach(async () => {
    if (originalRedisUrl === undefined) delete process.env.REDIS_URL
    else process.env.REDIS_URL = originalRedisUrl
    await resetRealtimeBus()
  })

  it("não constrói cliente com URL de process.env quando env manda outra", async () => {
    process.env.REDIS_URL = PROCESS_URL
    const env: SocketEnv = {
      REDIS_URL: ENV_URL,
      SOCKET_PORT: 0,
      AUTH_URL: "http://localhost:3000",
      JWT_PUBLIC_KEY,
      ACCESS_TOKEN_TTL_SECONDS: 900,
    }
    const handle = await createSocketServer({ env })
    try {
      expect(redisConstructorCalls).toContain(ENV_URL)
      expect(redisConstructorCalls).not.toContain(PROCESS_URL)
    } finally {
      await handle.close()
    }
  })

  it("sem env.REDIS_URL não cria adapter mesmo com process.env definido", async () => {
    process.env.REDIS_URL = PROCESS_URL
    const env: SocketEnv = {
      REDIS_URL: undefined,
      SOCKET_PORT: 0,
      AUTH_URL: "http://localhost:3000",
      JWT_PUBLIC_KEY,
      ACCESS_TOKEN_TTL_SECONDS: 900,
    }
    const handle = await createSocketServer({ env })
    try {
      expect(redisConstructorCalls).toHaveLength(0)
    } finally {
      await handle.close()
    }
  })

  it("todo cliente ioredis criado nasce com listener de error (sem warning do ioredis)", async () => {
    const env: SocketEnv = {
      REDIS_URL: ENV_URL,
      SOCKET_PORT: 0,
      AUTH_URL: "http://localhost:3000",
      JWT_PUBLIC_KEY,
      ACCESS_TOKEN_TTL_SECONDS: 900,
    }
    const handle = await createSocketServer({ env })
    try {
      expect(redisInstances.length).toBeGreaterThan(0)
      // adapter (pub+sub) e bus (pub+sub): todos precisam escutar "error"
      const withoutHandler = redisInstances.filter((i) => i.errorCount < 1)
      expect(withoutHandler).toEqual([])
    } finally {
      await handle.close()
    }
  })
})
