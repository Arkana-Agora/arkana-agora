"use client"

import { cn } from "@/lib/utils"
import type { Spread } from "@/types/tarot"
import { TarotCard } from "./tarot-card"

interface CardTableProps {
  spread: Spread
  cards: Array<{
    cardId: string
    positionIndex: number
    isReversed: boolean
    card: {
      id: string
      name: string
      imageUrl: string
      meaning: string
      reversedMeaning: string
    }
  }>
  onCardFlip?: (positionIndex: number) => void
  flippedCards?: Set<number>
  className?: string
}

interface SpreadLayout {
  positions: { x: number; y: number }[]
}

const SPREAD_LAYOUTS: Record<string, SpreadLayout> = {
  "single-card": { positions: [{ x: 50, y: 50 }] },
  "three-card": {
    positions: [
      { x: 15, y: 50 },
      { x: 50, y: 50 },
      { x: 85, y: 50 },
    ],
  },
  "yes-no": {
    positions: [{ x: 50, y: 50 }],
  },
  "celtic-cross": {
    positions: [
      { x: 50, y: 15 }, // 1. Present
      { x: 50, y: 35 }, // 2. Challenge
      { x: 50, y: 55 }, // 3. Past
      { x: 50, y: 75 }, // 4. Future
      { x: 20, y: 55 }, // 5. Above
      { x: 80, y: 55 }, // 6. Below
      { x: 5, y: 20 }, // 7. Advice
      { x: 95, y: 20 }, // 8. External
      { x: 5, y: 80 }, // 9. Hopes
      { x: 95, y: 80 }, // 10. Outcome
    ],
  },
  "love-cross": {
    positions: [
      { x: 30, y: 30 }, // 1. You
      { x: 70, y: 30 }, // 2. Partner
      { x: 50, y: 30 }, // 3. Connection
      { x: 15, y: 60 }, // 4. Challenge
      { x: 50, y: 60 }, // 5. Advice
      { x: 85, y: 60 }, // 6. Outcome
      { x: 50, y: 85 }, // 7. Lesson
    ],
  },
  "lenormand-3": {
    positions: [
      { x: 20, y: 50 },
      { x: 50, y: 50 },
      { x: 80, y: 50 },
    ],
  },
  "lenormand-5": {
    positions: [
      { x: 10, y: 50 },
      { x: 32, y: 50 },
      { x: 50, y: 50 },
      { x: 68, y: 50 },
      { x: 90, y: 50 },
    ],
  },
  "lenormand-9": {
    positions: [
      { x: 10, y: 20 },
      { x: 50, y: 20 },
      { x: 90, y: 20 },
      { x: 10, y: 50 },
      { x: 50, y: 50 },
      { x: 90, y: 50 },
      { x: 10, y: 80 },
      { x: 50, y: 80 },
      { x: 90, y: 80 },
    ],
  },
}

export function CardTable({
  spread,
  cards,
  onCardFlip,
  flippedCards = new Set(),
  className,
}: CardTableProps) {
  const layout =
    SPREAD_LAYOUTS[spread.id]?.positions ||
    SPREAD_LAYOUTS["three-card"]?.positions

  return (
    <div
      className={cn(
        "relative w-full aspect-[4/3] min-h-[300px] max-w-4xl mx-auto",
        className,
      )}
      style={{ position: "relative" }}
    >
      {cards.map((drawn, index) => {
        const position = layout?.[index] || { x: 50, y: 50 }
        const isFlipped = flippedCards.has(drawn.positionIndex)

        return (
          <div
            key={drawn.positionIndex}
            className="absolute"
            style={{
              left: `${position.x}%`,
              top: `${position.y}%`,
              transform: "translate(-50%, -50%)",
              zIndex: 10,
            }}
          >
            <TarotCard
              name={drawn.card.name}
              imageUrl={drawn.card.imageUrl}
              isReversed={drawn.isReversed}
              isFlipped={isFlipped}
              onFlip={() => onCardFlip?.(drawn.positionIndex)}
            />
          </div>
        )
      })}
    </div>
  )
}
