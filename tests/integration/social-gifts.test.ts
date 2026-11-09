// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const prismaMock = vi.hoisted(() => ({
  user: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  userProfile: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  gift: {
    create: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
  },
  notification: {
    create: vi.fn(),
  },
  followReward: {
    findUnique: vi.fn(),
    create: vi.fn(),
  },
  $transaction: vi.fn(),
}))

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }))

const tokenServiceMock = vi.hoisted(() => ({
  verifyAccessToken: vi.fn().mockResolvedValue({ userId: "usr_sender" }),
}))

vi.mock("@/services/token-service", () => ({
  verifyAccessToken: tokenServiceMock.verifyAccessToken,
}))

const sendGiftNotificationMock = vi.hoisted(() => vi.fn())
vi.mock("@/lib/email/email", () => ({
  sendGiftNotification: sendGiftNotificationMock,
}))

const rateLimitMock = vi.hoisted(() => ({
  checkGiftLimit: vi.fn(),
  recordGiftAttempt: vi.fn(),
}))

vi.mock("@/lib/social/limits", () => ({
  checkGiftLimit: rateLimitMock.checkGiftLimit,
}))

function tokenError(code: string): Error {
  const err = new Error(`${code}: teste`)
  err.name = "AuthTokenError"
  ;(err as { code?: string }).code = code
  return err
}

const earnVersosMock = vi.hoisted(() => vi.fn().mockResolvedValue(100))
vi.mock("@/lib/social/versos", () => ({
  earnVersos: earnVersosMock,
  VERSOS_REWARDS: {
    Like: 1,
    Comment: 2,
    Follow: 5,
    Reading: 10,
  },
}))

const giftCatalogMock = vi.hoisted(() => ({
  GIFT_CATALOG: [
    { id: "estrela-cadente", name: "Estrela Cadente", cost: 10, emoji: "star" },
    { id: "rosa-mistica", name: "Rosa Mistica", cost: 25, emoji: "rose" },
    {
      id: "cristal-de-quartzo",
      name: "Cristal de Quartzo",
      cost: 50,
      emoji: "gem",
    },
    {
      id: "bola-de-cristal",
      name: "Bola de Cristal",
      cost: 100,
      emoji: "crystal-ball",
    },
    { id: "coroa-astral", name: "Coroa Astral", cost: 200, emoji: "crown" },
    {
      id: "dragao-dourado",
      name: "Dragao Dourado",
      cost: 500,
      emoji: "dragon",
    },
  ],
  validateGiftId: vi.fn((id: string) =>
    [
      "estrela-cadente",
      "rosa-mistica",
      "cristal-de-quartzo",
      "bola-de-cristal",
      "coroa-astral",
      "dragao-dourado",
    ].includes(id),
  ),
  getGiftCost: vi.fn((id: string) => {
    const costs: Record<string, number> = {
      "estrela-cadente": 10,
      "rosa-mistica": 25,
      "cristal-de-quartzo": 50,
      "bola-de-cristal": 100,
      "coroa-astral": 200,
      "dragao-dourado": 500,
    }
    return costs[id] ?? null
  }),
  getGiftById: vi.fn((id: string) => {
    const gifts: Record<
      string,
      { id: string; name: string; cost: number; emoji: string }
    > = {
      "estrela-cadente": {
        id: "estrela-cadente",
        name: "Estrela Cadente",
        cost: 10,
        emoji: "star",
      },
      "rosa-mistica": {
        id: "rosa-mistica",
        name: "Rosa Mistica",
        cost: 25,
        emoji: "rose",
      },
      "cristal-de-quartzo": {
        id: "cristal-de-quartzo",
        name: "Cristal de Quartzo",
        cost: 50,
        emoji: "gem",
      },
      "bola-de-cristal": {
        id: "bola-de-cristal",
        name: "Bola de Cristal",
        cost: 100,
        emoji: "crystal-ball",
      },
      "coroa-astral": {
        id: "coroa-astral",
        name: "Coroa Astral",
        cost: 200,
        emoji: "crown",
      },
      "dragao-dourado": {
        id: "dragao-dourado",
        name: "Dragao Dourado",
        cost: 500,
        emoji: "dragon",
      },
    }
    return gifts[id] ?? null
  }),
}))

vi.mock("@/lib/social/gifts", () => giftCatalogMock)

const csrfMock = vi.hoisted(() => ({
  enforceCsrf: vi.fn().mockReturnValue(null),
}))

