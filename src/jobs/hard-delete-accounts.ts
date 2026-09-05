import { prisma } from "@/lib/prisma"
import { logger } from "@/lib/logger"
import { sha256 } from "@/lib/crypto"
import { LGPD_WINDOW_DAYS } from "@/lib/lgpd"
import { mirrorTokenVersion } from "@/services/token-service"
import { sendAccountDeletedFinalEmail } from "@/lib/email/email"

const ANON_EMAIL_DOMAIN = "deleted.local"

const ANONYMOUS_NAME = "Usuario Removido"

const DAY_IN_MS = 86_400_000

export interface HardDeleteSummary {
  processed: number
  failed: number
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

  const summary: HardDeleteSummary = { processed: 0, failed: 0, errors: [] }

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

  logger.info(
    { processed: summary.processed, failed: summary.failed, reqId },
    "[job:hard-delete] tick concluido",
  )
  return summary
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
    await tx.verificationToken.deleteMany({ where: { identifier: email } })
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
