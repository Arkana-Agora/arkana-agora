// @vitest-environment node
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

// T067/T068 — contrato de deploy do mini-service (ADR-007): o Dockerfile
// precisa subir node:20-alpine com healthcheck no /health e o PM2 precisa
// rodar em cluster com instances 'max' (Redis adapter/bus escala entre
// workers — architecture.md §6.4).

const root = join(__dirname, "..", "..")

describe("socket-service deploy contract (T067/T068)", () => {
  const dockerfile = readFileSync(
    join(root, "socket-service", "Dockerfile"),
    "utf8",
  )

  it("Dockerfile: base node fixa (sem tag flutuante) + healthcheck /health", () => {
    // Revisão I-b: patch pinado (ex.: node:20.20.2-alpine3.23) — tag como
    // `node:20-alpine` muda sozinha entre builds.
    expect(dockerfile).toMatch(/^FROM node:\d+\.\d+\.\d+-alpine\d+(\.\d+)*$/m)
    expect(dockerfile).toContain("wget -qO- http://localhost:3003/health")
    expect(dockerfile).toContain("HEALTHCHECK")
    expect(dockerfile).toContain("EXPOSE 3003")
  })

  it("Dockerfile: runtime não-root (USER node após o COPY)", () => {
    const userAt = dockerfile.search(/^USER node$/m)
    const copyAt = dockerfile.indexOf("COPY socket-service ./socket-service")
    expect(userAt).toBeGreaterThan(-1)
    expect(copyAt).toBeGreaterThan(-1)
    expect(userAt).toBeGreaterThan(copyAt)
  })

  it("Dockerfile: árvore npm só do serviço (sem monólito, sem tsx global)", () => {
    expect(dockerfile).toContain(
      "COPY socket-service/package.json socket-service/package-lock.json ./",
    )
    expect(dockerfile).toContain("npm ci --omit=dev")
    // não copia o lockfile do monólito nem instala tsx globalmente
    expect(dockerfile).not.toContain("COPY package.json package-lock.json")
    expect(dockerfile).not.toContain("npm install -g")
  })

  it("Dockerfile: CMD usa tsx do node_modules local", () => {
    expect(dockerfile).toContain('"./node_modules/.bin/tsx"')
    expect(dockerfile).toContain('"socket-service/index.ts"')
  })

  it("ecosystem.config.js: cluster mode com instances 'max'", () => {
    const ecosystem = readFileSync(
      join(root, "socket-service", "ecosystem.config.js"),
      "utf8",
    )
    expect(ecosystem).toContain('instances: "max"')
    expect(ecosystem).toContain('exec_mode: "cluster"')
    expect(ecosystem).toContain("socket-service")
  })
})