vi.mock("@/lib/middleware/csrf", () => ({
  enforceCsrf: csrfMock.enforceCsrf,
}))

const emitterMock = vi.hoisted(() => ({
  emitGiftReceived: vi.fn(),
  emitNotification: vi.fn(),
}))

vi.mock("@socket/src/emitters", () => emitterMock)

const sender = {
  id: "usr_sender",
  name: "Maria Silva",
  email: "maria@email.com",
  subscriptionTier: "FREE",
  profile: {
    versosBalance: 1000,
    versosStreak: 5,
    lastClaimAt: null,
  },
}

const recipient = {
  id: "usr_recipient",
  name: "Joao Santos",
  email: "joao@email.com",
  subscriptionTier: "FREE",
  profile: {
    versosBalance: 500,
    versosStreak: 3,
    lastClaimAt: null,
  },
}

const professionalRecipient = {
  id: "usr_pro",
  name: "Profissional",
  email: "pro@email.com",
  subscriptionTier: "PLUS",
  profile: {
    versosBalance: 500,
    versosStreak: 10,
    lastClaimAt: null,
  },
}

function validBody() {
  return { toUserId: "usr_recipient", giftId: "estrela-cadente" }
}

async function callPost(
  body: unknown,
  token = "Bearer test-token",
): Promise<Response> {
  const { POST } = await import("@/app/api/v1/social/gifts/send/route")
  return POST(
    new Request("http://localhost:3000/api/v1/social/gifts/send", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: token },
      body: JSON.stringify(body),
    }),
  )
}

async function callGet(token = "Bearer test-token"): Promise<Response> {
  const { GET } = await import("@/app/api/v1/social/gifts/received/route")
  return GET(
    new Request("http://localhost:3000/api/v1/social/gifts/received", {
      method: "GET",
      headers: { authorization: token },
    }),
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  prismaMock.user.findUnique.mockResolvedValue(recipient)
  prismaMock.userProfile.findUnique.mockResolvedValue(sender.profile)
  prismaMock.gift.create.mockResolvedValue({ id: "gift_1" })
  prismaMock.notification.create.mockResolvedValue({ id: "notif_1" })
  prismaMock.user.update.mockResolvedValue({})
  prismaMock.userProfile.update.mockResolvedValue({})
  prismaMock.followReward.findUnique.mockResolvedValue(null)
  prismaMock.followReward.create.mockResolvedValue({})
  prismaMock.$transaction.mockImplementation(
    async (callback: (tx: typeof prismaMock) => Promise<unknown>) =>
      callback(prismaMock),
  )

  rateLimitMock.checkGiftLimit.mockReturnValue({
    allowed: true,
    remaining: 9,
    resetAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
  })

  sendGiftNotificationMock.mockResolvedValue({
    data: { id: "email_1" },
    error: null,
  })
})

afterEach(() => {
  vi.resetModules()
})

describe("POST /api/v1/social/gifts/send — integration (T125)", () => {
  it("POST send → cria Gift + Notification + emite eventos realtime", async () => {
    const res = await callPost(validBody())
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.message).toBe("Presente enviado com sucesso")
    expect(prismaMock.gift.create).toHaveBeenCalled()
    expect(prismaMock.notification.create).toHaveBeenCalled()
    expect(emitterMock.emitGiftReceived).toHaveBeenCalled()
    expect(emitterMock.emitNotification).toHaveBeenCalled()
  })

  it("POST send → credita metade ao destinatario se PROFESSIONAL (+50%)", async () => {
    prismaMock.user.findUnique.mockResolvedValue(professionalRecipient)

    const res = await callPost(validBody())
    await res.json()

    expect(res.status).toBe(200)
    expect(prismaMock.gift.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          recipientEarnsHalf: true,
        }),
      }),
    )
  })

  it("POST send → bloqueia self-gift com 403 SELF_GIFT", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      ...recipient,
      id: "usr_sender",
    })

    const res = await callPost({
      toUserId: "usr_sender",
      giftId: "estrela-cadente",
    })
    const json = await res.json()

    expect(res.status).toBe(403)
    expect(json.error.code).toBe("SELF_GIFT")
  })

  it("POST send → valida giftId invalido com 422", async () => {
    const res = await callPost({
      toUserId: "usr_recipient",
      giftId: "gift-inexistente",
    })
    const json = await res.json()

    expect(res.status).toBe(422)
    expect(json.error.code).toBe("VALIDATION_ERROR")
  })

  it("POST send → valida saldo insuficiente com 403 INSUFFICIENT_VERSOS", async () => {
    prismaMock.userProfile.findUnique.mockResolvedValue({
      ...sender.profile,
      versosBalance: 5,
    })

    const res = await callPost(validBody())
    const json = await res.json()

    expect(res.status).toBe(403)
    expect(json.error.code).toBe("INSUFFICIENT_VERSOS")
  })

  it("POST send → aplica rate limit de gifts (10/dia) e retorna 429", async () => {
    rateLimitMock.checkGiftLimit.mockReturnValue({
      allowed: false,
      remaining: 0,
      resetAt: new Date(Date.now() + 3600000),
    })

    const res = await callPost(validBody())
    const json = await res.json()

    expect(res.status).toBe(429)
    expect(json.error.code).toBe("RATE_LIMITED")
  })

  it("POST send → retorna 200 mesmo quando envio de notificacao falha (best-effort)", async () => {
    sendGiftNotificationMock.mockRejectedValue(new Error("provider down"))

    const res = await callPost(validBody())
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.message).toBe("Presente enviado com sucesso")
    expect(prismaMock.gift.create).toHaveBeenCalled()
  })
})

