import { NextResponse } from "next/server"
import { logger, newReqId } from "@/lib/logger"
import { logoutSchema } from "@/lib/validators/auth"
import {
  AuthTokenError,
  revokeAllSessions,
  revokeRefreshSession,
  verifyAccessToken,
} from "@/services/token-service"
export const dynamic = "force-dynamic"

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

function buildExpireCookie(): string {
  return [
    "refreshToken=",
    "Path=/api/v1/auth",
    "HttpOnly",
    "SameSite=Strict",
    "Max-Age=0",
  ].join("; ")
}

function getBearerToken(request: Request): string {
  const header = request.headers.get("authorization") ?? ""
  const match = /^Bearer\s+(.+)$/i.exec(header)
  return match?.[1] ?? ""
}

function getRefreshToken(request: Request): string {
  const cookie = request.headers.get("cookie") ?? ""
  const match = /(?:^|;\s*)refreshToken=([^;\s]+)/.exec(cookie)
  return match?.[1] ?? ""
}

export async function POST(request: Request): Promise<Response> {
  const reqId = newReqId()

  const bearer = getBearerToken(request)
  if (!bearer) {
    logger.warn({ reqId }, "[auth:logout] token de acesso ausente")
    return errorResponse(reqId, 401, {
      error: {
        code: "AUTH_TOKEN_INVALID",
        message: "Token de acesso ausente",
      },
    })
  }

  let userId: string
  try {
    const verified = await verifyAccessToken(bearer)
    userId = verified.userId
  } catch (err) {
    if (err instanceof Error && err.name === "AuthTokenError") {
      const code = (err as AuthTokenError).code
      logger.warn({ reqId, code }, "[auth:logout] token de acesso rejeitado")
      if (code === "AUTH_ACCOUNT_SUSPENDED") {
        return errorResponse(reqId, 403, {
          error: {
            code,
            message: "Conta inativa ou deletada",
          },
        })
      }
      if (typeof code !== "string" || code.startsWith("AUTH_TOKEN_")) {
        return errorResponse(reqId, 401, {
          error: {
            code,
            message: "Sessao invalida ou expirada",
          },
        })
      }
      return errorResponse(reqId, 500, {
        error: {
          code: "INTERNAL_ERROR",
          message: "Erro interno",
        },
      })
    }

    logger.error(
      { reqId },
      "[auth:logout] erro inesperado na validacao do token — sem expor o token",
    )
    return errorResponse(reqId, 500, {
      error: {
        code: "INTERNAL_ERROR",
        message: "Erro interno",
      },
    })
  }

  let allDevices = false
  try {
    const parsed = logoutSchema.safeParse(await request.json())
    allDevices = parsed.success ? (parsed.data.allDevices ?? false) : false
  } catch {
    // corpo opcional ausente/malformado — segue com revogacao padrao
  }

  try {
    if (allDevices) {
      await revokeAllSessions(userId)
    } else {
      const rawToken = getRefreshToken(request)
      if (rawToken) {
        await revokeRefreshSession(rawToken, userId)
      }
    }
  } catch {
    logger.error(
      { reqId },
      "[auth:logout] erro inesperado na revogacao — sem expor o token",
    )
    return errorResponse(reqId, 500, {
      error: {
        code: "INTERNAL_ERROR",
        message: "Erro interno",
      },
    })
  }

  logger.info(
    { reqId, allDevices },
    "[auth:logout] sessao encerrada com sucesso",
  )

  const response = NextResponse.json(
    { message: "Sessao encerrada com sucesso" },
    { status: 200 },
  )
  response.headers.set("cache-control", "no-store")
  response.headers.set("set-cookie", buildExpireCookie())

  return response
}
