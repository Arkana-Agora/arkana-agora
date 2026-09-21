export function calculatePersonalArcana(
  birthDate: Date | null | undefined,
  name: string,
): number | null {
  if (!birthDate || !name) return null

  const birthStr = birthDate.toISOString().slice(0, 10).replace(/-/g, "")
  const nameNum = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .split("")
    .reduce((sum, ch, i) => sum + ch.charCodeAt(0) * (i + 1), 0)

  const total =
    birthStr.split("").reduce((sum, d) => sum + Number(d), 0) + nameNum

  const reduced = reduceToMajorArcana(total)
  return reduced
}

function reduceToMajorArcana(n: number): number {
  while (n > 22) {
    n = n
      .toString()
      .split("")
      .reduce((sum, d) => sum + Number(d), 0)
  }
  return n === 0 ? 22 : n
}
