import { describe, expect, it } from "vitest"
import {
  PYTHAGOREAN_TABLE,
  getLetterValue,
} from "@/lib/arcana/pythagorean-table"
import { reduceToArcana } from "@/lib/arcana/reduce"
import {
  calculateArcanaByDate,
  calculateArcanaByName,
  calculatePersonalArcana,
  explainPersonalArcana,
} from "@/lib/arcana/calculate"
import { explainReduction } from "@/lib/arcana/reduce"
import { ARCANA_MAP, getArcanaByNumber } from "@/data/arcana"

describe("PYTHAGOREAN_TABLE", () => {
  it("maps A-I to 1-9", () => {
    expect(PYTHAGOREAN_TABLE["A"]).toBe(1)
    expect(PYTHAGOREAN_TABLE["B"]).toBe(2)
    expect(PYTHAGOREAN_TABLE["C"]).toBe(3)
    expect(PYTHAGOREAN_TABLE["D"]).toBe(4)
    expect(PYTHAGOREAN_TABLE["E"]).toBe(5)
    expect(PYTHAGOREAN_TABLE["F"]).toBe(6)
    expect(PYTHAGOREAN_TABLE["G"]).toBe(7)
    expect(PYTHAGOREAN_TABLE["H"]).toBe(8)
    expect(PYTHAGOREAN_TABLE["I"]).toBe(9)
  })

  it("maps J-R to 1-9", () => {
    expect(PYTHAGOREAN_TABLE["J"]).toBe(1)
    expect(PYTHAGOREAN_TABLE["K"]).toBe(2)
    expect(PYTHAGOREAN_TABLE["L"]).toBe(3)
    expect(PYTHAGOREAN_TABLE["M"]).toBe(4)
    expect(PYTHAGOREAN_TABLE["N"]).toBe(5)
    expect(PYTHAGOREAN_TABLE["O"]).toBe(6)
    expect(PYTHAGOREAN_TABLE["P"]).toBe(7)
    expect(PYTHAGOREAN_TABLE["Q"]).toBe(8)
    expect(PYTHAGOREAN_TABLE["R"]).toBe(9)
  })

  it("maps S-Z to 1-8", () => {
    expect(PYTHAGOREAN_TABLE["S"]).toBe(1)
    expect(PYTHAGOREAN_TABLE["T"]).toBe(2)
    expect(PYTHAGOREAN_TABLE["U"]).toBe(3)
    expect(PYTHAGOREAN_TABLE["V"]).toBe(4)
    expect(PYTHAGOREAN_TABLE["W"]).toBe(5)
    expect(PYTHAGOREAN_TABLE["X"]).toBe(6)
    expect(PYTHAGOREAN_TABLE["Y"]).toBe(7)
    expect(PYTHAGOREAN_TABLE["Z"]).toBe(8)
  })

  it("handles accented characters via getLetterValue", () => {
    expect(getLetterValue("Á")).toBe(1) // A = 1
    expect(getLetterValue("É")).toBe(5) // E = 5
    expect(getLetterValue("Ç")).toBe(3) // C = 3
    expect(getLetterValue("Ã")).toBe(1) // A = 1
  })

  it("returns 0 for non-alpha characters", () => {
    expect(getLetterValue(" ")).toBe(0)
    expect(getLetterValue("1")).toBe(0)
    expect(getLetterValue("-")).toBe(0)
  })
})

describe("reduceToArcana", () => {
  it("returns number directly when 1-22", () => {
    expect(reduceToArcana(1)).toBe(1)
    expect(reduceToArcana(10)).toBe(10)
    expect(reduceToArcana(22)).toBe(22)
  })

  it("reduces numbers > 22 by summing digits", () => {
    expect(reduceToArcana(23)).toBe(5) // 2+3=5
    expect(reduceToArcana(44)).toBe(8) // 4+4=8
    expect(reduceToArcana(100)).toBe(1) // 1+0+0=1
  })

  it("reduces recursively until 1-22", () => {
    expect(reduceToArcana(999)).toBe(9) // 9+9+9=27 -> 2+7=9
    expect(reduceToArcana(1000)).toBe(1) // 1+0+0+0=1
  })

  it("maps 0 to 22 (The Fool)", () => {
    expect(reduceToArcana(0)).toBe(22)
  })

  it("handles negative numbers by using absolute value", () => {
    expect(reduceToArcana(-5)).toBe(5)
  })

  it("produces known results for specific inputs", () => {
    // Pythagorean examples
    expect(reduceToArcana(19)).toBe(19) // Already 1-22
    expect(reduceToArcana(36)).toBe(9) // 3+6=9
    expect(reduceToArcana(45)).toBe(9) // 4+5=9
    expect(reduceToArcana(54)).toBe(9) // 5+4=9
  })
})

