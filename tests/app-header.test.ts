import { describe, it, expect, beforeAll } from "vitest"
import { readFileSync } from "fs"
import { join } from "path"
import { isAppNavActive } from "@/lib/navigation"

describe("isAppNavActive", () => {
  it("highlights Home only on /dashboard", () => {
    expect(isAppNavActive("/dashboard", "/dashboard")).toBe(true)
    expect(isAppNavActive("/tirar", "/dashboard")).toBe(false)
  })

  it("highlights Tirar only on /tirar", () => {
    expect(isAppNavActive("/tirar", "/tirar")).toBe(true)
    expect(isAppNavActive("/tiragem/abc", "/tirar")).toBe(false)
  })

  it("highlights Histórico for /minhas-tiragens and /tiragem detail", () => {
    expect(isAppNavActive("/minhas-tiragens", "/minhas-tiragens")).toBe(true)
    expect(isAppNavActive("/tiragem/abc", "/minhas-tiragens")).toBe(true)
    expect(isAppNavActive("/perfil", "/minhas-tiragens")).toBe(false)
  })

  it("highlights Meu Arcano for /meu-arcano and its detail", () => {
    expect(isAppNavActive("/meu-arcano", "/meu-arcano")).toBe(true)
    expect(isAppNavActive("/meu-arcano/22", "/meu-arcano")).toBe(true)
  })

  it("highlights Perfil for /perfil and subpages", () => {
    expect(isAppNavActive("/perfil", "/perfil")).toBe(true)
    expect(isAppNavActive("/perfil/editar", "/perfil")).toBe(true)
    expect(isAppNavActive("/perfil/firefox", "/perfil")).toBe(true)
    expect(isAppNavActive("/dashboard", "/perfil")).toBe(false)
  })
})

describe("App Header Navigation", () => {
  const headerPath = join(
    process.cwd(),
    "src",
    "components",
    "layout",
    "app-header.tsx",
  )
  let headerContent: string

  beforeAll(() => {
    headerContent = readFileSync(headerPath, "utf-8")
  })

  it("exists", () => {
    expect(headerContent).toBeTruthy()
  })

  it("is a client component", () => {
    expect(headerContent).toContain("use client")
  })

  it("has the brand link to /dashboard", () => {
    expect(headerContent).toContain("Arkana Ágora")
    expect(headerContent).toContain('href="/dashboard"')
  })

  it("has 5 navigation items", () => {
    expect(headerContent).toContain("Home")
    expect(headerContent).toContain("Tirar")
    expect(headerContent).toContain("Histórico")
    expect(headerContent).toContain("Meu Arcano")
    expect(headerContent).toContain("Perfil")
  })

  it("uses Lucide icons", () => {
    expect(headerContent).toContain("lucide-react")
  })

  it("is hidden on mobile and visible on md+", () => {
    expect(headerContent).toContain("hidden")
    expect(headerContent).toContain("md:block")
  })
})
