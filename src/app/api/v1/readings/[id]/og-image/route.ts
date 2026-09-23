import sharp from "sharp"
import { requireAuth } from "@/app/api/v1/users/_helpers"
import { apiError } from "@/lib/api-response"
import { logger, newReqId } from "@/lib/logger"
import { prisma } from "@/lib/prisma"
import { getDeckCards } from "@/lib/tarot/decks"
import spreadsData from "@/data/spreads.json"
import type { Spread } from "@/types/tarot"

export const dynamic = "force-dynamic"

const WIDTH = 1200
const HEIGHT = 630

const spreads = spreadsData as Spread[]

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
}

function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value
}

function buildOgSvg(opts: {
  title: string
  spreadName: string
  cardNames: string[]
}): string {
  const { title, spreadName, cardNames } = opts
  const cardsLine = cardNames.join(" · ") || "Tiragem"

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#1e1035"/>
      <stop offset="55%" stop-color="#2d1b4e"/>
      <stop offset="100%" stop-color="#0f0a1e"/>
    </linearGradient>
    <linearGradient id="accent" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#a78bfa"/>
      <stop offset="100%" stop-color="#f0abfc"/>
    </linearGradient>
  </defs>
  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#bg)"/>
  <circle cx="1050" cy="120" r="180" fill="#7c3aed" opacity="0.18"/>
  <circle cx="150" cy="520" r="140" fill="#d946ef" opacity="0.12"/>
  <rect x="60" y="60" width="72" height="72" rx="16" fill="url(#accent)"/>
  <text x="96" y="112" font-family="Georgia, serif" font-size="44" font-weight="bold" fill="#1e1035" text-anchor="middle">✦</text>
  <text x="156" y="108" font-family="Georgia, serif" font-size="36" font-weight="bold" fill="#f5f3ff">Arkana Agora</text>
  <text x="156" y="146" font-family="Helvetica, Arial, sans-serif" font-size="20" fill="#c4b5fd" letter-spacing="4">${escapeXml(spreadName.toUpperCase())}</text>
  <text x="60" y="300" font-family="Georgia, serif" font-size="56" font-weight="bold" fill="#ffffff">${escapeXml(truncate(title, 34))}</text>
  <rect x="60" y="330" width="180" height="4" rx="2" fill="url(#accent)"/>
  <text x="60" y="400" font-family="Helvetica, Arial, sans-serif" font-size="26" fill="#ddd6fe">${escapeXml(truncate(cardsLine, 70))}</text>
  <text x="60" y="570" font-family="Helvetica, Arial, sans-serif" font-size="20" fill="#a78bfa">arkanaagora.com</text>
</svg>`
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const reqId = newReqId()
  const { id } = await params

  let userId: string | null = null
  const authHeader = request.headers.get("authorization")
  if (authHeader?.startsWith("Bearer ")) {
    const auth = await requireAuth(request, reqId)
    if (!(auth instanceof Response)) userId = auth.userId
  }

  try {
    const reading = await prisma.reading.findFirst({
      where: userId
        ? { id, OR: [{ userId }, { isPublic: true }] }
        : { id, isPublic: true },
      include: {
        cards: {
          orderBy: { positionIndex: "asc" },
        },
      },
    })

    if (!reading) {
      logger.info(
        { reqId, readingId: id },
        "[reading:og-image] nao encontrada ou acesso negado",
      )
      return apiError("NOT_FOUND", "Reading nao encontrada", reqId, 404)
    }

    const spread =
      spreads.find((s) => s.id === reading.spreadId) ??
      ({ id: reading.spreadId, name: "Tiragem" } as Spread)

    const deckCards = getDeckCards(reading.deckId)
    const cardNames = reading.cards.map((rc) => {
      const card = deckCards.find((c) => c.id === rc.cardId)
      return card ? card.name : rc.cardId
    })

    const svg = buildOgSvg({
      title: reading.title ?? `Tiragem de ${spread.name ?? "Tarot"}`,
      spreadName: spread.name ?? "Tiragem",
      cardNames,
    })

    const png = await sharp(Buffer.from(svg)).png().toBuffer()

    return new Response(new Uint8Array(png), {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Content-Length": String(png.length),
        "Cache-Control": reading.isPublic
          ? "public, max-age=3600, s-maxage=86400"
          : "private, no-store",
        Vary: "Authorization",
      },
    })
  } catch (err) {
    logger.error({ reqId, err }, "[reading:og-image] erro ao gerar OG image")
    return apiError("INTERNAL_ERROR", "Erro interno", reqId, 500)
  }
}