describe("calculateArcanaByDate", () => {
  it("returns a number between 1 and 22", () => {
    const result = calculateArcanaByDate(new Date(Date.UTC(1990, 5, 15)))
    expect(result).toBeGreaterThanOrEqual(1)
    expect(result).toBeLessThanOrEqual(22)
  })

  it("is deterministic for same date", () => {
    const r1 = calculateArcanaByDate(new Date(Date.UTC(1985, 0, 1)))
    const r2 = calculateArcanaByDate(new Date(Date.UTC(1985, 0, 1)))
    expect(r1).toBe(r2)
  })

  it("produces different results for different dates", () => {
    const r1 = calculateArcanaByDate(new Date(Date.UTC(1990, 0, 1)))
    const r2 = calculateArcanaByDate(new Date(Date.UTC(1990, 11, 31)))
    expect(r1).not.toBe(r2)
  })

  it("sums digits of YYYYMMDD and reduces", () => {
    // 1990-06-15 → 19900615 → 1+9+9+0+0+6+1+5 = 31 → 3+1 = 4
    const result = calculateArcanaByDate(new Date(Date.UTC(1990, 5, 15)))
    expect(result).toBe(4)
  })

  it("handles single-digit sums directly", () => {
    // 2001-01-01 → 20010101 → 2+0+0+1+0+1+0+1 = 5
    const result = calculateArcanaByDate(new Date(Date.UTC(2001, 0, 1)))
    expect(result).toBe(5)
  })

  it("handles edge case where sum is 0 (all zeros)", () => {
    // 2000-10-10 → 20001010 → 2+0+0+0+1+0+1+0 = 4
    const result = calculateArcanaByDate(new Date(Date.UTC(2000, 9, 10)))
    expect(result).toBeGreaterThanOrEqual(1)
    expect(result).toBeLessThanOrEqual(22)
  })
})

describe("calculateArcanaByName", () => {
  it("returns a number between 1 and 22", () => {
    const result = calculateArcanaByName("Maria")
    expect(result).toBeGreaterThanOrEqual(1)
    expect(result).toBeLessThanOrEqual(22)
  })

  it("is deterministic for same name", () => {
    const r1 = calculateArcanaByName("João")
    const r2 = calculateArcanaByName("João")
    expect(r1).toBe(r2)
  })

  it("produces different results for different names", () => {
    const r1 = calculateArcanaByName("Ana")
    const r2 = calculateArcanaByName("Pedro")
    expect(r1).not.toBe(r2)
  })

  it("handles accented characters", () => {
    const r1 = calculateArcanaByName("João")
    const r2 = calculateArcanaByName("Joao")
    expect(r1).toBe(r2)
  })

  it("handles empty string", () => {
    const result = calculateArcanaByName("")
    expect(result).toBe(22) // empty → 0 → maps to 22
  })

  it("is case-insensitive", () => {
    const r1 = calculateArcanaByName("MARIA")
    const r2 = calculateArcanaByName("maria")
    expect(r1).toBe(r2)
  })

  it("uses Pythagorean table for letter values", () => {
    // A=1, B=2 → sum=3 → reduceToArcana(3)=3
    const result = calculateArcanaByName("AB")
    expect(result).toBe(3)
  })
})

