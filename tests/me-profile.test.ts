import { beforeEach, describe, expect, it, vi } from "vitest"

const prismaMock = vi.hoisted(() => ({
  userProfile: { findUnique: vi.fn(), update: vi.fn() },
  user: { findUnique: vi.fn(), update: vi.fn() },
  $transaction: vi.fn((fns: unknown[]) =>
    Promise.all(Array.isArray(fns) ? fns : [fns]),
  ),
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
    prismaMock.userProfile.findUnique.mockReset()
    prismaMock.userProfile.update.mockReset()
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
    prismaMock.userProfile.findUnique.mockResolvedValue({
      userId: "u1",
      username: "maria",
    })
    prismaMock.userProfile.update.mockResolvedValue({})
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
