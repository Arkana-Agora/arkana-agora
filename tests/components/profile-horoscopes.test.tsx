// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"

import {
  MyProfileHoroscopes,
  ProfileHoroscopes,
} from "@/components/horoscopes/profile-horoscopes"
import type { ProfileHoroscopeSigns } from "@/components/horoscopes/profile-horoscopes"

// T144/AC-24: bloco de horóscopos no perfil — modo próprio consome
// useMyHoroscope (T094); modo público recebe signos pré-computados do
// server (gate de privacidade fica na página, não no componente).

const mockUseMyHoroscope = vi.fn()

vi.mock("@/hooks/use-horoscopes", () => ({
  useMyHoroscope: () => mockUseMyHoroscope(),
}))

const SIGNS: ProfileHoroscopeSigns = {
  western: { signId: "aries" },
  chinese: { animalId: "rato", element: "metal" },
  maya: { kin: 42 },
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe("ProfileHoroscopes (T144, modo público)", () => {
  it("renderiza os três signos com labels dos catálogos", () => {
    render(<ProfileHoroscopes signs={SIGNS} />)

    expect(screen.getByTestId("profile-horoscopes")).toBeInTheDocument()
    expect(screen.getByText("Signo ocidental")).toBeInTheDocument()
    expect(screen.getByText(/♈ Áries · Fogo/)).toBeInTheDocument()
    expect(screen.getByText("Zodíaco chinês")).toBeInTheDocument()
    expect(screen.getByText("Rato (metal)")).toBeInTheDocument()
    expect(screen.getByText("Kin Maya")).toBeInTheDocument()
    expect(screen.getByText(/Kin 42 —/)).toBeInTheDocument()
  })

  it("não renderiza quando signs é null (perfil sem arcana)", () => {
    const { container } = render(<ProfileHoroscopes signs={null} />)
    expect(container.firstChild).toBeNull()
  })

  it("omite linhas nulas e some quando nenhuma linha existe", () => {
    const { container } = render(
      <ProfileHoroscopes
        signs={{ western: null, chinese: null, maya: null }}
      />,
    )
    expect(container.firstChild).toBeNull()

    render(
      <ProfileHoroscopes
        signs={{ western: { signId: "aries" }, chinese: null, maya: null }}
      />,
    )
    expect(screen.getByText(/♈ Áries/)).toBeInTheDocument()
    expect(screen.queryByText("Zodíaco chinês")).not.toBeInTheDocument()
  })
})

describe("MyProfileHoroscopes (T144, modo próprio)", () => {
  it("deriva signos de useMyHoroscope", () => {
    mockUseMyHoroscope.mockReturnValue({
      data: {
        western: { signId: "aries" },
        chinese: { signId: "rato", element: "metal" },
        mayan: { signId: "42" },
      },
      isLoading: false,
    })
    render(<MyProfileHoroscopes />)

    expect(screen.getByText(/♈ Áries · Fogo/)).toBeInTheDocument()
    expect(screen.getByText("Rato (metal)")).toBeInTheDocument()
    expect(screen.getByText(/Kin 42 —/)).toBeInTheDocument()
    expect(screen.queryByTestId("signs-hint")).not.toBeInTheDocument()
  })

  it("mostra hint quando o usuário não tem signos (sem birthDate)", () => {
    mockUseMyHoroscope.mockReturnValue({
      data: { western: null, chinese: null, mayan: null },
      isLoading: false,
    })
    render(<MyProfileHoroscopes />)

    expect(screen.getByTestId("signs-hint")).toHaveTextContent(
      /data de nascimento/,
    )
    expect(screen.queryByTestId("profile-horoscopes")).not.toBeInTheDocument()
  })

  it("renderiza nada enquanto carrega", () => {
    mockUseMyHoroscope.mockReturnValue({
      data: undefined,
      isLoading: true,
    })
    const { container } = render(<MyProfileHoroscopes />)
    expect(container.firstChild).toBeNull()
  })
})
