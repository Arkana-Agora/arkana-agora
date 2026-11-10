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
  },
  notification: {
    create: vi.fn(),
  },
  followReward: {
    findUnique: vi.fn(),
    create: vi.fn(),
  },
  $transaction: vi.fn((callback) => callback(prismaMock)),
}))

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }))

const tokenServiceMock = vi.hoisted(() => ({
  verifyAccessToken: vi
    .fn()
    .mockResolvedValue({ userId: "clx1234567890abcdef123456" }),
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

const csrfMock = vi.hoisted(() => ({
  enforceCsrf: vi.fn().mockReturnValue(null),
}))

vi.mock("@/lib/middleware/csrf", () => ({
  enforceCsrf: csrfMock.enforceCsrf,
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

const emitterMock = vi.hoisted(() => ({
  emitGiftReceived: vi.fn(),
  emitNotification: vi.fn(),
}))

vi.mock("@socket/src/emitters", () => emitterMock)

const sender = {
  id: "clx1234567890abcdef123456",
  name: "Maria Silva",
  email: "maria@email.com",
  plan: "FREE",
  profile: {
    versosBalance: 1000,
    versosStreak: 5,
    lastClaimAt: null,
  },
}

const recipient = {
  id: "clx1234567890abcdef123457",
  name: "Joao Santos",
  email: "joao@email.com",
  plan: "FREE",
  profile: {
    versosBalance: 500,
    versosStreak: 3,
    lastClaimAt: null,
  },
}

const professionalRecipient = {
  id: "clx1234567890abcdef123458",
  name: "Profissional",
  email: "pro@email.com",
  plan: "PLUS",
  profile: {
    versosBalance: 500,
    versosStreak: 10,
    lastClaimAt: null,
  },
}

function validBody() {
  return { toUserId: "clx1234567890abcdef123457", giftId: "estrela-cadente" }
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

describe("POST /api/v1/social/gifts/send (T120)", () => {
  it("cria gift, debita remetente, credita destinatario (metade se PRO) e notifica", async () => {
    prismaMock.user.findUnique.mockResolvedValue(recipient)
    prismaMock.userProfile.findUnique.mockResolvedValue({
      ...sender.profile,
      versosBalance: 1000,
    })
    prismaMock.userProfile.update
      .mockResolvedValueOnce({ ...sender.profile, versosBalance: 990 })
      .mockResolvedValueOnce({ ...recipient.profile, versosBalance: 505 })

    const res = await callPost(validBody())
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.message).toBe("Presente enviado com sucesso")
    expect(prismaMock.gift.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          fromUserId: "clx1234567890abcdef123456",
          toUserId: "clx1234567890abcdef123457",
          giftId: "estrela-cadente",
          coinCost: 10,
          recipientEarnsHalf: false,
        }),
      }),
    )
    expect(prismaMock.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: "clx1234567890abcdef123457",
          type: "GIFT_RECEIVED",
        }),
      }),
    )
    expect(emitterMock.emitGiftReceived).toHaveBeenCalled()
    expect(emitterMock.emitNotification).toHaveBeenCalled()
  })

  it("credita metade ao destinatario se PLUS (+50%)", async () => {
    prismaMock.user.findUnique.mockResolvedValue({ ...professionalRecipient })

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

  it("bloqueia self-gift com 403 SELF_GIFT", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      ...recipient,
      id: "clx1234567890abcdef123456",
    })

    const res = await callPost({
      toUserId: "clx1234567890abcdef123456",
      giftId: "estrela-cadente",
    })
    const json = await res.json()

    expect(res.status).toBe(403)
    expect(json.error.code).toBe("SELF_GIFT")
    expect(prismaMock.gift.create).not.toHaveBeenCalled()
  })

  it("valida giftId invalido com 422", async () => {
    prismaMock.user.findUnique.mockResolvedValue(recipient)

    const res = await callPost({
      toUserId: "clx1234567890abcdef123457",
      giftId: "gift-inexistente",
    })
    const json = await res.json()

    expect(res.status).toBe(422)
    expect(json.error.code).toBe("VALIDATION_ERROR")
    expect(prismaMock.gift.create).not.toHaveBeenCalled()
  })

  it("valida saldo insuficiente com 403 INSUFFICIENT_VERSOS", async () => {
    prismaMock.userProfile.findUnique.mockResolvedValue({
      ...sender.profile,
      versosBalance: 5,
    })

    const res = await callPost(validBody())
    const json = await res.json()

    expect(res.status).toBe(403)
    expect(json.error.code).toBe("INSUFFICIENT_VERSOS")
    expect(prismaMock.gift.create).not.toHaveBeenCalled()
  })

  it("aplica rate limit de gifts (10/dia) e retorna 429", async () => {
    rateLimitMock.checkGiftLimit.mockReturnValue({
      allowed: false,
      remaining: 0,
      resetAt: new Date(Date.now() + 3600000),
    })

    const res = await callPost(validBody())
    const json = await res.json()

    expect(res.status).toBe(429)
    expect(json.error.code).toBe("RATE_LIMITED")
    expect(prismaMock.gift.create).not.toHaveBeenCalled()
  })

  it("retorna 200 mesmo quando envio de notificacao falha (best-effort)", async () => {
    sendGiftNotificationMock.mockRejectedValue(new Error("provider down"))

    const res = await callPost(validBody())
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.message).toBe("Presente enviado com sucesso")
    expect(prismaMock.gift.create).toHaveBeenCalled()
  })

  it("retorna 500 INTERNAL_ERROR com meta.requestId quando falha ao criar gift", async () => {
    prismaMock.gift.create.mockRejectedValue(new Error("db down"))

    const res = await callPost(validBody())
    const json = await res.json()

    expect(res.status).toBe(500)
    expect(json.error.code).toBe("INTERNAL_ERROR")
    expect(json.meta.requestId).toBeTruthy()
  })

  it("inclui meta.requestId nas respostas de erro", async () => {
    prismaMock.gift.create.mockRejectedValue(new Error("db down"))

    const res = await callPost(validBody())
    const json = await res.json()

    expect(res.status).toBe(500)
    expect(typeof json.meta.requestId).toBe("string")
    expect(json.meta.requestId.length).toBeGreaterThan(0)
  })
})
