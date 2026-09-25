import { beforeEach, describe, expect, it, vi } from "vitest"

const prismaMock = vi.hoisted(() => ({
  userProfile: { findUnique: vi.fn(), upsert: vi.fn() },
  user: { findUnique: vi.fn(), update: vi.fn() },
  $transaction: vi.fn(async (fn: unknown) => {
    if (typeof fn === "function")
      return (fn as (tx: unknown) => unknown)(prismaMock)
    if (Array.isArray(fn)) return Promise.all(fn)
    return fn
  }),
}))

const tokenServiceMock = vi.hoisted(() => ({
  verifyAccessToken: vi.fn(),
}))

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }))
vi.mock("@/services/token-service", () => tokenServiceMock)

import { GET } from "@/app/api/v1/users/me/profile/route"
import { PATCH } from "@/app/api/v1/users/me/profile/route"

describe("GET /api/v1/users/me/profile", () => {
  beforeEach(() => {
    prismaMock.userProfile.findUnique.mockReset()
    prismaMock.user.findUnique.mockReset()
    tokenServiceMock.verifyAccessToken.mockReset()
  })

  it("returns 401 without bearer token", async () => {
    const res = await GET(
      new Request("http://localhost/api/v1/users/me/profile"),
    )
    expect(res.status).toBe(401)
  })

  it("returns profile when authenticated", async () => {
    tokenServiceMock.verifyAccessToken.mockResolvedValue({ userId: "u1" })
    prismaMock.user.findUnique.mockResolvedValue({
      id: "u1",
      name: "Maria",
      displayName: "Maria S.",
      avatar: null,
      plan: "FREE",
      email: "maria@test.com",
    })
    prismaMock.userProfile.findUnique.mockResolvedValue({
      bio: "Tarot reader",
      username: "maria",
      birthPlace: "São Paulo",
      privacy: { isPublic: true },
      location: "SP",
      website: null,
      socialLinks: null,
    })

    const res = await GET(
      new Request("http://localhost/api/v1/users/me/profile", {
        headers: { Authorization: "Bearer valid-token" },
      }),
    )
    const body = (await res.json()) as Record<string, unknown>

    expect(res.status).toBe(200)
    expect(body.email).toBe("maria@test.com")
  })
})

