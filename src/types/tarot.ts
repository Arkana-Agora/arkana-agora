export type DeckId = "rws" | "thoth" | "lenormand"

export type DeckType = "tarot" | "lenormand"

export type Suit = "wands" | "cups" | "swords" | "pentacles"

export type SuitName = "Paus" | "Copas" | "Espadas" | "Ouros"

export type CardType = "major" | "minor"

export type SpreadDifficulty = "beginner" | "intermediate" | "advanced"

export type SpreadLayout = "linear" | "cross" | "grid" | "diamond" | "custom"

export interface Deck {
  id: DeckId
  name: string
  description: string
  author: string
  year: number
  cardCount: number
  hasReversals: boolean
  coverImageUrl: string
  cardBackImageUrl: string
}

export interface TarotCard {
  id: string
  deckId: "rws" | "thoth"
  type: CardType
  number: number
  name: string
  suit?: Suit
  suitName?: SuitName
  keywords: string[]
  meaningUp: string
  meaningReversed: string
  advice: string
  imageUrl: string
  element?: string
  astrology?: string
  numerology?: number
}

export interface LenormandCard {
  id: string
  number: number
  name: string
  keywords: string[]
  meaningGeneral: string
  meaningLove: string
  meaningWork: string
  meaningHealth: string
  imageUrl: string
  category: string
}

export type Card = TarotCard | LenormandCard

export interface Spread {
  id: string
  name: string
  description: string
  deckType: DeckType
  cardCount: number
  difficulty: SpreadDifficulty
  estimatedTime: number
  positions: SpreadPosition[]
  layout: SpreadLayout
}

export interface SpreadPosition {
  id: string
  name: string
  description: string
  gridX?: number
  gridY?: number
}

export interface DrawnCard {
  card: Card
  isReversed: boolean
  position: number
}

export type YesNoAnswer = "yes" | "no" | "maybe"

export interface YesNoResult {
  answer: YesNoAnswer
  confidence: number
}

export interface DailyLimitResult {
  allowed: boolean
  remaining: number
  absoluteLimit: number
  tier: string
}
