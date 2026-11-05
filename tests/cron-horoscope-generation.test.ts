import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { runHoroscopeGenerationJob } from "@/jobs/horoscope-generation"

const jobMock = vi.hoisted(() => ({
  runHoroscopeGenerationJob: vi.fn<typeof runHoroscopeGenerationJob>(),
}))

vi.mock("@/jobs/horoscope-generation", () => jobMock)

const summary = { date: "2026-10-20", checked: 36, existing: 4, enqueued: 32 }

beforeEach(() => {
  vi.clearAllMocks()
  jobMock.runHoroscopeGenerationJob.mockResolvedValue(summary)
  vi.stubEnv("CRON_SECRET", "segredo-do-cron")
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.resetModules()
})

async function callCron(authorization?: string): Promise<Response> {
  const { GET } = await import("@/app/api/cron/horoscope-generation/route")
  const headers: Record<string, string> = {}
  if (authorization !== undefined) {
    headers.authorization = authorization
  }
  return GET(
    new Request("http://localhost:3000/api/cron/horoscope-generation", {
      headers,
    }),
  )
}

describe("GET /api/cron/horoscope-generation (T097/T100)", () => {
  it("passa 401 quando CRON_SECRET nao esta configurado", async () => {
    vi.stubEnv("CRON_SECRET", "")

    const res = await callCron("Bearer segredo-do-cron")
    const json = await res.json()

    expect(res.status).toBe(401)
    expect(json.error.code).toBe("UNAUTHORIZED")
    expect(json.meta.requestId).toBeTruthy()
    expect(jobMock.runHoroscopeGenerationJob).not.toHaveBeenCalled()
  })

  it("passa 401 quando o header Authorization esta ausente", async () => {
    const res = await callCron()
    const json = await res.json()

    expect(res.status).toBe(401)
    expect(json.error.code).toBe("UNAUTHORIZED")
    expect(jobMock.runHoroscopeGenerationJob).not.toHaveBeenCalled()
  })

  it("passa 401 quando o header Authorization nao confere", async () => {
    const res = await callCron("Bearer token-errado")
    const json = await res.json()

    expect(res.status).toBe(401)
    expect(json.error.code).toBe("UNAUTHORIZED")
    expect(jobMock.runHoroscopeGenerationJob).not.toHaveBeenCalled()
  })

  it("executa o job e responde 200 com o summary, no-store e requestId", async () => {
    const res = await callCron("Bearer segredo-do-cron")
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(res.headers.get("cache-control")).toBe("no-store")
    expect(jobMock.runHoroscopeGenerationJob).toHaveBeenCalledTimes(1)
    expect(jobMock.runHoroscopeGenerationJob).toHaveBeenCalledWith(
      expect.any(String),
    )
    expect(json).toEqual({
      ok: true,
      data: summary,
      meta: { requestId: expect.any(String) },
    })
  })

  it("responde 500 INTERNAL_ERROR com requestId quando o job falha", async () => {
    jobMock.runHoroscopeGenerationJob.mockRejectedValue(new Error("redis down"))

    const res = await callCron("Bearer segredo-do-cron")
    const json = await res.json()

    expect(res.status).toBe(500)
    expect(json.error.code).toBe("INTERNAL_ERROR")
    expect(json).not.toHaveProperty("ok")
    expect(json.meta.requestId).toBeTruthy()
  })

  it("roda sob runtime nodejs", async () => {
    const { runtime } =
      await import("@/app/api/cron/horoscope-generation/route")
    expect(runtime).toBe("nodejs")
  })
})
