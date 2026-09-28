import { getEnv } from "@/lib/env"
import { logger } from "@/lib/logger"

export interface ModerationResult {
  allowed: boolean
  flaggedWords: string[]
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

// Evasões comuns: zero-width spaces/joiners, word-joiner e soft-hyphen
// ("g​olpe") — removidos (e NFKC normalizado) antes do match.
const ZERO_WIDTH_RE = /[\u00AD\u200B-\u200D\u2060\uFEFF]/g

function normalizeForMatch(value: string): string {
  return value.normalize("NFKC").replace(ZERO_WIDTH_RE, "")
}

let warnedProductionDisabled = false

interface CompiledBlock {
  word: string
  pattern: RegExp
}

// Compilação única por valor de env (review S-N13/simpc N9): o parse da CSV
// e a construção das regex acontecem uma vez por configuração, não a cada
// chamada — recompila somente se a env mudar.
let cachedRaw: string | null = null
let cachedBlocks: CompiledBlock[] = []

function getBlocks(raw: string): CompiledBlock[] {
  if (cachedRaw !== raw) {
    cachedRaw = raw
    cachedBlocks = raw
      .split(",")
      .map((word) => normalizeForMatch(word.trim()))
      .filter(Boolean)
      .map((word) => ({
        word,
        pattern: new RegExp(
          `(?<![\\p{L}\\p{N}_])${escapeRegExp(word)}(?![\\p{L}\\p{N}_])`,
          "iu",
        ),
      }))
  }
  return cachedBlocks
}

/**
 * Moderação MVP por lista de palavras (T025/SC12 — sem IA).
 * `MODERATION_BLOCKED_WORDS` = CSV (ex.: "spam, golpe"); case-insensitive
 * Unicode (`iu`), fronteira via lookaround `[\p{L}\p{N}_]` — `\b` é ASCII-only
 * e falhava em palavras acentuadas. Conteúdo e palavra passam por NFKC +
 * strip de zero-width antes do match. Sem env → tudo permitido (fail-open
 * documentado); em produção loga `moderation_disabled` uma única vez.
 */
export function checkContent(content: string): ModerationResult {
  const raw = getEnv().MODERATION_BLOCKED_WORDS
  if (!raw) {
    if (process.env.NODE_ENV === "production" && !warnedProductionDisabled) {
      warnedProductionDisabled = true
      logger.warn({ reason: "blocked_words_unset" }, "moderation_disabled")
    }
    return { allowed: true, flaggedWords: [] }
  }

  const normalizedContent = normalizeForMatch(content)

  const flaggedWords = getBlocks(raw)
    .filter(({ pattern }) => pattern.test(normalizedContent))
    .map(({ word }) => word)

  return { allowed: flaggedWords.length === 0, flaggedWords }
}
