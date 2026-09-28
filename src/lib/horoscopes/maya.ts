// Horóscopo Maia (Tzolkin) — SPEC-006 RF-HORO-003 + design.md §1.3/§2.3.
// Correlação GMT (Goodman-Martinez-Thompson): JDN 584283 = 0.0.0.0.0 da
// Contagem Longa. Selos/Tons conforme tabelas RF-HORO-003 (ordem Dreamspell).
//
// Fórmulas do Tzolkin (design.md §1.3 corrigido — ver plano Phase 0 execution log):
//   tom   = ((d + 3) mod 13) + 1         (dia zero = 4 Ajaw: tom 4)
//   selo  = (d + 19) mod 20              (dia zero = Ahau, índice 19)
//   kin   = ((d + 159) mod 260) + 1      (inverso CRT: kin-1 ≡ tom-1 (13), ≡ selo (20))
// O pseudo-código do design (`((tom-1)*20)+selo+1`) não é bijetivo — descartado.

export interface MayanSeal {
  id: number // 0-19 (design.md §2.3)
  name: string
  meaning: string
  direction: string
  color: string
}

export interface MayanTone {
  id: number // 1-13
  name: string
  keyword: string
  action: string
  power: string
}

export interface MayanLongCount {
  baktun: number
  katun: number
  tun: number
  uinal: number
  kin: number
}

export interface MayanDate {
  longCount: MayanLongCount
  tzolkinTone: number // 1-13
  tzolkinSeal: number // 0-19
  kinNumber: number // 1-260
}

export interface MayanChamber {
  chamberNumber: number // 1-9 (câmaras da Onda Encantada)
  position: number // posição 1-13 na onda (portais 1/13, torres 5/9 fora)
  kinNumber: number
  theme: string // significado da câmara (Desafio, Serviço, ...)
  seal: MayanSeal
  tone: MayanTone
}

export interface MayanOndaEncantada {
  waveStartKin: number // kin magnético (posição 1) da onda que contém o kin
  waveSeal: MayanSeal // selo que nomeia a onda
  chambers: MayanChamber[] // 9 câmaras
}

export const MAYAN_SEALS: readonly MayanSeal[] = [
  {
    id: 0,
    name: "Dragão Vermelho",
    meaning: "Nascimento, nutrição, ser",
    direction: "Leste",
    color: "Vermelho",
  },
  {
    id: 1,
    name: "Vento Branco",
    meaning: "Espírito, comunicação, respiração",
    direction: "Norte",
    color: "Branco",
  },
  {
    id: 2,
    name: "Noite Azul",
    meaning: "Sonhos, abundância, intuição",
    direction: "Oeste",
    color: "Azul",
  },
  {
    id: 3,
    name: "Semente Amarela",
    meaning: "Florescimento, direcionamento, consciência",
    direction: "Sul",
    color: "Amarelo",
  },
  {
    id: 4,
    name: "Serpente Vermelha",
    meaning: "Sobrevivência, instinto, kundalini",
    direction: "Leste",
    color: "Vermelho",
  },
  {
    id: 5,
    name: "Enlaçador de Mundos Branco",
    meaning: "Morte, igualdade, oportunidade",
    direction: "Norte",
    color: "Branco",
  },
  {
    id: 6,
    name: "Mão Azul",
    meaning: "Conhecimento, realização, cura",
    direction: "Oeste",
    color: "Azul",
  },
  {
    id: 7,
    name: "Estrela Amarela",
    meaning: "Arte, elegância, beleza",
    direction: "Sul",
    color: "Amarelo",
  },
  {
    id: 8,
    name: "Lua Vermelha",
    meaning: "Purificação, fluxo, água universal",
    direction: "Leste",
    color: "Vermelho",
  },
  {
    id: 9,
    name: "Cachorro Branco",
    meaning: "Amor, lealdade, coração",
    direction: "Norte",
    color: "Branco",
  },
  {
    id: 10,
    name: "Macaco Azul",
    meaning: "Magia, ilusão, jogo",
    direction: "Oeste",
    color: "Azul",
  },
  {
    id: 11,
    name: "Humano Amarelo",
    meaning: "Livre-arbítrio, sabedoria, influência",
    direction: "Sul",
    color: "Amarelo",
  },
  {
    id: 12,
    name: "Caminhante do Céu Vermelho",
    meaning: "Espaço, exploração, vigília",
    direction: "Leste",
    color: "Vermelho",
  },
  {
    id: 13,
    name: "Mago Branco",
    meaning: "Receptividade, coração, tempo",
    direction: "Norte",
    color: "Branco",
  },
  {
    id: 14,
    name: "Águia Azul",
    meaning: "Visão, criatividade, mente",
    direction: "Oeste",
    color: "Azul",
  },
  {
    id: 15,
    name: "Guerreiro Amarelo",
    meaning: "Inteligência, questionamento, coragem",
    direction: "Sul",
    color: "Amarelo",
  },
  {
    id: 16,
    name: "Terra Vermelha",
    meaning: "Navegação, sincronicidade, evolução",
    direction: "Leste",
    color: "Vermelho",
  },
  {
    id: 17,
    name: "Espelho Branco",
    meaning: "Ordem, verdade, infinito",
    direction: "Norte",
    color: "Branco",
  },
  {
    id: 18,
    name: "Tormenta Azul",
    meaning: "Transformação, catálise, energia",
    direction: "Oeste",
    color: "Azul",
  },
  {
    id: 19,
    name: "Sol Amarelo",
    meaning: "Iluminação, vida, universal",
    direction: "Sul",
    color: "Amarelo",
  },
]

