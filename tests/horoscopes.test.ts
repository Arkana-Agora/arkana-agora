import { describe, expect, it } from "vitest"
import { WESTERN_SIGNS, getWesternSign } from "@/lib/horoscopes/western"
import {
  CHINESE_ANIMALS,
  CHINESE_NEW_YEAR_DATES,
  getChineseZodiac,
} from "@/lib/horoscopes/chinese"
import {
  MAYAN_SEALS,
  MAYAN_TONES,
  getMayanOndaEncantada,
  gregorianToMayanLongCount,
  kinToSealTone,
} from "@/lib/horoscopes/maya"
import { calculateKinMaya } from "@/lib/calculations/kin-maya"

// Copia independente da fórmula AGM (JDN) para validação da decomposição
// da Contagem Longa sem reutilizar o código de produção.
function jdnTest(year: number, month: number, day: number): number {
  const a = Math.floor((14 - month) / 12)
  const y = year + 4800 - a
  const m = month + 12 * a - 3
  return (
    day +
    Math.floor((153 * m + 2) / 5) +
    365 * y +
    Math.floor(y / 4) -
    Math.floor(y / 100) +
    Math.floor(y / 400) -
    32045
  )
}

describe("Western (T021)", () => {
  const midSignCases = [
    { day: 15, month: 1, id: "capricornio" },
    { day: 15, month: 2, id: "aquario" },
    { day: 15, month: 3, id: "peixes" },
    { day: 15, month: 4, id: "aries" },
    { day: 15, month: 5, id: "touro" },
    { day: 15, month: 6, id: "gemeos" },
    { day: 15, month: 7, id: "cancer" },
    { day: 15, month: 8, id: "leao" },
    { day: 15, month: 9, id: "virgem" },
    { day: 15, month: 10, id: "libra" },
    { day: 15, month: 11, id: "escorpiao" },
    { day: 15, month: 12, id: "sagitario" },
  ]

  it.each(midSignCases)("$day/$month → $id", ({ day, month, id }) => {
    expect(getWesternSign(day, month).id).toBe(id)
  })

  it("cusp Peixes→Áries (20/03 e 21/03)", () => {
    expect(WESTERN_SIGNS).toHaveLength(12)
    expect(getWesternSign(20, 3).id).toBe("peixes")
    expect(getWesternSign(21, 3).id).toBe("aries")
  })

  it("cusp Câncer→Leão (22/07 e 23/07)", () => {
    expect(getWesternSign(22, 7).id).toBe("cancer")
    expect(getWesternSign(23, 7).id).toBe("leao")
  })

  it("cusp Capricórnio→Aquário (19/01 e 20/01)", () => {
    expect(getWesternSign(19, 1).id).toBe("capricornio")
    expect(getWesternSign(20, 1).id).toBe("aquario")
  })

  it("cusp Sagitário→Capricórnio (21/12 e 22/12)", () => {
    expect(getWesternSign(21, 12).id).toBe("sagitario")
    expect(getWesternSign(22, 12).id).toBe("capricornio")
  })
})

