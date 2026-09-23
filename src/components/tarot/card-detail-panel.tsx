"use client"

import { cn } from "@/lib/utils"
import { AnimatePresence, motion } from "framer-motion"
import { X } from "lucide-react"
import Image from "next/image"

interface CardDetailPanelProps {
  isOpen: boolean
  onClose: () => void
  card?: {
    id: string
    name: string
    imageUrl: string
    meaning: string
    reversedMeaning: string
    isReversed?: boolean
    suit?: string
    number?: number
    element?: string
  } | null
}

export function CardDetailPanel({
  isOpen,
  onClose,
  card,
}: CardDetailPanelProps) {
  return (
    <AnimatePresence>
      {isOpen && card && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
            aria-hidden="true"
          />
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-background shadow-xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="card-detail-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex h-full flex-col">
              <div className="flex items-center justify-between p-4 border-b">
                <h2 id="card-detail-title" className="text-lg font-semibold">
                  {card.name}
                </h2>
                <button
                  onClick={onClose}
                  className="p-2 rounded-lg hover:bg-muted transition-colors"
                  aria-label="Fechar"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-6">
                <div className="aspect-[3/4] w-full max-w-xs mx-auto rounded-lg overflow-hidden bg-gradient-to-br from-primary/20 to-primary/10 border border-primary/20 relative">
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Image
                      src={card.imageUrl}
                      alt={card.name}
                      fill
                      className="object-cover opacity-80"
                    />
                  </div>
                </div>

                <div className="text-center space-y-2">
                  <h3 className="text-2xl font-bold">{card.name}</h3>
                  <p className="text-sm text-muted-foreground capitalize">
                    {card.suit ? `Naipe: ${card.suit}` : "Arcano Maior"}
                  </p>

                  {card.number !== undefined && (
                    <p className="text-sm text-muted-foreground">
                      Número: {card.number}
                    </p>
                  )}

                  {card.element && (
                    <p className="text-sm text-muted-foreground">
                      Elemento: {card.element}
                    </p>
                  )}

                  <div className="flex justify-center gap-2">
                    <span
                      className={cn(
                        "px-3 py-1 text-xs font-medium rounded-full",
                        card.isReversed
                          ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300"
                          : "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
                      )}
                    >
                      {card.isReversed ? "Invertida" : "Normal"}
                    </span>
                  </div>
                </div>

                <div className="space-y-4 pt-4 border-t">
                  <div>
                    <h4 className="font-semibold mb-2">Significado (Normal)</h4>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {card.meaning}
                    </p>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-2">
                      Significado (Invertido)
                    </h4>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {card.reversedMeaning}
                    </p>
                  </div>
                </div>

                <div className="pt-4 border-t">
                  <button
                    onClick={onClose}
                    className="w-full py-2 px-4 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
                  >
                    Fechar
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
