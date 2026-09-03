import { randomBytes } from "node:crypto"
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { logger, newReqId } from "@/lib/logger"
import { magicLinkSchema } from "@/lib/validators/auth"
import { sendMagicLinkEmail } from "@/lib/email/email"
import {
  isMagicLinkLimited,
  isMagicLinkIpLimited,
  recordMagicLinkIpAttempt,
  recordMagicLinkRequest,
} from "@/lib/rate-limit"

export const dynamic = "force-dynamic"

const MAGIC_LINK_LIFETIME_MS = 15 * 60 * 1000

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

  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    logger.info({ reqId }, "[auth:magic-link] corpo invalido")
    return errorResponse(reqId, 422, {
      error: {
        code: "VALIDATION_ERROR",
        message: "Corpo da requisicao invalido",
      },
    })
  }

  const parsed = magicLinkSchema.safeParse(payload)
  if (!parsed.success) {
    logger.info({ reqId }, "[auth:magic-link] validacao falhou")
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

  const ipLimit = isMagicLinkIpLimited(ip)
  if (!ipLimit.allowed) {
    logger.warn({ reqId, ip }, "[auth:magic-link] limite por IP atingido")
    return errorResponse(reqId, 429, {
      error: {
        code: "AUTH_MAGIC_LINK_RATE_LIMIT",
        message: "Muitos magic links solicitados, tente novamente mais tarde",
        retryAfter: ipLimit.retryAfter,
      },
    })
  }
  recordMagicLinkIpAttempt(ip)

  const limit = isMagicLinkLimited(normalizedEmail)
  if (!limit.allowed) {
    logger.warn(
      { reqId },
      "[auth:magic-link] limite de magic links por email atingido",
    )
    return errorResponse(reqId, 429, {
      error: {
        code: "AUTH_MAGIC_LINK_RATE_LIMIT",
        message: "Muitos magic links solicitados, tente novamente mais tarde",
        retryAfter: limit.retryAfter,
      },
    })
  }
  recordMagicLinkRequest(normalizedEmail)

  try {
    const user = await prisma.user.findFirst({
      where: { email: { equals: normalizedEmail, mode: "insensitive" } },
      select: {
        id: true,
        isActive: true,
        emailVerified: true,
        deletedAt: true,
      },
    })

    const canIssue =
      user !== null &&
      user.isActive === true &&
      user.deletedAt === null &&
      user.emailVerified !== null

    if (!canIssue) {
      logger.info(
        { reqId },
        "[auth:magic-link] no-op anti-enumeracao (email inexistente/inativo/nao verificado)",
      )
      return NextResponse.json(
        { message: "Magic link enviado se o e-mail estiver cadastrado" },
        { status: 200 },
      )
    }

    const token = randomBytes(32).toString("hex")
    const expiresAt = new Date(Date.now() + MAGIC_LINK_LIFETIME_MS)

    await prisma.verificationToken.create({
      data: {
        identifier: normalizedEmail,
        token,
        type: "MAGIC_LINK",
        expiresAt,
      },
    })

    const baseUrl = getBaseUrl()
    const magicUrl = `${baseUrl}/auth/login?token=${token}`
    try {
      await sendMagicLinkEmail(normalizedEmail, { url: magicUrl })
    } catch (error) {
      logger.error(
        { err: error, reqId },
        "[auth:magic-link] envio de email falhou — usuario pode solicitar novo link",
      )
    }

    logger.info({ reqId }, "[auth:magic-link] magic link gerado")

    return NextResponse.json(
      { message: "Magic link enviado se o e-mail estiver cadastrado" },
      { status: 200 },
    )
  } catch (error) {
    logger.error({ err: error, reqId }, "[auth:magic-link] falha ao gerar link")
    return errorResponse(reqId, 500, {
      error: { code: "INTERNAL_ERROR", message: "Erro interno do servidor" },
    })
  }
}
