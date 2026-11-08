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

  it("enfileira 12 signos ocidentais + 60 combos chineses × 3 períodos quando não há rows", async () => {
    const summary = await runHoroscopeGenerationJob("req-1")

    // 12 western × 3 + 60 chinese × 3 = 36 + 180 = 216
    expect(summary).toEqual({
      date: civilDateBrt(0),
      checked: 216,
      existing: 0,
      enqueued: 216,
    })
    expect(queueMock.enqueueHoroscopeGeneration).toHaveBeenCalledTimes(216)
    // 3 períodos × 2 tipos (western + chinese) = 6 chamadas findMany
    expect(prismaMock.horoscopeContent.findMany).toHaveBeenCalledTimes(6)
  })

  it("usa date civil BRT plano (YYYY-MM-DD) em todos os jobs, inclusive weekly/monthly", async () => {
    await runHoroscopeGenerationJob()

    const date = civilDateBrt(0)
    expect(date).toMatch(/^\d{4}-\d{2}-\d{2}$/)

    const calls = queueMock.enqueueHoroscopeGeneration.mock.calls
    // 12 western × 3 + 60 chinese × 3 = 216
    expect(calls).toHaveLength(216)

    // Verifica jobs ocidentais
    const westernCalls = calls.filter(([job]) => job.type === "western")
    expect(westernCalls).toHaveLength(36)
    for (const [job] of westernCalls) {
      expect(job.date).toBe(date)
      expect(job.element).toBeUndefined()
    }

    // Verifica jobs chineses
    const chineseCalls = calls.filter(([job]) => job.type === "chinese")
    expect(chineseCalls).toHaveLength(180)
    for (const [job] of chineseCalls) {
      expect(job.date).toBe(date)
      expect(job.element).toBeDefined()
    }

    const periods = calls.map(([job]) => job.period)
    // 12 western + 60 chinese = 72 per period
    expect(periods.filter((p) => p === "daily")).toHaveLength(72)
    expect(periods.filter((p) => p === "weekly")).toHaveLength(72)
    expect(periods.filter((p) => p === "monthly")).toHaveLength(72)

    const dailySignIds = new Set(
      calls
        .filter(([job]) => job.period === "daily" && job.type === "western")
        .map(([job]) => job.signId),
    )
    expect(dailySignIds.size).toBe(12)
    expect(dailySignIds.has("aries")).toBe(true)
    expect(dailySignIds.has("peixes")).toBe(true)
  })

  it("consulta por período com a ROW key correta (flat/Wxx/YYYY-MM) para western e chinese", async () => {
    await runHoroscopeGenerationJob()

    const date = civilDateBrt(0)
    const wheres = prismaMock.horoscopeContent.findMany.mock.calls.map(
      ([args]) => args.where,
    )
    // 6 chamadas: 3 períodos × 2 tipos (western + chinese por período)
    expect(wheres).toHaveLength(6)
    // Ordem: daily western, daily chinese, weekly western, weekly chinese, monthly western, monthly chinese
    expect(wheres[0]).toEqual({
      type: "western",
      period: "daily",
      date: periodRowKey("daily", date),
    })
    expect(wheres[1]).toEqual({
      type: "chinese",
      period: "daily",
      date: periodRowKey("daily", date),
    })
    expect(wheres[2]).toEqual({
      type: "western",
      period: "weekly",
      date: periodRowKey("weekly", date),
    })
    expect(wheres[3]).toEqual({
      type: "chinese",
      period: "weekly",
      date: periodRowKey("weekly", date),
    })
    expect(wheres[4]).toEqual({
      type: "western",
      period: "monthly",
      date: periodRowKey("monthly", date),
    })
    expect(wheres[5]).toEqual({
      type: "chinese",
      period: "monthly",
      date: periodRowKey("monthly", date),
    })
    // daily = plana; weekly/mês diferem da plana
    expect(wheres[0]?.date).toBe(date)
    expect(wheres[2]?.date).not.toBe(date)
    expect(wheres[4]?.date).not.toBe(date)
  })

  it("pula rows já geradas e enfileira ausentes + fallbacks (western + chinese)", async () => {
    const date = civilDateBrt(0)
    // Western daily: 12 geradas (pulam); Western weekly: 12 fallback (re-enfileiram)
    // Chinese daily: 60 geradas (pulam); Chinese weekly: 60 fallback (re-enfileiram)
    // Western monthly: nenhuma; Chinese monthly: nenhuma
    const dailyWesternRows = WESTERN_SIGNS.map((s) => ({
      signId: s.id,
      content: { fallback: false, date },
    }))
    const weeklyWesternRows = WESTERN_SIGNS.map((s) => ({
      signId: s.id,
      content: { fallback: true, date },
    }))
    const { CHINESE_COMBOS } = await import("@/lib/horoscopes/fallback")
    const dailyChineseRows = CHINESE_COMBOS.map((c) => ({
      signId: c.animalId,
      element: c.element,
      content: { fallback: false, date },
    }))
    const weeklyChineseRows = CHINESE_COMBOS.map((c) => ({
      signId: c.animalId,
      element: c.element,
      content: { fallback: true, date },
    }))

    prismaMock.horoscopeContent.findMany
      .mockResolvedValueOnce(dailyWesternRows) // western daily
      .mockResolvedValueOnce(dailyChineseRows) // chinese daily
      .mockResolvedValueOnce(weeklyWesternRows) // western weekly
      .mockResolvedValueOnce(weeklyChineseRows) // chinese weekly
      .mockResolvedValueOnce([]) // western monthly
      .mockResolvedValueOnce([]) // chinese monthly

    const summary = await runHoroscopeGenerationJob()

    // Checked: 12×3 + 60×3 = 216
    // Existing: 12 western daily + 60 chinese daily = 72
    // Enqueued: 12 western weekly + 60 chinese weekly + 12 western monthly + 60 chinese monthly = 144
    expect(summary).toEqual({
      date,
      checked: 216,
      existing: 72,
      enqueued: 144,
    })
    expect(queueMock.enqueueHoroscopeGeneration).toHaveBeenCalledTimes(144)

    const enqueuedDaily =
      queueMock.enqueueHoroscopeGeneration.mock.calls.filter(
        ([job]) => job.period === "daily",
      )
    expect(enqueuedDaily).toHaveLength(0)

    const enqueuedWeekly =
      queueMock.enqueueHoroscopeGeneration.mock.calls.filter(
        ([job]) => job.period === "weekly",
      )
    // 12 western + 60 chinese = 72
    expect(enqueuedWeekly).toHaveLength(72)

    const enqueuedMonthly =
      queueMock.enqueueHoroscopeGeneration.mock.calls.filter(
        ([job]) => job.period === "monthly",
      )
    // 12 western + 60 chinese = 72
    expect(enqueuedMonthly).toHaveLength(72)
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
