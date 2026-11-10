// @vitest-environment node
/**
 * T146 — Bench suite para NFRs (Q29)
 *
 * Mede P95 de latência dos endpoints críticos:
 * - Endpoints sociais (feed, like, comment, follow, search)
 * - Feed com 1000 following sintéticos (<300ms)
 * - Página de horóscopo (<800ms)
 * - Cronômetro unitário Kin (<1ms)
 *
 * Método: ≥30 reqs/endpoint, 1 warmup descartado, P95 = percentil 95.
 * Isolamento: `vitest.config.ts` tem `exclude: ["tests/bench/**"]` (não roda em `npm run test`).
 * Roda via `npm run bench`.
 */
import { describe, expect, it, vi } from "vitest"
import { performance } from "perf_hooks"

const ITERATIONS = 30
const WARMUP = 1

function p95(times: number[]): number {
  const sorted = [...times].sort((a, b) => a - b)
  const idx = Math.ceil(sorted.length * 0.95) - 1
  return sorted[idx] as number
}

async function measureP95(
  fn: () => Promise<unknown>,
  n: number,
  warmup = WARMUP,
): Promise<number> {
  for (let i = 0; i < warmup; i++) {
    await fn()
  }
  const times: number[] = []
  for (let i = 0; i < n; i++) {
    const start = performance.now()
    await fn()
    times.push(performance.now() - start)
  }
  return p95(times)
}

type HandlerFn = (
  request: Request,
  context: { params: Promise<Record<string, string>> },
) => Promise<Response>

// ── Shared mocks (hoisted to top level) ───────────────────────────────────
const prismaMock = vi.hoisted(() => ({
  user: {
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
  },
  post: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  comment: { findMany: vi.fn(), create: vi.fn(), findUnique: vi.fn() },
  follow: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn() },
  postLike: { findUnique: vi.fn(), create: vi.fn() },
  commentLike: { findUnique: vi.fn(), create: vi.fn() },
  gift: { findUnique: vi.fn(), create: vi.fn() },
  userProfile: { findUnique: vi.fn(), update: vi.fn() },
  horoscopeContent: { findFirst: vi.fn(), findMany: vi.fn() },
  horoscopeEntry: { create: vi.fn(), findMany: vi.fn() },
  notification: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn() },
  postHashtag: { create: vi.fn(), findMany: vi.fn() },
  feedCache: { invalidate: vi.fn() },
  transaction: vi.fn(async (callback: (tx: unknown) => Promise<unknown>) =>
    callback({}),
  ),
}))

const tokenServiceMock = vi.hoisted(() => ({
  signAccessToken: vi.fn(),
  createRefreshSession: vi.fn(),
  rotateRefresh: vi.fn(),
  verifyAccessToken: vi.fn(),
  revokeRefreshSession: vi.fn(),
  revokeAllSessions: vi.fn(),
}))

const bcryptMock = vi.hoisted(() => ({ compare: vi.fn(), hash: vi.fn() }))

const rateLimitMock = vi.hoisted(() => ({
  isAccountLocked: vi.fn(),
  isIpLimited: vi.fn(),
  recordLoginFailure: vi.fn(),
  recordIpAttempt: vi.fn(),
  resetLoginFailures: vi.fn(),
  resetRateLimiter: vi.fn(),
  isRegisterIpLimited: vi.fn(),
  isRegisterLimited: vi.fn(),
  recordRegisterAttempt: vi.fn(),
  recordRegisterIpAttempt: vi.fn(),
}))

const emailMock = vi.hoisted(() => vi.fn())
const csrfMock = vi.hoisted(() => ({
  validateCsrfToken: vi.fn(),
  csrfErrorResponse: vi.fn((reqId: string) =>
    Response.json(
      {
        error: { code: "CSRF_TOKEN_INVALID", message: "CSRF token invalido" },
        meta: { requestId: reqId },
      },
      { status: 403 },
    ),
  ),
}))
const analyticsMock = vi.hoisted(() => ({
  trackPostCreate: vi.fn(),
  trackLike: vi.fn(),
  trackComment: vi.fn(),
  trackFollow: vi.fn(),
  trackGiftSend: vi.fn(),
  trackHoroscopeView: vi.fn(),
  trackGiftClaimDaily: vi.fn(),
  trackVersosEarned: vi.fn(),
  trackPostLimitHit: vi.fn(),
  trackCsrfFailure: vi.fn(),
  trackRateLimiterBypass: vi.fn(),
}))

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }))
vi.mock("@/services/token-service", () => tokenServiceMock)
vi.mock("bcryptjs", () => ({
  __esModule: true,
  default: { compare: bcryptMock.compare, hash: bcryptMock.hash },
}))
vi.mock("@/lib/rate-limit", () => rateLimitMock)
vi.mock("@/lib/email/email", () => ({
  sendVerificationEmail: emailMock,
  sendMagicLinkEmail: emailMock,
  sendPasswordResetEmail: emailMock,
  sendAccountDeletionEmail: emailMock,
}))
vi.mock("@/lib/csrf", () => csrfMock)
vi.mock("@/lib/analytics", () => analyticsMock)

