import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { runHardDeleteJob } from "@/jobs/hard-delete-accounts"

const jobMock = vi.hoisted(() => ({
  runHardDeleteJob: vi.fn<typeof runHardDeleteJob>(),
}))

vi.mock("@/jobs/hard-delete-accounts", () => jobMock)

const summary = { processed: 2, failed: 0, errors: [] }

beforeEach(() => {
  vi.clearAllMocks()
  jobMock.runHardDeleteJob.mockResolvedValue(summary)
  vi.stubEnv("CRON_SECRET", "segredo-do-cron")
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.resetModules()
})

async function callCron(authorization?: string): Promise<Response> {
  const { GET } = await import("@/app/api/cron/hard-delete/route")
  const headers: Record<string, string> = {}
  if (authorization !== undefined) {
    headers.authorization = authorization
  }
  return GET(
    new Request("http://localhost:3000/api/cron/hard-delete", {
      headers,
    }),
  )
}

describe("GET /api/cron/hard-delete (T16)", () => {
  it("passa 401 quando CRON_SECRET nao esta configurado", async () => {
    vi.stubEnv("CRON_SECRET", "")

    const res = await callCron("Bearer segredo-do-cron")
    const json = await res.json()

    expect(res.status).toBe(401)
    expect(json.error.code).toBe("UNAUTHORIZED")
    expect(json.meta.requestId).toBeTruthy()
    expect(jobMock.runHardDeleteJob).not.toHaveBeenCalled()
  })

  it("passa 401 quando o header Authorization esta ausente", async () => {
    const res = await callCron()
    const json = await res.json()

    expect(res.status).toBe(401)
    expect(json.error.code).toBe("UNAUTHORIZED")
    expect(jobMock.runHardDeleteJob).not.toHaveBeenCalled()
  })

  it("passa 401 quando o header Authorization nao confere", async () => {
    const res = await callCron("Bearer token-errado")
    const json = await res.json()

    expect(res.status).toBe(401)
    expect(json.error.code).toBe("UNAUTHORIZED")
    expect(jobMock.runHardDeleteJob).not.toHaveBeenCalled()
  })

  it("executa o job e responde 200 com o summary, no-store e requestId", async () => {
    const res = await callCron("Bearer segredo-do-cron")
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(res.headers.get("cache-control")).toBe("no-store")
    expect(jobMock.runHardDeleteJob).toHaveBeenCalledTimes(1)
    expect(jobMock.runHardDeleteJob).toHaveBeenCalledWith(
      expect.any(Date),
      expect.any(String),
    )
    expect(json).toEqual({
      ok: true,
      data: summary,
      meta: { requestId: expect.any(String) },
    })
  })

  it("respode 500 INTERNAL_ERROR com requestId quando o job falha", async () => {
    jobMock.runHardDeleteJob.mockRejectedValue(new Error("db down"))

    const res = await callCron("Bearer segredo-do-cron")
    const json = await res.json()

    expect(res.status).toBe(500)
    expect(json.error.code).toBe("INTERNAL_ERROR")
    expect(json).not.toHaveProperty("ok")
    expect(json.meta.requestId).toBeTruthy()
  })

  it("roda sob runtime nodejs", async () => {
    const { runtime } = await import("@/app/api/cron/hard-delete/route")
    expect(runtime).toBe("nodejs")
  })
})
