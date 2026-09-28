import { logger } from "@/lib/logger"
import { prisma } from "@/lib/prisma"

/**
 * CRON de reconciliação de contadores (S2-19/T147, invariante I4 de
 * `docs/03-database/entities.md`): `ON DELETE CASCADE` não roda código de
 * app e deixa `likeCount`/`commentCount` com drift permanente. Diário às
 * 04:00 UTC (Vercel Hobby só permite ≥1 dia). Idempotente: sem divergência,
 * nenhuma row muda (`$executeRaw` retorna 0).
 */
export const COUNTER_RECONCILE_CRON = "0 4 * * *"

export interface CounterReconcileSummary {
  posts: number
  comments: number
  total: number
}

export async function runCounterReconcileJob(
  reqId?: string,
): Promise<CounterReconcileSummary> {
  const posts = await prisma.$executeRaw`
    UPDATE posts p SET
      "likeCount" = (SELECT COUNT(*) FROM post_likes pl WHERE pl."postId" = p.id),
      "commentCount" = (SELECT COUNT(*) FROM comments c WHERE c."postId" = p.id)
    WHERE p."likeCount" <> (SELECT COUNT(*) FROM post_likes pl WHERE pl."postId" = p.id)
       OR p."commentCount" <> (SELECT COUNT(*) FROM comments c WHERE c."postId" = p.id)
  `
  const comments = await prisma.$executeRaw`
    UPDATE comments c SET
      "likeCount" = (SELECT COUNT(*) FROM comment_likes cl WHERE cl."commentId" = c.id)
    WHERE c."likeCount" <> (SELECT COUNT(*) FROM comment_likes cl WHERE cl."commentId" = c.id)
  `

  const summary: CounterReconcileSummary = {
    posts,
    comments,
    total: posts + comments,
  }
  logger.info({ ...summary, reqId }, "[job:counter-reconcile] tick concluido")
  return summary
}
