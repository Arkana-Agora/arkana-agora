import { z } from "zod"

/**
 * Faixas de palavras por período (RF-HORO-001 / T035):
 * diário 150-250, semanal 300-500, mensal 500-800. Markdown permitido
 * (a contagem ignora a sintaxe, apenas espaços separaram palavras).
 * A contagem é sobre o texto principal (`general`), que cobre amor,
 * carreira e saúde; campos complementares (love/career/health) são curtos
 * por construção e ficam fora da faixa.
 */
export const PERIOD_WORD_RANGES = {
  daily: { min: 150, max: 250 },
  weekly: { min: 300, max: 500 },
  monthly: { min: 500, max: 800 },
} as const

export type HoroscopePeriod = keyof typeof PERIOD_WORD_RANGES

export const horoscopeContentShape = z.object({
  general: z.string().min(1),
  love: z.string().min(1),
  career: z.string().min(1),
  health: z.string().min(1),
  luckyNumber: z.number().int().min(1).max(99),
  luckyColor: z.string().min(1),
  mood: z.string().min(1),
  compatibility: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  fallback: z.boolean().optional(),
})

export type HoroscopeContent = z.infer<typeof horoscopeContentShape>

export function countWords(text: string): number {
  const trimmed = text.trim()
  if (!trimmed) return 0
  return trimmed.split(/\s+/).filter(Boolean).length
}

export interface HoroscopeValidation {
  ok: boolean
  wordCount: number
  issues: string[]
}

export function validateHoroscopeContent(
  content: unknown,
  period: HoroscopePeriod,
): HoroscopeValidation {
  const shape = horoscopeContentShape.safeParse(content)
  if (!shape.success) {
    return {
      ok: false,
      wordCount: 0,
      issues: shape.error.issues.map(
        (issue) => `${issue.path.join(".")}: ${issue.message}`,
      ),
    }
  }

  const { min, max } = PERIOD_WORD_RANGES[period]
  const wordCount = countWords(shape.data.general)
  const issues: string[] = []
  if (wordCount < min || wordCount > max) {
    issues.push(
      `general: ${wordCount} palavras (esperado ${min}-${max} para ${period})`,
    )
  }

  return { ok: issues.length === 0, wordCount, issues }
}
