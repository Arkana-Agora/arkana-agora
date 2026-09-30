import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const prismaMock = vi.hoisted(() => ({
  $transaction: vi.fn(),
  userProfile: { update: vi.fn() },
}))

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }))

import { earnVersos, VersosSource, VERSOS_REWARDS } from "@/lib/social/versos"

const txClient = {
  userProfile: prismaMock.userProfile,
}

const profileMissingError = Object.assign(new Error("not found"), {
  code: "P2025",
})

beforeEach(() => {
  vi.clearAllMocks()
  prismaMock.$transaction.mockImplementation(
    async (fn: (tx: unknown) => unknown) => fn(txClient),
  )
  prismaMock.userProfile.update.mockResolvedValue({ versosBalance: 11 })
})

afterEach(() => {
  vi.resetModules()
})

describe("VERSOS_REWARDS (T037)", () => {
  it("tabela fixa do spec: like 1, comment 2, follow 5, reading 10", () => {
    expect(VERSOS_REWARDS).toEqual({
      [VersosSource.Like]: 1,
      [VersosSource.Comment]: 2,
      [VersosSource.Follow]: 5,
      [VersosSource.Reading]: 10,
    })
  })

  it("rewards sempre >= 1 (invariante S2-17 suporta o CHECK do banco)", () => {
    for (const reward of Object.values(VERSOS_REWARDS)) {
      expect(reward).toBeGreaterThanOrEqual(1)
    }
  })
})

describe("earnVersos (T037/S2-17)", () => {
  it("incrementa o saldo em $transaction e retorna o novo saldo em 1 query", async () => {
    const balance = await earnVersos("usr_1", VersosSource.Comment)

    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1)
    expect(prismaMock.userProfile.update).toHaveBeenCalledWith({
      where: { userId: "usr_1" },
      data: { versosBalance: { increment: 2 } },
      select: { versosBalance: true },
    })
    expect(balance).toBe(11)
  })

  it("retorna null quando o perfil não existe (P2025)", async () => {
    prismaMock.userProfile.update.mockRejectedValue(profileMissingError)

    const balance = await earnVersos("usr_missing", VersosSource.Like)

    expect(balance).toBeNull()
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1)
  })

  it("propaga erros que não sejam P2025", async () => {
    prismaMock.userProfile.update.mockRejectedValue(new Error("db down"))

    await expect(earnVersos("usr_1", VersosSource.Follow)).rejects.toThrow(
      "db down",
    )
  })

  it("usa o tx passado como parâmetro sem criar transação aninhada", async () => {
    const balance = await earnVersos(
      "usr_1",
      VersosSource.Follow,
      txClient as unknown as Parameters<typeof earnVersos>[2],
    )

    // Quando tx é passado, não deve chamar $transaction novamente
    expect(prismaMock.$transaction).not.toHaveBeenCalled()
    expect(prismaMock.userProfile.update).toHaveBeenCalledWith({
      where: { userId: "usr_1" },
      data: { versosBalance: { increment: 5 } },
      select: { versosBalance: true },
    })
    expect(balance).toBe(11)
  })
})
