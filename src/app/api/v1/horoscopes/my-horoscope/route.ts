import { z } from "zod"

import {
  defaultHoroscopeDate,
  horoscopePeriodFields,
  parseStoredHoroscopeContent,
  refineHoroscopeDate,
} from "@/app/api/v1/horoscopes/_helpers"
import { requireAuth } from "@/app/api/v1/users/_helpers"
import { apiError } from "@/lib/api-response"
import {
  buildFallbackFor,
  type FallbackPeriod,
} from "@/lib/horoscopes/fallback"
import { resolveUserSign } from "@/lib/horoscopes/user-signs"
import { logger, newReqId } from "@/lib/logger"
import { prisma } from "@/lib/prisma"
import type { HoroscopeContent } from "@/lib/horoscopes/validation"

export const dynamic = "force-dynamic"

const myHoroscopeQuerySchema = z
  .object({ ...horoscopePeriodFields })
  .superRefine(refineHoroscopeDate)

interface ResolvedHoroscope {
  type: "western" | "chinese" | "maya"
  signId: string
  element: string | null
  period: FallbackPeriod
  date: string
  content: HoroscopeContent
  source: "generated" | "fallback"
}

/**
 * Resolve um sistema: lê `HoroscopeContent` (seed/cron; JSON validado pelo
 * shape T035 — malformado vira fallback T032) e, se ausente, sintetiza o
 * template com `content.date` no shape T035 (`buildFallbackFor` normaliza
 * a key do período internamente).
 */
async function resolveSystem(
  type: ResolvedHoroscope["type"],
  signId: string,
  element: string | null,
  period: FallbackPeriod,
  date: string,
): Promise<ResolvedHoroscope> {
  const row = await prisma.horoscopeContent.findFirst({
    where: { type, signId, element, period, date },
  })

  const stored = row !== null ? parseStoredHoroscopeContent(row.content) : null
  const content: HoroscopeContent =
    stored ?? buildFallbackFor({ type, signId, element, period, date })

  return {
    type,
    signId,
    element,
    period,
    date,
    content,
    source: content.fallback === true ? "fallback" : "generated",
  }
}

/**
 * GET /api/v1/horoscopes/my-horoscope (T094/Q8/US-024): agrega os 3
 * sistemas do usuário autenticado numa única resposta —
 * `{ western, chinese, mayan }` (contrato do `useMyHoroscope`, T038;
 * ausência por sistema = `null` explícito, CHK018). Derivação: ocidental
 * via `birthDate` (`getWesternSign`) com fallback `astrologicalSign`;
 * chinês via `getChineseZodiac` (CNY boundary) e maia via
 * `calculateKinMaya` (GMT) — ambos exigem `birthDate`. As 3 leituras de
 * `HoroscopeContent` rodam em `Promise.all` (independentes). Não registra
 * `HoroscopeEntry` (dedupe: a consulta por sistema loga em T093).
 */
export async function GET(request: Request): Promise<Response> {
  const reqId = newReqId()

  const auth = await requireAuth(request, reqId)
  if (auth instanceof Response) return auth

  const parsed = myHoroscopeQuerySchema.safeParse(
    Object.fromEntries(new URL(request.url).searchParams),
  )
  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", "Query params invalidos", reqId, 422)
  }
  const period = parsed.data.period
  const date = parsed.data.date ?? defaultHoroscopeDate(period)

  try {
    const user = await prisma.user.findUnique({
      where: { id: auth.userId },
      select: { birthDate: true, astrologicalSign: true },
    })
    const astro = {
      birthDate: user?.birthDate ?? null,
      astrologicalSign: user?.astrologicalSign ?? null,
    }

    const westernSign = resolveUserSign("western", astro)
    const chineseSign = resolveUserSign("chinese", astro)
    const mayaSign = resolveUserSign("maya", astro)

    const [western, chinese, mayan] = await Promise.all([
      westernSign !== null
        ? resolveSystem(
            "western",
            westernSign.signId,
            westernSign.element,
            period,
            date,
          )
        : Promise.resolve(null),
      chineseSign !== null
        ? resolveSystem(
            "chinese",
            chineseSign.signId,
            chineseSign.element,
            period,
            date,
          )
        : Promise.resolve(null),
      mayaSign !== null
        ? resolveSystem("maya", mayaSign.signId, mayaSign.element, period, date)
        : Promise.resolve(null),
    ])

    return Response.json({ western, chinese, mayan })
  } catch (err) {
    logger.error(
      { reqId, err },
      "[horoscopes:my] erro ao montar horoscopos do usuario",
    )
    return apiError("INTERNAL_ERROR", "Erro interno", reqId, 500)
  }
}
