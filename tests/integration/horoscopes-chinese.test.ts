// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { getChineseZodiac } from "@/lib/horoscopes/chinese"
import { civilDateBrt, civilIsoWeek } from "@/lib/horoscopes/dates"

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
  const { GET } = await import("@/app/api/v1/horoscopes/chinese/route")
  return GET(
    new Request(`http://localhost:3000/api/v1/horoscopes/chinese${query}`),
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
  compatibility: "cabra",
  date: civilDateBrt(0),
}

beforeEach(() => {
  vi.clearAllMocks()
  helpersMock.requireAuth.mockResolvedValue({ userId: "usr_1" })
  prismaMock.user.findUnique.mockResolvedValue({
    birthDate: new Date(Date.UTC(1990, 4, 21)),
    astrologicalSign: "Gêmeos",
  })
  prismaMock.horoscopeContent.findFirst.mockResolvedValue(null)
  prismaMock.horoscopeEntry.create.mockResolvedValue({ id: "entry_1" })
})

afterEach(() => {
  vi.resetModules()
})

describe("GET /api/v1/horoscopes/chinese (T106/T109)", () => {
  it("retorna 401 sem autenticação", async () => {
    helpersMock.requireAuth.mockResolvedValueOnce(
      Response.json(
        { error: { code: "AUTH_TOKEN_INVALID", message: "Token invalido" } },
        { status: 401 },
      ),
    )
    const res = await callGet("?animal=cavalo")
    expect(res.status).toBe(401)
    expect(prismaMock.horoscopeContent.findFirst).not.toHaveBeenCalled()
  })

  it("deriva o animal/elemento da data de nascimento quando animal não é informado", async () => {
    const res = await callGet()
    expect(res.status).toBe(200)
    const body = await res.json()

    // 1990-05-21 → Cavalo de Metal (após CNY 1990-01-27)
    // Element now capitalized: "Metal" instead of "metal"
    expect(body.horoscope).toMatchObject({
      type: "chinese",
      signId: "cavalo",
      element: "Metal",
      period: "daily",
      date: civilDateBrt(0),
      source: "fallback",
    })
    expect(body.horoscope.content.fallback).toBe(true)
    expect(body.horoscope.content.date).toBe(civilDateBrt(0))

    expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
      where: { id: "usr_1" },
      select: { birthDate: true },
    })
    expect(prismaMock.horoscopeContent.findFirst).toHaveBeenCalledWith({
      where: {
        type: "chinese",
        signId: "cavalo",
        element: "Metal",
        period: "daily",
        date: civilDateBrt(0),
      },
    })
    expect(prismaMock.horoscopeEntry.create).toHaveBeenCalledWith({
      data: {
        userId: "usr_1",
        type: "chinese",
        signId: "cavalo",
        element: "Metal",
        period: "daily",
      },
    })
  })

  it("animal explícito tem prioridade e dispensa o lookup do usuário", async () => {
    const res = await callGet("?animal=rato&element=Water")
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.horoscope.signId).toBe("rato")
    expect(body.horoscope.element).toBe("Water")
    expect(prismaMock.user.findUnique).not.toHaveBeenCalled()
  })

  it("usa elemento do animal fixo quando animal explícito mas sem elemento", async () => {
    const res = await callGet("?animal=cavalo")
    expect(res.status).toBe(200)
    const body = await res.json()
    // Cavalo tem fixedElement = fogo → capitalized "Fire"
    expect(body.horoscope.element).toBe("Fire")
    expect(prismaMock.user.findUnique).not.toHaveBeenCalled()
  })

  it("rejeita period inválido (422 VALIDATION_ERROR) antes do lookup", async () => {
    const res = await callGet("?animal=rato&period=yearly")
    expect(res.status).toBe(422)
    const body = await res.json()
    expect(body.error.code).toBe("VALIDATION_ERROR")
    expect(prismaMock.horoscopeContent.findFirst).not.toHaveBeenCalled()
  })

  it("rejeita date fora do formato do período (weekly exige YYYY-Www)", async () => {
    const res = await callGet("?animal=rato&period=weekly&date=2026-10-20")
    expect(res.status).toBe(422)
    const body = await res.json()
    expect(body.error.code).toBe("VALIDATION_ERROR")
    expect(prismaMock.horoscopeContent.findFirst).not.toHaveBeenCalled()
  })

  it("rejeita animal desconhecido", async () => {
    const res = await callGet("?animal=invalido")
    expect(res.status).toBe(422)
    const body = await res.json()
    expect(body.error.code).toBe("VALIDATION_ERROR")
  })

  it("usa a civil key da semana (civilIsoWeek) como default em weekly", async () => {
    const res = await callGet("?period=weekly&animal=rato")
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.horoscope.period).toBe("weekly")
    expect(body.horoscope.date).toBe(civilIsoWeek())
    // Elemento derivado do ano (2026 = Fire), não do fixedElement do animal
    const currentYear = new Date().getUTCFullYear()
    const stemIndex = (((currentYear - 4) % 10) + 10) % 10
    const elements = ["Wood", "Fire", "Earth", "Metal", "Water"]
    const expectedElement = elements[Math.floor(stemIndex / 2)]
    expect(prismaMock.horoscopeContent.findFirst).toHaveBeenCalledWith({
      where: {
        type: "chinese",
        signId: "rato",
        element: expectedElement,
        period: "weekly",
        date: civilIsoWeek(),
      },
    })
  })

  it("fallback semanal obedece o shape T035 (content.date civil, não a key)", async () => {
    const res = await callGet("?period=weekly&animal=rato")
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.horoscope.date).toBe(civilIsoWeek())
    expect(body.horoscope.content.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(body.horoscope.content.date).toBe(civilDateBrt(0))
  })

  it("retorna conteúdo gerado do banco com source generated", async () => {
    prismaMock.horoscopeContent.findFirst.mockResolvedValue({
      type: "chinese",
      signId: "cavalo",
      element: "Metal",
      period: "daily",
      date: civilDateBrt(0),
      content: {
        general: "texto gerado",
        love: "amor",
        career: "carreira",
        health: "saúde",
        luckyNumber: 7,
        luckyColor: "azul",
        mood: "calmo",
        compatibility: "cabra",
        date: civilDateBrt(0),
      },
    })
    const res = await callGet("?animal=cavalo&element=Metal")
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.horoscope.source).toBe("generated")
    expect(body.horoscope.content.general).toBe("texto gerado")
    expect(body.horoscope.content.fallback).toBeUndefined()
  })

  it("retorna 422 BIRTHDATE_REQUIRED sem birthDate e sem animal explícito", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      birthDate: null,
    })
    const res = await callGet()
    expect(res.status).toBe(422)
    const body = await res.json()
    expect(body.error.code).toBe("BIRTHDATE_REQUIRED")
    expect(prismaMock.horoscopeContent.findFirst).not.toHaveBeenCalled()
    expect(prismaMock.horoscopeEntry.create).not.toHaveBeenCalled()
  })

  it("retorna 500 em erro de banco", async () => {
    prismaMock.horoscopeContent.findFirst.mockRejectedValue(
      new Error("db down"),
    )
    const res = await callGet("?animal=rato")
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error.code).toBe("INTERNAL_ERROR")
  })
})

