import { prisma } from "@/lib/prisma"
import { logger, newReqId } from "@/lib/logger"
import { deleteAccountSchema } from "@/lib/validators/auth"
import { LGPD_WINDOW_DAYS } from "@/lib/lgpd"
import { sendAccountDeletionEmail } from "@/lib/email/email"
import {
  AuthTokenError,
  softDeleteAccount,
  verifyAccessToken,
} from "@/services/token-service"
import {
  errorResponse,
  successResponse,
  getBearerToken,
  equalizeNoopTiming,
} from "../_helpers"

export const dynamic = "force-dynamic"

const SUCCESS_MESSAGE = `Conta marcada para exclusao. Voce tem ${LGPD_WINDOW_DAYS} dias para reverter.`

export async function DELETE(request: Request): Promise<Response> {
  const reqId = newReqId()

  const bearer = getBearerToken(request)
  if (!bearer) {
    logger.warn({ reqId }, "[auth:account] token de acesso ausente")
    return errorResponse(reqId, 401, {
      error: {
        code: "AUTH_TOKEN_INVALID",
        message: "Token de acesso ausente",
      },
    })
  }

  let userId: string
  try {
    const verified = await verifyAccessToken(bearer)
    userId = verified.userId
  } catch (err) {
    if (err instanceof Error && err.name === "AuthTokenError") {
      const code = (err as AuthTokenError).code
      logger.warn({ reqId, code }, "[auth:account] token de acesso rejeitado")
      if (code === "AUTH_ACCOUNT_SUSPENDED") {
        return errorResponse(reqId, 403, {
          error: {
            code,
            message: "Conta inativa ou deletada",
          },
        })
      }
      if (code.startsWith("AUTH_TOKEN_")) {
        return errorResponse(reqId, 401, {
          error: {
            code,
            message: "Sessao invalida ou expirada",
          },
        })
      }
      return errorResponse(reqId, 500, {
        error: {
          code: "INTERNAL_ERROR",
          message: "Erro interno",
        },
      })
    }

    logger.error(
      { reqId },
      "[auth:account] erro inesperado na validacao do token",
    )
    return errorResponse(reqId, 500, {
      error: {
        code: "INTERNAL_ERROR",
        message: "Erro interno",
      },
    })
  }

  let email: string
  try {
    const parsed = deleteAccountSchema.safeParse(await request.json())
    if (!parsed.success) {
      logger.info({ reqId }, "[auth:account] validacao falhou")
      return errorResponse(reqId, 422, {
        error: {
          code: "VALIDATION_ERROR",
          message: "Dados de entrada invalidos",
          details: parsed.error.errors.map((issue) => ({
            field: issue.path.join("."),
            message: issue.message,
          })),
        },
      })
    }
    email = parsed.data.email
  } catch {
    logger.info({ reqId }, "[auth:account] corpo invalido")
    return errorResponse(reqId, 422, {
      error: {
        code: "VALIDATION_ERROR",
        message: "Corpo da requisicao invalido",
      },
    })
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    })

    if (user === null || user.email !== email) {
      logger.info(
        { reqId },
        "[auth:account] confirmacao digitada nao confere — 200 identico (anti-enumeracao)",
      )
      await equalizeNoopTiming()
      return successResponse({ message: SUCCESS_MESSAGE })
    }

    await softDeleteAccount(userId)
  } catch (error) {
    logger.error(
      { err: error, reqId },
      "[auth:account] erro na aplicacao do soft delete",
    )
    return errorResponse(reqId, 500, {
      error: { code: "INTERNAL_ERROR", message: "Erro interno" },
    })
  }

  try {
    await sendAccountDeletionEmail(email, { deleteAfterDays: LGPD_WINDOW_DAYS })
  } catch (error) {
    logger.error(
      { err: error, reqId, userId },
      "[auth:account] falha ao enviar email de confirmacao (soft delete ja aplicado)",
    )
  }

  logger.info({ reqId, userId }, "[auth:account] exclusao registrada")
  return successResponse({ message: SUCCESS_MESSAGE })
}
