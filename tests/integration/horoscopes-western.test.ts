// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { calculateKinMaya } from "@/lib/calculations/kin-maya"
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
  const { GET } = await import("@/app/api/v1/horoscopes/western/route")
  return GET(
    new Request(`http://localhost:3000/api/v1/horoscopes/western${query}`),
  )
}

async function callMy(query = "") {
  const { GET } = await import("@/app/api/v1/horoscopes/my-horoscope/route")
  return GET(
    new Request(`http://localhost:3000/api/v1/horoscopes/my-horoscope${query}`),
  )
}

async function callHistory(query = "") {
  const { GET } = await import("@/app/api/v1/horoscopes/history/route")
  return GET(
    new Request(`http://localhost:3000/api/v1/horoscopes/history${query}`),
  )
}

function makeEntry(
  id: string,
  createdAt: Date,
  overrides: Record<string, unknown> = {},
) {
  return {
    id,
    userId: "usr_1",
    type: "western",
    signId: "aries",
    element: null,
    period: "daily",
    createdAt,
    ...overrides,
  }
}

const BASE_CONTENT = {
  general: "texto gerado",
  love: "amor",
  career: "carreira",
  health: "saúde",
  luckyNumber: 7,
  luckyColor: "azul",
  mood: "calmo",
  compatibility: "x",
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

describe("GET /api/v1/horoscopes/western (T093/T100)", () => {
  it("retorna 401 sem autenticação", async () => {
    helpersMock.requireAuth.mockResolvedValueOnce(
      Response.json(
        { error: { code: "AUTH_TOKEN_INVALID", message: "Token invalido" } },
        { status: 401 },
      ),
    )
    const res = await callGet("?sign=aries")
    expect(res.status).toBe(401)
    expect(prismaMock.horoscopeContent.findFirst).not.toHaveBeenCalled()
  })

  it("deriva o signo da data de nascimento quando sign não é informado", async () => {
    const res = await callGet()
    expect(res.status).toBe(200)
    const body = await res.json()

    expect(body.horoscope).toMatchObject({
      type: "western",
      signId: "gemeos",
      element: null,
      period: "daily",
      date: civilDateBrt(0),
      source: "fallback",
    })
    expect(body.horoscope.content.fallback).toBe(true)
    expect(body.horoscope.content.date).toBe(civilDateBrt(0))
    expect(body.compatibility).toBeUndefined()

    expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
      where: { id: "usr_1" },
      select: { birthDate: true, astrologicalSign: true },
    })
    expect(prismaMock.horoscopeContent.findFirst).toHaveBeenCalledWith({
      where: {
        type: "western",
        signId: "gemeos",
        element: null,
        period: "daily",
        date: civilDateBrt(0),
      },
    })
    expect(prismaMock.horoscopeEntry.create).toHaveBeenCalledWith({
      data: {
        userId: "usr_1",
        type: "western",
        signId: "gemeos",
        element: null,
        period: "daily",
      },
    })
  })

  it("sign explícito tem prioridade e dispensa o lookup do usuário", async () => {
    const res = await callGet("?sign=aries")
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.horoscope.signId).toBe("aries")
    expect(prismaMock.user.findUnique).not.toHaveBeenCalled()
    expect(body.compatibility).toBeUndefined()
  })

  it("usa astrologicalSign salvo quando não há birthDate", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      birthDate: null,
      astrologicalSign: "Leão",
    })
    const res = await callGet()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.horoscope.signId).toBe("leao")
  })

  it("retorna 422 BIRTHDATE_REQUIRED sem dados astrologicos", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      birthDate: null,
      astrologicalSign: null,
    })
    const res = await callGet()
    expect(res.status).toBe(422)
    const body = await res.json()
    expect(body.error.code).toBe("BIRTHDATE_REQUIRED")
    expect(prismaMock.horoscopeContent.findFirst).not.toHaveBeenCalled()
    expect(prismaMock.horoscopeEntry.create).not.toHaveBeenCalled()
  })

  it("rejeita period inválido (422 VALIDATION_ERROR) antes do lookup", async () => {
    const res = await callGet("?sign=aries&period=yearly")
    expect(res.status).toBe(422)
    const body = await res.json()
    expect(body.error.code).toBe("VALIDATION_ERROR")
    expect(prismaMock.horoscopeContent.findFirst).not.toHaveBeenCalled()
  })

  it("rejeita date fora do formato do período (weekly exige YYYY-Www)", async () => {
    const res = await callGet("?sign=aries&period=weekly&date=2026-10-20")
    expect(res.status).toBe(422)
    const body = await res.json()
    expect(body.error.code).toBe("VALIDATION_ERROR")
    expect(prismaMock.horoscopeContent.findFirst).not.toHaveBeenCalled()
  })

  it("rejeita sign desconhecido", async () => {
    const res = await callGet("?sign=invalido")
    expect(res.status).toBe(422)
    const body = await res.json()
    expect(body.error.code).toBe("VALIDATION_ERROR")
  })

  it("rejeita targetSign desconhecido", async () => {
    const res = await callGet("?sign=aries&targetSign=invalido")
    expect(res.status).toBe(422)
    const body = await res.json()
    expect(body.error.code).toBe("VALIDATION_ERROR")
  })

  it("usa a civil key da semana (civilIsoWeek) como default em weekly", async () => {
    const res = await callGet("?period=weekly&sign=aries")
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.horoscope.period).toBe("weekly")
    expect(body.horoscope.date).toBe(civilIsoWeek())
    expect(prismaMock.horoscopeContent.findFirst).toHaveBeenCalledWith({
      where: {
        type: "western",
        signId: "aries",
        element: null,
        period: "weekly",
        date: civilIsoWeek(),
      },
    })
  })

  it("fallback semanal obedece o shape T035 (content.date civil, não a key)", async () => {
    const res = await callGet("?period=weekly&sign=aries")
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.horoscope.date).toBe(civilIsoWeek())
    expect(body.horoscope.content.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(body.horoscope.content.date).toBe(civilDateBrt(0))
  })

  it("retorna conteúdo gerado do banco com source generated", async () => {
    prismaMock.horoscopeContent.findFirst.mockResolvedValue({
      type: "western",
      signId: "aries",
      element: null,
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
        compatibility: "touro",
        date: civilDateBrt(0),
      },
    })
    const res = await callGet("?sign=aries")
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.horoscope.source).toBe("generated")
    expect(body.horoscope.content.general).toBe("texto gerado")
    expect(body.horoscope.content.fallback).toBeUndefined()
  })

  it("calcula compatibilidade com targetSign via matriz T090", async () => {
    const res = await callGet("?sign=aries&targetSign=leao")
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.compatibility).toEqual({
      targetSignId: "leao",
      love: 88,
      friendship: 83,
      work: 85,
      overall: 85,
    })
    expect(body.horoscope.signId).toBe("aries")
  })

  it("retorna 500 em erro de banco", async () => {
    prismaMock.horoscopeContent.findFirst.mockRejectedValue(
      new Error("db down"),
    )
    const res = await callGet("?sign=aries")
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error.code).toBe("INTERNAL_ERROR")
  })
})

