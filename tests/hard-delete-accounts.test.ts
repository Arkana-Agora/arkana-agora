import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const sha256Mock = vi.hoisted(() => (value: string) => `hash:${value}`)
vi.mock("@/lib/crypto", () => ({ sha256: sha256Mock }))

const mirrorTokenVersionMock = vi.hoisted(() => vi.fn())
vi.mock("@/services/token-service", () => ({
  mirrorTokenVersion: mirrorTokenVersionMock,
}))

const prismaMock = vi.hoisted(() => ({
  user: {
    findMany: vi.fn(),
    updateMany: vi.fn(),
  },
  session: { deleteMany: vi.fn() },
  userProfile: { deleteMany: vi.fn() },
  subscription: { deleteMany: vi.fn() },
  arcanaCalculation: { deleteMany: vi.fn() },
  verificationToken: { deleteMany: vi.fn() },
  follow: { deleteMany: vi.fn() },
  post: { deleteMany: vi.fn() },
  comment: { deleteMany: vi.fn() },
  postLike: { deleteMany: vi.fn() },
  commentLike: { deleteMany: vi.fn() },
  gift: { deleteMany: vi.fn() },
  notification: { deleteMany: vi.fn() },
  contentReport: { deleteMany: vi.fn() },
  horoscopeEntry: { deleteMany: vi.fn() },
  horoscopeLog: { deleteMany: vi.fn() },
  horoscopeNotification: { deleteMany: vi.fn() },
  interpretation: { deleteMany: vi.fn() },
  readingCard: { deleteMany: vi.fn() },
  reading: { deleteMany: vi.fn() },
  $transaction: vi.fn(),
}))

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }))

const sendAccountDeletedFinalEmailMock = vi.hoisted(() => vi.fn())
vi.mock("@/lib/email/email", () => ({
  sendAccountDeletedFinalEmail: sendAccountDeletedFinalEmailMock,
}))

const NOW = new Date("2026-09-05T00:00:00.000Z")
const CUTOFF = new Date("2026-08-06T00:00:00.000Z")
const DAY_IN_MS = 86_400_000

const expiredRow = { id: "usr_1", email: "maria@email.com" }

const purgeModels = [
  "session",
  "userProfile",
  "subscription",
  "arcanaCalculation",
  "verificationToken",
  "follow",
  "post",
  "comment",
  "postLike",
  "commentLike",
  "gift",
  "notification",
  "contentReport",
  "horoscopeEntry",
  "horoscopeLog",
  "horoscopeNotification",
  "interpretation",
  "readingCard",
  "reading",
] as const

const txClient = {
  user: prismaMock.user,
  ...Object.fromEntries(purgeModels.map((model) => [model, prismaMock[model]])),
} as typeof prismaMock

beforeEach(() => {
  vi.clearAllMocks()
  // Selecao da anonimizacao (select { id, email }) devolve a conta expirada;
  // selecao da purga de leituras (select { id }, S2-20) devolve [] por padrao.
  prismaMock.user.findMany.mockImplementation(
    async (args?: { select?: Record<string, boolean> }) =>
      args?.select && !args.select.email ? [] : [expiredRow],
  )
  prismaMock.$transaction.mockImplementation(
    async (fn: (tx: unknown) => unknown) => fn(txClient),
  )
  prismaMock.user.updateMany.mockResolvedValue({ count: 1 })
  for (const model of purgeModels) {
    prismaMock[model].deleteMany.mockResolvedValue({ count: 0 })
  }
  mirrorTokenVersionMock.mockResolvedValue(undefined)
  sendAccountDeletedFinalEmailMock.mockResolvedValue({ data: { id: "em_1" } })
})

afterEach(() => {
  vi.resetModules()
})

async function runJob(now: Date = NOW) {
  const { runHardDeleteJob } = await import("@/jobs/hard-delete-accounts")
  return runHardDeleteJob(now)
}

