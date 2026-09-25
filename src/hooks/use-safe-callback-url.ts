"use client"

import { useSearchParams } from "next/navigation"
import { useEffect } from "react"

const SAME_ORIGIN_BASE = "https://same-origin.invalid"

/**
 * Validates a post-login redirect target: same-origin absolute path only.
 *
 * Resolution is WHATWG-based and runs on the percent-DECODED input, so every
 * authority-injection form is rejected regardless of sink semantics:
 * "//evil.com", "/\evil.com", "/<CR|LF|TAB>/evil.com" and "/%0a/evil.com"
 * (which a downstream decode-then-reparse would turn into "/\n/evil.com")
 * all resolve to a foreign origin, while genuine paths like "/tiragem?x=1"
 * resolve to the base. A leading "/" is also required so relative strings
 * ("dashboard") and scheme URLs ("javascript:...") never pass.
 */
export function isSafeCallbackPath(
  raw: string | null | undefined,
): raw is string {
  if (!raw || !raw.startsWith("/")) return false
  let decoded: string
  try {
    decoded = decodeURIComponent(raw)
  } catch {
    return false
  }
  try {
    return new URL(decoded, SAME_ORIGIN_BASE).origin === SAME_ORIGIN_BASE
  } catch {
    return false
  }
}

/**
 * Reads ?callbackUrl= and exposes a validated same-origin path (or null).
 * Must be used inside a Suspense boundary (Next.js requirement for
 * useSearchParams in client components under App Router).
 */
export function useSafeCallbackUrl(): string | null {
  const searchParams = useSearchParams()
  const raw = searchParams.get("callbackUrl")

  return isSafeCallbackPath(raw) ? raw : null
}

export function AuthSessionBridge() {
  const callbackUrl = useSafeCallbackUrl()
  useEffect(() => {
    if (callbackUrl) {
      // Stash for LoginForm/magic-link to read after success.
      sessionStorage.setItem("auth-callback-url", callbackUrl)
    } else {
      // Sem (valido) ?callbackUrl na URL — descarta stash de uma tentativa
      // abandonada para ela nao redirecionar um login posterior.
      sessionStorage.removeItem("auth-callback-url")
    }
  }, [callbackUrl])
  return null
}

export function consumeStoredCallbackUrl(fallback = "/dashboard"): string {
  try {
    const stored = sessionStorage.getItem("auth-callback-url")
    sessionStorage.removeItem("auth-callback-url")
    if (isSafeCallbackPath(stored)) {
      return stored
    }
  } catch {
    // sessionStorage unavailable
  }
  return fallback
}