describe("GET /api/v1/horoscopes/my-horoscope (T094/T100)", () => {
  it("retorna 401 sem autenticação", async () => {
    helpersMock.requireAuth.mockResolvedValueOnce(
      Response.json(
        { error: { code: "AUTH_TOKEN_INVALID", message: "Token invalido" } },
        { status: 401 },
      ),
    )
    const res = await callMy()
    expect(res.status).toBe(401)
    expect(prismaMock.horoscopeContent.findFirst).not.toHaveBeenCalled()
  })

  it("agrega os 3 sistemas com fallback quando não há rows", async () => {
    const res = await callMy()
    expect(res.status).toBe(200)
    const body = await res.json()

    const birthDate = new Date(Date.UTC(1990, 4, 21))
    const zodiac = getChineseZodiac(1990, 5, 21)
    const kin = calculateKinMaya(birthDate)

    expect(body.western).toMatchObject({
      type: "western",
      signId: "gemeos",
      element: null,
      period: "daily",
      date: civilDateBrt(0),
      source: "fallback",
    })
    expect(body.chinese).toMatchObject({
      type: "chinese",
      signId: zodiac.animal,
      element: zodiac.element,
      period: "daily",
      date: civilDateBrt(0),
      source: "fallback",
    })
    expect(body.chinese.content.fallback).toBe(true)
    expect(body.chinese.content.date).toBe(civilDateBrt(0))
    expect(body.mayan).toMatchObject({
      type: "maya",
      signId: String(kin),
      element: null,
      period: "daily",
      date: civilDateBrt(0),
      source: "fallback",
    })
    expect(body.mayan.content.fallback).toBe(true)

    expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
      where: { id: "usr_1" },
      select: { birthDate: true, astrologicalSign: true },
    })
    expect(prismaMock.horoscopeContent.findFirst).toHaveBeenCalledTimes(3)
    // my-horoscope não registra HoroscopeEntry (evita duplicatas — a
    // consulta é logada apenas pelas rotas por sistema, T093).
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

    const res = await callMy()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.western.source).toBe("generated")
    expect(body.chinese.source).toBe("generated")
    expect(body.mayan.source).toBe("generated")
    expect(body.western.content.general).toBe("texto gerado")
    expect(body.chinese.content.general).toBe("texto gerado")
    expect(body.mayan.content.general).toBe("texto gerado")
  })

  it("sem birthDate: western via astrologicalSign; chinese/mayan null", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      birthDate: null,
      astrologicalSign: "Leão",
    })

    const res = await callMy()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.western.signId).toBe("leao")
    expect(body.western.source).toBe("fallback")
    expect(body.chinese).toBeNull()
    expect(body.mayan).toBeNull()
    expect(prismaMock.horoscopeContent.findFirst).toHaveBeenCalledTimes(1)
    expect(
      prismaMock.horoscopeContent.findFirst.mock.calls[0]![0].where.type,
    ).toBe("western")
  })

  it("sem dados astronômicos: três null explícitos (CHK018)", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      birthDate: null,
      astrologicalSign: null,
    })

    const res = await callMy()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ western: null, chinese: null, mayan: null })
    expect(prismaMock.horoscopeContent.findFirst).not.toHaveBeenCalled()
  })

  it("aplica period/date query nos 3 lookups", async () => {
    const res = await callMy("?period=weekly")
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

  it("rejeita period inválido (422) antes do lookup", async () => {
    const res = await callMy("?period=yearly")
    expect(res.status).toBe(422)
    const body = await res.json()
    expect(body.error.code).toBe("VALIDATION_ERROR")
    expect(prismaMock.horoscopeContent.findFirst).not.toHaveBeenCalled()
  })

  it("rejeita date fora do formato do período (422)", async () => {
    const res = await callMy("?period=daily&date=2026-W41")
    expect(res.status).toBe(422)
    const body = await res.json()
    expect(body.error.code).toBe("VALIDATION_ERROR")
    expect(prismaMock.horoscopeContent.findFirst).not.toHaveBeenCalled()
  })

  it("retorna 500 em erro de banco", async () => {
    prismaMock.horoscopeContent.findFirst.mockRejectedValue(
      new Error("db down"),
    )
    const res = await callMy()
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error.code).toBe("INTERNAL_ERROR")
  })
})

