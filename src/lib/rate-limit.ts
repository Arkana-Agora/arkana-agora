/**
 * In-memory rate limiter using Map.
 * WARNING: This implementation is NOT suitable for production deployments
 * in serverless/edge environments (Vercel, AWS Lambda, etc.) where each
 * invocation gets a fresh process and the rate limit state is lost.
 *
 * TODO(T25): Replace with Redis-backed rate limiter (Upstash, Vercel KV, or similar)
 * for production deployments that require cross-instance rate limiting.
 *
 * Current implementation uses in-memory Map with sliding window expiration.
 * Works correctly in single-process development environments only.
 */

function validatedEnvNumber(
  raw: string | undefined,
  fallback: number,
  name: string,
): number {
  if (raw === undefined) return fallback
  const value = Number(raw)
  if (!Number.isFinite(value) || value < 1) {
    throw new Error(`Invalid ${name}: ${raw}`)
  }
  return value
}

const WINDOW_MS = validatedEnvNumber(
  process.env.RATE_LIMIT_WINDOW_MS,
  15 * 60 * 1000,
  "RATE_LIMIT_WINDOW_MS",
)
const MAX_CONSECUTIVE_FAILURES = validatedEnvNumber(
  process.env.MAX_CONSECUTIVE_FAILURES,
  5,
  "MAX_CONSECUTIVE_FAILURES",
)
const MAX_IP_ATTEMPTS = validatedEnvNumber(
  process.env.MAX_IP_ATTEMPTS,
  5,
  "MAX_IP_ATTEMPTS",
)
const MAX_IP_ATTEMPTS_ADMIN = validatedEnvNumber(
  process.env.MAX_IP_ATTEMPTS_ADMIN,
  20,
  "MAX_IP_ATTEMPTS_ADMIN",
)
const MAGIC_LINK_WINDOW_MS = 60 * 60 * 1000

const MAX_MAGIC_LINK_PER_EMAIL = validatedEnvNumber(
  process.env.MAX_MAGIC_LINK_PER_EMAIL,
  3,
  "MAX_MAGIC_LINK_PER_EMAIL",
)

const MAX_MAGIC_LINK_IP_ATTEMPTS = validatedEnvNumber(
  process.env.MAX_MAGIC_LINK_IP_ATTEMPTS,
  3,
  "MAX_MAGIC_LINK_IP_ATTEMPTS",
)

const REGISTER_EMAIL_WINDOW_MS = 15 * 60 * 1000
const REGISTER_IP_WINDOW_MS = 60 * 60 * 1000
const MAX_REGISTER_IP_ATTEMPTS = validatedEnvNumber(
  process.env.MAX_REGISTER_IP_ATTEMPTS,
  3,
  "MAX_REGISTER_IP_ATTEMPTS",
)
const MAX_REGISTER_PER_EMAIL = validatedEnvNumber(
  process.env.MAX_REGISTER_PER_EMAIL,
  3,
  "MAX_REGISTER_PER_EMAIL",
)

const VERIFY_EMAIL_RESEND_WINDOW_MS = 60 * 1000
const MAX_VERIFY_EMAIL_RESEND_PER_EMAIL = validatedEnvNumber(
  process.env.MAX_VERIFY_EMAIL_RESEND_PER_EMAIL,
  1,
  "MAX_VERIFY_EMAIL_RESEND_PER_EMAIL",
)

const PASSWORD_RESET_WINDOW_MS = 60 * 60 * 1000

const MAX_PASSWORD_RESET_PER_EMAIL = validatedEnvNumber(
  process.env.MAX_PASSWORD_RESET_PER_EMAIL,
  3,
  "MAX_PASSWORD_RESET_PER_EMAIL",
)

const MAX_PASSWORD_RESET_IP_ATTEMPTS = validatedEnvNumber(
  process.env.MAX_PASSWORD_RESET_IP_ATTEMPTS,
  5,
  "MAX_PASSWORD_RESET_IP_ATTEMPTS",
)

