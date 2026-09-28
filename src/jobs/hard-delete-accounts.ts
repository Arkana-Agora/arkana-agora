import { prisma } from "@/lib/prisma"
import { logger } from "@/lib/logger"
import { sha256 } from "@/lib/crypto"
import { LGPD_WINDOW_DAYS } from "@/lib/lgpd"
import { mirrorTokenVersion } from "@/services/token-service"
import { sendAccountDeletedFinalEmail } from "@/lib/email/email"

const ANON_EMAIL_DOMAIN = "deleted.local"

const ANONYMOUS_NAME = "Usuario Removido"

const DAY_IN_MS = 86_400_000

/**
 * Retenção de leituras (S2-20/T148, `docs/07-security/lgpd.md`): purga
 * `Reading`/`ReadingCard`/`Interpretation` 90 dias após o soft-delete.
 * Coexiste com a janela de 30 dias (LGPD_WINDOW_DAYS) da anonimização:
 * a anonimização roda 1x por conta (email vira `@deleted.local` e sai da
 * seleção), já a purga de leituras é reaproveitada a cada tick e se esgota
 * sozinha (conta sem leituras sai do `where`).
 */
export const READING_RETENTION_DAYS = 90

export interface HardDeleteSummary {
  processed: number
  failed: number
  readingsPurged: number
  errors: { userId: string; error: string }[]
}

function anonymizedEmail(userId: string, email: string): string {
  const digest = sha256(`${userId}:${email}`).slice(0, 24)
  return `${digest}@${ANON_EMAIL_DOMAIN}`
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export async function runHardDeleteJob(
  now: Date = new Date(),
  reqId?: string,
): Promise<HardDeleteSummary> {
  const cutoff = new Date(now.getTime() - LGPD_WINDOW_DAYS * DAY_IN_MS)

  const expired = await prisma.user.findMany({
    where: {
      deletedAt: { not: null, lte: cutoff },
      isActive: false,
      email: { not: { endsWith: `@${ANON_EMAIL_DOMAIN}` } },
    },
    select: { id: true, email: true },
  })

  const summary: HardDeleteSummary = {
    processed: 0,
    failed: 0,
    readingsPurged: 0,
    errors: [],
  }

  for (const user of expired) {
    try {
      if (await anonymizeAccount(user.id, user.email, cutoff, reqId)) {
        summary.processed++
        logger.info(
          { userId: user.id, reqId },
          "[job:hard-delete] conta anonimizada",
        )
      } else {
        logger.info(
          { userId: user.id, reqId },
          "[job:hard-delete] conta restaurada ou ja processada entre selecao e execucao — pulada",
        )
      }
    } catch (error) {
      summary.failed++
      summary.errors.push({ userId: user.id, error: errorMessage(error) })
      logger.error(
        { err: error, userId: user.id, reqId },
        "[job:hard-delete] falha ao anonimizar conta",
      )
    }
  }

  try {
    summary.readingsPurged = await purgeExpiredReadings(now, reqId)
  } catch (error) {
    logger.error(
      { err: error, reqId },
      "[job:hard-delete] falha ao purgar leituras expiradas",
    )
  }

  logger.info(
    {
      processed: summary.processed,
      failed: summary.failed,
      readingsPurged: summary.readingsPurged,
      reqId,
    },
    "[job:hard-delete] tick concluido",
  )
  return summary
}

/**
 * S2-20/T148 — apaga leituras de contas soft-deletadas há >90 dias,
 * na ordem de FK: Interpretation → ReadingCard → Reading (mesma transação).
 * Idempotente: `deleteMany` sem rows = 0 e a conta sem leituras sai da
 * seleção da próxima execução.
 */
export async function purgeExpiredReadings(
  now: Date = new Date(),
  reqId?: string,
): Promise<number> {
  const purgeCutoff = new Date(
    now.getTime() - READING_RETENTION_DAYS * DAY_IN_MS,
  )

  const stale = await prisma.user.findMany({
    where: {
      deletedAt: { not: null, lte: purgeCutoff },
      readings: { some: {} },
    },
    select: { id: true },
  })

  if (stale.length === 0) {
    return 0
  }

  const ids = stale.map((user) => user.id)
  await prisma.$transaction(async (tx) => {
    await tx.interpretation.deleteMany({ where: { userId: { in: ids } } })
    await tx.readingCard.deleteMany({
      where: { reading: { userId: { in: ids } } },
    })
    await tx.reading.deleteMany({ where: { userId: { in: ids } } })
  })

  logger.info(
    { users: stale.length, reqId },
    "[job:hard-delete] leituras expiradas purgadas",
  )
  return stale.length
}

async function anonymizeAccount(
  userId: string,
  email: string,
  cutoff: Date,
  reqId?: string,
): Promise<boolean> {
  const anonEmail = anonymizedEmail(userId, email)

  const claimed = await prisma.$transaction(async (tx) => {
    const result = await tx.user.updateMany({
      where: {
        id: userId,
        deletedAt: { not: null, lte: cutoff },
        isActive: false,
        email,
      },
      data: {
        email: anonEmail,
        name: ANONYMOUS_NAME,
        displayName: ANONYMOUS_NAME,
        avatar: null,
        passwordHash: null,
        providerId: anonEmail,
        birthDate: null,
        astrologicalSign: null,
        mayanKin: null,
        personalArcana: null,
        emailVerified: null,
        isActive: false,
        tokenVersion: { increment: 1 },
      },
    })

    if (result.count === 0) {
      return false
    }

    await tx.session.deleteMany({ where: { userId } })
    await tx.userProfile.deleteMany({ where: { userId } })
    await tx.subscription.deleteMany({ where: { userId } })
    await tx.arcanaCalculation.deleteMany({ where: { userId } })
    await tx.verificationToken.deleteMany({ where: { identifier: email } })

    // Sprint 2 — social/horóscopos (LGPD review): purga as tabelas novas com
    // ligação ao usuário. `horoscope_contents` fica (catálogo global, sem
    // userId); `post_hashtags`/`comment_likes` de posts/comentários do autor
    // caem em cascade, os feitos em conteúdo de terceiros vão direto.
    await tx.follow.deleteMany({
      where: { OR: [{ followerId: userId }, { followingId: userId }] },
    })
    await tx.post.deleteMany({ where: { authorId: userId } })
    await tx.comment.deleteMany({ where: { authorId: userId } })
    await tx.postLike.deleteMany({ where: { userId } })
    await tx.commentLike.deleteMany({ where: { userId } })
    // Gifts enviados são ação do usuário; recebidos permanecem como ledger do
    // doador (referência ao id já anonimizado — revisitar antes do launch).
    await tx.gift.deleteMany({ where: { fromUserId: userId } })
    await tx.notification.deleteMany({ where: { userId } })
    await tx.contentReport.deleteMany({ where: { reporterId: userId } })
    await tx.horoscopeEntry.deleteMany({ where: { userId } })
    await tx.horoscopeLog.deleteMany({ where: { userId } })
    await tx.horoscopeNotification.deleteMany({ where: { userId } })
    return true
  })

  if (!claimed) {
    return false
  }

  await mirrorTokenVersion(userId)

  try {
    await sendAccountDeletedFinalEmail(email, {
      deleteAfterDays: LGPD_WINDOW_DAYS,
    })
  } catch (error) {
    logger.warn(
      { err: error, userId, reqId },
      "[job:hard-delete] email final falhou (best-effort)",
    )
  }

  return true
}
