import { timingSafeEqual } from "node:crypto"

import { csrfCookieName } from "@/lib/csrf-cookie-name"

const CSRF_COOKIE_NAME = csrfCookieName()

export function getCsrfTokenFromCookie(request: Request): string | undefined {
  const cookieHeader = request.headers.get("cookie")
  if (!cookieHeader) return undefined

  for (const cookie of cookieHeader.split("; ")) {
    const eqIndex = cookie.indexOf("=")
    if (eqIndex === -1) continue
    const key = cookie.slice(0, eqIndex).trim()
    const value = cookie.slice(eqIndex + 1)
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

export function isAuthTokenError(err: unknown): err is { code: string } {
  return (
    err instanceof Error &&
    err.name === "AuthTokenError" &&
    "code" in err &&
    typeof (err as { code: unknown }).code === "string"
  )
}