describe("job hard-delete-accounts (T16)", () => {
  it("seleciona apenas contas com deletedAt ha mais de 30 dias, inativas e nao anonimizadas", async () => {
    const summary = await runJob()

    const findManyArg = prismaMock.user.findMany.mock.calls[0]![0] as {
      where: {
        deletedAt: { not: null; lte: Date }
        email: { not: { endsWith: string } }
        isActive: boolean
      }
      select: { id: true; email: true }
    }
    expect(findManyArg.where.deletedAt).toEqual({
      not: null,
      lte: expect.any(Date),
    })
    expect(findManyArg.where.deletedAt.lte.toISOString()).toBe(
      CUTOFF.toISOString(),
    )
    expect(findManyArg.where.isActive).toBe(false)
    expect(findManyArg.where.email).toEqual({
      not: { endsWith: "@deleted.local" },
    })
    expect(findManyArg.select).toEqual({ id: true, email: true })
    expect(summary.processed).toBe(1)
    expect(summary.failed).toBe(0)
  })

  it("contabiliza todas as contas expiradas como processed", async () => {
    prismaMock.user.findMany.mockResolvedValue([
      { id: "usr_1", email: "maria@email.com" },
      { id: "usr_2", email: "joao@email.com" },
    ])

    const summary = await runJob()

    expect(summary.processed).toBe(2)
    expect(summary.failed).toBe(0)
  })

  it("anonimiza dados, incrementa tokenVersion e purga sessao/perfil/assinatura/tabelas sociais e de horoscopos em transacao unica (callback style)", async () => {
    await runJob()

    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1)
    const txArg = prismaMock.$transaction.mock.calls[0]![0]
    expect(typeof txArg).toBe("function")

    const updateArg = prismaMock.user.updateMany.mock.calls[0]![0] as {
      where: Record<string, unknown>
      data: Record<string, unknown>
    }
    expect(updateArg.where).toEqual({
      id: "usr_1",
      deletedAt: { not: null, lte: CUTOFF },
      isActive: false,
      email: "maria@email.com",
    })
    expect(updateArg.data.email).toMatch(/@deleted\.local$/)
    expect(updateArg.data.email).not.toBe("maria@email.com")
    expect(updateArg.data.providerId).toBe(updateArg.data.email)
    expect(updateArg.data.name).toBe("Usuario Removido")
    expect(updateArg.data.displayName).toBe("Usuario Removido")
    expect(updateArg.data.passwordHash).toBeNull()
    expect(updateArg.data.avatar).toBeNull()
    expect(updateArg.data.birthDate).toBeNull()
    expect(updateArg.data.astrologicalSign).toBeNull()
    expect(updateArg.data.mayanKin).toBeNull()
    expect(updateArg.data.personalArcana).toBeNull()
    expect(updateArg.data.emailVerified).toBeNull()
    expect(updateArg.data.isActive).toBe(false)
    expect(updateArg.data.tokenVersion).toEqual({ increment: 1 })
    expect(updateArg.data).not.toHaveProperty("deletedAt")

    expect(prismaMock.session.deleteMany).toHaveBeenCalledWith({
      where: { userId: "usr_1" },
    })
    expect(prismaMock.userProfile.deleteMany).toHaveBeenCalledWith({
      where: { userId: "usr_1" },
    })
    expect(prismaMock.subscription.deleteMany).toHaveBeenCalledWith({
      where: { userId: "usr_1" },
    })
    expect(prismaMock.arcanaCalculation.deleteMany).toHaveBeenCalledWith({
      where: { userId: "usr_1" },
    })
    expect(prismaMock.verificationToken.deleteMany).toHaveBeenCalledWith({
      where: { identifier: "maria@email.com" },
    })

    // LGPD Sprint 2 — purge das tabelas novas com ligação ao usuário
    expect(prismaMock.follow.deleteMany).toHaveBeenCalledWith({
      where: {
        OR: [{ followerId: "usr_1" }, { followingId: "usr_1" }],
      },
    })
    expect(prismaMock.post.deleteMany).toHaveBeenCalledWith({
      where: { authorId: "usr_1" },
    })
    expect(prismaMock.comment.deleteMany).toHaveBeenCalledWith({
      where: { authorId: "usr_1" },
    })
    expect(prismaMock.postLike.deleteMany).toHaveBeenCalledWith({
      where: { userId: "usr_1" },
    })
    expect(prismaMock.commentLike.deleteMany).toHaveBeenCalledWith({
      where: { userId: "usr_1" },
    })
    expect(prismaMock.gift.deleteMany).toHaveBeenCalledWith({
      where: { fromUserId: "usr_1" },
    })
    expect(prismaMock.notification.deleteMany).toHaveBeenCalledWith({
      where: { userId: "usr_1" },
    })
    expect(prismaMock.contentReport.deleteMany).toHaveBeenCalledWith({
      where: { reporterId: "usr_1" },
    })
    expect(prismaMock.horoscopeEntry.deleteMany).toHaveBeenCalledWith({
      where: { userId: "usr_1" },
    })
    expect(prismaMock.horoscopeLog.deleteMany).toHaveBeenCalledWith({
      where: { userId: "usr_1" },
    })
    expect(prismaMock.horoscopeNotification.deleteMany).toHaveBeenCalledWith({
      where: { userId: "usr_1" },
    })
  })

  it("envia o email final e espelha a tokenVersion somente apos a transacao commitar", async () => {
    await runJob()

    expect(sendAccountDeletedFinalEmailMock).toHaveBeenCalledWith(
      "maria@email.com",
      { deleteAfterDays: 30 },
    )
    const emailOrder =
      sendAccountDeletedFinalEmailMock.mock.invocationCallOrder[0] ?? 0
    const updateOrder =
      prismaMock.user.updateMany.mock.invocationCallOrder[0] ?? 0
    expect(emailOrder).toBeGreaterThan(updateOrder)

    expect(mirrorTokenVersionMock).toHaveBeenCalledWith("usr_1")
    const mirrorOrder = mirrorTokenVersionMock.mock.invocationCallOrder[0] ?? 0
    expect(mirrorOrder).toBeGreaterThan(updateOrder)
  })

  it("falha de envio de email nao aborta a anonimizacao", async () => {
    sendAccountDeletedFinalEmailMock.mockRejectedValue(new Error("smtp down"))

    const summary = await runJob()

    expect(summary.processed).toBe(1)
    expect(summary.failed).toBe(0)
    expect(prismaMock.user.updateMany).toHaveBeenCalledTimes(1)
  })

  it("continua processando as demais contas quando um usuario falha", async () => {
    prismaMock.user.findMany.mockResolvedValue([
      { id: "usr_1", email: "maria@email.com" },
      { id: "usr_2", email: "joao@email.com" },
    ])
    prismaMock.$transaction.mockRejectedValueOnce(new Error("boom no usr_1"))

    const summary = await runJob()

    expect(summary.processed).toBe(1)
    expect(summary.failed).toBe(1)
    expect(summary.errors[0]).toMatchObject({ userId: "usr_1" })
    expect(sendAccountDeletedFinalEmailMock).toHaveBeenCalledWith(
      "joao@email.com",
      { deleteAfterDays: 30 },
    )
  })

  it("pula contas restauradas entre a selecao e a execucao (claim com count 0)", async () => {
    prismaMock.user.updateMany.mockResolvedValue({ count: 0 })

    const summary = await runJob()

    expect(summary.processed).toBe(0)
    expect(summary.failed).toBe(0)
    for (const model of purgeModels) {
      expect(prismaMock[model].deleteMany).not.toHaveBeenCalled()
    }
    expect(mirrorTokenVersionMock).not.toHaveBeenCalled()
    expect(sendAccountDeletedFinalEmailMock).not.toHaveBeenCalled()
  })

  it("evita re-anonimizar, re-enviar email e re-bump quando duas execucoes reivindicam a mesma conta", async () => {
    prismaMock.user.updateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 })

    await runJob()
    const summary = await runJob()

    expect(summary.processed).toBe(0)
    expect(sendAccountDeletedFinalEmailMock).toHaveBeenCalledTimes(1)
    expect(mirrorTokenVersionMock).toHaveBeenCalledTimes(1)
  })

  it("purga leituras de contas excluidas ha mais de 90 dias (S2-20/T148)", async () => {
    prismaMock.user.findMany.mockImplementation(
      async (args?: { select?: Record<string, boolean> }) =>
        args?.select && !args.select.email
          ? [{ id: "usr_stale" }]
          : [expiredRow],
    )

    const summary = await runJob()

    expect(summary.readingsPurged).toBe(1)
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(2)
    expect(prismaMock.interpretation.deleteMany).toHaveBeenCalledWith({
      where: { userId: { in: ["usr_stale"] } },
    })
    expect(prismaMock.readingCard.deleteMany).toHaveBeenCalledWith({
      where: { reading: { userId: { in: ["usr_stale"] } } },
    })
    expect(prismaMock.reading.deleteMany).toHaveBeenCalledWith({
      where: { userId: { in: ["usr_stale"] } },
    })
    const interpretationOrder =
      prismaMock.interpretation.deleteMany.mock.invocationCallOrder[0]!
    const cardOrder =
      prismaMock.readingCard.deleteMany.mock.invocationCallOrder[0]!
    const readingOrder =
      prismaMock.reading.deleteMany.mock.invocationCallOrder[0]!
    expect(interpretationOrder).toBeLessThan(cardOrder)
    expect(cardOrder).toBeLessThan(readingOrder)
  })

  it("conta excluida ha 45 dias mantem as leituras (corte de 90 dias)", async () => {
    const summary = await runJob()

    expect(summary.readingsPurged).toBe(0)
    const purgeCall = prismaMock.user.findMany.mock.calls.find(
      ([args]) =>
        !(args as { select?: Record<string, boolean> })?.select?.email,
    )
    expect(purgeCall).toBeDefined()
    const where = (
      purgeCall![0] as {
        where: {
          deletedAt: { not: null; lte: Date }
          readings: { some: Record<string, never> }
        }
      }
    ).where
    expect(where.deletedAt.lte.toISOString()).toBe(
      new Date(NOW.getTime() - 90 * DAY_IN_MS).toISOString(),
    )
    expect(where.readings).toEqual({ some: {} })
    expect(prismaMock.interpretation.deleteMany).not.toHaveBeenCalled()
    expect(prismaMock.reading.deleteMany).not.toHaveBeenCalled()
  })

  it("purga de leituras e idempotente: 2a execucao sem leituras nao refaz nada", async () => {
    let purgeSelections = 0
    prismaMock.user.findMany.mockImplementation(
      async (args?: { select?: Record<string, boolean> }) => {
        if (args?.select?.email) return [expiredRow]
        purgeSelections += 1
        return purgeSelections === 1 ? [{ id: "usr_1" }] : []
      },
    )

    const first = await runJob()
    const second = await runJob()

    expect(first.readingsPurged).toBe(1)
    expect(second.readingsPurged).toBe(0)
    expect(prismaMock.reading.deleteMany).toHaveBeenCalledTimes(1)
  })
})
