import { beforeEach, describe, expect, it, vi } from "vitest"

const prismaMock = vi.hoisted(() => ({
  horoscopeContent: {
    findFirst: vi.fn(),
    updateMany: vi.fn(),
    create: vi.fn(),
  },
}))
const aiClientMock = vi.hoisted(() => ({
  getAIClient: vi.fn(),
}))

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }))
vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))
vi.mock("@/lib/ai/client", () => aiClientMock)
vi.mock("@/lib/ai/retry", () => ({
  withRetry: (fn: () => Promise<unknown>) => fn(),
}))

import { processHoroscopeJob } from "@/jobs/horoscope-worker"
import { civilDateBrt, civilIsoWeek } from "@/lib/horoscopes/dates"

// T098/T100 — worker BullMQ: prompt T034 → IA → valida T035 → salva em
// HoroscopeContent; qualquer falha (cliente indisponível, completion vazia,
// JSON inválido, faixa de palavras) grava o template fallback T032 com
// `fallback: true` e loga para retry manual (Q13) — NUNCA lança.
// Row já gerada → skip (jobId determinístico T033 deduplica o mesmo dia).

const DATE = civilDateBrt(0)
const DAILY_JOB = {
  type: "western",
  signId: "aries",
  period: "daily",
  date: DATE,
} as const

beforeEach(() => {
  vi.clearAllMocks()
  prismaMock.horoscopeContent.findFirst.mockResolvedValue(null)
  prismaMock.horoscopeContent.updateMany.mockResolvedValue({ count: 1 })
  prismaMock.horoscopeContent.create.mockResolvedValue({ id: "row-1" })
  aiClientMock.getAIClient.mockReset()
})

function aiStream(text: string) {
  return (async function* () {
    yield { choices: [{ delta: { content: text } }] }
  })()
}

function validAiJson(words: number) {
  return JSON.stringify({
    general: Array.from({ length: words }, (_, i) => `palavra${i}`).join(" "),
    love: "Vínculos pedem escuta ativa.",
    career: "Priorize a tarefa mais importante.",
    health: "Hidrate-se e desacelere.",
    luckyNumber: 7,
    luckyColor: "turquesa",
    mood: "sereno",
    compatibility: "touro",
    date: "2020-01-01", // data "errada" da IA — worker deve sobrescrever
  })
}

function mockAiClient(text: string) {
  const create = vi.fn().mockResolvedValue(aiStream(text))
  aiClientMock.getAIClient.mockReturnValue({
    chat: { completions: { create } },
  })
  return create
}

