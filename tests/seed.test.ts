import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { getChineseZodiac } from "@/lib/horoscopes/chinese"
import { civilDateBrt, civilIsoWeek, civilMonth } from "@/lib/horoscopes/dates"
import { WESTERN_SIGNS } from "@/lib/horoscopes/western"

const prismaMock = vi.hoisted(() => ({
  user: { upsert: vi.fn() },
  horoscopeContent: { findMany: vi.fn(), createMany: vi.fn() },
  horoscopeNotification: { upsert: vi.fn() },
}))

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }))

import {
  buildChineseFallback,
  buildMayaFallback,
  buildWesternFallback,
  CHINESE_COMBOS,
  MAYAN_KIN_COUNT,
  seed,
  seedHoroscopeFallbacks,
  seedHoroscopeNotifications,
} from "../prisma/seed"

const ADMIN_EMAIL = "admin@arkanaagora.dev"
const TEST_EMAIL = "test@arkanaagora.dev"

const TOTAL_FALLBACK_ROWS =
  (2 /* daily */ + 1 /* weekly */ + 1) /* monthly */ *
  (WESTERN_SIGNS.length + CHINESE_COMBOS.length + MAYAN_KIN_COUNT) // 1328

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, "log").mockImplementation(() => {})
  prismaMock.user.upsert
    .mockResolvedValueOnce({ id: "usr_admin", email: ADMIN_EMAIL })
    .mockResolvedValueOnce({ id: "usr_test", email: TEST_EMAIL })
  prismaMock.horoscopeContent.findMany.mockResolvedValue([])
  prismaMock.horoscopeContent.createMany.mockResolvedValue({ count: 24 })
  prismaMock.horoscopeNotification.upsert.mockResolvedValue({})
})

afterEach(() => {
  vi.restoreAllMocks()
})

function allFallbackRows() {
  const rows: Array<{
    type: string
    signId: string
    element: string | null
    period: string
    date: string
  }> = []
  const datesByPeriod: Array<[string, string[]]> = [
    ["daily", [civilDateBrt(0), civilDateBrt(1)]],
    ["weekly", [civilIsoWeek()]],
    ["monthly", [civilMonth()]],
  ]
  for (const [period, dates] of datesByPeriod) {
    for (const date of dates) {
      for (const sign of WESTERN_SIGNS) {
        rows.push({
          type: "western",
          signId: sign.id,
          element: null,
          period,
          date,
        })
      }
      for (const combo of CHINESE_COMBOS) {
        rows.push({
          type: "chinese",
          signId: combo.animalId,
          element: combo.element,
          period,
          date,
        })
      }
      for (let kin = 1; kin <= MAYAN_KIN_COUNT; kin++) {
        rows.push({
          type: "maya",
          signId: String(kin),
          element: null,
          period,
          date,
        })
      }
    }
  }
  return rows
}

describe("civilDateBrt (T017)", () => {
  it("formata a data civil de hoje em America/Sao_Paulo (YYYY-MM-DD)", () => {
    const nowSpy = vi
      .spyOn(Date, "now")
      .mockReturnValue(Date.UTC(2026, 8, 26, 12))
    expect(civilDateBrt()).toBe("2026-09-26")
    nowSpy.mockRestore()
  })

  it("usa o fuso BRT e não o UTC (23h BRT = mesmo dia BRT, dia seguinte UTC)", () => {
    // 2026-09-27T02:00Z = 2026-09-26 23:00 BRT
    const nowSpy = vi
      .spyOn(Date, "now")
      .mockReturnValue(Date.UTC(2026, 8, 27, 2))
    expect(civilDateBrt()).toBe("2026-09-26")
    expect(civilDateBrt(1)).toBe("2026-09-27")
    nowSpy.mockRestore()
  })
})

describe("buildWesternFallback (T017)", () => {
  it("gera conteúdo completo para os 12 signos", () => {
    const date = "2026-09-26"
    WESTERN_SIGNS.forEach((sign, index) => {
      const content = buildWesternFallback(index, date)
      expect(Object.keys(content).sort()).toEqual(
        [
          "career",
          "compatibility",
          "date",
          "fallback",
          "general",
          "health",
          "love",
          "luckyColor",
          "luckyNumber",
          "mood",
        ].sort(),
      )
      expect(content.date).toBe(date)
      expect(content.fallback).toBe(true)
      expect(content.luckyNumber).toBeGreaterThanOrEqual(1)
      expect(content.luckyNumber).toBeLessThanOrEqual(99)
      expect(content.general.startsWith(`${sign.name}:`)).toBe(true)
      expect(content.love.startsWith(`${sign.name}:`)).toBe(true)
      expect(content.career.startsWith(`${sign.name}:`)).toBe(true)
      expect(content.health.startsWith(`${sign.name}:`)).toBe(true)
      const next = WESTERN_SIGNS[(index + 1) % WESTERN_SIGNS.length]!
      expect(content.compatibility).toBe(next.id)
    })
  })

  it("luckyNumber é determinístico por signo (mesmo índice → mesmo número)", () => {
    expect(buildWesternFallback(0, "2026-09-26").luckyNumber).toBe(
      buildWesternFallback(0, "2026-09-27").luckyNumber,
    )
    expect(buildWesternFallback(0, "2026-09-26").luckyColor).toBe(
      buildWesternFallback(0, "2026-09-27").luckyColor,
    )
  })
})

