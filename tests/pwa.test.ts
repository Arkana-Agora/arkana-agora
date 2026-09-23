import { describe, it, expect, beforeAll } from "vitest"
import { readFileSync } from "fs"
import { join } from "path"

describe("PWA manifest.json", () => {
  const manifestPath = join(process.cwd(), "public", "manifest.json")
  let manifest: {
    name: string
    short_name: string
    display: string
    start_url: string
    theme_color: string
    background_color: string
    icons: Array<{ src: string; sizes: string; type: string }>
  }

  beforeAll(() => {
    const content = readFileSync(manifestPath, "utf-8")
    manifest = JSON.parse(content)
  })

  it("exists and is valid JSON", () => {
    expect(manifest).toBeDefined()
  })

  it("has correct name", () => {
    expect(manifest.name).toBe("Arkana Agora")
  })

  it("has short_name", () => {
    expect(manifest.short_name).toBe("Arkana")
  })

  it("has display mode standalone", () => {
    expect(manifest.display).toBe("standalone")
  })

  it("has start_url", () => {
    expect(manifest.start_url).toBe("/")
  })

  it("has theme_color", () => {
    expect(typeof manifest.theme_color).toBe("string")
  })

  it("has background_color", () => {
    expect(typeof manifest.background_color).toBe("string")
  })

  it("has icons array with valid entries", () => {
    expect(Array.isArray(manifest.icons)).toBe(true)
    expect(manifest.icons.length).toBeGreaterThanOrEqual(1)
    // Modern PWA: single SVG with "any" size is valid
    const icons = manifest.icons as Array<{ sizes: string }>
    const hasAnySize = icons.some((icon) => icon.sizes === "any")
    expect(hasAnySize).toBe(true)
  })

  it("icons have required properties", () => {
    const icons = manifest.icons as Array<{
      src: string
      sizes: string
      type: string
    }>
    for (const icon of icons) {
      expect(icon.src).toBeTruthy()
      expect(icon.sizes).toBeTruthy()
      expect(icon.type).toBeTruthy()
    }
  })
})

describe("PWA Service Worker", () => {
  const swPath = join(process.cwd(), "public", "sw.js")
  let swContent: string

  beforeAll(() => {
    swContent = readFileSync(swPath, "utf-8")
  })

  it("exists", () => {
    expect(swContent).toBeTruthy()
  })

  it("registers install event", () => {
    expect(swContent).toContain("install")
  })

  it("registers activate event", () => {
    expect(swContent).toContain("activate")
  })

  it("registers fetch event for caching", () => {
    expect(swContent).toContain("fetch")
  })

  it("caches static assets", () => {
    expect(swContent).toContain("cache")
  })

  it("has offline fallback", () => {
    expect(swContent).toContain("offline")
  })
})

describe("PWA Offline Page", () => {
  const offlinePath = join(process.cwd(), "src", "app", "offline", "page.tsx")
  let offlineContent: string

  beforeAll(() => {
    offlineContent = readFileSync(offlinePath, "utf-8")
  })

  it("exists", () => {
    expect(offlineContent).toBeTruthy()
  })

  it("is a client component", () => {
    expect(offlineContent).toContain("use client")
  })

  it("shows friendly offline message", () => {
    expect(offlineContent).toContain("offline")
  })

  it("has retry button", () => {
    expect(offlineContent).toContain("Tentar")
  })
})
