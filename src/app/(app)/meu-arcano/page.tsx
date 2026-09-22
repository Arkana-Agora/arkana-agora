"use client"

import { useState } from "react"
import { getSession } from "next-auth/react"
import { ArcanaCalculator } from "@/components/arcana/arcana-calculator"
import { ArcanaDetailCard } from "@/components/arcana/arcana-detail-card"
import { ArcanaAIInterpretation } from "@/components/arcana/arcana-ai-interpretation"
import type { ArcanaData } from "@/data/arcana"

interface ArcanaResult {
  arcana: number
  arcanaData: ArcanaData
  name: string
  birthDate: string
}

export default function MeuArcanoPage() {
  const [result, setResult] = useState<ArcanaResult | null>(null)
  const [streamingContent, setStreamingContent] = useState("")
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleCalculate = async (params: {
    name: string
    birthDate: string
  }) => {
    setError(null)
    const { calculatePersonalArcana } = await import("@/lib/arcana/calculate")
    const { getArcanaByNumber } = await import("@/data/arcana")

    const birthDateObj = new Date(params.birthDate)
    const arcanaNumber = calculatePersonalArcana(birthDateObj, params.name)

    if (arcanaNumber !== null) {
      const arcanaData = getArcanaByNumber(arcanaNumber)
      if (arcanaData) {
        setResult({
          arcana: arcanaNumber,
          arcanaData,
          name: params.name,
          birthDate: params.birthDate,
        })
      }
    }
  }

  const handleInterpret = async () => {
    if (!result) return
    setIsStreaming(true)
    setStreamingContent("")
    setError(null)

    try {
      const session = await getSession()
      const token = (session as { accessToken?: string } | null)?.accessToken

      const res = await fetch("/api/v1/ai/arcana-interpret", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          arcanaNumber: result.arcana,
          mode: "general",
        }),
      })

      if (!res.ok) {
        setIsStreaming(false)
        setError("Nao foi possivel gerar a interpretacao.")
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
      <h1 className="text-3xl font-bold">Meu Arcano Pessoal</h1>

      <ArcanaCalculator onCalculate={handleCalculate} />

      {error && <p className="text-sm text-destructive">{error}</p>}

      {result && (
        <div className="space-y-6">
          <ArcanaDetailCard arcana={result.arcanaData} />
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
