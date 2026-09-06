import { NextResponse } from "next/server"
import { logger, newReqId } from "@/lib/logger"
import { restoreAccountSchema } from "@/lib/validators/auth"
import { isPasswordResetLimited } from "@/lib/rate-limit"
import {
  restoreAccount,
  RestoreAccountResult,
} from "@/services/account-service"

export const dynamic = "force-dynamic"

function errorResponse(
  reqId: string,
  status: number,
  body: {
    error: {
      code: string
      message: string
      details?: { field: string; message: string }[]
    }
  },
): Response {
  return NextResponse.json({ ...body, meta: { requestId: reqId } }, { status })
}

function successResponse(): Response {
  const response = NextResponse.json(
    {
      message:
        "Se a conta estava na janela de restauracao, o acesso foi restabelecido",
    },
    { status: 200 },
  )
  response.headers.set("cache-control", "no-store")
  return response
}

export async function POST(request: Request): Promise<Response> {
  const reqId = newReqId()
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown"
  const userAgent = request.headers.get("user-agent") ?? "unknown"

  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    logger.info({ reqId }, "[auth:restore-account] corpo invalido")
    return errorResponse(reqId, 422, {
      error: {
        code: "VALIDATION_ERROR",
        message: "Corpo da requisicao invalido",
      },
    })
  }

  const parsed = restoreAccountSchema.safeParse(payload)
  if (!parsed.success) {
    logger.info({ reqId }, "[auth:restore-account] validacao falhou")
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

  // Rate limiting check
  const rateCheck = isPasswordResetLimited(normalizedEmail)
  if (!rateCheck.allowed) {
    logger.info(
      { reqId, email: normalizedEmail, ip },
      "[auth:restore-account] limite de tentativas excedido",
    )
    return errorResponse(reqId, 429, {
      error: {
        code: "RATE_LIMIT_EXCEEDED",
        message: `Muitas tentativas. Tente novamente em ${rateCheck.retryAfter} segundos.`,
      },
    })
  }

  // Use service layer for business logic
  let result: RestoreAccountResult
  try {
    result = await restoreAccount(email, password, reqId, ip, userAgent)
  } catch (error) {
    // Catch any errors from service and return 200 (erro nao exposto)
    logger.error(
      { err: error, reqId, email },
      "[auth:restore-account] erro interno - retorna 200 sem expor",
    )
    return successResponse()
  }

  // Anti-enumeration returns 200 for all no-op cases
  if (!result.success && result.error?.code === "AUTH_RESTORE_WINDOW_EXPIRED") {
    return errorResponse(reqId, 400, {
      error: result.error,
    })
  }

  // All other cases (success, anti-enumeration, no-op) return 200 with timing floor
  return successResponse()
}
