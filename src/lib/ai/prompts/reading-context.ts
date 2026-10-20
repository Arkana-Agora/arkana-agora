import spreadsData from "@/data/spreads.json"
import { getDeckById, getDeckCards } from "@/lib/tarot/decks"
import type { InterpretationMode } from "@/lib/ai/cache"
import type { Card, LenormandCard, Spread, TarotCard } from "@/types/tarot"

const spreads = spreadsData as Spread[]

export interface ReadingPromptSource {
  deckId: string
  spreadId: string
  cards: Array<{
    cardId: string
    positionIndex: number
    isReversed: boolean
  }>
}

export interface ResolvedPromptCard {
  position: string
  positionDescription: string
  cardName: string
  cardNumber: number
  isReversed: boolean
  meaning: string
  keywords: string[]
  advice: string
}

export interface ResolvedReadingContext {
  deckName: string
  deckDescription: string
  spreadName: string
  spreadDescription: string
  cards: ResolvedPromptCard[]
}

function isLenormand(card: Card): card is LenormandCard {
  return "meaningGeneral" in card
}

function isTarot(card: Card): card is TarotCard {
  return "meaningUp" in card
}

function resolveMeaning(
  card: Card | undefined,
  isReversed: boolean,
  mode: InterpretationMode,
): string {
  if (!card) return ""
  if (isTarot(card)) return isReversed ? card.meaningReversed : card.meaningUp
  if (isLenormand(card)) {
    if (mode === "love") return card.meaningLove
    if (mode === "career") return card.meaningWork
    return card.meaningGeneral
  }
  return ""
}

// A IA so interpreta bem uma tiragem se receber os nomes reais das cartas, do
// baralho, do espalhamento e das posicoes — nunca os ids crus do banco. Este
// resolver traduz o contexto persistido (deckId/spreadId/cardId) para o
// conteudo editorial dos baralhos em `src/data/decks/*.json` + `spreads.json`.
export function resolveReadingPromptContext(
  reading: ReadingPromptSource,
  mode: InterpretationMode,
): ResolvedReadingContext {
  const deck = getDeckById(reading.deckId)
  const spread = spreads.find((s) => s.id === reading.spreadId)
  const deckCards = getDeckCards(reading.deckId)

  return {
    deckName: deck?.name ?? reading.deckId,
    deckDescription: deck?.description ?? "",
    spreadName: spread?.name ?? reading.spreadId,
    spreadDescription: spread?.description ?? "",
    cards: reading.cards.map((c) => {
      const card = deckCards.find((dc) => dc.id === c.cardId)
      const position = spread?.positions?.[c.positionIndex]
      return {
        position: position?.name ?? `Posicao ${c.positionIndex + 1}`,
        positionDescription: position?.description ?? "",
        cardName: card?.name ?? c.cardId,
        cardNumber: card?.number ?? c.positionIndex,
        isReversed: c.isReversed,
        meaning: resolveMeaning(card, c.isReversed, mode),
        keywords: card?.keywords ?? [],
        advice: card && isTarot(card) ? card.advice : "",
      }
    }),
  }
}
