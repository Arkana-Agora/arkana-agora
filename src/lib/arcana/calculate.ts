import { reduceToArcana, explainReduction } from "./reduce"
import { getLetterValue } from "./pythagorean-table"

export function calculateArcanaByDate(birthDate: Date): number {
  const year = birthDate.getUTCFullYear()
  const month = String(birthDate.getUTCMonth() + 1).padStart(2, "0")
  const day = String(birthDate.getUTCDate()).padStart(2, "0")
  const dateStr = `${year}${month}${day}`
  const sum = dateStr.split("").reduce((acc, d) => acc + Number(d), 0)
  return reduceToArcana(sum)
}

export function calculateArcanaByName(name: string): number {
  if (!name) return 22
  const sum = name.split("").reduce((acc, ch) => acc + getLetterValue(ch), 0)
  return reduceToArcana(sum)
}

export function calculatePersonalArcana(
  birthDate: Date | null | undefined,
  name: string,
): number | null {
  if (!birthDate || !name) return null

  const year = birthDate.getUTCFullYear()
  const month = String(birthDate.getUTCMonth() + 1).padStart(2, "0")
  const day = String(birthDate.getUTCDate()).padStart(2, "0")
  const dateStr = `${year}${month}${day}`
  const dateSum = dateStr.split("").reduce((acc, d) => acc + Number(d), 0)
  const nameSum = name
    .split("")
    .reduce((acc, ch) => acc + getLetterValue(ch), 0)

  return reduceToArcana(dateSum + nameSum)
}

export interface PersonalArcanaCalculation {
  arcanaNumber: number
  reductionDate: string
  reductionName: string
}

export function explainPersonalArcana(
  birthDate: Date,
  name: string,
): PersonalArcanaCalculation {
  const year = birthDate.getUTCFullYear()
  const month = String(birthDate.getUTCMonth() + 1).padStart(2, "0")
  const day = String(birthDate.getUTCDate()).padStart(2, "0")
  const dateStr = `${year}${month}${day}`
  const dateSum = dateStr.split("").reduce((acc, d) => acc + Number(d), 0)
  const nameSum = name
    .split("")
    .reduce((acc, ch) => acc + getLetterValue(ch), 0)

  return {
    arcanaNumber: reduceToArcana(dateSum + nameSum),
    reductionDate: `${dateStr} → ${explainReduction(dateSum)}`,
    reductionName: `${name} → ${explainReduction(nameSum)}`,
  }
}
