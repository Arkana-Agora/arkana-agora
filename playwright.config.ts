import { generateKeyPairSync } from "node:crypto"
import { defineConfig, devices } from "@playwright/test"

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000"
// Redis local: Event Bus (architecture.md §6.4) e Redis adapter precisam
// cruzar processos — Next.js e socket-service são servers separados
// (ADR-007), então o bus em memória não serve para o E2E de realtime.
const REDIS_URL = process.env.REDIS_URL ?? "redis://localhost:6379"

// CWE-798 (Crítico 8 da revisão): sem chave privada literal no repo.
// Com ambiente sem chaves, gera um par RS256 efêmero por execução do
// Playwright — mesma instância do módulo alimenta os dois webServers,
// então Next.js e socket-service validam o mesmo par. Com chaves no
// ambiente (CI/.env), elas vencem.
function ephemeralKeypair(): { privateKey: string; publicKey: string } {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
  })
  return {
    privateKey: privateKey.export({ type: "pkcs8", format: "pem" }) as string,
    publicKey: publicKey.export({ type: "spki", format: "pem" }) as string,
  }
}

const envPrivateKey = process.env.JWT_PRIVATE_KEY
const envPublicKey = process.env.JWT_PUBLIC_KEY
const ephemeral =
  envPrivateKey !== undefined &&
  envPrivateKey !== "" &&
  envPublicKey !== undefined &&
  envPublicKey !== ""
    ? null
    : ephemeralKeypair()

const JWT_PRIVATE_KEY = envPrivateKey || ephemeral!.privateKey
const JWT_PUBLIC_KEY = envPublicKey || ephemeral!.publicKey

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: [
    {
      command: "npm run dev",
      url: BASE_URL,
      reuseExistingServer: true,
      timeout: 120_000,
      env: {
        JWT_PRIVATE_KEY,
        JWT_PUBLIC_KEY,
        REDIS_URL,
      },
    },
    // socket-service (ADR-007, T066): healthcheck /health na 3003 —
    // necessário para os specs de realtime (T075) e /health do mini-service.
    {
      command: "npm run dev:ws",
      url: "http://localhost:3003/health",
      reuseExistingServer: true,
      timeout: 60_000,
      env: {
        AUTH_URL: BASE_URL,
        JWT_PUBLIC_KEY,
        SOCKET_PORT: "3003",
        REDIS_URL,
      },
    },
  ],
})
