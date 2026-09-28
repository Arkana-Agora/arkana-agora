import { describe, expect, it } from "vitest"

import {
  countWords,
  PERIOD_WORD_RANGES,
  validateHoroscopeContent,
} from "@/lib/horoscopes/validation"

function buildContent(overrides: Record<string, unknown> = {}) {
  return {
    general: "palavra ".repeat(200).trim(),
    love: "amor do dia",
    career: "carreira do dia",
    health: "saúde do dia",
    luckyNumber: 7,
    luckyColor: "azul",
    mood: "sereno",
    compatibility: "leo",
    date: "2026-09-26",
    fallback: false,
    ...overrides,
  }
}

describe("PERIOD_WORD_RANGES (T035/RF-HORO-001)", () => {
  it("define as faixas do spec", () => {
    expect(PERIOD_WORD_RANGES.daily).toEqual({ min: 150, max: 250 })
    expect(PERIOD_WORD_RANGES.weekly).toEqual({ min: 300, max: 500 })
    expect(PERIOD_WORD_RANGES.monthly).toEqual({ min: 500, max: 800 })
  })
})

describe("countWords (T035)", () => {
  it("conta palavras por espaço e ignora espaços das bordas", () => {
    expect(countWords("  uma  dois três ")).toBe(3)
    expect(countWords("")).toBe(0)
    expect(countWords("   ")).toBe(0)
  })

  it("conta palavras com markdown como texto (markdown permitido)", () => {
    expect(countWords("**negrito** e _itálico_")).toBe(3)
  })
})

describe("validateHoroscopeContent (T035)", () => {
  it("aceita conteúdo diário dentro da faixa 150-250", () => {
    const result = validateHoroscopeContent(buildContent(), "daily")
    expect(result.ok).toBe(true)
    expect(result.wordCount).toBe(200)
    expect(result.issues).toEqual([])
  })

  it("rejeita diário fora da faixa", () => {
    const result = validateHoroscopeContent(
      buildContent({ general: "curto demais" }),
      "daily",
    )
    expect(result.ok).toBe(false)
    expect(result.issues[0]).toContain("palavras (esperado 150-250")
  })

  it("aplica a faixa correta por período", () => {
    const weekly = buildContent({ general: "palavra ".repeat(350).trim() })
    expect(validateHoroscopeContent(weekly, "weekly").ok).toBe(true)
    expect(validateHoroscopeContent(weekly, "monthly").ok).toBe(false)

    const monthly = buildContent({ general: "palavra ".repeat(600).trim() })
    expect(validateHoroscopeContent(monthly, "monthly").ok).toBe(true)
    expect(validateHoroscopeContent(monthly, "weekly").ok).toBe(false)
  })

  it("rejeita shape inválido com issues por campo", () => {
    const result = validateHoroscopeContent(
      buildContent({ luckyNumber: 0, date: "26/09/2026" }),
      "daily",
    )
    expect(result.ok).toBe(false)
    expect(result.wordCount).toBe(0)
    expect(result.issues.some((issue) => issue.startsWith("luckyNumber"))).toBe(
      true,
    )
    expect(result.issues.some((issue) => issue.startsWith("date"))).toBe(true)
  })

  it("rejeita conteúdo não-objeto", () => {
    expect(validateHoroscopeContent(null, "daily").ok).toBe(false)
    expect(validateHoroscopeContent("texto", "daily").ok).toBe(false)
  })
})