// Tabela congelada 1976-2035: animal (âncora 1984=Rato) e elemento do ano
// (ciclo de 10 stems: pares Madeira/Fogo/Terra/Metal/Água). Cruzada com
// RF-HORO-002 (1984-2031) e CA-HORO-001 (1990 = Cavalo de Metal).
const CHINESE_CASES: { year: number; animal: string; element: string }[] = [
  { year: 1976, animal: "dragao", element: "fogo" },
  { year: 1977, animal: "serpente", element: "fogo" },
  { year: 1978, animal: "cavalo", element: "terra" },
  { year: 1979, animal: "cabra", element: "terra" },
  { year: 1980, animal: "macaco", element: "metal" },
  { year: 1981, animal: "galo", element: "metal" },
  { year: 1982, animal: "cao", element: "agua" },
  { year: 1983, animal: "porco", element: "agua" },
  { year: 1984, animal: "rato", element: "madeira" },
  { year: 1985, animal: "boi", element: "madeira" },
  { year: 1986, animal: "tigre", element: "fogo" },
  { year: 1987, animal: "coelho", element: "fogo" },
  { year: 1988, animal: "dragao", element: "terra" },
  { year: 1989, animal: "serpente", element: "terra" },
  { year: 1990, animal: "cavalo", element: "metal" },
  { year: 1991, animal: "cabra", element: "metal" },
  { year: 1992, animal: "macaco", element: "agua" },
  { year: 1993, animal: "galo", element: "agua" },
  { year: 1994, animal: "cao", element: "madeira" },
  { year: 1995, animal: "porco", element: "madeira" },
  { year: 1996, animal: "rato", element: "fogo" },
  { year: 1997, animal: "boi", element: "fogo" },
  { year: 1998, animal: "tigre", element: "terra" },
  { year: 1999, animal: "coelho", element: "terra" },
  { year: 2000, animal: "dragao", element: "metal" },
  { year: 2001, animal: "serpente", element: "metal" },
  { year: 2002, animal: "cavalo", element: "agua" },
  { year: 2003, animal: "cabra", element: "agua" },
  { year: 2004, animal: "macaco", element: "madeira" },
  { year: 2005, animal: "galo", element: "madeira" },
  { year: 2006, animal: "cao", element: "fogo" },
  { year: 2007, animal: "porco", element: "fogo" },
  { year: 2008, animal: "rato", element: "terra" },
  { year: 2009, animal: "boi", element: "terra" },
  { year: 2010, animal: "tigre", element: "metal" },
  { year: 2011, animal: "coelho", element: "metal" },
  { year: 2012, animal: "dragao", element: "agua" },
  { year: 2013, animal: "serpente", element: "agua" },
  { year: 2014, animal: "cavalo", element: "madeira" },
  { year: 2015, animal: "cabra", element: "madeira" },
  { year: 2016, animal: "macaco", element: "fogo" },
  { year: 2017, animal: "galo", element: "fogo" },
  { year: 2018, animal: "cao", element: "terra" },
  { year: 2019, animal: "porco", element: "terra" },
  { year: 2020, animal: "rato", element: "metal" },
  { year: 2021, animal: "boi", element: "metal" },
  { year: 2022, animal: "tigre", element: "agua" },
  { year: 2023, animal: "coelho", element: "agua" },
  { year: 2024, animal: "dragao", element: "madeira" },
  { year: 2025, animal: "serpente", element: "madeira" },
  { year: 2026, animal: "cavalo", element: "fogo" },
  { year: 2027, animal: "cabra", element: "fogo" },
  { year: 2028, animal: "macaco", element: "terra" },
  { year: 2029, animal: "galo", element: "terra" },
  { year: 2030, animal: "cao", element: "metal" },
  { year: 2031, animal: "porco", element: "metal" },
  { year: 2032, animal: "rato", element: "agua" },
  { year: 2033, animal: "boi", element: "agua" },
  { year: 2034, animal: "tigre", element: "madeira" },
  { year: 2035, animal: "coelho", element: "madeira" },
]

describe("Chinese (T021)", () => {
  it.each(CHINESE_CASES)("ano $year → animal", ({ year, animal }) => {
    expect(CHINESE_ANIMALS).toHaveLength(12)
    expect(getChineseZodiac(year, 6, 15).animal).toBe(animal)
  })

  it.each(CHINESE_CASES)("ano $year → elemento", ({ year, element }) => {
    expect(Object.keys(CHINESE_NEW_YEAR_DATES)).toHaveLength(56)
    const result = getChineseZodiac(year, 6, 15)
    expect(result.element).toBe(element)
    expect(result.year).toBe(year)
  })
})

