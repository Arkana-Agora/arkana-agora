import { describe, expect, it } from "vitest"

import { postPreview } from "@/lib/social/post-preview"

// Revisão V3: o truncamento do preview (slice 0..120) era reescrito em
// POST /social/posts e no fallback de polling (use-socket) — fonte única.
describe("postPreview (revisao V3)", () => {
  it("trunca em 120 caracteres", () => {
    expect(postPreview("a".repeat(130))).toBe("a".repeat(120))
  })

  it("string vazia vira null (paridade com o emit de POST /social/posts)", () => {
    expect(postPreview("")).toBeNull()
  })

  it("null/undefined vira null (paridade com o polling de posts", () => {
    expect(postPreview(null)).toBeNull()
    expect(postPreview(undefined)).toBeNull()
  })

  it("texto curto volta inteiro", () => {
    expect(postPreview("oi")).toBe("oi")
  })
})
