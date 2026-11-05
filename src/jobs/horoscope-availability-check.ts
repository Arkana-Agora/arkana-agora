import { logger } from "@/lib/logger"
import { prisma } from "@/lib/prisma"
import { civilDateBrt } from "@/lib/horoscopes/dates"
import { isFallbackContent } from "@/lib/horoscopes/fallback"
import { WESTERN_SIGNS } from "@/lib/horoscopes/western"
import { trackHoroscopeMissing } from "@/lib/server-analytics"

/**
 * CRON de disponibilidade de horóscopo (T145/AC-24, RNF-HORO-001):
 * dispara às 06:00 BRT (constante `0 9 * * *` — schedule UTC do vercel.json,
 * depois do cron de geração das 04:00 BRT) e verifica se
 * `HoroscopeContent` GERADO do dia (key civil BRT — Q25) existe para os 12
 * signos ocidentais no período daily. Rows com marcador fallback T032
 * contam como ausentes: significam falha do worker T098 (a página mostra
 * template, mas o usuário não recebeu conteúdo da IA — AC-24 quer acionar
 * investigação nesse caso).
 *
 * Sinais: presença completa → `logger.info` explícito de sucesso (não
 * silencioso — CHK017); ausência → `logger.warn` + evento PostHog
 * `horoscope_missing` (telemetria de sistema, `src/lib/server-analytics.ts`)
 * — falha da telemetria nunca derruba o cron. Escopo desta fase: western
 * daily × 12 (Q25/T107/T114 estendem aos demais sistemas).
 */
export const HOROSCOPE_AVAILABILITY_CRON = "0 9 * * *"

export interface HoroscopeAvailabilitySummary {
  date: string
  checked: number
  present: number
  missing: string[]
}

export async function runHoroscopeAvailabilityCheck(
  reqId?: string,
): Promise<HoroscopeAvailabilitySummary> {
  const date = civilDateBrt(0)

  const rows = await prisma.horoscopeContent.findMany({
    where: { type: "western", period: "daily", date },
    select: { signId: true, content: true },
  })
  const present = new Set(
    rows
      .filter((row) => !isFallbackContent(row.content))
      .map((row) => row.signId),
  )
  const missing = WESTERN_SIGNS.filter((sign) => !present.has(sign.id)).map(
    (sign) => sign.id,
  )

  const summary: HoroscopeAvailabilitySummary = {
    date,
    checked: WESTERN_SIGNS.length,
    present: present.size,
    missing,
  }

  if (missing.length === 0) {
    logger.info(
      { ...summary, reqId },
      "[job:horoscope-availability] conteudo diario completo",
    )
    return summary
  }

  logger.warn(
    { ...summary, reqId },
    "[job:horoscope-availability] conteudo diario ausente",
  )
  try {
    await trackHoroscopeMissing(missing, date)
  } catch (err) {
    logger.warn(
      { err, reqId },
      "[job:horoscope-availability] telemetria horoscope_missing falhou",
    )
  }
  return summary
}
