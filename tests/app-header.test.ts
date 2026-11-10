import { describe, it, expect, beforeAll } from "vitest"
import { readFileSync } from "fs"
import { join } from "path"
import { isAppNavActive } from "@/lib/navigation"

describe("isAppNavActive", () => {
  it("highlights Feed only on /feed", () => {
    expect(isAppNavActive("/feed", "/feed")).toBe(true)
    expect(isAppNavActive("/feed/some-post", "/feed")).toBe(true)
    expect(isAppNavActive("/explorar", "/feed")).toBe(false)
  })

  it("highlights Explorar only on /explorar and /busca", () => {
    expect(isAppNavActive("/explorar", "/explorar")).toBe(true)
    expect(isAppNavActive("/busca", "/explorar")).toBe(true)
    expect(isAppNavActive("/busca?q=test", "/explorar")).toBe(true)
    expect(isAppNavActive("/feed", "/explorar")).toBe(false)
  })

  it("highlights Notificações only on /notificacoes", () => {
    expect(isAppNavActive("/notificacoes", "/notificacoes")).toBe(true)
    expect(isAppNavActive("/feed", "/notificacoes")).toBe(false)
  })

  it("highlights Presentes for /presentes and subpages", () => {
    expect(isAppNavActive("/presentes", "/presentes")).toBe(true)
    expect(isAppNavActive("/presentes/loja", "/presentes")).toBe(true)
    expect(isAppNavActive("/feed", "/presentes")).toBe(false)
  })

  it("highlights Perfil for /perfil and subpages", () => {
    expect(isAppNavActive("/perfil", "/perfil")).toBe(true)
    expect(isAppNavActive("/perfil/editar", "/perfil")).toBe(true)
    expect(isAppNavActive("/perfil/firefox", "/perfil")).toBe(true)
    expect(isAppNavActive("/feed", "/perfil")).toBe(false)
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

  it("has the brand link to /feed", () => {
    expect(headerContent).toContain("Arkana Ágora")
    expect(headerContent).toContain('href="/feed"')
  })

  it("has 5 navigation items", () => {
    expect(headerContent).toContain("Feed")
    expect(headerContent).toContain("Explorar")
    expect(headerContent).toContain("Notificações")
    expect(headerContent).toContain("Presentes")
    expect(headerContent).toContain("Perfil")
  })

  it("inclui /feed nos itens (CHK009 — rota alcançável pelo login)", () => {
    expect(headerContent).toContain('href: "/feed"')
  })

  it("inclui /explorar nos itens", () => {
    expect(headerContent).toContain('href: "/explorar"')
  })

  it("inclui /notificacoes nos itens", () => {
    expect(headerContent).toContain('href: "/notificacoes"')
  })

  it("inclui /presentes nos itens", () => {
    expect(headerContent).toContain('href: "/presentes"')
  })

  it("inclui /perfil nos itens", () => {
    expect(headerContent).toContain('href: "/perfil"')
  })

  it("uses Lucide icons", () => {
    expect(headerContent).toContain("lucide-react")
  })

  it("is hidden on mobile and visible on md+", () => {
    expect(headerContent).toContain("hidden")
    expect(headerContent).toContain("md:block")
  })
})
