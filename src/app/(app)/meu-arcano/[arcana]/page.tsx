"use client"

import { use } from "react"
import { ArcanaDetailCard } from "@/components/arcana/arcana-detail-card"
import { BackLink } from "@/components/layout/back-link"
import { getArcanaByNumber } from "@/data/arcana"

export default function ArcanaDetailPage({
  params,
}: {
  params: Promise<{ arcana: string }>
}) {
  const { arcana: arcanaParam } = use(params)
  const arcanaNumber = Number(arcanaParam)
  const arcanaData =
    Number.isInteger(arcanaNumber) && arcanaNumber >= 1 && arcanaNumber <= 22
      ? getArcanaByNumber(arcanaNumber)
      : null

  if (!arcanaData) {
    return (
      <main className="mx-auto max-w-4xl space-y-6 p-4">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Arcano nao encontrado</h1>
          <BackLink href="/meu-arcano" />
        </div>
        <p className="text-muted-foreground">
          O arcano {arcanaParam} nao e valido. Valores validos: 1-22.
        </p>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-4xl space-y-6 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">{arcanaData.name}</h1>
        <BackLink href="/meu-arcano" />
      </div>
      <ArcanaDetailCard arcana={arcanaData} />
    </main>
  )
}
