// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const prismaMock = vi.hoisted(() => ({
  reading: { count: vi.fn() },
  user: { findUnique: vi.fn() },
}))

const helpersMock = vi.hoisted(() => ({
  requireAuth: vi.fn().mockResolvedValue({ userId: "usr_1" }),
}))

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }))
vi.mock("@/app/api/v1/users/_helpers", () => helpersMock)

async function callGet() {
  const { GET } = await import("@/app/api/v1/readings/daily-count/route")
  return GET(new Request("http://localhost:3000/api/v1/readings/daily-count"))
}

beforeEach(() => {
  vi.clearAllMocks()
  helpersMock.requireAuth.mockResolvedValue({ userId: "usr_1" })
  prismaMock.reading.count.mockResolvedValue(1)
  prismaMock.user.findUnique.mockResolvedValue({ plan: "free" })
})

afterEach(() => {
  vi.resetModules()
})

describe("GET /api/v1/readings/daily-count", () => {
  it("returns daily count with 200", async () => {
    const res = await callGet()
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body).toHaveProperty("count")
    expect(body).toHaveProperty("totalLimit")
    expect(body).toHaveProperty("remaining")
    expect(body).toHaveProperty("tier")
    expect(body.count).toBe(1)
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

  it("returns correct limit for free tier", async () => {
    prismaMock.reading.count.mockResolvedValue(0)
    const res = await callGet()
    const body = await res.json()
    expect(body.totalLimit).toBe(3)
    expect(body.remaining).toBe(3)
    expect(body.tier).toBe("free")
  })

  it("returns correct remaining when some used", async () => {
    prismaMock.reading.count.mockResolvedValue(2)
    const res = await callGet()
    const body = await res.json()
    expect(body.count).toBe(2)
    expect(body.remaining).toBe(1)
  })

  it("returns remaining=0 when limit reached", async () => {
    prismaMock.reading.count.mockResolvedValue(3)
    const res = await callGet()
    const body = await res.json()
    expect(body.remaining).toBe(0)
  })

  it("returns premium tier with unlimited", async () => {
    prismaMock.user.findUnique.mockResolvedValue({ plan: "premium" })
    prismaMock.reading.count.mockResolvedValue(100)
    const res = await callGet()
    const body = await res.json()
    expect(body.tier).toBe("premium")
    expect(body.remaining).toBeGreaterThan(0)
  })
})
