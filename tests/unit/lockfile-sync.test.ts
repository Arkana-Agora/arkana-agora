import { readFileSync } from "node:fs"
import { resolve } from "node:path"

import { describe, expect, it } from "vitest"

// O raiz foi migrado para bun.lock (CI usa bun); o único contrato npm ci é o
// do socket-service/Dockerfile, que roda `npm ci` com package.json +
// package-lock.json PRÓPRIOS do serviço (nunca a árvore do monólito).
describe("socket-service packaging (revisão I-b)", () => {
  const svcPkg = JSON.parse(
    readFileSync(
      resolve(process.cwd(), "socket-service", "package.json"),
      "utf8",
    ),
  ) as { name?: string; dependencies?: Record<string, string> }

  const rootPkg = JSON.parse(
    readFileSync(resolve(process.cwd(), "package.json"), "utf8"),
  ) as {
    dependencies?: Record<string, string>
    devDependencies?: Record<string, string>
  }

  it("package-lock.json local existe e casa com o name do package.json", () => {
    const svcLock = JSON.parse(
      readFileSync(
        resolve(process.cwd(), "socket-service", "package-lock.json"),
        "utf8",
      ),
    ) as { name?: string; packages?: Record<string, unknown> }
    expect(svcLock.name).toBe(svcPkg.name)
    const missing = Object.keys(svcPkg.dependencies ?? {}).filter(
      (name) => svcLock.packages?.[`node_modules/${name}`] === undefined,
    )
    expect(missing).toEqual([])
  })

  it("ranges das dependências do serviço sincronizados com o raiz", () => {
    for (const [name, range] of Object.entries(svcPkg.dependencies ?? {})) {
      const rootRange =
        rootPkg.dependencies?.[name] ?? rootPkg.devDependencies?.[name]
      expect(rootRange, `range de ${name} divergente do raiz`).toBe(range)
    }
  })

  it("tsx é dependência do serviço (CMD roda sem npm i -g)", () => {
    expect(svcPkg.dependencies).toHaveProperty("tsx")
  })

  it("fecha com as dependências de runtime reais do mini-service", () => {
    // server/bus/env/event-schemas/auth — se trocar o import, atualiza aqui
    expect(Object.keys(svcPkg.dependencies ?? {}).sort()).toEqual(
      [
        "@socket.io/redis-adapter",
        "dotenv",
        "ioredis",
        "jose",
        "pino",
        "socket.io",
        "tsx",
        "zod",
      ].sort(),
    )
  })
})
