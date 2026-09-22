import { describe, it, expect } from "vitest"
import { getSystemPrompt } from "@/lib/ai/prompts/system"
import { buildUserPrompt, buildFollowUpPrompt } from "@/lib/ai/prompts/user"

describe("getSystemPrompt", () => {
  it("returns a non-empty string", () => {
    const prompt = getSystemPrompt()
    expect(typeof prompt).toBe("string")
    expect(prompt.length).toBeGreaterThan(0)
  })

  it("includes the identity name Luna", () => {
    expect(getSystemPrompt()).toContain("Luna")
  })

  it("includes pt-BR language rule", () => {
    expect(getSystemPrompt().toLowerCase()).toContain("portugues brasileiro")
  })

  it("includes no-determinism rule", () => {
    expect(getSystemPrompt()).toContain("tendencias")
  })

  it("includes no-medical-diagnosis rule", () => {
    expect(getSystemPrompt()).toContain("diagnosticos")
  })
})

describe("buildUserPrompt", () => {
  const baseInput = {
    userName: "Maria",
    deckName: "Rider-Waite-Smith",
    spreadName: "Tres Cartas",
    mood: "reflexivo",
    cards: [
      {
        position: "Passado",
        cardName: "O Louco",
        cardNumber: 0,
        isReversed: false,
        meaning: "Novos comecos, liberdade, aventura",
      },
      {
        position: "Presente",
        cardName: "A Torre",
        cardNumber: 16,
        isReversed: true,
        meaning: "Evitar mudancas drásticas",
      },
      {
        position: "Futuro",
        cardName: "A Estrela",
        cardNumber: 17,
        isReversed: false,
        meaning: "Esperanca, renovacao",
      },
    ],
    zodiacSign: "Escorpiao",
    personalArcana: "O Hierofante (V)",
  }

  it("returns a non-empty string", () => {
    const prompt = buildUserPrompt({ ...baseInput, mode: "general" })
    expect(typeof prompt).toBe("string")
    expect(prompt.length).toBeGreaterThan(0)
  })

  it("includes user name", () => {
    const prompt = buildUserPrompt({ ...baseInput, mode: "general" })
    expect(prompt).toContain("Maria")
  })

  it("includes deck name", () => {
    const prompt = buildUserPrompt({ ...baseInput, mode: "general" })
    expect(prompt).toContain("Rider-Waite-Smith")
  })

  it("includes spread name", () => {
    const prompt = buildUserPrompt({ ...baseInput, mode: "general" })
    expect(prompt).toContain("Tres Cartas")
  })

  it("includes mood when provided", () => {
    const prompt = buildUserPrompt({ ...baseInput, mode: "general" })
    expect(prompt).toContain("reflexivo")
  })

  it("includes all card names", () => {
    const prompt = buildUserPrompt({ ...baseInput, mode: "general" })
    expect(prompt).toContain("O Louco")
    expect(prompt).toContain("A Torre")
    expect(prompt).toContain("A Estrela")
  })

  it("marks reversed cards", () => {
    const prompt = buildUserPrompt({ ...baseInput, mode: "general" })
    expect(prompt).toContain("(invertida)")
  })

  it("includes zodiac sign when provided", () => {
    const prompt = buildUserPrompt({ ...baseInput, mode: "general" })
    expect(prompt).toContain("Escorpiao")
  })

  it("includes personal arcana when provided", () => {
    const prompt = buildUserPrompt({ ...baseInput, mode: "general" })
    expect(prompt).toContain("O Hierofante")
  })

  it("includes question for yesno mode", () => {
    const prompt = buildUserPrompt({
      ...baseInput,
      mode: "yesno",
      question: "Vou conseguir a vaga?",
    })
    expect(prompt).toContain("Vou conseguir a vaga?")
  })

  it("includes love-specific instructions for love mode", () => {
    const prompt = buildUserPrompt({ ...baseInput, mode: "love" })
    expect(prompt).toContain("amor")
  })

  it("includes career-specific instructions for career mode", () => {
    const prompt = buildUserPrompt({ ...baseInput, mode: "career" })
    expect(prompt).toContain("carreira")
  })

  it("handles missing optional fields", () => {
    const prompt = buildUserPrompt({
      userName: "Ana",
      deckName: "RWS",
      spreadName: "Single Card",
      cards: [
        {
          position: "Um",
          cardName: "O Louco",
          cardNumber: 0,
          isReversed: false,
          meaning: "Comeco",
        },
      ],
      mode: "general",
    })
    expect(prompt).toContain("Ana")
    expect(prompt).toContain("O Louco")
  })
})

describe("buildFollowUpPrompt", () => {
  it("returns a non-empty string", () => {
    const prompt = buildFollowUpPrompt({
      userName: "Maria",
      originalReadingSummary: "Tiragem de 3 cartas",
      previousInterpretation: "Interpretacao anterior",
      conversationHistory: [
        { role: "user", content: "Pergunta anterior" },
        { role: "assistant", content: "Resposta anterior" },
      ],
      userMessage: "E sobre meu trabalho?",
    })
    expect(typeof prompt).toBe("string")
    expect(prompt.length).toBeGreaterThan(0)
  })

  it("includes the current user message", () => {
    const prompt = buildFollowUpPrompt({
      userName: "Maria",
      originalReadingSummary: "Tiragem",
      previousInterpretation: "Interpretacao",
      conversationHistory: [],
      userMessage: "E sobre meu trabalho?",
    })
    expect(prompt).toContain("E sobre meu trabalho?")
  })

  it("includes conversation history", () => {
    const prompt = buildFollowUpPrompt({
      userName: "Maria",
      originalReadingSummary: "Tiragem",
      previousInterpretation: "Interpretacao",
      conversationHistory: [
        { role: "user", content: "Minha primeira pergunta" },
        { role: "assistant", content: "Minha primeira resposta" },
      ],
      userMessage: "Segunda pergunta",
    })
    expect(prompt).toContain("Minha primeira pergunta")
    expect(prompt).toContain("Minha primeira resposta")
  })

  it("includes the original reading summary", () => {
    const prompt = buildFollowUpPrompt({
      userName: "Maria",
      originalReadingSummary:
        "Tiragem de Tres Cartas com O Louco, A Torre, A Estrela",
      previousInterpretation: "Interpretacao",
      conversationHistory: [],
      userMessage: "Pergunta",
    })
    expect(prompt).toContain("Tiragem de Tres Cartas")
  })

  it("includes previous interpretation", () => {
    const prompt = buildFollowUpPrompt({
      userName: "Maria",
      originalReadingSummary: "Tiragem",
      previousInterpretation: "Texto da interpretacao anterior completa",
      conversationHistory: [],
      userMessage: "Pergunta",
    })
    expect(prompt).toContain("Texto da interpretacao anterior completa")
  })
})
