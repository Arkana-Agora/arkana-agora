import { timingSafeEqual } from "node:crypto"

const IS_PRODUCTION = process.env.NODE_ENV === "production"
const CSRF_COOKIE_NAME = IS_PRODUCTION ? "__Host-csrf-token" : "csrf-token"

export function generateCsrfToken(): string {
  const array = new Uint8Array(32)
  crypto.getRandomValues(array)
  return Array.from(array, (b) => b.toString(16).padStart(2, "0")).join("")
}

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

  if (cookieToken.length !== headerToken.length) return false
  return timingSafeEqual(
    Buffer.from(cookieToken, "utf8"),
    Buffer.from(headerToken, "utf8"),
  )
}

export function isAuthTokenError(err: unknown): err is { code: string } {
  return (
    err instanceof Error &&
    err.name === "AuthTokenError" &&
    "code" in err &&
    typeof (err as { code: unknown }).code === "string"
  )
}
