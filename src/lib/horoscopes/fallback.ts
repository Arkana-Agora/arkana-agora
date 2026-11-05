// Templates de fallback T032 — fonte única compartilhada por seed, rotas
// (T093/T106/T113), worker (T098) e cron de fallbacks. Extraídos de
// `prisma/seed.ts` para que código de runtime não importe o módulo de seed
// (que carrega dotenv/config e o singleton do prisma).
//
// Fallback ocidental (design.md §2.1) — pré-existe ao cron 04:00 BRT para a
// página nunca retornar vazio. T032 estende para weekly/monthly + chinês +
// maia (fallbacks são templates: ficam fora da validação T035, decisão
// 2026-09-26).
//
// `date` dos builders é a MESMA key usada em `HoroscopeContent.date` para
// daily — para weekly/monthly use `contentDateFor(periodKey)`: a key da row
// é a civil key do período (YYYY-Www/YYYY-MM), mas `content.date` obedece o
// shape T035 (`horoscopeContentShape` regex `^\d{4}-\d{2}-\d{2}$`),
// consumido pelo parse do hook useHoroscopes e pela validação do worker
// T098.

import { CHINESE_ANIMALS, chineseYearElement } from "@/lib/horoscopes/chinese"
import { civilDateBrt } from "@/lib/horoscopes/dates"
import { kinToSealTone, MAYAN_SEALS, MAYAN_TONES } from "@/lib/horoscopes/maya"
import { PROMPT_MOODS, type HoroscopeType } from "@/lib/horoscopes/prompts"
import { WESTERN_SIGNS } from "@/lib/horoscopes/western"

const FALLBACK_COLORS = [
  "azul",
  "verde",
  "amarelo",
  "vermelho",
  "roxo",
  "dourado",
  "rosa",
  "prata",
  "laranja",
  "turquesa",
  "índigo",
  "coral",
]

export type FallbackPeriod = "daily" | "weekly" | "monthly"

export type HoroscopeFallbackContent = {
  general: string
  love: string
  career: string
  health: string
  luckyNumber: number
  luckyColor: string
  mood: string
  compatibility: string
  date: string
  fallback: boolean
}

const PERIOD_WORD: Record<FallbackPeriod, string> = {
  daily: "hoje",
  weekly: "nesta semana",
  monthly: "neste mês",
}

const PLAIN_CIVIL_DATE = /^\d{4}-\d{2}-\d{2}$/

/**
 * `content.date` T035 para uma key de período: daily (YYYY-MM-DD) mantém a
 * key; weekly/monthly (YYYY-Www/YYYY-MM) usam a data civil corrente como
 * âncora interna do template.
 */
export function contentDateFor(periodKey: string): string {
  return PLAIN_CIVIL_DATE.test(periodKey) ? periodKey : civilDateBrt(0)
}

/**
 * Lê o marcador `fallback` de uma row `HoroscopeContent.content` (JSON).
 * `true` = template T032 (candidato à substituição pelo worker T098);
 * ausente/false = conteúdo gerado pela IA (o cron T097 pula a row).
 * Fonte única do marcador — cron e worker precisam concordar.
 */
export function isFallbackContent(content: unknown): boolean {
  return (
    typeof content === "object" &&
    content !== null &&
    (content as { fallback?: unknown }).fallback === true
  )
}

export function buildWesternFallback(
  index: number,
  date: string,
  period: FallbackPeriod = "daily",
): HoroscopeFallbackContent {
  const sign = WESTERN_SIGNS[index]!
  const next = WESTERN_SIGNS[(index + 1) % WESTERN_SIGNS.length]!
  const firstKeyword = sign.keywords[0] ?? sign.element
  const when = PERIOD_WORD[period]
  const element = sign.element.toLowerCase()

  const general =
    period === "daily"
      ? `${sign.name}: dia de ${firstKeyword.toLowerCase()}. A energia de ${element} pede presença nas escolhas do dia.`
      : period === "weekly"
        ? `${sign.name}: ${when}, a energia de ${element} e o traço de ${firstKeyword.toLowerCase()} orientam as escolhas. Priorize o que dá continuidade, não o que grita mais alto, e reserve um momento para respirar antes de decidir.`
        : `${sign.name}: ${when}, o elemento ${element} pede ritmo constante. ${firstKeyword.toLowerCase()} é o fio condutor: revise o que começou, solte o que não fluiu e planeje o próximo ciclo com clareza. O cuidado com o corpo e com os vínculos sustenta o resto.`

  return {
    general,
    love: `${sign.name}: conversas francas fortalecem os vínculos ${when}.`,
    career: `${sign.name}: organize as prioridades e conclua uma tarefa pendente ${when}.`,
    health: `${sign.name}: hidrate-se e reserve um momento de descanso ${when}.`,
    luckyNumber: ((index * 7 + 3) % 99) + 1,
    luckyColor: FALLBACK_COLORS[index % FALLBACK_COLORS.length]!,
    mood: PROMPT_MOODS[index % PROMPT_MOODS.length]!,
    compatibility: next.id,
    date,
    fallback: true,
  }
}

