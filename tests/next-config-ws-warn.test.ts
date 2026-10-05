// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest"

vi.mock("@sentry/nextjs", () => ({
  withSentryConfig: (config: unknown) => config,
}))

// Revisão I-e: NEXT_PUBLIC_WS_URL é inlined em BUILD time (next build)
// — um build de produção sem a variável deixa o client SEM endpoint WS:
// resolveSocketUrl devolve null em produção e o realtime fica
// desabilitado (fallback de polling; C1 revisão nextjs). O CI não falha
// (ci.yml:88 builda sem a var), então é WARN, não erro.
async function importNextConfig(): Promise<void> {
  vi.resetModules()
  await import("../next.config")
}

function warnCalls(): string[] {
  return vi
    .mocked(console.warn)
    .mock.calls.map((args) => args.map(String).join(" "))
}

describe("next.config WARN sem NEXT_PUBLIC_WS_URL em produção (revisão I-e)", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
    vi.resetModules()
  })

  it("avisa (não falha) no build de produção sem a variável", async () => {
    vi.stubEnv("NODE_ENV", "production")
    vi.stubEnv("NEXT_PUBLIC_WS_URL", "")
    delete process.env.NEXT_PUBLIC_WS_URL
    vi.spyOn(console, "warn").mockImplementation(() => {})

    await importNextConfig()

    expect(warnCalls().some((msg) => msg.includes("NEXT_PUBLIC_WS_URL"))).toBe(
      true,
    )
  })

  it("não avisa em desenvolvimento (next dev)", async () => {
    vi.stubEnv("NODE_ENV", "development")
    delete process.env.NEXT_PUBLIC_WS_URL
    vi.spyOn(console, "warn").mockImplementation(() => {})

    await importNextConfig()

    expect(warnCalls().some((msg) => msg.includes("NEXT_PUBLIC_WS_URL"))).toBe(
      false,
    )
  })

  it("não avisa quando a variável está definida", async () => {
    vi.stubEnv("NODE_ENV", "production")
    vi.stubEnv("NEXT_PUBLIC_WS_URL", "wss://ws.exemplo.com")
    vi.spyOn(console, "warn").mockImplementation(() => {})

    await importNextConfig()

    expect(warnCalls().some((msg) => msg.includes("NEXT_PUBLIC_WS_URL"))).toBe(
      false,
    )
  })
})
