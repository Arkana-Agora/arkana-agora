"use client"

import type { Spread } from "@/types/tarot"

interface SpreadSelectorProps {
  spreads: Spread[]
  selectedSpreadId?: string | null
  deckType?: string
  onSelect: (spreadId: string) => void
}

export function SpreadSelector({
  spreads,
  selectedSpreadId,
  deckType,
  onSelect,
}: SpreadSelectorProps) {
  const filtered = deckType
    ? spreads.filter((s) => s.deckType === deckType)
    : spreads

  if (filtered.length === 0) {
    return (
      <p className="text-muted-foreground">
        Nenhum espalhamento disponível para este baralho.
      </p>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {filtered.map((spread) => (
        <button
          key={spread.id}
          data-selected={spread.id === selectedSpreadId}
          onClick={() => onSelect(spread.id)}
          className="flex flex-col items-start rounded-lg border p-4 text-left transition-colors hover:bg-muted data-[selected=true]:border-primary data-[selected=true]:bg-accent"
        >
          <h3 className="text-lg font-semibold">{spread.name}</h3>
          <p className="text-sm text-muted-foreground">{spread.description}</p>
          <div className="mt-2 flex gap-2 text-xs text-muted-foreground">
            <span>{spread.cardCount} cartas</span>
            <span>·</span>
            <span>~{spread.estimatedTime} min</span>
            <span>·</span>
            <span className="capitalize">{spread.difficulty}</span>
          </div>
        </button>
      ))}
    </div>
  )
}
