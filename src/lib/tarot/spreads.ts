import type { DrawnCard, YesNoResult } from "@/types/tarot"

export function resolveYesNo(cards: DrawnCard[]): YesNoResult {
  if (cards.length === 0) {
    return { answer: "maybe", confidence: 0 }
  }

  const uprightCount = cards.filter((c) => !c.isReversed).length
  const reversedCount = cards.length - uprightCount
  const isOddUpright = uprightCount % 2 !== 0

  if (cards.length === 1) {
    return {
      answer: isOddUpright ? "yes" : "no",
      confidence: 0.6,
    }
  }

  const isDecisive = Math.abs(uprightCount - reversedCount) >= 2

  return {
    answer: isOddUpright ? "yes" : "no",
    confidence: isDecisive ? 0.8 : 0.55,
  }
}
