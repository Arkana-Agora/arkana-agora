import { beforeEach, describe, expect, it } from "vitest"

import {
  allowHandshake,
  resolveClientIp,
  resetHandshakeLimitForTests,
} from "../../socket-service/src/handshake-limit"

const WINDOW_MS = 60_000

describe("handshake-limit (importante — brute force no handshake)", () => {
  beforeEach(() => {
    resetHandshakeLimitForTests()
  })

  it("permite `max` tentativas na janela e bloqueia a seguinte", () => {
    const now = 1_000_000
    for (let i = 0; i < 3; i += 1) {
      expect(
        allowHandshake("1.2.3.4", { max: 3, windowMs: WINDOW_MS, now }),
      ).toBe(true)
    }
    expect(
      allowHandshake("1.2.3.4", { max: 3, windowMs: WINDOW_MS, now }),
    ).toBe(false)
  })

  it("janela deslizante: após a janela volta a permitir", () => {
    const start = 1_000_000
    for (let i = 0; i < 3; i += 1) {
      allowHandshake("1.2.3.4", { max: 3, windowMs: WINDOW_MS, now: start })
    }
    expect(
      allowHandshake("1.2.3.4", { max: 3, windowMs: WINDOW_MS, now: start }),
    ).toBe(false)
    const later = start + WINDOW_MS + 1
    expect(
      allowHandshake("1.2.3.4", { max: 3, windowMs: WINDOW_MS, now: later }),
    ).toBe(true)
  })

  it("IPs são contados de forma independente", () => {
    const now = 1_000_000
    for (let i = 0; i < 3; i += 1) {
      allowHandshake("1.2.3.4", { max: 3, windowMs: WINDOW_MS, now })
    }
    expect(
      allowHandshake("5.6.7.8", { max: 3, windowMs: WINDOW_MS, now }),
    ).toBe(true)
  })

  it("reset limpa o estado", () => {
    const now = 1_000_000
    for (let i = 0; i < 3; i += 1) {
      allowHandshake("1.2.3.4", { max: 3, windowMs: WINDOW_MS, now })
    }
    resetHandshakeLimitForTests()
    expect(
      allowHandshake("1.2.3.4", { max: 3, windowMs: WINDOW_MS, now }),
    ).toBe(true)
  })
})

describe("resolveClientIp (S1 — XFF spoofable na primeira entrada)", () => {
  it("produção: usa a ÚLTIMA entrada do XFF (hop anexado pelo proxy de confiança)", () => {
    expect(
      resolveClientIp(
        { "x-forwarded-for": "203.0.113.7, 198.51.100.9" },
        "10.0.0.1",
        { nodeEnv: "production" },
      ),
    ).toBe("198.51.100.9")
  })

  it("produção: entrada única é o próprio valor", () => {
    expect(
      resolveClientIp({ "x-forwarded-for": "203.0.113.7" }, "10.0.0.1", {
        nodeEnv: "production",
      }),
    ).toBe("203.0.113.7")
  })

  it("produção: sem XFF cai para o address do socket", () => {
    expect(resolveClientIp({}, "10.0.0.1", { nodeEnv: "production" })).toBe(
      "10.0.0.1",
    )
    expect(
      resolveClientIp(undefined, "10.0.0.1", { nodeEnv: "production" }),
    ).toBe("10.0.0.1")
  })

  it("produção: ignora entradas vazias e aceita header como array", () => {
    expect(
      resolveClientIp(
        { "x-forwarded-for": ["  ", " 198.51.100.9 , "] },
        "10.0.0.1",
        { nodeEnv: "production" },
      ),
    ).toBe("198.51.100.9")
  })

  it("não-produção: ignora XFF (spoofável sem proxy) e usa o address", () => {
    expect(
      resolveClientIp({ "x-forwarded-for": "203.0.113.7" }, "127.0.0.1", {
        nodeEnv: "test",
      }),
    ).toBe("127.0.0.1")
    expect(
      resolveClientIp({ "x-forwarded-for": "203.0.113.7" }, "127.0.0.1", {
        nodeEnv: "development",
      }),
    ).toBe("127.0.0.1")
  })

  it("sem nodeEnv explícito segue process.env.NODE_ENV (vitest = test → address)", () => {
    expect(
      resolveClientIp({ "x-forwarded-for": "203.0.113.7" }, "127.0.0.1"),
    ).toBe("127.0.0.1")
  })
})
