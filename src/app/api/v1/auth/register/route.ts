import bcrypt from "bcryptjs"
import { NextResponse } from "next/server"
import { randomBytes } from "node:crypto"

import { validateCsrfToken } from "@/lib/csrf"
import { sendVerificationEmail } from "@/lib/email/email"
import { logger, newReqId } from "@/lib/logger"
import { prisma } from "@/lib/prisma"
import {
  isRegisterIpLimited,
  isRegisterLimited,
  recordRegisterAttempt,
  recordRegisterIpAttempt,
} from "@/lib/rate-limit"
import { registerSchema } from "@/lib/validators/auth"
import {
  equalizeNoopTiming,
  errorResponse,
  getBaseUrl,
  getIp,
  maskEmail,
} from "../_helpers"

export const dynamic = "force-dynamic"

const BCRYPT_COST = 12
const VERIFY_TOKEN_LIFETIME_MS = 24 * 60 * 60 * 1000
const DUPLICATE_EMAIL_MESSAGE =
  "Se o e-mail nao estiver cadastrado, um e-mail de verificacao sera enviado"

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2002"
  )
}

async function respondAsDuplicate(
  reqId: string,
  email: string,
  ip: string,
  token: string,
): Promise<Response> {
  await equalizeNoopTiming()
  logger.info(
    { reqId },
    "[auth:register] email ja cadastrado — resposta uniforme anti-enumeracao",
  )

  const verificationUrl = `${getBaseUrl()}/verify-email?token=${token}`
  try {
    await sendVerificationEmail(email, { verificationUrl })
  } catch (error) {
    logger.error(
      { err: error, reqId },
      "[auth:register] email de verificacao falhou",
    )
  }

  recordRegisterAttempt(email)
  recordRegisterIpAttempt(ip)

  return NextResponse.json(
    { message: DUPLICATE_EMAIL_MESSAGE },
    { status: 201 },
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

  // CSRF (double-submit): validado antes de qualquer efeito colateral
  // (mesmo padrao do login; sem CSRF valido nao ha rate-limit/bcrypt/DB)
  if (!validateCsrfToken(request)) {
    logger.warn({ reqId }, "[auth:register] CSRF token invalido")
    return errorResponse(reqId, 403, {
      error: {
        code: "CSRF_TOKEN_INVALID",
        message: "Token CSRF invalido",
      },
    })
  }

  const ip = getIp(request)

  const ipLimit = isRegisterIpLimited(ip)
  if (!ipLimit.allowed) {
    logger.warn({ reqId, ip }, "[auth:register] limite de tentativas por IP")
    const res = errorResponse(reqId, 429, {
      error: {
        code: "AUTH_RATE_LIMITED",
        message: "Muitas tentativas de cadastro tente novamente em instantes",
        retryAfter: ipLimit.retryAfter,
      },
    })
    res.headers.set("Retry-After", String(ipLimit.retryAfter))
    return res
  }

  const emailLimit = isRegisterLimited(normalizedEmail)
  if (!emailLimit.allowed) {
    logger.warn(
      { reqId, email: maskEmail(normalizedEmail) },
      "[auth:register] limite de cadastro por email",
    )
    const res = errorResponse(reqId, 429, {
      error: {
        code: "AUTH_RATE_LIMITED",
        message: "Muitas tentativas de cadastro tente novamente em instantes",
        retryAfter: emailLimit.retryAfter,
      },
    })
    res.headers.set("Retry-After", String(emailLimit.retryAfter))
    return res
  }

  const token = randomBytes(32).toString("hex")
  const expiresAt = new Date(Date.now() + VERIFY_TOKEN_LIFETIME_MS)

  try {
    const existing = await prisma.user.findFirst({
      where: { email: { equals: normalizedEmail, mode: "insensitive" } },
      select: { id: true },
    })

    if (!existing) {
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
            profile: { create: {} },
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

      logger.info({ reqId, userId: user.id }, "[auth:register] conta criada")
    } else {
      return await respondAsDuplicate(reqId, normalizedEmail, ip, token)
    }

    const baseUrl = getBaseUrl()
    const verificationUrl = `${baseUrl}/verify-email?token=${token}`
    try {
      await sendVerificationEmail(normalizedEmail, { verificationUrl })
    } catch (error) {
      logger.error(
        { err: error, reqId },
        "[auth:register] email de verificacao falhou — reenvio via T30",
      )
    }

    recordRegisterAttempt(normalizedEmail)
    recordRegisterIpAttempt(ip)

    return NextResponse.json(
      { message: DUPLICATE_EMAIL_MESSAGE },
      { status: 201 },
    )
  } catch (error) {
    if (isUniqueViolation(error)) {
      logger.info({ reqId }, "[auth:register] corrida de email unico (P2002)")
      return await respondAsDuplicate(reqId, normalizedEmail, ip, token)
    }
    logger.error({ err: error, reqId }, "[auth:register] falha ao criar conta")
    return errorResponse(reqId, 500, {
      error: { code: "INTERNAL_ERROR", message: "Erro interno do servidor" },
    })
  }
}
