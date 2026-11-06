// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"

import { WesternHoroscopeCard } from "@/components/horoscopes/western-horoscope-card"

// T091/US-024: card do horóscopo ocidental — seções colapsáveis com
// estado local (aria-expanded), número/cor da sorte, signo compatível e
// compartilhar (Web Share API → fallback clipboard).

const HOROSCOPE = {
  type: "western" as const,
  signId: "aries",
  period: "daily" as const,
  date: "2026-10-20",
  content: {
    general:
      "Áries: dia de iniciativa. A energia de fogo pede presença nas escolhas do dia.",
    love: "Conversas francas fortalecem os vínculos hoje.",
    career: "Organize as prioridades e conclua uma tarefa pendente hoje.",
    health: "Hidrate-se e reserve um momento de descanso hoje.",
    luckyNumber: 7,
    luckyColor: "turquesa",
    mood: "sereno",
    compatibility: "leao",
    date: "2026-10-20",
    fallback: true,
  },
}

beforeEach(() => {
  vi.restoreAllMocks()
})

describe("WesternHoroscopeCard (T091)", () => {
  it("renderiza signo, período, data, geral e sortes", () => {
    render(<WesternHoroscopeCard horoscope={HOROSCOPE} />)

    expect(screen.getByText(/♈ Áries/)).toBeInTheDocument()
    expect(screen.getByText(/Diário · 2026-10-20/)).toBeInTheDocument()
    expect(screen.getByTestId("horoscope-general")).toHaveTextContent(
      /dia de iniciativa/,
    )
    expect(screen.getByText("Número da sorte")).toBeInTheDocument()
    expect(screen.getByText("7")).toBeInTheDocument()
    expect(screen.getByText("Cor da sorte")).toBeInTheDocument()
    expect(screen.getByText("turquesa")).toBeInTheDocument()
    expect(screen.getByText(/Compatível com/)).toBeInTheDocument()
    expect(screen.getByText(/♌ Leão/)).toBeInTheDocument()
  })

  it("seções Amor/Carreira/Saúde colapsadas por padrão com aria-expanded", () => {
    render(<WesternHoroscopeCard horoscope={HOROSCOPE} />)

    expect(screen.queryByText(/fortalecem os vínculos/)).not.toBeInTheDocument()

    const amor = screen.getByTestId("horoscope-section-love")
    expect(amor).toHaveAttribute("aria-expanded", "false")

    fireEvent.click(amor)
    expect(amor).toHaveAttribute("aria-expanded", "true")
    expect(screen.getByText(/fortalecem os vínculos/)).toBeInTheDocument()

    fireEvent.click(amor)
    expect(amor).toHaveAttribute("aria-expanded", "false")
    expect(screen.queryByText(/fortalecem os vínculos/)).not.toBeInTheDocument()
  })

  it("só uma seção aberta por vez", () => {
    render(<WesternHoroscopeCard horoscope={HOROSCOPE} />)

    fireEvent.click(screen.getByTestId("horoscope-section-love"))
    fireEvent.click(screen.getByTestId("horoscope-section-career"))

    expect(screen.getByTestId("horoscope-section-love")).toHaveAttribute(
      "aria-expanded",
      "false",
    )
    expect(screen.getByTestId("horoscope-section-career")).toHaveAttribute(
      "aria-expanded",
      "true",
    )
    expect(screen.queryByText(/fortalecem os vínculos/)).not.toBeInTheDocument()
    expect(screen.getByText(/conclua uma tarefa/)).toBeInTheDocument()
  })

  it("compartilha via Web Share API quando disponível", async () => {
    const share = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal("navigator", { ...navigator, share })

    render(<WesternHoroscopeCard horoscope={HOROSCOPE} />)
    fireEvent.click(screen.getByTestId("share-horoscope"))

    await waitFor(() => expect(share).toHaveBeenCalledTimes(1))
    expect(share.mock.calls[0]![0].text).toContain("Áries: Áries: dia de")
    vi.unstubAllGlobals()
  })

  it("fallback clipboard quando não há Web Share API", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal("navigator", {
      ...navigator,
      share: undefined,
      clipboard: { writeText },
    })

    render(<WesternHoroscopeCard horoscope={HOROSCOPE} />)
    fireEvent.click(screen.getByTestId("share-horoscope"))

    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1))
    expect(writeText.mock.calls[0]![0]).toContain("dia de iniciativa")
    vi.unstubAllGlobals()
  })
})
