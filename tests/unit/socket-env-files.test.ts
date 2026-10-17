// @vitest-environment node
import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

import {
  loadSocketEnvFiles,
  parseSocketEnv,
} from "../../socket-service/src/lib/env"

// Regressão do bug `bun run dev:ws`: o tsx (Node) não carrega arquivos de
// env — só o Bun/Next fazem isso — então AUTH_URL/JWT_PUBLIC_KEY nunca
// chegavam em parseSocketEnv e o boot morria com "Required".
describe("loadSocketEnvFiles", () => {
  let baseDir: string
  let target: Record<string, string | undefined>

  beforeEach(() => {
    baseDir = mkdtempSync(join(tmpdir(), "socket-env-"))
    target = {}
  })

  afterEach(() => {
    rmSync(baseDir, { recursive: true, force: true })
  })

  it("carrega variáveis de .env e .env.local do diretório base", () => {
    writeFileSync(join(baseDir, ".env"), "AUTH_URL=http://localhost:3000\n")
    writeFileSync(
      join(baseDir, ".env.local"),
      "JWT_PUBLIC_KEY=-----BEGIN PUBLIC KEY-----\nabc\n-----END PUBLIC KEY-----\n",
    )

    loadSocketEnvFiles(baseDir, target)

    expect(target.AUTH_URL).toBe("http://localhost:3000")
    expect(target.JWT_PUBLIC_KEY).toContain("BEGIN PUBLIC KEY")
  })

  it(".env.local vence .env para a mesma chave (precedência Next)", () => {
    writeFileSync(join(baseDir, ".env"), "SOCKET_PORT=3003\n")
    writeFileSync(join(baseDir, ".env.local"), "SOCKET_PORT=3004\n")

    loadSocketEnvFiles(baseDir, target)

    expect(target.SOCKET_PORT).toBe("3004")
  })

  it("não sobrescreve valor já presente no ambiente (process env vence)", () => {
    writeFileSync(join(baseDir, ".env"), "SOCKET_PORT=3003\n")
    const envTarget: Record<string, string | undefined> = {
      SOCKET_PORT: "4004",
    }

    loadSocketEnvFiles(baseDir, envTarget)

    expect(envTarget.SOCKET_PORT).toBe("4004")
  })

  it("não falha quando os arquivos não existem (target intocado)", () => {
    expect(() => loadSocketEnvFiles(baseDir, target)).not.toThrow()
    expect(target).toEqual({})
  })

  it("consegue usar os arquivos para satisfazer parseSocketEnv", () => {
    writeFileSync(join(baseDir, ".env"), "AUTH_URL=http://localhost:3000\n")
    writeFileSync(join(baseDir, ".env.local"), "JWT_PUBLIC_KEY=chave-rs256\n")

    loadSocketEnvFiles(baseDir, target)

    const env = parseSocketEnv(target)
    expect(env.AUTH_URL).toBe("http://localhost:3000")
    expect(env.SOCKET_PORT).toBe(3003)
  })
})
