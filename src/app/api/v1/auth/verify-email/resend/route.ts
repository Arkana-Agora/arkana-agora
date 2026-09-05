import { randomBytes } from "node:crypto"
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { logger, newReqId } from "@/lib/logger"
import { verifyEmailResendSchema } from "@/lib/validators/auth"
import { sendVerificationEmail } from "@/lib/email/email"

export const dynamic = "force-dynamic"

const VERIFY_TOKEN_LIFETIME_MS = 24 * 60 * 60 * 1000

const SUCCESS_MESSAGE = "Email de verificacao enviado"

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

export async function POST(request: Request): Promise<Response> {
  const reqId = newReqId()

  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    logger.info({ reqId }, "[auth:verify-email:resend] corpo invalido")
    return errorResponse(reqId, 422, {
      error: {
        code: "VALIDATION_ERROR",
        message: "Corpo da requisicao invalido",
      },
    })
  }

  const parsed = verifyEmailResendSchema.safeParse(payload)
  if (!parsed.success) {
    logger.info({ reqId }, "[auth:verify-email:resend] validacao falhou")
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

  const normalizedEmail = parsed.data.email.toLowerCase()

  try {
    const user = await prisma.user.findFirst({
      where: { email: { equals: normalizedEmail, mode: "insensitive" } },
      select: {
        id: true,
        emailVerified: true,
        isActive: true,
        deletedAt: true,
      },
    })

    if (
      user === null ||
      user.isActive === false ||
      user.deletedAt !== null ||
      user.emailVerified !== null
    ) {
      logger.info(
        { reqId },
        "[auth:verify-email:resend] sem destino de reenvio — resposta uniforme (anti-enumeracao)",
      )
      await equalizeNoopTiming()
      const response = NextResponse.json(
        { message: SUCCESS_MESSAGE },
        { status: 200 },
      )
      response.headers.set("cache-control", "no-store")
      return response
    }

    const token = randomBytes(32).toString("hex")
    const expiresAt = new Date(Date.now() + VERIFY_TOKEN_LIFETIME_MS)

    await prisma.$transaction([
      prisma.verificationToken.deleteMany({
        where: { identifier: normalizedEmail, type: "EMAIL" },
      }),
      prisma.verificationToken.create({
        data: {
          identifier: normalizedEmail,
          token,
          type: "EMAIL",
          expiresAt,
        },
      }),
    ])

    const baseUrl = getBaseUrl()
    const verificationUrl = `${baseUrl}/auth/verify-email?token=${token}`
    try {
      await sendVerificationEmail(normalizedEmail, { verificationUrl })
    } catch (error) {
      logger.error(
        { err: error, reqId },
        "[auth:verify-email:resend] envio do email falhou",
      )
    }

    logger.info(
      { reqId, userId: user.id },
      "[auth:verify-email:resend] token de verificacao reenviado",
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
      "[auth:verify-email:resend] falha ao reenviar token",
    )
    return errorResponse(reqId, 500, {
      error: { code: "INTERNAL_ERROR", message: "Erro interno do servidor" },
    })
  }
}
