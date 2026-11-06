// Boot do services/worker (decisão do dono, Sprint 2 Phase 4): processo
// Node único hospedando (1) o worker BullMQ da fila `horoscope-generation`
// (T098) e (2) o tick horário de notificações de horóscopo (T102) — o
// Vercel Hobby só aceita crons diários (SC34), então o "0 * * * *" roda
// aqui como intervalo alinhado à hora cheia (UTC-epoch; BRT = UTC−3 em
// horas inteiras → sinônimo de hora cheia BRT em qualquer timezone).
//
// Dev: `bun run dev:worker` (tsx watch). Produção: PM2 sobe
// `tsx services/worker/index.ts` (docs/infra, fase de docs).
import "./env" // DEVE ser o primeiro import — env antes de @/lib/prisma

import {
  HOROSCOPE_NOTIFICATIONS_CRON,
  HOROSCOPE_NOTIFICATIONS_INTERVAL_MS,
  runHoroscopeNotifications,
} from "@/jobs/horoscope-notifications"
import { startHoroscopeWorker } from "@/jobs/horoscope-worker"
import { logger } from "@/lib/logger"
import { HOROSCOPE_QUEUE_NAME } from "@/lib/queue/horoscope-queue"

const HOUR_MS = 3_600_000

/**
 * ms até o próximo limite de hora alinhado ao epoch UTC (00:00 UTC,
 * :00 de qualquer hora). Como BRT é UTC−3 fixo (horas inteiras), o
 * boundary coincide com a hora cheia BRT — mesma cadência do cron
 * documentado `0 * * * *`, independente do timezone da máquina.
 */
function msUntilNextHourTick(now = Date.now()): number {
  return HOUR_MS - (now % HOUR_MS)
}

async function main(): Promise<void> {
  const worker = startHoroscopeWorker()
  worker.on("error", (err) => {
    logger.error({ err }, "[worker] erro do BullMQ (horoscope-generation)")
  })
  worker.on("failed", (job, err) => {
    logger.error(
      { err, jobId: job?.id, attemptsMade: job?.attemptsMade },
      "[worker] job esgotou tentativas",
    )
  })

  let tickTimer: ReturnType<typeof setTimeout> | null = null
  let tickInFlight: Promise<void> | null = null
  let pendingTick = false

  // C1 (review julik): ticks são ENCADEADOS, nunca descartados — um tick
  // ainda em andamento quando o boundary dispara marca `pendingTick` e o
  // boundary é reexecutado logo após (usuário da hora perdida recebe a
  // notificação com atraso, não perde o dia; dedupe por dia continua
  // valendo). Descartar silenciosamente perdia a hora inteira.
  const runTick = async (): Promise<void> => {
    if (tickInFlight !== null) {
      pendingTick = true
      logger.warn(
        {},
        "[worker] tick de notificacoes ainda em andamento — reexecucao agendada",
      )
      return
    }
    tickInFlight = (async () => {
      try {
        await runHoroscopeNotifications()
      } catch (err) {
        logger.error({ err }, "[worker] tick de notificacoes falhou")
      }
    })()
    await tickInFlight
    tickInFlight = null
    if (pendingTick) {
      pendingTick = false
      await runTick()
    }
  }

  const scheduleTick = (): void => {
    tickTimer = setTimeout(() => {
      void runTick().then(scheduleTick)
    }, msUntilNextHourTick())
  }

  // Catch-up imediato no boot (idempotente: dedupe por (userId, sistema,
  // dia BRT)) + tick alinhado à hora cheia.
  void runTick()
  scheduleTick()

  let shuttingDown = false
  const shutdown = async (signal: string): Promise<void> => {
    if (shuttingDown) return
    shuttingDown = true
    if (tickTimer) clearTimeout(tickTimer)
    logger.info({ signal }, "[worker] encerrando (services/worker)")
    // I4 (review julik): drena o tick em andamento (com grace de 10s)
    // antes de drenar o BullMQ — mata no meio de um `create` de
    // notificação não perde usuários no mesmo dia BRT.
    if (tickInFlight !== null) {
      await Promise.race([
        tickInFlight,
        new Promise((resolve) => setTimeout(resolve, 10_000)),
      ])
    }
    await worker.close() // drena jobs em andamento antes de sair
    // Não usa process.exit(0) — deixa o processo sair naturalmente após
    // o event loop esvaziar (worker.close() fecha handles, event loop termina)
  }
  process.on("SIGINT", () => void shutdown("SIGINT"))
  process.on("SIGTERM", () => void shutdown("SIGTERM"))

  logger.info(
    {
      queue: HOROSCOPE_QUEUE_NAME,
      notificationsCron: HOROSCOPE_NOTIFICATIONS_CRON,
      notificationsIntervalMs: HOROSCOPE_NOTIFICATIONS_INTERVAL_MS,
    },
    "[worker] services/worker iniciado (BullMQ horoscope-generation + tick horario de notificacoes)",
  )
}

main().catch((err: unknown) => {
  logger.error({ err }, "[worker] falha ao iniciar")
  process.exit(1)
})
