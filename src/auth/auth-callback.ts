import { getToken } from "next-auth/jwt"
import { logger } from "@/lib/logger"

const REFRESH_COOKIE_MAX_AGE = 30 * 24 * 60 * 60 // 30 dias

interface CustomAuthClaims {
  accessToken?: string
  refreshToken?: string
}

function buildAuthCookie(rawToken: string): string {
  return [
    `refreshToken=${rawToken}`,
    "Path=/api/v1/auth",
    "HttpOnly",
    "Secure",
    "SameSite=Strict",
    `Max-Age=${REFRESH_COOKIE_MAX_AGE}`,
  ].join("; ")
}

const SESSION_COOKIE_RE = /^(__Secure-)?authjs\.session-token(\.\d+)?=([^;]+)/

function findSessionCookie(
  setCookies: string[],
): { name: string; value: string; secure: boolean } | null {
  let baseName = ""
  let secure = false
  const chunks: Array<{ suffix: number; value: string }> = []

  for (const cookie of setCookies) {
    const match = cookie.match(SESSION_COOKIE_RE)
    if (!match) continue
    baseName = `${match[1] ?? ""}authjs.session-token`
    secure = Boolean(match[1])
    chunks.push({
      suffix: match[2] ? Number(match[2].slice(1)) : 0,
      value: match[3]!,
    })
  }

  if (chunks.length === 0) return null
  chunks.sort((a, b) => a.suffix - b.suffix)

  return {
    name: baseName,
    value: chunks.map((chunk) => chunk.value).join(""),
    secure,
  }
}

export async function finalizeAuthResponse(
  response: Response,
  secret: string,
): Promise<Response> {
  if (response.status < 300 || response.status > 399) {
    return response
  }

  const location = response.headers.get("location")
  if (!location || location.startsWith("/login")) {
    return response
  }

  const sessionCookie = findSessionCookie(response.headers.getSetCookie())
  if (!sessionCookie) {
    return response
  }

  const baseUrl = new URL("http://localhost:3000")
  const request = new Request(baseUrl, {
    headers: { cookie: `${sessionCookie.name}=${sessionCookie.value}` },
  })
  const token = await getToken({
    req: request,
    secret,
    secureCookie: sessionCookie.secure,
    cookieName: sessionCookie.name,
  })
  const customAuth = token?.customAuth as CustomAuthClaims | undefined
  if (!customAuth?.refreshToken) {
    return response
  }

  logger.info(
    { userId: typeof token?.sub === "string" ? token.sub : undefined },
    "[auth:oauth-callback] custom tokens emitted - refreshToken cookie set, redirect to /dashboard",
  )

  const final = new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  })
  final.headers.set("location", "/dashboard")
  final.headers.append("set-cookie", buildAuthCookie(customAuth.refreshToken))
  return final
}
