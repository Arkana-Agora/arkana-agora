/**
 * AI prompt templates (T034/US-024): templates por tipo/período/mood com
 * as variáveis sign, date, luckyNumber, luckyColor e compatibility
 * (RF-HORO-001; faixas de palavras por período para o validador T035).
 */

import { PERIOD_WORD_RANGES } from "@/lib/horoscopes/validation"

// Enums em runtime (single-source): tipos/períodos como valores exportados
// servem zod (fila T033), testes e o type derivado — sem repetir a união.
export const HOROSCOPE_TYPES = ["western", "chinese", "maya"] as const
export type HoroscopeType = (typeof HOROSCOPE_TYPES)[number]

export const PROMPT_PERIODS = ["daily", "weekly", "monthly"] as const
export type PromptPeriod = (typeof PROMPT_PERIODS)[number]

export const PROMPT_MOODS = [
  "sereno",
  "motivado",
  "reflexivo",
  "otimista",
  "criativo",
  "determinado",
  "acolhedor",
  "curioso",
  "grato",
  "confiante",
  "leve",
  "centrado",
] as const

export type PromptMood = (typeof PROMPT_MOODS)[number]

export interface PromptVariables {
  sign: string
  date: string
  luckyNumber: number | string
  luckyColor: string
  compatibility: string
}

/**
 * RF-HORO-001: contagem de palavras sobre o campo `general`.
 * Single-source: o prompt e o validador T035 (`PERIOD_WORD_RANGES`) precisam
 * da MESMA faixa — divergir faria toda geração ser rejeitada.
 */
export const WORD_RANGES: Record<PromptPeriod, { min: number; max: number }> =
  PERIOD_WORD_RANGES

const TYPE_CONTEXT: Record<HoroscopeType, string> = {
  western:
    "Use os arquétipos do signo ocidental (elemento, regente e keywords do catálogo).",
  chinese:
    "Use o animal e o elemento do ano do zodíaco chinês (ciclo sexagenário).",
  maya: "Use o selo e a tonalidade do kin maya (Tzolkin, 260 kins).",
}

const PERIOD_GUIDANCE: Record<PromptPeriod, string> = {
  daily: `Foco no dia: 1 ação prática por área (amor, carreira, saúde). Campo \`general\` com ${WORD_RANGES.daily.min} a ${WORD_RANGES.daily.max} palavras.`,
  weekly: `Foco na semana: tendências e uma meta por área. Campo \`general\` com ${WORD_RANGES.weekly.min} a ${WORD_RANGES.weekly.max} palavras.`,
  monthly: `Foco no mês: panorama amplo por área e temas recorrentes. Campo \`general\` com ${WORD_RANGES.monthly.min} a ${WORD_RANGES.monthly.max} palavras.`,
}

const MOOD_GUIDANCE: Record<PromptMood, string> = {
  sereno: "tom sereno e tranquilizador",
  motivado: "tom motivador e encorajador",
  reflexivo: "tom reflexivo e introspectivo",
  otimista: "tom otimista e esperançoso",
  criativo: "tom criativo e inspirado",
  determinado: "tom direto e determinado",
  acolhedor: "tom acolhedor e empático",
  curioso: "tom curioso e exploratório",
  grato: "tom grato e gentil",
  confiante: "tom confiante e firme",
  leve: "tom leve e bem-humorado",
  centrado: "tom centrado e equilibrado",
}

const REQUIRED_STRING_KEYS = [
  "sign",
  "date",
  "luckyColor",
  "compatibility",
] as const

export function buildHoroscopePrompt(
  type: HoroscopeType,
  period: PromptPeriod,
  variables: PromptVariables,
  mood: PromptMood = "sereno",
): string {
  const missing = REQUIRED_STRING_KEYS.filter(
    (key) => String(variables[key]).trim() === "",
  )
  if (missing.length > 0) {
    throw new Error(`Prompt variables ausentes: ${missing.join(", ")}`)
  }
  if (!Number.isFinite(Number(variables.luckyNumber))) {
    throw new Error("Prompt variable inválida: luckyNumber")
  }

  return [
    "Você é o astrólogo da Arkana Agora. Escreva um horóscopo em pt-BR, em tom acessível, para publicação no app.",
    `Tipo: ${type} — ${TYPE_CONTEXT[type]}`,
    `Período: ${period} — ${PERIOD_GUIDANCE[period]}`,
    `Mood: ${mood} — ${MOOD_GUIDANCE[mood]}.`,
    "Variáveis obrigatórias (use os valores exatamente como estão):",
    `- sign: ${variables.sign}`,
    `- date: ${variables.date}`,
    `- luckyNumber: ${variables.luckyNumber}`,
    `- luckyColor: ${variables.luckyColor}`,
    `- compatibility: ${variables.compatibility}`,
    "Retorne apenas o JSON estruturado com os campos general, love, career, health, luckyNumber, luckyColor, mood, compatibility e date.",
    "Não invente previsões absolutas (morte, doença, dinheiro garantido) nem dê conselhos médicos, jurídicos ou financeiros.",
  ].join("\n")
}
