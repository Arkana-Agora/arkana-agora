import { logger } from "@/lib/logger"
import { prisma } from "@/lib/prisma"
import { buildFallbackFor } from "@/lib/horoscopes/fallback"
import { civilDateBrt, civilHourBrt } from "@/lib/horoscopes/dates"
import { type HoroscopeType } from "@/lib/horoscopes/prompts"
import {
  horoscopeContentShape,
  type HoroscopeContent,
} from "@/lib/horoscopes/validation"
import { resolveUserSign } from "@/lib/horoscopes/user-signs"

/**
 * CRON horário de notificações de horóscopo (T102/RF-HORO-008): filtra
 * `HoroscopeNotification` com `hour` igual à hora civil BRT corrente e
 * cria 1 `Notification` row in-app por sistema habilitado (toggles
 * western/chinese/maya), com preview do `general` do dia. Conteúdo vem da
 * row `HoroscopeContent` (gerada T098) ou template T032 sintetizado —
 * "conteúdo prévio" do RF, nunca vazio.
 *
 * Roda no services/worker como intervalo horário (`HOROSCOPE_NOTIFICATIONS_
 * INTERVAL_MS`), NUNCA no vercel.json: o Vercel Hobby rejeita schedule
 * < 1 dia e falha o deploy (SC34, decisão do dono — dono escolheu
 * services/worker completo para T098 + T102). `HOROSCOPE_NOTIFICATIONS_CRON`
 * documenta a cadência pretendida ("0 * * * *", hora cheia BRT) para o
 * relay do worker alinhar ao tick.
 *
 * Dedupe: 1 notificação de horóscopo por (userId, sistema, dia civil BRT)
 * — janela `createdAt >= 00:00 BRT (03:00 UTC)` + `data.system`, o mesmo
 * padrão de anti-flood do follow (T-x). Polling de notificações (T071)
 * entrega as rows via socket — sem WS emit próprio.
 */
export const HOROSCOPE_NOTIFICATIONS_CRON = "0 * * * *"
export const HOROSCOPE_NOTIFICATIONS_INTERVAL_MS = 60 * 60 * 1000

const SYSTEM_LABELS: Record<HoroscopeType, string> = {
  western: "ocidental",
  chinese: "chinês",
  maya: "maia",
}

const PREVIEW_MAX = 120

export interface HoroscopeNotificationsSummary {
  hour: number
  candidates: number
  created: number
  skipped: number
}

/**
 * Preview do `general` para a mensagem da notificação: truncagem em
 * limite de chars com fallback em espaço (palavra não cortada no meio).
 */
function previewOf(general: string): string {
  if (general.length <= PREVIEW_MAX) return general
  const cut = general.slice(0, PREVIEW_MAX)
  const lastSpace = cut.lastIndexOf(" ")
  const clipped = lastSpace > 40 ? cut.slice(0, lastSpace) : cut
  return `${clipped.trimEnd()}…`
}

/**
 * Início do dia civil BRT em UTC (BRT = UTC−3 fixo desde 2019): janela
 * de dedupe das notificações de horóscopo.
 */
function brtDayStartUtc(date: string): Date {
  const [year, month, day] = date.split("-").map(Number) as [
    number,
    number,
    number,
  ]
  return new Date(Date.UTC(year, month - 1, day, 3))
}

/**
 * Row `HoroscopeContent` do dia (daily) com validação T035 — row
 * ausente ou malformada → template T032 via `buildFallbackFor`
 * (mesma semântica de fallback da rota my-horoscope T094).
 */
async function loadContent(
  type: HoroscopeType,
  signId: string,
  element: string | null,
  date: string,
): Promise<HoroscopeContent> {
  const row = await prisma.horoscopeContent.findFirst({
    where: { type, signId, element, period: "daily", date },
  })
  if (row !== null) {
    const parsed = horoscopeContentShape.safeParse(row.content)
    if (parsed.success) return parsed.data
  }
  return buildFallbackFor({ type, signId, element, period: "daily", date })
}

export async function runHoroscopeNotifications(
  reqId?: string,
): Promise<HoroscopeNotificationsSummary> {
  const hour = civilHourBrt()
  const date = civilDateBrt(0)
  const dayStart = brtDayStartUtc(date)
  const summary: HoroscopeNotificationsSummary = {
    hour,
    candidates: 0,
    created: 0,
    skipped: 0,
  }

  const configs = await prisma.horoscopeNotification.findMany({
    where: {
      hour,
      OR: [
        { westernEnabled: true },
        { chineseEnabled: true },
        { mayaEnabled: true },
      ],
    },
    select: {
      userId: true,
      westernEnabled: true,
      chineseEnabled: true,
      mayaEnabled: true,
      user: { select: { birthDate: true, astrologicalSign: true } },
    },
  })

  for (const config of configs) {
    const systemFlags: ReadonlyArray<readonly [HoroscopeType, boolean]> = [
      ["western", config.westernEnabled],
      ["chinese", config.chineseEnabled],
      ["maya", config.mayaEnabled],
    ]

    for (const [type, enabled] of systemFlags) {
      if (!enabled) continue
      summary.candidates += 1

      const sign = resolveUserSign(type, config.user)
      if (sign === null) {
        summary.skipped += 1
        continue
      }

      const existing = await prisma.notification.findFirst({
        where: {
          userId: config.userId,
          type: "horoscope",
          createdAt: { gte: dayStart },
          data: { equals: type, path: ["system"] },
        },
        select: { id: true },
      })
      if (existing !== null) {
        summary.skipped += 1
        continue
      }

      const content = await loadContent(type, sign.signId, sign.element, date)
      const label = SYSTEM_LABELS[type]
      await prisma.notification.create({
        data: {
          userId: config.userId,
          type: "horoscope",
          message: `Seu horóscopo ${label} de ${date}: ${previewOf(content.general)}`,
          data: {
            system: type,
            signId: sign.signId,
            element: sign.element,
            date,
          },
        },
      })
      summary.created += 1
    }
  }

  logger.info(
    { ...summary, reqId },
    "[job:horoscope-notifications] tick concluido",
  )
  return summary
}
