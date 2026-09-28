import { describe, expect, it } from "vitest"
import { calculateZodiacSign } from "@/lib/calculations/zodiac"
import { getWesternSign, WESTERN_SIGNS } from "@/lib/horoscopes/western"

describe("calculateZodiacSign", () => {
  const signs = [
    { date: new Date(Date.UTC(2000, 0, 15)), expected: "Capricórnio" },
    { date: new Date(Date.UTC(2000, 1, 15)), expected: "Aquário" },
    { date: new Date(Date.UTC(2000, 2, 15)), expected: "Peixes" },
    { date: new Date(Date.UTC(2000, 3, 15)), expected: "Áries" },
    { date: new Date(Date.UTC(2000, 4, 15)), expected: "Touro" },
    { date: new Date(Date.UTC(2000, 5, 15)), expected: "Gêmeos" },
    { date: new Date(Date.UTC(2000, 6, 15)), expected: "Câncer" },
    { date: new Date(Date.UTC(2000, 7, 15)), expected: "Leão" },
    { date: new Date(Date.UTC(2000, 8, 15)), expected: "Virgem" },
    { date: new Date(Date.UTC(2000, 9, 15)), expected: "Libra" },
    { date: new Date(Date.UTC(2000, 10, 15)), expected: "Escorpião" },
    { date: new Date(Date.UTC(2000, 11, 15)), expected: "Sagitário" },
  ]

  it.each(signs)("returns $expected for $date", ({ date, expected }) => {
    expect(calculateZodiacSign(date)).toBe(expected)
  })

  it("returns null for null input", () => {
    expect(calculateZodiacSign(null)).toBeNull()
  })

  it("returns null for undefined input", () => {
    expect(calculateZodiacSign(undefined as unknown as Date)).toBeNull()
  })

  it("handles boundary: Jan 20 (Aquário starts)", () => {
    expect(calculateZodiacSign(new Date(Date.UTC(2000, 0, 20)))).toBe("Aquário")
  })

  it("handles boundary: Jan 19 (Capricórnio ends)", () => {
    expect(calculateZodiacSign(new Date(Date.UTC(2000, 0, 19)))).toBe(
      "Capricórnio",
    )
  })

  it("handles boundary: Mar 21 (Áries starts)", () => {
    expect(calculateZodiacSign(new Date(Date.UTC(2000, 2, 21)))).toBe("Áries")
  })

  it("handles boundary: Mar 20 (Peixes ends)", () => {
    expect(calculateZodiacSign(new Date(Date.UTC(2000, 2, 20)))).toBe("Peixes")
  })

  it("handles leap year: Feb 29", () => {
    expect(calculateZodiacSign(new Date(Date.UTC(2000, 1, 29)))).toBe("Peixes")
  })
})

describe("paridade WESTERN_SIGNS × calculateZodiacSign (lint #10)", () => {
  it("os 366 dias do ano batem entre horoscopes/western e calculations/zodiac", () => {
    const year = 2028 // bissexto: cobre 29/02
    for (let month = 1; month <= 12; month++) {
      const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate()
      for (let day = 1; day <= daysInMonth; day++) {
        const western = getWesternSign(day, month)
        const zodiac = calculateZodiacSign(
          new Date(Date.UTC(year, month - 1, day)),
        )
        expect(
          zodiac,
          `divergência em ${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}`,
        ).toBe(western.name)
      }
    }
  })

  it("mesmas 12 datas de início em ambos os catálogos", () => {
    expect(WESTERN_SIGNS).toHaveLength(12)
    const startDates = WESTERN_SIGNS.map(
      (s) =>
        `${String(s.startMonth).padStart(2, "0")}-${String(s.startDay).padStart(2, "0")}`,
    ).sort()
    // Catálogo canônico: datas de início idênticas às do Sprint 1 (zodiac.ts).
    expect(startDates).toEqual([
      "01-20",
      "02-19",
      "03-21",
      "04-20",
      "05-21",
      "06-21",
      "07-23",
      "08-23",
      "09-23",
      "10-23",
      "11-22",
      "12-22",
    ])
  })
})
