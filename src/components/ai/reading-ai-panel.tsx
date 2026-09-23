"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import authApi from "@/lib/api"
import { InterpretationRequest } from "@/components/ai/interpretation-request"
import { StreamingInterpretation } from "@/components/ai/streaming-interpretation"
import { FollowUpChat } from "@/components/ai/follow-up-chat"
import { AIUsageIndicator } from "@/components/ai/ai-usage-indicator"
import type { InterpretationMode } from "@/lib/ai/cache"

interface UsageStats {
  interpretations: number
  dailyLimit: number
  tier: string
}

interface ChatMessage {
  role: "user" | "assistant"
  content: string
}

interface ReadingAIPanelProps {
  readingId: string
}

interface SseFinalEvent {
  type: string
  cached?: boolean | undefined
  message?: string | undefined
  interpretationId?: string | null | undefined
}

async function getAccessToken(): Promise<string | null> {
  const { getSession } = await import("next-auth/react")
  const session = await getSession()
  return session?.accessToken ?? null
}

export function ReadingAIPanel({ readingId }: ReadingAIPanelProps) {
  const [content, setContent] = useState("")
  const [isStreaming, setIsStreaming] = useState(false)
  const [isCached, setIsCached] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [interpretationId, setInterpretationId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [followUpStreaming, setFollowUpStreaming] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const followUpAbortRef = useRef<AbortController | null>(null)
  const reqSeqRef = useRef(0)
  const sessionSeqRef = useRef(0)
  const isStreamingRef = useRef(false)
  const lastParamsRef = useRef<{
    mode: InterpretationMode
    mood?: string
    question?: string
  } | null>(null)
  const queryClient = useQueryClient()

  const { data: usage } = useQuery({
    queryKey: ["ai-usage"],
    queryFn: async () => {
      const res = await authApi.get("/ai/usage")
      return res.data as UsageStats
    },
  })

  useEffect(() => {
    return () => {
      abortRef.current?.abort()
      followUpAbortRef.current?.abort()
    }
  }, [])

  const parseSSE = useCallback(
    async (
      reader: ReadableStreamDefaultReader<Uint8Array>,
      onToken: (token: string) => void,
    ): Promise<SseFinalEvent> => {
      const decoder = new TextDecoder()
      let buffer = ""
      let finalEvent: SseFinalEvent = { type: "done" }

      const processEvent = (raw: string) => {
        const line = raw.trim()
        if (!line.startsWith("data:")) return
        const payload = line.slice(5).trim()
        if (!payload) return
        try {
          const event = JSON.parse(payload) as {
            type: string
            token?: string
            cached?: boolean
            message?: string
            interpretationId?: string
          }
          if (event.type === "token" && event.token) {
            onToken(event.token)
          } else if (event.type === "done") {
            finalEvent = {
              type: "done",
              cached: event.cached,
              interpretationId: event.interpretationId ?? null,
            }
          } else if (event.type === "error") {
            finalEvent = {
              type: "error",
              message: event.message,
            }
          }
        } catch {
          console.warn("[ai-panel] SSE payload invalido", payload)
        }
      }

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const parts = buffer.split("\n\n")
        buffer = parts.pop() ?? ""
        for (const part of parts) processEvent(part)
      }
      buffer += decoder.decode()
      if (buffer.trim()) processEvent(buffer)
      return finalEvent
    },
    [],
  )

  const handleInterpret = useCallback(
    async (params: {
      mode: InterpretationMode
      mood?: string
      question?: string
    }) => {
      if (isStreamingRef.current) return
      isStreamingRef.current = true
      lastParamsRef.current = params
      const reqId = ++reqSeqRef.current
      const controller = new AbortController()
      abortRef.current = controller

      const isCurrent = () => reqId === reqSeqRef.current
      const setIfCurrent = (fn: () => void) => {
        if (isCurrent()) fn()
      }

      setIfCurrent(() => {
        setError(null)
        setIsCached(false)
        setContent("")
        setInterpretationId(null)
        setIsStreaming(true)
      })

      try {
        const token = await getAccessToken()
        const res = await fetch("/api/v1/ai/interpret", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ readingId, ...params }),
          signal: controller.signal,
        })

        if (!isCurrent()) return

        if (res.status === 429) {
          setIfCurrent(() => {
            setIsStreaming(false)
            setError("Limite diário de interpretações atingido.")
          })
          return
        }

        if (!res.ok) {
          setIfCurrent(() => {
            setIsStreaming(false)
            setError("Não foi possível gerar a interpretação.")
          })
          return
        }

        const contentType = res.headers.get("content-type") ?? ""

        if (contentType.includes("application/json")) {
          const data = (await res.json()) as {
            cached?: boolean
            content?: string
            interpretationId?: string
          }
          setIfCurrent(() => {
            if (data.cached) setIsCached(true)
            if (data.content) setContent(data.content)
            setInterpretationId(data.interpretationId ?? null)
            setIsStreaming(false)
          })
          void queryClient.invalidateQueries({ queryKey: ["ai-usage"] })
          return
        }

        if (!res.body) {
          setIfCurrent(() => {
            setIsStreaming(false)
            setError("Resposta vazia do servidor.")
          })
          return
        }

        const reader = res.body.getReader()
        const finalEvent = await parseSSE(reader, (tokenText) => {
          setIfCurrent(() => setContent((prev) => prev + tokenText))
        })

        if (!isCurrent()) return

        if (finalEvent.type === "error") {
          setIfCurrent(() => {
            setError(
              finalEvent.message ??
                "Não foi possível gerar a interpretação. Tente novamente.",
            )
          })
        } else if (finalEvent.interpretationId) {
          setIfCurrent(() => setInterpretationId(finalEvent.interpretationId!))
        }
        setIfCurrent(() => setIsStreaming(false))
        void queryClient.invalidateQueries({ queryKey: ["ai-usage"] })
      } catch (err) {
        if (!isCurrent()) return
        if ((err as Error).name === "AbortError") {
          setIfCurrent(() => setIsStreaming(false))
          return
        }
        setIfCurrent(() => {
          setIsStreaming(false)
          setError("Erro de conexão. Tente novamente.")
        })
      } finally {
        if (isCurrent()) isStreamingRef.current = false
      }
    },
    [readingId, parseSSE, queryClient],
  )

  const handleStop = useCallback(() => {
    reqSeqRef.current += 1
    isStreamingRef.current = false
    abortRef.current?.abort()
    setIsStreaming(false)
  }, [])

  const handleRetry = useCallback(() => {
    if (lastParamsRef.current) {
      void handleInterpret(lastParamsRef.current)
    } else {
      setError(null)
    }
  }, [handleInterpret])

  const handleSendMessage = useCallback(
    async (message: string) => {
      if (!interpretationId || followUpStreaming) return
      const sessionId = sessionSeqRef.current
      const controller = new AbortController()
      followUpAbortRef.current = controller

      setFollowUpStreaming(true)
      const nextMessages: ChatMessage[] = [
        ...messages,
        { role: "user", content: message },
      ]
      setMessages(nextMessages)
      setError(null)

      try {
        const token = await getAccessToken()
        const res = await fetch("/api/v1/ai/follow-up", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            interpretationId,
            message,
            conversationHistory: messages,
          }),
          signal: controller.signal,
        })

        if (sessionId !== sessionSeqRef.current) return

        if (res.status === 429) {
          setFollowUpStreaming(false)
          setError("Limite de perguntas da sessão atingido.")
          return
        }

        if (!res.ok || !res.body) {
          setFollowUpStreaming(false)
          setError("Não foi possível responder. Tente novamente.")
          return
        }

        let reply = ""
        const reader = res.body.getReader()
        await parseSSE(reader, (t) => {
          reply += t
        })

        if (sessionId !== sessionSeqRef.current) return
        setMessages([...nextMessages, { role: "assistant", content: reply }])
        void queryClient.invalidateQueries({ queryKey: ["ai-usage"] })
      } catch (err) {
        if ((err as Error).name === "AbortError") return
        if (sessionId !== sessionSeqRef.current) return
        setMessages(nextMessages)
        setError("Erro de conexão na pergunta.")
      } finally {
        if (sessionId === sessionSeqRef.current) setFollowUpStreaming(false)
      }
    },
    [interpretationId, messages, parseSSE, followUpStreaming, queryClient],
  )

  const handleNewSession = useCallback(() => {
    sessionSeqRef.current += 1
    followUpAbortRef.current?.abort()
    setMessages([])
    setInterpretationId(null)
    setContent("")
    setIsCached(false)
    setError(null)
    setFollowUpStreaming(false)
  }, [])

  const followUpCount = messages.filter((m) => m.role === "user").length

  return (
    <section className="space-y-6" aria-label="Interpretação IA">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Interpretação IA</h2>
        {usage && (
          <AIUsageIndicator
            used={usage.interpretations}
            total={usage.dailyLimit}
            tier={usage.tier}
          />
        )}
      </div>

      <InterpretationRequest
        onInterpret={(params) => void handleInterpret(params)}
        isLoading={isStreaming}
        {...(usage
          ? {
              usage: {
                interpretations: usage.interpretations,
                dailyLimit: usage.dailyLimit,
                remaining: Math.max(
                  0,
                  usage.dailyLimit - usage.interpretations,
                ),
              },
            }
          : {})}
      />

      {(content || isStreaming || error) && (
        <StreamingInterpretation
          content={content}
          isStreaming={isStreaming}
          isCached={isCached}
          error={error && !followUpStreaming ? error : null}
          onRetry={handleRetry}
          onStop={handleStop}
        />
      )}

      {interpretationId && (
        <FollowUpChat
          messages={messages}
          onSendMessage={(m) => void handleSendMessage(m)}
          isStreaming={followUpStreaming}
          remainingMessages={Math.max(0, 10 - followUpCount)}
          maxMessages={10}
          onNewSession={handleNewSession}
        />
      )}
    </section>
  )
}
