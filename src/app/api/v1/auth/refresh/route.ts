import { NextResponse } from "next/server"
import { logger, newReqId } from "@/lib/logger"
import {
  AuthTokenError,
  rotateRefresh,
  type RotationResult,
} from "@/services/token-service"
export const dynamic = "force-dynamic"

const REFRESH_COOKIE_MAX_AGE = 30 * 24 * 60 * 60 // 30 dias

function errorResponse(
  reqId: string,
  status: number,
  body: {
    error: {
      code: string
      message: string
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

function getRefreshToken(request: Request): string {
  const cookie = request.headers.get("cookie") ?? ""
  const match = /(?:^|;\s*)refreshToken=([^;\s]+)/.exec(cookie)
  return match?.[1] ?? ""
}

export async function POST(request: Request): Promise<Response> {
  const reqId = newReqId()

  const rawToken = getRefreshToken(request)
  if (!rawToken) {
    logger.warn({ reqId }, "[auth:refresh] cookie de refresh ausente")
    return errorResponse(reqId, 401, {
      error: {
        code: "AUTH_REFRESH_TOKEN_INVALID",
        message: "Refresh token invalido",
      },
    })
  }

  let result: RotationResult
  try {
    result = await rotateRefresh(rawToken)
  } catch (err) {
    if (err instanceof Error && err.name === "AuthTokenError") {
      const code = (err as AuthTokenError).code
      logger.warn(
        { reqId, code },
        "[auth:refresh] rotacao rejeitada — sem expor o token",
      )
      if (code === "AUTH_ACCOUNT_SUSPENDED") {
        return errorResponse(reqId, 403, {
          error: {
            code,
            message: "Conta inativa ou deletada",
          },
        })
      }
      if (code.startsWith("AUTH_REFRESH_TOKEN_")) {
        return errorResponse(reqId, 401, {
          error: {
            code,
            message: "Falha ao renovar sessao",
          },
        })
      }
      return errorResponse(reqId, 500, {
        error: {
          code: "INTERNAL_ERROR",
          message: "Falha ao renovar sessao",
        },
      })
    }

    logger.error(
      { reqId },
      "[auth:refresh] erro inesperado na rotacao — sem expor o token",
    )
    return errorResponse(reqId, 500, {
      error: {
        code: "INTERNAL_ERROR",
        message: "Erro interno",
      },
    })
  }

  logger.info({ reqId }, "[auth:refresh] renovacao bem-sucedida")

  const response = NextResponse.json(
    {
      accessToken: result.accessToken,
      expiresIn: result.expiresIn,
      user: result.user,
    },
    { status: 200 },
  )
  response.headers.set("cache-control", "no-store")
  response.headers.set("set-cookie", buildAuthCookie(result.refreshToken))

  // ADR-011: mint Auth.js session cookie so /dashboard guards (proxy.ts + (app)/layout.tsx) recognize credentials refresh
  const authSecret = process.env.AUTH_SECRET
  if (!authSecret) {
    logger.error(
      { reqId },
      "[auth:refresh] AUTH_SECRET ausente — impossivel cunhar sessao Auth.js",
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
      sub: result.user.id,
      userId: result.user.id,
      customAuth: {
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
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

  return response
}