describe("GET /api/v1/horoscopes/my-horoscope inclui chinês (T094/T109)", () => {
  it("agrega os 3 sistemas com fallback quando não há rows", async () => {
    const { GET } = await import("@/app/api/v1/horoscopes/my-horoscope/route")
    const res = await GET(
      new Request("http://localhost:3000/api/v1/horoscopes/my-horoscope"),
    )
    expect(res.status).toBe(200)
    const body = await res.json()

    const zodiac = getChineseZodiac(1990, 5, 21)
    // my-horoscope endpoint returns lowercase Portuguese element (unlike chinese endpoint which capitalizes)
    const elementMap: Record<string, string> = {
      madeira: "madeira",
      fogo: "fogo",
      terra: "terra",
      metal: "metal",
      agua: "agua",
    }
    const expectedElement = elementMap[zodiac.element] ?? zodiac.element

    expect(body.chinese).toMatchObject({
      type: "chinese",
      signId: zodiac.animal,
      element: expectedElement,
      period: "daily",
      date: civilDateBrt(0),
      source: "fallback",
    })
    expect(body.chinese.content.fallback).toBe(true)
    expect(body.chinese.content.date).toBe(civilDateBrt(0))
    expect(body.chinese.content.general).toBeDefined()

    expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
      where: { id: "usr_1" },
      select: { birthDate: true, astrologicalSign: true },
    })
    expect(prismaMock.horoscopeContent.findFirst).toHaveBeenCalledTimes(3)
    expect(prismaMock.horoscopeEntry.create).not.toHaveBeenCalled()
  })

  it("lê rows geradas dos 3 sistemas com source generated", async () => {
    prismaMock.horoscopeContent.findFirst.mockImplementation(
      async ({
        where,
      }: {
        where: {
          type: string
          signId: string
          element: string | null
          period: string
          date: string
        }
      }) => ({
        type: where.type,
        signId: where.signId,
        element: where.element,
        period: where.period,
        date: where.date,
        content: { ...BASE_CONTENT },
      }),
    )

    const { GET } = await import("@/app/api/v1/horoscopes/my-horoscope/route")
    const res = await GET(
      new Request("http://localhost:3000/api/v1/horoscopes/my-horoscope"),
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.chinese.source).toBe("generated")
    expect(body.chinese.content.general).toBe("texto gerado")
  })

  it("sem birthDate: chinese/mayan null", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      birthDate: null,
      astrologicalSign: "Leão",
    })

    const { GET } = await import("@/app/api/v1/horoscopes/my-horoscope/route")
    const res = await GET(
      new Request("http://localhost:3000/api/v1/horoscopes/my-horoscope"),
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.chinese).toBeNull()
    expect(body.mayan).toBeNull()
    expect(prismaMock.horoscopeContent.findFirst).toHaveBeenCalledTimes(1)
  })

  it("aplica period/date query nos 3 lookups", async () => {
    const { GET } = await import("@/app/api/v1/horoscopes/my-horoscope/route")
    const res = await GET(
      new Request(
        "http://localhost:3000/api/v1/horoscopes/my-horoscope?period=weekly",
      ),
    )
    expect(res.status).toBe(200)

    const calls = prismaMock.horoscopeContent.findFirst.mock.calls
    expect(calls).toHaveLength(3)
    const types = calls.map((call) => call[0].where.type)
    expect(types).toEqual(["western", "chinese", "maya"])
    for (const call of calls) {
      expect(call[0].where.period).toBe("weekly")
      expect(call[0].where.date).toBe(civilIsoWeek())
    }
  })
})