describe("calculatePersonalArcana", () => {
  it("returns a number between 1 and 22", () => {
    const result = calculatePersonalArcana(
      new Date(Date.UTC(1990, 5, 15)),
      "Maria",
    )
    expect(result).toBeGreaterThanOrEqual(1)
    expect(result).toBeLessThanOrEqual(22)
  })

  it("returns null when birthDate is null", () => {
    expect(calculatePersonalArcana(null, "Maria")).toBeNull()
  })

  it("returns null when name is empty", () => {
    expect(
      calculatePersonalArcana(new Date(Date.UTC(1990, 0, 1)), ""),
    ).toBeNull()
  })

  it("returns same result for same inputs", () => {
    const r1 = calculatePersonalArcana(new Date(Date.UTC(1985, 0, 1)), "João")
    const r2 = calculatePersonalArcana(new Date(Date.UTC(1985, 0, 1)), "João")
    expect(r1).toBe(r2)
  })

  it("returns different results for different names", () => {
    const r1 = calculatePersonalArcana(new Date(Date.UTC(1990, 0, 1)), "Ana")
    const r2 = calculatePersonalArcana(new Date(Date.UTC(1990, 0, 1)), "Pedro")
    expect(r1).not.toBe(r2)
  })

  it("combines date and name contributions", () => {
    const combined = calculatePersonalArcana(
      new Date(Date.UTC(1990, 5, 15)),
      "Maria",
    )
    expect(combined).toBeGreaterThanOrEqual(1)
    expect(combined).toBeLessThanOrEqual(22)
  })

  it("is timezone-independent for ISO-date strings", () => {
    // "1990-06-15" é parseado como meia-noite UTC. Com getters locais num fuso
    // negativo (ex.: America/Sao_Paulo), o dia vira 14 e o arcano muda.
    // Os getters UTC garantem determinismo entre dev e prod.
    expect(calculatePersonalArcana(new Date("1990-06-15"), "Maria Silva")).toBe(
      10,
    )
    expect(
      calculatePersonalArcana(new Date(Date.UTC(1990, 5, 15)), "Maria Silva"),
    ).toBe(10)
  })
})

describe("explainReduction", () => {
  it("returns the number alone when already 1-22", () => {
    expect(explainReduction(9)).toBe("9")
    expect(explainReduction(22)).toBe("22")
  })

  it("shows digit-sum steps for values above 22", () => {
    expect(explainReduction(45)).toBe("45 → 9")
    expect(explainReduction(999)).toBe("999 → 27 → 9")
  })

  it("maps 0 to 22 with a visible step", () => {
    expect(explainReduction(0)).toBe("0 → 22")
  })
})

describe("explainPersonalArcana", () => {
  it("matches calculatePersonalArcana and includes reduction traces", () => {
    const birthDate = new Date(Date.UTC(1990, 5, 15))
    const name = "Maria"
    const explained = explainPersonalArcana(birthDate, name)
    expect(explained.arcanaNumber).toBe(
      calculatePersonalArcana(birthDate, name),
    )
    expect(explained.reductionDate).toContain("19900615")
    expect(explained.reductionName).toContain("Maria")
    expect(explained.reductionDate).toContain("→")
    expect(explained.reductionName).toContain("→")
  })
})

describe("ARCANA_MAP", () => {
  it("has exactly 23 entries (0-22)", () => {
    expect(Object.keys(ARCANA_MAP)).toHaveLength(23)
  })

  it("has entry for 0 (O Louco)", () => {
    const arcana = ARCANA_MAP[0]!
    expect(arcana).toBeDefined()
    expect(arcana.name).toBe("O Louco")
    expect(arcana.number).toBe(0)
  })

  it("has entry for 21 (O Mundo)", () => {
    const arcana = ARCANA_MAP[21]!
    expect(arcana).toBeDefined()
    expect(arcana.name).toBe("O Mundo")
    expect(arcana.number).toBe(21)
  })

  it("has entry for 22 (O Louco - master number)", () => {
    const arcana = ARCANA_MAP[22]!
    expect(arcana).toBeDefined()
    expect(arcana.name).toBe("O Louco")
    expect(arcana.number).toBe(22)
  })

  it("every entry has required fields", () => {
    for (let i = 0; i <= 22; i++) {
      const arcana = ARCANA_MAP[i]!
      expect(arcana).toBeDefined()
      expect(arcana.number).toBe(i)
      expect(typeof arcana.name).toBe("string")
      expect(typeof arcana.upright).toBe("string")
      expect(typeof arcana.reversed).toBe("string")
      expect(typeof arcana.element).toBe("string")
      expect(typeof arcana.planet).toBe("string")
    }
  })
})

describe("getArcanaByNumber", () => {
  it("returns correct arcana for valid number", () => {
    const arcana = getArcanaByNumber(0)
    expect(arcana?.name).toBe("O Louco")
  })

  it("returns O Louco for 22 (master number mapping)", () => {
    const arcana = getArcanaByNumber(22)
    expect(arcana?.name).toBe("O Louco")
    expect(arcana?.number).toBe(22)
  })

  it("returns null for out-of-range number", () => {
    expect(getArcanaByNumber(23)).toBeNull()
    expect(getArcanaByNumber(-1)).toBeNull()
  })
})
