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
// card-like placeholder instead of a broken <img>. The inner component is keyed
// by src, so a later-added asset is picked up automatically (fresh state).
export function DeckImage(props: DeckImageProps) {
  return <DeckImageInner key={props.src} {...props} />
}

function CardFrontPlaceholder({
  fallbackLabel,
  className,
  fill = false,
}: {
  fallbackLabel: string
  className?: string | undefined
  fill?: boolean
}) {
  return (
    <div
      role="img"
      aria-label={fallbackLabel}
      className={cn(
        "relative flex items-center justify-center bg-gradient-to-br from-primary/20 to-primary/10",
        fill && "absolute inset-0 h-full w-full",
        className,
      )}
      style={{ aspectRatio: "315 / 525" }}
    >
      <svg
        viewBox="0 0 315 525"
        width="100%"
        height="100%"
        preserveAspectRatio="xMidYMid meet"
        style={{ width: "100%", height: "100%" }}
      >
        <defs>
          <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop
              offset="0%"
              style={{ stopColor: "#fafafa", stopOpacity: 1 }}
            />
            <stop
              offset="100%"
              style={{ stopColor: "#f0f0f0", stopOpacity: 1 }}
            />
          </linearGradient>
          <linearGradient id="gold" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop
              offset="0%"
              style={{ stopColor: "#d4a843", stopOpacity: 1 }}
            />
            <stop
              offset="50%"
              style={{ stopColor: "#b8860b", stopOpacity: 1 }}
            />
            <stop
              offset="100%"
              style={{ stopColor: "#d4a843", stopOpacity: 1 }}
            />
          </linearGradient>
          <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="1.5" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <pattern
            id="pattern"
            x="0"
            y="0"
            width="30"
            height="30"
            patternUnits="userSpaceOnUse"
          >
            <circle cx="15" cy="15" r="1.5" fill="#e8c56d" opacity="0.1" />
          </pattern>
        </defs>

        {/* Background */}
        <rect width="315" height="525" fill="url(#bg)" />
        <rect width="315" height="525" fill="url(#pattern)" />

        {/* Border */}
        <rect
          x="8"
          y="8"
          width="299"
          height="509"
          rx="12"
          fill="none"
          stroke="url(#gold)"
          strokeWidth="2"
        />
        <rect
          x="14"
          y="14"
          width="287"
          height="497"
          rx="10"
          fill="none"
          stroke="url(#gold)"
          strokeWidth="1"
          opacity="0.3"
        />

        {/* Central decorative area */}
        <g transform="translate(157.5, 262.5)">
          <circle
            cx="0"
            cy="0"
            r="110"
            fill="none"
            stroke="url(#gold)"
            strokeWidth="1.5"
            opacity="0.6"
          />
          <circle
            cx="0"
            cy="0"
            r="90"
            fill="none"
            stroke="url(#gold)"
            strokeWidth="0.5"
            opacity="0.3"
          />

          <g
            stroke="url(#gold)"
            strokeWidth="1.5"
            opacity="0.5"
            filter="url(#glow)"
          >
            <line x1="0" y1="-70" x2="0" y2="-85" />
            <line x1="0" y1="70" x2="0" y2="85" />
            <line x1="-70" y1="0" x2="-85" y2="0" />
            <line x1="70" y1="0" x2="85" y2="0" />
            <line x1="-50" y1="-50" x2="-60" y2="-60" />
            <line x1="50" y1="50" x2="60" y2="60" />
            <line x1="-50" y1="50" x2="-60" y2="60" />
            <line x1="50" y1="-50" x2="60" y2="-60" />
          </g>

          <circle
            cx="0"
            cy="0"
            r="50"
            fill="url(#bg)"
            stroke="url(#gold)"
            strokeWidth="1.5"
          />

          <g fill="url(#gold)" opacity="0.7">
            <circle
              cx="0"
              cy="0"
              r="12"
              fill="none"
              stroke="url(#gold)"
              strokeWidth="2"
            />
            <line
              x1="0"
              y1="-8"
              x2="0"
              y2="8"
              stroke="url(#gold)"
              strokeWidth="1.5"
            />
            <line
              x1="-8"
              y1="0"
              x2="8"
              y2="0"
              stroke="url(#gold)"
              strokeWidth="1.5"
            />
          </g>
        </g>

        <g stroke="url(#gold)" strokeWidth="1.5" opacity="0.4">
          <path d="M25,25 L25,45 M25,25 L45,25" fill="none" />
          <path d="M290,25 L270,25 M290,25 L290,45" fill="none" />
          <path d="M25,500 L25,480 M25,500 L45,500" fill="none" />
          <path d="M290,500 L290,480 L270,500" fill="none" />
        </g>

        <text
          x="157.5"
          y="495"
          textAnchor="middle"
          fontFamily="Georgia, serif"
          fontSize="11"
          fill="url(#gold)"
          opacity="0.6"
          letterSpacing="1.5"
        >
          ARCANA CARTA
        </text>
      </svg>
    </div>
  )
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
      <CardFrontPlaceholder
        fallbackLabel={fallbackLabel}
        className={className}
        fill={fill}
      />
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
