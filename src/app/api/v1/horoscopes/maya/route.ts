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
  calculateKinMaya,
  kinToSealTone,
  MAYAN_KIN_COUNT,
} from "@/lib/horoscopes/maya"
import { enforceSocialLimit } from "@/lib/middleware/rate-limit"
import { logger, newReqId } from "@/lib/logger"
import { prisma } from "@/lib/prisma"
import type { HoroscopeContent } from "@/lib/horoscopes/validation"

export const dynamic = "force-dynamic"

const mayaQuerySchema = z
  .object({
    ...horoscopePeriodFields,
    kinNumber: z
      .string()
      .regex(/^\d+$/)
      .refine((val) => {
        const num = Number(val)
        return Number.isInteger(num) && num >= 1 && num <= MAYAN_KIN_COUNT
      })
      .optional(),
  })
  .superRefine(refineHoroscopeDate)

/**
 * GET /api/v1/horoscopes/maya (T113/US-025): horóscopo Maia por
 * kin/período/data. `kinNumber` explícito tem prioridade; sem `kinNumber`,
 * o kin é derivado do usuário autenticado (`User.birthDate` via
 * `calculateKinMaya`, GMT 584283) — sem dados → 422 `BIRTHDATE_REQUIRED`
 * (MVP autenticado, S2-13). Lê `HoroscopeContent` (seed/cron T097/T114) e,
 * se ausente/malformado, sintetiza template T032 (`source: "fallback"`) com
 * `content.date` no shape T035. Registra a consulta em `HoroscopeEntry`
 * (RF-HORO-007, best-effort: falha de log nunca derruba a leitura).
 * Rate limit bucket `polling` (mesmo contrato do fallback de polling social).
 */
export async function GET(request: Request): Promise<Response> {
  const reqId = newReqId()

  const auth = await requireAuth(request, reqId)
  if (auth instanceof Response) return auth

  const parsed = mayaQuerySchema.safeParse(
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
    let kinNumber: number

    if (parsed.data.kinNumber !== undefined) {
      kinNumber = Number(parsed.data.kinNumber)
    } else {
      const user = await prisma.user.findUnique({
        where: { id: auth.userId },
        select: { birthDate: true },
      })

      if (!user?.birthDate) {
        return apiError(
          "BIRTHDATE_REQUIRED",
          "Informe sua data de nascimento no perfil para ver seu horóscopo Maia",
          reqId,
          422,
        )
      }

      const kin = calculateKinMaya(user.birthDate)
      if (kin === null) {
        return apiError(
          "BIRTHDATE_REQUIRED",
          "Data de nascimento inválida para cálculo do Kin Maia",
          reqId,
          422,
        )
      }
      kinNumber = kin
    }

    const { sealIndex, toneId } = kinToSealTone(kinNumber)

    const row = await prisma.horoscopeContent.findFirst({
      where: {
        type: "maya",
        signId: String(kinNumber),
        element: null,
        period,
        date,
      },
    })

    const stored =
      row !== null ? parseStoredHoroscopeContent(row.content) : null
    const content: HoroscopeContent =
      stored ??
      buildFallbackFor({
        type: "maya",
        signId: String(kinNumber),
        element: null,
        period,
        date,
      })
    const source = content.fallback === true ? "fallback" : "generated"

    try {
      await prisma.horoscopeEntry.create({
        data: {
          userId: auth.userId,
          type: "maya",
          signId: String(kinNumber),
          element: null,
          period,
        },
      })
    } catch (entryErr) {
      logger.warn(
        { reqId, err: entryErr },
        "[horoscopes:maya] falha ao registrar HoroscopeEntry (best-effort)",
      )
    }

    const body = {
      horoscope: {
        type: "maya",
        signId: String(kinNumber),
        element: null,
        period,
        date,
        content,
        source,
        kin: {
          number: kinNumber,
          seal: sealIndex,
          tone: toneId,
        },
      },
    }

    return Response.json(body)
  } catch (err) {
    logger.error({ reqId, err }, "[horoscopes:maya] erro ao montar horoscopo")
    return apiError("INTERNAL_ERROR", "Erro interno", reqId, 500)
  }
}
