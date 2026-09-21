export function calculateKinMaya(
  birthDate: Date | null | undefined,
): number | null {
  if (!birthDate) return null

  const startDate = new Date(Date.UTC(1993, 7, 11)) // August 11, 1993 (Kin 1)
  const diffMs = birthDate.getTime() - startDate.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  const kin = (((diffDays % 260) + 260) % 260) + 1
  return kin
}
