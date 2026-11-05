import { describe, expect, it } from "vitest"
import { calculateZodiacSign } from "@/lib/calculations/zodiac"
import { getWesternSign, WESTERN_SIGNS } from "@/lib/horoscopes/western"
import {
  getCompatibility,
  type WesternCompatibility,
} from "@/lib/horoscopes/western-compatibility"

// T090/T099 — Horóscopo Ocidental: matriz de compatibilidade 12×12
// hardcoded em código (SC7 — única fonte de verdade, sem seed, sem DB) e
// bordas de getWesternSign (T021/T099).

describe("Western compatibility matrix (T090)", () => {
  it("retorna os quatro scores para um par conhecido (Áries × Leão)", () => {
    const compat = getCompatibility("aries", "leao")
    expect(compat).toEqual({ love: 88, friendship: 83, work: 85, overall: 85 })
  })

  it("é simétrica para todos os 144 pares ordenados (a×b === b×a)", () => {
    for (const a of WESTERN_SIGNS) {
      for (const b of WESTERN_SIGNS) {
        expect(getCompatibility(a.id, b.id)).toEqual(
          getCompatibility(b.id, a.id),
        )
      }
    }
  })

  it("cobre os 144 pares com inteiros 0–100 nos quatro campos", () => {
    let covered = 0
    for (const a of WESTERN_SIGNS) {
      for (const b of WESTERN_SIGNS) {
        const compat: WesternCompatibility = getCompatibility(a.id, b.id)
        for (const value of [
          compat.love,
          compat.friendship,
          compat.work,
          compat.overall,
        ]) {
          expect(Number.isInteger(value)).toBe(true)
          expect(value).toBeGreaterThanOrEqual(0)
          expect(value).toBeLessThanOrEqual(100)
        }
        covered += 1
      }
    }
    expect(covered).toBe(144)
  })

  it("overall = média arredondada de love/friendship/work", () => {
    for (const a of WESTERN_SIGNS) {
      for (const b of WESTERN_SIGNS) {
        const { love, friendship, work, overall } = getCompatibility(a.id, b.id)
        expect(overall).toBe(Math.round((love + friendship + work) / 3))
      }
    }
  })

  it("diagonal (mesmo signo) tem score definido", () => {
    expect(getCompatibility("aries", "aries")).toEqual({
      love: 78,
      friendship: 72,
      work: 74,
      overall: 75,
    })
  })

  it("lança erro para signo desconhecido", () => {
    expect(() => getCompatibility("aries", "invalido")).toThrow(/signo/i)
    expect(() => getCompatibility("invalido", "aries")).toThrow(/signo/i)
  })
})

describe("getWesternSign bordas (T099)", () => {
  const borders: Array<[day: number, month: number, id: string]> = [
    [21, 3, "aries"],
    [20, 3, "peixes"],
    [22, 3, "aries"],
    [19, 4, "aries"],
    [20, 4, "touro"],
    [21, 4, "touro"],
    [20, 5, "touro"],
    [21, 5, "gemeos"],
    [20, 6, "gemeos"],
    [21, 6, "cancer"],
    [22, 7, "cancer"],
    [23, 7, "leao"],
    [22, 8, "leao"],
    [23, 8, "virgem"],
    [22, 9, "virgem"],
    [23, 9, "libra"],
    [22, 10, "libra"],
    [23, 10, "escorpiao"],
    [21, 11, "escorpiao"],
    [22, 11, "sagitario"],
    [21, 12, "sagitario"],
    [22, 12, "capricornio"],
    [19, 1, "capricornio"],
    [20, 1, "aquario"],
    [21, 1, "aquario"],
    [18, 2, "aquario"],
    [19, 2, "peixes"],
    [20, 2, "peixes"],
    [1, 1, "capricornio"],
    [31, 12, "capricornio"],
  ]

  it("resolve cada borda de troca de signo (incluindo virada do ano)", () => {
    for (const [day, month, id] of borders) {
      expect(getWesternSign(day, month).id).toBe(id)
    }
  })

  it("cobre todos os dias de ano comum (2025) e bissexto (2024)", () => {
    for (const year of [2025, 2024]) {
      for (let month = 1; month <= 12; month++) {
        const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate()
        for (let day = 1; day <= daysInMonth; day++) {
          expect(() => getWesternSign(day, month)).not.toThrow()
        }
      }
    }
  })

  it("paridade total com calculateZodiacSign (Sprint 1) nos 731 dias de 2024-2025", () => {
    for (const year of [2024, 2025]) {
      for (let month = 1; month <= 12; month++) {
        const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate()
        for (let day = 1; day <= daysInMonth; day++) {
          expect(getWesternSign(day, month).name).toBe(
            calculateZodiacSign(new Date(Date.UTC(year, month - 1, day))),
          )
        }
      }
    }
  })

  it("catálogo: 12 signos únicos com campos obrigatórios preenchidos", () => {
    expect(WESTERN_SIGNS).toHaveLength(12)
    expect(new Set(WESTERN_SIGNS.map((sign) => sign.id)).size).toBe(12)
    for (const sign of WESTERN_SIGNS) {
      expect(sign.name).toBeTruthy()
      expect(sign.element).toBeTruthy()
      expect(sign.ruler).toBeTruthy()
      expect(sign.emoji).toBeTruthy()
      expect(sign.startDate).toMatch(/^\d{2}\/\d{2}$/)
      expect(sign.endDate).toMatch(/^\d{2}\/\d{2}$/)
      expect(sign.keywords.length).toBeGreaterThan(0)
    }
  })
})

describe("API shape da compatibilidade (T099)", () => {
  // O contrato dos endpoints (GET /horoscopes/western e ?targetSign) é
  // coberto pela integração T100 em tests/integration/horoscopes-western.
  it("expõe exatamente os quatro campos inteiros 0-100", () => {
    const compat = getCompatibility("touro", "libra")

    expect(Object.keys(compat).sort()).toEqual([
      "friendship",
      "love",
      "overall",
      "work",
    ])
    for (const value of Object.values(compat)) {
      expect(Number.isInteger(value)).toBe(true)
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThanOrEqual(100)
    }
  })
})
