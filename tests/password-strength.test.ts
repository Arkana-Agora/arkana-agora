import { describe, it, expect } from "vitest"
import { getPasswordStrength } from "@/lib/password-strength"

describe("getPasswordStrength", () => {
  it("senha vazia: fraca com score 0", () => {
    expect(getPasswordStrength("")).toEqual({ score: 0, label: "fraca" })
  })

  it("apenas minusculas e sem tamanho: fraca (score 1)", () => {
    expect(getPasswordStrength("abc")).toEqual({ score: 1, label: "fraca" })
  })

  it("8+ caracteres apenas minusculas: fraca (score 2)", () => {
    expect(getPasswordStrength("password")).toEqual({
      score: 2,
      label: "fraca",
    })
  })

  it("mista sem todas as classes: media (score 3-4)", () => {
    expect(getPasswordStrength("Password")).toEqual({
      score: 3,
      label: "media",
    })
    expect(getPasswordStrength("Password1")).toEqual({
      score: 4,
      label: "media",
    })
  })

  it("todas as classes atendidas: forte (score 5)", () => {
    expect(getPasswordStrength("Password1!")).toEqual({
      score: 5,
      label: "forte",
    })
  })
})
