import { logger } from "@/lib/logger"

const WINDOW_MS = Number(process.env.RATE_LIMIT_WINDOW_MS ?? 15 * 60 * 1000)
const MAX_CONSECUTIVE_FAILURES = Number(
  process.env.MAX_CONSECUTIVE_FAILURES ?? 5,
)
const MAX_IP_ATTEMPTS = Number(process.env.MAX_IP_ATTEMPTS ?? 5)
const MAGIC_LINK_WINDOW_MS = 60 * 60 * 1000

const MAX_MAGIC_LINK_PER_EMAIL = (() => {
  const raw = process.env.MAX_MAGIC_LINK_PER_EMAIL
  if (raw === undefined) return 3
  const value = Number(raw)
  if (!Number.isFinite(value) || value < 1) {
    throw new Error(`Invalid MAX_MAGIC_LINK_PER_EMAIL: ${raw}`)
  }
  return value
})()

const MAX_MAGIC_LINK_IP_ATTEMPTS = (() => {
  const raw = process.env.MAX_MAGIC_LINK_IP_ATTEMPTS
  if (raw === undefined) return 20
  const value = Number(raw)
  if (!Number.isFinite(value) || value < 1) {
    throw new Error(`Invalid MAX_MAGIC_LINK_IP_ATTEMPTS: ${raw}`)
  }
  return value
})()

const REGISTER_WINDOW_MS = 15 * 60 * 1000
const MAX_REGISTER_IP_ATTEMPTS = Number(
  process.env.MAX_REGISTER_IP_ATTEMPTS ?? 5,
)
const MAX_REGISTER_PER_EMAIL = Number(process.env.MAX_REGISTER_PER_EMAIL ?? 3)

const PASSWORD_RESET_WINDOW_MS = 60 * 60 * 1000

const MAX_PASSWORD_RESET_PER_EMAIL = (() => {
  const raw = process.env.MAX_PASSWORD_RESET_PER_EMAIL
  if (raw === undefined) return 3
  const value = Number(raw)
  if (!Number.isFinite(value) || value < 1) {
    throw new Error(`Invalid MAX_PASSWORD_RESET_PER_EMAIL: ${raw}`)
  }
  return value
})()

interface Entry {
  count: number
  resetAt: number
}

const store = new Map<string, Entry>()

function prune(
  key: string,
  now: number,
  _windowMs?: number,
): Entry | undefined {
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
  const entry = prune(key, now, REGISTER_WINDOW_MS)
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
    REGISTER_WINDOW_MS,
  )
}

export function isRegisterIpLimited(ip: string): RateCheck {
  const now = Date.now()
  const key = `register:ip:${ip}`
  const entry = prune(key, now, REGISTER_WINDOW_MS)
  if (entry && entry.count >= MAX_REGISTER_IP_ATTEMPTS) {
    const retryAfter = Math.max(1, Math.ceil((entry.resetAt - now) / 1000))
    return { allowed: false, retryAfter }
  }
  return { allowed: true, retryAfter: 0 }
}

export function recordRegisterIpAttempt(ip: string): void {
  record(`register:ip:${ip}`, Date.now(), REGISTER_WINDOW_MS)
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

export function logSecurityEvent(message: string): void {
  logger.warn(`[auth:login] ${message}`)
}
