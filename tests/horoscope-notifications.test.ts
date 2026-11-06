import { readFileSync } from "node:fs"
import { join } from "node:path"
import { beforeEach, describe, expect, it, vi } from "vitest"

const prismaMock = vi.hoisted(() => ({
  horoscopeNotification: { findMany: vi.fn() },
  notification: { findFirst: vi.fn(), create: vi.fn() },
  horoscopeContent: { findFirst: vi.fn() },
}))

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }))
vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))
vi.mock("@/lib/horoscopes/dates", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/horoscopes/dates")>()),
  civilHourBrt: vi.fn(() => 7),
  civilDateBrt: vi.fn(() => "2026-10-20"),
}))

import {
  HOROSCOPE_NOTIFICATIONS_CRON,
  HOROSCOPE_NOTIFICATIONS_INTERVAL_MS,
  runHoroscopeNotifications,
} from "@/jobs/horoscope-notifications"
import { getChineseZodiac } from "@/lib/horoscopes/chinese"

// T102/T100 — cron horário de notificações de horóscopo (RF-HORO-008/SC19):
// filtra `HoroscopeNotification.hour` = hora civil BRT atual (default 7) e
// cria `Notification` rows in-app por sistema habilitado (toggles). Roda no
// services/worker (intervalo horário) — NUNCA no vercel.json: o Vercel
// Hobby rejeita cron < 1 dia e falha o deploy (SC34, confirmado pelo dono).

const BIRTH_1995_03_15 = new Date("1995-03-15T12:00:00.000Z")

function config(overrides: Record<string, unknown>) {
  return {
    userId: "u1",
    westernEnabled: true,
    chineseEnabled: false,
    mayaEnabled: false,
    user: { birthDate: BIRTH_1995_03_15, astrologicalSign: null },
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  prismaMock.horoscopeNotification.findMany.mockResolvedValue([])
  prismaMock.notification.findFirst.mockResolvedValue(null)
  prismaMock.notification.create.mockResolvedValue({ id: "n1" })
  prismaMock.horoscopeContent.findFirst.mockResolvedValue(null)
})

describe("constantes do tick horário (T102)", () => {
  it("cadência horária em ms (hour 0-23 BRT, RF-HORO-008)", () => {
    expect(HOROSCOPE_NOTIFICATIONS_INTERVAL_MS).toBe(60 * 60 * 1000)
    expect(HOROSCOPE_NOTIFICATIONS_CRON).toBe("0 * * * *")
  })

  it("NÃO registra cron horário no vercel.json (Hobby falha deploy — SC34)", () => {
    const vercel = JSON.parse(
      readFileSync(join(__dirname, "..", "vercel.json"), "utf8"),
    ) as { crons?: Array<{ path: string; schedule: string }> }

    for (const cron of vercel.crons ?? []) {
      expect(cron.path).not.toContain("horoscope-notifications")
      // nenhum schedule abaixo de 1 dia entre execuções
      expect(cron.schedule).not.toMatch(/^(\*|\/|\d+\/\d+|\d+-\d+ )/)
      expect(cron.schedule.split(" ")[0]).toMatch(/^\d+$|^\d+ \d+/)
    }
  })
})

