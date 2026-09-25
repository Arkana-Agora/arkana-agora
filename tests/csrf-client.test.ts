import { beforeEach, describe, expect, it } from "vitest"

import { validateCsrfToken } from "@/lib/csrf"
import { ensureCsrfCookie } from "@/lib/csrf-client"

function readCookie(name: string): string | undefined {
  return document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${name}=`))
    ?.slice(name.length + 1)
}

describe("ensureCsrfCookie", () => {
  beforeEach(() => {
    for (const row of document.cookie.split("; ")) {
      const name = row.split("=")[0]
      if (name) {
        document.cookie = `${name}=; path=/; max-age=0`
      }
    }
  })

  it("sets csrf-token cookie when missing (non-production)", () => {
    const token = ensureCsrfCookie()
    expect(token).toMatch(/^[0-9a-f]{64}$/)
    expect(readCookie("csrf-token")).toBe(token)
  })

  it("reuses existing cookie value", () => {
    document.cookie = "csrf-token=existing-token-value; path=/"
    const token = ensureCsrfCookie()
    expect(token).toBe("existing-token-value")
  })

  it("returns empty string outside the browser", () => {
    const originalWindow = globalThis.window
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: undefined,
    })
    try {
      expect(ensureCsrfCookie()).toBe("")
    } finally {
      Object.defineProperty(globalThis, "window", {
        configurable: true,
        value: originalWindow,
      })
    }
  })

  it("generates distinct tokens when cookie is cleared", () => {
    const first = ensureCsrfCookie()
    document.cookie = "csrf-token=; path=/; max-age=0"
    const second = ensureCsrfCookie()
    expect(second).not.toBe(first)
    expect(readCookie("csrf-token")).toBe(second)
  })

  it("matches server double-submit name for development NODE_ENV", () => {
    expect(process.env.NODE_ENV).not.toBe("production")
    ensureCsrfCookie()
    expect(readCookie("csrf-token")).toBeDefined()
  })

  it("round-trips with server validateCsrfToken (double-submit)", () => {
    const token = ensureCsrfCookie()
    const req = new Request("http://localhost/api/v1/auth/login", {
      method: "POST",
      headers: {
        cookie: `csrf-token=${token}`,
        "x-csrf-token": token,
      },
    })
    expect(validateCsrfToken(req)).toBe(true)
  })
})
