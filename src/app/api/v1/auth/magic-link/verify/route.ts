import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { logger, newReqId } from "@/lib/logger"
import { magicLinkVerifySchema } from "@/lib/validators/auth"
import { signAccessToken, createRefreshSession } from "@/services/token-service"
import {
  errorResponse,
  buildAuthCookie,
  getIp,
  mintAuthJsSessionCookie,
} from "../../_helpers"

export const dynamic = "force-dynamic"

export async function POST(request: Request): Promise<Response> {
  const reqId = newReqId()
  const ip = getIp(request)

  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    logger.info({ reqId }, "[auth:magic-link:verify] corpo invalido")
    return errorResponse(reqId, 422, {
      error: {
        code: "VALIDATION_ERROR",
        message: "Corpo da requisicao invalido",
      },
    })
  }

  const parsed = magicLinkVerifySchema.safeParse(payload)
  if (!parsed.success) {
    logger.info({ reqId }, "[auth:magic-link:verify] validacao falhou")
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

  const { token } = parsed.data

  try {
    const vt = await prisma.verificationToken.findUnique({
      where: { token },
    })

    if (vt === null || vt.type !== "MAGIC_LINK") {
      logger.warn({ reqId }, "[auth:magic-link:verify] token invalido")
      return errorResponse(reqId, 401, {
        error: {
          code: "AUTH_MAGIC_TOKEN_INVALID",
          message: "Token de magic link invalido",
        },
      })
    }

    if (vt.expiresAt.getTime() < Date.now()) {
      logger.warn({ reqId }, "[auth:magic-link:verify] token expirado")
      await prisma.verificationToken.deleteMany({
        where: { token, type: "MAGIC_LINK" },
      })
      return errorResponse(reqId, 410, {
        error: {
          code: "AUTH_MAGIC_TOKEN_EXPIRED",
          message: "Token de magic link expirado",
        },
      })
    }

    const user = await prisma.user.findFirst({
      where: { email: { equals: vt.identifier, mode: "insensitive" } },
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
        tokenVersion: true,
      },
    })

    if (user === null || user.isActive === false || user.deletedAt !== null) {
      logger.warn(
        { reqId },
        "[auth:magic-link:verify] usuario inativo/deletado na janela LGPD — nao re-autentica",
      )
      await prisma.verificationToken.deleteMany({
        where: { token, type: "MAGIC_LINK" },
      })
      return errorResponse(reqId, 401, {
        error: {
          code: "AUTH_MAGIC_TOKEN_INVALID",
          message: "Token de magic link invalido",
        },
      })
    }

    const { count } = await prisma.verificationToken.deleteMany({
      where: { token, type: "MAGIC_LINK", expiresAt: { gt: new Date() } },
    })
    if (count !== 1) {
      logger.warn(
        { reqId },
        "[auth:magic-link:verify] token ja utilizado (single-use)",
      )
      return errorResponse(reqId, 401, {
        error: {
          code: "AUTH_MAGIC_TOKEN_INVALID",
          message: "Token de magic link invalido",
        },
      })
    }

    const accessToken = await signAccessToken(user)
    const userAgent = request.headers.get("user-agent")
    const session = await createRefreshSession(user.id, {
      ip,
      ...(userAgent ? { userAgent } : {}),
    })

    logger.info(
      { reqId, userId: user.id },
      "[auth:magic-link:verify] magic link redimido com sucesso",
    )

    // ADR-011: mint Auth.js session cookie so /dashboard guards (proxy.ts + (app)/layout.tsx) recognize magic link login
    const authSessionCookie = await mintAuthJsSessionCookie(request, {
      userId: user.id,
      accessToken,
      refreshToken: session.rawToken,
    })

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
    response.headers.set(
      "set-cookie",
      buildAuthCookie(session.rawToken, request),
    )
    response.headers.append("set-cookie", authSessionCookie)

    return response
  } catch (error) {
    logger.error(
      { err: error, reqId },
      "[auth:magic-link:verify] falha ao redimir token",
    )
    return errorResponse(reqId, 500, {
      error: { code: "INTERNAL_ERROR", message: "Erro interno do servidor" },
    })
  }
}