describe("PATCH /api/v1/users/me/profile", () => {
  beforeEach(() => {
    prismaMock.user.findUnique.mockReset()
    prismaMock.userProfile.findUnique.mockReset()
    prismaMock.userProfile.upsert.mockReset()
    prismaMock.user.update.mockReset()
    tokenServiceMock.verifyAccessToken.mockReset()
  })

  it("returns 401 without bearer token", async () => {
    const req = new Request("http://localhost/api/v1/users/me/profile", {
      method: "PATCH",
      body: JSON.stringify({ bio: "Updated" }),
      headers: { "Content-Type": "application/json" },
    })
    const res = await PATCH(req)
    expect(res.status).toBe(401)
  })

  it("updates profile fields", async () => {
    tokenServiceMock.verifyAccessToken.mockResolvedValue({ userId: "u1" })
    prismaMock.userProfile.upsert.mockResolvedValue({})
    prismaMock.user.update.mockResolvedValue({})

    const req = new Request("http://localhost/api/v1/users/me/profile", {
      method: "PATCH",
      body: JSON.stringify({ bio: "Nova bio" }),
      headers: {
        Authorization: "Bearer valid-token",
        "Content-Type": "application/json",
      },
    })
    const res = await PATCH(req)

    expect(res.status).toBe(200)
    expect(prismaMock.userProfile.upsert).toHaveBeenCalledWith({
      where: { userId: "u1" },
      create: { userId: "u1", bio: "Nova bio" },
      update: { bio: "Nova bio" },
    })
  })

  it("creates profile row when missing via upsert", async () => {
    tokenServiceMock.verifyAccessToken.mockResolvedValue({ userId: "u1" })
    prismaMock.userProfile.upsert.mockResolvedValue({})
    prismaMock.user.update.mockResolvedValue({})

    const req = new Request("http://localhost/api/v1/users/me/profile", {
      method: "PATCH",
      body: JSON.stringify({ location: "SP" }),
      headers: {
        Authorization: "Bearer valid-token",
        "Content-Type": "application/json",
      },
    })
    const res = await PATCH(req)

    expect(res.status).toBe(200)
    expect(prismaMock.userProfile.upsert).toHaveBeenCalled()
  })

  it("clears birthDate with empty string", async () => {
    tokenServiceMock.verifyAccessToken.mockResolvedValue({ userId: "u1" })
    prismaMock.userProfile.upsert.mockResolvedValue({})
    prismaMock.user.update.mockResolvedValue({})

    const req = new Request("http://localhost/api/v1/users/me/profile", {
      method: "PATCH",
      body: JSON.stringify({ birthDate: "" }),
      headers: {
        Authorization: "Bearer valid-token",
        "Content-Type": "application/json",
      },
    })
    const res = await PATCH(req)

    expect(res.status).toBe(200)
    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { id: "u1" },
      data: {
        birthDate: null,
        astrologicalSign: null,
        mayanKin: null,
        personalArcana: null,
      },
    })
  })

  it("recalculates personalArcana when birthDate is provided", async () => {
    tokenServiceMock.verifyAccessToken.mockResolvedValue({ userId: "u1" })
    prismaMock.user.findUnique.mockResolvedValue({ name: "Maria Silva" })
    prismaMock.userProfile.upsert.mockResolvedValue({})
    prismaMock.user.update.mockResolvedValue({})

    const req = new Request("http://localhost/api/v1/users/me/profile", {
      method: "PATCH",
      body: JSON.stringify({ birthDate: "1990-06-15" }),
      headers: {
        Authorization: "Bearer valid-token",
        "Content-Type": "application/json",
      },
    })
    const res = await PATCH(req)

    expect(res.status).toBe(200)
    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { id: "u1" },
      data: expect.objectContaining({
        birthDate: new Date("1990-06-15"),
        personalArcana: 10,
      }),
    })
  })

  it("nulls personalArcana when recalculation is impossible (no name)", async () => {
    tokenServiceMock.verifyAccessToken.mockResolvedValue({ userId: "u1" })
    prismaMock.user.findUnique.mockResolvedValue({ name: null })
    prismaMock.userProfile.upsert.mockResolvedValue({})
    prismaMock.user.update.mockResolvedValue({})

    const req = new Request("http://localhost/api/v1/users/me/profile", {
      method: "PATCH",
      body: JSON.stringify({ birthDate: "1990-06-15" }),
      headers: {
        Authorization: "Bearer valid-token",
        "Content-Type": "application/json",
      },
    })
    const res = await PATCH(req)

    expect(res.status).toBe(200)
    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { id: "u1" },
      data: expect.objectContaining({ personalArcana: null }),
    })
  })

  it("routes birthPlace to UserProfile upsert, not the User table", async () => {
    tokenServiceMock.verifyAccessToken.mockResolvedValue({ userId: "u1" })
    prismaMock.userProfile.upsert.mockResolvedValue({})
    prismaMock.user.update.mockResolvedValue({})

    const req = new Request("http://localhost/api/v1/users/me/profile", {
      method: "PATCH",
      body: JSON.stringify({ birthPlace: "Sao Paulo" }),
      headers: {
        Authorization: "Bearer valid-token",
        "Content-Type": "application/json",
      },
    })
    const res = await PATCH(req)

    expect(res.status).toBe(200)
    expect(prismaMock.userProfile.upsert).toHaveBeenCalledWith({
      where: { userId: "u1" },
      create: { userId: "u1", birthPlace: "Sao Paulo" },
      update: { birthPlace: "Sao Paulo" },
    })
    expect(prismaMock.user.update).not.toHaveBeenCalled()
  })

  it("clears birthPlace via empty string on the UserProfile upsert", async () => {
    tokenServiceMock.verifyAccessToken.mockResolvedValue({ userId: "u1" })
    prismaMock.userProfile.upsert.mockResolvedValue({})
    prismaMock.user.update.mockResolvedValue({})

    const req = new Request("http://localhost/api/v1/users/me/profile", {
      method: "PATCH",
      body: JSON.stringify({ birthPlace: "", bio: "x" }),
      headers: {
        Authorization: "Bearer valid-token",
        "Content-Type": "application/json",
      },
    })
    const res = await PATCH(req)

    expect(res.status).toBe(200)
    expect(prismaMock.userProfile.upsert).toHaveBeenCalledWith({
      where: { userId: "u1" },
      create: { userId: "u1", birthPlace: null, bio: "x" },
      update: { birthPlace: null, bio: "x" },
    })
    expect(prismaMock.user.update).not.toHaveBeenCalled()
  })

  it("updates both User and UserProfile within the transaction", async () => {
    tokenServiceMock.verifyAccessToken.mockResolvedValue({ userId: "u1" })
    prismaMock.userProfile.upsert.mockResolvedValue({})
    prismaMock.user.update.mockResolvedValue({})

    const req = new Request("http://localhost/api/v1/users/me/profile", {
      method: "PATCH",
      body: JSON.stringify({
        displayName: "Maria",
        bio: "Nova bio",
        birthPlace: "SP",
      }),
      headers: {
        Authorization: "Bearer valid-token",
        "Content-Type": "application/json",
      },
    })
    const res = await PATCH(req)

    expect(res.status).toBe(200)
    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { id: "u1" },
      data: { displayName: "Maria" },
    })
    expect(prismaMock.userProfile.upsert).toHaveBeenCalledWith({
      where: { userId: "u1" },
      create: { userId: "u1", bio: "Nova bio", birthPlace: "SP" },
      update: { bio: "Nova bio", birthPlace: "SP" },
    })
  })

  it("rejects invalid username format", async () => {
    tokenServiceMock.verifyAccessToken.mockResolvedValue({ userId: "u1" })

    const req = new Request("http://localhost/api/v1/users/me/profile", {
      method: "PATCH",
      body: JSON.stringify({ username: "ab" }),
      headers: {
        Authorization: "Bearer valid-token",
        "Content-Type": "application/json",
      },
    })
    const res = await PATCH(req)

    expect(res.status).toBe(422)
  })
})
