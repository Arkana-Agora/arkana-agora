import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const prismaMock = vi.hoisted(() => ({
  userProfile: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
}))

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }))

const tokenServiceMock = vi.hoisted(() => ({
  verifyAccessToken: vi.fn().mockResolvedValue({ userId: "usr_sender" }),
}))

vi.mock("@/services/token-service", () => ({
  verifyAccessToken: tokenServiceMock.verifyAccessToken,
}))

const csrfMock = vi.hoisted(() => ({
  enforceCsrf: vi.fn().mockReturnValue(null),
}))

vi.mock("@/lib/middleware/csrf", () => ({
  enforceCsrf: csrfMock.enforceCsrf,
}))

function tokenError(code: string): Error {
  const err = new Error(`${code}: teste`)
  err.name = "AuthTokenError"
  ;(err as { code?: string }).code = code
  return err
}

const profileBase = {
  versosBalance: 100,
  versosStreak: 0,
  lastClaimAt: null,
}

async function callPost(token = "Bearer test-token"): Promise<Response> {
  const { POST } = await import("@/app/api/v1/social/versos/claim-daily/route")
  return POST(
    new Request("http://localhost:3000/api/v1/social/versos/claim-daily", {
      method: "POST",
      headers: { authorization: token },
    }),
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  prismaMock.userProfile.findUnique.mockResolvedValue({ ...profileBase })
  prismaMock.userProfile.update.mockResolvedValue({
    ...profileBase,
    versosBalance: 110,
    versosStreak: 1,
  })
})

afterEach(() => {
  vi.resetModules()
})

describe("POST /api/v1/social/versos/claim-daily (T122)", () => {
  it("claim diario basico: +10 versos, streak=1, atualiza lastClaimAt", async () => {
    const res = await callPost()
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json).toEqual(
      expect.objectContaining({
        message: "Claim diario realizado",
        earned: 10,
        newBalance: 110,
        streak: 1,
      }),
    )
    expect(prismaMock.userProfile.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "usr_sender" },
        data: expect.objectContaining({
          versosBalance: { increment: 10 },
          versosStreak: 1,
          lastClaimAt: expect.any(Date),
        }),
      }),
    )
  })

  it("streak incrementa corretamente (dia 2 → streak=2)", async () => {
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)

    prismaMock.userProfile.findUnique.mockResolvedValue({
      ...profileBase,
      versosStreak: 1,
      lastClaimAt: yesterday,
    })
    prismaMock.userProfile.update.mockResolvedValue({
      ...profileBase,
      versosBalance: 120,
      versosStreak: 2,
    })

    const res = await callPost()
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.streak).toBe(2)
    expect(json.earned).toBe(10)
    expect(prismaMock.userProfile.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          versosStreak: 2,
        }),
      }),
    )
  })

  it("streak reseta se perdeu um dia (gap > 24h)", async () => {
    prismaMock.userProfile.findUnique.mockResolvedValue({
      ...profileBase,
      versosStreak: 5,
      lastClaimAt: new Date(Date.now() - 48 * 60 * 60 * 1000),
    })

    const res = await callPost()
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.streak).toBe(1)
    expect(json.earned).toBe(10)
  })

  it("milestone dia 7: +50 bonus (total 60)", async () => {
    prismaMock.userProfile.findUnique.mockResolvedValue({
      ...profileBase,
      versosStreak: 6,
      lastClaimAt: new Date(Date.now() - 25 * 60 * 60 * 1000),
    })
    prismaMock.userProfile.update.mockResolvedValue({
      ...profileBase,
      versosBalance: 160,
      versosStreak: 7,
    })

    const res = await callPost()
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.streak).toBe(7)
    expect(json.earned).toBe(60)
    expect(json.newBalance).toBe(160)
  })

  it("milestone dia 30: +200 bonus (total 210)", async () => {
    prismaMock.userProfile.findUnique.mockResolvedValue({
      ...profileBase,
      versosStreak: 29,
      lastClaimAt: new Date(Date.now() - 25 * 60 * 60 * 1000),
    })
    prismaMock.userProfile.update.mockResolvedValue({
      ...profileBase,
      versosBalance: 310,
      versosStreak: 30,
    })

    const res = await callPost()
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.streak).toBe(30)
    expect(json.earned).toBe(210)
    expect(json.newBalance).toBe(310)
  })

  it("bloqueia claim duplicado no mesmo dia → 409 ALREADY_CLAIMED", async () => {
    prismaMock.userProfile.findUnique.mockResolvedValue({
      ...profileBase,
      lastClaimAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
    })

    const res = await callPost()
    const json = await res.json()

    expect(res.status).toBe(409)
    expect(json.error.code).toBe("ALREADY_CLAIMED")
    expect(prismaMock.userProfile.update).not.toHaveBeenCalled()
  })

  it("retorna 401 quando nao autenticado", async () => {
    tokenServiceMock.verifyAccessToken.mockRejectedValueOnce(
      tokenError("AUTH_TOKEN_INVALID"),
    )

    const res = await callPost("Bearer invalid")
    const json = await res.json()

    expect(res.status).toBe(401)
    expect(json.error.code).toBe("AUTH_TOKEN_INVALID")
  })

  it("retorna 404 quando perfil nao encontrado", async () => {
    prismaMock.userProfile.findUnique.mockResolvedValue(null)

    const res = await callPost()
    const json = await res.json()

    expect(res.status).toBe(404)
    expect(json.error.code).toBe("NOT_FOUND")
  })

  it("inclui meta.requestId nas respostas de erro", async () => {
    prismaMock.userProfile.findUnique.mockResolvedValue(null)

    const res = await callPost()
    const json = await res.json()

    expect(res.status).toBe(404)
    expect(json.meta.requestId).toBeTruthy()
    expect(typeof json.meta.requestId).toBe("string")
  })

  it("retorna 500 INTERNAL_ERROR com requestId quando falha ao atualizar", async () => {
    prismaMock.userProfile.update.mockRejectedValue(new Error("db down"))

    const res = await callPost()
    const json = await res.json()

    expect(res.status).toBe(500)
    expect(json.error.code).toBe("INTERNAL_ERROR")
    expect(json.meta.requestId).toBeTruthy()
  })
})
