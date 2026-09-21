type ZodiacSign =
  | "Áries"
  | "Touro"
  | "Gêmeos"
  | "Câncer"
  | "Leão"
  | "Virgem"
  | "Libra"
  | "Escorpião"
  | "Sagitário"
  | "Capricórnio"
  | "Aquário"
  | "Peixes"

const ZODIAC: { sign: ZodiacSign; startMonth: number; startDay: number }[] = [
  { sign: "Capricórnio", startMonth: 12, startDay: 22 },
  { sign: "Aquário", startMonth: 1, startDay: 20 },
  { sign: "Peixes", startMonth: 2, startDay: 19 },
  { sign: "Áries", startMonth: 3, startDay: 21 },
  { sign: "Touro", startMonth: 4, startDay: 20 },
  { sign: "Gêmeos", startMonth: 5, startDay: 21 },
  { sign: "Câncer", startMonth: 6, startDay: 21 },
  { sign: "Leão", startMonth: 7, startDay: 23 },
  { sign: "Virgem", startMonth: 8, startDay: 23 },
  { sign: "Libra", startMonth: 9, startDay: 23 },
  { sign: "Escorpião", startMonth: 10, startDay: 23 },
  { sign: "Sagitário", startMonth: 11, startDay: 22 },
]

export function calculateZodiacSign(
  birthDate: Date | null | undefined,
): ZodiacSign | null {
  if (!birthDate) return null

  const month = birthDate.getUTCMonth() + 1
  const day = birthDate.getUTCDate()

  for (let i = 0; i < ZODIAC.length; i++) {
    const entry = ZODIAC[i]!
    const { sign, startMonth, startDay } = entry
    if (month === startMonth && day < startDay) {
      const prev = ZODIAC[(i - 1 + ZODIAC.length) % ZODIAC.length]!
      return prev.sign
    }
    if (month === startMonth && day >= startDay) {
      return sign
    }
  }

  return "Capricórnio"
}
