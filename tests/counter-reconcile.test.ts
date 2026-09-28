import { beforeEach, describe, expect, it, vi } from "vitest"

const prismaMock = vi.hoisted(() => ({ $executeRaw: vi.fn() }))

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }))
vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

import {
  COUNTER_RECONCILE_CRON,
  runCounterReconcileJob,
} from "@/jobs/counter-reconcile"

beforeEach(() => {
  vi.clearAllMocks()
  prismaMock.$executeRaw.mockResolvedValue(0)
})

describe("runCounterReconcileJob (T147)", () => {
  it("cron diario 04:00 UTC (Hobby so permite >= 1 dia)", () => {
    expect(COUNTER_RECONCILE_CRON).toBe("0 4 * * *")
  })

  it("reconcilia posts e comments e reporta as divergencias corrigidas", async () => {
    prismaMock.$executeRaw.mockResolvedValueOnce(2).mockResolvedValueOnce(1)

    const summary = await runCounterReconcileJob("req-1")

    expect(summary).toEqual({ posts: 2, comments: 1, total: 3 })
    expect(prismaMock.$executeRaw).toHaveBeenCalledTimes(2)
  })

  it("idempotente: sem divergencia nao muda nenhuma row", async () => {
    const summary = await runCounterReconcileJob()

    expect(summary).toEqual({ posts: 0, comments: 0, total: 0 })
    expect(prismaMock.$executeRaw).toHaveBeenCalledTimes(2)
  })

  it("o SQL recomputa via subquery count e so toca rows divergentes", async () => {
    await runCounterReconcileJob()

    const sqls = prismaMock.$executeRaw.mock.calls.map((call) =>
      (call[0] as readonly string[]).join("?"),
    )
    expect(sqls[0]).toContain("UPDATE posts p SET")
    expect(sqls[0]).toContain('"likeCount" = (SELECT COUNT(*) FROM post_likes')
    expect(sqls[0]).toContain('"commentCount" = (SELECT COUNT(*) FROM comments')
    expect(sqls[0]).toContain('WHERE p."likeCount" <>')
    expect(sqls[1]).toContain("UPDATE comments c SET")
    expect(sqls[1]).toContain(
      '"likeCount" = (SELECT COUNT(*) FROM comment_likes',
    )
    expect(sqls[1]).toContain('WHERE c."likeCount" <>')
  })
})
