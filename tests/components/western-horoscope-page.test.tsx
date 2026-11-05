// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"

import WesternHoroscopePage from "@/app/(app)/horoscopos/ocidental/page"
import type { Horoscope } from "@/hooks/use-horoscopes"

// T092/US-024: página do horóscopo ocidental — signo featured do perfil,
// seletor de 12 signos, abas de período, painel de compatibilidade T090.

const mockUseMyHoroscope = vi.fn()
const mockUseHoroscopes = vi.fn()

vi.mock("@/hooks/use-horoscopes", () => ({
  useMyHoroscope: () => mockUseMyHoroscope(),
  useHoroscopes: (...args: unknown[]) => mockUseHoroscopes(...args),
}))

const HOROSCOPE: Horoscope = {
  type: "western",
  signId: "aries",
  period: "daily",
  date: "2026-10-20",
  content: {
    general: "Visão geral do dia para Áries.",
    love: "amor",
    career: "carreira",
    health: "saúde",
    luckyNumber: 7,
    luckyColor: "azul",
    mood: "sereno",
    compatibility: "leao",
    date: "2026-10-20",
    fallback: true,
  },
}

beforeEach(() => {
  vi.clearAllMocks()
  mockUseMyHoroscope.mockReturnValue({
    data: {
      western: { ...HOROSCOPE, signId: "touro" },
      chinese: null,
      mayan: null,
    },
    isLoading: false,
  })
  mockUseHoroscopes.mockReturnValue({
    data: HOROSCOPE,
    isLoading: false,
    isError: false,
  })
})

describe("WesternHoroscopePage (T092)", () => {
  it("usa o signo do perfil como featured e consulta com ele", () => {
    render(<WesternHoroscopePage />)

    const touro = screen.getByRole("button", { name: /♉ Touro/ })
    expect(touro).toHaveAttribute("aria-pressed", "true")
    expect(mockUseHoroscopes).toHaveBeenCalledWith(
      "western",
      "daily",
      undefined,
      expect.objectContaining({ sign: "touro" }),
    )
    expect(screen.queryByTestId("sign-hint")).not.toBeInTheDocument()
  })

  it("sem birthDate, cai em Áries e mostra o hint", () => {
    mockUseMyHoroscope.mockReturnValue({
      data: { western: null, chinese: null, mayan: null },
      isLoading: false,
    })
    render(<WesternHoroscopePage />)

    expect(screen.getByRole("button", { name: /♈ Áries/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    )
    expect(screen.getByTestId("sign-hint")).toBeInTheDocument()
    expect(mockUseHoroscopes).toHaveBeenCalledWith(
      "western",
      "daily",
      undefined,
      expect.objectContaining({ sign: "aries" }),
    )
  })

  it("seletor de signo troca a query", () => {
    render(<WesternHoroscopePage />)

    fireEvent.click(screen.getByRole("button", { name: /♏ Escorpião/ }))
    expect(mockUseHoroscopes).toHaveBeenLastCalledWith(
      "western",
      "daily",
      undefined,
      expect.objectContaining({ sign: "escorpiao" }),
    )
    expect(
      screen.getByRole("button", { name: /♏ Escorpião/ }),
    ).toHaveAttribute("aria-pressed", "true")
  })

  it("abas de período trocam o período", () => {
    render(<WesternHoroscopePage />)

    fireEvent.click(screen.getByRole("button", { name: "Semanal" }))
    expect(mockUseHoroscopes).toHaveBeenLastCalledWith(
      "western",
      "weekly",
      undefined,
      expect.objectContaining({ sign: "touro" }),
    )
  })

  it("escolher alvo aciona targetSign e renderiza o painel T090", () => {
    mockUseHoroscopes.mockReturnValue({
      data: {
        ...HOROSCOPE,
        compatibility: {
          targetSignId: "leao",
          love: 88,
          friendship: 83,
          work: 85,
          overall: 85,
        },
      },
      isLoading: false,
      isError: false,
    })
    render(<WesternHoroscopePage />)

    fireEvent.change(screen.getByLabelText(/compatibilidade com/), {
      target: { value: "leao" },
    })

    expect(mockUseHoroscopes).toHaveBeenLastCalledWith(
      "western",
      "daily",
      undefined,
      expect.objectContaining({ sign: "touro", targetSign: "leao" }),
    )
    const panel = screen.getByTestId("compatibility-panel")
    expect(panel).toHaveTextContent(/Compatibilidade com/)
    expect(panel).toHaveTextContent("Leão")
    expect(panel).toHaveTextContent("88")
  })

  it("renderiza loading e erro da query", () => {
    mockUseHoroscopes.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
    })
    const { rerender } = render(<WesternHoroscopePage />)
    expect(screen.getByRole("status")).toHaveTextContent(/Carregando/)

    mockUseHoroscopes.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
    })
    rerender(<WesternHoroscopePage />)
    expect(screen.getByRole("alert")).toHaveTextContent(/Não foi possível/)
  })

  it("renderiza o card com o horóscopo retornado", async () => {
    render(<WesternHoroscopePage />)
    await waitFor(() =>
      expect(screen.getByTestId("western-horoscope-card")).toBeInTheDocument(),
    )
    expect(screen.getByTestId("horoscope-general")).toHaveTextContent(
      /Visão geral do dia/,
    )
  })
})
