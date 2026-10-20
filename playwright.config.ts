import { generateKeyPairSync } from "node:crypto"
import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"
import { defineConfig, devices } from "@playwright/test"

import { resolveE2eDatabaseUrl } from "./tests/e2e/database-url"

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000"
// In Vitest, BASE_URL defaults to "/" (import.meta.env.BASE_URL). When this
// config is imported by a unit test (e.g. playwright-config.test.ts), we must
// ensure any code that constructs a URL (like storageState origins) does not
// crash — detect and coerce to a valid absolute URL.
const BASE_URL_FOR_TESTS = /^https?:\/\//.test(BASE_URL)
  ? BASE_URL
  : `http://localhost:3000`
// Redis local: Event Bus (architecture.md §6.4) e Redis adapter precisam
// cruzar processos — Next.js e socket-service são servers separados
// (ADR-007), então o bus em memória não serve para o E2E de realtime.
const REDIS_URL = process.env.REDIS_URL ?? "redis://localhost:6379"
// Split-brain do E2E (Crítico 9): o Playwright faz `env: {...process.env, ...webServer.env}`
// (runner/index.js), então o DATABASE_URL remoto e o AUTH_URL do .env do runner
// vazariam para dentro do `next dev`, enquanto as specs leem o .env.local
// (tests/e2e/database-url.ts) — dois bancos distintos: usuário criado num,
// verificado noutro. O mesmo valor é fixado nos DOIS lados, e o resolveE2eDatabaseUrl
// recusa host remoto (specs destrutivas nunca tocam banco de produção).
const ENV_LOCAL_PATH = resolve(process.cwd(), ".env.local")
const DATABASE_URL = resolveE2eDatabaseUrl({
  envLocalContent: existsSync(ENV_LOCAL_PATH)
    ? readFileSync(ENV_LOCAL_PATH, "utf8")
    : undefined,
  envDatabaseUrl: process.env.DATABASE_URL,
})

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
    baseURL: BASE_URL_FOR_TESTS,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    // LGPD gate (docs/07-security/lgpd.md §Cookie Banner): com
    // localStorage vazio o AnalyticsConsentBanner abre e o backdrop
    // `fixed inset-0 z-50` intercepta todo clique da página — o "Entrar"
    // fica inalcançável. Pré-salva a mesma decisão que o diálogo grava em
    // setAnalyticsConsent("false") ("Rejeitar Analytics"), antes de qualquer
    // navegação; contexts manuais (social-realtime) repetem via addInitScript.
    storageState: {
      cookies: [],
      origins: [
        {
          origin: new URL(BASE_URL_FOR_TESTS).origin,
          localStorage: [{ name: "analytics-consent", value: "false" }],
        },
      ],
    },
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
      url: BASE_URL_FOR_TESTS,
      reuseExistingServer: true,
      timeout: 120_000,
      env: {
        // AUTH_URL do .env (produção) vazaria via process.env e faria o
        // Auth.js emitir cookie `__Secure-` sobre http → o browser descarta
        // e o login em UI cai em loop / sessão ausente.
        AUTH_URL: BASE_URL_FOR_TESTS,
        // IA sem dependência externa: .env traz AI_API_KEY placeholder
        // ("dev-ai-key") e o POST de interpret cascateia retries do SDK +
        // withRetry (4 tentativas × backoff 1s/2s/4s contra api.z.ai) estourando
        // os 30s do timeout do teste. As specs de IA aceitam 503 como caminho
        // válido (CA-AI-007 e CA-ARC-005) e o happy path com provider mockado
        // é coberto em tests/integration/ai-*.test.ts — então o harness fixa a
        // chave vazia: requireAIClient() responde 503 fail-fast (e sem queimar
        // a quota diária) em milissegundos.
        AI_API_KEY: "",
        // Cota de cadastro por IP é 3/60min (.env) e a suite roda o
        // endpoint /auth/register várias vezes na mesma janela (CA-AUTH-001
        // é o único POST de cadastro, mas há 1+ execução por hora em
        // dev/CI) → 429 na 4ª execução. Sobe só no harness (dotenv não
        // sobrescreve env do processo); produção mantém 3 e a regra 429
        // continua coberta em tests/register.test.ts.
        MAX_REGISTER_IP_ATTEMPTS: "50",
        JWT_PRIVATE_KEY,
        JWT_PUBLIC_KEY,
        REDIS_URL,
        DATABASE_URL,
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
        AUTH_URL: BASE_URL_FOR_TESTS,
        JWT_PUBLIC_KEY,
        SOCKET_PORT: "3003",
        REDIS_URL,
        DATABASE_URL,
      },
    },
  ],
})
