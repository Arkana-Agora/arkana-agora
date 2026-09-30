// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest"

const prismaMock = vi.hoisted(() => ({
  userProfile: { findUnique: vi.fn() },
}))
const loggerMock = vi.hoisted(() => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }))
vi.mock("@/lib/logger", () => loggerMock)

async function callFindVisibleProfile(username: string) {
  const { findVisibleProfile } = await import("@/app/api/v1/users/_helpers")
  return findVisibleProfile(username, "req_test")
}

function profileRow(overrides?: {
  privacy?: unknown
  isBanned?: boolean
  deletedAt?: Date | null
  isActive?: boolean
}) {
  return {
    userId: "usr_target",
    privacy: overrides?.privacy ?? {},
    user: {
      id: "usr_target",
      isBanned: overrides?.isBanned ?? false,
      deletedAt: overrides?.deletedAt ?? null,
      isActive: overrides?.isActive ?? true,
    },
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.resetModules()
  prismaMock.userProfile.findUnique.mockResolvedValue(profileRow())
})

describe("findVisibleProfile — anti-timing (404 fail-closed)", () => {
  it("retorna null para username invalido sem consultar o banco", async () => {
    const res = await callFindVisibleProfile("a b")
    expect(res).toBeNull()
    expect(prismaMock.userProfile.findUnique).not.toHaveBeenCalled()
  })

  it("retorna null para username inexistente", async () => {
    prismaMock.userProfile.findUnique.mockResolvedValue(null)
    expect(await callFindVisibleProfile("ghost")).toBeNull()
  })

  it("retorna null e LOGA warn quando o privacy JSON é invalido", async () => {
    prismaMock.userProfile.findUnique.mockResolvedValue(
      profileRow({ privacy: { whoCanFollow: "semprinvalido" } }),
    )
    expect(await callFindVisibleProfile("target")).toBeNull()
    expect(loggerMock.logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ reqId: "req_test", username: "target" }),
      expect.stringContaining("privacy"),
    )
  })

  it("retorna null para perfil privado", async () => {
    prismaMock.userProfile.findUnique.mockResolvedValue(
      profileRow({ privacy: { profileVisibility: "private" } }),
    )
    expect(await callFindVisibleProfile("target")).toBeNull()
  })

  it("retorna null para usuario banido", async () => {
    prismaMock.userProfile.findUnique.mockResolvedValue(
      profileRow({ isBanned: true }),
    )
    expect(await callFindVisibleProfile("target")).toBeNull()
  })

  it("retorna null para usuario soft-deleted", async () => {
    prismaMock.userProfile.findUnique.mockResolvedValue(
      profileRow({ deletedAt: new Date() }),
    )
    expect(await callFindVisibleProfile("target")).toBeNull()
  })

  it("retorna null para usuario inativo (isActive=false)", async () => {
    prismaMock.userProfile.findUnique.mockResolvedValue(
      profileRow({ isActive: false }),
    )
    expect(await callFindVisibleProfile("target")).toBeNull()
  })

  it("chaves desconhecidas no privacy JSON sao ignoradas (leitura sem strict)", async () => {
    prismaMock.userProfile.findUnique.mockResolvedValue(
      profileRow({ privacy: { whoCanFollow: "all", legacyKey: true } }),
    )
    const res = await callFindVisibleProfile("target")
    expect(res).not.toBeNull()
    expect(res?.showStats).toBe(true)
  })
})

describe("findVisibleProfile — showStats (SC38)", () => {
  it("showStats=true por padrao", async () => {
    const res = await callFindVisibleProfile("target")
    expect(res?.showStats).toBe(true)
  })

  it("requireStatsVisibility + statsVisibility private → showStats=false", async () => {
    prismaMock.userProfile.findUnique.mockResolvedValue(
      profileRow({ privacy: { statsVisibility: "private" } }),
    )
    const res = await callFindVisibleProfile("target")
    expect(res?.showStats).toBe(false)
    expect(res?.profile.userId).toBe("usr_target")
  })

  it("sem requireStatsVisibility, statsVisibility private → showStats=false", async () => {
    prismaMock.userProfile.findUnique.mockResolvedValue(
      profileRow({ privacy: { statsVisibility: "private" } }),
    )
    const res = await callFindVisibleProfile("target")
    expect(res?.showStats).toBe(false)
  })
})
