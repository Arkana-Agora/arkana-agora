// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const prismaMock = vi.hoisted(() => ({
  reading: { count: vi.fn(), create: vi.fn() },
  user: { findUnique: vi.fn() },
  $transaction: vi.fn(),
}))

const helpersMock = vi.hoisted(() => ({
  requireAuth: vi.fn().mockResolvedValue({ userId: "usr_1" }),
}))

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }))
vi.mock("@/app/api/v1/users/_helpers", () => helpersMock)

async function callPost(body: unknown) {
  const { POST } = await import("@/app/api/v1/readings/route")
  return POST(
    new Request("http://localhost:3000/api/v1/readings", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer valid-token",
      },
      body: JSON.stringify(body),
    }),
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  helpersMock.requireAuth.mockResolvedValue({ userId: "usr_1" })
  prismaMock.reading.count.mockResolvedValue(0)
  prismaMock.user.findUnique.mockResolvedValue({ plan: "free" })
  prismaMock.reading.create.mockResolvedValue({
    id: "reading_1",
    userId: "usr_1",
    deckId: "rws",
    spreadId: "three-card",
    title: null,
    notes: null,
    seed: "abc123",
    duration: 0,
    isPublic: false,
    createdAt: new Date(),
    cards: [],
  })
  prismaMock.$transaction.mockImplementation(
    async (cb: (tx: typeof prismaMock) => Promise<unknown>) => cb(prismaMock),
  )
})

afterEach(() => {
  vi.resetModules()
})

const validBody = {
  deckId: "rws",
  spreadId: "three-card",
}

describe("POST /api/v1/readings", () => {
  it("creates reading with 201 when authorized and within limit", async () => {
    const res = await callPost(validBody)
    const body = await res.json()
    expect(res.status).toBe(201)
    expect(body).toHaveProperty("reading")
    expect(body.reading).toHaveProperty("id")
    expect(body.reading).toHaveProperty("cards")
    expect(body.reading).toHaveProperty("spread")
    expect(body.reading).toHaveProperty("createdAt")
  })

  it("returns 401 without auth token", async () => {
    helpersMock.requireAuth.mockResolvedValueOnce(
      Response.json(
        { error: { code: "AUTH_TOKEN_INVALID", message: "Token invalido" } },
        { status: 401 },
      ),
    )
    const res = await callPost(validBody)
    expect(res.status).toBe(401)
  })

  it("returns 422 for missing deckId", async () => {
    const res = await callPost({ spreadId: "three-card" })
    expect(res.status).toBe(422)
  })

  it("returns 422 for missing spreadId", async () => {
    const res = await callPost({ deckId: "rws" })
    expect(res.status).toBe(422)
  })

  it("returns 422 for invalid deckId", async () => {
    const res = await callPost({ deckId: "invalid", spreadId: "three-card" })
    expect(res.status).toBe(422)
  })

  it("returns 429 when daily limit reached", async () => {
    prismaMock.reading.count.mockResolvedValue(3)
    const res = await callPost(validBody)
    const body = await res.json()
    expect(res.status).toBe(429)
    expect(body.error.code).toBe("DAILY_LIMIT_REACHED")
  })

  it("saves reading with correct fields", async () => {
    await callPost({
      deckId: "rws",
      spreadId: "single-card",
      title: "My reading",
      notes: "Some notes",
      isPublic: true,
    })
    expect(prismaMock.reading.create).toHaveBeenCalledOnce()
    const call = prismaMock.reading.create.mock.calls[0]![0]
    expect(call.data.deckId).toBe("rws")
    expect(call.data.spreadId).toBe("single-card")
    expect(call.data.title).toBe("My reading")
    expect(call.data.notes).toBe("Some notes")
    expect(call.data.isPublic).toBe(true)
    expect(call.data.userId).toBe("usr_1")
    expect(typeof call.data.seed).toBe("string")
  })

  it("creates reading cards", async () => {
    await callPost(validBody)
    const call = prismaMock.reading.create.mock.calls[0]![0]
    expect(call.data.cards).toBeDefined()
    expect(call.data.cards.createMany).toBeDefined()
    expect(call.data.cards.createMany.data.length).toBe(3)
  })
})
