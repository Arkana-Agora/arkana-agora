// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen, cleanup, fireEvent } from "@testing-library/react"

const pushMock = vi.fn()
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, back: vi.fn() }),
}))

const useReadingMock = vi.fn()
vi.mock("@/hooks/use-readings", () => ({
  useReading: (id: string) => useReadingMock(id),
}))

vi.mock("@/components/ai/reading-ai-panel", () => ({
  ReadingAIPanel: () => <div data-testid="ai-panel" />,
}))

import { useReadingStore } from "@/stores/reading-store"
import TiragemPage from "@/app/(app)/tiragem/[id]/page"

describe("Pagina de detalhe da tiragem", () => {
  beforeEach(() => {
    pushMock.mockClear()
    useReadingMock.mockReturnValue({
      data: {
        reading: {
          id: "reading-1",
          deckId: "rws",
          spreadId: "three-cards",
          title: "Minha tiragem",
          notes: null,
          seed: "abc",
          duration: 12,
          isPublic: false,
          createdAt: "2026-10-16T11:00:00Z",
          cards: [
            { id: "c1", cardId: "rws-01", positionIndex: 0, isReversed: false },
          ],
        },
      },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    })
    useReadingStore.setState({
      step: "reveal",
      deckId: "rws",
      spreadId: "three-cards",
      cards: [
        { id: "c1", cardId: "rws-01", positionIndex: 0, isReversed: false },
      ],
      createdReadingId: "reading-1",
      flippedCards: [],
      selectedCardIndex: null,
      question: "",
    })
  })

  afterEach(() => {
    cleanup()
    sessionStorage.clear()
    useReadingStore.getState().reset()
  })

  it("exibe botao 'Nova tiragem' que reseta a sessao e volta para /tirar", () => {
    // thenable sincrono: o use() real do React resolve sem suspender em
    // jsdom — sem mockar react e com o id fluindo de verdade.
    const params = {
      then(onFulfilled: (v: { id: string }) => unknown) {
        return onFulfilled({ id: "reading-1" })
      },
    } as unknown as Promise<{ id: string }>
    render(<TiragemPage params={params} />)

    const button = screen.getByRole("button", { name: "Nova tiragem" })
    expect(button).toBeInTheDocument()

    fireEvent.click(button)

    expect(pushMock).toHaveBeenCalledWith("/tirar")
    expect(useReadingStore.getState().step).toBe("deck")
    expect(useReadingStore.getState().createdReadingId).toBeNull()
  })
})
