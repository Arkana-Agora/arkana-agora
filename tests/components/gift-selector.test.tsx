// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import { toast } from "sonner"

import { GiftSelector } from "@/components/social/gift-selector"

vi.mock("next-auth/react", () => ({
  useSession: vi.fn(() => ({
    data: {
      user: { id: "usr_1", name: "Test User", image: null },
      accessToken: "token",
    },
  })),
}))

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

const toastMock = vi.mocked(toast)

const mockFetch = vi.fn()

vi.mock("@/lib/social/gifts", () => ({
  GIFT_CATALOG: [
    { id: "estrela-cadente", name: "Estrela Cadente", cost: 10, emoji: "🌠" },
    { id: "rosa-mistica", name: "Rosa Mística", cost: 25, emoji: "🌹" },
    {
      id: "cristal-de-quartzo",
      name: "Cristal de Quartzo",
      cost: 50,
      emoji: "💎",
    },
    { id: "bola-de-cristal", name: "Bola de Cristal", cost: 100, emoji: "🔮" },
    { id: "coroa-astral", name: "Coroa Astral", cost: 200, emoji: "👑" },
    { id: "dragao-dourado", name: "Dragão Dourado", cost: 500, emoji: "🐉" },
  ],
  validateGiftId: vi.fn(() => true),
  getGiftCost: vi.fn((_id: string) => {
    const costs: Record<string, number> = {
      "estrela-cadente": 10,
      "rosa-mistica": 25,
      "cristal-de-quartzo": 50,
      "bola-de-cristal": 100,
      "coroa-astral": 200,
      "dragao-dourado": 500,
    }
    return costs[_id] ?? null
  }),
  getGiftById: vi.fn((id: string) => {
    const gifts: Record<
      string,
      { id: string; name: string; cost: number; emoji: string }
    > = {
      "estrela-cadente": {
        id: "estrela-cadente",
        name: "Estrela Cadente",
        cost: 10,
        emoji: "🌠",
      },
      "rosa-mistica": {
        id: "rosa-mistica",
        name: "Rosa Mística",
        cost: 25,
        emoji: "🌹",
      },
      "cristal-de-quartzo": {
        id: "cristal-de-quartzo",
        name: "Cristal de Quartzo",
        cost: 50,
        emoji: "💎",
      },
      "bola-de-cristal": {
        id: "bola-de-cristal",
        name: "Bola de Cristal",
        cost: 100,
        emoji: "🔮",
      },
      "coroa-astral": {
        id: "coroa-astral",
        name: "Coroa Astral",
        cost: 200,
        emoji: "👑",
      },
      "dragao-dourado": {
        id: "dragao-dourado",
        name: "Dragão Dourado",
        cost: 500,
        emoji: "🐉",
      },
    }
    return gifts[id] ?? null
  }),
}))

beforeEach(() => {
  cleanup()
  vi.clearAllMocks()
  vi.stubGlobal("fetch", mockFetch)
  mockFetch.mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({ message: "Presente enviado com sucesso" }),
  })
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

function renderSelector(open = true, balance = 1000) {
  return render(
    <GiftSelector
      isOpen={open}
      onClose={vi.fn()}
      recipientId="usr_recipient"
      recipientName="João"
      userVersosBalance={balance}
    />,
  )
}

