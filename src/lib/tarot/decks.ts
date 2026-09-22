import type {
  Deck,
  TarotCard,
  LenormandCard,
  Card,
  DeckId,
} from "@/types/tarot"
import rwsData from "@/data/decks/rws.json"
import thothData from "@/data/decks/thoth.json"
import lenormandData from "@/data/decks/lenormand.json"

type DeckData = { deck: Deck; cards: TarotCard[] | LenormandCard[] }

const DECKS: Record<DeckId, DeckData> = {
  rws: rwsData as DeckData,
  thoth: thothData as DeckData,
  lenormand: lenormandData as DeckData,
}

export const DECK_IDS: readonly DeckId[] = Object.keys(DECKS) as DeckId[]

export function getAvailableDecks(): Deck[] {
  return Object.values(DECKS).map((d) => d.deck)
}

export function getDeckById(id: string): Deck | undefined {
  return DECKS[id as DeckId]?.deck
}

export function getDeckCards(id: string): Card[] {
  const deck = DECKS[id as DeckId]
  return deck ? (deck.cards as Card[]) : []
}
