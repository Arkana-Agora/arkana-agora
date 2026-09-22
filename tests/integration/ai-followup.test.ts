import { describe, it, expect, vi, beforeEach } from "vitest"
import { POST } from "@/app/api/v1/ai/follow-up/route"

vi.mock("@/lib/prisma", () => ({
  prisma: {
    interpretation: {
      findUnique: vi.fn(),
    },
    reading: {
      findUnique: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
    aIDailyUsage: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
    followUpMessage: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
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

const mockInterpretationFindUnique = vi.mocked(prisma.interpretation.findUnique)
const mockReadingFindUnique = vi.mocked(prisma.reading.findUnique)
const mockUserFindUnique = vi.mocked(prisma.user.findUnique)
const mockUsageFindUnique = vi.mocked(prisma.aIDailyUsage.findUnique)
const mockUsageUpsert = vi.mocked(prisma.aIDailyUsage.upsert)
const mockFollowUpFindMany = vi.mocked(prisma.followUpMessage.findMany)
const mockFollowUpCreate = vi.mocked(prisma.followUpMessage.create)
const mockGetAIClient = vi.mocked(getAIClient)

function makeRequest(body: unknown) {
  return new Request("http://localhost:3000/api/v1/ai/follow-up", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer valid-token",
    },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
})

function mockInterpretation() {
  mockInterpretationFindUnique.mockResolvedValue({
    id: "interp-1",
    readingId: "reading-1",
    userId: "user-1",
    mode: "general",
    content: "Interpretacao original",
    cacheHash: "hash",
  } as never)
  mockReadingFindUnique.mockResolvedValue({
    id: "reading-1",
    deckId: "rws",
    spreadId: "three-card",
  } as never)
  mockUserFindUnique.mockResolvedValue({ plan: "FREE", name: "Luna" } as never)
  mockUsageFindUnique.mockResolvedValue({
    interpretationCount: 2,
    followUpCount: 3,
  } as never)
  mockUsageUpsert.mockResolvedValue({} as never)
  mockFollowUpFindMany.mockResolvedValue([])
  mockFollowUpCreate.mockResolvedValue({ id: "msg-1" } as never)
}

function mockAIClient(tokens: string[] = ["Resposta", " ", "da", " ", "IA"]) {
  const asyncIterable = {
    async *[Symbol.asyncIterator]() {
      for (const token of tokens) {
        yield { choices: [{ delta: { content: token } }] }
      }
    },
  }
  mockGetAIClient.mockReturnValue({
    chat: {
      completions: {
        create: vi.fn().mockResolvedValue(asyncIterable),
      },
    },
  } as never)
}

describe("POST /api/v1/ai/follow-up", () => {
  it("returns 401 without bearer token", async () => {
    const req = new Request("http://localhost:3000/api/v1/ai/follow-up", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    })
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it("returns 422 with invalid body", async () => {
    const res = await POST(makeRequest({}))
    expect(res.status).toBe(422)
  })

  it("returns 404 when interpretation not found", async () => {
    mockInterpretationFindUnique.mockResolvedValue(null)

    const res = await POST(
      makeRequest({ interpretationId: "nonexistent", message: "Oi" }),
    )
    expect(res.status).toBe(404)
  })

  it("returns 429 when follow-up limit reached", async () => {
    mockInterpretation()
    mockUsageFindUnique.mockResolvedValue({
      interpretationCount: 2,
      followUpCount: 10,
    } as never)

    const res = await POST(
      makeRequest({ interpretationId: "interp-1", message: "Pergunta" }),
    )
    expect(res.status).toBe(429)
  })

  it("streams SSE tokens on valid request", async () => {
    mockInterpretation()
    mockAIClient(["O", " ", "simbolo"])

    const res = await POST(
      makeRequest({
        interpretationId: "interp-1",
        message: "E o significado?",
      }),
    )

    expect(res.status).toBe(200)
    expect(res.headers.get("content-type")).toContain("text/event-stream")
  })

  it("saves user and assistant messages", async () => {
    mockInterpretation()
    mockAIClient(["Resposta"])

    const res = await POST(
      makeRequest({ interpretationId: "interp-1", message: "Minha pergunta" }),
    )

    // Consume the SSE stream to trigger side effects
    const reader = res.body!.getReader()
    while (true) {
      const { done } = await reader.read()
      if (done) break
    }

    expect(mockFollowUpCreate).toHaveBeenCalledTimes(2)
  })

  it("increments follow-up count", async () => {
    mockInterpretation()
    mockAIClient(["Ok"])

    await POST(
      makeRequest({ interpretationId: "interp-1", message: "Pergunta" }),
    )

    expect(mockUsageUpsert).toHaveBeenCalled()
  })
})
