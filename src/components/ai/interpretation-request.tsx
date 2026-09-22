"use client"

import { useState } from "react"
import type { InterpretationMode } from "@/lib/ai/cache"

interface InterpretationRequestProps {
  onInterpret: (params: {
    mode: InterpretationMode
    mood?: string
    question?: string
  }) => void
  isLoading?: boolean
  usage?: { interpretations: number; dailyLimit: number; remaining: number }
}

const MODES: Array<{ value: InterpretationMode; label: string }> = [
  { value: "general", label: "Geral" },
  { value: "love", label: "Amor" },
  { value: "career", label: "Carreira" },
  { value: "yesno", label: "Sim/Nao" },
]

const MOODS = [
  "Animado",
  "Ansioso",
  "Reflexivo",
  "Triste",
  "Esperancoso",
  "Cansado",
]

export function InterpretationRequest({
  onInterpret,
  isLoading = false,
  usage,
}: InterpretationRequestProps) {
  const [mode, setMode] = useState<InterpretationMode>("general")
  const [mood, setMood] = useState<string | undefined>()
  const [question, setQuestion] = useState("")

  const handleSubmit = () => {
    const params: {
      mode: InterpretationMode
      mood?: string
      question?: string
    } = { mode }
    if (mood) params.mood = mood
    if (question) params.question = question
    onInterpret(params)
  }

  return (
    <div className="space-y-4 rounded-lg border p-4">
      <h3 className="text-lg font-semibold">Interpretacao IA</h3>

      {usage && (
        <p className="text-sm text-muted-foreground">
          Voce usou {usage.interpretations} de {usage.dailyLimit} interpretacoes
          hoje
        </p>
      )}

      <div>
        <p className="mb-2 text-sm font-medium">Modo:</p>
        <div className="flex flex-wrap gap-2">
          {MODES.map((m) => (
            <button
              key={m.value}
              onClick={() => setMode(m.value)}
              className={`rounded-full px-3 py-1 text-sm transition-colors ${
                mode === m.value
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted hover:bg-muted/80"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {mode === "yesno" && (
        <div>
          <label htmlFor="question" className="mb-1 block text-sm font-medium">
            Sua pergunta:
          </label>
          <input
            id="question"
            type="text"
            maxLength={200}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ex: Vou conseguir a vaga?"
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            {question.length}/200
          </p>
        </div>
      )}

      <div>
        <p className="mb-2 text-sm font-medium">Estado emocional:</p>
        <div className="flex flex-wrap gap-2">
          {MOODS.map((m) => (
            <button
              key={m}
              onClick={() => setMood(mood === m ? undefined : m)}
              className={`rounded-full px-3 py-1 text-sm transition-colors ${
                mood === m
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted hover:bg-muted/80"
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      <button
        onClick={handleSubmit}
        disabled={isLoading || (mode === "yesno" && !question)}
        className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
      >
        {isLoading ? "Gerando..." : "Gerar Interpretacao"}
      </button>
    </div>
  )
}
