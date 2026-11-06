import { describe, it, expect, vi, beforeEach } from "vitest"
import { POST } from "@/app/api/v1/ai/horoscope-interpret/route"
import { civilDateBrt } from "@/lib/horoscopes/dates"

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    aIDailyUsage: { findUnique: vi.fn(), upsert: vi.fn(), updateMany: vi.fn() },
    horoscopeContent: { findFirst: vi.fn() },
  },
}))

vi.mock("@/services/token-service", () => ({
  verifyAccessToken: vi.fn().mockResolvedValue({ userId: "user-1" }),
}))

vi.mock("@/lib/ai/client", () => ({
  getAIClient: vi.fn(),
}))

vi.mock("@/lib/ai/retry", () => ({
  withRetry: vi.fn((_fn: () => Promise<unknown>) => _fn()),
}))

import { prisma } from "@/lib/prisma"
import { getAIClient } from "@/lib/ai/client"

const mockUserFindUnique = vi.mocked(prisma.user.findUnique)
const mockUsageFindUnique = vi.mocked(prisma.aIDailyUsage.findUnique)
const mockUsageUpsert = vi.mocked(prisma.aIDailyUsage.upsert)
const mockUsageUpdateMany = vi.mocked(prisma.aIDailyUsage.updateMany)
const mockContentFindFirst = vi.mocked(prisma.horoscopeContent.findFirst)
const mockGetAIClient = vi.mocked(getAIClient)

const URL = "http://localhost:3000/api/v1/ai/horoscope-interpret"

const VALID_BODY = {
  type: "western",
  signId: "aries",
  period: "daily",
  date: "2026-10-20",
}

function makeRequest(body: unknown) {
  return new Request(URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer valid-token",
    },
    body: JSON.stringify(body),
  })
}

function mockHappyPath() {
  mockUserFindUnique.mockResolvedValue({
    plan: "FREE",
    name: "Luna",
    birthDate: new Date("1995-03-15"),
  } as never)
  mockUsageFindUnique.mockResolvedValue({
    interpretationCount: 2,
    followUpCount: 0,
  } as never)
  mockUsageUpsert.mockResolvedValue({} as never)
  mockContentFindFirst.mockResolvedValue(null)
}

function mockAIClient(tokens: string[] = ["Olá", " ", "mundo"]) {
  const create = vi.fn().mockResolvedValue({
    async *[Symbol.asyncIterator]() {
      for (const token of tokens) {
        yield { choices: [{ delta: { content: token } }] }
      }
    },
  })
  mockGetAIClient.mockReturnValue({
    chat: { completions: { create } },
  } as never)
  return create
}

beforeEach(() => {
  vi.clearAllMocks()
  mockHappyPath()
})