describe("seedHoroscopeFallbacks (T017 + T032)", () => {
  it("cria 1328 rows (western 48 + chinese 240 + maya 1040) quando não existem", async () => {
    await seedHoroscopeFallbacks()

    const dates = [
      civilDateBrt(0),
      civilDateBrt(1),
      civilIsoWeek(),
      civilMonth(),
    ]
    expect(prismaMock.horoscopeContent.findMany).toHaveBeenCalledTimes(1)
    expect(prismaMock.horoscopeContent.createMany).toHaveBeenCalledTimes(1)
    expect(prismaMock.horoscopeContent.createMany).toHaveBeenCalledWith(
      expect.objectContaining({ skipDuplicates: true }),
    )

    const rows = prismaMock.horoscopeContent.createMany.mock.calls[0]![0]
      .data as Array<Record<string, unknown>>
    expect(rows).toHaveLength(TOTAL_FALLBACK_ROWS)

    const byType = (type: string) => rows.filter((row) => row.type === type)
    expect(byType("western")).toHaveLength(48) // 12 × 4 dates
    expect(byType("chinese")).toHaveLength(240) // 60 × 4
    expect(byType("maya")).toHaveLength(1040) // 260 × 4

    const byPeriod = (period: string) =>
      rows.filter((row) => row.period === period)
    expect(byPeriod("daily")).toHaveLength(664) // 332 × 2 dias
    expect(byPeriod("weekly")).toHaveLength(332)
    expect(byPeriod("monthly")).toHaveLength(332)

    expect([...new Set(rows.map((row) => row.date))].sort()).toEqual(
      [...dates].sort(),
    )
    expect([
      ...new Set(byType("western").map((row) => row.signId)),
    ]).toHaveLength(12)
    expect([
      ...new Set(
        byType("chinese").map((row) => `${row.signId}|${row.element}`),
      ),
    ]).toHaveLength(60)
    expect([...new Set(byType("maya").map((row) => row.signId))]).toHaveLength(
      260,
    )

    for (const row of rows) {
      expect(row.element).toEqual(
        row.type === "chinese" ? expect.any(String) : null,
      )
      expect(row.content).toMatchObject({ fallback: true, date: row.date })
    }
  })

  it("é idempotente: não recria rows já existentes", async () => {
    prismaMock.horoscopeContent.findMany.mockResolvedValue(allFallbackRows())

    await seedHoroscopeFallbacks()

    expect(prismaMock.horoscopeContent.createMany).not.toHaveBeenCalled()
  })

  it("cria apenas as combinações ausentes (caso parcial)", async () => {
    prismaMock.horoscopeContent.findMany.mockResolvedValue(
      allFallbackRows().slice(0, 2),
    )

    await seedHoroscopeFallbacks()

    const rows = prismaMock.horoscopeContent.createMany.mock.calls[0]![0]
      .data as unknown[]
    expect(rows).toHaveLength(TOTAL_FALLBACK_ROWS - 2)
  })
})

