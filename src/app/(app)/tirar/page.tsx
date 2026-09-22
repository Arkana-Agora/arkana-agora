"use client"

import { useReadingStore } from "@/stores/reading-store"
import { useDailyCount, useDecks, useSpreads } from "@/hooks/use-readings"
import { DeckSelector } from "@/components/tarot/deck-selector"
import { SpreadSelector } from "@/components/tarot/spread-selector"
import { DailyLimitBanner } from "@/components/tarot/daily-limit-banner"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"

export default function TirarPage() {
  const { step, selectDeck, selectSpread, reset } = useReadingStore()
  const { data: dailyCount, isLoading: dailyLoading } = useDailyCount()
  const { data: decks, isLoading: decksLoading } = useDecks()
  const { data: spreads, isLoading: spreadsLoading } = useSpreads()

  return (
    <main className="mx-auto max-w-4xl space-y-6 p-4">
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
            <DeckSelector
              decks={decks ?? []}
              onSelect={(id) => selectDeck(id)}
            />
          )}
        </section>
      )}

      {step === "spread" && (
        <section>
          <h2 className="mb-4 text-xl font-semibold">Escolha o espalhamento</h2>
          {spreadsLoading ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-32 w-full rounded-lg" />
              ))}
            </div>
          ) : (
            <SpreadSelector
              spreads={spreads ?? []}
              onSelect={(id) => selectSpread(id)}
            />
          )}
          <Button variant="ghost" className="mt-4" onClick={reset}>
            Voltar
          </Button>
        </section>
      )}

      {step === "draw" && (
        <section className="space-y-4">
          <p className="text-muted-foreground">Preparando sua tiragem...</p>
          <Button variant="ghost" onClick={reset}>
            Cancelar
          </Button>
        </section>
      )}

      {step === "reveal" && (
        <section>
          <p className="text-muted-foreground">Sua tiragem está pronta!</p>
          <Button variant="ghost" onClick={reset}>
            Nova tiragem
          </Button>
        </section>
      )}
    </main>
  )
}
