import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { createPublicKey, sign, verify } from "node:crypto"
import { afterEach, describe, expect, it, vi } from "vitest"

// CWE-798 (Crítico 8 da revisão): o config do Playwright não pode
// carregar par de chaves hardcoded — gera um par efêmero por execução
// quando JWT_PRIVATE_KEY/JWT_PUBLIC_KEY não vêm do ambiente.

describe("playwright.config — keypair efêmera", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it("fonte não contém chave privada literal", () => {
    const source = readFileSync(
      resolve(process.cwd(), "playwright.config.ts"),
      "utf8",
    )
    expect(source).not.toMatch(/BEGIN PRIVATE KEY/)
    expect(source).not.toMatch(/BEGIN PUBLIC KEY/)
  })

  it("gera par RS2256-efêmero quando o ambiente não fornece chaves", async () => {
    vi.stubEnv("JWT_PRIVATE_KEY", "")
    vi.stubEnv("JWT_PUBLIC_KEY", "")
    vi.resetModules()
    const config = (await import("../../playwright.config")).default
    const webServers = config.webServer as unknown as Array<{
      env?: Record<string, string>
    }>

    const env = webServers[0]!.env!
    const privateKeyPem = env["JWT_PRIVATE_KEY"]
    const publicKeyPem = env["JWT_PUBLIC_KEY"]
    expect(privateKeyPem).toMatch(/BEGIN PRIVATE KEY/)
    expect(publicKeyPem).toMatch(/BEGIN PUBLIC KEY/)

    // par coerente: assina e verifica
    const data = Buffer.from("e2e")
    const signature = sign("RSA-SHA256", data, privateKeyPem!)
    const publicKey = createPublicKey(publicKeyPem!)
    expect(verify("RSA-SHA256", data, publicKey, signature)).toBe(true)

    // socket-service recebe a MESMA chave pública
    const wsEnv = webServers[1]!.env!
    expect(wsEnv["JWT_PUBLIC_KEY"]).toBe(publicKeyPem)
    // geração do par RSA acontece no import do config — sob a carga da
    // suíte inteira passa de 5s (timeout default); 20s evita flake de gate
  }, 20_000)
})