describe("buildChineseFallback (T032: 60 combos)", () => {
  it("cobre 60 combinações únicas animal+elemento", () => {
    const combos = CHINESE_COMBOS.map(
      (combo, index) =>
        `${buildChineseFallback(index, "2026-09-26").signId}|${combo.element}`,
    )
    expect(combos).toHaveLength(60)
    expect(new Set(combos).size).toBe(60)
  })

  it("gera conteúdo completo, determinístico e com fallback", () => {
    const a = buildChineseFallback(7, "2026-09-26")
    const b = buildChineseFallback(7, "2026-09-27")
    expect(a.element).toBe(CHINESE_COMBOS[7]!.element)
    expect(a.content.fallback).toBe(true)
    expect(a.content.general).toContain(":")
    expect(a.content.luckyNumber).toBe(b.content.luckyNumber)
    expect(a.content.luckyColor).toBe(b.content.luckyColor)
  })

  it("buildChineseFallback usa a tabela CHINESE_COMBOS como fonte", () => {
    CHINESE_COMBOS.forEach((combo, index) => {
      const fallback = buildChineseFallback(index, "2026-09-26")
      expect(fallback.signId).toBe(combo.animalId)
      expect(fallback.element).toBe(combo.element)
    })
  })

  it("CHINESE_COMBOS espelha chinese.ts: (animal, elemento) de cada ano 1984+y", () => {
    for (let y = 0; y < CHINESE_COMBOS.length; y++) {
      // Julho: sempre dentro do ano chinês (CNY cai entre jan/fev).
      const zodiac = getChineseZodiac(1984 + y, 7, 1)
      expect(CHINESE_COMBOS[y]!.animalId).toBe(zodiac.animal)
      expect(CHINESE_COMBOS[y]!.element).toBe(zodiac.element)
    }
  })
})

describe("buildMayaFallback (T032: 260 kins)", () => {
  it("gera conteúdo para todos os 260 kins com signId numérico", () => {
    const colors = new Set<string>()
    for (let kin = 1; kin <= MAYAN_KIN_COUNT; kin++) {
      const fallback = buildMayaFallback(kin, "2026-09")
      expect(fallback.signId).toBe(String(kin))
      expect(fallback.content.fallback).toBe(true)
      expect(fallback.content.general).toContain(`Kin ${kin} (`)
      colors.add(fallback.content.luckyColor)
    }
    expect(colors.size).toBeGreaterThan(1) // cores variam por selo
  })

  it("rejeita kin fora de 1-260", () => {
    expect(() => buildMayaFallback(0, "2026-09")).toThrow(/Kin/)
    expect(() => buildMayaFallback(261, "2026-09")).toThrow(/Kin/)
  })
})

describe("civilIsoWeek/civilMonth (T032/Q25)", () => {
  it("formata a semana ISO e o mês corrente no fuso BRT", () => {
    const nowSpy = vi
      .spyOn(Date, "now")
      .mockReturnValue(Date.UTC(2026, 8, 26, 12))
    expect(civilIsoWeek()).toBe("2026-W39")
    expect(civilMonth()).toBe("2026-09")
    nowSpy.mockRestore()
  })
})

describe("buildWesternFallback com period (T032)", () => {
  it("default daily preserva o contrato diário", () => {
    expect(buildWesternFallback(0, "2026-09-26")).toEqual(
      buildWesternFallback(0, "2026-09-26", "daily"),
    )
  })

  it("weekly e monthly diferem do daily", () => {
    const daily = buildWesternFallback(0, "2026-09", "daily").general
    const weekly = buildWesternFallback(0, "2026-W39", "weekly").general
    const monthly = buildWesternFallback(0, "2026-09", "monthly").general
    expect(weekly).toContain("nesta semana")
    expect(monthly).toContain("neste mês")
    expect(weekly).not.toBe(daily)
    expect(monthly).not.toBe(weekly)
  })
})

describe("seedHoroscopeNotifications (T017)", () => {
  it("faz upsert por usuário com defaults (update: {} não sobrescreve)", async () => {
    await seedHoroscopeNotifications(["usr_a", "usr_b"])

    expect(prismaMock.horoscopeNotification.upsert).toHaveBeenCalledTimes(2)
    expect(prismaMock.horoscopeNotification.upsert).toHaveBeenNthCalledWith(1, {
      where: { userId: "usr_a" },
      update: {},
      create: { userId: "usr_a" },
    })
    expect(prismaMock.horoscopeNotification.upsert).toHaveBeenNthCalledWith(2, {
      where: { userId: "usr_b" },
      update: {},
      create: { userId: "usr_b" },
    })
  })
})

describe("seed (T017)", () => {
  it("upserta admin/test, notificações e fallbacks", async () => {
    await seed()

    expect(prismaMock.user.upsert).toHaveBeenCalledTimes(2)
    expect(prismaMock.user.upsert.mock.calls[0]![0].where).toEqual({
      email: ADMIN_EMAIL,
    })
    expect(prismaMock.user.upsert.mock.calls[1]![0].where).toEqual({
      email: TEST_EMAIL,
    })

    const notificationCalls =
      prismaMock.horoscopeNotification.upsert.mock.calls.map(
        (call) => call[0].where.userId,
      )
    expect(notificationCalls).toEqual(["usr_admin", "usr_test"])

    expect(prismaMock.horoscopeContent.findMany).toHaveBeenCalledTimes(1)
    expect(prismaMock.horoscopeContent.createMany).toHaveBeenCalledTimes(1)
  })
})
