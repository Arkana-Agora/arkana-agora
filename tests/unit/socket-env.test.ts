// @vitest-environment node
import { describe, expect, it } from "vitest"

import { parseSocketEnv } from "../../socket-service/src/lib/env"

describe("parseSocketEnv (T069)", () => {
  const valid = {
    REDIS_URL: "redis://localhost:6379",
    SOCKET_PORT: "3003",
    AUTH_URL: "http://localhost:3000",
    JWT_PUBLIC_KEY: "-----BEGIN PUBLIC KEY-----\nabc\n-----END PUBLIC KEY-----",
    ACCESS_TOKEN_TTL_SECONDS: "900",
  }

  function omit(
    ...keys: Array<keyof typeof valid>
  ): Record<string, string | undefined> {
    const rest: Record<string, string | undefined> = { ...valid }
    for (const key of keys) delete rest[key]
    return rest
  }

  it("aceita env valido e coage SOCKET_PORT para number", () => {
    const env = parseSocketEnv(valid)
    expect(env.SOCKET_PORT).toBe(3003)
    expect(env.REDIS_URL).toBe("redis://localhost:6379")
    expect(env.AUTH_URL).toBe("http://localhost:3000")
    expect(env.JWT_PUBLIC_KEY).toContain("BEGIN PUBLIC KEY")
  })

  it("usa default 3003 quando SOCKET_PORT ausente", () => {
    expect(parseSocketEnv(omit("SOCKET_PORT")).SOCKET_PORT).toBe(3003)
  })

  it("trata string vazia como ausente (SOCKET_PORT cai no default)", () => {
    expect(parseSocketEnv({ ...valid, SOCKET_PORT: "" }).SOCKET_PORT).toBe(3003)
  })

  it("falha quando JWT_PUBLIC_KEY ausente (ADR-009 RS256)", () => {
    expect(() => parseSocketEnv(omit("JWT_PUBLIC_KEY"))).toThrow(
      /JWT_PUBLIC_KEY/,
    )
  })

  it("falha quando AUTH_URL ausente ou invalida", () => {
    expect(() => parseSocketEnv(omit("AUTH_URL"))).toThrow(/AUTH_URL/)
    expect(() => parseSocketEnv({ ...valid, AUTH_URL: "nao-e-url" })).toThrow(
      /AUTH_URL/,
    )
  })

  it("falha quando REDIS_URL invalido", () => {
    expect(() => parseSocketEnv({ ...valid, REDIS_URL: "quebrado" })).toThrow(
      /REDIS_URL/,
    )
  })

  it("aceita REDIS_URL ausente — bus em memoria por design (revisao K)", () => {
    const env = parseSocketEnv(omit("REDIS_URL"))
    expect(env.REDIS_URL).toBeUndefined()
  })

  it("trata REDIS_URL vazia como ausente (bus em memoria)", () => {
    const env = parseSocketEnv({ ...valid, REDIS_URL: "" })
    expect(env.REDIS_URL).toBeUndefined()
  })

  it("falha quando SOCKET_PORT fora da faixa 1-65535", () => {
    expect(() => parseSocketEnv({ ...valid, SOCKET_PORT: "0" })).toThrow(
      /SOCKET_PORT/,
    )
    expect(() => parseSocketEnv({ ...valid, SOCKET_PORT: "70000" })).toThrow(
      /SOCKET_PORT/,
    )
    expect(() => parseSocketEnv({ ...valid, SOCKET_PORT: "abc" })).toThrow(
      /SOCKET_PORT/,
    )
  })

  it("coage ACCESS_TOKEN_TTL_SECONDS e usa default 900 (revisão R2)", () => {
    expect(parseSocketEnv(valid).ACCESS_TOKEN_TTL_SECONDS).toBe(900)
    expect(
      parseSocketEnv(omit("ACCESS_TOKEN_TTL_SECONDS")).ACCESS_TOKEN_TTL_SECONDS,
    ).toBe(900)
    expect(
      parseSocketEnv({
        ...valid,
        ACCESS_TOKEN_TTL_SECONDS: "3600",
      }).ACCESS_TOKEN_TTL_SECONDS,
    ).toBe(3600)
    expect(
      parseSocketEnv({
        ...valid,
        ACCESS_TOKEN_TTL_SECONDS: "",
      }).ACCESS_TOKEN_TTL_SECONDS,
    ).toBe(900)
  })

  it("falha quando ACCESS_TOKEN_TTL_SECONDS invalido (paridade com token-service)", () => {
    expect(() =>
      parseSocketEnv({ ...valid, ACCESS_TOKEN_TTL_SECONDS: "abc" }),
    ).toThrow(/ACCESS_TOKEN_TTL_SECONDS/)
    expect(() =>
      parseSocketEnv({ ...valid, ACCESS_TOKEN_TTL_SECONDS: "0" }),
    ).toThrow(/ACCESS_TOKEN_TTL_SECONDS/)
  })
})
