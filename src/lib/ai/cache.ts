import { createHash } from "node:crypto"

export const CACHE_TTL_SECONDS = 30 * 24 * 60 * 60 // 30 days

interface CacheHashCard {
  cardId: string
  positionIndex: number
  isReversed: boolean
}

export type InterpretationMode = "general" | "love" | "career" | "yesno"

interface CacheHashInput {
  deckId: string
  spreadId: string
  cards: CacheHashCard[]
  mode: InterpretationMode
  mood?: string
  question?: string
  modelVersion: string
}

export function computeCacheHash(input: CacheHashInput): string {
  const sortedCards = [...input.cards]
    .sort((a, b) => a.positionIndex - b.positionIndex)
    .map((c) => `${c.cardId}:${c.isReversed ? "R" : "U"}`)
    .join("|")

  const parts = [
    input.deckId,
    input.spreadId,
    sortedCards,
    input.mode,
    input.mood ?? "",
    input.question ?? "",
    input.modelVersion,
  ]

  return createHash("sha256").update(parts.join("$$")).digest("hex")
}
