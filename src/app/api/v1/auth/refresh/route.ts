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
    },
    { status: 200 },
  )
  response.headers.set("cache-control", "no-store")
  response.headers.set("set-cookie", buildAuthCookie(result.refreshToken))

  return response
}
