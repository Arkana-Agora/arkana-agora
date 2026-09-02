import { describe, expect, it, vi, beforeEach, afterEach } from "vitest"
import { createHash } from "node:crypto"

const redisMock = vi.hoisted(() => ({
  get: vi.fn(),
  set: vi.fn(),
  incr: vi.fn(),
}))

const prismaMock = vi.hoisted(() => ({
  user: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
  },
  session: {
    create: vi.fn(),
    findUnique: vi.fn(),
    updateMany: vi.fn(),
  },
}))

vi.mock("@/lib/redis", () => ({ redis: redisMock }))
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }))

const PRIVATE_KEY = `-----BEGIN PRIVATE KEY-----
MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC7JX6HR6mzNmVF
NqmbibR2nP6w7oaKYjPKPHvobfwqs2IE6x7h1K3h3rdFx9O8N0wCdA95w86VHSvV
Anwmxt38gAWoK4WXcU7f4BO9OFlrfmtRpwXy4WOZF4TVjXFiH2499T1I5SoH77R7
BXOJoOFC4XIcH0nymBOuP0OE3d+C9VQi2P+UgHxNZauTEI2VEuY117Wfq6bFZecA
bqMOv9FoYVCEM6pWRMICKkaJs6flCzIRXnOQPUGWS9cqPhB4zEgoEXWSQm9v6jBc
yYJslhPekl5kg8B5Z1hXJnTL8QxD2eLRIzPiyxbiRRgX3IRBA0Gx57FVJSRtXcSo
QSWGk/HJAgMBAAECggEAE3n89449OoH0OyZLs3y608dV+ErypI9AzZDK4m8j2bvO
fS2NCrqsGAAqObBouENW/UBf5e+7XahqCeKW0iBLNP6L2CsjXZX0u/bhhwVIxRek
ipxj0ZmkWGfqsqDkRm539inCJYZ3/9hyA4WXNyEPoHq++e9FrmImVjGOUNMYclPw
+mtQy4xEHWL0FDjIVFVs1RctP++JRlSJ4rEYOJewOXvBT7WO+bCx2MRd7y/PgxH2
R9ML9LBpVcjZYMI8r2w4x3LtYeEMjQPK7CIbpzntq6hZ1slNh13mR8uQzYlOSfHk
sb45gs5aQHcywLWdjm6mPXRJBrhUau2CwD+VXqcEmwKBgQD2hY2uS5pj0vDZtZJU
FFJmq46IAjSvWJJy0SZbbO/GCXDPOKT5q4puolzLxzdbP/TEBJDt065OITKYNtgf
LLjyJYDC4JFRx63CibgAwjY6U7nbJ3iuOSnN3qp8yB+wjvNU0lfni8lb8wdgSwLc
DqqA8qXCsJtHyQJWWGklITzP/wKBgQDCV4bDX8rNZ6FpTtT2q2GDLi1j7CTQzscY
2yade96KFDEDyHmgbJWFtWjTJmkOSWl6sCz16qLhbwx6cB566MOppd4Um8scV1Ge
hwrVX1KCpez4AFOrNsjXq6rh7CE8qB0Mde4Gu2pCjSXpzH+kB1M6naUdxC9cyrgw
cj/yf9y+NwKBgQDz1vZlSHLV+ngxX9/1OoSm+VpqPYRPTJTO7QG7vO0OPZhP3/+O
1ZaACCkxh0PCBmjc2odgNtlafovE87qiW2I0YdQS7n3PHmtI2WAfn/pzhw13MHu2
GOS4tV59PpXZ1gvqAoTgiuwI/0J0hL23XOpZ0akUAgwV3UVqktit2UqFkQKBgQC3
DwMd3YmGWess6tinUV+U1VZkHPfAyEW6IBQLm7ZPkh1pVtlaR23AeNS4sCGdF4GH
05NGQTIT7ypt2labp81Ga7r45pc3pvh2vvVxb0ylS+4e3Q/y4rPkkwtvq6DTJffW
2O7Q4JCDB7mCtOI2e7/mIsB5fWavnTRKThP2NIKVmQKBgF/nKBX+qXM/7WEHjJMQ
Bzckr8J2M88OWyqnaTXqvjevCqD62EK3UVLPYuKXrd5TLJ0ycbkgORxKvKX+kMLC
TDSSfJdeN3BduuAPBlk91vJrxx6wUksPba/72K6FIkCqhmokZB01JbKCP+e1hBdY
O1uY+yrb715gSk0/Hsvf0wmh
-----END PRIVATE KEY-----`

const PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAuyV+h0epszZlRTapm4m0
dpz+sO6GimIzyjx76G38KrNiBOse4dSt4d63RcfTvDdMAnQPecPOlR0r1QJ8Jsbd
/IAFqCuFl3FO3+ATvThZa35rUacF8uFjmReE1Y1xYh9uPfU9SOUqB++0ewVziaDh
QuFyHB9J8pgTrj9DhN3fgvVUItj/lIB8TWWrkxCNlRLmNde1n6umxWXnAG6jDr/R
aGFQhDOqVkTCAipGibOn5QsyEV5zkD1BlkvXKj4QeMxIKBF1kkJvb+owXMmCbJYT
3pJeZIPAeWdYVyZ0y/EMQ9ni0SMz4ssW4kUYF9yEQQNBseexVSUkbV3EqEElhpPx
yQIDAQAB
-----END PUBLIC KEY-----`

const createdUser = {
  id: "usr_1",
  name: "Maria Silva",
  email: "maria@email.com",
  emailVerified: new Date(),
  passwordHash: "$2a$12$abc",
  role: "USER",
  plan: "FREE",
  provider: "EMAIL",
  providerId: "maria@email.com",
  isActive: true,
  deletedAt: null,
  tokenVersion: 0,
}

beforeEach(() => {
  vi.stubEnv("JWT_PRIVATE_KEY", PRIVATE_KEY)
  vi.stubEnv("JWT_PUBLIC_KEY", PUBLIC_KEY)
  vi.clearAllMocks()
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.resetModules()
})

describe("token service T7a", () => {
  it("sha256 produz hash hex de 64 chars do valor", async () => {
    const { sha256 } = await import("@/services/token-service")
    const hash = sha256("refresh-abc")
    expect(hash).toHaveLength(64)
    expect(hash).toMatch(/^[0-9a-f]{64}$/)
    const expected = createHash("sha256").update("refresh-abc").digest("hex")
    expect(hash).toBe(expected)
  })

  it("signAccessToken emite JWT RS256 valido com claims e exp de 15min", async () => {
    const { signAccessToken } = await import("@/services/token-service")
    const token = await signAccessToken({ ...createdUser })

    expect(typeof token).toBe("string")
    const segments = token.split(".")
    expect(segments).toHaveLength(3)

    const payload = JSON.parse(
      Buffer.from(segments[1]!, "base64url").toString("utf8"),
    )
    expect(payload.sub).toBe("usr_1")
    expect(payload.role).toBe("USER")
    expect(payload.plan).toBe("FREE")
    expect(payload.tokenVersion).toBe(0)
    const ttl = payload.exp - payload.iat
    expect(ttl).toBe(15 * 60)
  })
})

describe("token service T7a - verifyAccessToken", () => {
  it("verifica token valido e retorna claims (Redis cache confere)", async () => {
    redisMock.get.mockResolvedValue("0")
    const { signAccessToken, verifyAccessToken } =
      await import("@/services/token-service")
    const token = await signAccessToken({ ...createdUser })

    const result = await verifyAccessToken(token)

    expect(redisMock.get).toHaveBeenCalledWith("auth:tokenVersion:usr_1")
    expect(result).toEqual({
      userId: "usr_1",
      role: "USER",
      plan: "FREE",
      tokenVersion: 0,
    })
  })

  it("rejeita token sem claim tokenVersion inteira (fail-closed, nunca normaliza p/ 0)", async () => {
    redisMock.get.mockResolvedValue("0")
    const { signAccessToken, verifyAccessToken } =
      await import("@/services/token-service")
    const token = await signAccessToken({ ...createdUser })
    const [header, , signature] = token.split(".")
    const forgedPayload = Buffer.from(
      JSON.stringify({ sub: "usr_1", role: "USER", plan: "FREE" }),
    ).toString("base64url")
    const forged = `${header}.${forgedPayload}.${signature}`

    await expect(verifyAccessToken(forged)).rejects.toThrow(
      /AUTH_TOKEN_INVALID/,
    )
  })

  it("rejeita tokenVersion divergente do cache Redis", async () => {
    redisMock.get.mockResolvedValue("3")
    const { signAccessToken, verifyAccessToken } =
      await import("@/services/token-service")
    const token = await signAccessToken({ ...createdUser })

    await expect(verifyAccessToken(token)).rejects.toThrow(/AUTH_TOKEN_REVOKED/)
  })

  it("cai p/ DB quando Redis da miss e aceita se tokenVersion e flags OK", async () => {
    redisMock.get.mockResolvedValue(null)
    prismaMock.user.findUnique.mockResolvedValue({
      id: "usr_1",
      tokenVersion: 0,
      isActive: true,
      deletedAt: null,
      role: "USER",
    })
    const { signAccessToken, verifyAccessToken } =
      await import("@/services/token-service")
    const token = await signAccessToken({ ...createdUser })

    const result = await verifyAccessToken(token)

    expect(prismaMock.user.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "usr_1" } }),
    )
    expect(result.role).toBe("USER")
  })

  it("DB rejeita tokenVersion divergente (nunca fail-open em erro de Redis)", async () => {
    redisMock.get.mockRejectedValue(new Error("redis down"))
    prismaMock.user.findUnique.mockResolvedValue({
      id: "usr_1",
      tokenVersion: 5,
      isActive: true,
      deletedAt: null,
      role: "USER",
    })
    const { signAccessToken, verifyAccessToken } =
      await import("@/services/token-service")
    const token = await signAccessToken({ ...createdUser })

    await expect(verifyAccessToken(token)).rejects.toThrow(/AUTH_TOKEN_REVOKED/)
  })

  it("rejeita usuario soft-deletado (isActive=false) no fallback de DB", async () => {
    redisMock.get.mockResolvedValue(null)
    prismaMock.user.findUnique.mockResolvedValue({
      id: "usr_1",
      tokenVersion: 0,
      isActive: false,
      deletedAt: new Date(),
      role: "USER",
    })
    const { signAccessToken, verifyAccessToken } =
      await import("@/services/token-service")
    const token = await signAccessToken({ ...createdUser })

    await expect(verifyAccessToken(token)).rejects.toThrow(/AUTH_TOKEN_REVOKED/)
  })

  it("rejeita assinatura invalida / token adulterado", async () => {
    redisMock.get.mockResolvedValue("0")
    const { verifyAccessToken } = await import("@/services/token-service")

    await expect(
      verifyAccessToken("aaaaaaaa.bbbbbbbb.cccccccc"),
    ).rejects.toThrow(/AUTH_TOKEN_INVALID/)
  })

  it("rejeita token expirado", async () => {
    redisMock.get.mockResolvedValue("0")
    const { SignJWT } = await import("jose")
    const { createPrivateKey } = await import("node:crypto")
    const { verifyAccessToken } = await import("@/services/token-service")
    const expired = await new SignJWT({
      role: "USER",
      plan: "FREE",
      tokenVersion: 0,
    })
      .setProtectedHeader({ alg: "RS256" })
      .setSubject("usr_1")
      .setIssuedAt(Math.floor(Date.now() / 1000) - 3600)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 60)
      .sign(createPrivateKey(PRIVATE_KEY))

    await expect(verifyAccessToken(expired)).rejects.toThrow(
      /AUTH_TOKEN_INVALID/,
    )
  })

  it("rejeita token com claim tokenVersion nao-inteira (0.5)", async () => {
    redisMock.get.mockResolvedValue("0")
    const { SignJWT } = await import("jose")
    const { createPrivateKey } = await import("node:crypto")
    const { verifyAccessToken } = await import("@/services/token-service")
    const bad = await new SignJWT({
      role: "USER",
      plan: "FREE",
      tokenVersion: 0.5,
    })
      .setProtectedHeader({ alg: "RS256" })
      .setSubject("usr_1")
      .setIssuedAt()
      .setExpirationTime(Math.floor(Date.now() / 1000) + 900)
      .sign(createPrivateKey(PRIVATE_KEY))

    await expect(verifyAccessToken(bad)).rejects.toThrow(/AUTH_TOKEN_INVALID/)
  })
})

describe("token service T7a - createRefreshSession", () => {
  it("cria Session com tokenHash sha256, familyId, tokenId e exp de 30 dias", async () => {
    prismaMock.session.create.mockResolvedValue({ id: "sess_1" })
    const { createRefreshSession } = await import("@/services/token-service")

    const before = Date.now()
    const session = await createRefreshSession("usr_1", {
      userAgent: "vitest",
      ip: "127.0.0.1",
    })
    const after = Date.now()

    const createCall = prismaMock.session.create.mock.calls[0]?.[0]
    expect(prismaMock.session.create).toHaveBeenCalledTimes(1)
    expect(createCall.data.userId).toBe("usr_1")
    expect(createCall.data.userAgent).toBe("vitest")
    expect(createCall.data.ipAddress).toBe("127.0.0.1")
    expect(createCall.data.tokenHash).toMatch(/^[0-9a-f]{64}$/)
    expect(createCall.data.familyId).toBeTruthy()
    expect(createCall.data.tokenId).toBeTruthy()
    const exp = new Date(createCall.data.expiresAt).getTime()
    expect(exp - before).toBeGreaterThan(29 * 24 * 60 * 60 * 1000)
    expect(exp - after).toBeLessThanOrEqual(30 * 24 * 60 * 60 * 1000)

    expect(session.rawToken).toBeTruthy()
    expect(session.tokenHash).toBe(createCall.data.tokenHash)
    expect(session.familyId).toBe(createCall.data.familyId)
  })
})

describe("token service T7a - rotateRefresh", () => {
  const sessionRow = (over = {}) => ({
    id: "sess_1",
    userId: "usr_1",
    tokenHash: "h".repeat(64),
    familyId: "fam_1",
    tokenId: "tok_1",
    replacedByTokenId: null,
    revokedAt: null,
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    userAgent: null,
    ipAddress: null,
    ...over,
  })

  it("rotaciona refresh: novo token mesmo familyId, revoga anterior condicionalmente, retorna access", async () => {
    prismaMock.session.findUnique.mockResolvedValue(sessionRow())
    prismaMock.session.updateMany.mockResolvedValue({ count: 1 })
    prismaMock.user.findUnique.mockResolvedValue({
      id: "usr_1",
      role: "USER",
      plan: "FREE",
      tokenVersion: 0,
      isActive: true,
      deletedAt: null,
    })
    prismaMock.session.create.mockResolvedValue({ id: "sess_2" })
    redisMock.get.mockResolvedValue("0")

    const { rotateRefresh } = await import("@/services/token-service")
    const result = await rotateRefresh("raw-refresh-token")

    expect(result.accessToken).toBeTruthy()
    expect(result.refreshToken).toBeTruthy()
    expect(prismaMock.session.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "sess_1", replacedByTokenId: null },
      }),
    )
    expect(prismaMock.session.create).toHaveBeenCalledTimes(1)
    const newCall = prismaMock.session.create.mock.calls[0]?.[0]
    expect(newCall.data.familyId).toBe("fam_1")
  })

  it("reusa token ja rotacionado (replacedByTokenId setado) revoga a familia toda e lanca AUTH_REFRESH_TOKEN_REVOKED", async () => {
    prismaMock.session.findUnique.mockResolvedValue(
      sessionRow({ replacedByTokenId: "tok_2" }),
    )
    const { rotateRefresh } = await import("@/services/token-service")

    await expect(rotateRefresh("old-token")).rejects.toThrow(
      /AUTH_REFRESH_TOKEN_REVOKED/,
    )
    expect(prismaMock.session.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { familyId: "fam_1" },
        data: expect.objectContaining({ revokedAt: expect.anything() }),
      }),
    )
  })

  it("rejeita refresh token inexistente", async () => {
    prismaMock.session.findUnique.mockResolvedValue(null)
    const { rotateRefresh } = await import("@/services/token-service")

    await expect(rotateRefresh("nope")).rejects.toThrow(
      /AUTH_REFRESH_TOKEN_INVALID/,
    )
  })

  it("rejeita refresh token expirado", async () => {
    prismaMock.session.findUnique.mockResolvedValue(
      sessionRow({ expiresAt: new Date(Date.now() - 1000) }),
    )
    const { rotateRefresh } = await import("@/services/token-service")

    await expect(rotateRefresh("expired")).rejects.toThrow(
      /AUTH_REFRESH_TOKEN_EXPIRED/,
    )
  })

  it("rejeita usuario inativo/deletado (nao re-autentica na janela LGPD)", async () => {
    prismaMock.session.findUnique.mockResolvedValue(sessionRow())
    prismaMock.session.updateMany.mockResolvedValue({ count: 1 })
    prismaMock.user.findUnique.mockResolvedValue({
      id: "usr_1",
      role: "USER",
      plan: "FREE",
      tokenVersion: 0,
      isActive: false,
      deletedAt: new Date(),
    })
    const { rotateRefresh } = await import("@/services/token-service")

    await expect(rotateRefresh("suspended")).rejects.toThrow(
      /AUTH_ACCOUNT_SUSPENDED/,
    )
  })

  it("rotação condicional falha (count 0) = reuso -> revoga familia", async () => {
    prismaMock.session.findUnique.mockResolvedValue(sessionRow())
    prismaMock.session.updateMany.mockResolvedValue({ count: 0 })
    prismaMock.user.findUnique.mockResolvedValue({
      id: "usr_1",
      role: "USER",
      plan: "FREE",
      tokenVersion: 0,
      isActive: true,
      deletedAt: null,
    })
    const { rotateRefresh } = await import("@/services/token-service")

    await expect(rotateRefresh("race")).rejects.toThrow(
      /AUTH_REFRESH_TOKEN_REVOKED/,
    )
  })

  it("usa claims frescas do DB (tokenVersion atualizado) ao cunhar access", async () => {
    prismaMock.session.findUnique.mockResolvedValue(sessionRow())
    prismaMock.session.updateMany.mockResolvedValue({ count: 1 })
    prismaMock.user.findUnique.mockResolvedValue({
      id: "usr_1",
      role: "ADMIN",
      plan: "PLUS",
      tokenVersion: 7,
      isActive: true,
      deletedAt: null,
    })
    prismaMock.session.create.mockResolvedValue({ id: "sess_2" })

    const { rotateRefresh } = await import("@/services/token-service")
    const result = await rotateRefresh("rotated")

    const payload = JSON.parse(
      Buffer.from(result.accessToken.split(".")[1]!, "base64url").toString(
        "utf8",
      ),
    )
    expect(payload.role).toBe("ADMIN")
    expect(payload.tokenVersion).toBe(7)
  })
})

describe("token service T7a - bumpTokenVersion", () => {
  it("incrementa tokenVersion atomicamente e espelha no Redis", async () => {
    prismaMock.user.update.mockResolvedValue({
      id: "usr_1",
      tokenVersion: 1,
    })
    const { bumpTokenVersion } = await import("@/services/token-service")

    await bumpTokenVersion("usr_1")

    expect(prismaMock.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "usr_1" },
        data: { tokenVersion: { increment: 1 } },
      }),
    )
    expect(redisMock.set).toHaveBeenCalledWith(
      "auth:tokenVersion:usr_1",
      "1",
      "EX",
      expect.any(Number),
    )
  })
})
