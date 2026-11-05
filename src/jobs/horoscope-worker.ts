import { Worker } from "bullmq"
import Redis from "ioredis"

import { logger } from "@/lib/logger"
import { prisma } from "@/lib/prisma"
import { getEnv } from "@/lib/env"
import { getAIClient, type AIChatMessage } from "@/lib/ai/client"
import { getInterpretationModel } from "@/lib/ai/models"
import { withRetry } from "@/lib/ai/retry"
import {
  buildFallbackFor,
  isFallbackContent,
  type FallbackTarget,
  type HoroscopeFallbackContent,
} from "@/lib/horoscopes/fallback"
import { periodRowKey } from "@/lib/horoscopes/dates"
import {
  buildHoroscopePrompt,
  horoscopeSignLabel,
} from "@/lib/horoscopes/prompts"
import {
  horoscopeContentShape,
  validateHoroscopeContent,
  type HoroscopeContent,
} from "@/lib/horoscopes/validation"
import {
  HOROSCOPE_QUEUE_NAME,
  HOROSCOPE_WORKER_CONCURRENCY,
  horoscopeGenerationJobSchema,
  type HoroscopeGenerationJob,
} from "@/lib/queue/horoscope-queue"

/**
 * Worker BullMQ da fila `horoscope-generation` (T098/US-024): prompt T034 →
 * IA (batch, sem streaming) → validação T035 → persiste em
 * `HoroscopeContent`. Qualquer falha (cliente IA indisponível, completion
 * vazia, JSON inválido, `general` fora da faixa do período, erro de rede)
 * grava o template fallback T032 com `fallback: true` e loga para retry
 * manual (Q13) — o job termina com sucesso para não consumir as 3 tentativas
 * do BullMQ em falhas esperadas. Erro de persistência propaga → retry do
 * BullMQ (attempts 3, backoff exponencial T033).
 *
 * Row já existente com conteúdo GERADO → skip (idempotência; o jobId
 * determinístico T033 deduplica o mesmo dia). Row com fallback → substituída
 * pela variação da IA (Q2: templates base + IA para variação).
 *
 * Row key: derivada da DATA DO JOB via `periodRowKey` (daily plana,
 * weekly ISO-week e monthly mês da `job.date`) — nunca do relógio de
 * processamento, para jobs atrasados atravessando a virada de semana/mês
 * caírem na row certa (review julik INF-13). `content.date` SEMPRE =
 * `job.date` (shape T035).
 */

export interface HoroscopeJobResult {
  status: "generated" | "skipped" | "fallback"
  type: HoroscopeGenerationJob["type"]
  signId: string
  period: HoroscopeGenerationJob["period"]
  date: string
}

interface ContentKey {
  type: HoroscopeGenerationJob["type"]
  signId: string
  element: string | null
  period: HoroscopeGenerationJob["period"]
  date: string
}

function rowDateFor(job: HoroscopeGenerationJob): string {
  return periodRowKey(job.period, job.date)
}

function fallbackTarget(job: HoroscopeGenerationJob): FallbackTarget {
  return {
    type: job.type,
    signId: job.signId,
    element: job.element,
    period: job.period,
    date: job.date,
  }
}

function parseAiJson(raw: string): unknown {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
  return JSON.parse(cleaned)
}

async function generateAiContent(
  job: HoroscopeGenerationJob,
): Promise<HoroscopeContent> {
  // Template T032 alimenta as variáveis "fixas" do prompt T034 (sorte/cor/
  // compatibilidade) — a IA escreve a prosa com variação diária.
  const template = buildFallbackFor(fallbackTarget(job))
  const prompt = buildHoroscopePrompt(job.type, job.period, {
    sign: horoscopeSignLabel(job.type, job.signId, job.element),
    date: job.date,
    luckyNumber: template.luckyNumber,
    luckyColor: template.luckyColor,
    compatibility: template.compatibility,
  })

  const client = getAIClient()
  const messages: AIChatMessage[] = [
    {
      role: "system",
      content:
        "Responda apenas com JSON válido, sem cercas de código markdown, com os campos general, love, career, health, luckyNumber, luckyColor, mood, compatibility e date.",
    },
    { role: "user", content: prompt },
  ]

  const stream = await withRetry(() =>
    client.chat.completions.create(
      {
        model: getInterpretationModel(),
        messages,
        stream: true,
        max_tokens: 4096,
        temperature: 0.7,
      },
      {
        // Timeout por job: provider travado seguraria um slot da concurrency
        // (3) indefinidamente e impediria worker.close() de drenar (review
        // julik I3).
        signal: AbortSignal.timeout(120_000),
      },
    ),
  )

  let fullText = ""
  for await (const chunk of stream) {
    fullText += chunk.choices[0]?.delta?.content ?? ""
  }
  if (fullText === "") throw new Error("completion vazia")

  const raw = parseAiJson(fullText)
  if (typeof raw !== "object" || raw === null) {
    throw new Error("JSON da IA não é um objeto")
  }

  // `content.date` é verdade do worker: sobrescreve o que a IA devolver
  // (shape T035 plain YYYY-MM-DD = date civil do job).
  const candidate = {
    ...(raw as Record<string, unknown>),
    date: job.date,
    fallback: false,
  }
  const validation = validateHoroscopeContent(candidate, job.period)
  if (!validation.ok) {
    throw new Error(`conteúdo inválido: ${validation.issues.join("; ")}`)
  }
  return horoscopeContentShape.parse(candidate)
}

