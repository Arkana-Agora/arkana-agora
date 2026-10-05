// @vitest-environment node
import { generateKeyPairSync } from "node:crypto"
import { SignJWT } from "jose"
import { beforeEach, describe, expect, it, vi } from "vitest"

const getCachedMock = vi.hoisted(() => vi.fn())

vi.mock("../../socket-service/src/redis-auth", () => ({
  getCachedTokenVersion: getCachedMock,
}))

vi.mock("node:crypto", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:crypto")>()
  return { ...actual, createPublicKey: vi.fn(actual.createPublicKey) }
})

import { createPublicKey } from "node:crypto"

import { verifySocketToken } from "../../socket-service/src/auth"

const { publicKey, privateKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
})

const PUBLIC_KEY_PEM = publicKey.export({
  type: "spki",
  format: "pem",
}) as string

async function signToken(
  options: {
    sub?: string
    tokenVersion?: number | null
    expiresInSec?: number
    issuedAtOffsetSec?: number
    key?: typeof privateKey
  } = {},
): Promise<string> {
  const {
    sub = "usr_1",
    tokenVersion = 1,
    expiresInSec = 300,
    issuedAtOffsetSec = 0,
    key,
  } = options
  const nowSec = Math.floor(Date.now() / 1000)
  const jwt = new SignJWT(tokenVersion === null ? {} : { tokenVersion })
    .setProtectedHeader({ alg: "RS256" })
    .setSubject(sub)
    .setIssuedAt(nowSec + issuedAtOffsetSec)
    .setExpirationTime(nowSec + expiresInSec)
  return jwt.sign(key ?? privateKey)
}

describe("verifySocketToken (Crítico 5 — revogação no handshake)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getCachedMock.mockResolvedValue(null)
  })

  it("aceita token válido com cache miss (fail-open)", async () => {
    const token = await signToken()
    const claims = await verifySocketToken(token, PUBLIC_KEY_PEM, 900)
    expect(claims.userId).toBe("usr_1")
    expect(claims.tokenVersion).toBe(1)
    expect(claims.tokenExpiresAt).toBeGreaterThan(Date.now())
  })

  it("aceita quando o cache confere com a claim", async () => {
    getCachedMock.mockResolvedValue(1)
    const claims = await verifySocketToken(
      await signToken(),
      PUBLIC_KEY_PEM,
      900,
    )
    expect(claims.userId).toBe("usr_1")
  })

  it("rejeita quando o cache diverge (token revogado)", async () => {
    getCachedMock.mockResolvedValue(2)
    await expect(
      verifySocketToken(
        await signToken({ tokenVersion: 1 }),
        PUBLIC_KEY_PEM,
        900,
      ),
    ).rejects.toThrow("token_revogado")
  })

  it("rejeita token sem claim tokenVersion", async () => {
    await expect(
      verifySocketToken(
        await signToken({ tokenVersion: null }),
        PUBLIC_KEY_PEM,
        900,
      ),
    ).rejects.toThrow("token_sem_version")
  })

  it("rejeita assinatura de outra chave", async () => {
    const { privateKey: otherKey } = generateKeyPairSync("rsa", {
      modulusLength: 2048,
    })
    const token = await signToken({ key: otherKey })
    await expect(verifySocketToken(token, PUBLIC_KEY_PEM, 900)).rejects.toThrow(
      "token_invalido",
    )
  })

  it("rejeita token expirado", async () => {
    const token = await signToken({ expiresInSec: -60 })
    await expect(verifySocketToken(token, PUBLIC_KEY_PEM, 900)).rejects.toThrow(
      "token_invalido",
    )
  })

  it("rejeita token com iat além do TTL (maxTokenAge — revisão I-d)", async () => {
    // iat 2h atrás com exp ainda futuro: assinatura válida, mas a idade
    // passa do TTL do access token — defesa contra estender/expirar skew.
    const token = await signToken({
      issuedAtOffsetSec: -7200,
      expiresInSec: 3600,
    })
    await expect(verifySocketToken(token, PUBLIC_KEY_PEM, 900)).rejects.toThrow(
      "token_invalido",
    )
  })

  it("maxTokenAge segue o TTL passado pela env validada (revisão R2)", async () => {
    const token = await signToken({
      issuedAtOffsetSec: -7200,
      expiresInSec: 3600,
    })
    // TTL 900 (default): idade 2h > 900+60 → rejeita
    await expect(verifySocketToken(token, PUBLIC_KEY_PEM, 900)).rejects.toThrow(
      "token_invalido",
    )
    // TTL custom (env ACCESS_TOKEN_TTL_SECONDS=8000): 7200 < 8000+60 → aceita
    const claims = await verifySocketToken(token, PUBLIC_KEY_PEM, 8000)
    expect(claims.userId).toBe("usr_1")
  })

  it("clockTolerance 30s: aceita token expirado há menos de 30s", async () => {
    // skew de relógio entre emissor e verificador não derruba handshake
    const claims = await verifySocketToken(
      await signToken({ expiresInSec: -10 }),
      PUBLIC_KEY_PEM,
      900,
    )
    expect(claims.userId).toBe("usr_1")
  })

  it("reusa o KeyObject parseado por PEM (revisão I-d)", async () => {
    await verifySocketToken(await signToken(), PUBLIC_KEY_PEM, 900)
    const before = vi.mocked(createPublicKey).mock.calls.length
    await verifySocketToken(await signToken(), PUBLIC_KEY_PEM, 900)
    await verifySocketToken(await signToken(), PUBLIC_KEY_PEM, 900)
    expect(vi.mocked(createPublicKey).mock.calls.length).toBe(before)
  })
})
