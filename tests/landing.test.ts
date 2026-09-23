import { describe, it, expect, beforeAll } from "vitest"
import { readFileSync } from "fs"
import { join } from "path"

describe("Landing Page", () => {
  const landingPath = join(process.cwd(), "src", "app", "page.tsx")
  const heroPath = join(
    process.cwd(),
    "src",
    "components",
    "landing",
    "hero.tsx",
  )
  const trustPath = join(
    process.cwd(),
    "src",
    "components",
    "landing",
    "trust-indicators.tsx",
  )
  const featuresPath = join(
    process.cwd(),
    "src",
    "components",
    "landing",
    "features.tsx",
  )
  const pricingPath = join(
    process.cwd(),
    "src",
    "components",
    "landing",
    "pricing.tsx",
  )
  const faqPath = join(process.cwd(), "src", "components", "landing", "faq.tsx")
  const ctaPath = join(process.cwd(), "src", "components", "landing", "cta.tsx")
  const footerPath = join(
    process.cwd(),
    "src",
    "components",
    "landing",
    "footer.tsx",
  )

  let landingContent: string
  let heroContent: string
  let trustContent: string
  let featuresContent: string
  let pricingContent: string
  let faqContent: string
  let ctaContent: string
  let footerContent: string

  beforeAll(() => {
    landingContent = readFileSync(landingPath, "utf-8")
    heroContent = readFileSync(heroPath, "utf-8")
    trustContent = readFileSync(trustPath, "utf-8")
    featuresContent = readFileSync(featuresPath, "utf-8")
    pricingContent = readFileSync(pricingPath, "utf-8")
    faqContent = readFileSync(faqPath, "utf-8")
    ctaContent = readFileSync(ctaPath, "utf-8")
    footerContent = readFileSync(footerPath, "utf-8")
  })

  it("exists", () => {
    expect(landingContent).toBeTruthy()
  })

  it("is a server component (no 'use client')", () => {
    expect(landingContent).not.toContain("use client")
  })

  it("has Hero section", () => {
    expect(landingContent).toContain("HeroSection")
    expect(heroContent).toContain("Hero")
  })

  it("has Features section", () => {
    expect(landingContent).toContain("FeaturesSection")
    expect(featuresContent).toContain("Features")
  })

  it("has Pricing section", () => {
    expect(landingContent).toContain("PricingSection")
    expect(pricingContent).toContain("Pricing")
  })

  it("has FAQ section", () => {
    expect(landingContent).toContain("FAQSection")
    expect(faqContent).toContain("FAQ")
  })

  it("has Footer", () => {
    expect(landingContent).toContain("Footer")
    expect(footerContent).toContain("Footer")
  })

  it("has CTA buttons", () => {
    expect(landingContent).toContain("CTASection")
    expect(ctaContent).toContain("CTA")
  })

  it("mentions Free plan", () => {
    expect(pricingContent).toContain("Free")
  })

  it("has 'Em breve' for upcoming features", () => {
    expect(pricingContent).toContain("Mais recursos chegando em breve")
  })

  it("has honest trust indicators", () => {
    expect(trustContent).toContain("Grátis")
    expect(trustContent).toContain("LGPD")
    expect(trustContent).toContain("PWA")
    expect(trustContent).toContain("IA")
  })

  it("has valid footer links only", () => {
    expect(footerContent).toContain("/tirar")
    expect(footerContent).toContain("/meu-arcano")
    expect(footerContent).toContain("/minhas-tiragens")
    expect(footerContent).toContain("/perfil")
    expect(footerContent).toContain("/perfil/privacidade")
    // Non-existent pages should not be linked
    expect(footerContent).not.toContain("/sobre")
    expect(footerContent).not.toContain("/blog")
    expect(footerContent).not.toContain("/carreiras")
    expect(footerContent).not.toContain("/imprensa")
    expect(footerContent).not.toContain("/termos")
    expect(footerContent).not.toContain("/cookies")
  })
})
