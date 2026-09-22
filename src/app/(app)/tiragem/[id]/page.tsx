"use client"

import { use } from "react"
import { useReading } from "@/hooks/use-readings"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"

export default function TiragemPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const { data, isLoading, error, refetch } = useReading(id)

  return (
    <main className="mx-auto max-w-4xl space-y-6 p-4">
      {isLoading && (
        <div className="space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-64 w-full rounded-lg" />
        </div>
      )}

      {error && (
        <div className="space-y-2">
          <p className="text-destructive">Erro ao carregar tiragem.</p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            Tentar novamente
          </Button>
        </div>
      )}

      {data && (
        <>
          <h1 className="text-3xl font-bold">
            {data.reading.title ?? `Tiragem ${data.reading.spreadId}`}
          </h1>
          <div className="text-sm text-muted-foreground">
            <span>{data.reading.deckId}</span>
            <span className="mx-2">·</span>
            <span>
              {new Date(data.reading.createdAt).toLocaleDateString("pt-BR")}
            </span>
            {data.reading.duration > 0 && (
              <>
                <span className="mx-2">·</span>
                <span>{data.reading.duration}s</span>
              </>
            )}
          </div>
          <div className="grid gap-4">
            {data.reading.cards.map((card) => (
              <div key={card.id} className="rounded-lg border p-4">
                <p className="font-medium">{card.cardId}</p>
                <p className="text-sm text-muted-foreground">
                  Posição {card.positionIndex + 1}
                  {card.isReversed ? " (invertida)" : ""}
                </p>
              </div>
            ))}
          </div>
        </>
      )}
    </main>
  )
}
