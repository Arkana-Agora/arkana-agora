import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { envSchema, getEnv, parseEnv, resetEnvCache } from "@/lib/env"

const ENV_KEYS = [
  "REDIS_URL",
  "SOCKET_PORT",
  "AI_HOROSCOPE_API_KEY",
  "AI_HOROSCOPE_MODEL",
  "SHARP_IGNORE_GLOBAL_LIBVIPS",
  "MODERATION_BLOCKED_WORDS",
  "R2_ACCOUNT_ID",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_BUCKET_NAME",
  "NEXT_PUBLIC_R2_PUBLIC_URL",
] as const

const saved = new Map<string, string | undefined>()

function setEnv(patch: Record<string, string | undefined>): void {
  for (const key of ENV_KEYS) {
    if (!saved.has(key)) saved.set(key, process.env[key])
  }
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
  resetEnvCache()
}

beforeEach(() => {
  saved.clear()
  resetEnvCache()
})

afterEach(() => {
  for (const [key, value] of saved) {
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
  saved.clear()
  resetEnvCache()
})

describe("envSchema (T022)", () => {
  it("objeto vazio cai no default de SOCKET_PORT e deixa opcionais undefined", () => {
    const result = envSchema.parse({})
    expect(result.SOCKET_PORT).toBe(3003)
    expect(result.REDIS_URL).toBeUndefined()
    expect(result.R2_BUCKET_NAME).toBeUndefined()
    expect(result.AI_HOROSCOPE_API_KEY).toBeUndefined()
  })

  it("strings vazias viram undefined (não '')", () => {
    const result = envSchema.parse({
      REDIS_URL: "",
      NEXT_PUBLIC_R2_PUBLIC_URL: "",
      MODERATION_BLOCKED_WORDS: "",
    })
    expect(result.REDIS_URL).toBeUndefined()
    expect(result.NEXT_PUBLIC_R2_PUBLIC_URL).toBeUndefined()
    expect(result.MODERATION_BLOCKED_WORDS).toBeUndefined()
  })

  it("aceita URLs válidas para REDIS_URL e NEXT_PUBLIC_R2_PUBLIC_URL", () => {
    const result = envSchema.parse({
      REDIS_URL: "redis://localhost:6379",
      NEXT_PUBLIC_R2_PUBLIC_URL: "https://pub.example.com",
    })
    expect(result.REDIS_URL).toBe("redis://localhost:6379")
    expect(result.NEXT_PUBLIC_R2_PUBLIC_URL).toBe("https://pub.example.com")
  })

  it("rejeita REDIS_URL que não é URL", () => {
    const result = envSchema.safeParse({ REDIS_URL: "nao-e-url" })
    expect(result.success).toBe(false)
  })

  it("rejeita NEXT_PUBLIC_R2_PUBLIC_URL que não é URL", () => {
    const result = envSchema.safeParse({
      NEXT_PUBLIC_R2_PUBLIC_URL: "nao-e-url",
    })
    expect(result.success).toBe(false)
  })

  it("coage SOCKET_PORT de string e valida faixa 1-65535", () => {
    expect(envSchema.parse({ SOCKET_PORT: "4000" }).SOCKET_PORT).toBe(4000)
    expect(envSchema.safeParse({ SOCKET_PORT: "abc" }).success).toBe(false)
    expect(envSchema.safeParse({ SOCKET_PORT: "0" }).success).toBe(false)
    expect(envSchema.safeParse({ SOCKET_PORT: "65536" }).success).toBe(false)
    expect(envSchema.safeParse({ SOCKET_PORT: "-1" }).success).toBe(false)
  })

  it("SHARP_IGNORE_GLOBAL_LIBVIPS aceita apenas true/false", () => {
    expect(envSchema.parse({ SHARP_IGNORE_GLOBAL_LIBVIPS: "true" })).toEqual(
      expect.objectContaining({ SHARP_IGNORE_GLOBAL_LIBVIPS: "true" }),
    )
    expect(
      envSchema.safeParse({ SHARP_IGNORE_GLOBAL_LIBVIPS: "sim" }).success,
    ).toBe(false)
  })
})

describe("parseEnv (T022)", () => {
  it("retorna o objeto parseado quando válido", () => {
    const env = parseEnv({ SOCKET_PORT: "3004" })
    expect(env.SOCKET_PORT).toBe(3004)
  })

  it("lança Error com variável e mensagem de cada issue", () => {
    expect(() => parseEnv({ REDIS_URL: "quebrado" })).toThrow(
      /Variáveis de ambiente inválidas:/,
    )
    try {
      parseEnv({ REDIS_URL: "quebrado", SOCKET_PORT: "0" })
      expect.unreachable("parseEnv deveria lançar")
    } catch (error) {
      const message = (error as Error).message
      expect(message).toContain("  - REDIS_URL:")
      expect(message).toContain("  - SOCKET_PORT:")
    }
  })
})

describe("getEnv / resetEnvCache (T022)", () => {
  it("memoiza o resultado entre chamadas", () => {
    setEnv({ SOCKET_PORT: "3003" })
    const first = getEnv()
    const second = getEnv()
    expect(second).toBe(first)
  })

  it("resetEnvCache força novo parse na próxima chamada", () => {
    setEnv({ SOCKET_PORT: "3003" })
    const first = getEnv()
    resetEnvCache()
    const second = getEnv()
    expect(second).not.toBe(first)
    expect(second.SOCKET_PORT).toBe(3003)
  })

  it("reflete mudanças de process.env apenas após resetEnvCache", () => {
    setEnv({ SOCKET_PORT: "3003" })
    expect(getEnv().SOCKET_PORT).toBe(3003)
    setEnv({ SOCKET_PORT: "4000" })
    expect(getEnv().SOCKET_PORT).toBe(4000)
  })

  it("lança quando o process.env está inválido", () => {
    setEnv({ REDIS_URL: "invalido" })
    expect(() => getEnv()).toThrow(/Variáveis de ambiente inválidas:/)
  })
})
