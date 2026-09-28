import "dotenv/config"

import { pathToFileURL } from "node:url"

import { CHINESE_ANIMALS, chineseYearElement } from "@/lib/horoscopes/chinese"
import { civilDateBrt, civilIsoWeek, civilMonth } from "@/lib/horoscopes/dates"
import { kinToSealTone, MAYAN_SEALS, MAYAN_TONES } from "@/lib/horoscopes/maya"
import { PROMPT_MOODS } from "@/lib/horoscopes/prompts"
import { WESTERN_SIGNS } from "@/lib/horoscopes/western"
import { prisma } from "@/lib/prisma"

const ADMIN_EMAIL = "admin@arkanaagora.dev"
const TEST_EMAIL = "test@arkanaagora.dev"

const FALLBACK_COLORS = [
  "azul",
  "verde",
  "amarelo",
  "vermelho",
  "roxo",
  "dourado",
  "rosa",
  "prata",
  "laranja",
  "turquesa",
  "índigo",
  "coral",
]

// Data civil America/Sao_Paulo (Q25/S2-2) vive em
// `src/lib/horoscopes/dates.ts` (civilDateBrt/civilIsoWeek/civilMonth) —
// compartilhado com seed, cron e rotas.

// Fallback ocidental (design.md §2.1) — pré-existe ao cron 04:00 BRT para a
// página nunca retornar vazio. T032 estende para weekly/monthly + chinês +
// maia (fallbacks são templates: ficam fora da validação T035, decisão 2026-09-26).
export type FallbackPeriod = "daily" | "weekly" | "monthly"

type HoroscopeFallbackContent = {
  general: string
  love: string
  career: string
  health: string
  luckyNumber: number
  luckyColor: string
  mood: string
  compatibility: string
  date: string
  fallback: boolean
}

const PERIOD_WORD: Record<FallbackPeriod, string> = {
  daily: "hoje",
  weekly: "nesta semana",
  monthly: "neste mês",
}

export function buildWesternFallback(
  index: number,
  date: string,
  period: FallbackPeriod = "daily",
): HoroscopeFallbackContent {
  const sign = WESTERN_SIGNS[index]!
  const next = WESTERN_SIGNS[(index + 1) % WESTERN_SIGNS.length]!
  const firstKeyword = sign.keywords[0] ?? sign.element
  const when = PERIOD_WORD[period]
  const element = sign.element.toLowerCase()

  const general =
    period === "daily"
      ? `${sign.name}: dia de ${firstKeyword.toLowerCase()}. A energia de ${element} pede presença nas escolhas do dia.`
      : period === "weekly"
        ? `${sign.name}: ${when}, a energia de ${element} e o traço de ${firstKeyword.toLowerCase()} orientam as escolhas. Priorize o que dá continuidade, não o que grita mais alto, e reserve um momento para respirar antes de decidir.`
        : `${sign.name}: ${when}, o elemento ${element} pede ritmo constante. ${firstKeyword.toLowerCase()} é o fio condutor: revise o que começou, solte o que não fluiu e planeje o próximo ciclo com clareza. O cuidado com o corpo e com os vínculos sustenta o resto.`

  return {
    general,
    love: `${sign.name}: conversas francas fortalecem os vínculos ${when}.`,
    career: `${sign.name}: organize as prioridades e conclua uma tarefa pendente ${when}.`,
    health: `${sign.name}: hidrate-se e reserve um momento de descanso ${when}.`,
    luckyNumber: ((index * 7 + 3) % 99) + 1,
    luckyColor: FALLBACK_COLORS[index % FALLBACK_COLORS.length]!,
    mood: PROMPT_MOODS[index % PROMPT_MOODS.length]!,
    compatibility: next.id,
    date,
    fallback: true,
  }
}

// 60 combos sexagenários: y = índice canônico 0..59 ≡ ano chinês 1984+y
// (animal y%12 e elemento do stem de 1984+y — `chineseYearElement`, a
// MESMA fórmula de `getChineseZodiac`). Para animal fixo a, y = a + 12k
// (k = 0..4) percorre stems a, a+2, a+4, a+6, a+8 (módulo 10, mesma
// paridade → 5 elementos distintos) → os 60 pares (animal, elemento)
// são únicos e cobrem a tabela inteira (12 × 5). Use sempre a tabela —
// derivar animal ou elemento isoladamente mistura pares divergentes.
export const CHINESE_COMBOS = Array.from({ length: 60 }, (_, y) => ({
  animalId: CHINESE_ANIMALS[y % 12]!.id,
  element: chineseYearElement(1984 + y),
}))

