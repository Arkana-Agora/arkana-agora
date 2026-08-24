import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const prismaMock = vi.hoisted(() => ({
  $queryRaw: vi.fn(),
}))

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }))

import { GET } from "@/app/api/health/route"
import { logger } from "@/lib/logger"
import { APP_VERSION } from "@/lib/version"

type HealthBody = {
  status: "ok" | "degraded"
  version: string
  services: {
    database: { status: "ok" | "error" }
    redis: { status: "ok" | "error" | "not-configured" }
  }
}

const ORIGINAL_REDIS_URL = process.env.REDIS_URL

describe("GET /api/health", () => {
  beforeEach(() => {
    logger.level = "silent"
    prismaMock.$queryRaw.mockReset()
    delete process.env.REDIS_URL
  })

  afterEach(() => {
    if (ORIGINAL_REDIS_URL === undefined) {
      delete process.env.REDIS_URL
    } else {
      process.env.REDIS_URL = ORIGINAL_REDIS_URL
    }
  })

  it("returns ok with a neutral not-configured redis when the database is healthy", async () => {
    prismaMock.$queryRaw.mockResolvedValue([])

    const res = await GET()
    const body = (await res.json()) as HealthBody

    expect(res.status).toBe(200)
    expect(body.status).toBe("ok")
    expect(body.version).toBe(APP_VERSION)
    expect(body.services.database.status).toBe("ok")
    expect(body.services.redis.status).toBe("not-configured")
  })

  it("returns 503 degraded when the hard database check fails", async () => {
    prismaMock.$queryRaw.mockRejectedValue(new Error("database down"))

    const res = await GET()
    const body = (await res.json()) as HealthBody

    expect(res.status).toBe(503)
    expect(body.status).toBe("degraded")
    expect(body.services.database.status).toBe("error")
  })

  it("degrades when a configured redis fails even with a healthy database", async () => {
    prismaMock.$queryRaw.mockResolvedValue([])
    process.env.REDIS_URL = "redis://127.0.0.1:1"

    const res = await GET()
    const body = (await res.json()) as HealthBody

    expect(res.status).toBe(503)
    expect(body.status).toBe("degraded")
    expect(body.services.database.status).toBe("ok")
    expect(body.services.redis.status).toBe("error")
  })
})
