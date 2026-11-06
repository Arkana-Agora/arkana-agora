import { calculateKinMaya } from "@/lib/calculations/kin-maya"
import { getChineseZodiac } from "@/lib/horoscopes/chinese"
import { WESTERN_SIGNS, getWesternSign } from "@/lib/horoscopes/western"
import type { HoroscopeType } from "@/lib/horoscopes/prompts"

export type HoroscopeSystem = HoroscopeType

export interface UserAstroInput {
  birthDate: Date | null
  astrologicalSign: string | null
}

export interface ResolvedSign {
  type: HoroscopeSystem
  signId: string
  element: string | null
}

/**
 * Resolução de signo por sistema a partir do perfil (T094/T102) — fonte
 * única da derivação: ocidental via `birthDate` (`getWesternSign`, UTC)
 * com fallback `astrologicalSign` (nome PT do catálogo); chinês via
 * `getChineseZodiac` (boundary CNY) e maia via `calculateKinMaya` (GMT)
 * — ambos exigem `birthDate`. `null` = sem dados para o sistema
 * (assinante sem birthDate não recebe notificação de chinês/maia).
 */
export function resolveUserSign(
  system: HoroscopeSystem,
  user: UserAstroInput,
): ResolvedSign | null {
  const { birthDate } = user

  if (system === "western") {
    if (birthDate !== null) {
      const signId = getWesternSign(
        birthDate.getUTCDate(),
        birthDate.getUTCMonth() + 1,
      ).id
      return { type: "western", signId, element: null }
    }
    if (user.astrologicalSign != null) {
      const signId =
        WESTERN_SIGNS.find((sign) => sign.name === user.astrologicalSign)?.id ??
        null
      if (signId !== null) return { type: "western", signId, element: null }
    }
    return null
  }

  if (birthDate === null) return null

  if (system === "chinese") {
    const zodiac = getChineseZodiac(
      birthDate.getUTCFullYear(),
      birthDate.getUTCMonth() + 1,
      birthDate.getUTCDate(),
    )
    return { type: "chinese", signId: zodiac.animal, element: zodiac.element }
  }

  const kin = calculateKinMaya(birthDate)
  if (kin === null) return null
  return { type: "maya", signId: String(kin), element: null }
}
