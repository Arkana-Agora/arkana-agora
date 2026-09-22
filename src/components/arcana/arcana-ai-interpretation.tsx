"use client"

import { Button } from "@/components/ui/button"

interface ArcanaAIInterpretationProps {
  streamingContent?: string
  isStreaming?: boolean
  onInterpret?: () => void
}

export function ArcanaAIInterpretation({
  streamingContent,
  isStreaming = false,
  onInterpret,
}: ArcanaAIInterpretationProps) {
  if (streamingContent) {
    return (
      <div className="prose prose-sm max-w-none dark:prose-invert">
        <p className="whitespace-pre-wrap">{streamingContent}</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <Button onClick={onInterpret} disabled={isStreaming}>
        {isStreaming ? "Gerando interpretacao..." : "Interpretar com IA"}
      </Button>
    </div>
  )
}
