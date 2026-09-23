import { beforeEach, describe, expect, it, vi } from "vitest"

const prismaMock = vi.hoisted(() => ({
  user: { findUnique: vi.fn(), update: vi.fn() },
}))
const tokenServiceMock = vi.hoisted(() => ({
  verifyAccessToken: vi.fn(),
}))
const r2Mock = vi.hoisted(() => ({
  generatePresignedUrl: vi.fn(),
  getObjectBuffer: vi.fn(),
  putObjectBuffer: vi.fn(),
  deleteObject: vi.fn(),
  R2_PUBLIC_URL: "https://r2.test",
}))
const sharpMock = vi.hoisted(() => {
  const chain = {
    rotate: () => chain,
    resize: () => chain,
    webp: () => chain,
    toBuffer: async () => Buffer.from("webp-variant"),
  }
  return vi.fn(() => chain)
})

process.env.R2_PUBLIC_URL = process.env.R2_PUBLIC_URL ?? "https://r2.test"

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }))
vi.mock("@/services/token-service", () => tokenServiceMock)
vi.mock("@/lib/r2", () => r2Mock)
vi.mock("sharp", () => ({ default: sharpMock }))

import { POST as presignPOST } from "@/app/api/v1/users/me/avatar/presign/route"
import { PATCH as confirmPATCH } from "@/app/api/v1/users/me/avatar/confirm/route"
import { DELETE as avatarDELETE } from "@/app/api/v1/users/me/avatar/route"

function authRequest(method: string, path: string, body?: unknown): Request {
  const init: RequestInit = {
    method,
    headers: {
      Authorization: "Bearer valid-token",
      "Content-Type": "application/json",
    },
  }
  if (body !== undefined) {
    init.body = JSON.stringify(body)
  }
  return new Request(`http://localhost${path}`, init)
}

describe("POST /api/v1/users/me/avatar/presign", () => {
  beforeEach(() => {
    prismaMock.user.findUnique.mockReset()
    prismaMock.user.update.mockReset()
    tokenServiceMock.verifyAccessToken.mockReset()
    r2Mock.generatePresignedUrl.mockReset()
    r2Mock.getObjectBuffer.mockReset()
    r2Mock.putObjectBuffer.mockReset()
    r2Mock.deleteObject.mockReset()
    sharpMock.mockClear()
  })

  it("returns 401 without bearer token", async () => {
    const res = await presignPOST(
      new Request("http://localhost/api/v1/users/me/avatar/presign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentType: "image/png" }),
      }),
    )
    expect(res.status).toBe(401)
  })

  it("returns 422 for unsupported contentType", async () => {
    tokenServiceMock.verifyAccessToken.mockResolvedValue({ userId: "u1" })
    const res = await presignPOST(
      authRequest("POST", "/api/v1/users/me/avatar/presign", {
        contentType: "image/gif",
      }),
    )
    expect(res.status).toBe(422)
  })

  it("returns uploadUrl and key for valid contentType", async () => {
    tokenServiceMock.verifyAccessToken.mockResolvedValue({ userId: "u1" })
    r2Mock.generatePresignedUrl.mockResolvedValue("https://r2.test/presigned")

    const res = await presignPOST(
      authRequest("POST", "/api/v1/users/me/avatar/presign", {
        contentType: "image/png",
      }),
    )
    const body = (await res.json()) as Record<string, unknown>

    expect(res.status).toBe(200)
    expect(body.uploadUrl).toBe("https://r2.test/presigned")
    expect(String(body.key)).toMatch(/^avatars\/u1\//)
    expect(r2Mock.generatePresignedUrl).toHaveBeenCalledOnce()
  })

  it("returns 500 when presign generation fails", async () => {
    tokenServiceMock.verifyAccessToken.mockResolvedValue({ userId: "u1" })
    r2Mock.generatePresignedUrl.mockRejectedValue(new Error("r2 down"))

    const res = await presignPOST(
      authRequest("POST", "/api/v1/users/me/avatar/presign", {
        contentType: "image/jpeg",
      }),
    )
    expect(res.status).toBe(500)
  })
})

