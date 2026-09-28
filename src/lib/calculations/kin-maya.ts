import { gregorianToMayanLongCount } from "@/lib/horoscopes/maya"

/**
 * Kin Maya do usuário via Tzolkin — correlação GMT 584283 (AC-11 / RF-HORO-004).
 * Decisão Phase 0 (Sprint 2): substitui o epoch 11/08/1993 = Kin 1 do Sprint 1,
 * que divergia da correlação GMT (ex.: 15/06/1990 → Kin 255, não 148).
 * MayanKin armazenado é recalculado no PATCH /users/me/profile.
 */
export function calculateKinMaya(
  birthDate: Date | null | undefined,
): number | null {
  if (!birthDate) return null

  return gregorianToMayanLongCount(
    birthDate.getUTCFullYear(),
    birthDate.getUTCMonth() + 1,
    birthDate.getUTCDate(),
  ).kinNumber
}
