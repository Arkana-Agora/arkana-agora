import { describe, expect, it } from "vitest"

import { resolveSocketUrl } from "../../src/lib/socket-url"

// Revisao P: NEXT_PUBLIC_WS_URL precisa de validacao — string vazia nao
// pode vazar para io(), protocolo errado (ftp:, localhost:3003 sem
// esquema) falha ruidoso, e o default de dev so entra quando a var esta
// realmente ausente.

describe("resolveSocketUrl (revisao P)", () => {
  it("ausente → default de dev http://localhost:3003", () => {
    expect(resolveSocketUrl(undefined)).toBe("http://localhost:3003")
  })

  it("string vazia → default de dev (não vaza para io)", () => {
    expect(resolveSocketUrl("")).toBe("http://localhost:3003")
  })

  it("produção sem a var → null (realtime desabilitado, nunca localhost)", () => {
    // C1 revisao nextjs: localhost em produção mandaria o access token
    // RS256 no handshake para qualquer processo local ouvindo a 3003 —
    // e o WARN de build prometia um throw que nunca acontecia.
    expect(resolveSocketUrl(undefined, "production")).toBeNull()
    expect(resolveSocketUrl("", "production")).toBeNull()
  })

  it("dev/test sem a var → default de dev", () => {
    expect(resolveSocketUrl(undefined, "development")).toBe(
      "http://localhost:3003",
    )
    expect(resolveSocketUrl(undefined, "test")).toBe("http://localhost:3003")
  })

  it("produção COM a var válida → usa a URL normalizada", () => {
    expect(resolveSocketUrl("wss://ws.exemplo.com", "production")).toBe(
      "wss://ws.exemplo.com",
    )
  })

  it("produção com a var malformada continua falhando ruidoso", () => {
    expect(() => resolveSocketUrl("localhost:3003", "production")).toThrow(
      /NEXT_PUBLIC_WS_URL/,
    )
  })

  it("aceita http/https/ws/wss e normaliza barra final", () => {
    expect(resolveSocketUrl("https://ws.exemplo.com")).toBe(
      "https://ws.exemplo.com",
    )
    expect(resolveSocketUrl("https://ws.exemplo.com/")).toBe(
      "https://ws.exemplo.com",
    )
    expect(resolveSocketUrl("wss://ws.exemplo.com")).toBe(
      "wss://ws.exemplo.com",
    )
    expect(resolveSocketUrl("ws://localhost:3003")).toBe("ws://localhost:3003")
  })

  it("protocolo não suportado falha ruidoso", () => {
    expect(() => resolveSocketUrl("ftp://ws.exemplo.com")).toThrow(
      /NEXT_PUBLIC_WS_URL/,
    )
    expect(() => resolveSocketUrl("localhost:3003")).toThrow(
      /NEXT_PUBLIC_WS_URL/,
    )
    expect(() => resolveSocketUrl("nao e url")).toThrow(/NEXT_PUBLIC_WS_URL/)
  })
})
