// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { civilDateBrt } from "@/lib/horoscopes/dates"

const prismaMock = vi.hoisted(() => ({
  user: { findUnique: vi.fn() },
  horoscopeContent: { findFirst: vi.fn() },
  horoscopeEntry: { create: vi.fn(), findMany: vi.fn() },
}))

const helpersMock = vi.hoisted(() => ({
  requireAuth: vi.fn(),
}))

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }))
vi.mock("@/app/api/v1/users/_helpers", () => helpersMock)

async function callGet(query = "") {
  const { GET } = await import("@/app/api/v1/horoscopes/maya/route")
  return GET(
    new Request(`http://localhost:3000/api/v1/horoscopes/maya${query}`),
  )
}

const BASE_CONTENT = {
  general: "texto gerado",
  love: "amor",
  career: "carreira",
  health: "saúde",
  luckyNumber: 7,
  luckyColor: "azul",
  mood: "calmo",
  compatibility: "123",
  date: civilDateBrt(0),
}

beforeEach(() => {
  vi.clearAllMocks()
  helpersMock.requireAuth.mockResolvedValue({ userId: "usr_1" })
  prismaMock.user.findUnique.mockResolvedValue({
    birthDate: new Date(Date.UTC(1990, 5, 15)),
  })
  prismaMock.horoscopeContent.findFirst.mockResolvedValue(null)
  prismaMock.horoscopeEntry.create.mockResolvedValue({ id: "entry_1" })
})

afterEach(() => {
  vi.resetModules()
})

describe("GET /api/v1/horoscopes/maya (T113/T116)", () => {
  it("retorna 401 sem autenticação", async () => {
    helpersMock.requireAuth.mockResolvedValueOnce(
      Response.json(
        { error: { code: "AUTH_TOKEN_INVALID", message: "Token invalido" } },
        { status: 401 },
      ),
    )
    const res = await callGet("?kinNumber=1")
    expect(res.status).toBe(401)
    expect(prismaMock.horoscopeContent.findFirst).not.toHaveBeenCalled()
  })

  it("deriva o kin da data de nascimento quando kinNumber não é informado", async () => {
    const res = await callGet()
    expect(res.status).toBe(200)
    const body = await res.json()

    // 1990-06-15 → Kin 255 (referência conhecida)
    expect(body.horoscope).toMatchObject({
      type: "maya",
      signId: "255",
      element: null,
      period: "daily",
      date: civilDateBrt(0),
      source: "fallback",
    })
    expect(body.horoscope.content.fallback).toBe(true)
    expect(body.horoscope.content.date).toBe(civilDateBrt(0))
    expect(body.horoscope.kin).toMatchObject({
      number: 255,
      seal: 14,
      tone: 8,
    })

    expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
      where: { id: "usr_1" },
      select: { birthDate: true },
    })
    expect(prismaMock.horoscopeContent.findFirst).toHaveBeenCalledWith({
      where: {
        type: "maya",
        signId: "255",
        element: null,
        period: "daily",
        date: civilDateBrt(0),
      },
    })
    expect(prismaMock.horoscopeEntry.create).toHaveBeenCalledWith({
      data: {
        userId: "usr_1",
        type: "maya",
        signId: "255",
        element: null,
        period: "daily",
      },
    })
  })

  it("usa kinNumber explícito quando informado na query", async () => {
    prismaMock.user.findUnique.mockResolvedValue(null)

    const res = await callGet("?kinNumber=1")
    expect(res.status).toBe(200)
    const body = await res.json()

    expect(body.horoscope).toMatchObject({
      type: "maya",
      signId: "1",
      period: "daily",
      date: civilDateBrt(0),
      source: "fallback",
    })
    expect(body.horoscope.kin).toMatchObject({
      number: 1,
      seal: 0,
      tone: 1,
    })

    expect(prismaMock.user.findUnique).not.toHaveBeenCalled()
  })

  it("retorna 422 para kinNumber fora de 1-260", async () => {
    const res = await callGet("?kinNumber=0")
    expect(res.status).toBe(422)
    const body = await res.json()
    expect(body.error.code).toBe("VALIDATION_ERROR")
  })

  it("retorna 422 para kinNumber maior que 260", async () => {
    const res = await callGet("?kinNumber=261")
    expect(res.status).toBe(422)
    const body = await res.json()
    expect(body.error.code).toBe("VALIDATION_ERROR")
  })

  it("usa kinNumber explícito com period semanal", async () => {
    prismaMock.user.findUnique.mockResolvedValue(null)

    const res = await callGet("?kinNumber=100&period=weekly")
    expect(res.status).toBe(200)
    const body = await res.json()

    expect(body.horoscope).toMatchObject({
      type: "maya",
      signId: "100",
      period: "weekly",
    })
  })

  it("usa kinNumber explícito com period mensal", async () => {
    prismaMock.user.findUnique.mockResolvedValue(null)

    const res = await callGet("?kinNumber=200&period=monthly")
    expect(res.status).toBe(200)
    const body = await res.json()

    expect(body.horoscope).toMatchObject({
      type: "maya",
      signId: "200",
      period: "monthly",
    })
  })

  it("retorna conteúdo gerado quando existe no banco (sem fallback)", async () => {
    prismaMock.horoscopeContent.findFirst.mockResolvedValue({
      type: "maya",
      signId: "255",
      element: null,
      period: "daily",
      date: civilDateBrt(0),
      content: {
        ...BASE_CONTENT,
        fallback: false,
      },
    })

    const res = await callGet()
    expect(res.status).toBe(200)
    const body = await res.json()

    expect(body.horoscope.source).toBe("generated")
    expect(body.horoscope.content.fallback).toBe(false)
    expect(body.horoscope.content.general).toBe("texto gerado")
  })

  it("ignora conteúdo malformado e usa fallback", async () => {
    prismaMock.horoscopeContent.findFirst.mockResolvedValue({
      type: "maya",
      signId: "255",
      element: null,
      period: "daily",
      date: civilDateBrt(0),
      content: { invalid: "data" },
    })

    const res = await callGet()
    expect(res.status).toBe(200)
    const body = await res.json()

    expect(body.horoscope.source).toBe("fallback")
    expect(body.horoscope.content.fallback).toBe(true)
  })

  it("registra HoroscopeEntry em best-effort (não falha se erro)", async () => {
    prismaMock.horoscopeEntry.create.mockRejectedValue(new Error("db error"))

    const res = await callGet()
    expect(res.status).toBe(200)
    const body = await res.json()

    expect(body.horoscope.type).toBe("maya")
  })

  it("retorna 500 em erro interno", async () => {
    prismaMock.horoscopeContent.findFirst.mockRejectedValue(
      new Error("db down"),
    )

    const res = await callGet()
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error.code).toBe("INTERNAL_ERROR")
  })
})
