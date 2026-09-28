// Horóscopo Chinês — SPEC-006 RF-HORO-002 + design.md §1.2/§2.2.
// Ciclo sexagenário (60 anos): animal = ano efetivo (pós Ano Novo Chinês),
// elemento ano = ciclo de 10 stems celestes (pares Madeira/Fogo/Terra/Metal/Água),
// elemento fixo = atributo intrínseco do animal (tabela RF-HORO-002).

export interface ChineseAnimal {
  id: string // 'rato', 'boi', ...
  name: string
  characteristics: string[]
  yinYang: "yin" | "yang"
  fixedElement: string // elemento intrínseco do animal
}

export interface ChineseZodiac {
  animal: string // id do animal ('cavalo')
  element: string // elemento do ANO, lowercase ('metal')
  year: number // ano efetivo (já ajustado pelo Ano Novo Chinês)
}

export const CHINESE_ANIMALS: readonly ChineseAnimal[] = [
  {
    id: "rato",
    name: "Rato",
    characteristics: ["Inteligente", "Adaptável", "Sociável"],
    yinYang: "yang",
    fixedElement: "agua",
  },
  {
    id: "boi",
    name: "Boi",
    characteristics: ["Trabalhador", "Confiável", "Teimoso"],
    yinYang: "yin",
    fixedElement: "terra",
  },
  {
    id: "tigre",
    name: "Tigre",
    characteristics: ["Corajoso", "Competitivo", "Impulsivo"],
    yinYang: "yang",
    fixedElement: "madeira",
  },
  {
    id: "coelho",
    name: "Coelho",
    characteristics: ["Gentil", "Prudente", "Diplomata"],
    yinYang: "yin",
    fixedElement: "madeira",
  },
  {
    id: "dragao",
    name: "Dragão",
    characteristics: ["Carismático", "Ambicioso", "Idealista"],
    yinYang: "yang",
    fixedElement: "terra",
  },
  {
    id: "serpente",
    name: "Serpente",
    characteristics: ["Sábio", "Enigmático", "Intuitivo"],
    yinYang: "yin",
    fixedElement: "fogo",
  },
  {
    id: "cavalo",
    name: "Cavalo",
    characteristics: ["Energético", "Independente", "Impaciente"],
    yinYang: "yang",
    fixedElement: "fogo",
  },
  {
    id: "cabra",
    name: "Cabra",
    characteristics: ["Calmo", "Criativo", "Compassivo"],
    yinYang: "yin",
    fixedElement: "terra",
  },
  {
    id: "macaco",
    name: "Macaco",
    characteristics: ["Astuto", "Versátil", "Brincalhão"],
    yinYang: "yang",
    fixedElement: "metal",
  },
  {
    id: "galo",
    name: "Galo",
    characteristics: ["Observador", "Trabalhador", "Perfeccionista"],
    yinYang: "yin",
    fixedElement: "metal",
  },
  {
    id: "cao",
    name: "Cão",
    characteristics: ["Leal", "Honesto", "Protetor"],
    yinYang: "yang",
    fixedElement: "terra",
  },
  {
    id: "porco",
    name: "Porco",
    characteristics: ["Generoso", "Compassivo", "Indulgente"],
    yinYang: "yin",
    fixedElement: "agua",
  },
]

// Ano Novo Chinês (data civil gregoriana), 1980–2035 (design.md §1.2).
export const CHINESE_NEW_YEAR_DATES: Readonly<
  Record<number, { month: number; day: number }>
