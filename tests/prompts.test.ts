import { describe, expect, it } from "vitest"

import {
  buildHoroscopePrompt,
  PROMPT_MOODS,
  WORD_RANGES,
  type HoroscopeType,
  type PromptPeriod,
} from "@/lib/horoscopes/prompts"

const VARS = {
  sign: "Áries",
  date: "2026-09-26",
  luckyNumber: 7,
  luckyColor: "turquesa",
  compatibility: "leao",
}

const TYPES: HoroscopeType[] = ["western", "chinese", "maya"]
const PERIODS: PromptPeriod[] = ["daily", "weekly", "monthly"]

describe("buildHoroscopePrompt (T034)", () => {
  it("substitui todas as variáveis obrigatórias", () => {
    const prompt = buildHoroscopePrompt("western", "daily", VARS)

    expect(prompt).toContain("- sign: Áries")
    expect(prompt).toContain("- date: 2026-09-26")
    expect(prompt).toContain("- luckyNumber: 7")
    expect(prompt).toContain("- luckyColor: turquesa")
    expect(prompt).toContain("- compatibility: leao")
    expect(prompt).not.toContain("{{")
  })

  it("cobre a matriz tipo × período (3 × 3) com contexto próprio", () => {
    for (const type of TYPES) {
      for (const period of PERIODS) {
        const prompt = buildHoroscopePrompt(type, period, VARS)
        expect(prompt).toContain(`Tipo: ${type}`)
        expect(prompt).toContain(`Período: ${period}`)
        expect(prompt).toContain("pt-BR")
      }
    }
    expect(buildHoroscopePrompt("maya", "daily", VARS)).toContain("Tzolkin")
    expect(buildHoroscopePrompt("chinese", "weekly", VARS)).toContain(
      "sexagenário",
    )
  })

  it("orienta a faixa de palavras do período (RF-HORO-001)", () => {
    expect(WORD_RANGES).toEqual({
      daily: { min: 150, max: 250 },
      weekly: { min: 300, max: 500 },
      monthly: { min: 500, max: 800 },
    })
    expect(buildHoroscopePrompt("western", "weekly", VARS)).toContain(
      "300 a 500 palavras",
    )
  })

  it("mood conhecido altera a orientação; default é sereno", () => {
    const sereno = buildHoroscopePrompt("western", "daily", VARS)
    const criativo = buildHoroscopePrompt("western", "daily", VARS, "criativo")
    expect(sereno).toContain("Mood: sereno")
    expect(criativo).toContain("Mood: criativo")
    expect(criativo).toContain("criativo e inspirado")
    expect(criativo).not.toBe(sereno)
    expect(PROMPT_MOODS).toHaveLength(12)
  })

  it("lança quando falta variável obrigatória", () => {
    expect(() =>
      buildHoroscopePrompt("western", "daily", { ...VARS, sign: " " }),
    ).toThrow(/sign/)
    expect(() =>
      buildHoroscopePrompt("western", "daily", { ...VARS, luckyColor: "" }),
    ).toThrow(/luckyColor/)
    expect(() =>
      buildHoroscopePrompt("western", "daily", {
        ...VARS,
        luckyNumber: Number.NaN,
      }),
    ).toThrow(/luckyNumber/)
  })

  it("inclui guardrails de conteúdo", () => {
    const prompt = buildHoroscopePrompt("western", "daily", VARS)
    expect(prompt).toContain("conselhos médicos")
    expect(prompt).toContain("JSON estruturado")
  })
})
