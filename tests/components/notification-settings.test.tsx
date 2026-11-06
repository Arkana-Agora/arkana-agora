// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"

import { NotificationSettings } from "@/components/horoscopes/notification-settings"
import type {
  HoroscopeNotificationPatch,
  HoroscopeNotificationSettings,
} from "@/hooks/use-horoscopes"

// T103-UI/RF-HORO-008: seção de settings de notificação — GET refletido
// em estado local (toggles + hora 0–23), PATCH no salvar, carregando/
// erro tratados. Primitivas: checkbox/input nativos (sem switch no design
// system).

const mockUseSettings = vi.fn()
const mockUseSave = vi.fn()

vi.mock("@/hooks/use-horoscopes", () => ({
  useHoroscopeNotificationSettings: () => mockUseSettings(),
  useSaveHoroscopeNotificationSettings: () => mockUseSave(),
}))

const SETTINGS: HoroscopeNotificationSettings = {
  westernEnabled: true,
  chineseEnabled: false,
  mayaEnabled: false,
  hour: 7,
}

const mutate = vi.fn()

beforeEach(() => {
  vi.clearAllMocks()
  mockUseSettings.mockReturnValue({
    data: SETTINGS,
    isLoading: false,
    isError: false,
  })
  mockUseSave.mockReturnValue({ mutate, isPending: false })
})

describe("NotificationSettings (T103)", () => {
  it("renderiza os três toggles e a hora a partir do GET", () => {
    render(<NotificationSettings />)

    expect(
      screen.getByRole("checkbox", { name: /ocidental/ }),
    ).toBeInTheDocument()
    expect(screen.getByRole("checkbox", { name: /chinês/ })).toBeInTheDocument()
    expect(screen.getByRole("checkbox", { name: /maia/ })).toBeInTheDocument()
    expect(screen.getByRole("checkbox", { name: /ocidental/ })).toBeChecked()
    expect(screen.getByRole("checkbox", { name: /chinês/ })).not.toBeChecked()
    expect(screen.getByLabelText(/Horário/)).toHaveValue(7)
  })

  it("mostra carregando enquanto o GET não resolve", () => {
    mockUseSettings.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
    })
    render(<NotificationSettings />)
    expect(screen.getByRole("status")).toHaveTextContent(/Carregando/)
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument()
  })

  it("mostra mensagem de erro quando o GET falha", () => {
    mockUseSettings.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
    })
    render(<NotificationSettings />)
    expect(screen.getByText(/Não foi possível carregar/)).toBeInTheDocument()
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument()
  })

  it("marca toggle, altera hora e envia o patch completo no salvar", () => {
    render(<NotificationSettings />)

    fireEvent.click(screen.getByRole("checkbox", { name: /chinês/ }))
    fireEvent.change(screen.getByLabelText(/Horário/), {
      target: { value: "10" },
    })
    fireEvent.click(screen.getByRole("button", { name: /Salvar/ }))

    expect(mutate).toHaveBeenCalledTimes(1)
    expect(mutate.mock.calls[0]![0]).toEqual({
      westernEnabled: true,
      chineseEnabled: true,
      mayaEnabled: false,
      hour: 10,
    } satisfies HoroscopeNotificationPatch)
  })

  it("desabilita o botão enquanto salva", () => {
    mockUseSave.mockReturnValue({ mutate, isPending: true })
    render(<NotificationSettings />)
    expect(screen.getByRole("button", { name: /Salvando/ })).toBeDisabled()
  })

  it("reflete estado salvo após invalidação do settings", async () => {
    const { rerender } = render(<NotificationSettings />)
    fireEvent.click(screen.getByRole("checkbox", { name: /maia/ }))
    fireEvent.click(screen.getByRole("button", { name: /Salvar/ }))

    mockUseSettings.mockReturnValue({
      data: { ...SETTINGS, mayaEnabled: true },
      isLoading: false,
      isError: false,
    })
    rerender(<NotificationSettings />)

    await waitFor(() =>
      expect(screen.getByRole("checkbox", { name: /maia/ })).toBeChecked(),
    )
  })
})