describe("GET /api/v1/horoscopes/history (T095/T100)", () => {
  it("retorna 401 sem autenticação", async () => {
    helpersMock.requireAuth.mockResolvedValueOnce(
      Response.json(
        { error: { code: "AUTH_TOKEN_INVALID", message: "Token invalido" } },
        { status: 401 },
      ),
    )
    const res = await callHistory()
    expect(res.status).toBe(401)
    expect(prismaMock.horoscopeEntry.findMany).not.toHaveBeenCalled()
  })

  it("retorna a primeira página no envelope S2-18 com entries mapeadas", async () => {
    prismaMock.horoscopeEntry.findMany.mockResolvedValue([
      makeEntry("h1", new Date("2026-09-25T12:00:00.000Z")),
      makeEntry("h2", new Date("2026-09-24T12:00:00.000Z"), {
        type: "chinese",
        signId: "cavalo",
        element: "metal",
        period: "weekly",
      }),
    ])

    const res = await callHistory()
    expect(res.status).toBe(200)
    const body = await res.json()

    expect(Object.keys(body).sort()).toEqual(["data", "pagination"])
    expect(body.data.entries).toEqual([
      {
        id: "h1",
        type: "western",
        signId: "aries",
        element: null,
        period: "daily",
        createdAt: "2026-09-25T12:00:00.000Z",
      },
      {
        id: "h2",
        type: "chinese",
        signId: "cavalo",
        element: "metal",
        period: "weekly",
        createdAt: "2026-09-24T12:00:00.000Z",
      },
    ])
    expect(body.pagination.nextCursor).toBeNull()
    // userId nunca vaza na resposta
    expect(JSON.stringify(body)).not.toContain("userId")

    expect(prismaMock.horoscopeEntry.findMany).toHaveBeenCalledWith({
      where: { userId: "usr_1" },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 21,
    })
  })

  it("detecta próxima página e devolve cursor decodificável (keyset)", async () => {
    const base = Date.parse("2026-09-25T12:00:00.000Z")
    const rows = Array.from({ length: 21 }, (_, i) =>
      makeEntry(`h${21 - i}`, new Date(base - i * 1000)),
    )
    prismaMock.horoscopeEntry.findMany.mockResolvedValue(rows)

    const res = await callHistory()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.entries).toHaveLength(20)
    expect(body.pagination.nextCursor).toEqual(expect.any(String))

    const { decodeFeedCursor } = await import("@/lib/social/feed-algorithm")
    expect(decodeFeedCursor(body.pagination.nextCursor)).toEqual({
      createdAt: rows[19]!.createdAt.getTime(),
      id: rows[19]!.id,
    })
  })

  it("cursor enviado vira filtro keyset (createdAt, id)", async () => {
    const { encodeFeedCursor } = await import("@/lib/social/feed-algorithm")
    const createdAt = Date.parse("2026-09-24T12:00:00.000Z")
    const cursor = encodeFeedCursor({ createdAt, id: "h9" })
    prismaMock.horoscopeEntry.findMany.mockResolvedValue([])

    const res = await callHistory(`?cursor=${encodeURIComponent(cursor)}`)
    expect(res.status).toBe(200)

    expect(prismaMock.horoscopeEntry.findMany).toHaveBeenCalledWith({
      where: {
        userId: "usr_1",
        AND: [
          {
            OR: [
              { createdAt: { lt: new Date(createdAt) } },
              { createdAt: new Date(createdAt), id: { lt: "h9" } },
            ],
          },
        ],
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 21,
    })
  })

  it("cursor inválido devolve página vazia sem restart", async () => {
    const res = await callHistory("?cursor=cursor-invalido")
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({
      data: { entries: [] },
      pagination: { nextCursor: null },
    })
    expect(prismaMock.horoscopeEntry.findMany).not.toHaveBeenCalled()
  })

  it("aplica filtros type/period no where", async () => {
    prismaMock.horoscopeEntry.findMany.mockResolvedValue([])

    const res = await callHistory("?type=western&period=daily")
    expect(res.status).toBe(200)
    expect(prismaMock.horoscopeEntry.findMany).toHaveBeenCalledWith({
      where: { userId: "usr_1", type: "western", period: "daily" },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 21,
    })
  })

  it("rejeita type inválido (422)", async () => {
    const res = await callHistory("?type=tarot")
    expect(res.status).toBe(422)
    const body = await res.json()
    expect(body.error.code).toBe("VALIDATION_ERROR")
    expect(prismaMock.horoscopeEntry.findMany).not.toHaveBeenCalled()
  })

  it("rejeita limit fora dos bounds 1..50 (422)", async () => {
    const over = await callHistory("?limit=51")
    expect(over.status).toBe(422)
    const under = await callHistory("?limit=0")
    expect(under.status).toBe(422)
    expect(prismaMock.horoscopeEntry.findMany).not.toHaveBeenCalled()
  })

  it("honra limit customizado no take", async () => {
    prismaMock.horoscopeEntry.findMany.mockResolvedValue([])
    const res = await callHistory("?limit=5")
    expect(res.status).toBe(200)
    expect(prismaMock.horoscopeEntry.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 6 }),
    )
  })

  it("retorna 500 em erro de banco", async () => {
    prismaMock.horoscopeEntry.findMany.mockRejectedValue(new Error("db down"))
    const res = await callHistory()
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error.code).toBe("INTERNAL_ERROR")
  })
})
