import { beforeEach, describe, expect, it, vi } from "vitest"

const prismaMock = vi.hoisted(() => ({
  horoscopeContent: { findMany: vi.fn() },
}))
const queueMock = vi.hoisted(() => ({
  enqueueHoroscopeGeneration: vi.fn(),
  closeHoroscopeQueue: vi.fn(),
}))

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }))
vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))
vi.mock("@/lib/queue/horoscope-queue", () => queueMock)

import {
  HOROSCOPE_GENERATION_CRON,
  runHoroscopeGenerationJob,
} from "@/jobs/horoscope-generation"
import { civilDateBrt, periodRowKey } from "@/lib/horoscopes/dates"
import { WESTERN_SIGNS } from "@/lib/horoscopes/western"

// T097/T100 — cron de geração de horóscopo (04:00 BRT): enfileira na fila
// BullMQ T033 apenas os jobs sem conteúdo GERADO (ausente ou fallback T032)
// para a data civil BRT corrente. O worker T098 faz skip se a row já foi
// gerada — o jobId determinístico (T033) deduplica re-enfileiramentos.

beforeEach(() => {
  vi.clearAllMocks()
  prismaMock.horoscopeContent.findMany.mockResolvedValue([])
  queueMock.enqueueHoroscopeGeneration.mockResolvedValue("job-id")
})

describe("runHoroscopeGenerationJob (T097)", () => {
  it("cron 04:00 BRT publicado como 07:00 UTC (Vercel cron é UTC)", () => {
    expect(HOROSCOPE_GENERATION_CRON).toBe("0 7 * * *")
  })

  it("enfileira 12 signos × 3 períodos quando não há rows", async () => {
    const summary = await runHoroscopeGenerationJob("req-1")

    expect(summary).toEqual({
      date: civilDateBrt(0),
      checked: 36,
      existing: 0,
      enqueued: 36,
    })
    expect(queueMock.enqueueHoroscopeGeneration).toHaveBeenCalledTimes(36)
    expect(prismaMock.horoscopeContent.findMany).toHaveBeenCalledTimes(3)
  })

  it("usa date civil BRT plano (YYYY-MM-DD) em todos os jobs, inclusive weekly/monthly", async () => {
    await runHoroscopeGenerationJob()

    const date = civilDateBrt(0)
    expect(date).toMatch(/^\d{4}-\d{2}-\d{2}$/)

    const calls = queueMock.enqueueHoroscopeGeneration.mock.calls
    expect(calls).toHaveLength(36)
    for (const [job] of calls) {
      expect(job.type).toBe("western")
      expect(job.date).toBe(date)
      expect(job.element).toBeUndefined()
    }
    const periods = calls.map(([job]) => job.period)
    expect(periods.filter((p) => p === "daily")).toHaveLength(12)
    expect(periods.filter((p) => p === "weekly")).toHaveLength(12)
    expect(periods.filter((p) => p === "monthly")).toHaveLength(12)

    const dailySignIds = new Set(
      calls
        .filter(([job]) => job.period === "daily")
        .map(([job]) => job.signId),
    )
    expect(dailySignIds.size).toBe(12)
    expect(dailySignIds.has("aries")).toBe(true)
    expect(dailySignIds.has("peixes")).toBe(true)
  })

  it("consulta por período com a ROW key correta (flat/Wxx/YYYY-MM)", async () => {
    await runHoroscopeGenerationJob()

    const date = civilDateBrt(0)
    const wheres = prismaMock.horoscopeContent.findMany.mock.calls.map(
      ([args]) => args.where,
    )
    expect(wheres).toEqual([
      { type: "western", period: "daily", date: periodRowKey("daily", date) },
      { type: "western", period: "weekly", date: periodRowKey("weekly", date) },
      {
        type: "western",
        period: "monthly",
        date: periodRowKey("monthly", date),
      },
    ])
    // daily = plana; weekly/mês diferem da plana (o bug antigo consultava
    // flat em todos os períodos e nunca achava rows).
    expect(wheres[0]?.date).toBe(date)
    expect(wheres[1]?.date).not.toBe(date)
    expect(wheres[2]?.date).not.toBe(date)
  })

  it("pula rows já geradas e enfileira ausentes + fallbacks", async () => {
    const date = civilDateBrt(0)
    // daily: 12 geradas (pulam); weekly: 12 fallback (re-enfileiram); monthly: nenhuma
    const dailyRows = WESTERN_SIGNS.map((s) => ({
      signId: s.id,
      content: { fallback: false, date },
    }))
    const weeklyRows = WESTERN_SIGNS.map((s) => ({
      signId: s.id,
      content: { fallback: true, date },
    }))
    prismaMock.horoscopeContent.findMany
      .mockResolvedValueOnce(dailyRows)
      .mockResolvedValueOnce(weeklyRows)
      .mockResolvedValueOnce([])

    const summary = await runHoroscopeGenerationJob()

    expect(summary).toEqual({
      date,
      checked: 36,
      existing: 12,
      enqueued: 24,
    })
    expect(queueMock.enqueueHoroscopeGeneration).toHaveBeenCalledTimes(24)

    const enqueuedDaily =
      queueMock.enqueueHoroscopeGeneration.mock.calls.filter(
        ([job]) => job.period === "daily",
      )
    expect(enqueuedDaily).toHaveLength(0)

    const enqueuedWeekly =
      queueMock.enqueueHoroscopeGeneration.mock.calls.filter(
        ([job]) => job.period === "weekly",
      )
    expect(enqueuedWeekly).toHaveLength(12)
  })

  it("propaga falha do Redis (enqueue) para o cron responder 500", async () => {
    queueMock.enqueueHoroscopeGeneration.mockRejectedValue(
      new Error("redis down"),
    )

    await expect(runHoroscopeGenerationJob()).rejects.toThrow(/redis/)
  })

  it("fecha a conexão da fila no sucesso e no erro (producer one-shot)", async () => {
    await runHoroscopeGenerationJob()
    expect(queueMock.closeHoroscopeQueue).toHaveBeenCalledTimes(1)

    vi.clearAllMocks()
    queueMock.enqueueHoroscopeGeneration.mockRejectedValue(
      new Error("redis down"),
    )
    await expect(runHoroscopeGenerationJob()).rejects.toThrow(/redis/)
    expect(queueMock.closeHoroscopeQueue).toHaveBeenCalledTimes(1)
  })
})
