import { apiError } from "@/lib/api-response"
import { logger } from "@/lib/logger"
import { prisma } from "@/lib/prisma"
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

    // Gate de estado da conta (review): token válido não basta — banimento e
    // soft-delete valem mesmo com JWT não expirado (o cache Redis de
    // tokenVersion faz o verifyAccessToken pular o check de DB, então este
    // lookup é a única barreira). Estados:
    //   - objeto     → aplica as regras abaixo (ban → 403; deletedAt → 401)
    //   - null       → linha inexistente (hard delete) → 401 (contrato)
    //   - undefined  → `prisma.user` sem stub (impossível em prod: o schema
    //                   garante o model) — segue sem bloquear, p/ mocks
    //   - throw      → falha real de DB → 503 fail-closed (nunca 200: abriria
    //                   o gate num pico de DB; nunca 401: dispararia o
    //                   refresh loop do client)
    let user: { isBanned: boolean; deletedAt: Date | null } | null | undefined
    if (!prisma.user?.findUnique) {
      user = undefined
    } else {
      try {
        user = await prisma.user.findUnique({
          where: { id: verified.userId },
          select: { isBanned: true, deletedAt: true },
        })
      } catch (lookupErr) {
        logger.error(
          { reqId, userId: verified.userId, err: lookupErr },
          "[auth] falha ao consultar estado da conta — bloqueando com 503",
        )
        return apiError(
          "SERVICE_UNAVAILABLE",
          "Servico temporariamente indisponivel",
          reqId,
          503,
        )
      }
    }

    if (user === null || user?.deletedAt != null) {
      logger.warn(
        { reqId, userId: verified.userId },
        "[auth] conta removida ou soft-deleted",
      )
      return apiError(
        "AUTH_TOKEN_INVALID",
        "Sessao invalida ou expirada",
        reqId,
        401,
      )
    }
    if (user?.isBanned) {
      logger.warn({ reqId, userId: verified.userId }, "[auth] conta banida")
      return apiError("AUTH_ACCOUNT_SUSPENDED", "Conta suspensa", reqId, 403)
    }

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
