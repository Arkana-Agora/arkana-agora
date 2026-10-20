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
import { ReadingAIPanel } from "@/components/ai/reading-ai-panel"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { ErrorBoundary } from "@/components/error-boundary"
import { getDeckCards, getDeckById } from "@/lib/tarot/decks"
import { useSequentialReveal } from "@/hooks/use-sequential-reveal"
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
    question,
    selectDeck,
    selectSpread,
    setQuestion,
    startDraw,
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
  // Seed vinda do store: em reload mid-draw o partialize rehidrata
  // step="question" + question persistida — o draft não pode começar vazio.
  const [questionDraft, setQuestionDraft] = useState(
    () => useReadingStore.getState().question,
  )
  const [selectedDetail, setSelectedDetail] = useState<EnrichedCard | null>(
    null,
  )
  const [shareOpen, setShareOpen] = useState(false)
  const drawStartedRef = useRef(false)
  const drawSeqRef = useRef(0)

  const spread: Spread | undefined = spreads?.find((s) => s.id === spreadId)
  const enrichedCards = enrichCards(deckId, cards)
  const flippedSet = new Set(flippedCards)
  // BR-TIR-003: o resumo cresce conforme cada carta e revelada.
  const revealedCards = enrichedCards.filter((drawn) =>
    flippedSet.has(drawn.positionIndex),
  )
  // VERSO do baralho (BR-TIR-002): a imagem de fundo da carta virada para
  // baixo vem do baralho, nao de uma carta especifica.
  const deckBackImageUrl = deckId
    ? getDeckById(deckId)?.cardBackImageUrl
    : undefined

  // BR-TIR-003: revela uma a uma, na ordem do espalhamento, 1.5s por carta;
  // o usuario pode adiantar clicando numa carta (a sequencia segue para as
  // demais). `isRevealed` evita re-armar timers para cartas ja viradas.
  useSequentialReveal({
    count: enrichedCards.length,
    enabled: step === "reveal",
    intervalMs: 1500,
    isRevealed: (index) => {
      const card = enrichedCards[index]
      if (!card) return false
      return useReadingStore
        .getState()
        .flippedCards.includes(card.positionIndex)
    },
    onReveal: (index) => {
      const card = enrichedCards[index]
      if (!card) return
      // setFlippedCard alterna — o reveal automatico so liga cartas ainda
      // fechadas (um clique manual durante a sequencia nao pode desvirar).
      if (useReadingStore.getState().flippedCards.includes(card.positionIndex))
        return
      setFlippedCard(card.positionIndex)
    },
  })

  const handleReset = useCallback(() => {
    drawSeqRef.current += 1
    setQuestionDraft("")
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

        {step === "question" && (
          <section className="space-y-4">
            <h2 className="text-xl font-semibold">Sua pergunta (opcional)</h2>
            <p className="text-sm text-muted-foreground">
              Escreva uma pergunta ou intenção para direcionar a leitura. Se
              preferir, pule e comece o sorteio.
            </p>
            <label htmlFor="reading-question" className="sr-only">
              Pergunta ou intencao
            </label>
            <textarea
              id="reading-question"
              maxLength={200}
              rows={3}
              value={questionDraft}
              onChange={(e) => setQuestionDraft(e.target.value)}
              placeholder="Ex: O que preciso saber sobre minha carreira agora?"
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            />
            <p className="text-xs text-muted-foreground">
              {questionDraft.length}/200
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() => {
                  setQuestion(questionDraft.trim())
                  startDraw()
                }}
              >
                Sortear cartas
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setQuestion("")
                  startDraw()
                }}
              >
                Pular
              </Button>
              <Button variant="ghost" onClick={handleReset}>
                Voltar
              </Button>
            </div>
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

        {step === "reveal" && (
          <section className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Sua tiragem</h2>
              <Button onClick={handleReset}>Nova tiragem</Button>
            </div>
            <div
              data-testid="reveal-grid"
              className="grid grid-cols-1 gap-6 lg:grid-cols-2"
            >
              <div className="space-y-4">
                {spread ? (
                  <CardTable
                    spread={spread}
                    cards={enrichedCards}
                    onCardFlip={handleFlip}
                    flippedCards={flippedSet}
                    backImageUrl={deckBackImageUrl}
                  />
                ) : (
                  <Skeleton className="h-64 w-full rounded-lg" />
                )}

                {/* Resumo textual das cartas ja reveladas (posicao +
                    orientacao) para quem nao acompanha a revelacao visual. */}
                {revealedCards.length > 0 && (
                  <ul
                    data-testid="drawn-cards-summary"
                    aria-label="Cartas tiradas"
                    className="space-y-1 rounded-lg border bg-muted/40 p-3 text-sm"
                  >
                    {revealedCards.map((drawn) => {
                      const positionName =
                        spread?.positions?.[drawn.positionIndex]?.name ??
                        `Carta ${drawn.positionIndex + 1}`
                      return (
                        <li key={drawn.positionIndex}>
                          <span className="text-muted-foreground">
                            {positionName}:
                          </span>{" "}
                          <span className="font-medium">{drawn.card.name}</span>
                          {drawn.isReversed && (
                            <span className="text-muted-foreground">
                              {" "}
                              (invertida)
                            </span>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                )}

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
                </div>
              </div>

              <div>
                {createdReadingId && (
                  <ReadingAIPanel
                    readingId={createdReadingId}
                    autoStart
                    question={question}
                  />
                )}
              </div>
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