// 60 combos sexagenários: y = índice canônico 0..59 ≡ ano chinês 1984+y
// (animal y%12 e elemento do stem de 1984+y — `chineseYearElement`, a
// MESMA fórmula de `getChineseZodiac`). Para animal fixo a, y = a + 12k
// (k = 0..4) percorre stems a, a+2, a+4, a+6, a+8 (módulo 10, mesma
// paridade → 5 elementos distintos) → os 60 pares (animal, elemento)
// são únicos e cobrem a tabela inteira (12 × 5). Use sempre a tabela —
// derivar animal ou elemento isoladamente mistura pares divergentes.
export const CHINESE_COMBOS = Array.from({ length: 60 }, (_, y) => ({
  animalId: CHINESE_ANIMALS[y % 12]!.id,
  element: chineseYearElement(1984 + y),
}))

export const MAYAN_KIN_COUNT = 260

export function buildChineseFallback(
  comboIndex: number,
  date: string,
  period: FallbackPeriod = "daily",
): { signId: string; element: string; content: HoroscopeFallbackContent } {
  const animal = CHINESE_ANIMALS[comboIndex % 12]!
  const nextAnimal = CHINESE_ANIMALS[(comboIndex + 1) % 12]!
  const element = CHINESE_COMBOS[comboIndex % CHINESE_COMBOS.length]!.element
  const character =
    animal.characteristics[comboIndex % animal.characteristics.length]!
  const when = PERIOD_WORD[period]

  return {
    signId: animal.id,
    element,
    content: {
      general: `${animal.name}: ${when}, a energia ${element} e o traço ${character.toLowerCase()} pedem presença. Fluxe com o ritmo do ciclo sexagenário, escolha as batalhas com cuidado e confie na adaptação — ela abre mais portas que a força.`,
      love: `${animal.name}: ${character.toLowerCase()} aproxima quem importa ${when}.`,
      career: `${animal.name}: aproveite a energia ${element} para destravar uma tarefa ${when}.`,
      health: `${animal.name}: movimento leve e respiração consciente sustentam ${when}.`,
      luckyNumber: ((comboIndex * 7 + 5) % 99) + 1,
      luckyColor: FALLBACK_COLORS[comboIndex % FALLBACK_COLORS.length]!,
      mood: PROMPT_MOODS[comboIndex % PROMPT_MOODS.length]!,
      compatibility: nextAnimal.id,
      date,
      fallback: true,
    },
  }
}

export function buildMayaFallback(
  kinNumber: number,
  date: string,
  period: FallbackPeriod = "daily",
): { signId: string; content: HoroscopeFallbackContent } {
  const { sealIndex, toneId } = kinToSealTone(kinNumber) // valida 1-260
  const seal = MAYAN_SEALS[sealIndex]!
  const tone = MAYAN_TONES[toneId - 1]!
  const when = PERIOD_WORD[period]

  return {
    signId: String(kinNumber),
    content: {
      general: `Kin ${kinNumber} (${seal.name} ${tone.name}): ${when}, o selo traz ${seal.meaning.toLowerCase()} e a tonalidade pede ${tone.keyword.toLowerCase()}. Ação guiada: ${tone.action.toLowerCase()}. Deixe a cor ${seal.color.toLowerCase()} presente nas escolhas e mantenha o propósito do dia alinhado ao passo certo.`,
      love: `Kin ${kinNumber}: ${tone.name} acolhe os vínculos ${when}.`,
      career: `Kin ${kinNumber}: ${tone.keyword} orienta as decisões ${when}.`,
      health: `Kin ${kinNumber}: respire fundo e desacelere o corpo ${when}.`,
      luckyNumber: ((kinNumber * 13 + 1) % 99) + 1,
      luckyColor: seal.color.toLowerCase(),
      mood: PROMPT_MOODS[kinNumber % PROMPT_MOODS.length]!,
      compatibility: String(((kinNumber + 64) % MAYAN_KIN_COUNT) + 1),
      date,
      fallback: true,
    },
  }
}

export interface FallbackTarget {
  type: HoroscopeType
  signId: string
  element?: string | null | undefined
  period: FallbackPeriod
  date: string
}

/**
 * Dispatcher dos builders T032 por tipo — usado pelo worker T098 (falha da
 * IA) e pela interpretação T101 (sintetiza contexto quando a row não existe
 * ou está malformada). `date` alimenta o `content.date` T035 (plano).
 * Lança para signId desconhecido: no worker vira retry do BullMQ; na rota
 * T101 o chamador captura e segue com contexto nulo (nunca 500).
 */
export function buildFallbackFor(
  target: FallbackTarget,
): HoroscopeFallbackContent {
  // Normaliza internamente: `content.date` T035 é sempre a data civil plana
  // — weekly/monthly passam a key do período (YYYY-Www/YYYY-MM) viram a
  // data corrente (review; chamador não precisa se lembrar de normalizar).
  const date = contentDateFor(target.date)
  if (target.type === "western") {
    const index = WESTERN_SIGNS.findIndex((sign) => sign.id === target.signId)
    if (index < 0) {
      throw new Error(`signo ocidental desconhecido: ${target.signId}`)
    }
    return buildWesternFallback(index, date, target.period)
  }
  if (target.type === "chinese") {
    const comboIndex = CHINESE_COMBOS.findIndex(
      (combo) =>
        combo.animalId === target.signId &&
        (target.element == null || combo.element === target.element),
    )
    if (comboIndex < 0) {
      throw new Error(
        `combo chinês desconhecido: ${target.signId}${target.element ? `/${target.element}` : ""}`,
      )
    }
    return buildChineseFallback(comboIndex, date, target.period).content
  }
  // kinToSealTone valida o intervalo 1-260 e lança fora dele
  return buildMayaFallback(Number(target.signId), date, target.period).content
}
