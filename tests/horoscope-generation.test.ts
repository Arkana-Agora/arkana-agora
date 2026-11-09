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
import { CHINESE_COMBOS } from "@/lib/horoscopes/fallback"
import { MAYAN_KIN_COUNT } from "@/lib/horoscopes/maya"

// T097/T100 — cron de geração de horóscopo (04:00 BRT): enfileira na fila
// BullMQ T033 apenas os jobs sem conteúdo GERADO (ausente ou fallback T032)
// para a data civil BRT corrente. O worker T098 faz skip se a row já foi
// gerada — o jobId determinístico (T033) deduplica re-enfileiramentos.
// Total jobs: 12 western × 3 + 60 chinese × 3 + 260 maya × 3 = 996

const TOTAL_WESTERN = WESTERN_SIGNS.length * 3 // 36
const TOTAL_CHINESE = CHINESE_COMBOS.length * 3 // 180
const TOTAL_MAYA = MAYAN_KIN_COUNT * 3 // 780
const TOTAL_JOBS = TOTAL_WESTERN + TOTAL_CHINESE + TOTAL_MAYA // 996
const FIND_MANY_CALLS = 3 * 3 // 3 periods × 3 types = 9

beforeEach(() => {
  vi.clearAllMocks()
  prismaMock.horoscopeContent.findMany.mockResolvedValue([])
  queueMock.enqueueHoroscopeGeneration.mockResolvedValue("job-id")
})

