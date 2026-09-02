import { logger } from "@/lib/logger"

const WINDOW_MS = Number(process.env.RATE_LIMIT_WINDOW_MS ?? 15 * 60 * 1000)
const MAX_CONSECUTIVE_FAILURES = Number(
  process.env.MAX_CONSECUTIVE_FAILURES ?? 5,
)
const MAX_IP_ATTEMPTS = Number(process.env.MAX_IP_ATTEMPTS ?? 5)

interface Entry {
  count: number
  resetAt: number
}

const store = new Map<string, Entry>()

function prune(key: string, now: number): Entry | undefined {
  const entry = store.get(key)
  if (!entry || entry.resetAt <= now) {
    store.delete(key)
    return undefined
  }
  return entry
}

function record(key: string, now: number): void {
  const entry = store.get(key)
  if (!entry || entry.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + WINDOW_MS })
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

export function isIpLimited(ip: string): RateCheck {
  const now = Date.now()
  const entry = prune(`login:ip:${ip}`, now)
  if (entry && entry.count >= MAX_IP_ATTEMPTS) {
    const retryAfter = Math.max(1, Math.ceil((entry.resetAt - now) / 1000))
    return { allowed: false, retryAfter }
  }
  return { allowed: true, retryAfter: 0 }
}

export function recordIpAttempt(ip: string): void {
  record(`login:ip:${ip}`, Date.now())
}

export function logSecurityEvent(message: string): void {
  logger.warn(`[auth:login] ${message}`)
}
