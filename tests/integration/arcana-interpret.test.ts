import { describe, it, expect, vi, beforeEach } from "vitest"
import { POST as interpretPOST } from "@/app/api/v1/ai/arcana-interpret/route"

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
    reading: {
      findMany: vi.fn(),
    },
    aIDailyUsage: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
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
  withRetry: vi.fn((fn: () => Promise<unknown>) => fn()),
}))

import { prisma } from "@/lib/prisma"
import { getAIClient } from "@/lib/ai/client"

const mockUserFindUnique = vi.mocked(prisma.user.findUnique)
const mockUsageFindUnique = vi.mocked(prisma.aIDailyUsage.findUnique)
const mockUsageUpsert = vi.mocked(prisma.aIDailyUsage.upsert)
const mockGetAIClient = vi.mocked(getAIClient)

function makeInterpretRequest(body: unknown) {
  return new Request("http://localhost:3000/api/v1/ai/arcana-interpret", {
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

function mockUser() {
  mockUserFindUnique.mockResolvedValue({
    id: "user-1",
    name: "Luna",
    plan: "FREE",
    birthDate: new Date("1995-03-15"),
    personalArcana: 5,
  } as never)
  mockUsageFindUnique.mockResolvedValue({
    interpretationCount: 0,
    followUpCount: 0,
  } as never)
  mockUsageUpsert.mockResolvedValue({} as never)
}

function mockAIClient() {
  const asyncIterable = {
    async *[Symbol.asyncIterator]() {
      for (const token of ["O", " ", "Hierofante", " ", "governa"]) {
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

describe("POST /api/v1/ai/arcana-interpret", () => {
  it("returns 401 without bearer token", async () => {
    const req = new Request(
      "http://localhost:3000/api/v1/ai/arcana-interpret",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      },
    )
    const res = await interpretPOST(req)
    expect(res.status).toBe(401)
  })

  it("returns 422 with invalid body", async () => {
    const res = await interpretPOST(makeInterpretRequest({}))
    expect(res.status).toBe(422)
  })

  it("returns 200 with valid arcanaNumber", async () => {
    mockUser()
    mockAIClient()

    const res = await interpretPOST(
      makeInterpretRequest({ arcanaNumber: 5, mode: "general" }),
    )
    expect(res.status).toBe(200)
    expect(res.headers.get("content-type")).toContain("text/event-stream")
  })

  it("streams SSE tokens", async () => {
    mockUser()
    mockAIClient()

    const res = await interpretPOST(
      makeInterpretRequest({ arcanaNumber: 5, mode: "general" }),
    )

    const text = await res.text()
    expect(text).toContain("data:")
    expect(text).toContain("done")
  })

  it("increments usage count", async () => {
    mockUser()
    mockAIClient()

    await interpretPOST(
      makeInterpretRequest({ arcanaNumber: 5, mode: "general" }),
    )

    expect(mockUsageUpsert).toHaveBeenCalled()
  })
})
