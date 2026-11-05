// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const prismaMock = vi.hoisted(() => ({
  horoscopeNotification: { findUnique: vi.fn(), upsert: vi.fn() },
}))
const helpersMock = vi.hoisted(() => ({ requireAuth: vi.fn() }))
const csrfMock = vi.hoisted(() => ({ enforceCsrf: vi.fn() }))
const rateMock = vi.hoisted(() => ({ enforceSocialLimit: vi.fn() }))

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }))
vi.mock("@/app/api/v1/users/_helpers", () => helpersMock)
vi.mock("@/lib/middleware/csrf", () => csrfMock)
vi.mock("@/lib/middleware/rate-limit", () => rateMock)

// T103 (RF-HORO-008): settings de notificação de horóscopo — GET lê o
// estado atual (ou defaults do schema: ocidental on, demais off, 07:00)
// para a UI não mostrar estado obsoleto; PATCH valida via Zod
// `{westernEnabled?, chineseEnabled?, mayaEnabled?, hour?: 0–23}` e
// upsert por userId único. Ordem canônica: CSRF → auth → Zod → rate
// (`notification`, janela compartilhada das rotas de notificação).

const SETTINGS_URL =
  "http://localhost:3000/api/v1/horoscopes/notifications/settings"
const DEFAULTS = {
  westernEnabled: true,
  chineseEnabled: false,
  mayaEnabled: false,
  hour: 7,
}

const authedRow = {
  id: "hn_1",
  userId: "usr_1",
  westernEnabled: false,
  chineseEnabled: true,
  mayaEnabled: false,
  hour: 10,
}

const rateAllowed = {
  allowed: true as const,
  headers: { "X-RateLimit-Remaining": "59" },
  check: { allowed: true, remaining: 59, limit: 60, resetAt: 0 },
}

async function callGet(): Promise<Response> {
  const { GET } =
    await import("@/app/api/v1/horoscopes/notifications/settings/route")
  return GET(new Request(SETTINGS_URL))
}

async function callPatch(body: string): Promise<Response> {
  const { PATCH } =
    await import("@/app/api/v1/horoscopes/notifications/settings/route")
  return PATCH(
    new Request(SETTINGS_URL, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body,
    }),
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  helpersMock.requireAuth.mockResolvedValue({ userId: "usr_1" })
  csrfMock.enforceCsrf.mockReturnValue(null)
  rateMock.enforceSocialLimit.mockResolvedValue(rateAllowed)
  prismaMock.horoscopeNotification.findUnique.mockResolvedValue(null)
  prismaMock.horoscopeNotification.upsert.mockResolvedValue(authedRow)
})

afterEach(() => {
  vi.resetModules()
})

describe("GET /api/v1/horoscopes/notifications/settings (T103)", () => {
  it("retorna 401 sem autenticação", async () => {
    helpersMock.requireAuth.mockResolvedValueOnce(
      Response.json(
        { error: { code: "AUTH_TOKEN_INVALID", message: "Token invalido" } },
        { status: 401 },
      ),
    )

    const res = await callGet()

    expect(res.status).toBe(401)
    expect(prismaMock.horoscopeNotification.findUnique).not.toHaveBeenCalled()
  })

  it("sem row cria defaults do schema (ocidental on, 07:00)", async () => {
    const res = await callGet()
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json).toEqual({ data: { settings: DEFAULTS } })
    expect(prismaMock.horoscopeNotification.findUnique).toHaveBeenCalledWith({
      where: { userId: "usr_1" },
    })
  })

  it("retorna a row existente", async () => {
    prismaMock.horoscopeNotification.findUnique.mockResolvedValue(authedRow)

    const res = await callGet()
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.data.settings).toEqual({
      westernEnabled: false,
      chineseEnabled: true,
      mayaEnabled: false,
      hour: 10,
    })
  })

  it("responde 500 quando o banco falha", async () => {
    prismaMock.horoscopeNotification.findUnique.mockRejectedValue(
      new Error("db down"),
    )

    const res = await callGet()
    const json = await res.json()

    expect(res.status).toBe(500)
    expect(json.error.code).toBe("INTERNAL_ERROR")
    expect(json.meta.requestId).toBeTruthy()
  })
})

