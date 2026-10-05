import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { createRedisUrlResolver } from "../../socket-service/src/lib/redis-url"

// Revisão de consistência (bus.ts/redis-auth.ts): helper compartilhado com
// estado POR INSTÂNCIA — cada módulo configura/reseta de forma independente
// e só cai em process.env.REDIS_URL quando nunca configurado.

describe("createRedisUrlResolver — fonte única de REDIS_URL", () => {
  beforeEach(() => {
    delete process.env.REDIS_URL
  })

  afterEach(() => {
    delete process.env.REDIS_URL
  })

  it("sem configure cai em process.env.REDIS_URL", () => {
    process.env.REDIS_URL = "redis://env:6379"

    expect(createRedisUrlResolver().resolve()).toBe("redis://env:6379")
  })

  it("configure(url) tem prioridade sobre process.env", () => {
    process.env.REDIS_URL = "redis://env:6379"
    const resolver = createRedisUrlResolver()

    resolver.configure("redis://configured:6379")

    expect(resolver.resolve()).toBe("redis://configured:6379")
  })

  it("configure(undefined) conta como configurado e ignora process.env", () => {
    process.env.REDIS_URL = "redis://env:6379"
    const resolver = createRedisUrlResolver()

    resolver.configure(undefined)

    expect(resolver.resolve()).toBeUndefined()
  })

  it("instâncias são independentes (bus e auth configuram separado)", () => {
    process.env.REDIS_URL = "redis://env:6379"
    const bus = createRedisUrlResolver()
    const auth = createRedisUrlResolver()

    bus.configure("redis://bus:6379")

    expect(bus.resolve()).toBe("redis://bus:6379")
    expect(auth.resolve()).toBe("redis://env:6379")
  })

  it("reset volta ao fallback de process.env e permite reconfigurar", () => {
    process.env.REDIS_URL = "redis://env:6379"
    const resolver = createRedisUrlResolver()

    resolver.configure("redis://configured:6379")
    resolver.reset()
    expect(resolver.resolve()).toBe("redis://env:6379")

    resolver.configure(undefined)
    expect(resolver.resolve()).toBeUndefined()
  })
})