export const MAYAN_KIN_COUNT = 260

export function buildChineseFallback(
  comboIndex: number,
  date: string,
  period: FallbackPeriod = "daily",
): { signId: string; element: string; content: HoroscopeFallbackContent } {
  const animal = CHINESE_ANIMALS[comboIndex % 12]!
  const nextAnimal = CHINESE_ANIMALS[(comboIndex + 1) % 12]!
  const element = CHINESE_COMBOS[comboIndex % CHINESE_COMBOS.length]!.element
  const character =
    animal.characteristics[comboIndex % animal.characteristics.length]!
  const when = PERIOD_WORD[period]

  return {
    signId: animal.id,
    element,
    content: {
      general: `${animal.name}: ${when}, a energia ${element} e o traço ${character.toLowerCase()} pedem presença. Fluxe com o ritmo do ciclo sexagenário, escolha as batalhas com cuidado e confie na adaptação — ela abre mais portas que a força.`,
      love: `${animal.name}: ${character.toLowerCase()} aproxima quem importa ${when}.`,
      career: `${animal.name}: aproveite a energia ${element} para destravar uma tarefa ${when}.`,
      health: `${animal.name}: movimento leve e respiração consciente sustentam ${when}.`,
      luckyNumber: ((comboIndex * 7 + 5) % 99) + 1,
      luckyColor: FALLBACK_COLORS[comboIndex % FALLBACK_COLORS.length]!,
      mood: PROMPT_MOODS[comboIndex % PROMPT_MOODS.length]!,
      compatibility: nextAnimal.id,
      date,
      fallback: true,
    },
  }
}

export function buildMayaFallback(
  kinNumber: number,
  date: string,
  period: FallbackPeriod = "daily",
): { signId: string; content: HoroscopeFallbackContent } {
  const { sealIndex, toneId } = kinToSealTone(kinNumber) // valida 1-260
  const seal = MAYAN_SEALS[sealIndex]!
  const tone = MAYAN_TONES[toneId - 1]!
  const when = PERIOD_WORD[period]

  return {
    signId: String(kinNumber),
    content: {
      general: `Kin ${kinNumber} (${seal.name} ${tone.name}): ${when}, o selo traz ${seal.meaning.toLowerCase()} e a tonalidade pede ${tone.keyword.toLowerCase()}. Ação guiada: ${tone.action.toLowerCase()}. Deixe a cor ${seal.color.toLowerCase()} presente nas escolhas e mantenha o propósito do dia alinhado ao passo certo.`,
      love: `Kin ${kinNumber}: ${tone.name} acolhe os vínculos ${when}.`,
      career: `Kin ${kinNumber}: ${tone.keyword} orienta as decisões ${when}.`,
      health: `Kin ${kinNumber}: respire fundo e desacelere o corpo ${when}.`,
      luckyNumber: ((kinNumber * 13 + 1) % 99) + 1,
      luckyColor: seal.color.toLowerCase(),
      mood: PROMPT_MOODS[kinNumber % PROMPT_MOODS.length]!,
      compatibility: String(((kinNumber + 64) % MAYAN_KIN_COUNT) + 1),
      date,
      fallback: true,
    },
  }
}

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
      WESTERN_SIGNS.forEach((sign, index) => {
        rows.push({
          type: "western",
          signId: sign.id,
          element: null,
          period,
          date,
          content: buildWesternFallback(index, date, period),
        })
      })

      CHINESE_COMBOS.forEach((combo, index) => {
        rows.push({
          type: "chinese",
          signId: combo.animalId,
          element: combo.element,
          period,
          date,
          content: buildChineseFallback(index, date, period).content,
        })
      })

      for (let kin = 1; kin <= MAYAN_KIN_COUNT; kin++) {
        const fallback = buildMayaFallback(kin, date, period)
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
    },
  })
  const present = new Set(existing.map((row) => fallbackRowKey(row)))

  const data = rows.filter((row) => !present.has(fallbackRowKey(row)))

  if (data.length > 0) {
    // skipDuplicates: corrida com o cron de fallbacks cai em ON CONFLICT DO NOTHING
    // (cobre inclusive a unique NULLS NOT DISTINCT — CRIT-2).
    await prisma.horoscopeContent.createMany({ data, skipDuplicates: true })
  }

  console.log(
    `Horoscope fallbacks: ${data.length} criados ` +
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
      process.exit(1)
    })
    .finally(async () => {
      await prisma.$disconnect()
    })
}
