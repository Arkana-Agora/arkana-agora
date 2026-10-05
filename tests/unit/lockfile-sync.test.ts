import { readFileSync } from "node:fs"
import { resolve } from "node:path"

import { describe, expect, it } from "vitest"

// Contrato de deploy (T067): `socket-service/Dockerfile` roda
// `npm ci` com `package.json` + `package-lock.json`. O npm rejeita
// lock dessincronizado ("Missing: <pkg> from lock file") — só atualizar
// `bun.lock` (CI usa bun) deixou a imagem do mini-service sem buildar.
describe("lockfile sync (npm ci contract)", () => {
  const pkg = JSON.parse(
    readFileSync(resolve(process.cwd(), "package.json"), "utf8"),
  ) as {
    dependencies?: Record<string, string>
    devDependencies?: Record<string, string>
  }
  const lock = JSON.parse(
    readFileSync(resolve(process.cwd(), "package-lock.json"), "utf8"),
  ) as {
    packages?: Record<
      string,
      {
        dependencies?: Record<string, string>
        devDependencies?: Record<string, string>
      }
    >
  }

  const allDeps = {
    ...pkg.dependencies,
    ...pkg.devDependencies,
  }

  it("toda dependência direta existe no package-lock.json", () => {
    const lockPackages = lock.packages ?? {}
    const missing = Object.keys(allDeps).filter(
      (name) => lockPackages[`node_modules/${name}`] === undefined,
    )
    expect(missing).toEqual([])
  })

  it('packages[""] do lock espelha os ranges do package.json', () => {
    const root = lock.packages?.[""] ?? {}
    expect(root.dependencies ?? {}).toEqual(pkg.dependencies ?? {})
    expect(root.devDependencies ?? {}).toEqual(pkg.devDependencies ?? {})
  })
})

// Revisão I-b: o mini-service tem package.json/lock PRÓPRIOS (o npm ci da
// imagem instala só a árvore do serviço, nunca o monólito) e os ranges
// ficam sincronizados com o raiz para não divergirem.
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
