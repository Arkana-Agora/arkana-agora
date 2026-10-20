"use client"

import { cn } from "@/lib/utils"
import { AnimatePresence, motion } from "framer-motion"
import { DeckImage } from "@/components/tarot/deck-image"
import { CardBack } from "@/components/tarot/card-back"

// BR-TIR-002 / spec 003 §1.4: variantes de tamanho da carta. Os tamanhos sao
// explicitos em px (proporcao 4:7) porque o wrapper posicionado da mesa e
// shrink-to-fit: sem width/height reais a carta colapsaria para 0x0.
export type TarotCardSize = "small" | "medium" | "large"

export const TAROT_CARD_SIZES: Record<
  TarotCardSize,
  { width: number; height: number }
> = {
  small: { width: 80, height: 140 },
  medium: { width: 120, height: 210 },
  large: { width: 180, height: 315 },
}

// Overlay da face precisa escalar com a carta, senao o nome de 80px de largura
// fica truncado em zero caracteres.
const CARD_OVERLAY: Record<TarotCardSize, string> = {
  small: "p-1.5 text-[10px]",
  medium: "p-2 text-xs",
  large: "p-3 text-sm",
}

interface TarotCardProps {
  name: string
  imageUrl: string
  backImageUrl?: string | undefined
  isReversed?: boolean
  isFlipped?: boolean
  size?: TarotCardSize
  onFlip?: () => void
  className?: string
}

// BR-TIR-002 / spec 003 §1.4: face down mostra o VERSO do baralho; face up
// mostra a FRENTE da carta (imagem + nome + orientacao). O par imagem/verso
// vem do baralho (cardBackImageUrl) — nunca revelar a face antes do flip.
export function TarotCard({
  name,
  imageUrl,
  backImageUrl,
  isReversed = false,
  isFlipped = false,
  size = "medium",
  onFlip,
  className,
}: TarotCardProps) {
  const interactive = Boolean(onFlip)
  const dimensions = TAROT_CARD_SIZES[size]
  return (
    <motion.div
      className={cn("relative cursor-pointer", className)}
      onClick={onFlip}
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      aria-pressed={interactive ? isFlipped : undefined}
      aria-label={
        interactive
          ? isFlipped
            ? `${name} (revelada)`
            : `Virar carta: ${name}`
          : undefined
      }
      onKeyDown={
        interactive
          ? (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault()
                onFlip?.()
              }
            }
          : undefined
      }
      style={{
        perspective: 1000,
        width: dimensions.width,
        height: dimensions.height,
      }}
    >
      <AnimatePresence mode="wait" initial={false}>
        {isFlipped ? (
          <motion.div
            key="face"
            initial={{ rotateY: -90, opacity: 0 }}
            animate={{ rotateY: 0, opacity: 1 }}
            exit={{ rotateY: 90, opacity: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="absolute inset-0 h-full w-full overflow-hidden rounded-lg shadow-lg backface-hidden"
            style={{
              transformStyle: "preserve-3d",
              backfaceVisibility: "hidden",
            }}
          >
            <div className="relative h-full w-full">
              {/* spec 003 §1.4: carta invertida => imagem rotacionada 180° no
                  eixo Z (de cabeca para baixo); nome/badge permanecem legiveis. */}
              <div
                className={cn("absolute inset-0", isReversed && "rotate-180")}
              >
                <DeckImage
                  src={imageUrl}
                  alt={name}
                  fallbackLabel={name}
                  fill
                />
              </div>
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
              <div
                className={cn(
                  "absolute inset-x-0 bottom-0",
                  CARD_OVERLAY[size],
                )}
              >
                <h3 className="truncate font-semibold text-white">{name}</h3>
                {isReversed && (
                  <span className="mt-1 inline-block rounded bg-red-500/80 px-2 py-0.5 text-xs text-white">
                    Invertida
                  </span>
                )}
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="verso"
            initial={{ rotateY: 90, opacity: 0 }}
            animate={{ rotateY: 0, opacity: 1 }}
            exit={{ rotateY: -90, opacity: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="absolute inset-0 h-full w-full overflow-hidden rounded-lg shadow-lg backface-hidden"
            style={{
              transformStyle: "preserve-3d",
              backfaceVisibility: "hidden",
            }}
          >
            <CardBack backImageUrl={backImageUrl} />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