// Janela de 260 dias consecutivos (1990-06-15 → 1991-02-28) cobre cada kin
// exatamente uma vez. Âncora: 1990-06-15 = Kin 255 (GMT, CA-HORO-001).
const MAYA_START = Date.UTC(1990, 5, 15)
const MAYA_KIN_ANCHOR = 255
const MAYA_CASES = Array.from({ length: 260 }, (_, i) => {
  const date = new Date(MAYA_START + i * 86_400_000)
  return { i, date, expectedKin: ((MAYA_KIN_ANCHOR - 1 + i) % 260) + 1 }
})

const CAMARA_POSITIONS = [2, 3, 4, 6, 7, 8, 10, 11, 12]

describe("Maya — correlação 1: calculateKinMaya GMT (T021)", () => {
  it.each(MAYA_CASES)(
    "dia $i → kin $expectedKin",
    ({ i, date, expectedKin }) => {
      expect(calculateKinMaya(date)).toBe(expectedKin)

      // Onda Encantada do kin: 9 câmaras coerentes com a onda de 13 dias.
      const onda = getMayanOndaEncantada(expectedKin)
      const waveStart = Math.floor((expectedKin - 1) / 13) * 13 + 1
      expect(onda.waveStartKin).toBe(waveStart)
      expect(onda.chambers).toHaveLength(9)
      expect(onda.chambers.map((c) => c.position)).toEqual(CAMARA_POSITIONS)
      for (const chamber of onda.chambers) {
        expect(chamber.kinNumber).toBe(waveStart + chamber.position - 1)
        expect(chamber.theme.length).toBeGreaterThan(0)
        expect(chamber.seal.id).toBeGreaterThanOrEqual(0)
        expect(chamber.tone.id).toBe(chamber.position)
      }
      if (i === 0) {
        // Kin 255 é a 8ª posição da Onda da Estrela Amarela (kin 248).
        expect(onda.waveStartKin).toBe(248)
        expect(onda.waveSeal.name).toBe("Estrela Amarela")
      }
    },
  )
})

describe("Maya — correlação 2: Contagem Longa GMT (T021)", () => {
  it.each(MAYA_CASES)(
    "dia $i → long count coerente",
    ({ i, date, expectedKin }) => {
      const year = date.getUTCFullYear()
      const month = date.getUTCMonth() + 1
      const day = date.getUTCDate()

      const lc = gregorianToMayanLongCount(year, month, day)

      // 1. mesma cadeia de kins da correlação 1
      expect(lc.kinNumber).toBe(expectedKin)

      // 2. tom e selo coerentes com o kin (20 × 13 = 260)
      expect(lc.tzolkinTone).toBe(((lc.kinNumber - 1) % 13) + 1)
      expect(lc.tzolkinSeal).toBe((lc.kinNumber - 1) % 20)
      expect(MAYAN_SEALS[lc.tzolkinSeal]).toBeDefined()
      expect(MAYAN_TONES[lc.tzolkinTone - 1]).toBeDefined()

      // 3. decomposição da Contagem Longa soma os dias desde 584283
      const { baktun, katun, tun, uinal, kin } = lc.longCount
      const days = baktun * 144000 + katun * 7200 + tun * 360 + uinal * 20 + kin
      expect(days).toBe(jdnTest(year, month, day) - 584283)

      if (i === 0) {
        expect(MAYAN_SEALS).toHaveLength(20)
        expect(MAYAN_TONES).toHaveLength(13)
        expect(jdnTest(2000, 1, 1)).toBe(2451545)
      }
    },
  )
})

describe("maya.ts — helpers de kin (T020)", () => {
  it("kinToSealTone valida faixa 1-260", () => {
    expect(kinToSealTone(255)).toEqual({ sealIndex: 14, toneId: 8 })
    expect(() => kinToSealTone(0)).toThrow()
    expect(() => kinToSealTone(261)).toThrow()
  })
})

describe("kin-maya.ts (T023)", () => {
  it("exporta calculateKinMaya(birthDate): number", () => {
    expect(typeof calculateKinMaya).toBe("function")
  })
})
