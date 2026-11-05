import "dotenv/config"

import { pathToFileURL } from "node:url"

import { civilDateBrt, civilIsoWeek, civilMonth } from "@/lib/horoscopes/dates"
import {
  CHINESE_COMBOS,
  MAYAN_KIN_COUNT,
  buildChineseFallback,
  buildMayaFallback,
  buildWesternFallback,
  contentDateFor,
  type FallbackPeriod,
  type HoroscopeFallbackContent,
} from "@/lib/horoscopes/fallback"
import { WESTERN_SIGNS } from "@/lib/horoscopes/western"
import { prisma } from "@/lib/prisma"

// Templates T032 vivem em `src/lib/horoscopes/fallback.ts` (consumidos por
// rotas/worker/cron sem importar o seed); re-exportados aqui para os
// consumidores históricos (`tests/seed.test.ts`, docs).
export {
  CHINESE_COMBOS,
  MAYAN_KIN_COUNT,
  buildChineseFallback,
  buildMayaFallback,
  buildWesternFallback,
  contentDateFor,
}
export type { FallbackPeriod }

const ADMIN_EMAIL = "admin@arkanaagora.dev"
const TEST_EMAIL = "test@arkanaagora.dev"

// Data civil America/Sao_Paulo (Q25/S2-2) vive em
// `src/lib/horoscopes/dates.ts` (civilDateBrt/civilIsoWeek/civilMonth) —
// compartilhado com seed, cron e rotas.

const FALLBACK_PERIODS: FallbackPeriod[] = ["daily", "weekly", "monthly"]

// Calculado em tempo de execução, não no import: um job que importar este módulo
// não pode herdar as datas congeladas no momento do boot (N-findings da review).
function fallbackDates(): Record<FallbackPeriod, string[]> {
  return {
    daily: [civilDateBrt(0), civilDateBrt(1)],
    weekly: [civilIsoWeek()],
    monthly: [civilMonth()],
  }
}

interface FallbackRow {
  type: string
  signId: string
  element: string | null
  period: FallbackPeriod
  date: string
  content: HoroscopeFallbackContent
}

function fallbackRowKey(row: {
  type: string
  signId: string
  element: string | null
  period: string
  date: string
}): string {
  return `${row.type}|${row.signId}|${row.element ?? ""}|${row.period}|${row.date}`
}

function buildFallbackRows(): FallbackRow[] {
  const rows: FallbackRow[] = []
  const dates = fallbackDates()

  for (const period of FALLBACK_PERIODS) {
    for (const date of dates[period]) {
      const contentDate = contentDateFor(date)
      WESTERN_SIGNS.forEach((sign, index) => {
        rows.push({
          type: "western",
          signId: sign.id,
          element: null,
          period,
          date,
          content: buildWesternFallback(index, contentDate, period),
        })
      })

      CHINESE_COMBOS.forEach((combo, index) => {
        rows.push({
          type: "chinese",
          signId: combo.animalId,
          element: combo.element,
          period,
          date,
          content: buildChineseFallback(index, contentDate, period).content,
        })
      })

      for (let kin = 1; kin <= MAYAN_KIN_COUNT; kin++) {
        const fallback = buildMayaFallback(kin, contentDate, period)
        rows.push({
          type: "maya",
          signId: fallback.signId,
          element: null,
          period,
          date,
          content: fallback.content,
        })
      }
    }
  }

  return rows
}

export async function seedHoroscopeFallbacks(): Promise<void> {
  const rows = buildFallbackRows()
  const dates = [...new Set(rows.map((row) => row.date))]

  const existing = await prisma.horoscopeContent.findMany({
    where: { date: { in: dates } },
    select: {
      type: true,
      signId: true,
      element: true,
      period: true,
      date: true,
      content: true,
    },
  })
  const present = new Set(existing.map((row) => fallbackRowKey(row)))

  // Self-heal: rows semeadas antes da correção do shape T035 guardavam a
  // civil key do período (ex.: "2026-W41") em `content.date` — repara o
  // conteúdo no lugar (a unique key não muda, então updateMany por chave).
  const stale = existing.filter((row) => {
    const content = row.content as unknown as
      { date?: unknown } | null | undefined
    return (
      content != null &&
      typeof content.date === "string" &&
      contentDateFor(content.date) !== content.date
    )
  })
  for (const row of stale) {
    const content = row.content as unknown as Record<string, unknown>
    await prisma.horoscopeContent.updateMany({
      where: {
        type: row.type,
        signId: row.signId,
        element: row.element,
        period: row.period,
        date: row.date,
      },
      data: { content: { ...content, date: contentDateFor(row.date) } },
    })
  }

  const data = rows.filter((row) => !present.has(fallbackRowKey(row)))

  if (data.length > 0) {
    // skipDuplicates: corrida com o cron de fallbacks cai em ON CONFLICT DO NOTHING
    // (cobre inclusive a unique NULLS NOT DISTINCT — CRIT-2).
    await prisma.horoscopeContent.createMany({ data, skipDuplicates: true })
  }

  console.log(
    `Horoscope fallbacks: ${data.length} criados, ${stale.length} reparados ` +
      `(western ${WESTERN_SIGNS.length} × chinese ${CHINESE_COMBOS.length} × maya ${MAYAN_KIN_COUNT} × periods ${FALLBACK_PERIODS.length} × dates ${dates.length})`,
  )
}

export async function seedHoroscopeNotifications(
  userIds: string[],
): Promise<void> {
  for (const userId of userIds) {
    await prisma.horoscopeNotification.upsert({
      where: { userId },
      update: {},
      create: { userId },
    })
  }
  console.log(
    `Horoscope notifications: ${userIds.length} usuários com defaults`,
  )
}

export async function seed(): Promise<void> {
  const admin = await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: {},
    create: {
      email: ADMIN_EMAIL,
      name: "Admin",
      displayName: "Admin",
      provider: "EMAIL",
      providerId: ADMIN_EMAIL,
      role: "ADMIN",
      emailVerified: new Date(),
      profile: { create: {} },
    },
  })

  const test = await prisma.user.upsert({
    where: { email: TEST_EMAIL },
    update: {},
    create: {
      email: TEST_EMAIL,
      name: "Test User",
      displayName: "Test User",
      provider: "EMAIL",
      providerId: TEST_EMAIL,
      role: "USER",
      emailVerified: new Date(),
      profile: { create: {} },
    },
  })

  await seedHoroscopeNotifications([admin.id, test.id])
  await seedHoroscopeFallbacks()

  console.log(
    `Seed ok: admin=${admin.email} (id ${admin.id}) | test=${test.email} (id ${test.id})`,
  )
}

// Só executa quando chamado diretamente (`npx tsx prisma/seed.ts`); importar o
// módulo (testes) não dispara o seed.
const invokedDirectly =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href

if (invokedDirectly) {
  seed()
    .catch((error) => {
      console.error(error)
      process.exitCode = 1
    })
    .finally(async () => {
      await prisma.$disconnect()
    })
} else if (process.argv[1] !== undefined && !process.env.VITEST) {
  // wrapper/exector disparou este módulo sem bater com o caminho direto —
  // o seed NAO roda; deixa explicito para nao parecer sucesso silencioso
  console.warn(
    `[seed] ignorado: argv[1]=${process.argv[1]} nao corresponde a ${import.meta.url}`,
  )
}
