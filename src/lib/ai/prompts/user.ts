import type { InterpretationMode } from "@/lib/ai/cache"

const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?(previous|prior|above)\s+instructions?/i,
  /you\s+are\s+now\s+(a|an)\s+/i,
  /system\s*:\s*/i,
  /assistant\s*:\s*/i,
  /\[INST\]/i,
  /<\|im_start\|>/i,
  /<\|im_end\|>/i,
  /<\|system\|>/i,
  /<\|user\|>/i,
  /<\|assistant\|>/i,
]

export function sanitizeInput(input: string): string {
  let clean = input
  for (const pattern of INJECTION_PATTERNS) {
    clean = clean.replace(pattern, "[redacted]")
  }
  return clean
}

interface PromptCard {
  position: string
  positionDescription?: string
  cardName: string
  cardNumber: number
  isReversed: boolean
  meaning: string
  keywords?: string[]
  advice?: string
}

interface UserPromptInput {
  userName: string
  deckName: string
  deckDescription?: string
  spreadName: string
  spreadDescription?: string
  cards: PromptCard[]
  mode: InterpretationMode
  mood?: string
  question?: string
  zodiacSign?: string
  personalArcana?: string
}

export function buildUserPrompt(input: UserPromptInput): string {
  const lines: string[] = []

  const safeName = sanitizeInput(input.userName)
  const safeMood = input.mood ? sanitizeInput(input.mood) : undefined
  const safeQuestion = input.question
    ? sanitizeInput(input.question)
    : undefined

  if (input.mode === "yesno") {
    lines.push(
      `${safeName}, aqui esta sua leitura de Sim/Nao.`,
      "",
      `PERGUNTA: "${safeQuestion ?? ""}"`,
    )
  } else {
    const focusHint =
      input.mode === "love"
        ? " com foco em amor e relacionamentos"
        : input.mode === "career"
          ? " com foco em carreira e financas"
          : ""
    lines.push(
      `${safeName}, aqui esta sua leitura de ${input.spreadName}${focusHint}.`,
    )
  }

  if (safeMood) {
    lines.push("", `Estado emocional: ${safeMood}`)
  }

  if (safeQuestion && input.mode !== "yesno") {
    lines.push("", `Pergunta do consultante: "${safeQuestion}"`)
  }

  if (input.zodiacSign) {
    lines.push(`Signo solar: ${input.zodiacSign}`)
  }

  if (input.personalArcana) {
    lines.push(`Arcano pessoal: ${input.personalArcana}`)
  }

  lines.push(
    "",
    `Baralho: ${input.deckName}${
      input.deckDescription ? ` — ${input.deckDescription}` : ""
    }`,
    `Espalhamento: ${input.spreadName}${
      input.spreadDescription ? ` (${input.spreadDescription})` : ""
    }`,
  )
  lines.push("", "CARTAS:")

  for (const card of input.cards) {
    const reversed = card.isReversed ? " (invertida)" : ""
    lines.push(
      `${card.position}: ${card.cardName} (${card.cardNumber})${reversed}`,
    )
    if (card.positionDescription) {
      lines.push(`   O que a posição significa: ${card.positionDescription}`)
    }
    lines.push(`   Significado: ${card.meaning}`)
    if (card.keywords && card.keywords.length > 0) {
      lines.push(`   Palavras-chave: ${card.keywords.join(", ")}`)
    }
    if (card.advice) {
      lines.push(`   Conselho: ${card.advice}`)
    }
  }

  if (input.mode === "yesno") {
    lines.push(
      "",
      "Analise cada carta e sua orientacao. Responda com 'Sim', 'Nao' ou 'Inconclusivo', seguido de justificativa.",
    )
  } else {
    lines.push(
      "",
      "Gere a interpretacao completa desta tiragem seguindo o formato:",
      "1. Resumo geral",
      "2. Interpretacao detalhada de cada carta na sua posicao",
      "3. Conselho pratico",
      "4. Afirmacao positiva",
    )
  }

  return lines.join("\n")
}

interface FollowUpPromptInput {
  userName: string
  originalReadingSummary: string
  previousInterpretation: string
  conversationHistory: Array<{ role: string; content: string }>
  userMessage: string
}

export function buildFollowUpPrompt(input: FollowUpPromptInput): string {
  const lines: string[] = []

  const safeName = sanitizeInput(input.userName)
  const safeMessage = sanitizeInput(input.userMessage)

  lines.push(
    "CONTEXTO DA LEITURA ANTERIOR:",
    `- Resumo: ${input.originalReadingSummary}`,
    `- Interpretacao: ${input.previousInterpretation}`,
    "",
    "HISTORICO DA CONVERSA:",
  )

  for (const msg of input.conversationHistory) {
    lines.push(`${msg.role}: ${msg.content}`)
  }

  lines.push(
    "",
    `PERGUNTA ATUAL DO ${safeName.toUpperCase()}: "${safeMessage}"`,
    "",
    "Responda de forma concisa (2-3 paragrafos), referenciando as cartas da tiragem quando relevante.",
  )

  return lines.join("\n")
}
