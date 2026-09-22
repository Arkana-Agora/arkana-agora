import { describe, it, expect, vi, beforeEach } from "vitest"
import { POST } from "@/app/api/v1/ai/interpret/route"

vi.mock("@/lib/prisma", () => ({
  prisma: {
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
    interpretation: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
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

const mockReadingFindUnique = vi.mocked(prisma.reading.findUnique)
const mockUserFindUnique = vi.mocked(prisma.user.findUnique)
const mockUsageFindUnique = vi.mocked(prisma.aIDailyUsage.findUnique)
const mockUsageUpsert = vi.mocked(prisma.aIDailyUsage.upsert)
const mockInterpretationFindUnique = vi.mocked(prisma.interpretation.findUnique)
const mockInterpretationFindFirst = vi.mocked(prisma.interpretation.findFirst)
const mockInterpretationCreate = vi.mocked(prisma.interpretation.create)
const mockGetAIClient = vi.mocked(getAIClient)

function makeRequest(body: unknown) {
  return new Request("http://localhost:3000/api/v1/ai/interpret", {
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

function mockReading() {
  mockReadingFindUnique.mockResolvedValue({
    id: "reading-1",
    userId: "user-1",
    deckId: "rws",
    spreadId: "three-card",
    cards: [
      { cardId: "rws-major-0", positionIndex: 0, isReversed: false },
      { cardId: "rws-major-16", positionIndex: 1, isReversed: true },
      { cardId: "rws-major-17", positionIndex: 2, isReversed: false },
    ],
  } as never)
  mockUserFindUnique.mockResolvedValue({
    plan: "FREE",
    name: "Luna",
    birthDate: new Date("1995-03-15"),
    astrologicalSign: "Peixes",
    personalArcana: 5,
  } as never)
  mockUsageFindUnique.mockResolvedValue({
    interpretationCount: 2,
    followUpCount: 0,
  } as never)
  mockUsageUpsert.mockResolvedValue({} as never)
  mockInterpretationFindUnique.mockResolvedValue(null)
  mockInterpretationFindFirst.mockResolvedValue(null)
  mockInterpretationCreate.mockResolvedValue({ id: "interp-1" } as never)
}

function mockAIClient(tokens: string[] = ["O", " ", "Louco"]) {
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

describe("POST /api/v1/ai/interpret", () => {
  it("returns 401 without bearer token", async () => {
    const req = new Request("http://localhost:3000/api/v1/ai/interpret", {
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

  it("returns 404 when reading not found", async () => {
    mockReadingFindUnique.mockResolvedValue(null)
    mockUserFindUnique.mockResolvedValue({ plan: "FREE" } as never)

    const res = await POST(
      makeRequest({ readingId: "nonexistent", mode: "general" }),
    )
    expect(res.status).toBe(404)
  })

  it("returns 429 when daily limit reached", async () => {
    mockReading()
    mockUsageFindUnique.mockResolvedValue({
      interpretationCount: 10,
      followUpCount: 0,
    } as never)

    const res = await POST(
      makeRequest({ readingId: "reading-1", mode: "general" }),
    )
    expect(res.status).toBe(429)
  })

  it("returns cached interpretation when cache hit", async () => {
    mockReading()
    mockInterpretationFindFirst.mockResolvedValue({
      id: "cached-interp",
      content: "Interpretacao cacheada",
      wasCached: true,
    } as never)

    const res = await POST(
      makeRequest({ readingId: "reading-1", mode: "general" }),
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.cached).toBe(true)
    expect(body.content).toBe("Interpretacao cacheada")
  })

  it("streams SSE tokens on cache miss", async () => {
    mockReading()
    mockAIClient(["O", " ", "Louco", " ", "aparece"])

    const res = await POST(
      makeRequest({ readingId: "reading-1", mode: "general" }),
    )

    expect(res.status).toBe(200)
    expect(res.headers.get("content-type")).toContain("text/event-stream")

    const text = await res.text()
    expect(text).toContain("data:")
    expect(text).toContain("done")
  })

  it("increments usage count on successful generation", async () => {
    mockReading()
    mockAIClient(["Olá"])

    await POST(makeRequest({ readingId: "reading-1", mode: "general" }))

    expect(mockUsageUpsert).toHaveBeenCalled()
  })

  it("saves interpretation after streaming", async () => {
    mockReading()
    mockAIClient(["Olá"])

    const res = await POST(
      makeRequest({ readingId: "reading-1", mode: "general" }),
    )

    // Consume the SSE stream to trigger side effects
    const reader = res.body!.getReader()
    while (true) {
      const { done } = await reader.read()
      if (done) break
    }

    expect(mockInterpretationCreate).toHaveBeenCalled()
  })
})
