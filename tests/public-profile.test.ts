import { beforeEach, describe, expect, it, vi } from "vitest"

const prismaMock = vi.hoisted(() => ({
  userProfile: { findUnique: vi.fn() },
  follow: { count: vi.fn(), findUnique: vi.fn() },
}))

const helpersMock = vi.hoisted(() => ({
  optionalAuth: vi.fn(),
}))

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }))
vi.mock("@/app/api/v1/users/_helpers", () => helpersMock)

import { GET } from "@/app/api/v1/users/[username]/profile/route"

function buildProfileData(overrides: Record<string, unknown> = {}) {
  return {
    userId: "u1",
    username: "maria_silva",
    bio: "Apaixonada por tarot",
    location: "São Paulo",
    privacy: {
      profileVisibility: "public",
      statsVisibility: "public",
      arcanaVisibility: "public",
      whoCanFollow: "all",
      whoCanComment: "all",
    },
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
      isBanned: false,
      deletedAt: null,
      isActive: true,
    },
    ...overrides,
  }
}

describe("GET /api/v1/users/:username/profile", () => {
  beforeEach(() => {
    prismaMock.userProfile.findUnique.mockReset()
    prismaMock.follow.count.mockReset().mockResolvedValue(0)
    prismaMock.follow.findUnique.mockReset().mockResolvedValue(null)
    helpersMock.optionalAuth.mockReset().mockResolvedValue(null)
    prismaMock.userProfile.findUnique.mockResolvedValue(buildProfileData())
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

  it("returns 500 JSON envelope when DB fails", async () => {
    prismaMock.userProfile.findUnique.mockRejectedValue(new Error("db down"))

    const res = await GET(
      new Request("http://localhost/api/v1/users/maria_silva/profile"),
      { params: Promise.resolve({ username: "maria_silva" }) },
    )
    const body = (await res.json()) as {
      error?: { code?: string }
      meta?: { requestId?: string }
    }

    expect(res.status).toBe(500)
    expect(body.error?.code).toBe("INTERNAL_ERROR")
    expect(typeof body.meta?.requestId).toBe("string")
  })

  it("includes Cache-Control: private, no-store and Vary: Authorization", async () => {
    const res = await GET(
      new Request("http://localhost/api/v1/users/maria_silva/profile"),
      { params: Promise.resolve({ username: "maria_silva" }) },
    )

    expect(res.status).toBe(200)
    expect(res.headers.get("Cache-Control")).toBe("private, no-store")
    expect(res.headers.get("Vary")).toBe("Authorization")
  })

  function mockMariaProfile(overrides: Record<string, unknown> = {}) {
    prismaMock.userProfile.findUnique.mockResolvedValue(
      buildProfileData(overrides),
    )
  }

  it("T046: inclui followersCount e followingCount no root (S2-18)", async () => {
    mockMariaProfile()
    prismaMock.follow.count.mockImplementation(
      (args: { where: { followingId?: string } }) =>
        args.where.followingId === "u1" ? 156 : 89,
    )

    const res = await GET(
      new Request("http://localhost/api/v1/users/maria_silva/profile"),
      { params: Promise.resolve({ username: "maria_silva" }) },
    )
    const body = (await res.json()) as Record<string, unknown>

    expect(res.status).toBe(200)
    expect(body.followersCount).toBe(156)
    expect(body.followingCount).toBe(89)
    expect(prismaMock.follow.count).toHaveBeenNthCalledWith(1, {
      where: {
        followerId: "u1",
        following: { isActive: true, isBanned: false, deletedAt: null },
      },
    })
    expect(prismaMock.follow.count).toHaveBeenNthCalledWith(2, {
      where: {
        followingId: "u1",
        follower: { isActive: true, isBanned: false, deletedAt: null },
      },
    })
  })

  it("T046: inclui isFollowing=true quando autenticado e seguindo", async () => {
    mockMariaProfile()
    helpersMock.optionalAuth.mockResolvedValue("u2")
    prismaMock.follow.findUnique.mockResolvedValue({
      id: "flw_1",
      followerId: "u2",
      followingId: "u1",
    })

    const res = await GET(
      new Request("http://localhost/api/v1/users/maria_silva/profile", {
        headers: { Authorization: "Bearer token" },
      }),
      { params: Promise.resolve({ username: "maria_silva" }) },
    )
    const body = (await res.json()) as Record<string, unknown>

    expect(res.status).toBe(200)
    expect(body.isFollowing).toBe(true)
    expect(prismaMock.follow.findUnique).toHaveBeenCalledWith({
      where: {
        followerId_followingId: { followerId: "u2", followingId: "u1" },
      },
      select: { id: true },
    })
  })

  it("T046: omite isFollowing sem autenticacao", async () => {
    mockMariaProfile()

    const res = await GET(
      new Request("http://localhost/api/v1/users/maria_silva/profile"),
      { params: Promise.resolve({ username: "maria_silva" }) },
    )
    const body = (await res.json()) as Record<string, unknown>

    expect(res.status).toBe(200)
    expect(body).not.toHaveProperty("isFollowing")
    expect(prismaMock.follow.findUnique).not.toHaveBeenCalled()
  })

  it("SC38/Q1: statsVisibility private omite contadores de nao-dono", async () => {
    mockMariaProfile({
      privacy: { statsVisibility: "private" },
    })

    const res = await GET(
      new Request("http://localhost/api/v1/users/maria_silva/profile"),
      { params: Promise.resolve({ username: "maria_silva" }) },
    )
    const body = (await res.json()) as Record<string, unknown>

    expect(res.status).toBe(200)
    expect(body).not.toHaveProperty("followersCount")
    expect(body).not.toHaveProperty("followingCount")
    expect(prismaMock.follow.count).not.toHaveBeenCalled()
  })

  it("SC38/Q1: statsVisibility private — o dono autenticado ve os contadores", async () => {
    mockMariaProfile({
      privacy: { statsVisibility: "private" },
    })
    helpersMock.optionalAuth.mockResolvedValue("u1")
    prismaMock.follow.count.mockResolvedValue(7)

    const res = await GET(
      new Request("http://localhost/api/v1/users/maria_silva/profile", {
        headers: { Authorization: "Bearer token" },
      }),
      { params: Promise.resolve({ username: "maria_silva" }) },
    )
    const body = (await res.json()) as Record<string, unknown>

    expect(res.status).toBe(200)
    expect(body.followersCount).toBe(7)
    expect(body.followingCount).toBe(7)
  })
})
