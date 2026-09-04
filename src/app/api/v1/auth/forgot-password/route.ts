import { randomBytes } from "node:crypto"
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { logger, newReqId } from "@/lib/logger"
import { forgotPasswordSchema } from "@/lib/validators/auth"
import { sendPasswordResetEmail } from "@/lib/email/email"
import {
  isPasswordResetLimited,
  recordPasswordResetRequest,
} from "@/lib/rate-limit"

export const dynamic = "force-dynamic"

const PASSWORD_RESET_LIFETIME_MS = 60 * 60 * 1000

const NOOP_MESSAGE =
  "Se o e-mail estiver cadastrado, voce recebera instrucoes para redefinir sua senha"

const NOOP_EQUALIZE_MS = 250

async function equalizeNoopTiming(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, NOOP_EQUALIZE_MS))
}

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

function getBaseUrl(): string {
  return (
    process.env.AUTH_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    "http://localhost:3000"
  )
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
      "[auth:forgot-password] corpo invalido",
    )
    return errorResponse(reqId, 422, {
      error: {
        code: "VALIDATION_ERROR",
        message: "Corpo da requisicao invalido",
      },
    })
  }

  const parsed = forgotPasswordSchema.safeParse(payload)
  if (!parsed.success) {
    logger.info(
      { reqId, ip, userAgent },
      "[auth:forgot-password] validacao falhou",
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

  const { email } = parsed.data
  const normalizedEmail = email.toLowerCase()

  const limit = isPasswordResetLimited(normalizedEmail)
  if (!limit.allowed) {
    logger.warn(
      { reqId, ip, userAgent },
      "[auth:forgot-password] limite de pedidos de reset por email atingido",
    )
    return errorResponse(reqId, 429, {
      error: {
        code: "AUTH_FORGOT_RATE_LIMIT",
        message:
          "Muitos pedidos de recuperacao de senha, tente novamente mais tarde",
        retryAfter: limit.retryAfter,
      },
    })
  }
  recordPasswordResetRequest(normalizedEmail)

  try {
    const user = await prisma.user.findFirst({
      where: { email: { equals: normalizedEmail, mode: "insensitive" } },
      select: {
        isActive: true,
        deletedAt: true,
      },
    })

    const canIssue =
      user !== null && user.isActive === true && user.deletedAt === null

    if (!canIssue) {
      logger.info(
        { reqId, ip, userAgent },
        "[auth:forgot-password] no-op anti-enumeracao (email inexistente/inativo/deletado)",
      )
      await equalizeNoopTiming()
      return NextResponse.json({ message: NOOP_MESSAGE }, { status: 200 })
    }

    const token = randomBytes(32).toString("hex")
    const expiresAt = new Date(Date.now() + PASSWORD_RESET_LIFETIME_MS)

    await prisma.verificationToken.create({
      data: {
        identifier: normalizedEmail,
        token,
        type: "PASSWORD_RESET",
        expiresAt,
      },
    })

    const baseUrl = getBaseUrl()
    const resetUrl = `${baseUrl}/auth/reset-password?token=${token}`
    try {
      await sendPasswordResetEmail(normalizedEmail, { resetUrl })
    } catch (error) {
      logger.error(
        { err: error, reqId, ip, userAgent },
        "[auth:forgot-password] envio de email falhou — usuario pode solicitar novo pedido",
      )
    }

    logger.info(
      { reqId, ip, userAgent },
      "[auth:forgot-password] pedido de reset registrado",
    )

    return NextResponse.json({ message: NOOP_MESSAGE }, { status: 200 })
  } catch (error) {
    logger.error(
      { err: error, reqId, ip, userAgent },
      "[auth:forgot-password] falha ao registrar pedido de reset",
    )
    return errorResponse(reqId, 500, {
      error: { code: "INTERNAL_ERROR", message: "Erro interno do servidor" },
    })
  }
}
