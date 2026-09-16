const IS_PRODUCTION = process.env.NODE_ENV === "production"
const CSRF_COOKIE_NAME = IS_PRODUCTION ? "__Host-csrf-token" : "csrf-token"

export function generateCsrfToken(): string {
  const array = new Uint8Array(32)
  crypto.getRandomValues(array)
  return Array.from(array, (b) => b.toString(16).padStart(2, "0")).join("")
}

export function setCsrfCookie(token: string): string {
  const parts = [
    `${CSRF_COOKIE_NAME}=${token}`,
    "SameSite=Strict",
    "Path=/",
    `Max-Age=${60 * 60 * 24}`,
  ]
  if (IS_PRODUCTION) parts.splice(1, 0, "Secure")
  return parts.join("; ")
}

export function getCsrfTokenFromCookie(request: Request): string | undefined {
  const cookieHeader = request.headers.get("cookie")
  if (!cookieHeader) return undefined

  const cookies = cookieHeader.split("; ").reduce(
    (acc, cookie) => {
      const [key, value] = cookie.split("=")
      if (key) acc[key.trim()] = value ?? ""
      return acc
    },
    {} as Record<string, string>,
  )

  return cookies[CSRF_COOKIE_NAME]
}

export function validateCsrfToken(request: Request): boolean {
  const cookieToken = getCsrfTokenFromCookie(request)
  if (!cookieToken) return false

  const headerToken = request.headers.get("x-csrf-token")
  if (!headerToken) return false

  return cookieToken === headerToken
}
