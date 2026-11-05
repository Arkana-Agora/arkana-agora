import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { runHoroscopeAvailabilityCheck } from "@/jobs/horoscope-availability-check"

const jobMock = vi.hoisted(() => ({
  runHoroscopeAvailabilityCheck: vi.fn<typeof runHoroscopeAvailabilityCheck>(),
}))

vi.mock("@/jobs/horoscope-availability-check", () => jobMock)

const summary = {
  date: "2026-10-20",
  checked: 12,
  present: 11,
  missing: ["aries"],
}

beforeEach(() => {
  vi.clearAllMocks()
  jobMock.runHoroscopeAvailabilityCheck.mockResolvedValue(summary)
  vi.stubEnv("CRON_SECRET", "segredo-do-cron")
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.resetModules()
})

async function callCron(authorization?: string): Promise<Response> {
  const { GET } = await import("@/app/api/cron/horoscope-availability/route")
  const headers: Record<string, string> = {}
  if (authorization !== undefined) {
    headers.authorization = authorization
  }
  return GET(
    new Request("http://localhost:3000/api/cron/horoscope-availability", {
      headers,
    }),
  )
}

describe("GET /api/cron/horoscope-availability (T145)", () => {
  it("passa 401 quando CRON_SECRET nao esta configurado", async () => {
    vi.stubEnv("CRON_SECRET", "")

    const res = await callCron("Bearer segredo-do-cron")
    const json = await res.json()

    expect(res.status).toBe(401)
    expect(json.error.code).toBe("UNAUTHORIZED")
    expect(json.meta.requestId).toBeTruthy()
    expect(jobMock.runHoroscopeAvailabilityCheck).not.toHaveBeenCalled()
  })

  it("passa 401 quando o header Authorization esta ausente", async () => {
    const res = await callCron()
    const json = await res.json()

    expect(res.status).toBe(401)
    expect(json.error.code).toBe("UNAUTHORIZED")
    expect(jobMock.runHoroscopeAvailabilityCheck).not.toHaveBeenCalled()
  })

  it("passa 401 quando o header Authorization nao confere", async () => {
    const res = await callCron("Bearer token-errado")
    const json = await res.json()

    expect(res.status).toBe(401)
    expect(json.error.code).toBe("UNAUTHORIZED")
    expect(jobMock.runHoroscopeAvailabilityCheck).not.toHaveBeenCalled()
  })

  it("executa o check e responde 200 com o summary, no-store e requestId", async () => {
    const res = await callCron("Bearer segredo-do-cron")
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(res.headers.get("cache-control")).toBe("no-store")
    expect(jobMock.runHoroscopeAvailabilityCheck).toHaveBeenCalledTimes(1)
    expect(jobMock.runHoroscopeAvailabilityCheck).toHaveBeenCalledWith(
      expect.any(String),
    )
    expect(json).toEqual({
      ok: true,
      data: summary,
      meta: { requestId: expect.any(String) },
    })
  })

  it("responde 500 INTERNAL_ERROR com requestId quando o check falha", async () => {
    jobMock.runHoroscopeAvailabilityCheck.mockRejectedValue(
      new Error("db down"),
    )

    const res = await callCron("Bearer segredo-do-cron")
    const json = await res.json()

    expect(res.status).toBe(500)
    expect(json.error.code).toBe("INTERNAL_ERROR")
    expect(json).not.toHaveProperty("ok")
    expect(json.meta.requestId).toBeTruthy()
  })

  it("roda sob runtime nodejs", async () => {
    const { runtime } =
      await import("@/app/api/cron/horoscope-availability/route")
    expect(runtime).toBe("nodejs")
  })
})
