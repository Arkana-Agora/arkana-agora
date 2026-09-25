import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest"

const AUTH_CONFIG_PATH = "@/auth/auth.config"
const GUARD_ENV_KEYS = [
  "AUTH_URL",
  "AUTH_SECRET",
  "NEXT_PHASE",
  "NODE_ENV",
  "VERCEL_ENV",
  "AUTH_GOOGLE_ID",
  "AUTH_GOOGLE_SECRET",
] as const

let guardEnvSnapshot: Record<string, string | undefined>

beforeAll(async () => {
  await import("@/lib/prisma")
})

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
  guardEnvSnapshot = Object.fromEntries(
    GUARD_ENV_KEYS.map((k) => [k, process.env[k]]),
  )
  delete process.env.AUTH_GOOGLE_ID
  delete process.env.AUTH_GOOGLE_SECRET
})

afterEach(() => {
  for (const [key, value] of Object.entries(guardEnvSnapshot)) {
    if (value === undefined) {
      delete process.env[key]
    } else {
      process.env[key] = value
    }
  }
  vi.unstubAllEnvs()
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

describe("authConfig — production env guard", () => {
  it("sem AUTH_URL em produção: lança com AUTH_URL_in_env=false", async () => {
    vi.stubEnv("NODE_ENV", "production")
    vi.stubEnv("VERCEL_ENV", "production")
    delete process.env.AUTH_URL
    delete process.env.AUTH_SECRET
    delete process.env.NEXT_PHASE
    await expect(import(AUTH_CONFIG_PATH)).rejects.toThrow(
      /AUTH_URL_in_env=false/,
    )
  })

  it("AUTH_URL vazia (string '') em produção: lança com AUTH_URL_in_env=true", async () => {
    vi.stubEnv("NODE_ENV", "production")
    vi.stubEnv("AUTH_URL", "")
    delete process.env.AUTH_SECRET
    delete process.env.NEXT_PHASE
    await expect(import(AUTH_CONFIG_PATH)).rejects.toThrow(
      /AUTH_URL_in_env=true, AUTH_URL_empty=true/,
    )
  })

  it("AUTH_URL http (não https) em produção: lança com scheme diagnostic", async () => {
    vi.stubEnv("NODE_ENV", "production")
    vi.stubEnv("AUTH_URL", "http://arkanaagora.com.br")
    vi.stubEnv("AUTH_SECRET", "prod-secret")
    delete process.env.NEXT_PHASE
    await expect(import(AUTH_CONFIG_PATH)).rejects.toThrow(
      /AUTH_URL deve usar https:\/\/.*got scheme=http:/,
    )
  })

  it("AUTH_URL com origin malformado (`https:/evil.com`) em produção: lança com origin diagnostic", async () => {
    vi.stubEnv("NODE_ENV", "production")
    vi.stubEnv("AUTH_URL", "https:/evil.com")
    vi.stubEnv("AUTH_SECRET", "prod-secret")
    delete process.env.NEXT_PHASE
    await expect(import(AUTH_CONFIG_PATH)).rejects.toThrow(/origin=malformado/)
  })

  it("AUTH_URL com origin malformado por backslash (`https:\\evil.com`) em produção: lança", async () => {
    vi.stubEnv("NODE_ENV", "production")
    vi.stubEnv("AUTH_URL", "https:\\evil.com")
    vi.stubEnv("AUTH_SECRET", "prod-secret")
    delete process.env.NEXT_PHASE
    await expect(import(AUTH_CONFIG_PATH)).rejects.toThrow(/origin=malformado/)
  })

  it("AUTH_URL com userinfo (credenciais) em produção: lança com origin diagnostic", async () => {
    vi.stubEnv("NODE_ENV", "production")
    vi.stubEnv("AUTH_URL", "https://user:pass@auth.example.com")
    vi.stubEnv("AUTH_SECRET", "prod-secret")
    delete process.env.NEXT_PHASE
    await expect(import(AUTH_CONFIG_PATH)).rejects.toThrow(
      /origin=com-credential/,
    )
  })

  it("AUTH_URL com query em produção: lança com origin diagnostic", async () => {
    vi.stubEnv("NODE_ENV", "production")
    vi.stubEnv("AUTH_URL", "https://auth.example.com?tenant=abc")
    vi.stubEnv("AUTH_SECRET", "prod-secret")
    delete process.env.NEXT_PHASE
    await expect(import(AUTH_CONFIG_PATH)).rejects.toThrow(
      /origin=com-query-fragment/,
    )
  })

  it("AUTH_URL com fragment em produção: lança com origin diagnostic", async () => {
    vi.stubEnv("NODE_ENV", "production")
    vi.stubEnv("AUTH_URL", "https://auth.example.com/#fragment")
    vi.stubEnv("AUTH_SECRET", "prod-secret")
    delete process.env.NEXT_PHASE
    await expect(import(AUTH_CONFIG_PATH)).rejects.toThrow(
      /origin=com-query-fragment/,
    )
  })

  it("AUTH_URL nao-parseavel (`https:`) em produção: lança com invalid-url", async () => {
    vi.stubEnv("NODE_ENV", "production")
    vi.stubEnv("AUTH_URL", "https:")
    vi.stubEnv("AUTH_SECRET", "prod-secret")
    delete process.env.NEXT_PHASE
    await expect(import(AUTH_CONFIG_PATH)).rejects.toThrow(
      /AUTH_URL deve usar https:\/\/.*got scheme=invalid-url.*host=\(vazio\)/,
    )
  })

  it("sem AUTH_SECRET em produção: lança com VERCEL_ENV no diagnostic", async () => {
    vi.stubEnv("NODE_ENV", "production")
    vi.stubEnv("AUTH_URL", "https://arkanaagora.com.br")
    vi.stubEnv("VERCEL_ENV", "preview")
    delete process.env.AUTH_SECRET
    delete process.env.NEXT_PHASE
    await expect(import(AUTH_CONFIG_PATH)).rejects.toThrow(
      /AUTH_SECRET.*VERCEL_ENV=preview/,
    )
  })

  it("AUTH_URL+AUTH_SECRET válidos em produção: import resolve", async () => {
    vi.stubEnv("NODE_ENV", "production")
    vi.stubEnv("AUTH_URL", "https://arkanaagora.com.br")
    vi.stubEnv("AUTH_SECRET", "prod-secret")
    delete process.env.NEXT_PHASE
    const { authConfig } = await import(AUTH_CONFIG_PATH)
    expect(authConfig.providers.length).toBeGreaterThan(0)
  })

  it("NEXT_PHASE=phase-production-build ignora guard (build pode ir sem runtime env)", async () => {
    vi.stubEnv("NODE_ENV", "production")
    vi.stubEnv("NEXT_PHASE", "phase-production-build")
    delete process.env.AUTH_URL
    delete process.env.AUTH_SECRET
    const { authConfig } = await import(AUTH_CONFIG_PATH)
    expect(authConfig).toBeDefined()
  })
})
