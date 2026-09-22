// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const prismaMock = vi.hoisted(() => ({
  reading: { findFirst: vi.fn() },
}))

const helpersMock = vi.hoisted(() => ({
  requireAuth: vi.fn().mockResolvedValue({ userId: "usr_1" }),
}))

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }))
vi.mock("@/app/api/v1/users/_helpers", () => helpersMock)

async function callGet(readingId: string) {
  const { GET } = await import("@/app/api/v1/readings/[id]/route")
  return GET(
    new Request(`http://localhost:3000/api/v1/readings/${readingId}`),
    { params: Promise.resolve({ id: readingId }) },
  )
}

const mockReading = {
  id: "reading_1",
  userId: "usr_1",
  deckId: "rws",
  spreadId: "three-card",
  title: "Test Reading",
  notes: "Some notes",
  seed: "abc123",
  duration: 120,
  isPublic: false,
  createdAt: new Date("2026-09-21"),
  cards: [
    { id: "c1", cardId: "rws-major-0", positionIndex: 0, isReversed: false },
    { id: "c2", cardId: "rws-major-1", positionIndex: 1, isReversed: true },
    { id: "c3", cardId: "rws-major-2", positionIndex: 2, isReversed: false },
  ],
}

beforeEach(() => {
  vi.clearAllMocks()
  helpersMock.requireAuth.mockResolvedValue({ userId: "usr_1" })
  prismaMock.reading.findFirst.mockResolvedValue(mockReading)
})

afterEach(() => {
  vi.resetModules()
})

describe("GET /api/v1/readings/:id", () => {
  it("returns reading with 200", async () => {
    const res = await callGet("reading_1")
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.reading.id).toBe("reading_1")
    expect(body.reading.cards.length).toBe(3)
  })

  it("returns 401 without auth", async () => {
    helpersMock.requireAuth.mockResolvedValueOnce(
      Response.json(
        { error: { code: "AUTH_TOKEN_INVALID", message: "Token invalido" } },
        { status: 401 },
      ),
    )
    const res = await callGet("reading_1")
    expect(res.status).toBe(401)
  })

  it("returns 404 when reading not found", async () => {
    prismaMock.reading.findFirst.mockResolvedValue(null)
    const res = await callGet("nonexistent")
    expect(res.status).toBe(404)
  })

  it("returns 404 when reading belongs to another user (private)", async () => {
    prismaMock.reading.findFirst.mockResolvedValue(null)
    const res = await callGet("reading_1")
    expect(res.status).toBe(404)
  })

  it("allows viewing public reading from another user", async () => {
    prismaMock.reading.findFirst.mockResolvedValue({
      ...mockReading,
      userId: "other_user",
      isPublic: true,
    })
    const res = await callGet("reading_1")
    expect(res.status).toBe(200)
  })
})
