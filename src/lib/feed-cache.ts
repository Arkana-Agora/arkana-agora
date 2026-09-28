import { z } from "zod"

import { logger } from "@/lib/logger"
import { redis } from "@/lib/redis"
import {
  FEED_MAX_LIMIT,
  getFeed,
  type FeedPage,
  type FeedPost,
} from "@/lib/social/feed-algorithm"
import { prisma } from "@/lib/prisma"

/**
 * Feed cache (T030/US-022): materialização em Redis para contas com
 * >1000 following (S2-18); TTL de 5 min alinhado ao cron a cada 5
 * minutos (T042). Sem Redis ou com cursor além da página materializada
 * → miss (a rota cai no getFeed ao vivo).
 */

export const MATERIALIZE_FOLLOWING_THRESHOLD = 1000
export const FEED_CACHE_TTL_SECONDS = 5 * 60

function feedCacheKey(userId: string): string {
  return `feed:cache:${userId}`
}

// JSON round-trip do Redis devolve strings em vez de Date — schema valida a
// estrutura mínima e reconverte datas (z.coerce.date); o restante do payload
// Prisma passa adiante (passthrough) sem redeclaração.
const cachedFeedPageSchema = z.object({
  posts: z.array(
    z
      .object({
        id: z.string().min(1),
        authorId: z.string().min(1),
        createdAt: z.coerce.date(),
        updatedAt: z.coerce.date(),
        isPinned: z.boolean(),
        isHidden: z.boolean(),
        author: z.object({ id: z.string().min(1) }).passthrough(),
      })
      .passthrough(),
  ),
  nextCursor: z.string().nullable().optional(),
})

/**
 * Returns true se materializou; false se abaixo do threshold ou sem Redis.
 * `followingCount` opcional evita o recount quando o chamador (cron T042)
 * já tem o COUNT(*) em mãos (review simpc N2).
 */
export async function refreshFeedCache(
  userId: string,
  followingCount?: number,
): Promise<boolean> {
  try {
    const count =
      followingCount ??
      (await prisma.follow.count({ where: { followerId: userId } }))

    if (count <= MATERIALIZE_FOLLOWING_THRESHOLD) {
      if (redis) await redis.del(feedCacheKey(userId))
      return false
    }

    if (!redis) return false

    const page = await getFeed(userId, undefined, FEED_MAX_LIMIT)
    await redis.set(
      feedCacheKey(userId),
      JSON.stringify(page),
      "EX",
      FEED_CACHE_TTL_SECONDS,
    )
    logger.info(
      { userId, followingCount: count, posts: page.posts.length },
      "[feed-cache] feed materializado",
    )
    return true
  } catch (error) {
    logger.warn({ err: error, userId }, "[feed-cache] refresh falhou")
    return false
  }
}

/** Hit retorna a página materializada; miss (null) → usar getFeed. */
export async function getCachedFeed(
  userId: string,
  cursor?: string,
): Promise<FeedPage | null> {
  if (cursor) return null
  if (!redis) return null

  try {
    const raw = await redis.get(feedCacheKey(userId))
    if (!raw) return null
    const parsed = cachedFeedPageSchema.safeParse(JSON.parse(raw))
    if (!parsed.success) return null
    return {
      posts: parsed.data.posts as unknown as FeedPost[],
      nextCursor: parsed.data.nextCursor ?? null,
    }
  } catch (error) {
    logger.warn({ err: error, userId }, "[feed-cache] read falhou")
    return null
  }
}
