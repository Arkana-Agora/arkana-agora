import { NextResponse } from "next/server"
import { logger, newReqId } from "@/lib/logger"
import { logoutSchema } from "@/lib/validators/auth"
import {
  AuthTokenError,
  revokeAllSessions,
  revokeRefreshSession,
  verifyAccessToken,
} from "@/services/token-service"
import {
  errorResponse,
  buildExpireCookie,
  buildSessionExpireCookie,
  getBearerToken,
  getRefreshToken,
} from "../_helpers"
export const dynamic = "force-dynamic"

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
      if (code.startsWith("AUTH_TOKEN_")) {
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
  response.headers.set("set-cookie", buildExpireCookie(request))
  // ADR-011: expira tambem o cookie de sessao Auth.js (dashboard guard)
  response.headers.append("set-cookie", buildSessionExpireCookie(request))

  return response
}
