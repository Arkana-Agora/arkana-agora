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
import { WESTERN_SIGNS, getWesternSign } from "@/lib/horoscopes/western"
import { getCompatibility } from "@/lib/horoscopes/western-compatibility"
import { enforceSocialLimit } from "@/lib/middleware/rate-limit"
import { logger, newReqId } from "@/lib/logger"
import { prisma } from "@/lib/prisma"
import type { HoroscopeContent } from "@/lib/horoscopes/validation"

export const dynamic = "force-dynamic"

const WESTERN_SIGN_IDS = WESTERN_SIGNS.map((sign) => sign.id) as [
  string,
  ...string[],
]

const westernQuerySchema = z
  .object({
    ...horoscopePeriodFields,
    sign: z.enum(WESTERN_SIGN_IDS).optional(),
    targetSign: z.enum(WESTERN_SIGN_IDS).optional(),
  })
  .superRefine(refineHoroscopeDate)

/**
 * GET /api/v1/horoscopes/western (T093/US-024): horóscopo ocidental por
 * período/data. `sign` explícito tem prioridade; sem `sign`, o signo é
 * derivado do usuário autenticado (`User.birthDate` via `getWesternSign`,
 * fallback `User.astrologicalSign`) — sem dados → 422 `BIRTHDATE_REQUIRED`
 * (MVP autenticado, S2-13). Lê `HoroscopeContent` (seed/cron T097) e, se
 * ausente/malformado, sintetiza template T032 (`source: "fallback"`) com
 * `content.date` no shape T035. `targetSign` aciona a matriz T090 (SC7:
 * única fonte de verdade em código). Registra a consulta em
 * `HoroscopeEntry` (RF-HORO-007, best-effort: falha de log nunca derruba
 * a leitura). Rate limit bucket `polling` (mesmo contrato do fallback de
 * polling social — a página pode refetchar ao trocar signo/período).
 */
export async function GET(request: Request): Promise<Response> {
  const reqId = newReqId()

  const auth = await requireAuth(request, reqId)
  if (auth instanceof Response) return auth

  const parsed = westernQuerySchema.safeParse(
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

  const { period, targetSign } = parsed.data
  const date = parsed.data.date ?? defaultHoroscopeDate(period)

  try {
    let signId = parsed.data.sign

    if (signId === undefined) {
      const user = await prisma.user.findUnique({
        where: { id: auth.userId },
        select: { birthDate: true, astrologicalSign: true },
      })
      const fromBirthDate = user?.birthDate
        ? getWesternSign(
            user.birthDate.getUTCDate(),
            user.birthDate.getUTCMonth() + 1,
          ).id
        : undefined
      const fromStoredSign = user?.astrologicalSign
        ? WESTERN_SIGNS.find((sign) => sign.name === user.astrologicalSign)?.id
        : undefined
      signId = fromBirthDate ?? fromStoredSign

      if (signId === undefined) {
        return apiError(
          "BIRTHDATE_REQUIRED",
          "Informe sua data de nascimento no perfil para ver seu signo ocidental",
          reqId,
          422,
        )
      }
    }

    const row = await prisma.horoscopeContent.findFirst({
      where: { type: "western", signId, element: null, period, date },
    })

    const stored =
      row !== null ? parseStoredHoroscopeContent(row.content) : null
    const content: HoroscopeContent =
      stored ??
      buildFallbackFor({ type: "western", signId, element: null, period, date })
    const source = content.fallback === true ? "fallback" : "generated"

    try {
      await prisma.horoscopeEntry.create({
        data: {
          userId: auth.userId,
          type: "western",
          signId,
          element: null,
          period,
        },
      })
    } catch (entryErr) {
      logger.warn(
        { reqId, err: entryErr },
        "[horoscopes:western] falha ao registrar HoroscopeEntry (best-effort)",
      )
    }

    const body: Record<string, unknown> = {
      horoscope: {
        type: "western",
        signId,
        element: null,
        period,
        date,
        content,
        source,
      },
    }
    if (targetSign !== undefined) {
      body.compatibility = {
        targetSignId: targetSign,
        ...getCompatibility(signId, targetSign),
      }
    }

    return Response.json(body)
  } catch (err) {
    logger.error(
      { reqId, err },
      "[horoscopes:western] erro ao montar horoscopo",
    )
    return apiError("INTERNAL_ERROR", "Erro interno", reqId, 500)
  }
}
