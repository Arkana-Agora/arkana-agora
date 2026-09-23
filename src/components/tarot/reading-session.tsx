"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { useReadingStore } from "@/stores/reading-store"
import {
  useCreateReading,
  useDailyCount,
  useDecks,
  useSpreads,
} from "@/hooks/use-readings"
import { DeckSelector } from "./deck-selector"
import { SpreadSelector } from "./spread-selector"
import { DailyLimitBanner } from "./daily-limit-banner"
import { CardTable } from "./card-table"
import { CardDetailPanel } from "./card-detail-panel"
import { ShareModal } from "./share-modal"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { ErrorBoundary } from "@/components/error-boundary"
import { getDeckCards } from "@/lib/tarot/decks"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import type { Spread } from "@/types/tarot"

interface ReadingSessionProps {
  className?: string
}

interface EnrichedCard {
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
}

function enrichCards(
  deckId: string | null,
  cards: { cardId: string; positionIndex: number; isReversed: boolean }[],
): EnrichedCard[] {
  if (!deckId) return []
  const deckCards = getDeckCards(deckId) as Array<{
    id: string
    name: string
    imageUrl?: string
    meaningUp?: string
    meaningReversed?: string
  }>
  return cards.map((c) => {
    const found = deckCards.find((dc) => dc.id === c.cardId)
    return {
      cardId: c.cardId,
      positionIndex: c.positionIndex,
      isReversed: c.isReversed,
      card: {
        id: c.cardId,
        name: found?.name ?? c.cardId,
        imageUrl: found?.imageUrl ?? "",
        meaning: found?.meaningUp ?? "",
        reversedMeaning: found?.meaningReversed ?? "",
      },
    }
  })
}

