import { logger, newReqId } from "@/lib/logger"
import { restoreAccountSchema } from "@/lib/validators/auth"
import {
  isPasswordResetLimited,
  recordPasswordResetRequest,
} from "@/lib/rate-limit"
import {
  restoreAccount,
  type RestoreAccountResult,
} from "@/services/account-service"
import {
  errorResponse,
  getIp,
  equalizeNoopTiming,
  successResponse,
} from "../_helpers"

export const dynamic = "force-dynamic"

const RESTORE_SUCCESS_MESSAGE =
  "Se a conta estava na janela de restauracao, o acesso foi restabelecido"

export async function POST(request: Request): Promise<Response> {
  const reqId = newReqId()
  const ip = getIp(request)
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
    const res = errorResponse(reqId, 429, {
      error: {
        code: "AUTH_RATE_LIMITED",
        message:
          "Muitas tentativas de restauracao, tente novamente em instantes",
        retryAfter: rateCheck.retryAfter,
      },
    })
    res.headers.set("Retry-After", String(rateCheck.retryAfter))
    return res
  }
  recordPasswordResetRequest(normalizedEmail)

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
    return successResponse({ message: RESTORE_SUCCESS_MESSAGE })
  }

  // Anti-enumeration returns 200 for all no-op cases
  if (!result.success && result.error?.code === "AUTH_RESTORE_WINDOW_EXPIRED") {
    // Piso de timing p/ nao diferenciar conta deletada ha tempo da inexistente
    await equalizeNoopTiming()
    return errorResponse(reqId, 400, {
      error: result.error,
    })
  }

  // All other cases (success, anti-enumeration, no-op) return 200 with timing floor
  return successResponse({ message: RESTORE_SUCCESS_MESSAGE })
}
