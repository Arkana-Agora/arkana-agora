import { beforeEach, describe, expect, it, vi } from "vitest"

const prismaMock = vi.hoisted(() => ({
  user: { findUnique: vi.fn() },
}))

const tokenServiceMock = vi.hoisted(() => ({
  verifyAccessToken: vi.fn(),
}))

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }))
vi.mock("@/services/token-service", () => ({
  ...tokenServiceMock,
  AuthTokenError: class AuthTokenError extends Error {
    constructor(
      public code: string,
      message: string,
    ) {
      super(message)
      this.name = "AuthTokenError"
    }
  },
}))

import { optionalAuth } from "@/app/api/v1/users/_helpers"
import { AuthTokenError } from "@/services/token-service"

describe("optionalAuth", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  it("retorna null quando nao ha header Authorization", async () => {
    const req = new Request("http://localhost:3000/api/test")
    const result = await optionalAuth(req)
    expect(result).toBeNull()
  })

  it("retorna null quando header Authorization esta vazio", async () => {
    const req = new Request("http://localhost:3000/api/test", {
      headers: { Authorization: "" },
    })
    const result = await optionalAuth(req)
    expect(result).toBeNull()
  })

  it("retorna null quando header Authorization nao comeca com Bearer", async () => {
    const req = new Request("http://localhost:3000/api/test", {
      headers: { Authorization: "Basic dXNlcjpwYXNz" },
    })
    const result = await optionalAuth(req)
    expect(result).toBeNull()
  })

  it("retorna userId quando token e valido e usuario nao banido/nao deletado", async () => {
    tokenServiceMock.verifyAccessToken.mockResolvedValue({ userId: "usr_1" })
    prismaMock.user.findUnique.mockResolvedValue({
      isBanned: false,
      deletedAt: null,
      isActive: true,
    })

    const req = new Request("http://localhost:3000/api/test", {
      headers: { Authorization: "Bearer valid.jwt.token" },
    })
    const result = await optionalAuth(req)

    expect(result).toBe("usr_1")
    expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
      where: { id: "usr_1" },
      select: { isBanned: true, deletedAt: true, isActive: true },
    })
  })

  it("retorna null quando token expirou", async () => {
    const error = new AuthTokenError("TOKEN_EXPIRED", "Token expirado")
    tokenServiceMock.verifyAccessToken.mockRejectedValue(error)

    const req = new Request("http://localhost:3000/api/test", {
      headers: { Authorization: "Bearer expired.jwt.token" },
    })
    const result = await optionalAuth(req)

    expect(result).toBeNull()
  })

  it("retorna null quando token malformado", async () => {
    const error = new AuthTokenError("TOKEN_MALFORMED", "Token malformado")
    tokenServiceMock.verifyAccessToken.mockRejectedValue(error)

    const req = new Request("http://localhost:3000/api/test", {
      headers: { Authorization: "Bearer malformed.token" },
    })
    const result = await optionalAuth(req)

    expect(result).toBeNull()
  })

  it("retorna null quando usuario esta banido", async () => {
    tokenServiceMock.verifyAccessToken.mockResolvedValue({ userId: "usr_1" })
    prismaMock.user.findUnique.mockResolvedValue({
      isBanned: true,
      deletedAt: null,
    })

    const req = new Request("http://localhost:3000/api/test", {
      headers: { Authorization: "Bearer valid.jwt.token" },
    })
    const result = await optionalAuth(req)

    expect(result).toBeNull()
  })

  it("retorna null quando usuario tem soft-delete (deletedAt)", async () => {
    tokenServiceMock.verifyAccessToken.mockResolvedValue({ userId: "usr_1" })
    prismaMock.user.findUnique.mockResolvedValue({
      isBanned: false,
      deletedAt: new Date(),
    })

    const req = new Request("http://localhost:3000/api/test", {
      headers: { Authorization: "Bearer valid.jwt.token" },
    })
    const result = await optionalAuth(req)

    expect(result).toBeNull()
  })

  it("retorna null quando usuario nao encontrado (hard delete)", async () => {
    tokenServiceMock.verifyAccessToken.mockResolvedValue({ userId: "usr_1" })
    prismaMock.user.findUnique.mockResolvedValue(null)

    const req = new Request("http://localhost:3000/api/test", {
      headers: { Authorization: "Bearer valid.jwt.token" },
    })
    const result = await optionalAuth(req)

    expect(result).toBeNull()
  })

  it("retorna null quando usuario esta inativo (isActive=false)", async () => {
    tokenServiceMock.verifyAccessToken.mockResolvedValue({ userId: "usr_1" })
    prismaMock.user.findUnique.mockResolvedValue({
      isBanned: false,
      deletedAt: null,
      isActive: false,
    })

    const req = new Request("http://localhost:3000/api/test", {
      headers: { Authorization: "Bearer valid.jwt.token" },
    })
    const result = await optionalAuth(req)

    expect(result).toBeNull()
  })

  it("propaga erro inesperado de infra (nao mascara como anonimo)", async () => {
    tokenServiceMock.verifyAccessToken.mockRejectedValue(
      new Error("Erro generico"),
    )

    const req = new Request("http://localhost:3000/api/test", {
      headers: { Authorization: "Bearer valid.jwt.token" },
    })

    await expect(optionalAuth(req)).rejects.toThrow("Erro generico")
  })

  it("propaga AuthTokenError de configuracao (AUTH_CONFIG_*)", async () => {
    tokenServiceMock.verifyAccessToken.mockRejectedValue(
      new AuthTokenError("AUTH_CONFIG_KEY_MISSING", "chave JWT ausente"),
    )

    const req = new Request("http://localhost:3000/api/test", {
      headers: { Authorization: "Bearer valid.jwt.token" },
    })

    await expect(optionalAuth(req)).rejects.toThrow()
  })
})
