import { describe, it, expect } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { ChineseHoroscopeCard } from "@/components/horoscopes/chinese-horoscope-card"

const mockHoroscope = {
  type: "chinese" as const,
  signId: "cavalo",
  element: "metal",
  period: "daily" as const,
  date: "2026-01-15",
  content: {
    general:
      "Cavalo: hoje, a energia metal e o traço energético pedem presença. Fluxe com o ritmo do ciclo sexagenário, escolha as batalhas com cuidado e confie na adaptação — ela abre mais portas que a força.",
    love: "Cavalo: energético aproxima quem importa hoje.",
    career: "Cavalo: aproveite a energia metal para destravar uma tarefa hoje.",
    health: "Cavalo: movimento leve e respiração consciente sustentam hoje.",
    luckyNumber: 42,
    luckyColor: "azul",
    mood: "sereno",
    compatibility: "cabra",
    date: "2026-01-15",
    fallback: true,
  },
  source: "fallback" as const,
}

describe("ChineseHoroscopeCard (T104)", () => {
  it("renderiza o animal e elemento (Cavalo de Metal)", () => {
    render(<ChineseHoroscopeCard horoscope={mockHoroscope} />)
    expect(screen.getByTestId("chinese-horoscope-card")).toHaveTextContent(
      /Cavalo de Metal/i,
    )
  })

  it("renderiza o texto geral", () => {
    render(<ChineseHoroscopeCard horoscope={mockHoroscope} />)
    expect(screen.getByText(/energia metal/i)).toBeInTheDocument()
  })

  it("renderiza seções colapsáveis (Amor/Carreira/Saúde)", () => {
    render(<ChineseHoroscopeCard horoscope={mockHoroscope} />)
    expect(screen.getByRole("button", { name: /Amor/i })).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: /Carreira/i }),
    ).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Saúde/i })).toBeInTheDocument()
  })

  it("expande seção Amor ao clicar", () => {
    render(<ChineseHoroscopeCard horoscope={mockHoroscope} />)
    const amorButton = screen.getByRole("button", { name: /Amor/i })
    fireEvent.click(amorButton)
    expect(
      screen.getByText(/energético aproxima quem importa/i),
    ).toBeInTheDocument()
  })

  it("renderiza número e cor da sorte", () => {
    render(<ChineseHoroscopeCard horoscope={mockHoroscope} />)
    expect(screen.getByText(/Número da sorte/i)).toBeInTheDocument()
    expect(screen.getByText(/42/i)).toBeInTheDocument()
    expect(screen.getByText(/Cor da sorte/i)).toBeInTheDocument()
    expect(screen.getByText(/azul/i)).toBeInTheDocument()
  })

  it("renderiza compatibilidade com próximo animal", () => {
    render(<ChineseHoroscopeCard horoscope={mockHoroscope} />)
    expect(screen.getByText(/Compatível com/i)).toBeInTheDocument()
    expect(screen.getByText(/Cabra/i)).toBeInTheDocument()
  })

  it("renderiza botão compartilhar", () => {
    render(<ChineseHoroscopeCard horoscope={mockHoroscope} />)
    expect(
      screen.getByRole("button", { name: /Compartilhar/i }),
    ).toBeInTheDocument()
  })

  it("mostra período e data no header", () => {
    render(<ChineseHoroscopeCard horoscope={mockHoroscope} />)
    expect(screen.getByText(/Diário/i)).toBeInTheDocument()
    expect(screen.getByText(/2026-01-15/i)).toBeInTheDocument()
  })
})