> = {
  1980: { month: 2, day: 16 },
  1981: { month: 2, day: 5 },
  1982: { month: 1, day: 25 },
  1983: { month: 2, day: 13 },
  1984: { month: 2, day: 2 },
  1985: { month: 2, day: 20 },
  1986: { month: 2, day: 9 },
  1987: { month: 1, day: 29 },
  1988: { month: 2, day: 17 },
  1989: { month: 2, day: 6 },
  1990: { month: 1, day: 27 },
  1991: { month: 2, day: 15 },
  1992: { month: 2, day: 4 },
  1993: { month: 1, day: 23 },
  1994: { month: 2, day: 10 },
  1995: { month: 1, day: 31 },
  1996: { month: 2, day: 19 },
  1997: { month: 2, day: 7 },
  1998: { month: 1, day: 28 },
  1999: { month: 2, day: 16 },
  2000: { month: 2, day: 5 },
  2001: { month: 1, day: 24 },
  2002: { month: 2, day: 12 },
  2003: { month: 2, day: 1 },
  2004: { month: 1, day: 22 },
  2005: { month: 2, day: 9 },
  2006: { month: 1, day: 29 },
  2007: { month: 2, day: 18 },
  2008: { month: 2, day: 7 },
  2009: { month: 1, day: 26 },
  2010: { month: 2, day: 14 },
  2011: { month: 2, day: 3 },
  2012: { month: 1, day: 23 },
  2013: { month: 2, day: 10 },
  2014: { month: 1, day: 31 },
  2015: { month: 2, day: 19 },
  2016: { month: 2, day: 8 },
  2017: { month: 1, day: 28 },
  2018: { month: 2, day: 16 },
  2019: { month: 2, day: 5 },
  2020: { month: 1, day: 25 },
  2021: { month: 2, day: 12 },
  2022: { month: 2, day: 1 },
  2023: { month: 1, day: 22 },
  2024: { month: 2, day: 10 },
  2025: { month: 1, day: 29 },
  2026: { month: 2, day: 17 },
  2027: { month: 2, day: 6 },
  2028: { month: 1, day: 26 },
  2029: { month: 2, day: 13 },
  2030: { month: 2, day: 3 },
  2031: { month: 1, day: 23 },
  2032: { month: 2, day: 11 },
  2033: { month: 1, day: 31 },
  2034: { month: 2, day: 19 },
  2035: { month: 2, day: 8 },
}

// Aproximação para datas fora da tabela CNY (nascimentos em jan/fev <1980 ou >2035):
// o Ano Novo Chinês cai sempre entre 21/01 e 20/02 — 04/02 é a mediana.
const CNY_FALLBACK = { month: 2, day: 4 }

// Índice do animal pelo ano efetivo (âncora: 1984 = Rato).
const ANIMALS_BY_ANCHOR = [
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
] as const

// Elemento do ano pelo ciclo de 10 stems celestes (4 pares + água):
// (ano - 4) mod 10 → 0,1 Madeira | 2,3 Fogo | 4,5 Terra | 6,7 Metal | 8,9 Água.
const ELEMENTS_BY_STEM_PAIR = [
  "madeira",
  "fogo",
  "terra",
  "metal",
  "agua",
] as const

/**
 * Elemento do ano chinês pelo ciclo de 10 stems — single-source de
 * `getChineseZodiac` (e do seed de fallbacks, para nunca divergirem).
 */
export function chineseYearElement(year: number): string {
  const stemIndex = (((year - 4) % 10) + 10) % 10
  return ELEMENTS_BY_STEM_PAIR[Math.floor(stemIndex / 2)]!
}

export function getChineseNewYear(year: number): {
  month: number
  day: number
} {
  return CHINESE_NEW_YEAR_DATES[year] ?? CNY_FALLBACK
}

export function getChineseZodiac(
  year: number,
  month: number,
  day: number,
): ChineseZodiac {
  // O ano chinês só começa entre 21/01 e 20/02 — de março em diante o ano é sempre o próprio.
  const newYear = getChineseNewYear(year)
  const effectiveYear =
    month < newYear.month || (month === newYear.month && day < newYear.day)
      ? year - 1
      : year

  const animalIndex = (((effectiveYear - 1984) % 12) + 12) % 12
  const animal = ANIMALS_BY_ANCHOR[animalIndex]!

  const element = chineseYearElement(effectiveYear)

  return { animal, element, year: effectiveYear }
}
