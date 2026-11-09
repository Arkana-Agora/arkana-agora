import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const prismaMock = vi.hoisted(() => ({
  userProfile: {
    findUnique: vi.fn(),
  },
}))

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }))

const tokenServiceMock = vi.hoisted(() => ({
  verifyAccessToken: vi.fn().mockResolvedValue({ userId: "usr_sender" }),
}))

vi.mock("@/services/token-service", () => ({
  verifyAccessToken: tokenServiceMock.verifyAccessToken,
}))

function tokenError(code: string): Error {
  const err = new Error(`${code}: teste`)
  err.name = "AuthTokenError"
  ;(err as { code?: string }).code = code
  return err
}

const sender = {
  id: "usr_sender",
  name: "Maria Silva",
  email: "maria@email.com",
  subscriptionTier: "FREE",
  profile: {
    versosBalance: 1000,
    versosStreak: 5,
    lastClaimAt: new Date("2026-01-15T10:00:00Z"),
  },
}

async function callGet(token = "Bearer test-token"): Promise<Response> {
  const { GET } = await import("@/app/api/v1/social/versos/balance/route")
  return GET(
    new Request("http://localhost:3000/api/v1/social/versos/balance", {
      method: "GET",
      headers: { authorization: token },
    }),
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  prismaMock.userProfile.findUnique.mockResolvedValue(sender.profile)
})

afterEach(() => {
  vi.resetModules()
})

describe("GET /api/v1/social/versos/balance (T121)", () => {
  it("retorna saldo, streak e lastClaimAt do perfil", async () => {
    const res = await callGet()
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json).toEqual({
      balance: 1000,
      dailyEarned: 0,
      streak: 5,
      lastClaimAt: "2026-01-15T10:00:00.000Z",
    })
    expect(prismaMock.userProfile.findUnique).toHaveBeenCalledWith({
      where: { userId: "usr_sender" },
      select: { versosBalance: true, versosStreak: true, lastClaimAt: true },
    })
  })

  it("retorna 401 quando nao autenticado", async () => {
    tokenServiceMock.verifyAccessToken.mockRejectedValueOnce(
      tokenError("AUTH_TOKEN_INVALID"),
    )

    const res = await callGet("Bearer invalid")
    const json = await res.json()

    expect(res.status).toBe(401)
    expect(json.error.code).toBe("AUTH_TOKEN_INVALID")
  })

  it("retorna 401 quando token expirado", async () => {
    tokenServiceMock.verifyAccessToken.mockRejectedValueOnce(
      tokenError("AUTH_TOKEN_EXPIRED"),
    )

    const res = await callGet("Bearer expired")
    const json = await res.json()

    expect(res.status).toBe(401)
    expect(json.error.code).toBe("AUTH_TOKEN_EXPIRED")
  })

  it("retorna 404 quando perfil nao encontrado", async () => {
    prismaMock.userProfile.findUnique.mockResolvedValue(null)

    const res = await callGet()
    const json = await res.json()

    expect(res.status).toBe(404)
    expect(json.error.code).toBe("NOT_FOUND")
  })

  it("inclui meta.requestId nas respostas de erro", async () => {
    prismaMock.userProfile.findUnique.mockResolvedValue(null)

    const res = await callGet()
    const json = await res.json()

    expect(res.status).toBe(404)
    expect(json.meta.requestId).toBeTruthy()
    expect(typeof json.meta.requestId).toBe("string")
  })
})