function makeParams(
  params: Record<string, string>,
): Promise<Record<string, string>> {
  return Promise.resolve(params)
}

describe("T146 — Bench suite NFRs (Q29)", () => {
  // ── Social Endpoints P95 < 500ms ────────────────────────────────────────
  describe("Social endpoints P95 < 500ms", () => {
    it(`GET /api/v1/social/feed P95 < 500ms (${ITERATIONS} iteracoes)`, async () => {
      prismaMock.post.findMany.mockResolvedValue([])
      const { GET } = await import("@/app/api/v1/social/feed/route")

      const p95Time = await measureP95(async () => {
        await (GET as HandlerFn)(
          new Request("http://localhost:3000/api/v1/social/feed", {
            method: "GET",
            headers: {
              Authorization: "Bearer valid-token",
              "x-csrf-token": "bench-csrf-token",
            },
          }),
          { params: makeParams({}) },
        )
      }, ITERATIONS)

      expect(p95Time).toBeLessThan(500)
    })

    it(`POST /api/v1/social/posts P95 < 500ms (${ITERATIONS} iteracoes)`, async () => {
      prismaMock.post.create.mockResolvedValue({
        id: "post_1",
        authorId: "usr_1",
        type: "text",
        content: "test",
        imageUrls: [],
        audience: "public",
        isPinned: false,
        likeCount: 0,
        commentCount: 0,
        createdAt: new Date().toISOString(),
        author: {
          id: "usr_1",
          name: "Test",
          displayName: "Test",
          avatar: null,
          profile: { privacy: { profileVisibility: "public" } },
        },
      })
      prismaMock.postHashtag.create.mockResolvedValue({})
      prismaMock.feedCache.invalidate.mockResolvedValue(undefined)

      const { POST } = await import("@/app/api/v1/social/posts/route")

      const p95Time = await measureP95(async () => {
        await (POST as HandlerFn)(
          new Request("http://localhost:3000/api/v1/social/posts", {
            method: "POST",
            headers: {
              "content-type": "application/json",
              Authorization: "Bearer valid-token",
              "x-csrf-token": "bench-csrf-token",
            },
            body: JSON.stringify({ type: "text", content: "test post" }),
          }),
          { params: makeParams({}) },
        )
      }, ITERATIONS)

      expect(p95Time).toBeLessThan(500)
    })

    it(`POST /api/v1/social/posts/:id/like P95 < 500ms (${ITERATIONS} iteracoes)`, async () => {
      prismaMock.post.findUnique.mockResolvedValue({
        id: "post_1",
        authorId: "usr_2",
        likeCount: 0,
        isHidden: false,
        audience: "public",
        commentsDisabled: false,
      })
      prismaMock.postLike.findUnique.mockResolvedValue(null)
      prismaMock.postLike.create.mockResolvedValue({})
      prismaMock.post.update.mockResolvedValue({ likeCount: 1 })
      prismaMock.notification.create.mockResolvedValue({})

      const { POST } = await import("@/app/api/v1/social/posts/[id]/like/route")

      const p95Time = await measureP95(async () => {
        await (POST as HandlerFn)(
          new Request("http://localhost:3000/api/v1/social/posts/post_1/like", {
            method: "POST",
            headers: {
              Authorization: "Bearer valid-token",
              "x-csrf-token": "bench-csrf-token",
            },
          }),
          { params: makeParams({ id: "post_1" }) },
        )
      }, ITERATIONS)

      expect(p95Time).toBeLessThan(500)
    })

    it(`POST /api/v1/social/posts/:id/comments P95 < 500ms (${ITERATIONS} iteracoes)`, async () => {
      prismaMock.post.findUnique.mockResolvedValue({
        id: "post_1",
        authorId: "usr_2",
        isHidden: false,
        audience: "public",
        commentsDisabled: false,
      })
      prismaMock.comment.create.mockResolvedValue({
        id: "comment_1",
        postId: "post_1",
        authorId: "usr_1",
        content: "test comment",
        likeCount: 0,
        createdAt: new Date().toISOString(),
        author: {
          id: "usr_1",
          name: "Test",
          displayName: "Test",
          avatar: null,
        },
      })
      prismaMock.post.update.mockResolvedValue({ commentCount: 1 })
      prismaMock.notification.create.mockResolvedValue({})

      const { POST } =
        await import("@/app/api/v1/social/posts/[id]/comments/route")

      const p95Time = await measureP95(async () => {
        await (POST as HandlerFn)(
          new Request(
            "http://localhost:3000/api/v1/social/posts/post_1/comments",
            {
              method: "POST",
              headers: {
                "content-type": "application/json",
                Authorization: "Bearer valid-token",
                "x-csrf-token": "bench-csrf-token",
              },
              body: JSON.stringify({ content: "test comment" }),
            },
          ),
          { params: makeParams({ id: "post_1" }) },
        )
      }, ITERATIONS)

      expect(p95Time).toBeLessThan(500)
    })

    it(`POST /api/v1/social/follow/:userId P95 < 500ms (${ITERATIONS} iteracoes)`, async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        id: "usr_2",
        isActive: true,
        deletedAt: null,
        profile: { privacy: { whoCanFollow: "everyone" } },
      })
      prismaMock.follow.findUnique.mockResolvedValue(null)
      prismaMock.follow.create.mockResolvedValue({
        id: "follow_1",
        followerId: "usr_1",
        followingId: "usr_2",
      })
      prismaMock.notification.create.mockResolvedValue({})
      prismaMock.userProfile.update.mockResolvedValue({})

      const { POST } = await import("@/app/api/v1/social/follow/[userId]/route")

      const p95Time = await measureP95(async () => {
        await (POST as HandlerFn)(
          new Request("http://localhost:3000/api/v1/social/follow/usr_2", {
            method: "POST",
            headers: {
              Authorization: "Bearer valid-token",
              "x-csrf-token": "bench-csrf-token",
            },
          }),
          { params: makeParams({ userId: "usr_2" }) },
        )
      }, ITERATIONS)

      expect(p95Time).toBeLessThan(500)
    })

    it(`GET /api/v1/social/search P95 < 500ms (${ITERATIONS} iteracoes)`, async () => {
      prismaMock.post.findMany.mockResolvedValue([])
      prismaMock.user.findMany.mockResolvedValue([])
      prismaMock.postHashtag.findMany.mockResolvedValue([])

      const { GET } = await import("@/app/api/v1/social/search/route")

      const p95Time = await measureP95(async () => {
        await (GET as HandlerFn)(
          new Request("http://localhost:3000/api/v1/social/search?q=test", {
            method: "GET",
            headers: { Authorization: "Bearer valid-token" },
          }),
          { params: makeParams({}) },
        )
      }, ITERATIONS)

      expect(p95Time).toBeLessThan(500)
    })
  })

  // ── Feed Performance ───────────────────────────────────────────────────
  describe("Feed performance", () => {
    it(`GET /api/v1/social/feed com 1000 following P95 < 300ms (${ITERATIONS} iteracoes)`, async () => {
      const manyPosts = Array.from({ length: 50 }, (_, i) => ({
        id: `post_${i}`,
        authorId: `usr_${i}`,
        type: "text",
        content: `post ${i}`,
        imageUrls: [],
        audience: "public",
        isPinned: false,
        likeCount: 0,
        commentCount: 0,
        createdAt: new Date().toISOString(),
        author: {
          id: `usr_${i}`,
          name: `User ${i}`,
          displayName: `User ${i}`,
          avatar: null,
          profile: { privacy: { profileVisibility: "public" } },
        },
      }))

      prismaMock.post.findMany.mockResolvedValue(manyPosts)
      prismaMock.follow.findMany.mockResolvedValue(
        Array.from({ length: 1000 }, (_, i) => ({
          followingId: `usr_${i}`,
        })),
      )

      const { GET } = await import("@/app/api/v1/social/feed/route")

      const p95Time = await measureP95(async () => {
        await (GET as HandlerFn)(
          new Request("http://localhost:3000/api/v1/social/feed", {
            method: "GET",
            headers: {
              Authorization: "Bearer valid-token",
            },
          }),
          { params: makeParams({}) },
        )
      }, ITERATIONS)

      expect(p95Time).toBeLessThan(300)
    })
  })

  // ── Horoscope page < 800ms ──────────────────────────────────────────────
  describe("Horoscope page performance", () => {
    it(`GET /api/v1/horoscopes/western P95 < 800ms (${ITERATIONS} iteracoes)`, async () => {
      prismaMock.horoscopeContent.findFirst.mockResolvedValue({
        id: "hc_1",
        type: "western",
        signId: "aries",
        element: null,
        period: "daily",
        date: "2026-01-15",
        content: JSON.stringify({
          general: "Horoscopo diário...",
          love: "Amor...",
          career: "Carreira...",
          health: "Saúde...",
          luckyNumber: 7,
          luckyColor: "vermelho",
          compatibility: "libra",
        }),
      })

      const { GET } = await import("@/app/api/v1/horoscopes/western/route")

      const p95Time = await measureP95(async () => {
        await (GET as HandlerFn)(
          new Request(
            "http://localhost:3000/api/v1/horoscopes/western?sign=aries&period=daily",
            {
              method: "GET",
              headers: { Authorization: "Bearer valid-token" },
            },
          ),
          { params: makeParams({}) },
        )
      }, ITERATIONS)

      expect(p95Time).toBeLessThan(800)
    })
  })

  // ── Kin Maya calculation < 1ms ──────────────────────────────────────────
  describe("Kin Maya calculation performance", () => {
    it(`calculateKinMaya P95 < 1ms (${ITERATIONS} iteracoes)`, async () => {
      const { calculateKinMaya } = await import("@/lib/calculations/kin-maya")

      const p95Time = await measureP95(async () => {
        calculateKinMaya(new Date("1990-03-21"))
      }, ITERATIONS)

      expect(p95Time).toBeLessThan(1)
    })
  })
})
