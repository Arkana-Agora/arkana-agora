import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const queueAdd = vi.hoisted(() => vi.fn())
const queueClose = vi.hoisted(() => vi.fn())
const QueueMock = vi.hoisted(() =>
  vi.fn(() => ({ add: queueAdd, close: queueClose })),
)
const RedisMock = vi.hoisted(() => vi.fn(() => ({ marker: "redis-conn" })))

vi.mock("bullmq", () => ({ Queue: QueueMock }))
vi.mock("ioredis", () => ({ default: RedisMock }))

import {
  buildHoroscopeJobOptions,
  buildHoroscopeQueueOptions,
  closeHoroscopeQueue,
  enqueueHoroscopeGeneration,
  getHoroscopeQueue,
  horoscopeGenerationJobSchema,
  HOROSCOPE_QUEUE_NAME,
  HOROSCOPE_WORKER_CONCURRENCY,
} from "@/lib/queue/horoscope-queue"
import { resetEnvCache } from "@/lib/env"

const originalRedisUrl = process.env.REDIS_URL

beforeEach(() => {
  vi.clearAllMocks()
  process.env.REDIS_URL = "redis://localhost:6379"
  resetEnvCache() // getEnv é cacheado — reflete o env de cada teste
  queueAdd.mockResolvedValue({ id: "job-1" })
  queueClose.mockResolvedValue(undefined)
})

afterEach(async () => {
  await closeHoroscopeQueue()
  if (originalRedisUrl === undefined) delete process.env.REDIS_URL
  else process.env.REDIS_URL = originalRedisUrl
  resetEnvCache()
})

const JOB = {
  type: "western" as const,
  signId: "aries",
  period: "daily" as const,
  date: "2026-09-26",
}

describe("buildHoroscopeQueueOptions (T033)", () => {
  it("retry 2× (attempts 3) com backoff exponencial", () => {
    const options = buildHoroscopeQueueOptions()
    expect(options.defaultJobOptions).toMatchObject({
      attempts: 3,
      backoff: { type: "exponential", delay: 5_000 },
    })
  })

  it("concurrency do worker = 3", () => {
    expect(HOROSCOPE_WORKER_CONCURRENCY).toBe(3)
  })
})

describe("buildHoroscopeJobOptions (T033)", () => {
  it("jobId determinístico por escopo (idempotência do cron)", () => {
    expect(buildHoroscopeJobOptions(JOB).jobId).toBe(
      "western:aries:daily:2026-09-26",
    )
    expect(
      buildHoroscopeJobOptions({
        ...JOB,
        type: "chinese",
        element: "fogo",
      }).jobId,
    ).toBe("chinese:fogo:aries:daily:2026-09-26")
  })
})

describe("getHoroscopeQueue (T033)", () => {
  it("sem REDIS_URL lança erro claro", () => {
    delete process.env.REDIS_URL
    expect(() => getHoroscopeQueue()).toThrow(/REDIS_URL/)
  })

  it("cria a fila lazy uma única vez sobre o nome esperado", () => {
    const first = getHoroscopeQueue()
    const second = getHoroscopeQueue()

    expect(first).toBe(second)
    expect(QueueMock).toHaveBeenCalledTimes(1)
    expect(QueueMock).toHaveBeenCalledWith(
      HOROSCOPE_QUEUE_NAME,
      expect.objectContaining({ connection: { marker: "redis-conn" } }),
    )
    expect(RedisMock).toHaveBeenCalledWith("redis://localhost:6379", {
      maxRetriesPerRequest: null,
    })
  })
})

describe("enqueueHoroscopeGeneration (T033)", () => {
  it("adiciona job 'generate' com payload e jobId, retorna o id", async () => {
    const id = await enqueueHoroscopeGeneration(JOB)

    expect(id).toBe("job-1")
    expect(queueAdd).toHaveBeenCalledWith("generate", JOB, {
      jobId: "western:aries:daily:2026-09-26",
    })
  })

  it("valida o payload com zod antes do Redis (fail-fast)", async () => {
    await expect(
      enqueueHoroscopeGeneration({
        ...JOB,
        type: "vodu" as never,
      }),
    ).rejects.toThrow()

    expect(queueAdd).not.toHaveBeenCalled()
    expect(QueueMock).not.toHaveBeenCalled()
  })

  it("rejeita date fora do formato civil YYYY-MM-DD", () => {
    expect(
      horoscopeGenerationJobSchema.safeParse({ ...JOB, date: "26/09/2026" })
        .success,
    ).toBe(false)
    expect(horoscopeGenerationJobSchema.safeParse(JOB).success).toBe(true)
  })

  it("closeHoroscopeQueue reseta a fila (próxima chamada recria)", async () => {
    getHoroscopeQueue()
    await closeHoroscopeQueue()
    expect(queueClose).toHaveBeenCalledTimes(1)

    getHoroscopeQueue()
    expect(QueueMock).toHaveBeenCalledTimes(2)
  })
})