describe("PATCH /api/v1/horoscopes/notifications/settings (T103)", () => {
  it("CSRF falha antes da auth (ordem canônica)", async () => {
    csrfMock.enforceCsrf.mockReturnValueOnce(
      Response.json(
        { error: { code: "CSRF_TOKEN_INVALID", message: "CSRF invalido" } },
        { status: 403 },
      ),
    )

    const res = await callPatch(JSON.stringify({ hour: 10 }))

    expect(res.status).toBe(403)
    expect(helpersMock.requireAuth).not.toHaveBeenCalled()
    expect(prismaMock.horoscopeNotification.upsert).not.toHaveBeenCalled()
  })

  it("retorna 401 sem autenticação", async () => {
    helpersMock.requireAuth.mockResolvedValueOnce(
      Response.json(
        { error: { code: "AUTH_TOKEN_INVALID", message: "Token invalido" } },
        { status: 401 },
      ),
    )

    const res = await callPatch(JSON.stringify({ hour: 10 }))

    expect(res.status).toBe(401)
    expect(prismaMock.horoscopeNotification.upsert).not.toHaveBeenCalled()
  })

  it("422 em hour fora de 0–23", async () => {
    const res = await callPatch(JSON.stringify({ hour: 24 }))
    const json = await res.json()

    expect(res.status).toBe(422)
    expect(json.error.code).toBe("VALIDATION_ERROR")
    expect(prismaMock.horoscopeNotification.upsert).not.toHaveBeenCalled()
  })

  it("422 em body vazio (ao menos um campo)", async () => {
    const res = await callPatch(JSON.stringify({}))
    const json = await res.json()

    expect(res.status).toBe(422)
    expect(json.error.code).toBe("VALIDATION_ERROR")
    expect(prismaMock.horoscopeNotification.upsert).not.toHaveBeenCalled()
  })

  it("422 em JSON malformado", async () => {
    const res = await callPatch("{invalid")
    const json = await res.json()

    expect(res.status).toBe(422)
    expect(json.error.code).toBe("VALIDATION_ERROR")
    expect(prismaMock.horoscopeNotification.upsert).not.toHaveBeenCalled()
  })

  it("429 quando o bucket notification estoura", async () => {
    rateMock.enforceSocialLimit.mockResolvedValue({
      allowed: false,
      headers: { "Retry-After": "42" },
      response: Response.json(
        { error: { code: "RATE_LIMITED", message: "Limite atingido" } },
        { status: 429, headers: { "Retry-After": "42" } },
      ),
    })

    const res = await callPatch(JSON.stringify({ hour: 10 }))

    expect(res.status).toBe(429)
    expect(rateMock.enforceSocialLimit).toHaveBeenCalledWith(
      expect.objectContaining({ limit: "notification", userId: "usr_1" }),
    )
    expect(prismaMock.horoscopeNotification.upsert).not.toHaveBeenCalled()
  })

  it("upsert parcial: só os campos informados (create herda defaults do schema)", async () => {
    const res = await callPatch(
      JSON.stringify({ westernEnabled: false, hour: 10 }),
    )
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(prismaMock.horoscopeNotification.upsert).toHaveBeenCalledWith({
      where: { userId: "usr_1" },
      create: {
        userId: "usr_1",
        westernEnabled: false,
        hour: 10,
      },
      update: { westernEnabled: false, hour: 10 },
    })
    expect(json).toEqual({
      data: {
        settings: {
          westernEnabled: false,
          chineseEnabled: true,
          mayaEnabled: false,
          hour: 10,
        },
      },
    })
  })

  it("todos os toggles + hora numa chamada só", async () => {
    const res = await callPatch(
      JSON.stringify({
        westernEnabled: true,
        chineseEnabled: true,
        mayaEnabled: true,
        hour: 0,
      }),
    )

    expect(res.status).toBe(200)
    expect(prismaMock.horoscopeNotification.upsert).toHaveBeenCalledWith({
      where: { userId: "usr_1" },
      create: {
        userId: "usr_1",
        westernEnabled: true,
        chineseEnabled: true,
        mayaEnabled: true,
        hour: 0,
      },
      update: {
        westernEnabled: true,
        chineseEnabled: true,
        mayaEnabled: true,
        hour: 0,
      },
    })
  })

  it("responde 500 quando o upsert falha", async () => {
    prismaMock.horoscopeNotification.upsert.mockRejectedValue(
      new Error("db down"),
    )

    const res = await callPatch(JSON.stringify({ hour: 10 }))
    const json = await res.json()

    expect(res.status).toBe(500)
    expect(json.error.code).toBe("INTERNAL_ERROR")
    expect(json.meta.requestId).toBeTruthy()
  })
})
