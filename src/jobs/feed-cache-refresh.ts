import {
  MATERIALIZE_FOLLOWING_THRESHOLD,
  refreshFeedCache,
} from "@/lib/feed-cache"
import { logger } from "@/lib/logger"
import { prisma } from "@/lib/prisma"

/**
 * CRON do feed cache (T042/SC34): diário à meia-noite UTC (`0 0 * * *`).
 * Vercel Hobby só permite cron ≥1 dia — a cadência de 5 min e a horária
 * (`0 * * * *`) **falham o deploy**; miss do cache cai no materialize
 * on-demand (TTL 5 min).
 */
export const FEED_CACHE_REFRESH_CRON = "0 0 * * *"

export interface FeedCacheRefreshSummary {
  candidates: number
  refreshed: number
}

/**
 * Refresh do feed cache (T042/US-022): encontra os followerIds com
 * >1000 following (materialização S2-18) e re-materia o feed de cada um.
 * O COUNT(*) da query já vem junto (review simpc N2 — evita recount
 * por candidato). `refreshFeedCache` nunca lança (catch interno) — erro
 * de tick sobe para a rota cron, que responde 500 (guard documentado).
 */
export async function runFeedCacheRefresh(): Promise<FeedCacheRefreshSummary> {
  const candidates = await prisma.$queryRaw<
    { followerId: string; following: number }[]
  >`
    SELECT "followerId", COUNT(*)::int AS following
    FROM follows
    GROUP BY "followerId"
    HAVING COUNT(*) > ${MATERIALIZE_FOLLOWING_THRESHOLD}
  `

  const summary: FeedCacheRefreshSummary = {
    candidates: candidates.length,
    refreshed: 0,
  }

  for (const candidate of candidates) {
    if (await refreshFeedCache(candidate.followerId, candidate.following)) {
      summary.refreshed += 1
    }
  }

  logger.info(summary, "[job:feed-cache-refresh] tick concluido")
  return summary
}
