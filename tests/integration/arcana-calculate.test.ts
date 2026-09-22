import { describe, it, expect, vi, beforeEach } from "vitest"
import { GET } from "@/app/api/v1/arcana/calculate/route"

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
  },
}))

vi.mock("@/services/token-service", () => ({
  verifyAccessToken: vi.fn().mockResolvedValue({ userId: "user-1" }),
}))

import { prisma } from "@/lib/prisma"

const mockUserFindUnique = vi.mocked(prisma.user.findUnique)

function makeRequest() {
  return new Request("http://localhost:3000/api/v1/arcana/calculate", {
    method: "GET",
    headers: { Authorization: "Bearer valid-token" },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe("GET /api/v1/arcana/calculate", () => {
  it("returns 401 without bearer token", async () => {
    const req = new Request("http://localhost:3000/api/v1/arcana/calculate")
    const res = await GET(req)
    expect(res.status).toBe(401)
  })

  it("returns 404 when user not found", async () => {
    mockUserFindUnique.mockResolvedValue(null)
    const res = await GET(makeRequest())
    expect(res.status).toBe(404)
  })

  it("returns 422 when birthDate is missing", async () => {
    mockUserFindUnique.mockResolvedValue({
      name: "Luna",
      birthDate: null,
      personalArcana: null,
    } as never)
    const res = await GET(makeRequest())
    expect(res.status).toBe(422)
  })

  it("returns 200 with valid user data", async () => {
    mockUserFindUnique.mockResolvedValue({
      name: "Luna",
      birthDate: new Date("1995-03-15"),
      personalArcana: null,
    } as never)

    const res = await GET(makeRequest())
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.arcana).toBeGreaterThanOrEqual(1)
    expect(body.arcana).toBeLessThanOrEqual(22)
    expect(body.name).toBe("Luna")
    expect(body.arcanaData).toBeDefined()
    expect(body.arcanaData.name).toBeDefined()
  })

  it("returns cached personalArcana when available", async () => {
    mockUserFindUnique.mockResolvedValue({
      name: "Luna",
      birthDate: new Date("1995-03-15"),
      personalArcana: 5,
    } as never)

    const res = await GET(makeRequest())
    const body = await res.json()
    expect(body.arcana).toBe(5)
  })

  it("returns full arcanaData with element and planet", async () => {
    mockUserFindUnique.mockResolvedValue({
      name: "Luna",
      birthDate: new Date("1995-03-15"),
      personalArcana: null,
    } as never)

    const res = await GET(makeRequest())
    const body = await res.json()
    expect(body.arcanaData.element).toBeDefined()
    expect(body.arcanaData.planet).toBeDefined()
    expect(body.arcanaData.upright).toBeDefined()
    expect(body.arcanaData.reversed).toBeDefined()
  })
})
