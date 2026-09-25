import { describe, it, expect, vi, beforeEach } from "vitest"
import { GET } from "@/app/api/v1/arcana/calculate/route"
import { calculatePersonalArcana } from "@/lib/arcana/calculate"

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      updateMany: vi.fn(),
    },
    arcanaCalculation: {
      create: vi.fn(),
    },
  },
}))

vi.mock("@/services/token-service", () => ({
  verifyAccessToken: vi.fn().mockResolvedValue({ userId: "user-1" }),
}))

import { prisma } from "@/lib/prisma"

const mockUserFindUnique = vi.mocked(prisma.user.findUnique)
const mockUserUpdateMany = vi.mocked(prisma.user.updateMany)
const mockArcanaCreate = vi.mocked(prisma.arcanaCalculation.create)

const LUNA = { name: "Luna", birthDate: new Date("1995-03-15") }
const LUNA_CANONICAL = calculatePersonalArcana(LUNA.birthDate, LUNA.name)!

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
      ...LUNA,
      personalArcana: null,
    } as never)

    const res = await GET(makeRequest())
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.arcana).toBe(LUNA_CANONICAL)
    expect(body.arcana).toBeGreaterThanOrEqual(1)
    expect(body.arcana).toBeLessThanOrEqual(22)
    expect(body.name).toBe("Luna")
    expect(body.arcanaData).toBeDefined()
    expect(body.arcanaData.name).toBeDefined()
    expect(body.reductionDate).toBeDefined()
    expect(body.reductionName).toBeDefined()
    expect(mockArcanaCreate).toHaveBeenCalledTimes(1)
    expect(mockArcanaCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: "user-1",
        fullName: "Luna",
        birthDate: new Date("1995-03-15"),
        arcanaNumber: LUNA_CANONICAL,
        arcanaName: expect.any(String),
        reductionDate: expect.any(String),
        reductionName: expect.any(String),
        description: expect.any(String),
      }),
    })
  })

  it("serves cached personalArcana when it matches the canonical value", async () => {
    mockUserFindUnique.mockResolvedValue({
      ...LUNA,
      personalArcana: LUNA_CANONICAL,
    } as never)

    const res = await GET(makeRequest())
    const body = await res.json()
    expect(body.arcana).toBe(LUNA_CANONICAL)
    expect(mockUserUpdateMany).not.toHaveBeenCalled()
  })

  it("persists personalArcana when not cached yet with CAS where", async () => {
    mockUserFindUnique.mockResolvedValue({
      ...LUNA,
      personalArcana: null,
    } as never)

    const res = await GET(makeRequest())
    expect(res.status).toBe(200)
    expect(mockUserUpdateMany).toHaveBeenCalledTimes(1)
    const call = mockUserUpdateMany.mock.calls[0]![0] as {
      where: { id: string; personalArcana: number | null }
      data: { personalArcana: number }
    }
    expect(call.where).toEqual({ id: "user-1", personalArcana: null })
    expect(call.data.personalArcana).toBe(LUNA_CANONICAL)
  })

  it("self-heals a stale cached arcano and serves the canonical value", async () => {
    mockUserFindUnique.mockResolvedValue({
      ...LUNA,
      personalArcana: 5,
    } as never)

    const res = await GET(makeRequest())
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.arcana).toBe(LUNA_CANONICAL)
    expect(mockUserUpdateMany).toHaveBeenCalledTimes(1)
    const call = mockUserUpdateMany.mock.calls[0]![0] as {
      where: { id: string; personalArcana: number | null }
      data: { personalArcana: number }
    }
    // CAS guarda contra o valor observado, nao escreve cegamente
    expect(call.where).toEqual({ id: "user-1", personalArcana: 5 })
    expect(call.data.personalArcana).toBe(LUNA_CANONICAL)
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
