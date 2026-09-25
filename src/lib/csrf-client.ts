"use client"

import { csrfCookieName, generateCsrfToken } from "@/lib/csrf-cookie-name"

function readCsrfCookie(name: string): string | undefined {
  return document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${name}=`))
    ?.slice(name.length + 1)
}

/**
 * Double-submit CSRF cookie from the browser (Client Component / store).
 * Server Components cannot call cookies().set() on Next.js App Router.
 */
export function ensureCsrfCookie(): string {
  if (typeof window === "undefined") return ""
  const name = csrfCookieName()
  const existing = readCsrfCookie(name)
  if (existing) return existing

  const token = generateCsrfToken()
  const isHttps = window.location.protocol === "https:"
  const secure =
    process.env.NODE_ENV === "production" || isHttps ? "; secure" : ""
  document.cookie = `${name}=${token}; path=/; max-age=${60 * 60 * 24}; samesite=strict${secure}`
  return token
}
