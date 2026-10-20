"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { DeckImage } from "@/components/tarot/deck-image"
import { CardBack } from "@/components/tarot/card-back"
import {
  getDailyTarotCard,
  DEFAULT_DECK_ID,
  type DailyTarotCard,
} from "@/lib/tarot/daily"
import { getDeckById } from "@/lib/tarot/decks"
import { useSequentialReveal } from "@/hooks/use-sequential-reveal"
import { motion } from "framer-motion"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { RefreshCw, Star, Sun } from "lucide-react"
import { useMemo, useState, useSyncExternalStore } from "react"

let cachedNow = ""

function getDateSnapshot(): string {
  if (!cachedNow) {
    cachedNow = new Date().toISOString()
  }
  return cachedNow
}

function getServerDateSnapshot(): string {
  return ""
}

function subscribeDate(callback: () => void) {
  // cachedNow é module-level: entre navegações pode ficar obsoleto (nenhuma
  // instância montada). Refresca no subscribe e força o snapshot pós-subscribe
  // do useSyncExternalStore a corrigir a data (evita mostrar o arcano de ontem).
  cachedNow = new Date().toISOString()
  callback()
  const id = window.setInterval(() => {
    cachedNow = new Date().toISOString()
    callback()
  }, 60_000)
  return () => window.clearInterval(id)
}

export function DailyTarot() {
  const nowIso = useSyncExternalStore(
    subscribeDate,
    getDateSnapshot,
    getServerDateSnapshot,
  )
  const [refreshTick, setRefreshTick] = useState(0)

  const date = useMemo(() => {
    if (!nowIso) return null
    return new Date(nowIso)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refreshTick forces recompute on manual refresh
  }, [nowIso, refreshTick])

  const dailyCard = useMemo<DailyTarotCard | null>(() => {
    if (!date) return null
    try {
      return getDailyTarotCard(date)
    } catch (error) {
      console.error("Erro ao buscar carta do dia:", error)
      return null
    }
  }, [date])

  // BR-TIR-003 no cartao do dia: a unica carta e revelada apos 1.5s (mesmo
  // intervalo das tiragens), sem pular. Chaveado por id — troca de dia reabre.
  const [revealedCardId, setRevealedCardId] = useState<string | null>(null)
  const deckBackImageUrl = getDeckById(DEFAULT_DECK_ID)?.cardBackImageUrl
  useSequentialReveal({
    count: dailyCard ? 1 : 0,
    enabled: !!dailyCard && revealedCardId !== dailyCard.id,
    intervalMs: 1500,
    onReveal: () => {
      if (dailyCard) setRevealedCardId(dailyCard.id)
    },
  })
  const revealed = !!dailyCard && revealedCardId === dailyCard.id

  if (!date) {
    return (
      <section className="space-y-4">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <Sun className="h-5 w-5 text-primary" aria-hidden="true" />
          Tarot do Dia
        </h2>
        <div className="max-w-xs mx-auto h-96 rounded-lg bg-muted animate-pulse" />
      </section>
    )
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <Sun className="h-5 w-5 text-primary" aria-hidden="true" />
          Tarot do Dia
        </h2>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            cachedNow = new Date().toISOString()
            setRefreshTick((t) => t + 1)
          }}
          aria-label="Atualizar data"
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>

      <p className="text-sm text-muted-foreground">
        {format(date, "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR })}
      </p>

      {dailyCard ? (
        <Card className="max-w-xs mx-auto">
          <CardContent className="p-6 text-center">
            {!revealed ? (
              <motion.div
                key="verso"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.6, ease: "easeOut" }}
                className="relative mx-auto mb-4 aspect-[3/4] w-full max-w-xs overflow-hidden rounded-lg border border-primary/20 bg-gradient-to-br from-primary/20 to-primary/10"
              >
                <CardBack backImageUrl={deckBackImageUrl} />
                <div
                  className="absolute inset-x-0 bottom-4 text-center text-xs text-primary-foreground/70"
                  aria-live="polite"
                >
                  Virando a carta…
                </div>
              </motion.div>
            ) : (
              <>
                <motion.div
                  key="face"
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.6, ease: "easeOut" }}
                  className="relative mx-auto mb-4 aspect-[3/4] w-full max-w-xs overflow-hidden rounded-lg border border-primary/20 bg-gradient-to-br from-primary/20 to-primary/10"
                >
                  <div className="absolute inset-0">
                    <DeckImage
                      src={dailyCard.image}
                      alt={`Carta: ${dailyCard.name}`}
                      fallbackLabel={dailyCard.name}
                      fill
                    />
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                  <div className="absolute bottom-4 left-4 right-4 flex justify-between text-xs text-white">
                    <span>Arcano do Dia</span>
                    <span>
                      <Star
                        className="mr-1 inline h-3 w-3"
                        aria-hidden="true"
                      />
                      {dailyCard.name}
                    </span>
                  </div>
                </motion.div>

                <div aria-live="polite">
                  <h3 className="mt-4 text-lg font-semibold">
                    {dailyCard.name}
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {dailyCard.isReversed
                      ? dailyCard.reversedMeaning
                      : dailyCard.meaning}
                  </p>
                  {dailyCard.isReversed && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      (Invertida)
                    </p>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      ) : (
        <p className="text-center text-muted-foreground">
          Não foi possível carregar a carta do dia.
        </p>
      )}
    </section>
  )
}
