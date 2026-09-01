import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const AUTH_CONFIG_PATH = "@/auth/auth.config"

type ProviderLike = {
  id: string
  type?: string
  options?: { maxAge?: number }
}

function providerIds(providers: readonly unknown[]): string[] {
  return (providers as readonly ProviderLike[]).map((p) => p.id)
}

function findEmailProvider(providers: readonly unknown[]): ProviderLike {
  return (providers as readonly ProviderLike[]).find((p) => p.id === "email")!
}

beforeEach(() => {
  delete process.env.AUTH_GOOGLE_ID
  delete process.env.AUTH_GOOGLE_SECRET
})

afterEach(() => {
  delete process.env.AUTH_GOOGLE_ID
  delete process.env.AUTH_GOOGLE_SECRET
  vi.resetModules()
})

describe("authConfig — provider contract (T1 — ADR-010)", () => {
  it("email sempre presente; google só com credenciais", async () => {
    const { authConfig } = await import(AUTH_CONFIG_PATH)
    const ids = providerIds(authConfig.providers)
    expect(ids).toContain("email")
    expect(ids).not.toContain("google")
  })

  it("google presente quando AUTH_GOOGLE_ID+AUTH_GOOGLE_SECRET definidos", async () => {
    process.env.AUTH_GOOGLE_ID = "test-google-id"
    process.env.AUTH_GOOGLE_SECRET = "test-google-secret"
    const { authConfig } = await import(AUTH_CONFIG_PATH)
    const ids = providerIds(authConfig.providers)
    expect(ids).toContain("google")
    expect(ids).toContain("email")
  })

  it("EmailProvider configurado para magic link de 15 minutos (maxAge 15*60)", async () => {
    const { authConfig } = await import(AUTH_CONFIG_PATH)
    expect(findEmailProvider(authConfig.providers).options?.maxAge).toBe(
      15 * 60,
    )
  })
})
