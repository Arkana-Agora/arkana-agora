import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const prismaMock = vi.hoisted(() => ({
  userProfile: { findUnique: vi.fn() },
  follow: { findFirst: vi.fn() },
}))

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }))

import { canFollow } from "@/lib/social/privacy"

const viewer = { id: "usr_viewer" }
const target = { id: "usr_target" }

function profileWithPrivacy(privacy: unknown) {
  return { userId: target.id, privacy }
}

beforeEach(() => {
  vi.clearAllMocks()
  prismaMock.userProfile.findUnique.mockResolvedValue(null)
  prismaMock.follow.findFirst.mockResolvedValue(null)
})

afterEach(() => {
  vi.resetModules()
})

describe("canFollow (T049/S2-14)", () => {
  it("permite quando o alvo nao tem UserProfile", async () => {
    prismaMock.userProfile.findUnique.mockResolvedValue(null)
    await expect(canFollow(viewer, target)).resolves.toEqual({ allowed: true })
  })

  it("permite quando o perfil existe mas privacy e null", async () => {
    prismaMock.userProfile.findUnique.mockResolvedValue(
      profileWithPrivacy(null),
    )
    await expect(canFollow(viewer, target)).resolves.toEqual({ allowed: true })
  })

  it("permite quando privacy nao define whoCanFollow (default all)", async () => {
    prismaMock.userProfile.findUnique.mockResolvedValue(
      profileWithPrivacy({ profileVisibility: "public" }),
    )
    await expect(canFollow(viewer, target)).resolves.toEqual({ allowed: true })
  })

  it("permite whoCanFollow=all", async () => {
    prismaMock.userProfile.findUnique.mockResolvedValue(
      profileWithPrivacy({ whoCanFollow: "all" }),
    )
    await expect(canFollow(viewer, target)).resolves.toEqual({ allowed: true })
  })

  it("bloqueia whoCanFollow=nobody com reason privacy_nobody", async () => {
    prismaMock.userProfile.findUnique.mockResolvedValue(
      profileWithPrivacy({ whoCanFollow: "nobody" }),
    )
    await expect(canFollow(viewer, target)).resolves.toEqual({
      allowed: false,
      reason: "privacy_nobody",
    })
    expect(prismaMock.follow.findFirst).not.toHaveBeenCalled()
  })

  it("bloqueia com reason privacy_invalid quando privacy JSON e invalido", async () => {
    prismaMock.userProfile.findUnique.mockResolvedValue(
      profileWithPrivacy("not a valid object"),
    )
    await expect(canFollow(viewer, target)).resolves.toEqual({
      allowed: false,
      reason: "privacy_invalid",
    })
    expect(prismaMock.follow.findFirst).not.toHaveBeenCalled()
  })

  it("whoCanFollow=following: permite quando o alvo ja segue o atual", async () => {
    prismaMock.userProfile.findUnique.mockResolvedValue(
      profileWithPrivacy({ whoCanFollow: "following" }),
    )
    prismaMock.follow.findFirst.mockResolvedValue({ id: "flw_1" })
    await expect(canFollow(viewer, target)).resolves.toEqual({ allowed: true })
    expect(prismaMock.follow.findFirst).toHaveBeenCalledWith({
      where: { followerId: target.id, followingId: viewer.id },
      select: { id: true },
    })
  })

  it("whoCanFollow=following: bloqueia com reason privacy_following quando o alvo nao segue o atual", async () => {
    prismaMock.userProfile.findUnique.mockResolvedValue(
      profileWithPrivacy({ whoCanFollow: "following" }),
    )
    prismaMock.follow.findFirst.mockResolvedValue(null)
    await expect(canFollow(viewer, target)).resolves.toEqual({
      allowed: false,
      reason: "privacy_following",
    })
  })
})
