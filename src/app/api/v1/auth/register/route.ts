import { randomBytes } from "node:crypto"
import bcrypt from "bcryptjs"
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { logger, newReqId } from "@/lib/logger"
import { registerSchema } from "@/lib/validators/auth"
import { sendVerificationEmail } from "@/lib/email/email"

export const dynamic = "force-dynamic"

const BCRYPT_COST = 12
const VERIFY_TOKEN_LIFETIME_MS = 24 * 60 * 60 * 1000

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2002"
  )
}

function errorResponse(
  reqId: string,
  status: number,
  body: { error: { code: string; message: string; details?: unknown[] } },
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
    logger.info({ reqId }, "[auth:register] corpo invalido")
    return errorResponse(reqId, 422, {
      error: {
        code: "VALIDATION_ERROR",
        message: "Corpo da requisicao invalido",
      },
    })
  }

  const parsed = registerSchema.safeParse(payload)
  if (!parsed.success) {
    logger.info({ reqId }, "[auth:register] validacao falhou")
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

  const { name, email, password } = parsed.data
  const normalizedEmail = email.toLowerCase()

  const existing = await prisma.user.findFirst({
    where: { email: { equals: normalizedEmail, mode: "insensitive" } },
    select: { id: true },
  })
  if (existing) {
    logger.info({ reqId }, "[auth:register] email ja cadastrado")
    return errorResponse(reqId, 409, {
      error: {
        code: "AUTH_EMAIL_ALREADY_EXISTS",
        message: "E-mail ja cadastrado",
      },
    })
  }

  const token = randomBytes(32).toString("hex")
  const expiresAt = new Date(Date.now() + VERIFY_TOKEN_LIFETIME_MS)

  try {
    const passwordHash = await bcrypt.hash(password, BCRYPT_COST)
    const [user] = await prisma.$transaction([
      prisma.user.create({
        data: {
          name,
          displayName: name,
          email: normalizedEmail,
          passwordHash,
          role: "USER",
          plan: "FREE",
          provider: "EMAIL",
          providerId: normalizedEmail,
        },
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
        "[auth:register] email de verificacao falhou — reenvio via T30",
      )
    }

    logger.info({ reqId, userId: user.id }, "[auth:register] conta criada")

    return NextResponse.json(
      {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          emailVerified: user.emailVerified,
        },
        message: "Email de verificacao enviado",
      },
      { status: 201 },
    )
  } catch (error) {
    if (isUniqueViolation(error)) {
      logger.info({ reqId }, "[auth:register] corrida de email unico (P2002)")
      return errorResponse(reqId, 409, {
        error: {
          code: "AUTH_EMAIL_ALREADY_EXISTS",
          message: "E-mail ja cadastrado",
        },
      })
    }
    logger.error({ err: error, reqId }, "[auth:register] falha ao criar conta")
    return errorResponse(reqId, 500, {
      error: { code: "INTERNAL_ERROR", message: "Erro interno do servidor" },
    })
  }
}
