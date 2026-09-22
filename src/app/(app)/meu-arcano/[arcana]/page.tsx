"use client"

import { use } from "react"
import { ArcanaDetailCard } from "@/components/arcana/arcana-detail-card"
import { getArcanaByNumber } from "@/data/arcana"

export default function ArcanaDetailPage({
  params,
}: {
  params: Promise<{ arcana: string }>
}) {
  const { arcana: arcanaParam } = use(params)
  const arcanaNumber = Number(arcanaParam)
  const arcanaData = getArcanaByNumber(arcanaNumber)

  if (!arcanaData) {
    return (
      <main className="mx-auto max-w-4xl space-y-6 p-4">
        <h1 className="text-3xl font-bold">Arcano nao encontrado</h1>
        <p className="text-muted-foreground">
          O arcano {arcanaParam} nao e valido. Valores validos: 0-21.
        </p>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-4xl space-y-6 p-4">
      <h1 className="text-3xl font-bold">{arcanaData.name}</h1>
      <ArcanaDetailCard arcana={arcanaData} />
    </main>
  )
}
