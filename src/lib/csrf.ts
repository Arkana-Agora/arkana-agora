import { timingSafeEqual } from "node:crypto"

import { apiError } from "@/lib/api-response"
import { csrfCookieName } from "@/lib/csrf-cookie-name"

const CSRF_COOKIE_NAME = csrfCookieName()

export function getCsrfTokenFromCookie(request: Request): string | undefined {
  const cookieHeader = request.headers.get("cookie")
  if (!cookieHeader) return undefined

  for (const cookie of cookieHeader.split(";")) {
    const eqIndex = cookie.indexOf("=")
    if (eqIndex === -1) continue
    const key = cookie.slice(0, eqIndex).trim()
    const value = cookie.slice(eqIndex + 1).trim()
    if (key === CSRF_COOKIE_NAME) return value
  }
  return undefined
}

export function validateCsrfToken(request: Request): boolean {
  const cookieToken = getCsrfTokenFromCookie(request)
  if (!cookieToken) return false

  const headerToken = request.headers.get("x-csrf-token")
  if (!headerToken) return false

  const cookieBuf = Buffer.from(cookieToken, "utf8")
  const headerBuf = Buffer.from(headerToken, "utf8")
  if (cookieBuf.length !== headerBuf.length) return false
  return timingSafeEqual(cookieBuf, headerBuf)
}

/** Resposta uniforme 403 para cookie/header divergentes ou ausentes (T041).
 * Code canônico `CSRF_TOKEN_INVALID` (AC-20 / pattern set-csrf-cookie-client-side
 * — o middleware T041 emitia `CSRF_INVALID`, divergência fechada na review).
 * O Set-Cookie é feito APENAS no client via `ensureCsrfCookie` (single-writer
 * por design — review removeu o builder server-side morto `buildCsrfSetCookieHeader`). */
export function csrfErrorResponse(reqId: string): Response {
  return apiError(
    "CSRF_TOKEN_INVALID",
    "Token CSRF inválido ou ausente",
    reqId,
    403,
  )
}
