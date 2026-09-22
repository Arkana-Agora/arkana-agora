"use client"

import { useState, useRef, useEffect } from "react"

interface ChatMessage {
  role: "user" | "assistant"
  content: string
}

interface FollowUpChatProps {
  messages: ChatMessage[]
  onSendMessage: (message: string) => void
  isStreaming?: boolean
  remainingMessages?: number
  maxMessages?: number
  onNewSession?: () => void
}

export function FollowUpChat({
  messages,
  onSendMessage,
  isStreaming = false,
  remainingMessages = 10,
  maxMessages = 10,
  onNewSession,
}: FollowUpChatProps) {
  const [input, setInput] = useState("")
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isStreaming) return
    onSendMessage(input.trim())
    setInput("")
  }

  return (
    <div className="space-y-3 rounded-lg border p-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium">Perguntas</h4>
        <span className="text-xs text-muted-foreground">
          {remainingMessages} de {maxMessages} mensagens
        </span>
      </div>

      <div className="max-h-[300px] space-y-3 overflow-y-auto">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                msg.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted"
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}
        {isStreaming && (
          <div className="flex justify-start">
            <div className="rounded-lg bg-muted px-3 py-2 text-sm">
              <span className="animate-pulse">A IA esta escrevendo...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          maxLength={500}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Faca uma pergunta..."
          disabled={isStreaming}
          className="flex-1 rounded-md border bg-background px-3 py-2 text-sm disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={isStreaming || !input.trim()}
          className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          Enviar
        </button>
      </form>

      <p className="text-xs text-muted-foreground">
        {input.length}/500 caracteres
      </p>

      {onNewSession && (
        <button
          onClick={onNewSession}
          disabled={isStreaming}
          className="text-xs font-medium text-muted-foreground hover:text-foreground disabled:opacity-50"
        >
          Nova pergunta
        </button>
      )}
    </div>
  )
}
