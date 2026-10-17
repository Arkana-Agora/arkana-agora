function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// Códigos de billing/quota da OpenAI: não são transitórios — retry só
// prolonga a falha (ex.: credit_balance_exhausted levava 21s em retries).
const NON_RETRYABLE_CODES = new Set([
  "credit_balance_exhausted",
  "insufficient_quota",
])

function extractErrorCode(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null) return undefined
  const e = error as Record<string, unknown>
  if (typeof e.code === "string") return e.code
  const nested = e.error
  if (typeof nested === "object" && nested !== null) {
    const nestedCode = (nested as Record<string, unknown>).code
    if (typeof nestedCode === "string") return nestedCode
  }
  return undefined
}

function isRetryable(error: unknown): boolean {
  if (error instanceof TypeError) return false
  const code = extractErrorCode(error)
  if (code && NON_RETRYABLE_CODES.has(code)) return false
  if (
    typeof error === "object" &&
    error !== null &&
    "retryable" in error &&
    typeof (error as { retryable: unknown }).retryable === "boolean"
  ) {
    return (error as { retryable: boolean }).retryable
  }
  if (error instanceof Error) {
    const name = error.name.toLowerCase()
    if (name === "typeerror") return false
  }
  return true
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelayMs: number = 1000,
): Promise<T> {
  let lastError: unknown

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error

      if (!isRetryable(error)) {
        throw error
      }

      if (attempt < maxRetries) {
        const delay = baseDelayMs * Math.pow(2, attempt)
        await sleep(delay)
      }
    }
  }

  throw lastError
}
