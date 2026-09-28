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
export function civilIsoWeek(offsetDays = 0): string {
  const [year, month, day] = civilDateBrt(offsetDays)
    .split("-")
    .map(Number) as [number, number, number]
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

export function civilMonth(offsetMonths = 0): string {
  const [year, month] = civilDateBrt(0).split("-").map(Number) as [
    number,
    number,
  ]
  const date = new Date(Date.UTC(year, month - 1 + offsetMonths, 1))
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`
}