describe("GET /api/v1/social/gifts/received — integration (T142)", () => {
  const receivedGifts = [
    {
      id: "gift_1",
      fromUserId: "usr_sender",
      toUserId: "usr_recipient",
      giftId: "estrela-cadente",
      coinCost: 10,
      recipientEarnsHalf: false,
      createdAt: new Date("2026-01-15T10:00:00Z"),
      fromUser: { id: "usr_sender", name: "Maria Silva", avatar: null },
    },
    {
      id: "gift_2",
      fromUserId: "usr_other",
      toUserId: "usr_recipient",
      giftId: "rosa-mistica",
      coinCost: 25,
      recipientEarnsHalf: false,
      createdAt: new Date("2026-01-14T15:30:00Z"),
      fromUser: { id: "usr_other", name: "Outro User", avatar: "avatar.png" },
    },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.gift.findMany.mockResolvedValue(receivedGifts)
    prismaMock.gift.count.mockResolvedValue(2)
    prismaMock.userProfile.findUnique.mockResolvedValue(recipient.profile)
    prismaMock.user.findUnique.mockResolvedValue(recipient)
  })

  it("retorna ultimos 20 gifts recebidos com totalReceived", async () => {
    tokenServiceMock.verifyAccessToken.mockResolvedValue({
      userId: "usr_recipient",
    })
    const res = await callGet()
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.gifts).toHaveLength(2)
    expect(json.totalReceived).toBe(2)
    expect(json.gifts[0]).toMatchObject({
      id: "gift_1",
      giftId: "estrela-cadente",
      fromUser: expect.objectContaining({ name: "Maria Silva" }),
    })
    expect(prismaMock.gift.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { toUserId: "usr_recipient" },
        take: 20,
        orderBy: { createdAt: "desc" },
        include: expect.objectContaining({
          fromUser: expect.objectContaining({
            select: expect.objectContaining({
              id: true,
              name: true,
              avatar: true,
            }),
          }),
        }),
      }),
    )
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

  it("retorna 404 quando perfil nao encontrado", async () => {
    tokenServiceMock.verifyAccessToken.mockResolvedValue({
      userId: "usr_recipient",
    })
    prismaMock.userProfile.findUnique.mockResolvedValue(null)

    const res = await callGet()
    const json = await res.json()

    expect(res.status).toBe(404)
    expect(json.error.code).toBe("NOT_FOUND")
  })

  it("inclui meta.requestId nas respostas de erro", async () => {
    tokenServiceMock.verifyAccessToken.mockResolvedValue({
      userId: "usr_recipient",
    })
    prismaMock.userProfile.findUnique.mockResolvedValue(null)

    const res = await callGet()
    const json = await res.json()

    expect(res.status).toBe(404)
    expect(json.meta.requestId).toBeTruthy()
    expect(typeof json.meta.requestId).toBe("string")
  })

  it("retorna 500 INTERNAL_ERROR quando falha ao buscar gifts", async () => {
    tokenServiceMock.verifyAccessToken.mockResolvedValue({
      userId: "usr_recipient",
    })
    prismaMock.gift.findMany.mockRejectedValue(new Error("db down"))

    const res = await callGet()
    const json = await res.json()

    expect(res.status).toBe(500)
    expect(json.error.code).toBe("INTERNAL_ERROR")
    expect(json.meta.requestId).toBeTruthy()
  })
})