export function ReadingSession({ className }: ReadingSessionProps) {
  const router = useRouter()
  const {
    step,
    deckId,
    spreadId,
    cards,
    flippedCards,
    createdReadingId,
    selectDeck,
    selectSpread,
    setCards,
    setCreatedReadingId,
    setFlippedCard,
    reset,
  } = useReadingStore()

  const { data: dailyCount, isLoading: dailyLoading } = useDailyCount()
  const { data: decks, isLoading: decksLoading } = useDecks()
  const { data: spreads, isLoading: spreadsLoading } = useSpreads()
  const createReading = useCreateReading()
  const mutateAsyncRef = useRef(createReading.mutateAsync)
  useEffect(() => {
    mutateAsyncRef.current = createReading.mutateAsync
  }, [createReading.mutateAsync])

  const [drawError, setDrawError] = useState<string | null>(null)
  const [selectedDetail, setSelectedDetail] = useState<EnrichedCard | null>(
    null,
  )
  const [shareOpen, setShareOpen] = useState(false)
  const drawStartedRef = useRef(false)
  const drawSeqRef = useRef(0)

  const spread: Spread | undefined = spreads?.find((s) => s.id === spreadId)
  const enrichedCards = enrichCards(deckId, cards)
  const flippedSet = new Set(flippedCards)

  const handleReset = useCallback(() => {
    drawSeqRef.current += 1
    reset()
  }, [reset])

  useEffect(() => {
    return () => {
      drawSeqRef.current += 1
    }
  }, [])

  const runDraw = useCallback(async () => {
    if (!deckId || !spreadId) return
    const seq = ++drawSeqRef.current
    setDrawError(null)
    try {
      const res = await mutateAsyncRef.current({ deckId, spreadId })
      if (seq !== drawSeqRef.current) return
      setCreatedReadingId(res.reading.id)
      setCards(res.reading.cards)
    } catch (err) {
      if (seq !== drawSeqRef.current) return
      const status = (err as { response?: { status?: number } })?.response
        ?.status
      if (status === 429) {
        setDrawError("Você atingiu o limite diário de tiragens.")
        toast.error("Limite diário de tiragens atingido.")
      } else {
        setDrawError("Não foi possível criar a tiragem. Tente novamente.")
        toast.error("Erro ao criar tiragem.")
      }
    }
  }, [deckId, spreadId, setCards, setCreatedReadingId])

  useEffect(() => {
    if (step !== "draw" || !deckId || !spreadId) {
      drawStartedRef.current = false
      return
    }
    if (drawStartedRef.current) return
    drawStartedRef.current = true
    void runDraw()
  }, [step, deckId, spreadId, runDraw])

  const handleFlip = (positionIndex: number) => {
    setFlippedCard(positionIndex)
    const card = enrichedCards.find((c) => c.positionIndex === positionIndex)
    if (card && !flippedCards.includes(positionIndex)) {
      setSelectedDetail(card)
    }
  }

  return (
    <main className={cn("mx-auto max-w-4xl space-y-6 p-4", className)}>
      <ErrorBoundary
        fallback={
          <div className="p-4 text-center">
            <p className="text-destructive">
              Erro ao carregar o motor de tiragem
            </p>
            <Button
              variant="outline"
              onClick={() => window.location.reload()}
              className="mt-2"
            >
              Tentar novamente
            </Button>
          </div>
        }
      >
        <h1 className="text-3xl font-bold">Tirar Cartas</h1>

        {dailyLoading ? (
          <Skeleton className="h-16 w-full" />
        ) : dailyCount ? (
          <DailyLimitBanner
            limit={dailyCount.totalLimit}
            remaining={dailyCount.remaining}
            tier={dailyCount.tier}
          />
        ) : null}

        {step === "deck" && (
          <section>
            <h2 className="mb-4 text-xl font-semibold">Escolha o baralho</h2>
            {decksLoading ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-48 w-full rounded-lg" />
                ))}
              </div>
            ) : (
              <DeckSelector decks={decks ?? []} onSelect={selectDeck} />
            )}
          </section>
        )}

        {step === "spread" && (
          <section>
            <h2 className="mb-4 text-xl font-semibold">
              Escolha o espalhamento
            </h2>
            {spreadsLoading ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-32 w-full rounded-lg" />
                ))}
              </div>
            ) : (
              <SpreadSelector spreads={spreads ?? []} onSelect={selectSpread} />
            )}
            <Button variant="ghost" className="mt-4" onClick={handleReset}>
              Voltar
            </Button>
          </section>
        )}

        {step === "draw" && (
          <section className="space-y-4" aria-live="polite">
            {createReading.isPending ? (
              <p className="text-muted-foreground">Preparando sua tiragem...</p>
            ) : null}
            {drawError ? (
              <div className="space-y-2">
                <p className="text-destructive">{drawError}</p>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={createReading.isPending}
                  onClick={() => void runDraw()}
                >
                  Tentar novamente
                </Button>
              </div>
            ) : null}
            <Button variant="ghost" onClick={handleReset}>
              Cancelar
            </Button>
          </section>
        )}

        {step === "reveal" && spread && (
          <section className="space-y-6">
            <CardTable
              spread={spread}
              cards={enrichedCards}
              onCardFlip={handleFlip}
              flippedCards={flippedSet}
            />

            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  if (createdReadingId) {
                    router.push(`/tiragem/${createdReadingId}`)
                  }
                }}
                disabled={!createdReadingId}
              >
                Ver detalhes e interpretação
              </Button>
              <Button
                variant="outline"
                onClick={() => setShareOpen(true)}
                disabled={!createdReadingId}
              >
                Compartilhar
              </Button>
              <Button variant="ghost" onClick={handleReset}>
                Nova tiragem
              </Button>
            </div>
          </section>
        )}
      </ErrorBoundary>

      <CardDetailPanel
        isOpen={!!selectedDetail}
        onClose={() => setSelectedDetail(null)}
        card={
          selectedDetail
            ? {
                ...selectedDetail.card,
                isReversed: selectedDetail.isReversed,
              }
            : null
        }
      />

      <ShareModal
        isOpen={shareOpen}
        onClose={() => setShareOpen(false)}
        readingId={createdReadingId ?? ""}
        readingTitle={
          enrichedCards.length > 0
            ? `Tiragem ${spread?.name ?? ""}`
            : "Minha tiragem"
        }
      />
    </main>
  )
}

export default ReadingSession
