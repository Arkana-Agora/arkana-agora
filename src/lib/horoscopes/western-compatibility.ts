// Horóscopo Ocidental — T090/T097 (Sprint 2, SPEC-006 RF-HORO-001).
// Matriz de compatibilidade 12×12 hardcoded em código — **única fonte de
// verdade** (decisão SC7: sem seed, sem leitura de DB, sem algoritmo que
// derive os eixos). Autorada no triângulo superior (i ≤ j) por par de signos;
// a leitura espelha (b,a) → (a,b), garantindo simetria estrutural.
// `overall` é derivado (média arredondada dos 3 eixos) para não duplicar
// dado. Eixos 0–100 inteiros.

import { WESTERN_SIGNS } from "./western"

export interface WesternCompatibility {
  love: number
  friendship: number
  work: number
  overall: number
}

type PairScores = readonly [love: number, friendship: number, work: number]

const SIGN_INDEX: Readonly<Record<string, number>> = Object.fromEntries(
  WESTERN_SIGNS.map((sign, index) => [sign.id, index]),
)

const MATRIX: Readonly<Record<string, PairScores>> = {
  // Diagonal (mesmo signo)
  "aries:aries": [78, 72, 74],
  "touro:touro": [80, 76, 75],
  "gemeos:gemeos": [74, 80, 72],
  "cancer:cancer": [82, 75, 70],
  "leao:leao": [80, 74, 72],
  "virgem:virgem": [72, 78, 82],
  "libra:libra": [79, 80, 76],
  "escorpiao:escorpiao": [81, 70, 73],
  "sagitario:sagitario": [77, 82, 75],
  "capricornio:capricornio": [76, 74, 84],
  "aquario:aquario": [70, 79, 80],
  "peixes:peixes": [83, 74, 68],

  // Áries (0) ×
  "aries:touro": [56, 62, 58],
  "aries:gemeos": [80, 85, 78],
  "aries:cancer": [54, 50, 58],
  "aries:leao": [88, 83, 85],
  "aries:virgem": [58, 64, 68],
  "aries:libra": [76, 72, 68],
  "aries:escorpiao": [62, 56, 60],
  "aries:sagitario": [85, 87, 82],
  "aries:capricornio": [50, 54, 62],
  "aries:aquario": [78, 80, 79],
  "aries:peixes": [58, 56, 54],

  // Touro (1) ×
  "touro:gemeos": [57, 63, 60],
  "touro:cancer": [82, 78, 76],
  "touro:leao": [53, 51, 56],
  "touro:virgem": [84, 86, 88],
  "touro:libra": [60, 62, 58],
  "touro:escorpiao": [75, 71, 70],
  "touro:sagitario": [58, 60, 62],
  "touro:capricornio": [86, 80, 84],
  "touro:aquario": [51, 57, 60],
  "touro:peixes": [79, 76, 74],

  // Gêmeos (2) ×
  "gemeos:cancer": [55, 61, 57],
  "gemeos:leao": [79, 82, 77],
  "gemeos:virgem": [53, 58, 63],
  "gemeos:libra": [83, 85, 80],
  "gemeos:escorpiao": [59, 55, 61],
  "gemeos:sagitario": [73, 75, 68],
  "gemeos:capricornio": [61, 57, 65],
  "gemeos:aquario": [85, 84, 81],
  "gemeos:peixes": [54, 52, 56],

  // Câncer (3) ×
  "cancer:leao": [57, 55, 54],
  "cancer:virgem": [77, 79, 75],
  "cancer:libra": [55, 60, 58],
  "cancer:escorpiao": [87, 81, 83],
  "cancer:sagitario": [52, 54, 57],
  "cancer:capricornio": [74, 69, 72],
  "cancer:aquario": [58, 63, 66],
  "cancer:peixes": [86, 82, 79],

  // Leão (4) ×
  "leao:virgem": [56, 60, 62],
  "leao:libra": [81, 84, 78],
  "leao:escorpiao": [54, 52, 55],
  "leao:sagitario": [89, 86, 84],
  "leao:capricornio": [59, 56, 63],
  "leao:aquario": [72, 74, 71],
  "leao:peixes": [61, 57, 58],

  // Virgem (5) ×
  "virgem:libra": [58, 64, 61],
  "virgem:escorpiao": [78, 75, 77],
  "virgem:sagitario": [51, 55, 60],
  "virgem:capricornio": [85, 80, 87],
  "virgem:aquario": [60, 65, 69],
  "virgem:peixes": [73, 70, 67],

  // Libra (6) ×
  "libra:escorpiao": [57, 61, 59],
  "libra:sagitario": [80, 83, 77],
  "libra:capricornio": [54, 57, 62],
  "libra:aquario": [84, 86, 82],
  "libra:peixes": [60, 58, 63],

  // Escorpião (7) ×
  "escorpiao:sagitario": [56, 58, 56],
  "escorpiao:capricornio": [77, 74, 78],
  "escorpiao:aquario": [52, 56, 59],
  "escorpiao:peixes": [88, 82, 80],

  // Sagitário (8) ×
  "sagitario:capricornio": [55, 57, 61],
  "sagitario:aquario": [79, 81, 76],
  "sagitario:peixes": [53, 51, 55],

  // Capricórnio (9) ×
  "capricornio:aquario": [57, 63, 64],
  "capricornio:peixes": [81, 77, 75],

  // Aquário (10) ×
  "aquario:peixes": [55, 60, 57],
}

function pairKey(a: string, b: string): { key: string; valid: boolean } {
  const ia = SIGN_INDEX[a]
  const ib = SIGN_INDEX[b]
  if (ia === undefined || ib === undefined) return { key: "", valid: false }
  const [low, high] = ia <= ib ? [a, b] : [b, a]
  return { key: `${low}:${high}`, valid: true }
}

/**
 * Compatibilidade entre dois signos ocidentais (T090/SC7).
 * Simétrica: `getCompatibility(a, b) === getCompatibility(b, a)`.
 * @throws Error se qualquer id de signo não existir em `WESTERN_SIGNS`.
 */
export function getCompatibility(a: string, b: string): WesternCompatibility {
  const { key, valid } = pairKey(a, b)
  if (!valid) {
    throw new Error(`Signo inválido para compatibilidade: "${a}" ou "${b}"`)
  }
  const scores = MATRIX[key]
  if (!scores) {
    throw new Error(`Par de signos sem matriz: "${key}"`)
  }
  const [love, friendship, work] = scores
  return {
    love,
    friendship,
    work,
    overall: Math.round((love + friendship + work) / 3),
  }
}