describe("runHoroscopeGenerationJob (T097)", () => {
  it("cron 04:00 BRT publicado como 07:00 UTC (Vercel cron é UTC)", () => {
    expect(HOROSCOPE_GENERATION_CRON).toBe("0 7 * * *")
  })

  it("enfileira 12 signos ocidentais + 60 combos chineses + 260 kins maias × 3 períodos quando não há rows", async () => {
    const summary = await runHoroscopeGenerationJob("req-1")

    // 12 western × 3 + 60 chinese × 3 + 260 maya × 3 = 36 + 180 + 780 = 996
    expect(summary).toEqual({
      date: civilDateBrt(0),
      checked: TOTAL_JOBS,
      existing: 0,
      enqueued: TOTAL_JOBS,
    })
    expect(queueMock.enqueueHoroscopeGeneration).toHaveBeenCalledTimes(
      TOTAL_JOBS,
    )
    // 3 períodos × 3 tipos (western + chinese + maya) = 9 chamadas findMany
    expect(prismaMock.horoscopeContent.findMany).toHaveBeenCalledTimes(
      FIND_MANY_CALLS,
    )
  })

  it("usa date civil BRT plano (YYYY-MM-DD) em todos os jobs, inclusive weekly/monthly", async () => {
    await runHoroscopeGenerationJob()

    const date = civilDateBrt(0)
    expect(date).toMatch(/^\d{4}-\d{2}-\d{2}$/)

    const calls = queueMock.enqueueHoroscopeGeneration.mock.calls
    // 12 western × 3 + 60 chinese × 3 + 260 maya × 3 = 996
    expect(calls).toHaveLength(TOTAL_JOBS)

    // Verifica jobs ocidentais
    const westernCalls = calls.filter(([job]) => job.type === "western")
    expect(westernCalls).toHaveLength(TOTAL_WESTERN)
    for (const [job] of westernCalls) {
      expect(job.date).toBe(date)
      expect(job.element).toBeUndefined()
    }

    // Verifica jobs chineses
    const chineseCalls = calls.filter(([job]) => job.type === "chinese")
    expect(chineseCalls).toHaveLength(TOTAL_CHINESE)
    for (const [job] of chineseCalls) {
      expect(job.date).toBe(date)
      expect(job.element).toBeDefined()
    }

    // Verifica jobs maias
    const mayaCalls = calls.filter(([job]) => job.type === "maya")
    expect(mayaCalls).toHaveLength(TOTAL_MAYA)
    for (const [job] of mayaCalls) {
      expect(job.date).toBe(date)
      expect(job.element).toBeUndefined()
      expect(job.signId).toBeDefined()
    }

    const periods = calls.map(([job]) => job.period)
    // 12 western + 60 chinese + 260 maya = 332 per period
    const PER_PERIOD = TOTAL_WESTERN / 3 + TOTAL_CHINESE / 3 + TOTAL_MAYA / 3
    expect(periods.filter((p) => p === "daily")).toHaveLength(PER_PERIOD)
    expect(periods.filter((p) => p === "weekly")).toHaveLength(PER_PERIOD)
    expect(periods.filter((p) => p === "monthly")).toHaveLength(PER_PERIOD)

    const dailySignIds = new Set(
      calls
        .filter(([job]) => job.period === "daily" && job.type === "western")
        .map(([job]) => job.signId),
    )
    expect(dailySignIds.size).toBe(12)
    expect(dailySignIds.has("aries")).toBe(true)
    expect(dailySignIds.has("peixes")).toBe(true)
  })

  it("consulta por período com a ROW key correta (flat/Wxx/YYYY-MM) para western, chinese e maya", async () => {
    await runHoroscopeGenerationJob()

    const date = civilDateBrt(0)
    const wheres = prismaMock.horoscopeContent.findMany.mock.calls.map(
      ([args]) => args.where,
    )
    // 9 chamadas: 3 períodos × 3 tipos (western + chinese + maya por período)
    expect(wheres).toHaveLength(FIND_MANY_CALLS)
    // Ordem: daily western, daily chinese, daily maya, weekly western, weekly chinese, weekly maya, monthly western, monthly chinese, monthly maya
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
      type: "maya",
      period: "daily",
      date: periodRowKey("daily", date),
    })
    expect(wheres[3]).toEqual({
      type: "western",
      period: "weekly",
      date: periodRowKey("weekly", date),
    })
    expect(wheres[4]).toEqual({
      type: "chinese",
      period: "weekly",
      date: periodRowKey("weekly", date),
    })
    expect(wheres[5]).toEqual({
      type: "maya",
      period: "weekly",
      date: periodRowKey("weekly", date),
    })
    expect(wheres[6]).toEqual({
      type: "western",
      period: "monthly",
      date: periodRowKey("monthly", date),
    })
    expect(wheres[7]).toEqual({
      type: "chinese",
      period: "monthly",
      date: periodRowKey("monthly", date),
    })
    expect(wheres[8]).toEqual({
      type: "maya",
      period: "monthly",
      date: periodRowKey("monthly", date),
    })
    // daily = plana; weekly/mês diferem da plana
    expect(wheres[0]?.date).toBe(date)
    expect(wheres[3]?.date).not.toBe(date)
    expect(wheres[6]?.date).not.toBe(date)
  })

  it("pula rows já geradas e enfileira ausentes + fallbacks (western + chinese + maya)", async () => {
    const date = civilDateBrt(0)
    // Western daily: 12 geradas (pulam); Western weekly: 12 fallback (re-enfileiram)
    // Chinese daily: 60 geradas (pulam); Chinese weekly: 60 fallback (re-enfileiram)
    // Maya daily: 260 geradas (pulam); Maya weekly: 260 fallback (re-enfileiram)
    // Western monthly: nenhuma; Chinese monthly: nenhuma; Maya monthly: nenhuma
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
    const { MAYAN_KIN_COUNT } = await import("@/lib/horoscopes/maya")
    const dailyMayaRows = Array.from({ length: MAYAN_KIN_COUNT }, (_, i) => ({
      signId: String(i + 1),
      content: { fallback: false, date },
    }))
    const weeklyMayaRows = Array.from({ length: MAYAN_KIN_COUNT }, (_, i) => ({
      signId: String(i + 1),
      content: { fallback: true, date },
    }))

    prismaMock.horoscopeContent.findMany
      .mockResolvedValueOnce(dailyWesternRows) // western daily
      .mockResolvedValueOnce(dailyChineseRows) // chinese daily
      .mockResolvedValueOnce(dailyMayaRows) // maya daily
      .mockResolvedValueOnce(weeklyWesternRows) // western weekly
      .mockResolvedValueOnce(weeklyChineseRows) // chinese weekly
      .mockResolvedValueOnce(weeklyMayaRows) // maya weekly
      .mockResolvedValueOnce([]) // western monthly
      .mockResolvedValueOnce([]) // chinese monthly
      .mockResolvedValueOnce([]) // maya monthly

    const summary = await runHoroscopeGenerationJob()

    // Checked: 12×3 + 60×3 + 260×3 = 996
    // Existing: 12 western daily + 60 chinese daily + 260 maya daily = 332
    // Enqueued: 12 western weekly + 60 chinese weekly + 260 maya weekly + 12 western monthly + 60 chinese monthly + 260 maya monthly = 664
    expect(summary).toEqual({
      date,
      checked: TOTAL_JOBS,
      existing: 332,
      enqueued: 664,
    })
    expect(queueMock.enqueueHoroscopeGeneration).toHaveBeenCalledTimes(664)

    const enqueuedDaily =
      queueMock.enqueueHoroscopeGeneration.mock.calls.filter(
        ([job]) => job.period === "daily",
      )
    expect(enqueuedDaily).toHaveLength(0)

    const enqueuedWeekly =
      queueMock.enqueueHoroscopeGeneration.mock.calls.filter(
        ([job]) => job.period === "weekly",
      )
    // 12 western + 60 chinese + 260 maya = 332
    expect(enqueuedWeekly).toHaveLength(332)

    const enqueuedMonthly =
      queueMock.enqueueHoroscopeGeneration.mock.calls.filter(
        ([job]) => job.period === "monthly",
      )
    // 12 western + 60 chinese + 260 maya = 332
    expect(enqueuedMonthly).toHaveLength(332)
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
