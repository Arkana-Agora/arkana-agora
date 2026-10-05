// @vitest-environment node
import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

// Revisão I-c: fronteira de módulos do mini-service. O Dockerfile copia
// SÓ socket-service/ (com o lockfile do serviço) — o closure de runtime
// (index.ts → server/bus/auth/env/…) não pode importar o alias @/ (src/
// raiz do monólito, com Prisma/analytics). emitters.ts é a exceção
// documentada: só as rotas do Next.js o carregam em runtime (o socket-
// service vê apenas `import type` de event-schemas, erased no build).
// Revisão consistência: a lista de arquivos é DERIVADA DO DISCO — a
// hardcoded anterior podia ficar obsoleta e deixar um import @/ (ou um
// 2º `pino()`) num arquivo novo passar despercebido.
const root = join(__dirname, "..", "..")

function listSocketFiles(): string[] {
  const files: string[] = []
  const walk = (dir: string, prefix: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name
      if (entry.isDirectory()) walk(join(dir, entry.name), rel)
      else if (entry.name.endsWith(".ts")) files.push(rel)
    }
  }
  walk(join(root, "socket-service"), "")
  return files.sort()
}

const ALL = listSocketFiles()
const EMITTERS = "src/emitters.ts"
const CLOSURE = ALL.filter((rel) => rel !== EMITTERS)

function read(rel: string): string {
  return readFileSync(join(root, "socket-service", rel), "utf8")
}

// import de VALOR do alias (import type é erased e não empacota nada)
const valueAtImport = /^import(?!\s+type)[^\n]*from\s+["']@\//m

describe("socket-service fronteira de módulos (revisão I-c)", () => {
  it("a varredura cobre todos os .ts do diretório (lista derivada do disco)", () => {
    expect(ALL).toContain("index.ts")
    expect(ALL).toContain("src/emitters.ts")
    expect(CLOSURE.length).toBeGreaterThan(0)
    expect(CLOSURE).not.toContain(EMITTERS)
  })

  it("closure de runtime não importa o alias @/ (a imagem não copia src/)", () => {
    const offenders = CLOSURE.filter((rel) => valueAtImport.test(read(rel)))
    expect(offenders).toEqual([])
  })

  it("nenhum arquivo do closure importa emitters como valor", () => {
    const offenders = CLOSURE.filter((rel) =>
      /^import(?!\s+type)[^\n]*from\s+["']\.\/emitters["']/m.test(read(rel)),
    )
    expect(offenders).toEqual([])
  })

  it("emitters.ts é o ÚNICO arquivo do diretório com import de valor de @/", () => {
    const withValueAt = ALL.filter((rel) => valueAtImport.test(read(rel)))
    expect(withValueAt).toEqual(["src/emitters.ts"])
  })

  it("event-schemas acessa emitters só via import type (erased no runtime)", () => {
    expect(read("src/event-schemas.ts")).toMatch(
      /^import type [^\n]*from "\.\/emitters"$/m,
    )
  })

  it("exceção e pino-próprio documentados na fronteira", () => {
    expect(read("src/emitters.ts")).toContain("[fronteira I-c]")
    expect(read("src/lib/logger.ts")).toContain("[fronteira I-c]")
  })

  it("logger pino instanciado num único ponto do socket-service (revisão consistência)", () => {
    const withPinoInstantiation = ALL.filter((rel) =>
      /\bpino\(\{/.test(read(rel)),
    )
    expect(withPinoInstantiation).toEqual(["src/lib/logger.ts"])
  })
})
