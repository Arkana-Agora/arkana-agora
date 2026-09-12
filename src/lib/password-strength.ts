export type PasswordStrengthLabel = "fraca" | "media" | "forte"

export interface PasswordStrength {
  score: number
  label: PasswordStrengthLabel
}

export const MAX_SCORE = 5

export const STRENGTH_LABELS: Record<PasswordStrengthLabel, string> = {
  fraca: "Fraca",
  media: "Media",
  forte: "Forte",
}

export const STRENGTH_BAR_COLORS: Record<PasswordStrengthLabel, string> = {
  fraca: "bg-red-500",
  media: "bg-amber-500",
  forte: "bg-emerald-500",
}

const CRITERIA: Array<(password: string) => boolean> = [
  (password) => password.length >= 8,
  (password) => /[A-Z]/.test(password),
  (password) => /[a-z]/.test(password),
  (password) => /[0-9]/.test(password),
  (password) => /[^A-Za-z0-9]/.test(password),
]

export function getPasswordStrength(password: string): PasswordStrength {
  const score = CRITERIA.reduce<number>(
    (acc, matches) => acc + (matches(password) ? 1 : 0),
    0,
  )
  const label: PasswordStrengthLabel =
    score >= 5 ? "forte" : score >= 3 ? "media" : "fraca"
  return { score, label }
}
