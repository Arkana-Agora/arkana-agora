import { describe, it, expect } from "vitest"
import {
  resolveReadingPromptContext,
  type ResolvedPromptCard,
  type ResolvedReadingContext,
} from "@/lib/ai/prompts/reading-context"
import { buildUserPrompt } from "@/lib/ai/prompts/user"
import { getDeckCards } from "@/lib/tarot/decks"

function cardAt(
  resolved: ResolvedReadingContext,
  index: number,
): ResolvedPromptCard {
  const card = resolved.cards[index]
  if (!card) throw new Error(`carta ${index} ausente no contexto resolvido`)
  return card
}

describe("resolveReadingPromptContext (enriquecimento do prompt da IA)", () => {
  const reading = {
    deckId: "rws",
    spreadId: "three-card",
    cards: [
      { cardId: "rws-major-0", positionIndex: 0, isReversed: false },
      { cardId: "rws-major-16", positionIndex: 1, isReversed: true },
    ],
  }

  it("resolve o nome de exibicao do baralho (nao o id crudo)", () => {
    const resolved = resolveReadingPromptContext(reading, "general")
    expect(resolved.deckName).toBe("Rider-Waite-Smith")
    expect(resolved.deckName).not.toBe("RWS")
    expect(resolved.deckDescription.length).toBeGreaterThan(0)
  })

  it("resolve o nome e a descricao do espalhamento (nao o slug)", () => {
    const resolved = resolveReadingPromptContext(reading, "general")
    expect(resolved.spreadName).toBe("Três Cartas")
    expect(resolved.spreadDescription.length).toBeGreaterThan(0)
  })

  it("resolve o nome real da carta (nao o cardId)", () => {
    const resolved = resolveReadingPromptContext(reading, "general")
    expect(cardAt(resolved, 0).cardName).toBe("O Louco")
    expect(cardAt(resolved, 0).cardName).not.toContain("rws-major")
    expect(cardAt(resolved, 0).cardNumber).toBe(0)
  })

  it("resolve o nome e a descricao da posicao do espalhamento", () => {
    const resolved = resolveReadingPromptContext(reading, "general")
    expect(cardAt(resolved, 0).position).toBe("Passado")
    expect(cardAt(resolved, 0).positionDescription.length).toBeGreaterThan(0)
    expect(cardAt(resolved, 1).position).toBe("Presente")
  })

  it("usa meaningUp para carta ereta e meaningReversed para invertida", () => {
    const cards = getDeckCards("rws")
    const fool = cards.find((c) => c.id === "rws-major-0")
    const tower = cards.find((c) => c.id === "rws-major-16")
    const resolved = resolveReadingPromptContext(reading, "general")

    expect(fool && "meaningUp" in fool ? fool.meaningUp : "").not.toBe("")
    expect(
      tower && "meaningReversed" in tower ? tower.meaningReversed : "",
    ).not.toBe("")
    expect(cardAt(resolved, 0).meaning).toContain("um novo come")
    expect(cardAt(resolved, 1).meaning).toContain(
      tower && "meaningReversed" in tower
        ? tower.meaningReversed.slice(0, 40)
        : "",
    )
  })

  it("inclui palavras-chave e conselho da carta", () => {
    const resolved = resolveReadingPromptContext(reading, "general")
    expect(cardAt(resolved, 0).keywords.length).toBeGreaterThan(0)
    expect(cardAt(resolved, 0).advice.length).toBeGreaterThan(0)
  })

  it("para Lenormand usa meaningGeneral (baralho sem invertidas)", () => {
    const resolved = resolveReadingPromptContext(
      {
        deckId: "lenormand",
        spreadId: "lenormand-3",
        cards: [
          { cardId: "lenormand-01", positionIndex: 0, isReversed: false },
        ],
      },
      "general",
    )
    expect(resolved.deckName).toBe("Grand Lenormand")
    expect(cardAt(resolved, 0).cardName).toBe("Cavaleiro")
    expect(cardAt(resolved, 0).meaning.length).toBeGreaterThan(0)
    expect(cardAt(resolved, 0).advice).toBe("")
  })

  it("para Lenormand usa a linguagem propria do modo (love)", () => {
    const resolved = resolveReadingPromptContext(
      {
        deckId: "lenormand",
        spreadId: "lenormand-3",
        cards: [
          { cardId: "lenormand-01", positionIndex: 0, isReversed: false },
        ],
      },
      "love",
    )
    const cards = getDeckCards("lenormand")
    const knight = cards.find((c) => c.id === "lenormand-01")
    expect(cardAt(resolved, 0).meaning).toContain(
      knight && "meaningLove" in knight ? knight.meaningLove.slice(0, 30) : "",
    )
  })

  it("cai para fallback quando baralho/espalhamento/carta nao existem", () => {
    const resolved = resolveReadingPromptContext(
      {
        deckId: "deck-fantasma",
        spreadId: "spread-fantasma",
        cards: [
          { cardId: "carta-fantasma", positionIndex: 0, isReversed: false },
        ],
      },
      "general",
    )
    expect(resolved.deckName).toBe("deck-fantasma")
    expect(resolved.spreadName).toBe("spread-fantasma")
    expect(cardAt(resolved, 0).cardName).toBe("carta-fantasma")
    expect(cardAt(resolved, 0).position).toBe("Posicao 1")
    expect(cardAt(resolved, 0).meaning).toBe("")
  })
})

