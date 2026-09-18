import { NextResponse } from "next/server"

// ── Constants ──────────────────────────────────────────────────────────────

export const REFRESH_COOKIE_MAX_AGE = 30 * 24 * 60 * 60 // 30 days

// ── Error / Success responses ──────────────────────────────────────────────

export function errorResponse(
  reqId: string,
  status: number,
  body: {
    error: {
      code: string
      message: string
      retryAfter?: number
      details?: unknown[]
    }
  },
): Response {
  return NextResponse.json({ ...body, meta: { requestId: reqId } }, { status })
}

export function successResponse(
  status: number,
  body: Record<string, unknown>,
): Response {
  return NextResponse.json(body, { status })
}

// ── Cookie helpers ─────────────────────────────────────────────────────────

function isSecure(): boolean {
  return process.env.NODE_ENV === "production"
}

export function buildAuthCookie(rawToken: string): string {
  const parts = [
    `refreshToken=${rawToken}`,
    "Path=/api/v1/auth",
    "HttpOnly",
    "SameSite=Strict",
    `Max-Age=${REFRESH_COOKIE_MAX_AGE}`,
  ]
  if (isSecure()) {
    parts.push("Secure")
  }
  return parts.join("; ")
}

export function buildExpireCookie(): string {
  const parts = [
    "refreshToken=",
    "Path=/api/v1/auth",
    "HttpOnly",
    "SameSite=Strict",
    "Max-Age=0",
  ]
  if (isSecure()) {
    parts.push("Secure")
  }
  return parts.join("; ")
}

// ── Request parsing ────────────────────────────────────────────────────────

export function getIp(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown"
  )
}

export function getRefreshToken(request: Request): string {
  const cookie = request.headers.get("cookie") ?? ""
  const match = /(?:^|;\s*)refreshToken=([^;\s]+)/.exec(cookie)
  return match?.[1] ?? ""
}

export function getBearerToken(request: Request): string {
  const header = request.headers.get("authorization") ?? ""
  const match = /^Bearer\s+(.+)$/i.exec(header)
  return match?.[1] ?? ""
}

export function getBaseUrl(): string {
  return (
    process.env.AUTH_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    "http://localhost:3000"
  )
}
