import { describe, expect, it } from "vitest"
import { existsSync, readFileSync, readdirSync } from "fs"
import { extname, join } from "path"

const SELF = join(process.cwd(), "tests", "r2-env-contract.test.ts")
const SCAN_DIRS = ["src", "tests", ".github"]
const SCAN_FILES = [
  ".env.example",
  "next.config.ts",
  "vitest.config.ts",
  "package.json",
]
const TEXT_EXTS = new Set([
  "",
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".yml",
  ".yaml",
  ".json",
  ".md",
  ".example",
])
const BARE_OLD_VAR = /(?<!NEXT_PUBLIC_)R2_PUBLIC_URL/

function walk(dir: string): string[] {
  const files: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) files.push(...walk(full))
    else if (entry.isFile()) files.push(full)
  }
  return files
}

describe("contrato da env pública do R2 (fusão para NEXT_PUBLIC_R2_PUBLIC_URL)", () => {
  it("nenhum arquivo de código/config usa o nome antigo R2_PUBLIC_URL sem o prefixo NEXT_PUBLIC_", () => {
    const files = [
      ...SCAN_DIRS.filter(existsSync).flatMap((dir) =>
        walk(join(process.cwd(), dir)),
      ),
      ...SCAN_FILES.filter(existsSync),
    ]
    const offenders = files
      .filter((file) => file !== SELF)
      .filter((file) => TEXT_EXTS.has(extname(file)))
      .filter((file) => BARE_OLD_VAR.test(readFileSync(file, "utf-8")))
    expect(offenders).toEqual([])
  })

  it(".env.example define exatamente uma linha NEXT_PUBLIC_R2_PUBLIC_URL= e nenhuma R2_PUBLIC_URL=", () => {
    const content = readFileSync(join(process.cwd(), ".env.example"), "utf-8")
    const lines = content.split(/\r?\n/)
    const newLines = lines.filter((line) =>
      line.startsWith("NEXT_PUBLIC_R2_PUBLIC_URL="),
    )
    const oldLines = lines.filter((line) => line.startsWith("R2_PUBLIC_URL="))
    expect(newLines).toHaveLength(1)
    expect(oldLines).toHaveLength(0)
  })

  it("rota DELETE do avatar usa @/lib/r2 + @/lib/r2-public-url (sem ler process.env direto)", () => {
    const route = readFileSync(
      join(
        process.cwd(),
        "src",
        "app",
        "api",
        "v1",
        "users",
        "me",
        "avatar",
        "route.ts",
      ),
      "utf-8",
    )
    expect(route).toContain(`from "@/lib/r2"`)
    expect(route).toContain(`from "@/lib/r2-public-url"`)
    expect(route).toContain("r2KeyFromPublicUrl")
    expect(route).not.toContain("process.env.NEXT_PUBLIC_R2_PUBLIC_URL")
  })
})
