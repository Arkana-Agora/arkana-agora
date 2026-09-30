import { beforeEach, describe, expect, it, vi } from "vitest"

const prismaMock = vi.hoisted(() => ({
  user: { findUnique: vi.fn() },
}))

const tokenServiceMock = vi.hoisted(() => ({
  verifyAccessToken: vi.fn(),
}))

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }))
vi.mock("@/services/token-service", () => tokenServiceMock)
vi.mock("@/lib/logger", () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}))

import { requireAuth } from "@/app/api/v1/users/_helpers"

function requestWithToken(): Request {
  return new Request("http://localhost/api/v1/users/me/profile", {
    headers: { authorization: "Bearer token-valido" },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  tokenServiceMock.verifyAccessToken.mockResolvedValue({
    userId: "usr_1",
    accessToken: "token-valido",
  })
  prismaMock.user.findUnique.mockResolvedValue({
    isBanned: false,
    deletedAt: null,
    isActive: true,
  })
})

describe("requireAuth (review: isBanned/deletedAt nunca checados)", () => {
  it("conta ativa → { userId }", async () => {
    const result = await requireAuth(requestWithToken(), "req-1")
    expect(result).toEqual({ userId: "usr_1" })
    expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
      where: { id: "usr_1" },
      select: { isBanned: true, deletedAt: true, isActive: true },
    })
  })

  it("conta inativa (isActive=false, sem deletedAt) → 401", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      isBanned: false,
      deletedAt: null,
      isActive: false,
    })

    const result = await requireAuth(requestWithToken(), "req-6")

    expect(result).toBeInstanceOf(Response)
    expect((result as Response).status).toBe(401)
    const body = await (result as Response).json()
    expect(body.error.code).toBe("AUTH_TOKEN_INVALID")
  })

  it("conta banida → 403 AUTH_ACCOUNT_SUSPENDED", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      isBanned: true,
      deletedAt: null,
    })

    const result = await requireAuth(requestWithToken(), "req-2")

    expect(result).toBeInstanceOf(Response)
    const response = result as Response
    expect(response.status).toBe(403)
    const body = await response.json()
    expect(body.error.code).toBe("AUTH_ACCOUNT_SUSPENDED")
    expect(body.meta.requestId).toBe("req-2")
  })

  it("soft-deleted (janela LGPD) → 401", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      isBanned: false,
      deletedAt: new Date("2026-09-01T00:00:00Z"),
    })

    const result = await requireAuth(requestWithToken(), "req-3")

    expect(result).toBeInstanceOf(Response)
    expect((result as Response).status).toBe(401)
    const body = await (result as Response).json()
    expect(body.error.code).toBe("AUTH_TOKEN_INVALID")
  })

  it("usuário inexistente (hard delete) → 401", async () => {
    prismaMock.user.findUnique.mockResolvedValue(null)

    const result = await requireAuth(requestWithToken(), "req-4")

    expect(result).toBeInstanceOf(Response)
    expect((result as Response).status).toBe(401)
  })

  it("falha do lookup de estado (DB fora) → 503 fail-closed, nunca 200/401", async () => {
    prismaMock.user.findUnique.mockRejectedValue(new Error("db pool agotado"))

    const result = await requireAuth(requestWithToken(), "req-5")

    expect(result).toBeInstanceOf(Response)
    const response = result as Response
    expect(response.status).toBe(503)
    const body = await response.json()
    expect(body.error.code).toBe("SERVICE_UNAVAILABLE")
    expect(body.meta.requestId).toBe("req-5")
  })
})
