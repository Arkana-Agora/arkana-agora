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

  it("has 5 navigation items", () => {
    // Home, Feed, Tirar, Histórico, Perfil
    expect(navContent).toContain("Home")
    expect(navContent).toContain("Feed")
    expect(navContent).toContain("Tirar")
    expect(navContent).toContain("Histórico")
    expect(navContent).toContain("Perfil")
  })

  it("inclui /feed no tab mobile (CHK009)", () => {
    expect(navContent).toContain('href: "/feed"')
  })

  it("usa isAppNavActive — subrotas mantêm o tab ativo (revisão UX)", () => {
    expect(navContent).toContain("isAppNavActive")
    expect(navContent).not.toContain("pathname === item.href")
  })

  it("uses Lucide icons", () => {
    expect(navContent).toContain("lucide-react")
  })

  it("is fixed bottom on mobile", () => {
    expect(navContent).toContain("fixed")
    expect(navContent).toContain("bottom-0")
  })

  it("lê o unreadCount do NotificationsProvider e expõe o badge mobile (revisão U)", () => {
    expect(navContent).toContain("useNotifications")
    expect(navContent).toContain("unread-notifications-badge-mobile")
  })
})

describe("MobileNav placement (revisão U)", () => {
  let providersContent: string
  let layoutContent: string

  beforeAll(() => {
    providersContent = readFileSync(
      join(process.cwd(), "src", "components", "providers.tsx"),
      "utf-8",
    )
    layoutContent = readFileSync(
      join(process.cwd(), "src", "app", "(app)", "layout.tsx"),
      "utf-8",
    )
  })

  it("sai do Providers global (páginas públicas não pollem notificações)", () => {
    expect(providersContent).not.toContain("MobileNav")
  })

  it("entra no layout do app DENTRO do NotificationsProvider (badge ativo)", () => {
    const providerOpen = layoutContent.indexOf("<NotificationsProvider>")
    const providerClose = layoutContent.indexOf("</NotificationsProvider>")
    const navAt = layoutContent.indexOf("<MobileNav")
    expect(providerOpen).toBeGreaterThanOrEqual(0)
    expect(providerClose).toBeGreaterThan(providerOpen)
    expect(navAt).toBeGreaterThan(providerOpen)
    expect(navAt).toBeLessThan(providerClose)
  })
})
