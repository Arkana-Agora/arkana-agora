"use client"

import { cn } from "@/lib/utils"
import { AnimatePresence, motion } from "framer-motion"
import Image from "next/image"

interface TarotCardProps {
  name: string
  imageUrl: string
  isReversed?: boolean
  isFlipped?: boolean
  onFlip?: () => void
  className?: string
}

export function TarotCard({
  name,
  imageUrl,
  isReversed = false,
  isFlipped = false,
  onFlip,
  className,
}: TarotCardProps) {
  return (
    <motion.div
      className={cn(
        "relative w-full aspect-[3/4] cursor-pointer perspective-1000",
        className,
      )}
      onClick={onFlip}
      style={{ perspective: 1000 }}
    >
      <AnimatePresence mode="wait">
        {isFlipped ? (
          <motion.div
            key="back"
            initial={{ rotateY: 90 }}
            animate={{ rotateY: 0 }}
            exit={{ rotateY: -90 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="absolute inset-0 w-full h-full backface-hidden rounded-lg overflow-hidden shadow-lg"
            style={{
              transformStyle: "preserve-3d",
              backfaceVisibility: "hidden",
              transform: isReversed ? "rotateY(180deg)" : "none",
            }}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-purple-900/90 to-purple-700/90 border border-purple-500/30 rounded-lg p-4 flex flex-col items-center justify-center">
              <div className="text-center text-white">
                <p className="text-xs text-purple-200 mb-2 uppercase tracking-wider">
                  Arcano {isReversed ? "(Invertido)" : ""}
                </p>
                <h3 className="text-lg font-semibold mb-2">{name}</h3>
                <div className="w-8 h-px bg-purple-400 mx-auto mb-3"></div>
                <p className="text-sm text-purple-100 text-center px-2 leading-relaxed">
                  {isReversed ? "Significado invertido" : "Significado normal"}
                </p>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="front"
            initial={{ rotateY: -90 }}
            animate={{ rotateY: 0 }}
            exit={{ rotateY: 90 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="absolute inset-0 w-full h-full backface-hidden rounded-lg overflow-hidden shadow-lg"
            style={{
              transformStyle: "preserve-3d",
              backfaceVisibility: "hidden",
            }}
          >
            <div className="relative w-full h-full">
              <Image
                src={imageUrl}
                alt={name}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-3">
                <h3 className="text-white font-semibold text-sm truncate">
                  {name}
                </h3>
                {isReversed && (
                  <span className="inline-block mt-1 px-2 py-0.5 text-xs bg-red-500/80 text-white rounded">
                    Invertida
                  </span>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
