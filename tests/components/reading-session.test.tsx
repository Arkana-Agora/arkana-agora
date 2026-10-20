// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen, cleanup, fireEvent, act } from "@testing-library/react"

vi.mock("@/lib/api", () => ({ default: { get: vi.fn(), post: vi.fn() } }))

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
}))

vi.mock("@/components/ai/reading-ai-panel", () => ({
  ReadingAIPanel: ({
    readingId,
    autoStart,
    question,
  }: {
    readingId: string
    autoStart?: boolean
    question?: string
  }) => (
    <div
      data-testid="ai-panel"
      data-reading-id={readingId}
      data-auto-start={autoStart ? "true" : "false"}
      data-question={question ?? ""}
    />
  ),
}))

const useDailyCount = vi.fn()
const useDecks = vi.fn()
const useSpreads = vi.fn()
const useCreateReading = vi.fn()

vi.mock("@/hooks/use-readings", () => ({
  useDailyCount: () => useDailyCount(),
  useDecks: () => useDecks(),
  useSpreads: () => useSpreads(),
  useCreateReading: () => useCreateReading(),
}))

import { useReadingStore } from "@/stores/reading-store"
import { ReadingSession } from "@/components/tarot/reading-session"

describe("ReadingSession no passo reveal", () => {
  beforeEach(() => {
    useDailyCount.mockReturnValue({
      data: { count: 1, totalLimit: 5, remaining: 4, tier: "FREE" },
      isLoading: false,
    })
    useDecks.mockReturnValue({ data: [], isLoading: false })
    useCreateReading.mockReturnValue({ mutateAsync: vi.fn(), isPending: false })
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
    })
  })

  afterEach(() => {
    cleanup()
    sessionStorage.clear()
    useReadingStore.getState().reset()
  })

  it("mantem 'Nova tiragem' acessivel mesmo com a query de spreads ainda nao resolvida", () => {
    useSpreads.mockReturnValue({ data: undefined, isLoading: true })

    render(<ReadingSession />)

    expect(screen.getByText(/4 restantes/)).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Nova tiragem" }),
    ).toBeInTheDocument()
  })

  it("mantem 'Nova tiragem' acessivel quando a query de spreads falha", () => {
    useSpreads.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
    })

    render(<ReadingSession />)

    expect(
      screen.getByRole("button", { name: "Nova tiragem" }),
    ).toBeInTheDocument()
  })
})

