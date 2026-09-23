import { beforeEach, describe, expect, it, vi } from "vitest"

const prismaMock = vi.hoisted(() => ({
  userProfile: { findUnique: vi.fn(), update: vi.fn(), upsert: vi.fn() },
}))
const tokenServiceMock = vi.hoisted(() => ({
  verifyAccessToken: vi.fn(),
}))

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }))
vi.mock("@/services/token-service", () => tokenServiceMock)

import { PATCH } from "@/app/api/v1/users/me/privacy/route"

function privacyRequest(body: unknown, token = "Bearer valid-token"): Request {
  return new Request("http://localhost/api/v1/users/me/privacy", {
    method: "PATCH",
    headers: {
      ...(token ? { Authorization: token } : {}),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  })
}

describe("PATCH /api/v1/users/me/privacy", () => {
  beforeEach(() => {
    prismaMock.userProfile.findUnique.mockReset()
    prismaMock.userProfile.update.mockReset()
    prismaMock.userProfile.upsert.mockReset()
    tokenServiceMock.verifyAccessToken.mockReset()
  })

  it("returns 401 without bearer token", async () => {
    const res = await PATCH(
      privacyRequest({ profileVisibility: "private" }, ""),
    )
    expect(res.status).toBe(401)
  })

  it("returns 422 for invalid body", async () => {
    tokenServiceMock.verifyAccessToken.mockResolvedValue({ userId: "u1" })
    const res = await PATCH(privacyRequest({ profileVisibility: "secret" }))
    expect(res.status).toBe(422)
    const body = (await res.json()) as { error?: { code?: string } }
    expect(body.error?.code).toBe("VALIDATION_ERROR")
  })

  it("returns 422 for malformed JSON", async () => {
    tokenServiceMock.verifyAccessToken.mockResolvedValue({ userId: "u1" })
    const res = await PATCH(
      new Request("http://localhost/api/v1/users/me/privacy", {
        method: "PATCH",
        headers: {
          Authorization: "Bearer valid-token",
          "Content-Type": "application/json",
        },
        body: "{not-json",
      }),
    )
    expect(res.status).toBe(422)
  })

  it("merges privacy settings with existing object", async () => {
    tokenServiceMock.verifyAccessToken.mockResolvedValue({ userId: "u1" })
    prismaMock.userProfile.findUnique.mockResolvedValue({
      privacy: { profileVisibility: "public", statsVisibility: "public" },
    })
    prismaMock.userProfile.upsert.mockResolvedValue({})

    const res = await PATCH(
      privacyRequest({
        profileVisibility: "private",
        whoCanFollow: "nobody",
      }),
    )
    const body = (await res.json()) as Record<string, unknown>

    expect(res.status).toBe(200)
    expect(body.message).toBe("Privacidade atualizada")
    expect(prismaMock.userProfile.upsert).toHaveBeenCalledWith({
      where: { userId: "u1" },
      create: {
        userId: "u1",
        privacy: {
          profileVisibility: "private",
          statsVisibility: "public",
          whoCanFollow: "nobody",
        },
      },
      update: {
        privacy: {
          profileVisibility: "private",
          statsVisibility: "public",
          whoCanFollow: "nobody",
        },
      },
    })
  })

  it("works when profile has no privacy yet", async () => {
    tokenServiceMock.verifyAccessToken.mockResolvedValue({ userId: "u1" })
    prismaMock.userProfile.findUnique.mockResolvedValue({ privacy: null })
    prismaMock.userProfile.upsert.mockResolvedValue({})

    const res = await PATCH(privacyRequest({ whoCanComment: "following" }))
    expect(res.status).toBe(200)
    expect(prismaMock.userProfile.upsert).toHaveBeenCalledWith({
      where: { userId: "u1" },
      create: { userId: "u1", privacy: { whoCanComment: "following" } },
      update: { privacy: { whoCanComment: "following" } },
    })
  })

  it("accepts all valid privacy fields", async () => {
    tokenServiceMock.verifyAccessToken.mockResolvedValue({ userId: "u1" })
    prismaMock.userProfile.findUnique.mockResolvedValue({ privacy: {} })
    prismaMock.userProfile.upsert.mockResolvedValue({})

    const res = await PATCH(
      privacyRequest({
        profileVisibility: "private",
        statsVisibility: "private",
        arcanaVisibility: "public",
        whoCanFollow: "following",
        whoCanComment: "all",
      }),
    )
    expect(res.status).toBe(200)
    expect(prismaMock.userProfile.upsert).toHaveBeenCalledWith({
      where: { userId: "u1" },
      create: {
        userId: "u1",
        privacy: {
          profileVisibility: "private",
          statsVisibility: "private",
          arcanaVisibility: "public",
          whoCanFollow: "following",
          whoCanComment: "all",
        },
      },
      update: {
        privacy: {
          profileVisibility: "private",
          statsVisibility: "private",
          arcanaVisibility: "public",
          whoCanFollow: "following",
          whoCanComment: "all",
        },
      },
    })
  })

  it("returns 500 on unexpected prisma error", async () => {
    tokenServiceMock.verifyAccessToken.mockResolvedValue({ userId: "u1" })
    prismaMock.userProfile.findUnique.mockResolvedValue({ privacy: {} })
    prismaMock.userProfile.upsert.mockRejectedValue(new Error("db down"))

    const res = await PATCH(privacyRequest({ profileVisibility: "private" }))
    expect(res.status).toBe(500)
  })
})
