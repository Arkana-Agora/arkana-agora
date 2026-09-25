"use client"

import Image from "next/image"
import { useState } from "react"

import { cn } from "@/lib/utils"

interface DeckImageProps {
  src: string
  alt: string
  fallbackLabel: string
  className?: string
  fill?: boolean
  width?: number
  height?: number
  sizes?: string
  priority?: boolean
}

// Deck/cover art lives under /images/decks/** which may be absent (art is
// licensed, not shipped with the repo). When an image 404s, render a graceful
// gradient placeholder instead of a broken <img>. The inner component is keyed
// by src, so a later-added asset is picked up automatically (fresh state).
export function DeckImage(props: DeckImageProps) {
  return <DeckImageInner key={props.src} {...props} />
}

function DeckImageInner({
  src,
  alt,
  fallbackLabel,
  className,
  fill = false,
  width,
  height,
  sizes,
  priority,
}: DeckImageProps) {
  const [failed, setFailed] = useState(false)

  if (failed) {
    return (
      <div
        role="img"
        aria-label={alt}
        className={cn(
          "flex items-center justify-center bg-gradient-to-br from-primary/20 to-primary/10",
          fill && "absolute inset-0 h-full w-full",
          className,
        )}
      >
        <span className="px-3 text-center font-semibold text-muted-foreground">
          {fallbackLabel}
        </span>
      </div>
    )
  }

  return (
    <Image
      src={src}
      alt={alt}
      fill={fill}
      className={cn(fill && "object-cover", className)}
      onError={() => setFailed(true)}
      {...(width !== undefined ? { width } : {})}
      {...(height !== undefined ? { height } : {})}
      {...(sizes !== undefined ? { sizes } : {})}
      {...(priority ? { priority: true } : {})}
    />
  )
}