const VERIFY_EMAIL_RESEND_IP_WINDOW_MS = 60 * 60 * 1000
const MAX_VERIFY_EMAIL_RESEND_IP_ATTEMPTS = validatedEnvNumber(
  process.env.MAX_VERIFY_EMAIL_RESEND_IP_ATTEMPTS,
  5,
  "MAX_VERIFY_EMAIL_RESEND_IP_ATTEMPTS",
)

interface Entry {
  count: number
  resetAt: number
}

const store = new Map<string, Entry>()

const CLEANUP_INTERVAL_MS = 5 * 60 * 1000

if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now()
    for (const [key, entry] of store) {
      if (entry.resetAt <= now) {
        store.delete(key)
      }
    }
  }, CLEANUP_INTERVAL_MS).unref?.()
}

function prune(key: string, now: number): Entry | undefined {
  const entry = store.get(key)
  if (!entry || entry.resetAt <= now) {
    store.delete(key)
    return undefined
  }
  return entry
}

function record(key: string, now: number, windowMs = WINDOW_MS): void {
  const entry = store.get(key)
  if (!entry || entry.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + windowMs })
  } else {
    entry.count += 1
  }
}

export function resetRateLimiter(): void {
  store.clear()
}

export interface RateCheck {
  allowed: boolean
  retryAfter: number
}

export function isAccountLocked(email: string): RateCheck {
  const now = Date.now()
  const key = `login:fail:${email.toLowerCase()}`
  const entry = prune(key, now)
  if (entry && entry.count >= MAX_CONSECUTIVE_FAILURES) {
    const retryAfter = Math.max(1, Math.ceil((entry.resetAt - now) / 1000))
    return { allowed: false, retryAfter }
  }
  return { allowed: true, retryAfter: 0 }
}

export function recordLoginFailure(email: string): void {
  record(`login:fail:${email.toLowerCase()}`, Date.now())
}

export function resetLoginFailures(email: string): void {
  store.delete(`login:fail:${email.toLowerCase()}`)
}

/**
 * Checks IP-based rate limit for login attempts.
 * ADMIN/SUPER_ADMIN roles get a higher limit (20/15min) vs USER/PROFESSIONAL (5/15min).
 *
 * Note: The role parameter must be passed by the caller after user lookup.
 * Pre-auth calls (before user is known) should omit role to use USER limits.
 */
export function isIpLimited(
  ip: string,
  role?: "USER" | "PROFESSIONAL" | "ADMIN" | "SUPER_ADMIN",
): RateCheck {
  const now = Date.now()
  const entry = prune(`login:ip:${ip}`, now)
  const limit =
    role === "ADMIN" || role === "SUPER_ADMIN"
      ? MAX_IP_ATTEMPTS_ADMIN
      : MAX_IP_ATTEMPTS
  if (entry && entry.count >= limit) {
    const retryAfter = Math.max(1, Math.ceil((entry.resetAt - now) / 1000))
    return { allowed: false, retryAfter }
  }
  return { allowed: true, retryAfter: 0 }
}

export function recordIpAttempt(ip: string): void {
  record(`login:ip:${ip}`, Date.now())
}

export function isMagicLinkLimited(email: string): RateCheck {
  const now = Date.now()
  const key = `magic-link:${email.toLowerCase()}`
  const entry = prune(key, now)
  if (entry && entry.count >= MAX_MAGIC_LINK_PER_EMAIL) {
    const retryAfter = Math.max(1, Math.ceil((entry.resetAt - now) / 1000))
    return { allowed: false, retryAfter }
  }
  return { allowed: true, retryAfter: 0 }
}

export function recordMagicLinkRequest(email: string): void {
  record(`magic-link:${email.toLowerCase()}`, Date.now(), MAGIC_LINK_WINDOW_MS)
}

export function isMagicLinkIpLimited(ip: string): RateCheck {
  const now = Date.now()
  const entry = prune(`magic-link:ip:${ip}`, now)
  if (entry && entry.count >= MAX_MAGIC_LINK_IP_ATTEMPTS) {
    const retryAfter = Math.max(1, Math.ceil((entry.resetAt - now) / 1000))
    return { allowed: false, retryAfter }
  }
  return { allowed: true, retryAfter: 0 }
}

