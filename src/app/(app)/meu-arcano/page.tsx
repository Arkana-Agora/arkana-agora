"use client"

import { useState } from "react"
import { ArcanaCalculator } from "@/components/arcana/arcana-calculator"
import { ArcanaDetailCard } from "@/components/arcana/arcana-detail-card"
import { ArcanaAIInterpretation } from "@/components/arcana/arcana-ai-interpretation"
import { BackLink } from "@/components/layout/back-link"
import { getArcanaByNumber } from "@/data/arcana"
import type { ArcanaData } from "@/data/arcana"
import { calculatePersonalArcana } from "@/lib/arcana/calculate"
import { useMyProfile } from "@/hooks/use-profile"
import { authStreamFetch } from "@/lib/api"

interface ArcanaResult {
  arcana: number
  arcanaData: ArcanaData
  name: string
  birthDate: string
}

export default function MeuArcanoPage() {
  const { data: profile } = useMyProfile()
  const [result, setResult] = useState<ArcanaResult | null>(null)
  const [streamingContent, setStreamingContent] = useState("")
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const savedBirthDate = profile?.birthDate
    ? profile.birthDate.slice(0, 10)
    : ""
  const savedArcana =
    profile && typeof profile.personalArcana === "number"
      ? getArcanaByNumber(profile.personalArcana)
      : null

  const displayedResult =
    result ??
    (savedArcana && profile
      ? {
          arcana: profile.personalArcana as number,
          arcanaData: savedArcana,
          name: profile.name,
          birthDate: savedBirthDate,
        }
      : null)

  const handleCalculate = (params: { name: string; birthDate: string }) => {
    setError(null)
    setStreamingContent("")
    const arcanaNumber = calculatePersonalArcana(
      new Date(params.birthDate),
      params.name,
    )
    if (arcanaNumber === null) return
    const arcanaData = getArcanaByNumber(arcanaNumber)
    if (!arcanaData) return
    setResult({
      arcana: arcanaNumber,
      arcanaData,
      name: params.name,
      birthDate: params.birthDate,
    })
  }

  const handleInterpret = async () => {
    if (!displayedResult) return
    setIsStreaming(true)
    setStreamingContent("")
    setError(null)

    try {
      const res = await authStreamFetch("/api/v1/ai/arcana-interpret", {
        method: "POST",
        body: { arcanaNumber: displayedResult.arcana, mode: "general" },
      })

      if (!res.ok) {
        setIsStreaming(false)
        setError(
          res.status === 401
            ? "Sessao expirada. Entre novamente."
            : "Nao foi possivel gerar a interpretacao.",
        )
        return
      }

      const reader = res.body?.getReader()
      if (!reader) {
        setIsStreaming(false)
        return
      }

      const decoder = new TextDecoder()
      let buffer = ""
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const parts = buffer.split("\n")
        buffer = parts.pop() ?? ""

        for (const line of parts) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6))
              if (data.type === "token") {
                setStreamingContent((prev) => prev + data.token)
              } else if (data.type === "done") {
                setIsStreaming(false)
              } else if (data.type === "error") {
                setIsStreaming(false)
                setError(data.message ?? "Erro na interpretacao.")
              }
            } catch {
              // skip malformed lines
            }
          }
        }
      }
    } catch {
      setIsStreaming(false)
      setError("Erro de conexao.")
    }
  }

  return (
    <main className="mx-auto max-w-4xl space-y-6 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Meu Arcano Pessoal</h1>
        <BackLink href="/dashboard" />
      </div>

      <ArcanaCalculator
        onCalculate={handleCalculate}
        initialName={profile?.name || undefined}
        initialBirthDate={savedBirthDate || undefined}
      />

      {error && <p className="text-sm text-destructive">{error}</p>}

      {displayedResult && (
        <div className="space-y-6">
          <ArcanaDetailCard arcana={displayedResult.arcanaData} />
          <ArcanaAIInterpretation
            streamingContent={streamingContent}
            isStreaming={isStreaming}
            onInterpret={handleInterpret}
          />
        </div>
      )}
    </main>
  )
}
