import { describe, it, expect, vi, beforeEach } from "vitest"
import { enrichUserFromOAuthProfile } from "@/services/account-service"

const prismaMock = vi.hoisted(() => ({
  user: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
}))

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }))
vi.mock("@/lib/logger", () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}))

function mockDbRows(row: {
  name: string | null
  displayName: string | null
  avatar: string | null
  birthDate: Date | null
}) {
  prismaMock.user.findUnique.mockResolvedValue(row)
  prismaMock.user.update.mockResolvedValue({})
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe("enrichUserFromOAuthProfile", () => {
  it("fills empty name/displayName/avatar from google claims", async () => {
    mockDbRows({
      name: null,
      displayName: null,
      avatar: null,
      birthDate: null,
    })

    await enrichUserFromOAuthProfile("u1", {
      name: "Maria Silva",
      picture: "https://lh3.googleusercontent.com/avatar-1",
    })

    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { id: "u1" },
      data: {
        name: "Maria Silva",
        displayName: "Maria Silva",
        avatar: "https://lh3.googleusercontent.com/avatar-1",
      },
    })
  })

  it("does not overwrite name/displayName/avatar but invalidates personalArcana when name changes", async () => {
    mockDbRows({
      name: "Nome Original",
      displayName: "Nome Exibicao",
      avatar: "https://lh3.googleusercontent.com/original",
      birthDate: new Date("1990-06-15"),
    })

    await enrichUserFromOAuthProfile("u1", {
      name: "Maria Silva",
      picture: "https://lh3.googleusercontent.com/avatar-2",
    })

    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { id: "u1" },
      data: { personalArcana: null },
    })
  })

  it("nulls personalArcana when google name changes and birthDate exists", async () => {
    mockDbRows({
      name: "Nome Antigo",
      displayName: null,
      avatar: null,
      birthDate: new Date("1990-06-15"),
    })

    await enrichUserFromOAuthProfile("u1", {
      name: "Nome Novo",
      picture: null,
    })

    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { id: "u1" },
      data: { displayName: "Nome Novo", personalArcana: null },
    })
  })

  it("keeps personalArcana when google name is unchanged", async () => {
    mockDbRows({
      name: "Maria Silva",
      displayName: null,
      avatar: null,
      birthDate: new Date("1990-06-15"),
    })

    await enrichUserFromOAuthProfile("u1", { name: "Maria Silva" })

    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { id: "u1" },
      data: { displayName: "Maria Silva" },
    })
  })

  it("trims and strips control/zero-width chars from the google name", async () => {
    mockDbRows({
      name: null,
      displayName: null,
      avatar: null,
      birthDate: null,
    })

    await enrichUserFromOAuthProfile("u1", {
      name: "  \u200B Maria \n Silva  ",
    })

    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { id: "u1" },
      data: {
        name: "Maria  Silva",
        displayName: "Maria  Silva",
      },
    })
  })

  it("ignores an oversized google name (unbounded claim)", async () => {
    mockDbRows({
      name: null,
      displayName: null,
      avatar: null,
      birthDate: null,
    })

    await enrichUserFromOAuthProfile("u1", {
      name: "X".repeat(121),
    })

    expect(prismaMock.user.update).not.toHaveBeenCalled()
  })

  it("ignores non-https / off-allowlist avatar URLs but still processes valid name", async () => {
    mockDbRows({
      name: null,
      displayName: null,
      avatar: null,
      birthDate: null,
    })

    await enrichUserFromOAuthProfile("u1", {
      name: "Maria Silva",
      picture: "http://evil.example.com/avatar.png",
    })

    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { id: "u1" },
      data: {
        name: "Maria Silva",
        displayName: "Maria Silva",
      },
    })
  })

  it("is a no-op when user does not exist", async () => {
    prismaMock.user.findUnique.mockResolvedValue(null)

    await enrichUserFromOAuthProfile("u1", {
      name: "Maria Silva",
    })

    expect(prismaMock.user.update).not.toHaveBeenCalled()
  })
})