export const MAYAN_TONES: readonly MayanTone[] = [
  {
    id: 1,
    name: "Magnético",
    keyword: "Unificar",
    action: "Atrair",
    power: "Propósito",
  },
  {
    id: 2,
    name: "Lunar",
    keyword: "Polarizar",
    action: "Estabilizar",
    power: "Desafio",
  },
  {
    id: 3,
    name: "Elétrico",
    keyword: "Ativar",
    action: "Servir",
    power: "Servir",
  },
  {
    id: 4,
    name: "Auto-existente",
    keyword: "Definir",
    action: "Medir",
    power: "Forma",
  },
  {
    id: 5,
    name: "Ondulado",
    keyword: "Empoderar",
    action: "Comandar",
    power: "Radiância",
  },
  {
    id: 6,
    name: "Rítmico",
    keyword: "Organizar",
    action: "Equilibrar",
    power: "Igualdade",
  },
  {
    id: 7,
    name: "Ressonante",
    keyword: "Inspirar",
    action: "Canalizar",
    power: "Harmonização",
  },
  {
    id: 8,
    name: "Galáctico",
    keyword: "Modelar",
    action: "Harmonizar",
    power: "Integridade",
  },
  {
    id: 9,
    name: "Solar",
    keyword: "Pulsar",
    action: "Realizar",
    power: "Intenção",
  },
  {
    id: 10,
    name: "Planetário",
    keyword: "Perfurar",
    action: "Produzir",
    power: "Manifestação",
  },
  {
    id: 11,
    name: "Espectral",
    keyword: "Dissolver",
    action: "Libertar",
    power: "Liberação",
  },
  {
    id: 12,
    name: "Cristal",
    keyword: "Dedicar",
    action: "Universalizar",
    power: "Cooperação",
  },
  {
    id: 13,
    name: "Cósmico",
    keyword: "Endurecer",
    action: "Transcender",
    power: "Presença",
  },
]

// Câmaras da Onda Encantada (arquitetura: 2 portais + 2 torres + 9 câmaras).
// Portais = posições 1/13; torres = 5/9 — fora das 9 posições exibidas.
const CAMARA_POSITIONS = [2, 3, 4, 6, 7, 8, 10, 11, 12] as const

const CAMARA_THEMES: Readonly<Record<number, string>> = {
  2: "Desafio",
  3: "Serviço",
  4: "Forma",
  6: "Igualdade",
  7: "Harmonização",
  8: "Integridade",
  10: "Manifestação",
  11: "Liberação",
  12: "Cooperação",
}

export const GMT_CORRELATION_JDN = 584283

export function gregorianToJdn(
  year: number,
  month: number,
  day: number,
): number {
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

export function gregorianToMayanLongCount(
  year: number,
  month: number,
  day: number,
): MayanDate {
  const jdn = gregorianToJdn(year, month, day)
  const daysSinceCreation = jdn - GMT_CORRELATION_JDN

  const baktun = Math.floor(daysSinceCreation / 144000) % 20
  const katun = Math.floor((daysSinceCreation % 144000) / 7200) % 20
  const tun = Math.floor((daysSinceCreation % 7200) / 360) % 20
  const uinal = Math.floor((daysSinceCreation % 360) / 20) % 18
  const kin = daysSinceCreation % 20

  const tzolkinTone = ((((daysSinceCreation + 3) % 13) + 13) % 13) + 1
  const tzolkinSeal = (((daysSinceCreation + 19) % 20) + 20) % 20
  const kinNumber = ((((daysSinceCreation + 159) % 260) + 260) % 260) + 1

  return {
    longCount: { baktun, katun, tun, uinal, kin },
    tzolkinTone,
    tzolkinSeal,
    kinNumber,
  }
}

export function kinToSealTone(kinNumber: number): {
  sealIndex: number
  toneId: number
} {
  if (!Number.isInteger(kinNumber) || kinNumber < 1 || kinNumber > 260) {
    throw new Error(`Kin inválido: ${kinNumber} (esperado 1-260)`)
  }
  return {
    sealIndex: (kinNumber - 1) % 20,
    toneId: ((kinNumber - 1) % 13) + 1,
  }
}

/**
 * Onda Encantada que contém o kin — 9 câmaras (posições 2,3,4,6,7,8,10,11,12).
 * Cada onda tem 13 dias (Tons 1-13); portais e torres ficam fora das câmaras.
 */
export function getMayanOndaEncantada(kinNumber: number): MayanOndaEncantada {
  kinToSealTone(kinNumber) // valida o kin (1-260)
  const waveStartKin = Math.floor((kinNumber - 1) / 13) * 13 + 1
  const waveSeal = MAYAN_SEALS[(waveStartKin - 1) % 20]!

  const chambers = CAMARA_POSITIONS.map((position, index): MayanChamber => {
    const chamberKin = waveStartKin + position - 1
    const { sealIndex, toneId } = kinToSealTone(chamberKin)
    return {
      chamberNumber: index + 1,
      position,
      kinNumber: chamberKin,
      theme: CAMARA_THEMES[position]!,
      seal: MAYAN_SEALS[sealIndex]!,
      tone: MAYAN_TONES[toneId - 1]!,
    }
  })

  return { waveStartKin, waveSeal, chambers }
}
