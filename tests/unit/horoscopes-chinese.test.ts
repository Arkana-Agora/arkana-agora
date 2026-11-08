import { describe, expect, it } from "vitest"

import {
  getChineseZodiac,
  chineseYearElement,
  getChineseNewYear,
  CHINESE_ANIMALS,
} from "@/lib/horoscopes/chinese"
import { CHINESE_COMBOS } from "@/lib/horoscopes/fallback"

describe("Chinese horoscope unit tests (T108)", () => {
  describe("chineseYearElement", () => {
    it("retorna madeira para anos com stem 0,1 (ex.: 1984=Rato Madeira)", () => {
      expect(chineseYearElement(1984)).toBe("madeira")
      expect(chineseYearElement(1985)).toBe("madeira")
    })

    it("retorna fogo para anos com stem 2,3 (ex.: 1986=Tigre Fogo)", () => {
      expect(chineseYearElement(1986)).toBe("fogo")
      expect(chineseYearElement(1987)).toBe("fogo")
    })

    it("retorna terra para anos com stem 4,5 (ex.: 1988=Dragão Terra)", () => {
      expect(chineseYearElement(1988)).toBe("terra")
      expect(chineseYearElement(1989)).toBe("terra")
    })

    it("retorna metal para anos com stem 6,7 (ex.: 1990=Cavalo Metal)", () => {
      expect(chineseYearElement(1990)).toBe("metal")
      expect(chineseYearElement(1991)).toBe("metal")
    })

    it("retorna água para anos com stem 8,9 (ex.: 1992=Macaco Água)", () => {
      expect(chineseYearElement(1992)).toBe("agua")
      expect(chineseYearElement(1993)).toBe("agua")
    })

    it("funciona para anos negativos (modulo correto)", () => {
      expect(chineseYearElement(1979)).toBe("terra")
    })
  })

  describe("getChineseNewYear", () => {
    it("retorna datas CNY conhecidas", () => {
      expect(getChineseNewYear(2024)).toEqual({ month: 2, day: 10 })
      expect(getChineseNewYear(2025)).toEqual({ month: 1, day: 29 })
      expect(getChineseNewYear(1990)).toEqual({ month: 1, day: 27 })
    })

    it("retorna fallback 04/02 para anos fora da tabela", () => {
      expect(getChineseNewYear(1900)).toEqual({ month: 2, day: 4 })
      expect(getChineseNewYear(2100)).toEqual({ month: 2, day: 4 })
    })
  })

  describe("getChineseZodiac", () => {
    it("retorna animal correto para datas após CNY", () => {
      // 1990-05-21 (após CNY 1990-01-27) → Cavalo
      const zodiac = getChineseZodiac(1990, 5, 21)
      expect(zodiac.animal).toBe("cavalo")
      expect(zodiac.year).toBe(1990)
    })

    it("retorna animal do ano anterior para datas antes do CNY", () => {
      // 1990-01-15 (antes de CNY 1990-01-27) → Serpente (1989)
      const zodiac = getChineseZodiac(1990, 1, 15)
      expect(zodiac.animal).toBe("serpente")
      expect(zodiac.year).toBe(1989)
    })

    it("retorna elemento correto do ano (1990 = Metal)", () => {
      const zodiac = getChineseZodiac(1990, 5, 21)
      expect(zodiac.element).toBe("metal")
    })

    it("1990-06-15 = Cavalo Metal (acceptance criterion RF-HORO-002)", () => {
      const zodiac = getChineseZodiac(1990, 6, 15)
      expect(zodiac.animal).toBe("cavalo")
      expect(zodiac.element).toBe("metal")
    })

    it("2024-02-15 (após CNY 2024-02-10) = Dragão Madeira", () => {
      const zodiac = getChineseZodiac(2024, 2, 15)
      expect(zodiac.animal).toBe("dragao")
      expect(zodiac.element).toBe("madeira")
    })

    it("2024-01-15 (antes de CNY 2024-02-10) = Coelho Água", () => {
      const zodiac = getChineseZodiac(2024, 1, 15)
      expect(zodiac.animal).toBe("coelho")
      expect(zodiac.element).toBe("agua")
    })

    it("ciclo completo de 12 anos retorna todos os animais", () => {
      const animals = [
        "rato",
        "boi",
        "tigre",
        "coelho",
        "dragao",
        "serpente",
        "cavalo",
        "cabra",
        "macaco",
        "galo",
        "cao",
        "porco",
      ]
      for (let i = 0; i < 12; i++) {
        const zodiac = getChineseZodiac(1984 + i, 6, 15) // meio do ano, pós-CNY
        expect(zodiac.animal).toBe(animals[i])
      }
    })

    it("ciclo de 60 anos: combinações animal+elemento são únicas", () => {
      const combos = new Set<string>()
      for (let year = 1984; year < 2044; year++) {
        const zodiac = getChineseZodiac(year, 6, 15)
        const key = `${zodiac.animal}:${zodiac.element}`
        expect(combos.has(key)).toBe(false)
        combos.add(key)
      }
      expect(combos.size).toBe(60)
    })

    it("boundary: dia exato do CNY conta como ano novo", () => {
      // CNY 2024 = 2024-02-10
      const before = getChineseZodiac(2024, 2, 9)
      const on = getChineseZodiac(2024, 2, 10)
      const after = getChineseZodiac(2024, 2, 11)

      expect(before.animal).toBe("coelho") // 2023
      expect(on.animal).toBe("dragao") // 2024
      expect(after.animal).toBe("dragao") // 2024
    })

    it("anos bissextos não afetam o cálculo", () => {
      // 2020 é bissexto, CNY 2020-01-25
      const zodiac = getChineseZodiac(2020, 2, 29)
      expect(zodiac.animal).toBe("rato")
    })
  })

  describe("CHINESE_ANIMALS catálogo", () => {
    it("tem 12 animais", () => {
      expect(CHINESE_ANIMALS.length).toBe(12)
    })

    it("cada animal tem id, name, characteristics, yinYang, fixedElement", () => {
      for (const animal of CHINESE_ANIMALS) {
        expect(animal.id).toBeDefined()
        expect(animal.name).toBeDefined()
        expect(Array.isArray(animal.characteristics)).toBe(true)
        expect(["yin", "yang"]).toContain(animal.yinYang)
        expect(["madeira", "fogo", "terra", "metal", "agua"]).toContain(
          animal.fixedElement,
        )
      }
    })

    it("cavalo tem fixedElement fogo", () => {
      const cavalo = CHINESE_ANIMALS.find((a) => a.id === "cavalo")
      expect(cavalo?.fixedElement).toBe("fogo")
    })
  })

  describe("CHINESE_COMBOS (60 combos)", () => {
    it("tem 60 entradas", () => {
      expect(CHINESE_COMBOS.length).toBe(60)
    })

    it("cada combo tem animalId e element", () => {
      for (const combo of CHINESE_COMBOS) {
        expect(combo.animalId).toBeDefined()
        expect(combo.element).toBeDefined()
      }
    })

    it("cobre todos os 12 animais × 5 elementos = 60 únicos", () => {
      const unique = new Set(
        CHINESE_COMBOS.map((c) => `${c.animalId}:${c.element}`),
      )
      expect(unique.size).toBe(60)
    })
  })
})
