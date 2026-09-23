"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { getDailyTarotCard, type DailyTarotCard } from "@/lib/tarot/daily"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { Moon, RefreshCw, Star, Sun } from "lucide-react"
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
            <div className="relative aspect-[3/4] w-full max-w-xs mx-auto mb-4 rounded-lg overflow-hidden bg-gradient-to-br from-primary/20 to-primary/10 border border-primary/20">
              <div className="absolute inset-0 flex items-center justify-center">
                <Moon
                  className="h-16 w-16 text-primary/60"
                  aria-hidden="true"
                />
              </div>
              <div className="absolute bottom-4 left-4 right-4 flex justify-between text-xs text-primary-foreground/70">
                <span>Arcano do Dia</span>
                <span>
                  <Star className="h-3 w-3 inline mr-1" aria-hidden="true" />
                  {dailyCard.name}
                </span>
              </div>
            </div>
            <h3 className="text-lg font-semibold mt-4">{dailyCard.name}</h3>
            <p className="text-sm text-muted-foreground mt-1">
              {dailyCard.isReversed
                ? dailyCard.reversedMeaning
                : dailyCard.meaning}
            </p>
            {dailyCard.isReversed && (
              <p className="text-xs text-muted-foreground mt-2">(Invertida)</p>
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
