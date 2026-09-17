import { expect } from "vitest"

export function expectSecureRefreshCookie(
  headers: Headers,
  expectedToken: string,
) {
  const setCookie = headers.get("set-cookie") ?? ""
  expect(setCookie).toContain("refreshToken=")
  expect(setCookie).toContain(expectedToken)
  expect(setCookie).toContain("HttpOnly")
  expect(setCookie).toContain("SameSite=Lax")
  expect(setCookie).toContain("Path=/api/v1/auth/refresh")
}

export function expectRefreshCookieCleared(headers: Headers) {
  const setCookie = headers.get("set-cookie") ?? ""
  expect(setCookie).toContain("refreshToken=")
  expect(setCookie).toContain("Max-Age=0")
}
