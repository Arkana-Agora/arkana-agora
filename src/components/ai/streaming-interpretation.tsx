"use client"

import { useEffect, useRef } from "react"

interface StreamingInterpretationProps {
  content: string
  isStreaming: boolean
  isCached?: boolean
  error?: string | null
  onRetry?: () => void
  onStop?: () => void
}

export function StreamingInterpretation({
  content,
  isStreaming,
  isCached = false,
  error,
  onRetry,
  onStop,
}: StreamingInterpretationProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const displayedText = content

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight
    }
  }, [displayedText])

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
        <p className="text-sm text-destructive">{error}</p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="mt-2 text-sm font-medium text-primary hover:underline"
          >
            Tentar novamente
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {isCached && (
        <div className="flex items-center gap-2 rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
          <span className="inline-block h-2 w-2 rounded-full bg-blue-400" />
          Esta interpretacao foi gerada anteriormente para a mesma combinacao de
          cartas.
        </div>
      )}

      <div
        ref={containerRef}
        className="max-h-[500px] overflow-y-auto rounded-lg border p-4"
      >
        <div className="prose prose-sm max-w-none text-sm leading-relaxed">
          {displayedText || (isStreaming ? "A IA esta escrevendo..." : "")}
          {isStreaming && (
            <span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-foreground" />
          )}
        </div>
      </div>

      {isStreaming && onStop && (
        <button
          onClick={onStop}
          className="text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          Parar geracao
        </button>
      )}

      {!isStreaming && content && (
        <div className="flex gap-2">
          <button className="rounded-md bg-muted px-3 py-1.5 text-xs font-medium hover:bg-muted/80">
            Fazer perguntas
          </button>
          <button className="rounded-md bg-muted px-3 py-1.5 text-xs font-medium hover:bg-muted/80">
            Compartilhar
          </button>
        </div>
      )}
    </div>
  )
}
