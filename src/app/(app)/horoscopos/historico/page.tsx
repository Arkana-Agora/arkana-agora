"use client"

import { useState } from "react"

import { Card, CardContent } from "@/components/ui/card"
import {
  useHoroscopeHistory,
  type HoroscopeType,
  type PromptPeriod,
} from "@/hooks/use-horoscopes"
import {
  HOROSCOPE_PERIOD_LABELS,
  HOROSCOPE_TYPE_LABELS,
} from "@/lib/horoscopes/prompts"
import { WESTERN_SIGNS } from "@/lib/horoscopes/western"
import { CHINESE_ANIMALS } from "@/lib/horoscopes/chinese"

function signLabel(type: HoroscopeType, signId: string): string {
  if (type === "western") {
    const sign = WESTERN_SIGNS.find((s) => s.id === signId)
    return sign ? `${sign.emoji} ${sign.name}` : signId
  }
  if (type === "chinese") {
    const animal = CHINESE_ANIMALS.find((a) => a.id === signId)
    return animal ? animal.name : signId
  }
  return `Kin ${signId}`
}

// Narrowing sem cast (noUncheckedIndexedAccess/review): option value
// desconhecida vira "" (Todos) em vez de forçar o union via `as`.
function parseTypeFilter(value: string): HoroscopeType | "" {
  if (value === "western" || value === "chinese" || value === "maya") {
    return value
  }
  return ""
}

function parsePeriodFilter(value: string): PromptPeriod | "" {
  if (value === "daily" || value === "weekly" || value === "monthly") {
    return value
  }
  return ""
}

/**
 * Histórico de leituras (T096/US-024): filtros de tipo/período
 * alimentam a query, entradas do envelope S2-18 com rótulos dos
 * catálogos, paginação por cursor via "Carregar mais".
 */
export default function HoroscopeHistoryPage() {
  const [type, setType] = useState<HoroscopeType | "">("")
  const [period, setPeriod] = useState<PromptPeriod | "">("")

  const {
    data,
    isLoading,
    isError,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = useHoroscopeHistory({
    type: type === "" ? undefined : type,
    period: period === "" ? undefined : period,
  })

  const entries = data?.pages.flatMap((page) => page.data.entries) ?? []
  const isFiltered = type !== "" || period !== ""

  return (
    <div className="space-y-6" data-testid="horoscope-history-page">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Histórico de leituras</h1>
        <p className="text-sm text-muted-foreground">
          Todas as leituras de horóscopo salvas na sua conta.
        </p>
      </header>

      <div className="flex flex-wrap items-end gap-4">
        <div className="space-y-1">
          <label htmlFor="history-type" className="text-sm font-medium">
            Tipo
          </label>
          <select
            id="history-type"
            className="h-9 rounded-md border border-border bg-background px-2 text-sm"
            value={type}
            onChange={(event) => setType(parseTypeFilter(event.target.value))}
          >
            <option value="">Todos</option>
            <option value="western">Ocidental</option>
            <option value="chinese">Chinês</option>
            <option value="maya">Maia</option>
          </select>
        </div>

        <div className="space-y-1">
          <label htmlFor="history-period" className="text-sm font-medium">
            Período
          </label>
          <select
            id="history-period"
            className="h-9 rounded-md border border-border bg-background px-2 text-sm"
            value={period}
            onChange={(event) =>
              setPeriod(parsePeriodFilter(event.target.value))
            }
          >
            <option value="">Todos</option>
            <option value="daily">Diário</option>
            <option value="weekly">Semanal</option>
            <option value="monthly">Mensal</option>
          </select>
        </div>
      </div>

      {isLoading && (
        <p className="text-sm text-muted-foreground" role="status">
          Carregando histórico…
        </p>
      )}
      {isError && (
        <p className="text-sm text-destructive" role="alert">
          Não foi possível carregar o histórico.
        </p>
      )}

      {!isLoading && !isError && entries.length === 0 && (
        <p
          className="text-sm text-muted-foreground"
          data-testid="history-empty"
        >
          {isFiltered
            ? "Nenhuma leitura encontrada com esses filtros."
            : "Você ainda não tem leituras salvas."}
        </p>
      )}

      {entries.length > 0 && (
        <Card>
          <CardContent className="divide-y divide-border p-0">
            {entries.map((entry) => (
              <div
                key={entry.id}
                className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm"
              >
                <span className="font-medium">
                  {signLabel(entry.type, entry.signId)}
                </span>
                <span className="text-muted-foreground">
                  {HOROSCOPE_TYPE_LABELS[entry.type]} ·{" "}
                  {HOROSCOPE_PERIOD_LABELS[entry.period]}
                </span>
                <span className="text-muted-foreground">
                  {new Date(entry.createdAt).toLocaleDateString("pt-BR")}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {hasNextPage && (
        <button
          type="button"
          className="text-sm font-medium text-primary hover:underline"
          data-testid="history-load-more"
          disabled={isFetchingNextPage}
          onClick={() => void fetchNextPage()}
        >
          {isFetchingNextPage ? "Carregando…" : "Carregar mais"}
        </button>
      )}
    </div>
  )
}