describe("PATCH /api/v1/users/me/avatar/confirm", () => {
  beforeEach(() => {
    prismaMock.user.findUnique.mockReset()
    prismaMock.user.update.mockReset()
    tokenServiceMock.verifyAccessToken.mockReset()
    r2Mock.generatePresignedUrl.mockReset()
    r2Mock.getObjectBuffer.mockReset()
    r2Mock.putObjectBuffer.mockReset()
    r2Mock.deleteObject.mockReset()
    sharpMock.mockClear()
  })

  it("returns 401 without bearer token", async () => {
    const res = await confirmPATCH(
      new Request("http://localhost/api/v1/users/me/avatar/confirm", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileKey: "avatars/u1/x.png" }),
      }),
    )
    expect(res.status).toBe(401)
  })

  it("returns 422 when fileKey missing", async () => {
    tokenServiceMock.verifyAccessToken.mockResolvedValue({ userId: "u1" })
    const res = await confirmPATCH(
      authRequest("PATCH", "/api/v1/users/me/avatar/confirm", {}),
    )
    expect(res.status).toBe(422)
  })

  it("returns 422 for path traversal in fileKey", async () => {
    tokenServiceMock.verifyAccessToken.mockResolvedValue({ userId: "u1" })
    const res = await confirmPATCH(
      authRequest("PATCH", "/api/v1/users/me/avatar/confirm", {
        fileKey: "avatars/u1/../../secrets.png",
      }),
    )
    expect(res.status).toBe(422)
  })

  it("returns 422 when fileKey belongs to another user", async () => {
    tokenServiceMock.verifyAccessToken.mockResolvedValue({ userId: "u1" })
    const res = await confirmPATCH(
      authRequest("PATCH", "/api/v1/users/me/avatar/confirm", {
        fileKey: "avatars/u2/photo.png",
      }),
    )
    expect(res.status).toBe(422)
  })

  it("returns 422 when original exceeds 5MB", async () => {
    tokenServiceMock.verifyAccessToken.mockResolvedValue({ userId: "u1" })
    r2Mock.getObjectBuffer.mockResolvedValue(Buffer.alloc(5 * 1024 * 1024 + 1))

    const res = await confirmPATCH(
      authRequest("PATCH", "/api/v1/users/me/avatar/confirm", {
        fileKey: "avatars/u1/big.png",
      }),
    )
    expect(res.status).toBe(422)
  })

  it("returns 422 for unsupported extension", async () => {
    tokenServiceMock.verifyAccessToken.mockResolvedValue({ userId: "u1" })
    r2Mock.getObjectBuffer.mockResolvedValue(Buffer.from("data"))
    const res = await confirmPATCH(
      authRequest("PATCH", "/api/v1/users/me/avatar/confirm", {
        fileKey: "avatars/u1/anim.gif",
      }),
    )
    expect(res.status).toBe(422)
  })

  it("processes image with sharp, uploads variants, updates user, deletes original", async () => {
    tokenServiceMock.verifyAccessToken.mockResolvedValue({ userId: "u1" })
    r2Mock.getObjectBuffer.mockResolvedValue(Buffer.from("original-png"))
    r2Mock.putObjectBuffer.mockResolvedValue(undefined)
    r2Mock.deleteObject.mockResolvedValue(undefined)
    prismaMock.user.update.mockResolvedValue({})

    const res = await confirmPATCH(
      authRequest("PATCH", "/api/v1/users/me/avatar/confirm", {
        fileKey: "avatars/u1/photo-123.png",
      }),
    )
    const body = (await res.json()) as Record<string, unknown>

    expect(res.status).toBe(200)
    expect(sharpMock).toHaveBeenCalledTimes(3)
    expect(r2Mock.putObjectBuffer).toHaveBeenCalledTimes(3)
    expect(r2Mock.putObjectBuffer).toHaveBeenCalledWith(
      expect.stringContaining("-48-"),
      expect.any(Buffer),
      "image/webp",
    )
    expect(String(body.avatarUrl)).toContain("-400-")
    expect(String(body.avatarUrl)).toContain("https://r2.test/")
    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { id: "u1" },
      data: { avatar: body.avatarUrl },
    })
    expect(r2Mock.deleteObject).toHaveBeenCalledWith("avatars/u1/photo-123.png")
  })

  it("returns 500 and keeps previous avatar when processing fails twice", async () => {
    tokenServiceMock.verifyAccessToken.mockResolvedValue({ userId: "u1" })
    r2Mock.getObjectBuffer.mockResolvedValue(Buffer.from("corrupt"))
    sharpMock.mockImplementation(() => {
      throw new Error("corrupt image")
    })

    const res = await confirmPATCH(
      authRequest("PATCH", "/api/v1/users/me/avatar/confirm", {
        fileKey: "avatars/u1/bad.png",
      }),
    )
    const body = (await res.json()) as { error?: { message?: string } }

    expect(res.status).toBe(500)
    expect(body.error?.message).toContain("Avatar anterior mantido")
    expect(prismaMock.user.update).not.toHaveBeenCalled()
    expect(sharpMock).toHaveBeenCalledTimes(6)
  })
})

