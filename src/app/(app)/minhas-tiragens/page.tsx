"use client"

import { useState } from "react"
import { useReadings } from "@/hooks/use-readings"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import Link from "next/link"

export default function MinhasTiragensPage() {
  const [page, setPage] = useState(1)
  const { data, isLoading, error, refetch } = useReadings({ limit: 20, page })

  return (
    <main className="mx-auto max-w-4xl space-y-6 p-4">
      <h1 className="text-3xl font-bold">Minhas Tiragens</h1>

      {isLoading && (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-lg" />
          ))}
        </div>
      )}

      {error && (
        <div className="space-y-2">
          <p className="text-destructive">Erro ao carregar tiragens.</p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            Tentar novamente
          </Button>
        </div>
      )}

      {data && data.readings.length === 0 && (
        <div className="text-center">
          <p className="text-muted-foreground mb-4">
            Você ainda não fez nenhuma tiragem.
          </p>
          <Button asChild>
            <Link href="/tirar">Fazer primeira tiragem</Link>
          </Button>
        </div>
      )}

      {data && data.readings.length > 0 && (
        <div className="space-y-3">
          {data.readings.map((reading) => (
            <Link
              key={reading.id}
              href={`/tiragem/${reading.id}`}
              className="block rounded-lg border p-4 transition-colors hover:bg-muted"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">
                    {reading.title ?? reading.spreadId}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {reading.deckId} ·{" "}
                    {new Date(reading.createdAt).toLocaleDateString("pt-BR")}
                  </p>
                </div>
                <span className="text-xs text-muted-foreground">
                  {reading.cards.length} cartas
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}

      {data && data.pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-4">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Anterior
          </Button>
          <span className="text-sm text-muted-foreground">
            Página {data.pagination.page} de {data.pagination.totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= data.pagination.totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Próxima
          </Button>
        </div>
      )}
    </main>
  )
}
