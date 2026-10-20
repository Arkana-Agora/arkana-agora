"use client"

import { cn } from "@/lib/utils"
import { DeckImage } from "@/components/tarot/deck-image"

export const CARD_BACK_ALT = "Carta virada para baixo"

interface CardBackProps {
  backImageUrl?: string | undefined
  fallbackLabel?: string
  className?: string
}

// VERSO do baralho (BR-TIR-002): renderizado em qualquer carta virada para
// baixo. Fonte unica do par imagem/verso + placeholder degradê, compartilhada
// por TarotCard e DailyTarot.
export function CardBack({
  backImageUrl,
  fallbackLabel = "Arkana Agora",
  className,
}: CardBackProps) {
  if (backImageUrl) {
    return (
      <DeckImage
        src={backImageUrl}
        alt={CARD_BACK_ALT}
        fallbackLabel={fallbackLabel}
        fill
      />
    )
  }

  return (
    <div
      role="img"
      aria-label={CARD_BACK_ALT}
      className={cn(
        "flex h-full w-full items-center justify-center bg-gradient-to-br from-purple-900 to-purple-700",
        className,
      )}
    >
      <span className="text-sm text-purple-200">{fallbackLabel}</span>
    </div>
  )
}
