import { beforeEach, describe, expect, it, vi } from "vitest"

const prismaMock = vi.hoisted(() => ({
  userProfile: { findUnique: vi.fn() },
}))

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }))

import { GET } from "@/app/api/v1/users/[username]/profile/route"

describe("GET /api/v1/users/:username/profile", () => {
  beforeEach(() => {
    prismaMock.userProfile.findUnique.mockReset()
  })

  it("returns 404 when user not found", async () => {
    prismaMock.userProfile.findUnique.mockResolvedValue(null)

    const res = await GET(
      new Request("http://localhost/api/v1/users/nonexistent/profile"),
      { params: Promise.resolve({ username: "nonexistent" }) },
    )

    expect(res.status).toBe(404)
  })

  it("returns profile data when user exists", async () => {
    prismaMock.userProfile.findUnique.mockResolvedValue({
      user: {
        id: "u1",
        name: "Maria Silva",
        displayName: "Maria",
        avatar: "https://r2.test/avatar.webp",
        plan: "FREE",
        birthDate: new Date("1990-06-15"),
        astrologicalSign: "Gêmeos",
        mayanKin: "123",
        personalArcana: 5,
      },
      username: "maria_silva",
      bio: "Apaixonada por tarot",
      location: "São Paulo",
      privacy: {
        profileVisibility: "public",
        statsVisibility: "public",
        arcanaVisibility: "public",
      },
    })

    const res = await GET(
      new Request("http://localhost/api/v1/users/maria_silva/profile"),
      { params: Promise.resolve({ username: "maria_silva" }) },
    )
    const body = (await res.json()) as Record<string, unknown>

    expect(res.status).toBe(200)
    expect(body.username).toBe("maria_silva")
    expect(body.name).toBe("Maria Silva")
  })

  it("returns 422 for invalid username", async () => {
    const res = await GET(
      new Request("http://localhost/api/v1/users/ab/profile"),
      { params: Promise.resolve({ username: "ab" }) },
    )

    expect(res.status).toBe(422)
  })
})
