import { z } from "zod"

import { civilDateBrt, periodRowKey } from "@/lib/horoscopes/dates"
import {
  horoscopeContentShape,
  type HoroscopeContent,
  type HoroscopePeriod,
} from "@/lib/horoscopes/validation"

/**
 * Formato de `date` por período (design.md §2.1): `YYYY-MM-DD` (daily),
 * `YYYY-Www` (weekly), `YYYY-MM` (monthly) — a key de `HoroscopeContent.date`.
 */
export const HOROSCOPE_DATE_PATTERNS: Record<HoroscopePeriod, RegExp> = {
  daily: /^\d{4}-\d{2}-\d{2}$/,
  weekly: /^\d{4}-W\d{2}$/,
  monthly: /^\d{4}-\d{2}$/,
}

/** Campos `period`/`date` compartilhados pelas rotas T093/T106/T113. */
export const horoscopePeriodFields = {
  period: z.enum(["daily", "weekly", "monthly"]).default("daily"),
  date: z.string().optional(),
}

/** Data default por período na data civil BRT (Q25/S2-2). */
export function defaultHoroscopeDate(period: HoroscopePeriod): string {
  return periodRowKey(period, civilDateBrt(0))
}

/** Valida `date` contra o formato do período — aplicar via `.superRefine()`. */
export function refineHoroscopeDate(
  data: { period: HoroscopePeriod; date?: string | undefined },
  ctx: z.RefinementCtx,
): void {
  if (
    data.date !== undefined &&
    !HOROSCOPE_DATE_PATTERNS[data.period].test(data.date)
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["date"],
      message: `Formato de date invalido para period ${data.period}`,
    })
  }
}

/**
 * Lê `HoroscopeContent.content` (JSON) validando o shape T035 — substitui
 * o cast `as unknown as` das rotas: JSON malformado vira `null` e o
 * chamador sintetiza fallback T032 em vez de propagar objeto quebrado.
 */
export function parseStoredHoroscopeContent(
  raw: unknown,
): HoroscopeContent | null {
  const parsed = horoscopeContentShape.safeParse(raw)
  return parsed.success ? parsed.data : null
}
