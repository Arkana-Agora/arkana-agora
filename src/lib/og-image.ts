import { ImageResponse } from "@vercel/og"
import { createElement } from "react"
import sharp from "sharp"

import { logger } from "@/lib/logger"

/**
 * OG image (T029/US-022): template SVG 1200×630 do post, renderizado
 * com sharp (PNG); fallback @vercel/og quando o sharp falhar (rota T058).
 * SOMENTE SERVIDOR: sharp/@vercel/og são Node-only — nunca importar deste
 * módulo em client component (review N-INF-3; `import "server-only"` ficou
 * de fora porque o pacote não é dependência e quebraria os testes em vitest).
 */

export const OG_WIDTH = 1200
export const OG_HEIGHT = 630

const CONTENT_MAX_CHARS = 280
const LINE_MAX_CHARS = 44
const MAX_LINES = 4

export interface OgPostInput {
  content: string
  authorName: string
  type: string // 'text' | 'image' | 'reading'
  /** legenda extra opcional (ex.: "Tiragem: Sim/Não") */
  preview?: string
}

// Caracteres inválidos em XML 1.0: controles (exceto tab/CR/LF), U+FFFE/
// U+FFFF e surrogates órfãos — quebram o parser do sharp/librsvg.
const INVALID_XML_CHARS =
  /[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g

export function escapeXml(value: string): string {
  return value
    .replace(INVALID_XML_CHARS, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
}

// Corte por code point (review S-N7): slice() em UTF-16 pode partir um par
// de surrogates e deixar caractere órfão (quebra o SVG/PNG).
function sliceCodePoints(value: string, max: number): string {
  const points = Array.from(value)
  return points.length <= max ? value : points.slice(0, max).join("")
}

function truncate(value: string, max: number): string {
  const clean = value.replace(/\s+/g, " ").trim()
  const points = Array.from(clean)
  return points.length <= max ? clean : `${points.slice(0, max - 1).join("")}…`
}

/** Quebra o texto em até MAX_LINES linhas de ~LINE_MAX_CHARS. */
function wrapLines(text: string): string[] {
  const words = text.split(" ")
  const lines: string[] = []
  let current = ""
  for (const word of words) {
    if ((current + " " + word).trim().length > LINE_MAX_CHARS) {
      if (current) lines.push(current.trim())
      current = word
      if (lines.length === MAX_LINES) break
    } else {
      current = `${current} ${word}`
    }
  }
  if (current && lines.length < MAX_LINES) lines.push(current.trim())
  if (lines.length === MAX_LINES) {
    const last = lines[MAX_LINES - 1]!
    lines[MAX_LINES - 1] =
      last.length >= LINE_MAX_CHARS
        ? `${sliceCodePoints(last, LINE_MAX_CHARS - 1)}…`
        : last
  }
  return lines
}

export function buildPostOgSvg(post: OgPostInput): string {
  const title = escapeXml(truncate(post.authorName, 60))
  const body = escapeXml(truncate(post.content, CONTENT_MAX_CHARS))
  const lines = wrapLines(truncate(post.content, CONTENT_MAX_CHARS))
    .map(
      (line, index) =>
        `<tspan x="80" dy="${index === 0 ? 0 : 46}">${escapeXml(line)}</tspan>`,
    )
    .join("")
  const preview = post.preview
    ? `<text x="80" y="560" font-size="26" fill="#a78bfa" font-family="sans-serif">${escapeXml(truncate(post.preview, 80))}</text>`
    : ""
  // body já é XML escapado uma única vez — re-escapar duplicaria entidades
  // no aria-label ("&amp;amp;")
  const ariaLabel = body

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${OG_WIDTH}" height="${OG_HEIGHT}" viewBox="0 0 ${OG_WIDTH} ${OG_HEIGHT}" role="img" aria-label="${ariaLabel}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#1e1b4b"/>
      <stop offset="55%" stop-color="#312e81"/>
      <stop offset="100%" stop-color="#4c1d95"/>
    </linearGradient>
  </defs>
  <rect width="${OG_WIDTH}" height="${OG_HEIGHT}" fill="url(#bg)"/>
  <circle cx="1080" cy="120" r="180" fill="#7c3aed" opacity="0.25"/>
  <circle cx="120" cy="560" r="140" fill="#a78bfa" opacity="0.18"/>
  <text x="80" y="110" font-size="34" fill="#c4b5fd" font-family="sans-serif" letter-spacing="6">ARKANA AGORA</text>
  <text x="80" y="190" font-size="44" fill="#ffffff" font-family="sans-serif" font-weight="bold">${title}</text>
  <text x="80" y="270" font-size="34" fill="#e9e5ff" font-family="sans-serif">${lines}</text>
  ${preview}
</svg>`
}

async function fallbackWithVercelOg(post: OgPostInput): Promise<Buffer> {
  const response = new ImageResponse(
    createElement(
      "div",
      {
        style: {
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          backgroundColor: "#312e81",
          color: "#ffffff",
          padding: "64px",
          fontFamily: "sans-serif",
        },
      },
      createElement(
        "div",
        { style: { fontSize: 32, color: "#c4b5fd", letterSpacing: 6 } },
        "ARKANA AGORA",
      ),
      createElement(
        "div",
        { style: { fontSize: 44, fontWeight: 700 } },
        truncate(post.authorName, 60),
      ),
      createElement(
        "div",
        { style: { fontSize: 32, display: "flex", flexWrap: "wrap" } },
        truncate(post.content, CONTENT_MAX_CHARS),
      ),
    ),
    { width: OG_WIDTH, height: OG_HEIGHT },
  )
  return Buffer.from(await response.arrayBuffer())
}

export async function generatePostOgImage(post: OgPostInput): Promise<Buffer> {
  const svg = buildPostOgSvg(post)
  try {
    return await sharp(Buffer.from(svg)).png().toBuffer()
  } catch (error) {
    logger.warn(
      { err: error, type: post.type },
      "[og-image] sharp falhou, usando @vercel/og",
    )
    return fallbackWithVercelOg(post)
  }
}
