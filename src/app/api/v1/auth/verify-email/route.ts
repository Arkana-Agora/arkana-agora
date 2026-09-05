import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { logger, newReqId } from "@/lib/logger"
import { verifyEmailSchema } from "@/lib/validators/auth"
import { bumpTokenVersion } from "@/services/token-service"

export const dynamic = "force-dynamic"

const SUCCESS_MESSAGE = "Email verificado com sucesso"

function errorResponse(
  reqId: string,
  status: number,
  body: {
    error: {
      code: string
      message: string
      retryAfter?: number
      details?: unknown[]
    }
  },
): Response {
  return NextResponse.json({ ...body, meta: { requestId: reqId } }, { status })
}

export async function POST(request: Request): Promise<Response> {
  const reqId = newReqId()

  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    logger.info({ reqId }, "[auth:verify-email] corpo invalido")
    return errorResponse(reqId, 422, {
      error: {
        code: "VALIDATION_ERROR",
        message: "Corpo da requisicao invalido",
      },
    })
  }

  const parsed = verifyEmailSchema.safeParse(payload)
  if (!parsed.success) {
    logger.info({ reqId }, "[auth:verify-email] validacao falhou")
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

  const { token } = parsed.data

  try {
    const vt = await prisma.verificationToken.findUnique({
      where: { token },
    })

    if (vt === null || vt.type !== "EMAIL") {
      logger.warn({ reqId }, "[auth:verify-email] token invalido")
      return errorResponse(reqId, 401, {
        error: {
          code: "AUTH_EMAIL_VERIFY_INVALID",
          message: "Token de verificacao de email invalido",
        },
      })
    }

    if (vt.expiresAt.getTime() < Date.now()) {
      logger.warn({ reqId }, "[auth:verify-email] token expirado")
      await prisma.verificationToken.deleteMany({
        where: { token, type: "EMAIL" },
      })
      return errorResponse(reqId, 410, {
        error: {
          code: "AUTH_EMAIL_VERIFY_EXPIRED",
          message:
            "Token de verificacao de email expirado, solicite um novo email de verificacao",
        },
      })
    }

    const user = await prisma.user.findFirst({
      where: { email: { equals: vt.identifier, mode: "insensitive" } },
      select: {
        id: true,
        isActive: true,
        deletedAt: true,
      },
    })

    if (user === null || user.isActive === false || user.deletedAt !== null) {
      logger.warn(
        { reqId },
        "[auth:verify-email] usuario inativo/deletado na janela LGPD — nao verifica email",
      )
      await prisma.verificationToken.deleteMany({
        where: { token, type: "EMAIL" },
      })
      return errorResponse(reqId, 401, {
        error: {
          code: "AUTH_EMAIL_VERIFY_INVALID",
          message: "Token de verificacao de email invalido",
        },
      })
    }

    const { count } = await prisma.verificationToken.deleteMany({
      where: { token, type: "EMAIL", expiresAt: { gt: new Date() } },
    })
    if (count !== 1) {
      logger.warn(
        { reqId },
        "[auth:verify-email] token ja utilizado (single-use)",
      )
      return errorResponse(reqId, 401, {
        error: {
          code: "AUTH_EMAIL_VERIFY_INVALID",
          message: "Token de verificacao de email invalido",
        },
      })
    }

    await bumpTokenVersion(user.id)
    await prisma.user.update({
      where: { id: user.id },
      data: { emailVerified: new Date() },
    })

    logger.info(
      { reqId, userId: user.id },
      "[auth:verify-email] email verificado",
    )

    const response = NextResponse.json(
      { message: SUCCESS_MESSAGE },
      { status: 200 },
    )
    response.headers.set("cache-control", "no-store")
    return response
  } catch (error) {
    logger.error(
      { err: error, reqId },
      "[auth:verify-email] falha ao verificar email",
    )
    return errorResponse(reqId, 500, {
      error: { code: "INTERNAL_ERROR", message: "Erro interno do servidor" },
    })
  }
}
