import bcrypt from "bcryptjs"
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { logger, newReqId } from "@/lib/logger"
import { loginSchema } from "@/lib/validators/auth"
import { signAccessToken, createRefreshSession } from "@/services/token-service"
import {
  isAccountLocked,
  isIpLimited,
  recordLoginFailure,
  resetLoginFailures,
  recordIpAttempt,
} from "@/lib/rate-limit"
export const dynamic = "force-dynamic"

const REFRESH_COOKIE_MAX_AGE = 30 * 24 * 60 * 60 // 30 dias

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

function buildAuthCookie(rawToken: string): string {
  return [
    `refreshToken=${rawToken}`,
    "Path=/api/v1/auth",
    "HttpOnly",
    "SameSite=Strict",
    `Max-Age=${REFRESH_COOKIE_MAX_AGE}`,
  ].join("; ")
}

function getIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")
  if (forwarded) {
    const parts = forwarded.split(",")
    for (const part of parts) {
      const trimmed = part.trim()
      if (trimmed && trimmed !== "unknown") {
        return trimmed
      }
    }
  }
  return "unknown"
}

export async function POST(request: Request): Promise<Response> {
  const reqId = newReqId()
  const ip = getIp(request)

  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    logger.info({ reqId }, "[auth:login] corpo invalido")
    return errorResponse(reqId, 422, {
      error: {
        code: "VALIDATION_ERROR",
        message: "Corpo da requisicao invalido",
      },
    })
  }

  const parsed = loginSchema.safeParse(payload)
  if (!parsed.success) {
    logger.info({ reqId }, "[auth:login] validacao falhou")
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

  const { email, password } = parsed.data
  const normalizedEmail = email.toLowerCase()

  const lockout = isAccountLocked(normalizedEmail)
  if (!lockout.allowed) {
    logger.warn(
      { reqId, email: normalizedEmail },
      "[auth:login] conta bloqueada por tentativas",
    )
    return errorResponse(reqId, 403, {
      error: {
        code: "AUTH_ACCOUNT_LOCKED",
        message: "Conta bloqueada temporariamente",
        retryAfter: lockout.retryAfter,
      },
    })
  }

  const user = await prisma.user.findFirst({
    where: { email: normalizedEmail },
    select: {
      id: true,
      name: true,
      displayName: true,
      email: true,
      role: true,
      plan: true,
      avatar: true,
      isActive: true,
      deletedAt: true,
      emailVerified: true,
      passwordHash: true,
      tokenVersion: true,
    },
  })

  if (user === null) {
    const ipLimit = isIpLimited(ip)
    if (!ipLimit.allowed) {
      logger.warn({ reqId, ip }, "[auth:login] limite de tentativas por IP")
      const res = errorResponse(reqId, 429, {
        error: {
          code: "AUTH_RATE_LIMITED",
          message: "Muitas tentativas de login tente novamente em instantes",
          retryAfter: ipLimit.retryAfter,
        },
      })
      res.headers.set("Retry-After", String(ipLimit.retryAfter))
      return res
    }
    recordLoginFailure(normalizedEmail)
    recordIpAttempt(ip)
    logger.info({ reqId }, "[auth:login] credenciais invalidas")
    return errorResponse(reqId, 401, {
      error: {
        code: "AUTH_INVALID_CREDENTIALS",
        message: "E-mail ou senha invalidos",
      },
    })
  }

  const ipLimit = isIpLimited(ip, user.role)
  if (!ipLimit.allowed) {
    logger.warn({ reqId, ip }, "[auth:login] limite de tentativas por IP")
    const res = errorResponse(reqId, 429, {
      error: {
        code: "AUTH_RATE_LIMITED",
        message: "Muitas tentativas de login tente novamente em instantes",
        retryAfter: ipLimit.retryAfter,
      },
    })
    res.headers.set("Retry-After", String(ipLimit.retryAfter))
    return res
  }

  if (user.isActive === false || user.deletedAt !== null) {
    logger.warn({ reqId, userId: user.id }, "[auth:login] conta suspensa")
    return errorResponse(reqId, 403, {
      error: {
        code: "AUTH_ACCOUNT_SUSPENDED",
        message: "Sua conta esta suspensa",
      },
    })
  }

  if (user.emailVerified === null) {
    logger.info({ reqId, userId: user.id }, "[auth:login] email nao verificado")
    return errorResponse(reqId, 401, {
      error: {
        code: "AUTH_EMAIL_NOT_VERIFIED",
        message: "Verifique seu e-mail antes de entrar",
      },
    })
  }

  const passwordOk =
    user.passwordHash !== null &&
    (await bcrypt.compare(password, user.passwordHash))

  if (!passwordOk) {
    recordLoginFailure(normalizedEmail)
    recordIpAttempt(ip)
    logger.info({ reqId }, "[auth:login] credenciais invalidas")
    return errorResponse(reqId, 401, {
      error: {
        code: "AUTH_INVALID_CREDENTIALS",
        message: "E-mail ou senha invalidos",
      },
    })
  }

  const accessToken = await signAccessToken(user)
  const sessionCtx: { userAgent?: string; ip?: string } = { ip }
  const userAgent = request.headers.get("user-agent")
  if (userAgent) {
    sessionCtx.userAgent = userAgent
  }
  const session = await createRefreshSession(user.id, sessionCtx)

  resetLoginFailures(normalizedEmail)

  logger.info({ reqId, userId: user.id }, "[auth:login] login bem-sucedido")

  const response = NextResponse.json(
    {
      accessToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        displayName: user.displayName,
        role: user.role,
        plan: user.plan,
        avatar: user.avatar,
      },
    },
    { status: 200 },
  )
  response.headers.set("set-cookie", buildAuthCookie(session.rawToken))

  // ADR-011: mint Auth.js session cookie so /dashboard guards (proxy.ts + (app)/layout.tsx) recognize credentials login
  const authSecret = process.env.AUTH_SECRET
  if (!authSecret) {
    logger.error(
      { reqId, userId: user.id },
      "[auth:login] AUTH_SECRET ausente — impossivel cunhar sessao Auth.js",
    )
    throw new Error(
      "AUTH_SECRET environment variable is required for session token issuance",
    )
  }
  const { encode } = await import("next-auth/jwt")
  const isSecure = new URL(request.url).protocol === "https:"
  const sessionJwtMaxAge = REFRESH_COOKIE_MAX_AGE
  const sessionCookieName = isSecure
    ? "__Secure-authjs.session-token"
    : "authjs.session-token"
  const sessionToken = await encode({
    token: {
      sub: user.id,
      userId: user.id,
      customAuth: {
        accessToken,
        refreshToken: session.rawToken,
        emittedAt: Date.now(),
      },
    },
    secret: authSecret,
    salt: sessionCookieName,
    maxAge: sessionJwtMaxAge,
  })
  response.headers.append(
    "set-cookie",
    `${sessionCookieName}=${sessionToken}; Path=/; HttpOnly; SameSite=Lax${isSecure ? "; Secure" : ""}; Max-Age=${sessionJwtMaxAge}`,
  )

  // TODO: Production check: validate SameSite=Strict cookie attribute in production
  // Enable during development: `if (process.env.NODE_ENV === "production") { ... }`

  return response
}
