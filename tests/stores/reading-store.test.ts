import { beforeEach, describe, expect, it } from "vitest"
import { renderHook, act } from "@testing-library/react"

beforeEach(() => {
  sessionStorage.clear()
})

describe("ReadingStore", () => {
  async function importStore() {
    const mod = await import("@/stores/reading-store")
    mod.useReadingStore.setState(mod.useReadingStore.getInitialState())
    return mod.useReadingStore
  }

  it("starts with initial state", async () => {
    const store = await importStore()
    const { result } = renderHook(() => store())

    expect(result.current.deckId).toBeNull()
    expect(result.current.spreadId).toBeNull()
    expect(result.current.cards).toEqual([])
    expect(result.current.step).toBe("deck")
    expect(result.current.selectedCardIndex).toBeNull()
    expect(result.current.question).toBe("")
  })

  it("selects deck and advances step", async () => {
    const store = await importStore()
    const { result } = renderHook(() => store())

    act(() => result.current.selectDeck("rws"))
    expect(result.current.deckId).toBe("rws")
    expect(result.current.step).toBe("spread")
  })

  it("selects spread and advances to question step", async () => {
    const store = await importStore()
    const { result } = renderHook(() => store())

    act(() => {
      result.current.selectDeck("rws")
      result.current.selectSpread("three-card")
    })
    expect(result.current.spreadId).toBe("three-card")
    expect(result.current.step).toBe("question")
  })

  it("stores question/intention and starts draw on demand", async () => {
    const store = await importStore()
    const { result } = renderHook(() => store())

    act(() => {
      result.current.selectDeck("rws")
      result.current.selectSpread("three-card")
    })
    expect(result.current.step).toBe("question")

    act(() => result.current.setQuestion("Vou passar bem na viagem?"))
    expect(result.current.question).toBe("Vou passar bem na viagem?")

    act(() => result.current.startDraw())
    expect(result.current.step).toBe("draw")
  })

  it("skips question (empty) and still starts draw", async () => {
    const store = await importStore()
    const { result } = renderHook(() => store())

    act(() => {
      result.current.selectDeck("rws")
      result.current.selectSpread("three-card")
      result.current.startDraw()
    })
    expect(result.current.step).toBe("draw")
    expect(result.current.question).toBe("")
  })

  it("sets cards and moves to reveal", async () => {
    const store = await importStore()
    const { result } = renderHook(() => store())

    act(() => {
      result.current.setCards([
        { id: "c1", cardId: "fool", positionIndex: 0, isReversed: false },
        { id: "c2", cardId: "magician", positionIndex: 1, isReversed: true },
      ])
    })
    expect(result.current.cards).toHaveLength(2)
    expect(result.current.step).toBe("reveal")
  })

  it("selects card for detail view", async () => {
    const store = await importStore()
    const { result } = renderHook(() => store())

    act(() => {
      result.current.setCards([
        { id: "c1", cardId: "fool", positionIndex: 0, isReversed: false },
      ])
      result.current.selectCard(0)
    })
    expect(result.current.selectedCardIndex).toBe(0)

    act(() => result.current.selectCard(null))
    expect(result.current.selectedCardIndex).toBeNull()
  })

  it("resets session", async () => {
    const store = await importStore()
    const { result } = renderHook(() => store())

    act(() => {
      result.current.selectDeck("rws")
      result.current.selectSpread("three-card")
      result.current.setQuestion("minha pergunta")
      result.current.startDraw()
      result.current.setCards([
        { id: "c1", cardId: "fool", positionIndex: 0, isReversed: false },
      ])
    })

    act(() => result.current.reset())
    expect(result.current.deckId).toBeNull()
    expect(result.current.spreadId).toBeNull()
    expect(result.current.cards).toEqual([])
    expect(result.current.step).toBe("deck")
    expect(result.current.question).toBe("")
  })

  it("toggles flippedCards as an array (JSON-serializable)", async () => {
    const store = await importStore()
    const { result } = renderHook(() => store())

    expect(Array.isArray(result.current.flippedCards)).toBe(true)
    expect(result.current.flippedCards).toEqual([])

    act(() => result.current.setFlippedCard(0))
    expect(result.current.flippedCards).toEqual([0])

    act(() => result.current.setFlippedCard(1))
    expect(result.current.flippedCards).toEqual([0, 1])

    act(() => result.current.setFlippedCard(1))
    expect(result.current.flippedCards).toEqual([0])

    expect(JSON.parse(JSON.stringify(result.current.flippedCards))).toEqual([0])
  })

  it("stores createdReadingId", async () => {
    const store = await importStore()
    const { result } = renderHook(() => store())

    expect(result.current.createdReadingId).toBeNull()

    act(() => result.current.setCreatedReadingId("reading_123"))
    expect(result.current.createdReadingId).toBe("reading_123")

    act(() => result.current.setCreatedReadingId(null))
    expect(result.current.createdReadingId).toBeNull()
  })

  it("persists flippedCards and createdReadingId to sessionStorage as JSON", async () => {
    const store = await importStore()
    const { result } = renderHook(() => store())

    act(() => {
      result.current.setFlippedCard(2)
      result.current.setCreatedReadingId("reading_abc")
    })

    const raw = sessionStorage.getItem("arkana-reading-session")
    expect(raw).toBeTruthy()
    const parsed = JSON.parse(raw!) as {
      state: { flippedCards: number[]; createdReadingId: string | null }
    }
    expect(parsed.state.flippedCards).toEqual([2])
    expect(parsed.state.createdReadingId).toBe("reading_abc")
  })

  it("persists o step transiente 'draw' como 'question' (reload nao re-dispara o sorteio)", async () => {
    const store = await importStore()
    const { result } = renderHook(() => store())

    act(() => {
      result.current.selectDeck("rws")
      result.current.selectSpread("three-card")
      result.current.setQuestion("Pergunta persistida?")
      result.current.startDraw()
    })
    expect(result.current.step).toBe("draw")

    const raw = sessionStorage.getItem("arkana-reading-session")
    expect(raw).toBeTruthy()
    const parsed = JSON.parse(raw!) as {
      state: { step: string; question: string }
    }
    expect(parsed.state.step).toBe("question")
    expect(parsed.state.question).toBe("Pergunta persistida?")
  })

  it("clears flippedCards and createdReadingId on reset", async () => {
    const store = await importStore()
    const { result } = renderHook(() => store())

    act(() => {
      result.current.setFlippedCard(0)
      result.current.setCreatedReadingId("reading_x")
      result.current.reset()
    })

    expect(result.current.flippedCards).toEqual([])
    expect(result.current.createdReadingId).toBeNull()
  })
})