async function persistContent(
  key: ContentKey,
  content: HoroscopeContent | HoroscopeFallbackContent,
): Promise<"updated" | "created"> {
  // upsert manual: a unique composta tem `element` nulo (western) e o
  // updateMany/create evitam depender do where de unique com null.
  const updated = await prisma.horoscopeContent.updateMany({
    where: {
      type: key.type,
      signId: key.signId,
      element: key.element,
      period: key.period,
      date: key.date,
    },
    data: { content },
  })
  if (updated.count > 0) return "updated"
  await prisma.horoscopeContent.create({ data: { ...key, content } })
  return "created"
}

export async function processHoroscopeJob(
  raw: unknown,
): Promise<HoroscopeJobResult> {
  const job = horoscopeGenerationJobSchema.parse(raw)
  const base = {
    type: job.type,
    signId: job.signId,
    period: job.period,
    date: job.date,
  } as const
  const rowDate = rowDateFor(job)
  const key: ContentKey = {
    type: job.type,
    signId: job.signId,
    element: job.element ?? null,
    period: job.period,
    date: rowDate,
  }

  const existing = await prisma.horoscopeContent.findFirst({
    where: {
      type: key.type,
      signId: key.signId,
      element: key.element,
      period: key.period,
      date: key.date,
    },
    select: { content: true },
  })
  if (existing && !isFallbackContent(existing.content)) {
    logger.info({ ...base, rowDate }, "[job:horoscope-worker] ja gerado; skip")
    return { status: "skipped", ...base }
  }

  try {
    const content = await generateAiContent(job)
    const persisted = await persistContent(key, content)
    logger.info(
      { ...base, rowDate, persisted },
      "[job:horoscope-worker] conteudo gerado",
    )
    return { status: "generated", ...base }
  } catch (err) {
    logger.error(
      { err, ...base, rowDate },
      "[job:horoscope-worker] geracao falhou; gravando fallback T032",
    )
    // Guarda anti-clobber (review julik I1): dois jobs da mesma row key
    // (semana/mês corrente) podem rodar na mesma janela — se o concorrente
    // persistiu conteúdo GERADO enquanto a IA falhava, o fallback NÃO
    // sobrescreve o resultado bom.
    const current = await prisma.horoscopeContent.findFirst({
      where: {
        type: key.type,
        signId: key.signId,
        element: key.element,
        period: key.period,
        date: key.date,
      },
      select: { content: true },
    })
    if (current !== null && !isFallbackContent(current.content)) {
      logger.info(
        { ...base, rowDate },
        "[job:horoscope-worker] conteudo gerado por job concorrente; fallback descartado",
      )
      return { status: "skipped", ...base }
    }
    const fallback = buildFallbackFor(fallbackTarget(job))
    const persisted = await persistContent(key, fallback)
    logger.warn(
      { ...base, rowDate, persisted },
      "[job:horoscope-worker] fallback salvo para retry manual",
    )
    return { status: "fallback", ...base }
  }
}

/**
 * Sobe o worker BullMQ na fila `horoscope-generation` com a concurrency
 * T033 (3). O processo hospedeiro (service worker / socket-service) chama
 * esta função no boot e registra os handlers de shutdown — fora do escopo
 * do módulo (T098 cria o worker; o runner de infraestrutura é task própria).
 */
export function startHoroscopeWorker(): Worker<HoroscopeGenerationJob> {
  const redisUrl = getEnv().REDIS_URL
  if (!redisUrl) {
    throw new Error(
      "REDIS_URL não configurado — worker horoscope-generation indisponível",
    )
  }
  // BullMQ exige maxRetriesPerRequest: null na conexão dedicada
  const connection = new Redis(redisUrl, { maxRetriesPerRequest: null })
  return new Worker<HoroscopeGenerationJob>(
    HOROSCOPE_QUEUE_NAME,
    async (job) => processHoroscopeJob(job.data),
    { connection, concurrency: HOROSCOPE_WORKER_CONCURRENCY },
  )
}
