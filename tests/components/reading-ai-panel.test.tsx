// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, render, screen, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { StrictMode, type ReactNode } from "react"
import { resetAuthRefreshState } from "@/lib/auth-refresh"

vi.mock("next-auth/react", () => ({
  getSession: vi.fn().mockResolvedValue(null),
  useSession: vi.fn(() => ({ data: null })),
}))

const authApiGet = vi.fn()
vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>()
  return {
    default: { get: (...args: unknown[]) => authApiGet(...args) },
    // authStreamFetch real (com single-flight de refresh) — o contrato do
    // painel é usa-lo; mockar ocultaria o bug de token expirado.
    authStreamFetch: actual.authStreamFetch,
  }
})

const fetchMock = vi.fn()

function createWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  }
}

async function jsonRes(payload: unknown) {
  return {
    ok: true,
    status: 200,
    headers: {
      get: (h: string) =>
        h.toLowerCase() === "content-type" ? "application/json" : null,
    },
    json: async () => payload,
  }
}

function sseRes(frames: object[]) {
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    start(controller) {
      for (const frame of frames) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(frame)}\n\n`))
      }
      controller.close()
    },
  })
  return {
    ok: true,
    status: 200,
    headers: {
      get: (h: string) =>
        h.toLowerCase() === "content-type" ? "text/event-stream" : null,
    },
    body: stream,
  }
}

describe("ReadingAIPanel autoStart", () => {
  beforeEach(() => {
    cleanup()
    vi.clearAllMocks()
    sessionStorage.clear()
    resetAuthRefreshState()
    authApiGet.mockResolvedValue({
      data: { interpretations: 0, dailyLimit: 5, tier: "FREE" },
    })
    vi.stubGlobal("fetch", fetchMock)
    // Fetch real rejeita imediatamente com sinal já abortado — o mock
    // precisa espelhar isso para reproduzir o double-mount do StrictMode.
    fetchMock.mockImplementation(
      async (_url, init: RequestInit | undefined) => {
        if (init?.signal?.aborted) {
          const err = new Error("The operation was aborted")
          err.name = "AbortError"
          throw err
        }
        return jsonRes({
          cached: false,
          content: "texto",
          interpretationId: "i1",
        })
      },
    )
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    sessionStorage.clear()
  })

  it("dispara interpretacao 'general' automaticamente ao montar com autoStart", async () => {
    const { ReadingAIPanel } = await import("@/components/ai/reading-ai-panel")
    render(<ReadingAIPanel readingId="r1" autoStart />, {
      wrapper: createWrapper(),
    })

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/v1/ai/interpret",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ readingId: "r1", mode: "general" }),
        }),
      ),
    )
  })

  it("nao dispara automaticamente sem autoStart (detalhe continua manual)", async () => {
    const { ReadingAIPanel } = await import("@/components/ai/reading-ai-panel")
    render(<ReadingAIPanel readingId="r1" />, { wrapper: createWrapper() })

    await waitFor(() => expect(authApiGet).toHaveBeenCalled())
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("nao re-dispara ao revisitar o mesmo reading (guard por readingId)", async () => {
    const { ReadingAIPanel } = await import("@/components/ai/reading-ai-panel")
    const first = render(<ReadingAIPanel readingId="r1" autoStart />, {
      wrapper: createWrapper(),
    })
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    first.unmount()

    render(<ReadingAIPanel readingId="r1" autoStart />, {
      wrapper: createWrapper(),
    })
    await new Promise((r) => setTimeout(r, 50))
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("autoStart sobrevive ao abort simulado do StrictMode (double-mount)", async () => {
    const { ReadingAIPanel } = await import("@/components/ai/reading-ai-panel")
    render(
      <StrictMode>
        <ReadingAIPanel readingId="r-sm" autoStart />
      </StrictMode>,
      { wrapper: createWrapper() },
    )

    // Pass 1 é abortado pelo cleanup do StrictMode; o pass 2 (mesma
    // instância) precisa re-disparar e ENTREGAR o conteúdo.
    await screen.findByText("texto")
  })

  it("rola ate o painel exatamente uma vez quando autoStart comeca a streamar", async () => {
    const original = Element.prototype.scrollIntoView
    const scrollSpy = vi.fn()
    Element.prototype.scrollIntoView = scrollSpy
    try {
      const { ReadingAIPanel } =
        await import("@/components/ai/reading-ai-panel")
      render(<ReadingAIPanel readingId="r-scroll" autoStart />, {
        wrapper: createWrapper(),
      })

      await screen.findByText("texto")
      // FollowUpChat tambem rola (block ausente) — isola o scroll do painel
      const panelScrolls = scrollSpy.mock.calls.filter(
        (call) =>
          (call[0] as ScrollIntoViewOptions | undefined)?.block === "start",
      )
      expect(panelScrolls).toHaveLength(1)
      expect(panelScrolls[0]?.[0]).toEqual({
        behavior: "smooth",
        block: "start",
      })

      // re-render pós-entrega não deve rolar o painel de novo (hasScrolledRef)
      await new Promise((r) => setTimeout(r, 50))
      expect(
        scrollSpy.mock.calls.filter(
          (call) =>
            (call[0] as ScrollIntoViewOptions | undefined)?.block === "start",
        ),
      ).toHaveLength(1)
    } finally {
      Element.prototype.scrollIntoView = original
    }
  })

  it("nao rola quando nao ha autoStart", async () => {
    const original = Element.prototype.scrollIntoView
    const scrollSpy = vi.fn()
    Element.prototype.scrollIntoView = scrollSpy
    try {
      const { ReadingAIPanel } =
        await import("@/components/ai/reading-ai-panel")
      render(<ReadingAIPanel readingId="r-no-scroll" />, {
        wrapper: createWrapper(),
      })

      await waitFor(() => expect(authApiGet).toHaveBeenCalled())
      expect(scrollSpy).not.toHaveBeenCalled()
    } finally {
      Element.prototype.scrollIntoView = original
    }
  })

  it("sobrevive a access token expirado (401 → refresh → retry)", async () => {
    // Access token do getSession() vencido (TTL 15min): o interpret responde
    // 401; o fluxo deve renovar via /auth/refresh e re-tentar.
    fetchMock
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        headers: { get: () => null },
        json: async () => ({
          error: { code: "AUTH_TOKEN_INVALID", message: "Token invalido" },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: { get: () => null },
        json: async () => ({ accessToken: "fresh-token", expiresIn: 900 }),
      })
      .mockResolvedValueOnce(
        jsonRes({
          cached: false,
          content: "texto recuperado",
          interpretationId: "i2",
        }),
      )

    const { ReadingAIPanel } = await import("@/components/ai/reading-ai-panel")
    render(<ReadingAIPanel readingId="r-exp" autoStart />, {
      wrapper: createWrapper(),
    })

    await screen.findByText("texto recuperado")
    const urls = fetchMock.mock.calls.map((c) => c[0])
    expect(urls).toContain("/api/v1/auth/refresh")
    expect(urls.filter((u) => u === "/api/v1/ai/interpret")).toHaveLength(2)
  })

  it("falha do provedor sem tokens informa que a cota nao foi consumida", async () => {
    fetchMock.mockImplementationOnce(
      async (_url, init: RequestInit | undefined) => {
        if (init?.signal?.aborted) {
          const err = new Error("The operation was aborted")
          err.name = "AbortError"
          throw err
        }
        return sseRes([
          {
            type: "error",
            code: "AI_SERVICE_UNAVAILABLE",
            message:
              "Nao foi possivel gerar a interpretacao agora. Tente novamente em alguns minutos.",
            retryable: true,
          },
        ])
      },
    )

    const { ReadingAIPanel } = await import("@/components/ai/reading-ai-panel")
    render(<ReadingAIPanel readingId="r-billing" autoStart />, {
      wrapper: createWrapper(),
    })

    await screen.findByText(/cota de interpretação não foi consumida/)
    expect(
      screen.getByText(/Nao foi possivel gerar a interpretacao agora/),
    ).toBeInTheDocument()
  })

  it("entrega parcial não afirma que a cota não foi consumida", async () => {
    fetchMock.mockImplementationOnce(
      async (_url, init: RequestInit | undefined) => {
        if (init?.signal?.aborted) {
          const err = new Error("The operation was aborted")
          err.name = "AbortError"
          throw err
        }
        return sseRes([
          { type: "token", token: "Trecho parcial." },
          { type: "error", message: "Falha no meio do stream." },
        ])
      },
    )

    const { ReadingAIPanel } = await import("@/components/ai/reading-ai-panel")
    render(<ReadingAIPanel readingId="r-partial" autoStart />, {
      wrapper: createWrapper(),
    })

    await screen.findByText("Falha no meio do stream.")
    expect(
      screen.queryByText(/cota de interpretação não foi consumida/),
    ).toBeNull()
  })
})
