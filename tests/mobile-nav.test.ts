import { describe, it, expect, beforeAll } from "vitest"
import { readFileSync } from "fs"
import { join } from "path"

describe("Mobile Navigation", () => {
  const navPath = join(
    process.cwd(),
    "src",
    "components",
    "layout",
    "mobile-nav.tsx",
  )
  let navContent: string

  beforeAll(() => {
    navContent = readFileSync(navPath, "utf-8")
  })

  it("exists", () => {
    expect(navContent).toBeTruthy()
  })

  it("is a client component", () => {
    expect(navContent).toContain("use client")
  })

  it("has 4 navigation items", () => {
    // Home, Tirar, Histórico, Perfil
    expect(navContent).toContain("Home")
    expect(navContent).toContain("Tirar")
    expect(navContent).toContain("Histórico")
    expect(navContent).toContain("Perfil")
  })

  it("uses Lucide icons", () => {
    expect(navContent).toContain("lucide-react")
  })

  it("is fixed bottom on mobile", () => {
    expect(navContent).toContain("fixed")
    expect(navContent).toContain("bottom-0")
  })
})
