import type { UserPlan } from "@prisma/client"

import { logger } from "@/lib/logger"
import { prisma } from "@/lib/prisma"
import { redis } from "@/lib/redis"

/**
 * Rate limits sociais (T027/S2-10) — única casa dos limites sociais.
 * Sorted set por janela via Lua atômica (review I3: sem corrida check-then-act);
 * janela diária = dia UTC fixo, idêntica ao fallback Prisma (review: rolling 24h
 * vs dia UTC divergiam). Fail-open em Redis down (Q26): daily limits caem no
 * fallback de contagem via Prisma antes de liberar (SC9: posts 10/50, likes
 * 100/min, comments 30/min, follow 20/min, gifts 10/dia; uploads 20/dia —
 * decisão S2-10, sem backing table → bypass logado). Sem Redis configurado:
 * mesmo caminho (Prisma p/ daily, bypass p/ minuto/upload) com
 * `logger.warn("rate_limiter_bypass")`.
 * Semântica attempt-vs-row (arch INFO-3): o Redis conta checks aprovados
 * (attempt) e o fallback Prisma conta linhas persistidas (sucessos) — uma
 * ação que falha após o check aprovado consome cota só no Redis. Divergência
 * aceita; se virar problema, decrementar a cota após a ação bem-sucedida.
 */

const MINUTE = 60_000
const DAY = 24 * 60 * MINUTE

export interface LimitCheck {
  allowed: boolean
  remaining: number
  resetAt: Date
}

export type SocialLimit =
  "post" | "like" | "comment" | "follow" | "gift" | "upload"

const WINDOW_MS: Record<SocialLimit, number> = {
  post: DAY,
  like: MINUTE,
  comment: MINUTE,
  follow: MINUTE,
  gift: DAY,
  upload: DAY,
}

const FIXED_LIMITS: Record<Exclude<SocialLimit, "post">, number> = {
  like: 100,
  comment: 30,
  follow: 20,
  gift: 10,
  upload: 20,
}

export const POST_LIMIT_BY_TIER: Record<UserPlan, number> = {
  FREE: 10,
  PLUS: 50,
}

/** Valor máximo do limite (single-source; headers usam `checkSocialLimit().max`). */
export function getSocialLimitValue(
  limit: SocialLimit,
  tier: UserPlan = "FREE",
): number {
  return limit === "post" ? POST_LIMIT_BY_TIER[tier] : FIXED_LIMITS[limit]
}

export interface SocialLimitResult extends LimitCheck {
  limit: SocialLimit
  max: number
}

function bypass(
  limit: SocialLimit,
  reason: string,
  remaining: number,
): LimitCheck {
  logger.warn({ limit, reason }, "rate_limiter_bypass")
  return {
    allowed: true,
    remaining,
    resetAt: new Date(Date.now() + WINDOW_MS[limit]),
  }
}

function startOfUtcDay(): Date {
  const date = new Date()
  date.setUTCHours(0, 0, 0, 0)
  return date
}

function endOfUtcDay(): Date {
  const date = startOfUtcDay()
  date.setUTCDate(date.getUTCDate() + 1)
  return date
}

// Lua atômica (review I3): prune + count + add + TTL em um único round-trip —
// sem a corrida check-then-act das 4 chamadas separadas (dois requests podiam
// ler count = max-1 ao mesmo tempo e ambos passar).
// KEYS[1]=key | ARGV: [1]=now score, [2]=pruneBefore score, [3]=member,
// [4]=max, [5]=ttlMs
// Retorno: [allowed(0|1), countApósAdd | countAtual, oldestScore | ""]
const RATE_LIMIT_SCRIPT = `
redis.call('ZREMRANGEBYSCORE', KEYS[1], 0, ARGV[2])
local count = redis.call('ZCARD', KEYS[1])
if count >= tonumber(ARGV[4]) then
  local oldest = redis.call('ZRANGE', KEYS[1], 0, 0, 'WITHSCORES')
  redis.call('PEXPIRE', KEYS[1], ARGV[5])
  return {0, count, oldest[2] or ''}
end
redis.call('ZADD', KEYS[1], ARGV[1], ARGV[3])
redis.call('PEXPIRE', KEYS[1], ARGV[5])
return {1, count + 1, ''}
`

