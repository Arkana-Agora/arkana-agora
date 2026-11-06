// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"

import HoroscopeHistoryPage from "@/app/(app)/horoscopos/historico/page"

// T096/US-024: histórico com filtros de tipo/período na queryKey, rótulos
// dos catálogos, estado vazio e paginação "Carregar mais".

const mockUseHistory = vi.fn()

vi.mock("@/hooks/use-horoscopes", () => ({
  useHoroscopeHistory: (...args: unknown[]) => mockUseHistory(...args),
}))

const ENTRIES = [
  {
    id: "e1",
    type: "western" as const,
    signId: "aries",
    period: "daily" as const,
    createdAt: "2026-10-19T12:00:00.000Z",
  },
  {
    id: "e2",
    type: "chinese" as const,
    signId: "rato",
    period: "weekly" as const,
    createdAt: "2026-10-18T12:00:00.000Z",
  },
  {
    id: "e3",
    type: "maya" as const,
    signId: "42",
    period: "monthly" as const,
    createdAt: "2026-10-17T12:00:00.000Z",
  },
]

const fetchNextPage = vi.fn()

function buildData(entries: typeof ENTRIES) {
  return {
    pages: [{ data: { entries }, pagination: { nextCursor: null } }],
    pageParams: [null],
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockUseHistory.mockReturnValue({
    data: buildData(ENTRIES),
    isLoading: false,
    isError: false,
    hasNextPage: false,
    fetchNextPage,
    isFetchingNextPage: false,
  })
})

describe("HoroscopeHistoryPage (T096)", () => {
  it("renderiza entradas com rótulos dos catálogos", () => {
    render(<HoroscopeHistoryPage />)

    expect(screen.getByText(/♈ Áries/)).toBeInTheDocument()
    expect(screen.getByText(/Rato/)).toBeInTheDocument()
    expect(screen.getByText("Kin 42")).toBeInTheDocument()
    expect(screen.getByText("Ocidental · Diário")).toBeInTheDocument()
    expect(screen.getByText("Chinês · Semanal")).toBeInTheDocument()
    expect(screen.getByText("Maia · Mensal")).toBeInTheDocument()
    expect(screen.getAllByText(/\d{2}\/\d{2}\/\d{4}/)).toHaveLength(3)
  })

  it("passa filtros de tipo e período para a query", () => {
    render(<HoroscopeHistoryPage />)
    expect(mockUseHistory).toHaveBeenCalledWith({
      type: undefined,
      period: undefined,
    })

    fireEvent.change(screen.getByLabelText("Tipo"), {
      target: { value: "maya" },
    })
    expect(mockUseHistory).toHaveBeenLastCalledWith({
      type: "maya",
      period: undefined,
    })

    fireEvent.change(screen.getByLabelText("Período"), {
      target: { value: "weekly" },
    })
    expect(mockUseHistory).toHaveBeenLastCalledWith({
      type: "maya",
      period: "weekly",
    })
  })

  it("mostra estado vazio com e sem filtros", () => {
    mockUseHistory.mockReturnValue({
      data: buildData([]),
      isLoading: false,
      isError: false,
      hasNextPage: false,
      fetchNextPage,
      isFetchingNextPage: false,
    })
    const { rerender } = render(<HoroscopeHistoryPage />)
    expect(screen.getByTestId("history-empty")).toHaveTextContent(
      /ainda não tem leituras/,
    )

    fireEvent.change(screen.getByLabelText("Tipo"), {
      target: { value: "western" },
    })
    rerender(<HoroscopeHistoryPage />)
    expect(screen.getByTestId("history-empty")).toHaveTextContent(
      /esses filtros/,
    )
  })

  it("carrega mais páginas ao clicar em Carregar mais", () => {
    mockUseHistory.mockReturnValue({
      data: buildData(ENTRIES),
      isLoading: false,
      isError: false,
      hasNextPage: true,
      fetchNextPage,
      isFetchingNextPage: false,
    })
    render(<HoroscopeHistoryPage />)

    fireEvent.click(screen.getByTestId("history-load-more"))
    expect(fetchNextPage).toHaveBeenCalledTimes(1)
  })

  it("renderiza loading e erro", () => {
    mockUseHistory.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      hasNextPage: false,
      fetchNextPage,
      isFetchingNextPage: false,
    })
    const { rerender } = render(<HoroscopeHistoryPage />)
    expect(screen.getByRole("status")).toHaveTextContent(/Carregando histórico/)

    mockUseHistory.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      hasNextPage: false,
      fetchNextPage,
      isFetchingNextPage: false,
    })
    rerender(<HoroscopeHistoryPage />)
    expect(screen.getByRole("alert")).toHaveTextContent(/histórico/)
  })

  it("desabilita o botão enquanto busca a próxima página", async () => {
    mockUseHistory.mockReturnValue({
      data: buildData(ENTRIES),
      isLoading: false,
      isError: false,
      hasNextPage: true,
      fetchNextPage,
      isFetchingNextPage: true,
    })
    render(<HoroscopeHistoryPage />)
    expect(screen.getByTestId("history-load-more")).toBeDisabled()
    expect(screen.getByTestId("history-load-more")).toHaveTextContent(
      /Carregando/,
    )
    await waitFor(() => expect(fetchNextPage).not.toHaveBeenCalled())
  })
})
