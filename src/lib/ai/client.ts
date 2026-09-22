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

export function getAIClient(): AIClient {
  if (clientInstance) return clientInstance

  const apiKey = process.env.AI_API_KEY
  if (!apiKey) {
    throw new Error("AI_API_KEY environment variable is required")
  }

  // Lazy import to avoid module-level side effects
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const OpenAI = require("openai").default ?? require("openai")
  clientInstance = new OpenAI({ apiKey }) as AIClient
  return clientInstance
}

export function setAIClient(client: AIClient): void {
  clientInstance = client
}

export function resetAIClient(): void {
  clientInstance = null
}
