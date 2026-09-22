"use client"

import type { Deck, DeckId } from "@/types/tarot"
import Image from "next/image"

interface DeckSelectorProps {
  decks: Deck[]
  selectedDeckId?: DeckId | null
  onSelect: (deckId: DeckId) => void
}

export function DeckSelector({
  decks,
  selectedDeckId,
  onSelect,
}: DeckSelectorProps) {
  if (decks.length === 0) {
    return <p className="text-muted-foreground">Nenhum baralho disponível.</p>
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {decks.map((deck) => (
        <button
          key={deck.id}
          data-selected={deck.id === selectedDeckId}
          onClick={() => onSelect(deck.id)}
          className="flex flex-col items-start rounded-lg border p-4 text-left transition-colors hover:bg-muted data-[selected=true]:border-primary data-[selected=true]:bg-accent"
        >
          <Image
            src={deck.coverImageUrl}
            alt={deck.name}
            width={400}
            height={128}
            className="mb-2 h-32 w-full rounded object-cover"
          />
          <h3 className="text-lg font-semibold">{deck.name}</h3>
          <p className="text-sm text-muted-foreground">{deck.description}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {deck.cardCount} cartas · {deck.author} ({deck.year})
          </p>
        </button>
      ))}
    </div>
  )
}