describe("processHoroscopeJob (T098)", () => {
  it("pula quando já existe conteúdo gerado (sem chamada de IA)", async () => {
    prismaMock.horoscopeContent.findFirst.mockResolvedValue({
      content: { fallback: false, date: DATE },
    })

    const result = await processHoroscopeJob(DAILY_JOB)

    expect(result.status).toBe("skipped")
    expect(result.signId).toBe("aries")
    expect(aiClientMock.getAIClient).not.toHaveBeenCalled()
    expect(prismaMock.horoscopeContent.updateMany).not.toHaveBeenCalled()
    expect(prismaMock.horoscopeContent.create).not.toHaveBeenCalled()
  })

  it("gera via IA quando a row não existe e grava date do job (não a da IA)", async () => {
    const create = mockAiClient(validAiJson(160))
    prismaMock.horoscopeContent.updateMany.mockResolvedValue({ count: 0 })

    const result = await processHoroscopeJob(DAILY_JOB)

    expect(result.status).toBe("generated")
    expect(prismaMock.horoscopeContent.updateMany).toHaveBeenCalledTimes(1)
    expect(prismaMock.horoscopeContent.create).toHaveBeenCalledTimes(1)

    const data = prismaMock.horoscopeContent.create.mock.calls[0]![0].data
    expect(data).toMatchObject({
      type: "western",
      signId: "aries",
      element: null,
      period: "daily",
      date: DATE,
    })
    expect(data.content.fallback).toBe(false)
    expect(data.content.date).toBe(DATE) // "2020-01-01" da IA é sobrescrita
    expect(data.content.general).toContain("palavra0")

    // prompt T034 chega à IA com o signo em pt-BR
    const aiCall = create.mock.calls[0]![0]
    const userMessage = aiCall.messages.find(
      (m: { role: string }) => m.role === "user",
    )
    expect(userMessage.content).toContain("Áries")
    expect(userMessage.content).toContain("Tipo: western")
    expect(userMessage.content).toContain(DATE)
  })

  it("substitui row de fallback existente pelo conteúdo gerado", async () => {
    prismaMock.horoscopeContent.findFirst.mockResolvedValue({
      content: { fallback: true, date: DATE, general: "template" },
    })
    mockAiClient(validAiJson(160))

    const result = await processHoroscopeJob(DAILY_JOB)

    expect(result.status).toBe("generated")
    expect(prismaMock.horoscopeContent.updateMany).toHaveBeenCalledTimes(1)
    const where = prismaMock.horoscopeContent.updateMany.mock.calls[0]![0].where
    expect(where).toMatchObject({
      type: "western",
      signId: "aries",
      element: null,
      period: "daily",
      date: DATE,
    })
    expect(
      prismaMock.horoscopeContent.updateMany.mock.calls[0]![0].data.content
        .fallback,
    ).toBe(false)
    expect(prismaMock.horoscopeContent.create).not.toHaveBeenCalled()
  })

  it("usa template fallback quando o cliente IA está indisponível", async () => {
    aiClientMock.getAIClient.mockImplementation(() => {
      throw new Error("AI_API_KEY ausente")
    })
    prismaMock.horoscopeContent.updateMany.mockResolvedValue({ count: 0 })

    const result = await processHoroscopeJob(DAILY_JOB)

    expect(result.status).toBe("fallback")
    const data = prismaMock.horoscopeContent.create.mock.calls[0]![0].data
    expect(data.content.fallback).toBe(true)
    expect(data.content.date).toBe(DATE)
    expect(data.content.general).toContain("Áries")
  })

  it("usa template fallback quando a completion vem vazia", async () => {
    mockAiClient("")
    prismaMock.horoscopeContent.updateMany.mockResolvedValue({ count: 0 })

    const result = await processHoroscopeJob(DAILY_JOB)

    expect(result.status).toBe("fallback")
    expect(
      prismaMock.horoscopeContent.create.mock.calls[0]![0].data.content
        .fallback,
    ).toBe(true)
  })

  it("usa template fallback quando a IA não devolve JSON", async () => {
    mockAiClient("Aqui está seu horóscopo sem formato JSON.")
    prismaMock.horoscopeContent.updateMany.mockResolvedValue({ count: 0 })

    const result = await processHoroscopeJob(DAILY_JOB)

    expect(result.status).toBe("fallback")
    expect(
      prismaMock.horoscopeContent.create.mock.calls[0]![0].data.content
        .fallback,
    ).toBe(true)
  })

  it("usa template fallback quando o JSON viola a faixa T035 (geral fora da faixa)", async () => {
    mockAiClient(validAiJson(10))
    prismaMock.horoscopeContent.updateMany.mockResolvedValue({ count: 0 })

    const result = await processHoroscopeJob(DAILY_JOB)

    expect(result.status).toBe("fallback")
    expect(
      prismaMock.horoscopeContent.create.mock.calls[0]![0].data.content
        .fallback,
    ).toBe(true)
  })

  it("weekly: row key = civilIsoWeek(); content.date = date do job (T035)", async () => {
    mockAiClient(validAiJson(350))
    prismaMock.horoscopeContent.updateMany.mockResolvedValue({ count: 0 })

    const result = await processHoroscopeJob({
      type: "western",
      signId: "aries",
      period: "weekly",
      date: DATE,
    })

    expect(result.status).toBe("generated")
    expect(
      prismaMock.horoscopeContent.findFirst.mock.calls[0]![0].where,
    ).toMatchObject({
      period: "weekly",
      date: civilIsoWeek(),
    })

    const data = prismaMock.horoscopeContent.create.mock.calls[0]![0].data
    expect(data.date).toBe(civilIsoWeek())
    expect(data.content.date).toBe(DATE)
  })

  it("rejeita payload malformado na fronteira (Zod)", async () => {
    await expect(
      processHoroscopeJob({ type: "unknown", signId: "", period: "yearly" }),
    ).rejects.toThrow()
    expect(prismaMock.horoscopeContent.findFirst).not.toHaveBeenCalled()
  })

  it("propaga erro de persistência do fallback para o retry do BullMQ", async () => {
    aiClientMock.getAIClient.mockImplementation(() => {
      throw new Error("AI_API_KEY ausente")
    })
    prismaMock.horoscopeContent.updateMany.mockRejectedValue(
      new Error("db down"),
    )

    await expect(processHoroscopeJob(DAILY_JOB)).rejects.toThrow(/db down/)
  })
})
