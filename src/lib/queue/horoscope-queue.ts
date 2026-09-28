import { Queue, type JobsOptions, type QueueOptions } from "bullmq"
import Redis from "ioredis"
import { z } from "zod"

import { getEnv } from "@/lib/env"
import {
  HOROSCOPE_TYPES,
  PROMPT_PERIODS,
  type HoroscopeType,
  type PromptPeriod,
} from "@/lib/horoscopes/prompts"

/**
 * BullMQ queue (T033/US-024): `horoscope-generation` sobre Redis com
 * retry 2× (attempts 3) em backoff exponencial; concurrency 3 do worker
 * (T098) é a constante exportada aqui.
 */

export const HOROSCOPE_QUEUE_NAME = "horoscope-generation"
export const HOROSCOPE_WORKER_CONCURRENCY = 3

export interface HoroscopeGenerationJob {
  type: HoroscopeType
  signId: string
  element?: string | null | undefined
  period: PromptPeriod
  date: string
}

// Payload validado no boundary (review): nada malformado entra no Redis —
// enums derivados da single-source dos prompts.
export const horoscopeGenerationJobSchema = z.object({
  type: z.enum(HOROSCOPE_TYPES),
  signId: z.string().min(1),
  element: z.string().min(1).nullish(),
  period: z.enum(PROMPT_PERIODS),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
})

export function buildHoroscopeQueueOptions(): Omit<QueueOptions, "connection"> {
  return {
    defaultJobOptions: {
      attempts: 3, // 1 tentativa + retry 2× (T033)
      backoff: { type: "exponential", delay: 5_000 },
      removeOnComplete: { age: 24 * 60 * 60, count: 1_000 },
      removeOnFail: { age: 7 * 24 * 60 * 60 },
    },
  }
}

export function buildHoroscopeJobOptions(
  job: HoroscopeGenerationJob,
): JobsOptions {
  // jobId determinístico: cron T097 re-enfileira sem duplicar o mesmo dia
  const element = job.element ? `${job.element}:` : ""
  return {
    jobId: `${job.type}:${element}${job.signId}:${job.period}:${job.date}`,
  }
}

let queue: Queue<HoroscopeGenerationJob> | null = null

export function getHoroscopeQueue(): Queue<HoroscopeGenerationJob> {
  if (!queue) {
    const redisUrl = getEnv().REDIS_URL
    if (!redisUrl) {
      throw new Error(
        "REDIS_URL não configurado — fila horoscope-generation indisponível",
      )
    }
    // BullMQ exige maxRetriesPerRequest: null na conexão dedicada
    const connection = new Redis(redisUrl, { maxRetriesPerRequest: null })
    queue = new Queue<HoroscopeGenerationJob>(HOROSCOPE_QUEUE_NAME, {
      ...buildHoroscopeQueueOptions(),
      connection,
    })
  }
  return queue
}

export async function enqueueHoroscopeGeneration(
  job: HoroscopeGenerationJob,
): Promise<string> {
  // fail-fast: payload inválido nunca chega ao Redis (ZodError propaga ao cron)
  const payload = horoscopeGenerationJobSchema.parse(job)
  const created = await getHoroscopeQueue().add(
    "generate",
    payload,
    buildHoroscopeJobOptions(payload),
  )
  return String(created.id ?? "")
}

/** Fecha a fila lazy e zera o cache (uso em testes/shutdown). */
export async function closeHoroscopeQueue(): Promise<void> {
  if (queue) {
    await queue.close()
    queue = null
  }
}
