// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const prismaMock = vi.hoisted(() => ({
  reading: { findMany: vi.fn(), count: vi.fn() },
}))

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }))

const helpersMock = vi.hoisted(() => ({
  requireAuth: vi.fn().mockResolvedValue({ userId: "usr_1" }),
}))

vi.mock("@/app/api/v1/users/_helpers", () => helpersMock)

async function callGet(query = "") {
  const { GET } = await import("@/app/api/v1/readings/route")
  const url = query
    ? `http://localhost:3000/api/v1/readings?${query}`
    : "http://localhost:3000/api/v1/readings"
  return GET(new Request(url))
}

const mockReading = {
  id: "reading_1",
  userId: "usr_1",
  deckId: "rws",
  spreadId: "three-card",
  title: "Test",
  notes: null,
  seed: "abc",
  duration: 120,
  isPublic: false,
  createdAt: new Date("2026-09-21"),
  cards: [
    { id: "c1", cardId: "rws-major-0", positionIndex: 0, isReversed: false },
  ],
}

beforeEach(() => {
  vi.clearAllMocks()
  helpersMock.requireAuth.mockResolvedValue({ userId: "usr_1" })
  prismaMock.reading.findMany.mockResolvedValue([mockReading])
  prismaMock.reading.count.mockResolvedValue(1)
})

afterEach(() => {
  vi.resetModules()
})

describe("GET /api/v1/readings", () => {
  it("returns user readings with 200", async () => {
    const res = await callGet()
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body).toHaveProperty("readings")
    expect(body).toHaveProperty("pagination")
    expect(body.readings.length).toBe(1)
  })

  it("returns 401 without auth", async () => {
    helpersMock.requireAuth.mockResolvedValueOnce(
      Response.json(
        { error: { code: "AUTH_TOKEN_INVALID", message: "Token invalido" } },
        { status: 401 },
      ),
    )
    const res = await callGet()
    expect(res.status).toBe(401)
  })

  it("supports pagination params", async () => {
    const res = await callGet("page=2&limit=5")
    expect(res.status).toBe(200)
    expect(prismaMock.reading.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 5, take: 5 }),
    )
  })

  it("returns correct pagination meta", async () => {
    prismaMock.reading.count.mockResolvedValue(15)
    const res = await callGet("page=1&limit=10")
    const body = await res.json()
    expect(body.pagination).toEqual({
      page: 1,
      limit: 10,
      total: 15,
      totalPages: 2,
    })
  })

  it("filters by deckId", async () => {
    const res = await callGet("deckId=thoth")
    expect(res.status).toBe(200)
    expect(prismaMock.reading.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ deckId: "thoth" }),
      }),
    )
  })

  it("returns empty array when no readings", async () => {
    prismaMock.reading.findMany.mockResolvedValue([])
    prismaMock.reading.count.mockResolvedValue(0)
    const res = await callGet()
    const body = await res.json()
    expect(body.readings).toEqual([])
    expect(body.pagination.total).toBe(0)
  })
})