async function slidingWindowCheck(
  limit: SocialLimit,
  key: string,
  max: number,
  userId: string,
): Promise<LimitCheck> {
  const windowMs = WINDOW_MS[limit]
  // Janelas diárias = dia UTC fixo (meia-noite→meia-noite), idêntico ao
  // fallback Prisma: mesma janela nas duas casas (review: rolling 24h vs
  // dia UTC divergiam). Minutos continuam sliding window.
  const daily = windowMs === DAY
  const now = Date.now()
  const defaultReset = daily ? endOfUtcDay() : new Date(now + windowMs)
  const pruneBefore = daily ? startOfUtcDay().getTime() : now - windowMs
  const ttlMs = daily
    ? Math.max(endOfUtcDay().getTime() - now + 60_000, 60_000)
    : windowMs

  if (!redis) return dailyFallback(limit, userId, max, "redis_not_configured")

  try {
    const member = `${now}:${Math.random().toString(36).slice(2)}`
    const reply = (await redis.eval(
      RATE_LIMIT_SCRIPT,
      1,
      key,
      String(now),
      String(pruneBefore),
      member,
      String(max),
      String(ttlMs),
    )) as [number, number, string]
    const [allowedFlag, count, oldestScore] = reply

    if (allowedFlag === 1) {
      return {
        allowed: true,
        remaining: Math.max(0, max - count),
        resetAt: defaultReset,
      }
    }

    const resetAt =
      !daily && oldestScore
        ? new Date(Number(oldestScore) + windowMs)
        : defaultReset
    return { allowed: false, remaining: 0, resetAt }
  } catch (error) {
    logger.warn({ err: error, limit, key }, "rate_limiter_redis_error")
    return dailyFallback(limit, userId, max, "redis_error")
  }
}

// Fallback Prisma dos daily limits quando o Redis falha/não está configurado
// (Q26): a contagem persiste no banco e continua válida entre instâncias.
// `reason` propaga o motivo original para o bypass dos limites sem backing
// table (upload) ou de minuto.
async function dailyFallback(
  limit: SocialLimit,
  userId: string,
  max: number,
  reason: string,
): Promise<LimitCheck> {
  if (WINDOW_MS[limit] !== DAY) return bypass(limit, reason, max)

  try {
    const since = startOfUtcDay()
    const where =
      limit === "post"
        ? { authorId: userId, createdAt: { gte: since } }
        : limit === "gift"
          ? { fromUserId: userId, createdAt: { gte: since } }
          : undefined
    // upload/dia não tem tabela de contagem — bypass explícito e logado
    // (decisão S2-10: 20/dia só existe em Redis; documentado em security.md).
    if (!where) return bypass(limit, reason, max)

    const count =
      limit === "post"
        ? await prisma.post.count({ where })
        : await prisma.gift.count({ where })

    return {
      allowed: count < max,
      remaining: Math.max(0, max - count),
      resetAt: endOfUtcDay(),
    }
  } catch (error) {
    logger.warn(
      { err: error, limit, userId },
      "rate_limiter_prisma_fallback_error",
    )
    return bypass(limit, "prisma_fallback_error", max)
  }
}

function key(limit: SocialLimit, userId: string): string {
  return `rl:${limit}:${userId}`
}

// Núcleo único (review simpc I5): o max é calculado UMA vez e volta em
// `check.max` — middleware/rotas não recalculam para os headers.
export async function checkSocialLimit(
  limit: SocialLimit,
  userId: string,
  tier: UserPlan = "FREE",
): Promise<SocialLimitResult> {
  const max = getSocialLimitValue(limit, tier)
  const check = await slidingWindowCheck(limit, key(limit, userId), max, userId)
  return { ...check, limit, max }
}

// Exports nomeados do T027 — wrappers finos sobre o núcleo único.
export function checkPostLimit(
  userId: string,
  tier: UserPlan = "FREE",
): Promise<SocialLimitResult> {
  return checkSocialLimit("post", userId, tier)
}

export function checkLikeLimit(userId: string): Promise<SocialLimitResult> {
  return checkSocialLimit("like", userId)
}

export function checkCommentLimit(userId: string): Promise<SocialLimitResult> {
  return checkSocialLimit("comment", userId)
}

export function checkFollowLimit(userId: string): Promise<SocialLimitResult> {
  return checkSocialLimit("follow", userId)
}

export function checkGiftLimit(userId: string): Promise<SocialLimitResult> {
  return checkSocialLimit("gift", userId)
}

export function checkUploadLimit(userId: string): Promise<SocialLimitResult> {
  return checkSocialLimit("upload", userId)
}
