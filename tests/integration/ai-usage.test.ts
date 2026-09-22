import { describe, it, expect, vi, beforeEach } from "vitest"
import { GET } from "@/app/api/v1/ai/usage/route"

vi.mock("@/lib/prisma", () => ({
  prisma: {
    aIDailyUsage: {
      findUnique: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
  },
}))

vi.mock("@/services/token-service", () => ({
  verifyAccessToken: vi.fn().mockResolvedValue({ userId: "user-1" }),
}))

import { prisma } from "@/lib/prisma"
const mockFindUniqueUsage = vi.mocked(prisma.aIDailyUsage.findUnique)
const mockFindUniqueUser = vi.mocked(prisma.user.findUnique)

function makeRequest() {
  return new Request("http://localhost:3000/api/v1/ai/usage", {
    method: "GET",
    headers: { Authorization: "Bearer valid-token" },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe("GET /api/v1/ai/usage", () => {
  it("returns 401 without bearer token", async () => {
    const req = new Request("http://localhost:3000/api/v1/ai/usage")
    const res = await GET(req)
    expect(res.status).toBe(401)
  })

  it("returns usage counts for FREE tier", async () => {
    mockFindUniqueUser.mockResolvedValue({ plan: "FREE" } as never)
    mockFindUniqueUsage.mockResolvedValue({
      interpretationCount: 3,
      followUpCount: 5,
    } as never)

    const res = await GET(makeRequest())
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.interpretations).toBe(3)
    expect(body.followUps).toBe(5)
    expect(body.dailyLimit).toBe(10)
    expect(body.followUpLimit).toBe(10)
    expect(body.tier).toBe("FREE")
  })

  it("returns usage counts for PLUS tier", async () => {
    mockFindUniqueUser.mockResolvedValue({ plan: "PLUS" } as never)
    mockFindUniqueUsage.mockResolvedValue({
      interpretationCount: 20,
      followUpCount: 15,
    } as never)

    const res = await GET(makeRequest())
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.interpretations).toBe(20)
    expect(body.followUps).toBe(15)
    expect(body.dailyLimit).toBe(Number.MAX_SAFE_INTEGER)
    expect(body.followUpLimit).toBe(30)
    expect(body.tier).toBe("PLUS")
  })

  it("returns zero counts when no usage today", async () => {
    mockFindUniqueUser.mockResolvedValue({ plan: "FREE" } as never)
    mockFindUniqueUsage.mockResolvedValue(null)

    const res = await GET(makeRequest())
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.interpretations).toBe(0)
    expect(body.followUps).toBe(0)
  })

  it("includes resetsAt timestamp", async () => {
    mockFindUniqueUser.mockResolvedValue({ plan: "FREE" } as never)
    mockFindUniqueUsage.mockResolvedValue(null)

    const res = await GET(makeRequest())
    const body = await res.json()

    expect(body.resetsAt).toBeDefined()
    expect(new Date(body.resetsAt).getTime()).toBeGreaterThan(Date.now())
  })
})
