// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, render, screen, waitFor } from "@testing-library/react"
import { toast } from "sonner"

import GiftsPage from "@/app/(app)/presentes/page"

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
  getGiftById: vi.fn((_id: string) => {
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
    return gifts[_id] ?? null
  }),
}))

vi.mock("@/lib/social/versos", () => ({
  VERSOS_REWARDS: {
    Like: 1,
    Comment: 2,
    Follow: 5,
    Reading: 10,
  },
}))

beforeEach(() => {
  cleanup()
  vi.clearAllMocks()
  vi.stubGlobal("fetch", mockFetch)
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

function mockBalanceResponse(
  balance = 1000,
  streak = 5,
  lastClaimAt: string | null = null,
) {
  mockFetch.mockImplementation((url: string) => {
    if (url.includes("/api/v1/social/versos/balance")) {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({ balance, streak, lastClaimAt, dailyEarned: 0 }),
      })
    }
    if (url.includes("/api/v1/social/gifts/received")) {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            gifts: [
              {
                id: "gift_1",
                giftId: "estrela-cadente",
                coinCost: 10,
                recipientEarnsHalf: false,
                createdAt: "2026-01-15T10:00:00Z",
                fromUser: { id: "usr_sender", name: "Maria", avatar: null },
              },
              {
                id: "gift_2",
                giftId: "rosa-mistica",
                coinCost: 25,
                recipientEarnsHalf: false,
                createdAt: "2026-01-14T15:30:00Z",
                fromUser: {
                  id: "usr_other",
                  name: "João",
                  avatar: "avatar.png",
                },
              },
            ],
            totalReceived: 2,
          }),
      })
    }
    if (url.includes("/api/v1/social/gifts/send")) {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({ message: "Presente enviado com sucesso" }),
      })
    }
    return Promise.resolve({ ok: false })
  })
}

async function waitForDataLoad() {
  // Wait for loading to finish and data to appear
  await waitFor(() => {
    expect(screen.queryByText(/carregando/i)).not.toBeInTheDocument()
  })
}

describe("GiftsPage (T119)", () => {
  beforeEach(() => {
    mockBalanceResponse()
  })

  it("renderiza a página de presentes com título", async () => {
    render(<GiftsPage />)
    await waitForDataLoad()
    expect(screen.getByText("Presentes")).toBeInTheDocument()
  })

  it("mostra o saldo de Versos do usuário", async () => {
    mockBalanceResponse(1500, 10, "2026-01-10T00:00:00Z")
    render(<GiftsPage />)
    await waitForDataLoad()

    await waitFor(() => {
      expect(screen.getByText(/1\.500\s*Versos/i)).toBeInTheDocument()
    })
  })

  it("mostra o catálogo completo de 6 presentes", async () => {
    render(<GiftsPage />)
    await waitForDataLoad()

    await waitFor(() => {
      const elements = screen.getAllByText("Estrela Cadente")
      // Should appear once in catalog (not in received gifts for this test)
      expect(elements.length).toBeGreaterThanOrEqual(1)
    })
  })

  it("mostra os 6 nomes de presentes do catálogo", async () => {
    render(<GiftsPage />)
    await waitForDataLoad()

    await waitFor(() => {
      // Check all 6 gift names exist in the catalog (use getAllByText to handle duplicates in received gifts section)
      expect(
        screen.getAllByText("Estrela Cadente").length,
      ).toBeGreaterThanOrEqual(1)
      expect(screen.getAllByText("Rosa Mística").length).toBeGreaterThanOrEqual(
        1,
      )
      expect(
        screen.getAllByText("Cristal de Quartzo").length,
      ).toBeGreaterThanOrEqual(1)
      expect(
        screen.getAllByText("Bola de Cristal").length,
      ).toBeGreaterThanOrEqual(1)
      expect(screen.getAllByText("Coroa Astral").length).toBeGreaterThanOrEqual(
        1,
      )
      expect(
        screen.getAllByText("Dragão Dourado").length,
      ).toBeGreaterThanOrEqual(1)
    })
  })

  it("mostra o preço em Versos de cada presente", async () => {
    render(<GiftsPage />)
    await waitForDataLoad()

    await waitFor(() => {
      expect(screen.getByText("10 Versos")).toBeInTheDocument()
      expect(screen.getByText("25 Versos")).toBeInTheDocument()
      expect(screen.getByText("50 Versos")).toBeInTheDocument()
      expect(screen.getByText("100 Versos")).toBeInTheDocument()
      expect(screen.getByText("200 Versos")).toBeInTheDocument()
      expect(screen.getByText("500 Versos")).toBeInTheDocument()
    })
  })

  it("mostra os emojis dos presentes", async () => {
    render(<GiftsPage />)
    await waitForDataLoad()

    await waitFor(() => {
      const emojis = screen.getAllByText("🌠")
      expect(emojis.length).toBeGreaterThanOrEqual(1)
    })
  })

  it("mostra botões de enviar no catálogo", async () => {
    render(<GiftsPage />)
    await waitForDataLoad()

    await waitFor(() => {
      const buttons = screen.getAllByRole("button", { name: /enviar/i })
      expect(buttons.length).toBeGreaterThan(0)
    })
  })

  it("mostra loading state enquanto carrega dados", async () => {
    let resolveBalance: (value: unknown) => void
    mockFetch.mockImplementation((url: string) => {
      if (url.includes("/api/v1/social/versos/balance")) {
        return new Promise((resolve) => {
          resolveBalance = resolve
        })
      }
      if (url.includes("/api/v1/social/gifts/received")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ gifts: [], totalReceived: 0 }),
        })
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) })
    })

    render(<GiftsPage />)

    expect(screen.getByText(/carregando/i)).toBeInTheDocument()

    resolveBalance!({
      balance: 1000,
      streak: 5,
      lastClaimAt: null,
      dailyEarned: 0,
    })
    await waitFor(() =>
      expect(screen.queryByText(/carregando/i)).not.toBeInTheDocument(),
    )
  })

  it("mostra erro quando falha ao carregar saldo", async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes("/api/v1/social/versos/balance")) {
        return Promise.resolve({ ok: false, status: 500 })
      }
      if (url.includes("/api/v1/social/gifts/received")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ gifts: [], totalReceived: 0 }),
        })
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) })
    })

    render(<GiftsPage />)

    await waitForDataLoad()

    await waitFor(() => {
      expect(toastMock.error).toHaveBeenCalled()
    })
  })
})
