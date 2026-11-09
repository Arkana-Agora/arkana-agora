"use client"

import { useState } from "react"
import { useParams } from "next/navigation"
import { ArrowLeft, Sparkles } from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { StreamingInterpretation } from "@/components/ai/streaming-interpretation"
import { HOROSCOPE_TYPES, type HoroscopeType } from "@/lib/horoscopes/prompts"
import { WESTERN_SIGNS } from "@/lib/horoscopes/western"
import { CHINESE_ANIMALS } from "@/lib/horoscopes/chinese"
import { MAYAN_SEALS, MAYAN_TONES } from "@/lib/horoscopes/maya"

const TYPE_LABELS: Record<string, string> = {
  western: "Ocidental",
  chinese: "Chinês",
  maya: "Maia",
}

const TYPE_ICONS: Record<string, string> = {
  western: "♈",
  chinese: "🐉",
  maya: "🔮",
}

function getHoroscopeTitle(
  type: string,
  signId: string,
  element?: string | null,
  kin?: { number: number; seal: number; tone: number },
): string {
  if (type === "western") {
    const sign = WESTERN_SIGNS.find((s) => s.id === signId)
    return sign ? `${sign.emoji} ${sign.name}` : signId
  }
  if (type === "chinese") {
    const animal = CHINESE_ANIMALS.find((a) => a.id === signId)
    const elementLabel = element
      ? ` de ${element.charAt(0).toUpperCase() + element.slice(1)}`
      : ""
    return animal ? `${animal.name}${elementLabel}` : signId
  }
  if (type === "maya" && kin) {
    const seal = MAYAN_SEALS[kin.seal]
    const tone = MAYAN_TONES[kin.tone - 1]
    return seal && tone
      ? `Kin ${kin.number} — ${seal.name} ${tone.name}`
      : `Kin ${kin.number}`
  }
  return signId
}

function getHoroscopeDescription(type: string): string {
  switch (type) {
    case "western":
      return "Interpretação detalhada do seu signo solar, considerando a energia do período e as influências planetárias."
    case "chinese":
      return "Leitura profunda do seu animal e elemento do ano, conectando a sabedoria chinesa ao momento atual."
    case "maya":
      return "Interpretação do seu Kin Tzolkin, revelando o Selo e o Tom que guiam seu caminho na roda sagrada."
    default:
      return "Interpretação personalizada baseada no seu horóscopo."
  }
}

export default function HoroscopeInterpretPage() {
  const params = useParams()
  const type = params.type as string
  const [isLoading, setIsLoading] = useState(false)
  const [interpretation, setInterpretation] = useState("")
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const typeLabel = TYPE_LABELS[type] || type
  const typeIcon = TYPE_ICONS[type] || ""

  const handleInterpret = async () => {
    const horoscopeType = type as HoroscopeType
    if (!type || !HOROSCOPE_TYPES.includes(horoscopeType)) {
      toast.error("Tipo de horóscopo inválido")
      return
    }

    setIsLoading(true)
    setIsStreaming(true)
    setError(null)
    setInterpretation("")

    try {
      const response = await fetch("/api/v1/ai/horoscope-interpret", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ type }),
      })

      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.error?.message || "Erro ao gerar interpretação")
      }

      if (!response.body) {
        throw new Error("Resposta vazia do servidor")
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let fullText = ""

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        const lines = chunk.split("\n\n")

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6))
              if (data.type === "token") {
                fullText += data.token
                setInterpretation(fullText)
              } else if (data.type === "done") {
                setIsStreaming(false)
                setIsLoading(false)
              } else if (data.type === "error") {
                throw new Error(data.message)
              }
            } catch {
              // Ignore parse errors for non-data lines
            }
          }
        }
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Erro ao gerar interpretação"
      setError(message)
      setIsLoading(false)
      setIsStreaming(false)
    }
  }

  const handleRetry = () => {
    setInterpretation("")
    setError(null)
    handleInterpret()
  }

  const handleStop = () => {
    setIsStreaming(false)
    setIsLoading(false)
  }

  const horoscopeType = type as HoroscopeType
  if (!type || !HOROSCOPE_TYPES.includes(horoscopeType)) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <h1 className="text-2xl font-semibold">
                Tipo de horóscopo inválido
              </h1>
              <p className="text-sm text-muted-foreground mt-2">
                O tipo {type} não é suportado para interpretação.
              </p>
              <Link
                href="/horoscopos"
                className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
              >
                <ArrowLeft className="h-4 w-4" />
                Voltar aos horóscopos
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href={`/horoscopos/${type}`}
            className="p-2 rounded-lg hover:bg-muted transition-colors"
            aria-label="Voltar"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-semibold">
              {typeIcon} Interpretação {typeLabel}
            </h1>
            <p className="text-sm text-muted-foreground">
              {getHoroscopeDescription(type)}
            </p>
          </div>
        </div>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            Interpretação IA para{" "}
            {getHoroscopeTitle(type, "", undefined, undefined)}
          </CardTitle>
          <CardDescription>
            Solicite uma leitura detalhada e personalizada via IA. Consome 1
            unidade da sua cota diária de interpretações.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            onClick={handleInterpret}
            disabled={isLoading || isStreaming}
            className="gap-2"
            size="lg"
          >
            <Sparkles className="h-4 w-4" aria-hidden="true" />
            {isStreaming
              ? "Gerando..."
              : isLoading
                ? "Carregando..."
                : "Solicitar Interpretação IA"}
          </Button>

          {error && (
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
              <p className="text-sm text-destructive">{error}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRetry}
                className="mt-2"
              >
                Tentar novamente
              </Button>
            </div>
          )}

          <StreamingInterpretation
            content={interpretation}
            isStreaming={isStreaming}
            error={error}
            onRetry={handleRetry}
            onStop={handleStop}
          />
        </CardContent>
      </Card>
    </div>
  )
}
