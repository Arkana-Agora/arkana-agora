import { z } from "zod"

import {
  defaultHoroscopeDate,
  horoscopePeriodFields,
  parseStoredHoroscopeContent,
  refineHoroscopeDate,
} from "@/app/api/v1/horoscopes/_helpers"
import { requireAuth } from "@/app/api/v1/users/_helpers"
import { apiError } from "@/lib/api-response"
import { buildFallbackFor } from "@/lib/horoscopes/fallback"
import {
  CHINESE_ANIMALS,
  getChineseZodiac,
  chineseYearElement,
} from "@/lib/horoscopes/chinese"
import { enforceSocialLimit } from "@/lib/middleware/rate-limit"
import { logger, newReqId } from "@/lib/logger"
import { prisma } from "@/lib/prisma"
import type { HoroscopeContent } from "@/lib/horoscopes/validation"
import { trackHoroscopeView } from "@/lib/analytics"

export const dynamic = "force-dynamic"

const CHINESE_ANIMAL_IDS = CHINESE_ANIMALS.map((animal) => animal.id) as [
  string,
  ...string[],
]

const CHINESE_ELEMENTS = ["Wood", "Fire", "Earth", "Metal", "Water"] as const

const chineseQuerySchema = z
  .object({
    ...horoscopePeriodFields,
    animal: z.enum(CHINESE_ANIMAL_IDS).optional(),
    element: z.enum(CHINESE_ELEMENTS).optional(),
  })
  .superRefine(refineHoroscopeDate)

/**
 * GET /api/v1/horoscopes/chinese (T106/US-024): horóscopo chinês por
 * animal/elemento/período/data. `animal` explícito tem prioridade; sem
 * `animal`, o animal é derivado do usuário autenticado (`User.birthDate`
 * via `getChineseZodiac`, CNY boundary) — sem dados → 422
 * `BIRTHDATE_REQUIRED` (MVP autenticado, S2-13). Lê `HoroscopeContent`
 * (seed/cron T097/T107) e, se ausente/malformado, sintetiza template T032
 * (`source: "fallback"`) com `content.date` no shape T035. Registra a
 * consulta em `HoroscopeEntry` (RF-HORO-007, best-effort: falha de log
 * nunca derruba a leitura). Rate limit bucket `polling` (mesmo contrato
 * do fallback de polling social).
 */
export async function GET(request: Request): Promise<Response> {
  const reqId = newReqId()

  const auth = await requireAuth(request, reqId)
  if (auth instanceof Response) return auth

  const parsed = chineseQuerySchema.safeParse(
    Object.fromEntries(new URL(request.url).searchParams),
  )
  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", "Query params invalidos", reqId, 422)
  }

  const rate = await enforceSocialLimit({
    limit: "polling",
    userId: auth.userId,
    reqId,
  })
  if (!rate.allowed) return rate.response

  const { period } = parsed.data
  const date = parsed.data.date ?? defaultHoroscopeDate(period)

  try {
    let animalId = parsed.data.animal
    let elementId: (typeof CHINESE_ELEMENTS)[number] | undefined =
      parsed.data.element
    let portugueseElementForFallback: string | null = null

    // If elementId is provided explicitly (capitalized English), convert to Portuguese for fallback
    if (elementId !== undefined) {
      const reverseElementMap: Record<string, string> = {
        Wood: "madeira",
        Fire: "fogo",
        Earth: "terra",
        Metal: "metal",
        Water: "agua",
      }
      portugueseElementForFallback = reverseElementMap[elementId] ?? null
    }

    if (animalId === undefined) {
      const user = await prisma.user.findUnique({
        where: { id: auth.userId },
        select: { birthDate: true },
      })

      if (!user?.birthDate) {
        return apiError(
          "BIRTHDATE_REQUIRED",
          "Informe sua data de nascimento no perfil para ver seu horóscopo chinês",
          reqId,
          422,
        )
      }

      const zodiac = getChineseZodiac(
        user.birthDate.getUTCFullYear(),
        user.birthDate.getUTCMonth() + 1,
        user.birthDate.getUTCDate(),
      )
      animalId = zodiac.animal
      // Convert lowercase element to capitalized (e.g., "metal" -> "Metal")
      // Also track Portuguese element for fallback function
      const portugueseElement = zodiac.element
      elementId = (portugueseElement.charAt(0).toUpperCase() +
        portugueseElement.slice(1)) as (typeof CHINESE_ELEMENTS)[number]
      portugueseElementForFallback = portugueseElement
    }

    if (elementId === undefined) {
      // Se animal explícito foi passado mas não elemento, deriva o elemento
      // do ano da data (date) — não usa fixedElement (intrínseco), pois o
      // elemento do zodíaco chinês é do ano (stem celeste), não do animal.
      // O date pode ser YYYY-MM-DD (daily), YYYY-Www (weekly) ou YYYY-MM (monthly).
      const year = parseInt(date.slice(0, 4), 10)
      // Map Portuguese lowercase to English capitalized
      const elementMap: Record<string, (typeof CHINESE_ELEMENTS)[number]> = {
        madeira: "Wood",
        fogo: "Fire",
        terra: "Earth",
        metal: "Metal",
        agua: "Water",
      }
      const portugueseElement = chineseYearElement(year)
      elementId = elementMap[portugueseElement]
      portugueseElementForFallback = portugueseElement
    }

    // Convert undefined to null for Prisma (exactOptionalPropertyTypes)
    const elementForQuery = elementId ?? null

    const row = await prisma.horoscopeContent.findFirst({
      where: {
        type: "chinese",
        signId: animalId,
        element: elementForQuery,
        period,
        date,
      },
    })

    const stored =
      row !== null ? parseStoredHoroscopeContent(row.content) : null
    // buildFallbackFor expects lowercase Portuguese (madeira, fogo, terra, metal, agua)
    // Use tracked Portuguese element for fallback
    const elementForFallback = portugueseElementForFallback
    const content: HoroscopeContent =
      stored ??
      buildFallbackFor({
        type: "chinese",
        signId: animalId,
        element: elementForFallback,
        period,
        date,
      })
    const source = content.fallback === true ? "fallback" : "generated"

    try {
      await prisma.horoscopeEntry.create({
        data: {
          userId: auth.userId,
          type: "chinese",
          signId: animalId,
          element: elementId ?? null,
          period,
        },
      })
    } catch (entryErr) {
      logger.warn(
        { reqId, err: entryErr },
        "[horoscopes:chinese] falha ao registrar HoroscopeEntry (best-effort)",
      )
    }

    const body = {
      horoscope: {
        type: "chinese",
        signId: animalId,
        element: elementId ?? null,
        period,
        date,
        content,
        source,
      },
    }

    trackHoroscopeView("chinese", period)

    return Response.json(body)
  } catch (err) {
    logger.error(
      { reqId, err },
      "[horoscopes:chinese] erro ao montar horoscopo",
    )
    return apiError("INTERNAL_ERROR", "Erro interno", reqId, 500)
  }
}
