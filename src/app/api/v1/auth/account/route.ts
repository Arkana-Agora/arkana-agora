import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { logger, newReqId } from "@/lib/logger"
import { deleteAccountSchema } from "@/lib/validators/auth"
import { sendAccountDeletionEmail } from "@/lib/email/email"
import {
  AuthTokenError,
  softDeleteAccount,
  verifyAccessToken,
} from "@/services/token-service"

export const dynamic = "force-dynamic"

const SUCCESS_MESSAGE =
  "Conta marcada para exclusao. Voce tem 30 dias para reverter."

const LGPD_WINDOW_DAYS = 30

const NOOP_EQUALIZE_MS = 250

function errorResponse(
  reqId: string,
  status: number,
  body: {
    error: {
      code: string
      message: string
      details?: { field: string; message: string }[]
    }
  },
): Response {
  return NextResponse.json({ ...body, meta: { requestId: reqId } }, { status })
}

function successResponse(): Response {
  const response = NextResponse.json(
    { message: SUCCESS_MESSAGE },
    { status: 200 },
  )
  response.headers.set("cache-control", "no-store")
  return response
}

function getBearerToken(request: Request): string {
  const header = request.headers.get("authorization") ?? ""
  const match = /^Bearer\s+(.+)$/i.exec(header)
  return match?.[1] ?? ""
}

async function equalizeNoopTiming(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, NOOP_EQUALIZE_MS))
}

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
      if (typeof code !== "string" || code.startsWith("AUTH_TOKEN_")) {
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
      return successResponse()
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
  return successResponse()
}
