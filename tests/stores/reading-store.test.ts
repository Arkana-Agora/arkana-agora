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
  })

  it("selects deck and advances step", async () => {
    const store = await importStore()
    const { result } = renderHook(() => store())

    act(() => result.current.selectDeck("rws"))
    expect(result.current.deckId).toBe("rws")
    expect(result.current.step).toBe("spread")
  })

  it("selects spread and advances step", async () => {
    const store = await importStore()
    const { result } = renderHook(() => store())

    act(() => {
      result.current.selectDeck("rws")
      result.current.selectSpread("three-card")
    })
    expect(result.current.spreadId).toBe("three-card")
    expect(result.current.step).toBe("draw")
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
      result.current.setCards([
        { id: "c1", cardId: "fool", positionIndex: 0, isReversed: false },
      ])
    })

    act(() => result.current.reset())
    expect(result.current.deckId).toBeNull()
    expect(result.current.spreadId).toBeNull()
    expect(result.current.cards).toEqual([])
    expect(result.current.step).toBe("deck")
  })
})