export function recordMagicLinkIpAttempt(ip: string): void {
  record(`magic-link:ip:${ip}`, Date.now(), MAGIC_LINK_WINDOW_MS)
}

export function isRegisterLimited(email: string): RateCheck {
  const now = Date.now()
  const key = `register:email:${email.toLowerCase()}`
  const entry = prune(key, now)
  if (entry && entry.count >= MAX_REGISTER_PER_EMAIL) {
    const retryAfter = Math.max(1, Math.ceil((entry.resetAt - now) / 1000))
    return { allowed: false, retryAfter }
  }
  return { allowed: true, retryAfter: 0 }
}

export function recordRegisterAttempt(email: string): void {
  record(
    `register:email:${email.toLowerCase()}`,
    Date.now(),
    REGISTER_EMAIL_WINDOW_MS,
  )
}

export function isRegisterIpLimited(ip: string): RateCheck {
  const now = Date.now()
  const key = `register:ip:${ip}`
  const entry = prune(key, now)
  if (entry && entry.count >= MAX_REGISTER_IP_ATTEMPTS) {
    const retryAfter = Math.max(1, Math.ceil((entry.resetAt - now) / 1000))
    return { allowed: false, retryAfter }
  }
  return { allowed: true, retryAfter: 0 }
}

export function recordRegisterIpAttempt(ip: string): void {
  record(`register:ip:${ip}`, Date.now(), REGISTER_IP_WINDOW_MS)
}

export function isVerifyEmailResendLimited(email: string): RateCheck {
  const now = Date.now()
  const key = `verify-email:resend:${email.toLowerCase()}`
  const entry = prune(key, now)
  if (entry && entry.count >= MAX_VERIFY_EMAIL_RESEND_PER_EMAIL) {
    const retryAfter = Math.max(1, Math.ceil((entry.resetAt - now) / 1000))
    return { allowed: false, retryAfter }
  }
  return { allowed: true, retryAfter: 0 }
}

export function recordVerifyEmailResend(email: string): void {
  record(
    `verify-email:resend:${email.toLowerCase()}`,
    Date.now(),
    VERIFY_EMAIL_RESEND_WINDOW_MS,
  )
}

export function isPasswordResetLimited(email: string): RateCheck {
  const now = Date.now()
  const key = `password-reset:${email.toLowerCase()}`
  const entry = prune(key, now)
  if (entry && entry.count >= MAX_PASSWORD_RESET_PER_EMAIL) {
    const retryAfter = Math.max(1, Math.ceil((entry.resetAt - now) / 1000))
    return { allowed: false, retryAfter }
  }
  return { allowed: true, retryAfter: 0 }
}

export function recordPasswordResetRequest(email: string): void {
  record(
    `password-reset:${email.toLowerCase()}`,
    Date.now(),
    PASSWORD_RESET_WINDOW_MS,
  )
}

export function isPasswordResetIpLimited(ip: string): RateCheck {
  const now = Date.now()
  const entry = prune(`password-reset:ip:${ip}`, now)
  if (entry && entry.count >= MAX_PASSWORD_RESET_IP_ATTEMPTS) {
    const retryAfter = Math.max(1, Math.ceil((entry.resetAt - now) / 1000))
    return { allowed: false, retryAfter }
  }
  return { allowed: true, retryAfter: 0 }
}

export function recordPasswordResetIpAttempt(ip: string): void {
  record(`password-reset:ip:${ip}`, Date.now(), PASSWORD_RESET_WINDOW_MS)
}

export function isVerifyEmailResendIpLimited(ip: string): RateCheck {
  const now = Date.now()
  const entry = prune(`verify-email:resend:ip:${ip}`, now)
  if (entry && entry.count >= MAX_VERIFY_EMAIL_RESEND_IP_ATTEMPTS) {
    const retryAfter = Math.max(1, Math.ceil((entry.resetAt - now) / 1000))
    return { allowed: false, retryAfter }
  }
  return { allowed: true, retryAfter: 0 }
}

export function recordVerifyEmailResendIpAttempt(ip: string): void {
  record(
    `verify-email:resend:ip:${ip}`,
    Date.now(),
    VERIFY_EMAIL_RESEND_IP_WINDOW_MS,
  )
}
