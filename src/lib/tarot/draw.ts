import type { Card, DrawnCard } from "@/types/tarot"
import { shuffleDeck, createSeededRNG } from "./shuffle"

export function drawCards<T extends Card>(
  deck: T[],
  count: number,
  seed: string,
): DrawnCard[] {
  if (count > deck.length) {
    throw new Error(`Cannot draw ${count} cards from deck of ${deck.length}`)
  }

  const shuffled = shuffleDeck(deck, seed)
  const selected = shuffled.slice(0, count)
  const rng = createSeededRNG(seed + "-reversed")

  return selected.map((card, index) => ({
    card,
    isReversed: rng() < 0.3,
    position: index,
  }))
}
