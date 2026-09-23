import { getDeckCards } from "./decks"
import type { TarotCard } from "@/types/tarot"

export interface DailyTarotCard {
  id: string
  name: string
  image: string
  meaning: string
  reversedMeaning: string
  isReversed: boolean
}

function getDayOfYear(date: Date): number {
  const start = new Date(date.getFullYear(), 0, 0)
  const diff = date.getTime() - start.getTime()
  const oneDay = 1000 * 60 * 60 * 24
  return Math.floor(diff / oneDay)
}

export function getDailyTarotCard(date: Date = new Date()): DailyTarotCard {
  const cards = getDeckCards("rws") as TarotCard[]
  const dayOfYear = getDayOfYear(date)
  const cardIndex = dayOfYear % cards.length
  const card = cards[cardIndex]

  if (!card) {
    throw new Error("No card found for daily tarot")
  }

  const isReversed = date.getDate() % 2 === 0

  return {
    id: card.id,
    name: card.name,
    image: card.imageUrl,
    meaning: card.meaningUp,
    reversedMeaning: card.meaningReversed,
    isReversed,
  }
}
