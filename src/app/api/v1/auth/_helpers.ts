import { NextResponse } from "next/server"

import { logger } from "@/lib/logger"

// ── Constants ──────────────────────────────────────────────────────────────

export const REFRESH_COOKIE_MAX_AGE = 30 * 24 * 60 * 60 // 30 days

export const NOOP_EQUALIZE_MS = 250
const NOOP_JITTER_MIN_MS = 240
const NOOP_JITTER_MAX_MS = 400

// ── Error / Success responses ──────────────────────────────────────────────

interface ErrorBody {
  error: {
    code: string
    message: string
    retryAfter?: number
    details?: unknown[]
  }
}

export function errorResponse(
  reqId: string,
  status: number,
  body: ErrorBody,
): Response {
  return NextResponse.json({ ...body, meta: { requestId: reqId } }, { status })
}

export function successResponse(body: Record<string, unknown>): Response {
  const response = NextResponse.json(body, { status: 200 })
  response.headers.set("cache-control", "no-store")
  return response
}

// ── Timing equalization ────────────────────────────────────────────────────

export async function equalizeNoopTiming(): Promise<void> {
  const jitter = Math.floor(
    Math.random() * (NOOP_JITTER_MAX_MS - NOOP_JITTER_MIN_MS) +
      NOOP_JITTER_MIN_MS,
  )
  await new Promise((resolve) => setTimeout(resolve, jitter))
}

// ── Cookie helpers ─────────────────────────────────────────────────────────

function isSecure(request?: Request): boolean {
  if (request) {
    // Vercel/edge set x-forwarded-proto to the scheme observed at the edge.
    // Trust it first so TLS-terminating proxies (internal http URL) do not
    // silently downgrade the Secure attribute / __Secure- prefix.
    const forwardedProto = request.headers.get("x-forwarded-proto")
    if (forwardedProto === "https" || forwardedProto === "http") {
      return forwardedProto === "https"
    }
    try {
      return new URL(request.url).protocol === "https:"
    } catch {
      // fall through to NODE_ENV
    }
  }
  return process.env.NODE_ENV === "production"
}

export function buildAuthCookie(rawToken: string, request?: Request): string {
  const parts = [
    `refreshToken=${rawToken}`,
    "Path=/api/v1/auth",
    "HttpOnly",
    "SameSite=Strict",
    `Max-Age=${REFRESH_COOKIE_MAX_AGE}`,
  ]
  if (isSecure(request)) {
    parts.push("Secure")
  }
  return parts.join("; ")
}

export function buildExpireCookie(request?: Request): string {
  const parts = [
    "refreshToken=",
    "Path=/api/v1/auth",
    "HttpOnly",
    "SameSite=Strict",
    "Max-Age=0",
  ]
  if (isSecure(request)) {
    parts.push("Secure")
  }
  return parts.join("; ")
}

// ── Request parsing ────────────────────────────────────────────────────────

// Trusts Vercel-set x-forwarded-for (client IP is the leftmost value);
// falls back to x-real-ip when present.
export function getIp(request: Request): string {
  // In non-proxy environments (dev, staging), x-forwarded-for is spoofable —
  // fall back to x-real-ip only. In production behind Vercel/ALB, trust the header.
  if (process.env.NODE_ENV !== "production") {
    return request.headers.get("x-real-ip")?.trim() ?? "unknown"
  }
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip")?.trim() ??
    "unknown"
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

// ── Auth.js session bridge (ADR-011) ───────────────────────────────────────

function authJsSessionCookieName(request: Request): string {
  return isSecure(request)
    ? "__Secure-authjs.session-token"
    : "authjs.session-token"
}

export function buildSessionExpireCookie(request: Request): string {
  const name = authJsSessionCookieName(request)
  const secure = name.startsWith("__Secure-")
  return `${name}=; Path=/; HttpOnly; SameSite=Lax${secure ? "; Secure" : ""}; Max-Age=0`
}

export interface MintAuthJsSessionInput {
  userId: string
  accessToken: string
  refreshToken: string
}

export async function mintAuthJsSessionCookie(
  request: Request,
  input: MintAuthJsSessionInput,
): Promise<string> {
  const authSecret = process.env.AUTH_SECRET
  if (!authSecret) {
    logger.error(
      "[auth:session] AUTH_SECRET ausente — impossivel cunhar sessao Auth.js",
    )
    throw new Error(
      "AUTH_SECRET environment variable is required for session token issuance",
    )
  }
  const { encode } = await import("next-auth/jwt")
  const useSecure = isSecure(request)
  const sessionCookieName = authJsSessionCookieName(request)
  const sessionToken = await encode({
    token: {
      sub: input.userId,
      userId: input.userId,
      customAuth: {
        accessToken: input.accessToken,
        refreshToken: input.refreshToken,
        emittedAt: Date.now(),
      },
    },
    secret: authSecret,
    salt: sessionCookieName,
    maxAge: REFRESH_COOKIE_MAX_AGE,
  })
  return `${sessionCookieName}=${sessionToken}; Path=/; HttpOnly; SameSite=Lax${useSecure ? "; Secure" : ""}; Max-Age=${REFRESH_COOKIE_MAX_AGE}`
}
