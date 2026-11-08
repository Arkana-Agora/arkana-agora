import { logger } from "@/lib/logger"
import { prisma } from "@/lib/prisma"
import { isFallbackContent } from "@/lib/horoscopes/fallback"
import { civilDateBrt, periodRowKey } from "@/lib/horoscopes/dates"
import { WESTERN_SIGNS } from "@/lib/horoscopes/western"
import { CHINESE_COMBOS } from "@/lib/horoscopes/fallback"
import {
  closeHoroscopeQueue,
  enqueueHoroscopeGeneration,
} from "@/lib/queue/horoscope-queue"

/**
 * CRON de geração de horóscopos (T097/US-024, RNF-HORO-001): dispara às
 * 04:00 BRT (constante `0 7 * * *` — o `schedule` do vercel.json é UTC e o
 * Vercel Hobby exige agendamento diário; BRT = UTC−3 fixo desde 2019).
 *
 * Comportamento "gera conteúdo se não existe": para a data civil BRT
 * corrente, enfileira na fila BullMQ T033 apenas os jobs cuja row NÃO tem
 * conteúdo GERADO (ausente ou com marcador fallback T032 — nesse caso o
 * worker T098 substitui o template pela variação da IA). O jobId
 * determinístico (T033) deduplica re-enfileiramentos do mesmo dia.
 *
 * `date` do job é sempre a data civil plana (YYYY-MM-DD — schema T033);
 * a row key de weekly/monthly é derivada no worker T098 (civilIsoWeek/
 * civilMonth). Escopo: 12 signos ocidentais × 3 períodos + 60 combos
 * chineses × 3 períodos (T107) + 260 kins maias × 3 períodos (T114).
 */
export const HOROSCOPE_GENERATION_CRON = "0 7 * * *"

const PERIODS = ["daily", "weekly", "monthly"] as const

export interface HoroscopeGenerationSummary {
  date: string
  checked: number
  existing: number
  enqueued: number
}

export async function runHoroscopeGenerationJob(
  reqId?: string,
): Promise<HoroscopeGenerationSummary> {
  const date = civilDateBrt(0)
  let checked = 0
  let existing = 0
  let enqueued = 0

  try {
    for (const period of PERIODS) {
      // Predicate usa a ROW key do período (daily flat / weekly Wxx / monthly
      // YYYY-MM) — consultar weekly/monthly com a data plana sempre achava 0
      // rows e re-enfileirava 12 jobs/dia sem necessidade (review julik I5).
      const rowDate = periodRowKey(period, date)

      // Ocidental: 12 signos
      const westernRows = await prisma.horoscopeContent.findMany({
        where: { type: "western", period, date: rowDate },
        select: { signId: true, content: true },
      })
      const westernReady = new Set(
        westernRows
          .filter((row) => !isFallbackContent(row.content))
          .map((row) => row.signId),
      )

      for (const sign of WESTERN_SIGNS) {
        checked += 1
        if (westernReady.has(sign.id)) {
          existing += 1
          continue
        }
        await enqueueHoroscopeGeneration({
          type: "western",
          signId: sign.id,
          period,
          date,
        })
        enqueued += 1
      }

      // Chinês: 60 combos (animal + elemento)
      const chineseRows = await prisma.horoscopeContent.findMany({
        where: { type: "chinese", period, date: rowDate },
        select: { signId: true, element: true, content: true },
      })
      const chineseReady = new Set(
        chineseRows
          .filter((row) => !isFallbackContent(row.content))
          .map((row) => `${row.signId}:${row.element}`),
      )

      for (const combo of CHINESE_COMBOS) {
        checked += 1
        const key = `${combo.animalId}:${combo.element}`
        if (chineseReady.has(key)) {
          existing += 1
          continue
        }
        await enqueueHoroscopeGeneration({
          type: "chinese",
          signId: combo.animalId,
          element: combo.element,
          period,
          date,
        })
        enqueued += 1
      }
    }
  } finally {
    // Producer one-shot (cron diário): fecha a conexão Redis da fila para a
    // invocação serverless sair limpa — inclusive no caminho de erro
    // (review nextjs I2).
    await closeHoroscopeQueue()
  }

  const summary: HoroscopeGenerationSummary = {
    date,
    checked,
    existing,
    enqueued,
  }
  logger.info(
    { ...summary, reqId },
    "[job:horoscope-generation] tick concluido",
  )
  return summary
}
