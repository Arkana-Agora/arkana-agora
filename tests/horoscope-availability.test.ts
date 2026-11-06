import { beforeEach, describe, expect, it, vi } from "vitest"

const prismaMock = vi.hoisted(() => ({
  horoscopeContent: { findMany: vi.fn() },
}))
const analyticsMock = vi.hoisted(() => ({
  trackHoroscopeMissing: vi.fn(),
}))

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }))
vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))
vi.mock("@/lib/server-analytics", () => analyticsMock)

import {
  HOROSCOPE_AVAILABILITY_CRON,
  runHoroscopeAvailabilityCheck,
} from "@/jobs/horoscope-availability-check"
import { civilDateBrt } from "@/lib/horoscopes/dates"
import { WESTERN_SIGNS } from "@/lib/horoscopes/western"
import { logger } from "@/lib/logger"

// T145 (AC-24/RNF-HORO-001): às 06:00 BRT (cron `0 9 * * *` em UTC) o
// conteúdo diário ocidental deve existir para os 12 signos após o cron de
// geração das 04:00 BRT. Ausência → logger.warn + evento PostHog
// `horoscope_missing` (telemetria de sistema, CHK017); presença → log
// explícito de sucesso (não silencioso). Data pela key civil BRT (Q25).

beforeEach(() => {
  vi.clearAllMocks()
  analyticsMock.trackHoroscopeMissing.mockResolvedValue(undefined)
  prismaMock.horoscopeContent.findMany.mockResolvedValue([])
})

describe("runHoroscopeAvailabilityCheck (T145)", () => {
  it("cron 06:00 BRT publicado como 09:00 UTC (Vercel cron é UTC)", () => {
    expect(HOROSCOPE_AVAILABILITY_CRON).toBe("0 9 * * *")
  })

  it("consulta western daily da data civil BRT corrente", async () => {
    await runHoroscopeAvailabilityCheck()

    expect(prismaMock.horoscopeContent.findMany).toHaveBeenCalledWith({
      where: { type: "western", period: "daily", date: civilDateBrt(0) },
      select: { signId: true, content: true },
    })
  })

  it("12/12 presentes: summary completo + log de sucesso + sem evento", async () => {
    prismaMock.horoscopeContent.findMany.mockResolvedValue(
      WESTERN_SIGNS.map((sign) => ({ signId: sign.id })),
    )

    const summary = await runHoroscopeAvailabilityCheck()

    expect(summary).toEqual({
      date: civilDateBrt(0),
      checked: 12,
      present: 12,
      missing: [],
    })
    expect(logger.info).toHaveBeenCalled()
    expect(logger.warn).not.toHaveBeenCalled()
    expect(analyticsMock.trackHoroscopeMissing).not.toHaveBeenCalled()
  })

  it("ausências → logger.warn + evento horoscope_missing com signIds e data", async () => {
    const date = civilDateBrt(0)
    prismaMock.horoscopeContent.findMany.mockResolvedValue(
      WESTERN_SIGNS.filter((sign) => sign.id !== "aries").map((s) => ({
        signId: s.id,
      })),
    )

    const summary = await runHoroscopeAvailabilityCheck()

    expect(summary.missing).toEqual(["aries"])
    expect(summary.present).toBe(11)
    expect(logger.warn).toHaveBeenCalled()
    expect(analyticsMock.trackHoroscopeMissing).toHaveBeenCalledWith(
      ["aries"],
      date,
    )
  })

  it("rows com fallback T032 contam como ausentes (falha do worker T098)", async () => {
    const date = civilDateBrt(0)
    prismaMock.horoscopeContent.findMany.mockResolvedValue(
      WESTERN_SIGNS.map((sign) => ({
        signId: sign.id,
        content: { fallback: true, date },
      })),
    )

    const summary = await runHoroscopeAvailabilityCheck()

    expect(summary.present).toBe(0)
    expect(summary.missing).toHaveLength(12)
    expect(logger.warn).toHaveBeenCalled()
    expect(analyticsMock.trackHoroscopeMissing).toHaveBeenCalledWith(
      expect.arrayContaining(["aries", "peixes"]),
      date,
    )
  })

  it("falha da telemetria PostHog nunca derruba o cron", async () => {
    analyticsMock.trackHoroscopeMissing.mockRejectedValue(
      new Error("posthog down"),
    )
    prismaMock.horoscopeContent.findMany.mockResolvedValue([])

    await expect(runHoroscopeAvailabilityCheck()).resolves.toMatchObject({
      checked: 12,
      missing: expect.arrayContaining(["aries", "peixes"]),
    })
  })

  it("propaga falha do banco para o cron responder 500", async () => {
    prismaMock.horoscopeContent.findMany.mockRejectedValue(new Error("db down"))

    await expect(runHoroscopeAvailabilityCheck()).rejects.toThrow(/db down/)
  })
})
