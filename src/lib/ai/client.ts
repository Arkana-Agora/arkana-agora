export interface AIChatMessage {
  role: "system" | "user" | "assistant"
  content: string
}

export interface AIStreamChunk {
  choices: Array<{
    delta?: { content?: string }
    finish_reason?: string | null
  }>
}

export type AIStreamResponse = AsyncIterable<AIStreamChunk>

export interface AIClient {
  chat: {
    completions: {
      create(params: {
        model: string
        messages: AIChatMessage[]
        stream: true
        max_tokens?: number
        temperature?: number
        top_p?: number
        presence_penalty?: number
        frequency_penalty?: number
      }): Promise<AIStreamResponse>
    }
  }
}

let clientInstance: AIClient | null = null

export interface AIClientConfig {
  apiKey: string
  baseURL?: string
}

// AI_BASE_URL permite apontar o SDK openai (mantido — ADR-012) para um
// endpoint compatível (ex.: z.ai/GLM) sem trocar o SDK. Ausente => OpenAI.
// Como o SDK anexa `Authorization: Bearer <AI_API_KEY>` na baseURL, o esquema
// é validado: http(s) apenas, e https obrigatório em produção (evita enviar a
// chave em claro). A baseURL é confiada ao operador (env var server-side).
//
// NOTA: este modulo le `process.env.AI_API_KEY`/`AI_BASE_URL` (segredos server
// side). Nao importar de Client Components — consumido apenas pelo route
// handler em `src/app/api/v1/ai/_helpers.ts`.
export function resolveAIClientConfig(): AIClientConfig {
  const apiKey = process.env.AI_API_KEY
  if (!apiKey) {
    throw new Error("AI_API_KEY environment variable is required")
  }

  const baseURL = process.env.AI_BASE_URL?.trim()
  if (!baseURL) return { apiKey }

  let parsed: URL
  try {
    parsed = new URL(baseURL)
  } catch {
    throw new Error("AI_BASE_URL must be a valid URL")
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error("AI_BASE_URL must use the http or https protocol")
  }
  if (process.env.NODE_ENV === "production" && parsed.protocol !== "https:") {
    throw new Error("AI_BASE_URL must use https in production")
  }

  return { apiKey, baseURL }
}

export function getAIClient(): AIClient {
  if (clientInstance) return clientInstance

  const config = resolveAIClientConfig()

  // Lazy import to avoid module-level side effects
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const OpenAI = require("openai").default ?? require("openai")
  clientInstance = new OpenAI(config) as AIClient
  return clientInstance
}

export function setAIClient(client: AIClient): void {
  clientInstance = client
}

export function resetAIClient(): void {
  clientInstance = null
}
