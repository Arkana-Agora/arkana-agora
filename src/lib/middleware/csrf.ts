import { csrfErrorResponse, validateCsrfToken } from "@/lib/csrf"
import { needsCsrf } from "@/lib/csrf-methods"
import { logger } from "@/lib/logger"

/**
 * CSRF middleware (T041/US-020): valida header `x-csrf-token` vs cookie
 * nos métodos inseguros (POST/PATCH/PUT/DELETE) e, quando o navegador envia
 * `Origin`, que ele seja same-origin (defesa em profundidade da review).
 * `null` = OK; Response = 403 `CSRF_TOKEN_INVALID` (canônico AC-20, padrão
 * `set-csrf-cookie-client-side` do Sprint 1).
 *
 * Node runtime: roda dentro dos Route Handlers (via `enforceCsrf`).
 * NUNCA wire em `src/proxy.ts` (Edge — `validateCsrfToken` usa Web Crypto
 * via Node APIs incompativeis com o runtime de proxy).
 */

export { needsCsrf }

export function enforceCsrf(request: Request, reqId: string): Response | null {
  if (!needsCsrf(request.method)) return null

  const origin = request.headers.get("origin")
  if (origin) {
    let matches = false
    try {
      matches = origin === new URL(request.url).origin
    } catch {
      matches = false
    }
    if (!matches) {
      logger.warn(
        {
          path: new URL(request.url).pathname,
          reqId,
          reason: "origin_mismatch",
          origin,
        },
        "csrf_failure",
      )
      return csrfErrorResponse(reqId)
    }
  }

  if (validateCsrfToken(request)) return null

  logger.warn(
    {
      path: new URL(request.url).pathname,
      reqId,
      reason: "token_mismatch",
    },
    "csrf_failure",
  )
  return csrfErrorResponse(reqId)
}