describe("prompt final montado (resolver + buildUserPrompt)", () => {
  it("nao envia ids crus de carta/baralho/espalhamento para a IA", () => {
    const resolved = resolveReadingPromptContext(
      {
        deckId: "rws",
        spreadId: "three-card",
        cards: [
          { cardId: "rws-major-0", positionIndex: 0, isReversed: false },
          { cardId: "rws-major-16", positionIndex: 1, isReversed: true },
        ],
      },
      "general",
    )
    const prompt = buildUserPrompt({
      userName: "Maria",
      deckName: resolved.deckName,
      spreadName: resolved.spreadName,
      cards: resolved.cards,
      mode: "general",
    })

    expect(prompt).toContain("O Louco")
    expect(prompt).toContain("Rider-Waite-Smith")
    expect(prompt).toContain("Três Cartas")
    expect(prompt).toContain("Passado")
    expect(prompt).not.toContain("rws-major-0")
    expect(prompt).not.toContain("three-card")
    // significado nunca deve vir vazio
    expect(prompt).not.toMatch(/Significado:\s*\n/)
  })

  it("inclui o contexto do espalhamento (descricao e posicoes)", () => {
    const resolved = resolveReadingPromptContext(
      {
        deckId: "rws",
        spreadId: "three-card",
        cards: [{ cardId: "rws-major-0", positionIndex: 0, isReversed: false }],
      },
      "general",
    )
    const prompt = buildUserPrompt({
      userName: "Maria",
      deckName: resolved.deckName,
      spreadName: resolved.spreadName,
      cards: resolved.cards,
      mode: "general",
      spreadDescription: resolved.spreadDescription,
    })

    expect(prompt).toContain("Passado, Presente e Futuro")
    expect(prompt).toContain("O que a posição significa")
    expect(prompt).toContain("Palavras-chave")
  })

  it("inclui a pergunta do consultante em todos os modos", () => {
    const resolved = resolveReadingPromptContext(
      {
        deckId: "rws",
        spreadId: "single-card",
        cards: [{ cardId: "rws-major-0", positionIndex: 0, isReversed: false }],
      },
      "general",
    )
    const prompt = buildUserPrompt({
      userName: "Maria",
      deckName: resolved.deckName,
      spreadName: resolved.spreadName,
      cards: resolved.cards,
      mode: "general",
      question: "Devo mudar de emprego?",
    })

    expect(prompt).toContain("Devo mudar de emprego?")
  })
})