describe("POST /api/v1/ai/horoscope-interpret (T101)", () => {
  it("retorna 401 sem bearer token", async () => {
    const req = new Request(URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(VALID_BODY),
    })

    const res = await POST(req)

    expect(res.status).toBe(401)
  })

  it("retorna 422 com body invalido (type/signId ausentes)", async () => {
    const res = await POST(makeRequest({}))

    expect(res.status).toBe(422)
    expect((await res.json()).error.code).toBe("VALIDATION_ERROR")
    expect(mockUsageUpsert).not.toHaveBeenCalled()
    expect(mockContentFindFirst).not.toHaveBeenCalled()
  })

  it("retorna 422 quando date nao casa com o formato do periodo (superRefine)", async () => {
    const res = await POST(
      makeRequest({
        type: "western",
        signId: "aries",
        period: "weekly",
        date: "2026-10-20",
      }),
    )

    expect(res.status).toBe(422)
    expect((await res.json()).error.code).toBe("VALIDATION_ERROR")
    expect(mockContentFindFirst).not.toHaveBeenCalled()
  })

  it("retorna 422 quando signId nao existe no catalogo do tipo (superRefine, antes da quota)", async () => {
    const res = await POST(
      makeRequest({
        type: "western",
        signId: "signo-fantasma",
        period: "daily",
      }),
    )

    expect(res.status).toBe(422)
    expect((await res.json()).error.code).toBe("VALIDATION_ERROR")
    expect(mockUsageUpsert).not.toHaveBeenCalled()
    expect(mockUsageUpdateMany).not.toHaveBeenCalled()
    expect(mockContentFindFirst).not.toHaveBeenCalled()
  })

  it("retorna 429 AI_DAILY_LIMIT_REACHED sem consumir cota nem ler conteudo", async () => {
    mockUsageFindUnique.mockResolvedValue({
      interpretationCount: 10,
      followUpCount: 0,
    } as never)

    const res = await POST(makeRequest(VALID_BODY))
    const json = await res.json()

    expect(res.status).toBe(429)
    expect(json.error.code).toBe("AI_DAILY_LIMIT_REACHED")
    expect(mockUsageUpsert).not.toHaveBeenCalled()
    expect(mockContentFindFirst).not.toHaveBeenCalled()
  })

  it("retorna 503 AI_SERVICE_UNAVAILABLE sem consumir cota quando o cliente IA falha", async () => {
    mockGetAIClient.mockImplementation(() => {
      throw new Error("AI_API_KEY environment variable is required")
    })

    const res = await POST(makeRequest(VALID_BODY))
    const json = await res.json()

    expect(res.status).toBe(503)
    expect(json.error.code).toBe("AI_SERVICE_UNAVAILABLE")
    expect(mockUsageUpsert).not.toHaveBeenCalled()
    expect(mockUsageUpdateMany).not.toHaveBeenCalled()
  })

  it("faz stream dos tokens e conclui com done", async () => {
    mockAIClient(["Olá", " ", "mundo"])

    const res = await POST(makeRequest(VALID_BODY))

    expect(res.status).toBe(200)
    expect(res.headers.get("content-type")).toContain("text/event-stream")

    const text = await res.text()
    expect(text).toContain('"type":"token"')
    expect(text).toContain('"type":"done"')
    expect(text).toContain("Olá")
  })

  it("consome 1 unidade da cota diaria no sucesso (upsert)", async () => {
    mockAIClient()

    const res = await POST(makeRequest(VALID_BODY))
    await res.text()

    expect(mockUsageUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId_date: expect.objectContaining({ userId: "user-1" }),
        },
        create: expect.objectContaining({ interpretationCount: 1 }),
      }),
    )
  })

  it("NAO incrementa cota quando a completion vem vazia (empty-completion guard)", async () => {
    mockAIClient([])

    const res = await POST(makeRequest(VALID_BODY))
    const text = await res.text()

    expect(text).toContain('"type":"error"')
    expect(text).toContain('"retryable":true')
    // Com o novo padrão (commit após entrega), não há incremento para reverter
    expect(mockUsageUpdateMany).not.toHaveBeenCalled()
  })

  it("NAO incrementa cota quando o provedor falha antes de entregar tokens", async () => {
    mockGetAIClient.mockReturnValue({
      chat: {
        completions: {
          create: vi.fn().mockRejectedValue(new Error("provider boom")),
        },
      },
    } as never)

    const res = await POST(makeRequest(VALID_BODY))
    const text = await res.text()

    expect(text).toContain('"type":"error"')
    // Com o novo padrão (commit após entrega), não há incremento para reverter
    expect(mockUsageUpdateMany).not.toHaveBeenCalled()
  })

  it("NAO devolve a cota quando falha mid-stream apos tokens entregues (entrega parcial consome)", async () => {
    mockGetAIClient.mockReturnValue({
      chat: {
        completions: {
          create: vi.fn().mockResolvedValue({
            async *[Symbol.asyncIterator]() {
              yield { choices: [{ delta: { content: "Olá" } }] }
              throw new Error("provider died mid-stream")
            },
          }),
        },
      },
    } as never)

    const res = await POST(makeRequest(VALID_BODY))
    const text = await res.text()

    expect(text).toContain('"type":"token"')
    expect(text).toContain('"type":"error"')
    expect(mockUsageUpdateMany).not.toHaveBeenCalled()
  })

  it("inclui o conteudo gerado (row HoroscopeContent) no prompt enviado a IA", async () => {
    mockContentFindFirst.mockResolvedValue({
      content: {
        general: "texto-gerado-xyz do dia",
        love: "amor",
        career: "carreira",
        health: "saude",
        luckyNumber: 7,
        luckyColor: "azul",
        mood: "sereno",
        compatibility: "touro",
        date: "2026-10-20",
      },
    } as never)
    const create = mockAIClient()

    const res = await POST(makeRequest(VALID_BODY))
    await res.text()

    expect(mockContentFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          type: "western",
          signId: "aries",
          period: "daily",
          date: "2026-10-20",
        }),
      }),
    )
    const messages = create.mock.calls[0]![0].messages as Array<{
      role: string
      content: string
    }>
    const userMessage = messages.find((m) => m.role === "user")!
    expect(userMessage.content).toContain("texto-gerado-xyz do dia")
    expect(userMessage.content).toContain("Áries")
  })

  it("sintetiza o fallback T032 quando a row nao existe (contexto nunca vazio)", async () => {
    mockContentFindFirst.mockResolvedValue(null)
    const create = mockAIClient()

    const res = await POST(makeRequest(VALID_BODY))
    await res.text()

    const messages = create.mock.calls[0]![0].messages as Array<{
      role: string
      content: string
    }>
    const userMessage = messages.find((m) => m.role === "user")!
    expect(userMessage.content).toContain("Áries: dia de")
    expect(mockUsageUpdateMany).not.toHaveBeenCalled()
  })

  it("usa a data civil BRT de hoje quando date ausente (default do periodo)", async () => {
    const create = mockAIClient()

    const res = await POST(makeRequest({ type: "western", signId: "aries" }))
    await res.text()

    expect(res.status).toBe(200)
    expect(mockContentFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          period: "daily",
          date: civilDateBrt(0),
        }),
      }),
    )
    expect(create).toHaveBeenCalled()
  })
})
