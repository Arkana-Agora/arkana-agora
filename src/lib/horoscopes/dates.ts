/**
 * Data civil em America/Sao_Paulo (Q25/S2-2) — single-source dos
 * formatos de data usados por seed, cron e rotas de horóscopo.
 * Extraído de `prisma/seed.ts` para ser reutilizável pelo app (T093+).
 */

// Data civil America/Sao_Paulo em formato 'YYYY-MM-DD'.
export function civilDateBrt(offsetDays = 0): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(Date.now() + offsetDays * 86_400_000))
}

// Data civil em formato ISO-week 'YYYY-Www' / mês 'YYYY-MM' (Q25) sobre o
// fuso America/Sao_Paulo, coerentes com civilDateBrt.
function isoWeekFromFlat(flatDate: string): string {
  const [year, month, day] = flatDate.split("-").map(Number) as [
    number,
    number,
    number,
  ]
  const date = new Date(Date.UTC(year, month - 1, day))
  const dayNum = (date.getUTCDay() + 6) % 7 // segunda = 0
  date.setUTCDate(date.getUTCDate() - dayNum + 3) // quinta da semana ISO
  const isoYear = date.getUTCFullYear()
  const firstThursday = new Date(Date.UTC(isoYear, 0, 4))
  const firstDayNum = (firstThursday.getUTCDay() + 6) % 7
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNum + 3)
  const week =
    1 +
    Math.round((date.getTime() - firstThursday.getTime()) / (7 * 86_400_000))
  return `${isoYear}-W${String(week).padStart(2, "0")}`
}

export function civilIsoWeek(offsetDays = 0): string {
  return isoWeekFromFlat(civilDateBrt(offsetDays))
}

/**
 * Row key de `HoroscopeContent` por período (T035/Q25) sobre uma data
 * civil plana: daily = `YYYY-MM-DD`, weekly = `YYYY-Www`, monthly =
 * `YYYY-MM`. Usado pelo cron T097 (predicate de "já existe"), pelo worker
 * T098 (row key do job) e pelo jobId determinístico — derivar da data do
 * job (não do relógio de processamento) evita jobs concorrentes para a
 * mesma row quando um job atravessa a virada de semana/mês.
 */
export function periodRowKey(
  period: "daily" | "weekly" | "monthly",
  flatDate: string,
): string {
  if (period === "weekly") return isoWeekFromFlat(flatDate)
  if (period === "monthly") {
    const [year, month] = flatDate.split("-").map(Number) as [number, number]
    return `${year}-${String(month).padStart(2, "0")}`
  }
  return flatDate
}

// Hora civil (0-23) em America/Sao_Paulo — tick do cron horário de
// notificações T102 (RF-HORO-008): `hour` do HoroscopeNotification é a
// hora local desejada; o worker dispara uma vez por hora e filtra configs
// com `hour` igual à hora civil corrente. `hourCycle: "h23"` evita "24"
// e o padding ("07" → 7 via Number).
export function civilHourBrt(): number {
  return Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "America/Sao_Paulo",
      hour: "2-digit",
      hourCycle: "h23",
    }).format(new Date()),
  )
}

export function civilMonth(offsetMonths = 0): string {
  const [year, month] = civilDateBrt(0).split("-").map(Number) as [
    number,
    number,
  ]
  const date = new Date(Date.UTC(year, month - 1 + offsetMonths, 1))
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`
}
