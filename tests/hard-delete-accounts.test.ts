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
  verificationToken: { deleteMany: vi.fn() },
  $transaction: vi.fn(),
}))

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }))

const sendAccountDeletedFinalEmailMock = vi.hoisted(() => vi.fn())
vi.mock("@/lib/email/email", () => ({
  sendAccountDeletedFinalEmail: sendAccountDeletedFinalEmailMock,
}))

const NOW = new Date("2026-09-05T00:00:00.000Z")
const CUTOFF = new Date("2026-08-06T00:00:00.000Z")

const expiredRow = { id: "usr_1", email: "maria@email.com" }

const txClient = {
  user: prismaMock.user,
  session: prismaMock.session,
  userProfile: prismaMock.userProfile,
  subscription: prismaMock.subscription,
  verificationToken: prismaMock.verificationToken,
}

beforeEach(() => {
  vi.clearAllMocks()
  prismaMock.user.findMany.mockResolvedValue([expiredRow])
  prismaMock.$transaction.mockImplementation(
    async (fn: (tx: unknown) => unknown) => fn(txClient),
  )
  prismaMock.user.updateMany.mockResolvedValue({ count: 1 })
  prismaMock.session.deleteMany.mockResolvedValue({ count: 0 })
  prismaMock.userProfile.deleteMany.mockResolvedValue({ count: 0 })
  prismaMock.subscription.deleteMany.mockResolvedValue({ count: 0 })
  prismaMock.verificationToken.deleteMany.mockResolvedValue({ count: 0 })
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

  it("anonimiza dados, incrementa tokenVersion e deleta sessao/perfil/assinatura/token de verificacao em transacao unica (callback style)", async () => {
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
    expect(prismaMock.verificationToken.deleteMany).toHaveBeenCalledWith({
      where: { identifier: "maria@email.com" },
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
    expect(prismaMock.session.deleteMany).not.toHaveBeenCalled()
    expect(prismaMock.userProfile.deleteMany).not.toHaveBeenCalled()
    expect(prismaMock.subscription.deleteMany).not.toHaveBeenCalled()
    expect(prismaMock.verificationToken.deleteMany).not.toHaveBeenCalled()
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
})