describe("runHoroscopeNotifications (T102)", () => {
  it("busca configs com hour = hora BRT atual e qualquer sistema habilitado", async () => {
    await runHoroscopeNotifications("req-1")

    expect(prismaMock.horoscopeNotification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          hour: 7,
          OR: [
            { westernEnabled: true },
            { chineseEnabled: true },
            { mayaEnabled: true },
          ],
        },
      }),
    )
  })

  it("cria Notification ocidental com preview do conteúdo gerado", async () => {
    prismaMock.horoscopeNotification.findMany.mockResolvedValue([config({})])
    prismaMock.horoscopeContent.findFirst.mockResolvedValue({
      content: {
        general:
          "Peixes: dia de escuta. A energia de água pede presença nas escolhas do dia e flui com quem escuta.",
        love: "l",
        career: "c",
        health: "h",
        luckyNumber: 7,
        luckyColor: "azul",
        mood: "sereno",
        compatibility: "touro",
        date: "2026-10-20",
      },
    })

    const summary = await runHoroscopeNotifications()

    expect(summary).toEqual({
      hour: 7,
      candidates: 1,
      created: 1,
      skipped: 0,
    })
    expect(prismaMock.horoscopeContent.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          type: "western",
          signId: "peixes",
          period: "daily",
          date: "2026-10-20",
        }),
      }),
    )
    expect(prismaMock.notification.create).toHaveBeenCalledTimes(1)
    const data = prismaMock.notification.create.mock.calls[0]![0].data
    expect(data.userId).toBe("u1")
    expect(data.type).toBe("horoscope")
    expect(data.message).toContain("ocidental")
    expect(data.message).toContain("2026-10-20")
    expect(data.message).toContain("Peixes: dia de escuta")
    expect(data.data).toEqual({
      system: "western",
      signId: "peixes",
      element: null,
      date: "2026-10-20",
    })
  })

  it("sintetiza fallback T032 quando não há row de conteúdo (conteúdo prévio)", async () => {
    prismaMock.horoscopeNotification.findMany.mockResolvedValue([
      config({
        user: {
          birthDate: new Date("1995-04-01T12:00:00.000Z"),
          astrologicalSign: null,
        },
      }),
    ])
    prismaMock.horoscopeContent.findFirst.mockResolvedValue(null)

    const summary = await runHoroscopeNotifications()

    expect(summary.created).toBe(1)
    const data = prismaMock.notification.create.mock.calls[0]![0].data
    expect(data.data.signId).toBe("aries")
    expect(data.message).toContain("Áries: dia de")
  })

  it("não duplica: já existe notificação de horóscopo hoje para o sistema", async () => {
    prismaMock.horoscopeNotification.findMany.mockResolvedValue([config({})])
    prismaMock.notification.findFirst.mockResolvedValue({ id: "n-old" })

    const summary = await runHoroscopeNotifications()

    expect(summary).toEqual({
      hour: 7,
      candidates: 1,
      created: 0,
      skipped: 1,
    })
    expect(prismaMock.notification.create).not.toHaveBeenCalled()

    // janela = dia civil BRT (00:00 BRT = 03:00 UTC) + sistema no data
    expect(prismaMock.notification.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: "u1",
          type: "horoscope",
          createdAt: { gte: new Date(Date.UTC(2026, 9, 20, 3)) },
          data: { equals: "western", path: ["system"] },
        }),
      }),
    )
  })

  it("respeita os toggles: só sistemas habilitados viram candidatos", async () => {
    prismaMock.horoscopeNotification.findMany.mockResolvedValue([
      config({ westernEnabled: false, chineseEnabled: true }),
    ])
    prismaMock.horoscopeContent.findFirst.mockResolvedValue(null)

    const summary = await runHoroscopeNotifications()

    expect(summary).toEqual({
      hour: 7,
      candidates: 1,
      created: 1,
      skipped: 0,
    })
    expect(prismaMock.notification.create).toHaveBeenCalledTimes(1)
    const data = prismaMock.notification.create.mock.calls[0]![0].data
    expect(data.data.system).toBe("chinese")
    expect(data.data.signId).toBe(getChineseZodiac(1995, 3, 15).animal)
    expect(data.data.element).toBe(getChineseZodiac(1995, 3, 15).element)
    expect(data.message).toContain("chinês")
    expect(
      prismaMock.horoscopeContent.findFirst.mock.calls[0]![0].where.element,
    ).toBe(getChineseZodiac(1995, 3, 15).element)
  })

  it("gera uma notificação por sistema habilitado (western + maya)", async () => {
    prismaMock.horoscopeNotification.findMany.mockResolvedValue([
      config({ mayaEnabled: true }),
    ])

    const summary = await runHoroscopeNotifications()

    expect(summary).toEqual({
      hour: 7,
      candidates: 2,
      created: 2,
      skipped: 0,
    })
    const systems = prismaMock.notification.create.mock.calls.map(
      (call) => call[0].data.data.system,
    )
    expect(systems).toEqual(["western", "maya"])
  })

  it("sem birthDate: chinês/maia pulam; ocidental usa astrologicalSign", async () => {
    prismaMock.horoscopeNotification.findMany.mockResolvedValue([
      config({
        chineseEnabled: true,
        mayaEnabled: true,
        user: { birthDate: null, astrologicalSign: "Gêmeos" },
      }),
    ])

    const summary = await runHoroscopeNotifications()

    expect(summary).toEqual({
      hour: 7,
      candidates: 3,
      created: 1,
      skipped: 2,
    })
    const created = prismaMock.notification.create.mock.calls[0]![0].data
    expect(created.data).toEqual({
      system: "western",
      signId: "gemeos",
      element: null,
      date: "2026-10-20",
    })
  })
})
