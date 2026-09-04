import bcrypt from "bcryptjs"
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { logger, newReqId } from "@/lib/logger"
import { resetPasswordSchema } from "@/lib/validators/auth"
import { revokeAllSessions } from "@/services/token-service"

export const dynamic = "force-dynamic"

const BCRYPT_COST = 12

const SUCCESS_MESSAGE = "Senha redefinida com sucesso"

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

function getIp(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown"
  )
}

export async function POST(request: Request): Promise<Response> {
  const reqId = newReqId()
  const ip = getIp(request)
  const userAgent = request.headers.get("user-agent") ?? "unknown"

  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    logger.info(
      { reqId, ip, userAgent },
      "[auth:reset-password] corpo invalido",
    )
    return errorResponse(reqId, 422, {
      error: {
        code: "VALIDATION_ERROR",
        message: "Corpo da requisicao invalido",
      },
    })
  }

  const parsed = resetPasswordSchema.safeParse(payload)
  if (!parsed.success) {
    logger.info(
      { reqId, ip, userAgent },
      "[auth:reset-password] validacao falhou",
    )
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

  const { token, password } = parsed.data

  try {
    const vt = await prisma.verificationToken.findUnique({
      where: { token },
    })

    if (vt === null || vt.type !== "PASSWORD_RESET") {
      logger.warn(
        { reqId, ip, userAgent },
        "[auth:reset-password] token invalido",
      )
      return errorResponse(reqId, 401, {
        error: {
          code: "AUTH_RESET_TOKEN_INVALID",
          message: "Token de redefinicao de senha invalido",
        },
      })
    }

    if (vt.expiresAt.getTime() < Date.now()) {
      logger.warn(
        { reqId, ip, userAgent },
        "[auth:reset-password] token expirado",
      )
      await prisma.verificationToken.deleteMany({
        where: { token, type: "PASSWORD_RESET" },
      })
      return errorResponse(reqId, 410, {
        error: {
          code: "AUTH_RESET_TOKEN_EXPIRED",
          message:
            "Sessao de redefinicao de senha expirada, solicite um novo link",
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
        { reqId, ip, userAgent },
        "[auth:reset-password] usuario inativo/deletado na janela LGPD — nao reativa conta",
      )
      await prisma.verificationToken.deleteMany({
        where: { token, type: "PASSWORD_RESET" },
      })
      return errorResponse(reqId, 401, {
        error: {
          code: "AUTH_RESET_TOKEN_INVALID",
          message: "Token de redefinicao de senha invalido",
        },
      })
    }

    const { count } = await prisma.verificationToken.deleteMany({
      where: { token, type: "PASSWORD_RESET", expiresAt: { gt: new Date() } },
    })
    if (count !== 1) {
      logger.warn(
        { reqId, ip, userAgent },
        "[auth:reset-password] token ja utilizado (single-use)",
      )
      return errorResponse(reqId, 401, {
        error: {
          code: "AUTH_RESET_TOKEN_INVALID",
          message: "Token de redefinicao de senha invalido",
        },
      })
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_COST)
    await revokeAllSessions(user.id)
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    })

    logger.info(
      { reqId, userId: user.id, ip, userAgent, code: "AUTH_PASSWORD_RESET" },
      "[auth:reset-password] senha redefinida",
    )

    const response = NextResponse.json(
      { message: SUCCESS_MESSAGE },
      { status: 200 },
    )
    response.headers.set("cache-control", "no-store")
    return response
  } catch (error) {
    logger.error(
      { err: error, reqId, ip, userAgent },
      "[auth:reset-password] falha ao redefinir senha",
    )
    return errorResponse(reqId, 500, {
      error: { code: "INTERNAL_ERROR", message: "Erro interno do servidor" },
    })
  }
}
