import { logger } from "@/lib/logger"
import { AuthTokenError, verifyAccessToken } from "@/services/token-service"

export function getBearerToken(request: Request): string {
  const header = request.headers.get("authorization") ?? ""
  const match = /^Bearer\s+(.+)$/i.exec(header)
  return match?.[1] ?? ""
}

export async function requireAuth(
  request: Request,
  reqId: string,
): Promise<{ userId: string } | Response> {
  const bearer = getBearerToken(request)
  if (!bearer) {
    logger.warn({ reqId }, "[auth] token de acesso ausente")
    return Response.json(
      {
        error: {
          code: "AUTH_TOKEN_INVALID",
          message: "Token de acesso ausente",
        },
        meta: { requestId: reqId },
      },
      { status: 401 },
    )
  }

  try {
    const verified = await verifyAccessToken(bearer)
    return { userId: verified.userId }
  } catch (err) {
    if (err instanceof Error && err.name === "AuthTokenError") {
      const code = (err as AuthTokenError).code
      // Config failures (ex: missing JWT_PUBLIC_KEY) are server faults.
      // Answering 401 here would silently degrade every token to "invalid"
      // and drive the client into an endless refresh -> retry loop.
      if (code.startsWith("AUTH_CONFIG_")) {
        logger.error(
          { reqId, code },
          "[auth:config] configuracao de chave JWT invalida no servidor",
        )
        return Response.json(
          {
            error: { code, message: "Configuracao interna invalida" },
            meta: { requestId: reqId },
          },
          { status: 500 },
        )
      }
      logger.warn({ reqId, code }, "[auth] token rejeitado")
      return Response.json(
        {
          error: { code, message: "Sessao invalida ou expirada" },
          meta: { requestId: reqId },
        },
        { status: 401 },
      )
    }
    logger.error({ reqId }, "[auth] erro inesperado na validacao do token")
    return Response.json(
      {
        error: { code: "INTERNAL_ERROR", message: "Erro interno" },
        meta: { requestId: reqId },
      },
      { status: 500 },
    )
  }
}
