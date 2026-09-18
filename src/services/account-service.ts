import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"
import { logger } from "@/lib/logger"
import { LGPD_WINDOW_DAYS } from "@/lib/lgpd"
import { mirrorTokenVersion } from "@/services/token-service"
import { equalizeNoopTiming } from "@/app/api/v1/auth/_helpers"

const DAY_IN_MS = 86_400_000
const WINDOW_MS = LGPD_WINDOW_DAYS * DAY_IN_MS

export interface RestoreAccountResult {
  success: boolean
  message: string
  error?: {
    code: string
    message: string
  }
}

export async function restoreAccount(
  email: string,
  password: string,
  reqId: string,
  ipAddress?: string,
  userAgent?: string,
): Promise<RestoreAccountResult> {
  const normalizedEmail = email.toLowerCase()

  // 1. Find user
  const user = await prisma.user.findFirst({
    where: { email: normalizedEmail },
    select: {
      id: true,
      email: true,
      isActive: true,
      deletedAt: true,
      passwordHash: true,
    },
  })

  // 2. Null guard (must happen first to prevent null reference errors)
  if (user === null) {
    logger.info(
      { reqId },
      "[auth:restore-account] usuario nao encontrado — 200 no-op",
    )
    await equalizeNoopTiming()
    return {
      success: true,
      message:
        "Se a conta estava na janela de restauracao, o acesso foi restabelecido",
    }
  }

  // 3. Check if account is not in soft-delete window
  if (user.isActive === true || user.deletedAt === null) {
    logger.info(
      { userId: user.id, reqId },
      "[auth:restore-account] conta nao esta em janela de exclusao — no-op 200",
    )
    await equalizeNoopTiming()
    return {
      success: true, // Return success for no-op cases
      message:
        "Se a conta estava na janela de restauracao, o acesso foi restabelecido",
    }
  }

  // 4. Check window expiration (must happen BEFORE password verification to prevent race conditions)
  const windowExpired = Date.now() - user.deletedAt.getTime() > WINDOW_MS

  if (windowExpired) {
    logger.warn(
      { userId: user.id, deletedAt: user.deletedAt, reqId },
      "[auth:restore-account] janela expirada — 400",
    )
    return {
      success: false,
      message: "O prazo de 30 dias para restaurar a conta ja expirou",
      error: {
        code: "AUTH_RESTORE_WINDOW_EXPIRED",
        message: "O prazo de 30 dias para restaurar a conta ja expirou",
      },
    }
  }

  // 5. Verify password (anti-enumeration)
  const passwordOk =
    user !== null &&
    user.passwordHash !== null &&
    (await bcrypt.compare(password, user.passwordHash))

  if (!passwordOk) {
    logger.info(
      { userId: user?.id, reqId },
      "[auth:restore-account] posse nao provada — 200 identico (anti-enumeracao)",
    )
    await equalizeNoopTiming()
    return {
      success: true, // Return success for anti-enumeration
      message:
        "Se a conta estava na janela de restauracao, o acesso foi restabelecido",
    }
  }

  // 5. Execute atomic restore transaction
  const windowStart = new Date(Date.now() - WINDOW_MS)

  const restored = await prisma.$transaction(async (tx) => {
    const claim = await tx.user.updateMany({
      where: {
        id: user.id,
        email: user.email,
        isActive: false,
        deletedAt: { not: null, gte: windowStart },
      },
      data: {
        isActive: true,
        deletedAt: null,
        tokenVersion: { increment: 1 },
      },
    })
    return claim.count === 1
  })

  if (!restored) {
    logger.info(
      { userId: user.id, reqId },
      "[auth:restore-account] ja restaurada ou anonimizada em paralelo — no-op 200",
    )
    await equalizeNoopTiming()
    return {
      success: true, // Return success for no-op concurrent cases
      message:
        "Se a conta estava na janela de restauracao, o acesso foi restabelecido",
    }
  }

  // 6. Mirror token version to Redis with retry
  await mirrorTokenVersion(user.id)

  logger.info(
    {
      userId: user.id,
      reqId,
      ip: ipAddress,
      userAgent,
      code: "AUTH_ACCOUNT_RESTORED",
    },
    "[auth:restore-account] conta restaurada",
  )

  return {
    success: true,
    message:
      "Se a conta estava na janela de restauracao, o acesso foi restabelecido",
  }
}