describe("ReadingSession no passo question", () => {
  beforeEach(() => {
    useDailyCount.mockReturnValue({
      data: { count: 1, totalLimit: 5, remaining: 4, tier: "FREE" },
      isLoading: false,
    })
    useDecks.mockReturnValue({ data: [], isLoading: false })
    useSpreads.mockReturnValue({ data: [], isLoading: false })
    useCreateReading.mockReturnValue({ mutateAsync: vi.fn(), isPending: false })
    useReadingStore.setState({
      step: "question",
      deckId: "rws",
      spreadId: "three-cards",
      cards: [],
      createdReadingId: null,
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

  it("exibe input de pergunta e inicia o sorteio ao confirmar", () => {
    render(<ReadingSession />)

    const input = screen.getByLabelText(/pergunta|intencao/i)
    expect(input).toBeInTheDocument()

    fireEvent.change(input, { target: { value: "Vou passar bem?" } })
    fireEvent.click(screen.getByRole("button", { name: /sortear|comecar/i }))

    expect(useReadingStore.getState().question).toBe("Vou passar bem?")
    expect(useReadingStore.getState().step).toBe("draw")
  })

  it("permite pular a pergunta e ir direto ao sorteio", () => {
    render(<ReadingSession />)

    const skip = screen.getByRole("button", { name: /pular|sem pergunta/i })
    fireEvent.click(skip)

    expect(useReadingStore.getState().step).toBe("draw")
  })

  it("limita o textarea da pergunta a 200 caracteres (contrato do interpretSchema)", () => {
    render(<ReadingSession />)

    const input = screen.getByLabelText(/pergunta|intencao/i)
    expect(input).toHaveAttribute("maxlength", "200")
  })

  it("restaura no draft a pergunta persistida pelo store (reload mid-draw)", () => {
    useReadingStore.setState({ question: "Pergunta persistida?" })

    render(<ReadingSession />)

    const input = screen.getByLabelText(/pergunta|intencao/i)
    expect(input).toHaveValue("Pergunta persistida?")
  })

  it("limpa o draft apos um reset da sessao", () => {
    render(<ReadingSession />)

    const input = screen.getByLabelText(/pergunta|intencao/i)
    fireEvent.change(input, { target: { value: "Outra pergunta?" } })
    fireEvent.click(screen.getByRole("button", { name: /voltar/i }))

    expect(useReadingStore.getState().step).toBe("deck")
    cleanup()

    // nova sessao: deck → spread → question novamente
    useReadingStore.setState({ step: "question" })
    render(<ReadingSession />)
    expect(screen.getByLabelText(/pergunta|intencao/i)).toHaveValue("")
  })
})

describe("ReadingSession envia a pergunta para o painel de IA", () => {
  beforeEach(() => {
    useDailyCount.mockReturnValue({
      data: { count: 1, totalLimit: 5, remaining: 4, tier: "FREE" },
      isLoading: false,
    })
    useDecks.mockReturnValue({ data: [], isLoading: false })
    useSpreads.mockReturnValue({
      data: [
        {
          id: "three-cards",
          name: "3 Cartas",
          description: "Passado Presente Futuro",
          deckType: "tarot",
          cardCount: 3,
          difficulty: "beginner",
          estimatedTime: 5,
          positions: [],
          layout: "linear",
        },
      ],
      isLoading: false,
    })
    useCreateReading.mockReturnValue({ mutateAsync: vi.fn(), isPending: false })
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
      question: "Vou passar bem na viagem?",
    })
  })

  afterEach(() => {
    cleanup()
    sessionStorage.clear()
    useReadingStore.getState().reset()
  })

  it("passa a pergunta do store como prop para ReadingAIPanel", () => {
    render(<ReadingSession />)

    const panel = screen.getByTestId("ai-panel")
    expect(panel).toHaveAttribute("data-question", "Vou passar bem na viagem?")
  })
})

describe("ReadingSession layout de reveal integrado", () => {
  beforeEach(() => {
    useDailyCount.mockReturnValue({
      data: { count: 1, totalLimit: 5, remaining: 4, tier: "FREE" },
      isLoading: false,
    })
    useDecks.mockReturnValue({ data: [], isLoading: false })
    useSpreads.mockReturnValue({
      data: [
        {
          id: "three-cards",
          name: "3 Cartas",
          description: "Passado Presente Futuro",
          deckType: "tarot",
          cardCount: 3,
          difficulty: "beginner",
          estimatedTime: 5,
          positions: [],
          layout: "linear",
        },
      ],
      isLoading: false,
    })
    useCreateReading.mockReturnValue({ mutateAsync: vi.fn(), isPending: false })
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

  it("renderiza cartas e painel de IA como irmaos num container grid (desktop: 2 colunas)", () => {
    render(<ReadingSession />)

    const panel = screen.getByTestId("ai-panel")
    const grid = panel.closest('[data-testid="reveal-grid"]')
    expect(grid).not.toBeNull()
    // o grid deve conter tanto a area de cartas quanto o painel
    expect(grid?.querySelector('[data-testid="ai-panel"]')).not.toBeNull()
  })

  it("aplica as classes de grid responsivo no container de reveal", () => {
    render(<ReadingSession />)

    const grid = screen.getByTestId("reveal-grid")
    expect(grid.className).toContain("lg:grid-cols-2")
  })

  it("'Nova tiragem' fica em posicao destacada (antes do grid, botao primario)", () => {
    render(<ReadingSession />)

    const button = screen.getByRole("button", { name: "Nova tiragem" })
    expect(button).toHaveAttribute("data-variant", "default")

    const grid = screen.getByTestId("reveal-grid")
    expect(
      button.compareDocumentPosition(grid) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()

    expect(
      screen.getByRole("button", { name: "Ver detalhes e interpretação" }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Compartilhar" }),
    ).toBeInTheDocument()
  })

  // O scroll-into-view-once e coberto no painel real em
  // tests/components/reading-ai-panel.test.tsx (spy de scrollIntoView) —
  // aqui o painel e mockado e qualquer assertion seria vacua.
})

describe("ReadingSession revelacao sequencial e resumo (BR-TIR-003)", () => {
  const threeCardSpread = {
    id: "three-cards",
    name: "3 Cartas",
    description: "Passado Presente Futuro",
    deckType: "tarot",
    cardCount: 3,
    difficulty: "beginner",
    estimatedTime: 5,
    positions: [
      { name: "Passado", description: "", x: 15, y: 50 },
      { name: "Presente", description: "", x: 50, y: 50 },
      { name: "Futuro", description: "", x: 85, y: 50 },
    ],
    layout: "linear",
  }

  function seedReveal() {
    useDailyCount.mockReturnValue({
      data: { count: 1, totalLimit: 5, remaining: 4, tier: "FREE" },
      isLoading: false,
    })
    useDecks.mockReturnValue({ data: [], isLoading: false })
    useSpreads.mockReturnValue({ data: [threeCardSpread], isLoading: false })
    useCreateReading.mockReturnValue({ mutateAsync: vi.fn(), isPending: false })
    useReadingStore.setState({
      step: "reveal",
      deckId: "rws",
      spreadId: "three-cards",
      cards: [
        {
          id: "c1",
          cardId: "rws-major-0",
          positionIndex: 0,
          isReversed: false,
        },
        { id: "c2", cardId: "rws-major-1", positionIndex: 1, isReversed: true },
        {
          id: "c3",
          cardId: "rws-major-2",
          positionIndex: 2,
          isReversed: false,
        },
      ],
      createdReadingId: "reading-1",
      flippedCards: [],
      selectedCardIndex: null,
      question: "",
    })
  }

  beforeEach(() => {
    vi.useFakeTimers()
    seedReveal()
  })

  afterEach(() => {
    vi.useRealTimers()
    cleanup()
    sessionStorage.clear()
    useReadingStore.getState().reset()
  })

  it("revela as cartas uma a uma, na ordem, a cada 1.5s", () => {
    render(<ReadingSession />)

    expect(useReadingStore.getState().flippedCards).toEqual([])

    act(() => {
      vi.advanceTimersByTime(1500)
    })
    expect(useReadingStore.getState().flippedCards).toEqual([0])

    act(() => {
      vi.advanceTimersByTime(1500)
    })
    expect(useReadingStore.getState().flippedCards).toEqual([0, 1])

    act(() => {
      vi.advanceTimersByTime(1500)
    })
    expect(useReadingStore.getState().flippedCards).toEqual([0, 1, 2])
  })

  it("exibe o resumo textual crescendo conforme cada carta e revelada", () => {
    render(<ReadingSession />)

    // Nada revelado ainda: o resumo ainda nao existe.
    expect(screen.queryByTestId("drawn-cards-summary")).not.toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(1500)
    })
    let summary = screen.getByTestId("drawn-cards-summary")
    expect(summary).toHaveTextContent("Passado")
    expect(summary).toHaveTextContent("O Louco")
    expect(summary).not.toHaveTextContent("O Mago")
    expect(summary).not.toHaveTextContent("A Sacerdotisa")

    act(() => {
      vi.advanceTimersByTime(1500)
    })
    summary = screen.getByTestId("drawn-cards-summary")
    expect(summary).toHaveTextContent("Presente")
    expect(summary).toHaveTextContent("O Mago")
    expect(summary).toHaveTextContent(/invertida/i)
    expect(summary).not.toHaveTextContent("A Sacerdotisa")

    act(() => {
      vi.advanceTimersByTime(1500)
    })
    summary = screen.getByTestId("drawn-cards-summary")
    expect(summary).toHaveTextContent("Futuro")
    expect(summary).toHaveTextContent("A Sacerdotisa")
  })

  it("nao re-revela cartas ja viradas ao re-montar (isRevealed)", () => {
    useReadingStore.setState({ flippedCards: [0, 1] })
    render(<ReadingSession />)

    // Apenas a carta pendente (indice 2) deve ser revelada, no 1º intervalo.
    act(() => {
      vi.advanceTimersByTime(1500)
    })
    expect(useReadingStore.getState().flippedCards).toEqual([0, 1, 2])
  })
})