describe("DELETE /api/v1/users/me/avatar", () => {
  beforeEach(() => {
    prismaMock.user.findUnique.mockReset()
    prismaMock.user.update.mockReset()
    tokenServiceMock.verifyAccessToken.mockReset()
    r2Mock.deleteObject.mockReset()
  })

  it("returns 401 without bearer token", async () => {
    const res = await avatarDELETE(
      new Request("http://localhost/api/v1/users/me/avatar", {
        method: "DELETE",
      }),
    )
    expect(res.status).toBe(401)
  })

  it("clears avatar and deletes R2 object", async () => {
    tokenServiceMock.verifyAccessToken.mockResolvedValue({ userId: "u1" })
    prismaMock.user.findUnique.mockResolvedValue({
      avatar: "https://r2.test/avatars/u1/photo.webp",
    })
    r2Mock.deleteObject.mockResolvedValue(undefined)
    prismaMock.user.update.mockResolvedValue({})

    const res = await avatarDELETE(
      authRequest("DELETE", "/api/v1/users/me/avatar"),
    )
    const body = (await res.json()) as Record<string, unknown>

    expect(res.status).toBe(200)
    expect(body.message).toBe("Avatar removido")
    expect(r2Mock.deleteObject).toHaveBeenCalledWith("avatars/u1/photo.webp")
    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { id: "u1" },
      data: { avatar: null },
    })
  })

  it("still clears avatar when R2 delete fails", async () => {
    tokenServiceMock.verifyAccessToken.mockResolvedValue({ userId: "u1" })
    prismaMock.user.findUnique.mockResolvedValue({
      avatar: "https://r2.test/avatars/u1/old.webp",
    })
    r2Mock.deleteObject.mockRejectedValue(new Error("already gone"))
    prismaMock.user.update.mockResolvedValue({})

    const res = await avatarDELETE(
      authRequest("DELETE", "/api/v1/users/me/avatar"),
    )
    expect(res.status).toBe(200)
    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { id: "u1" },
      data: { avatar: null },
    })
  })

  it("clears avatar even when user has none", async () => {
    tokenServiceMock.verifyAccessToken.mockResolvedValue({ userId: "u1" })
    prismaMock.user.findUnique.mockResolvedValue({ avatar: null })
    prismaMock.user.update.mockResolvedValue({})

    const res = await avatarDELETE(
      authRequest("DELETE", "/api/v1/users/me/avatar"),
    )
    expect(res.status).toBe(200)
    expect(r2Mock.deleteObject).not.toHaveBeenCalled()
  })
})
