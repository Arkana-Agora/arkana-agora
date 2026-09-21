import { beforeEach, describe, expect, it, vi } from "vitest"

const prismaMock = vi.hoisted(() => ({
  userProfile: { findUnique: vi.fn() },
}))

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }))

import { GET } from "@/app/api/v1/users/check-username/[username]/route"

describe("GET /api/v1/users/check-username/:username", () => {
  beforeEach(() => {
    prismaMock.userProfile.findUnique.mockReset()
  })

  it("returns available: true when username is not taken", async () => {
    prismaMock.userProfile.findUnique.mockResolvedValue(null)

    const res = await GET(
      new Request("http://localhost/api/v1/users/check-username/maria123"),
      { params: Promise.resolve({ username: "maria123" }) },
    )
    const body = (await res.json()) as { available: boolean }

    expect(res.status).toBe(200)
    expect(body.available).toBe(true)
  })

  it("returns available: false when username is taken", async () => {
    prismaMock.userProfile.findUnique.mockResolvedValue({
      id: "1",
      username: "maria123",
    })

    const res = await GET(
      new Request("http://localhost/api/v1/users/check-username/maria123"),
      { params: Promise.resolve({ username: "maria123" }) },
    )
    const body = (await res.json()) as { available: boolean }

    expect(res.status).toBe(200)
    expect(body.available).toBe(false)
  })

  it("rejects username shorter than 3 characters", async () => {
    const res = await GET(
      new Request("http://localhost/api/v1/users/check-username/ab"),
      { params: Promise.resolve({ username: "ab" }) },
    )

    expect(res.status).toBe(422)
  })
})