describe("GiftSelector (T118)", () => {
  it("não renderiza quando fechado", () => {
    renderSelector(false)
    expect(screen.queryByRole("dialog")).toBeNull()
  })

  it("mostra o catálogo completo de 6 presentes", () => {
    renderSelector()

    const giftCards = screen.getAllByRole("button", { name: /enviar/i })
    expect(giftCards).toHaveLength(6)

    expect(screen.getByText("Estrela Cadente")).toBeInTheDocument()
    expect(screen.getByText("Rosa Mística")).toBeInTheDocument()
    expect(screen.getByText("Cristal de Quartzo")).toBeInTheDocument()
    expect(screen.getByText("Bola de Cristal")).toBeInTheDocument()
    expect(screen.getByText("Coroa Astral")).toBeInTheDocument()
    expect(screen.getByText("Dragão Dourado")).toBeInTheDocument()
  })

  it("mostra o saldo de Versos do usuário no topo", () => {
    renderSelector(true, 1250)
    expect(screen.getByText("Saldo de Versos")).toBeInTheDocument()
    expect(screen.getByText("1.250")).toBeInTheDocument()
  })

  it("mostra o preço em Versos de cada presente", () => {
    renderSelector()

    expect(screen.getByText("10 Versos")).toBeInTheDocument()
    expect(screen.getByText("25 Versos")).toBeInTheDocument()
    expect(screen.getByText("50 Versos")).toBeInTheDocument()
    expect(screen.getByText("100 Versos")).toBeInTheDocument()
    expect(screen.getByText("200 Versos")).toBeInTheDocument()
    expect(screen.getByText("500 Versos")).toBeInTheDocument()
  })

  it("envia presente via POST /api/v1/social/gifts/send", async () => {
    renderSelector()

    fireEvent.click(
      screen.getByRole("button", { name: /enviar estrela cadente/i }),
    )

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/v1/social/gifts/send",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            "Content-Type": "application/json",
            Authorization: "Bearer token",
          }),
          body: JSON.stringify({
            toUserId: "usr_recipient",
            giftId: "estrela-cadente",
          }),
        }),
      )
    })
  })

  it("mostra toast de sucesso ao enviar presente", async () => {
    renderSelector()

    fireEvent.click(
      screen.getByRole("button", { name: /enviar estrela cadente/i }),
    )

    await waitFor(() => {
      expect(toastMock.success).toHaveBeenCalledWith(
        expect.stringContaining("Estrela Cadente"),
      )
    })
  })

  it("desabilita botões de presentes que excedem o saldo", () => {
    renderSelector(true, 15)

    const cristalBtn = screen.getByRole("button", {
      name: /enviar cristal de quartzo/i,
    })
    const bolaBtn = screen.getByRole("button", {
      name: /enviar bola de cristal/i,
    })

    expect(cristalBtn).toBeDisabled()
    expect(bolaBtn).toBeDisabled()
  })

  it("fecha o modal ao clicar no botão fechar", () => {
    const onClose = vi.fn()
    render(
      <GiftSelector
        isOpen
        onClose={onClose}
        recipientId="usr_recipient"
        recipientName="João"
        userVersosBalance={1000}
      />,
    )

    fireEvent.click(screen.getByRole("button", { name: /fechar/i }))

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it("fecha o modal ao clicar no overlay", () => {
    const onClose = vi.fn()
    render(
      <GiftSelector
        isOpen
        onClose={onClose}
        recipientId="usr_recipient"
        recipientName="João"
        userVersosBalance={1000}
      />,
    )

    fireEvent.click(screen.getByTestId("gift-selector-overlay"))

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it("mostra loading state durante envio", async () => {
    let resolveFetch: (value: unknown) => void
    mockFetch.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveFetch = resolve
        }),
    )

    renderSelector()
    fireEvent.click(
      screen.getByRole("button", { name: /enviar estrela cadente/i }),
    )

    expect(screen.getByText(/enviando/i)).toBeInTheDocument()

    resolveFetch!({ ok: true, json: () => Promise.resolve({ message: "ok" }) })
    await waitFor(() =>
      expect(screen.queryByText(/enviando/i)).not.toBeInTheDocument(),
    )
  })

  it("mostra toast de erro quando a API falha", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 403,
      json: () => Promise.resolve({ error: { code: "INSUFFICIENT_VERSOS" } }),
    })

    renderSelector()

    fireEvent.click(
      screen.getByRole("button", { name: /enviar estrela cadente/i }),
    )

    await waitFor(() => {
      expect(toastMock.error).toHaveBeenCalled()
    })
  })

  it("não permite enviar presente para si mesmo (usa recipientId diferente)", () => {
    render(
      <GiftSelector
        isOpen
        onClose={vi.fn()}
        recipientId="usr_1"
        recipientName="Test"
        userVersosBalance={1000}
      />,
    )

    fireEvent.click(
      screen.getByRole("button", { name: /enviar estrela cadente/i }),
    )

    expect(mockFetch).toHaveBeenCalledWith(
      "/api/v1/social/gifts/send",
      expect.objectContaining({
        body: JSON.stringify({ toUserId: "usr_1", giftId: "estrela-cadente" }),
      }),
    )
  })

  it("usa emojis dos presentes do catálogo", () => {
    renderSelector()

    expect(screen.getByText("🌠")).toBeInTheDocument()
    expect(screen.getByText("🌹")).toBeInTheDocument()
    expect(screen.getByText("💎")).toBeInTheDocument()
    expect(screen.getByText("🔮")).toBeInTheDocument()
    expect(screen.getByText("👑")).toBeInTheDocument()
    expect(screen.getByText("🐉")).toBeInTheDocument()
  })
})
