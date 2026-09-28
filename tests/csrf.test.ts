import { describe, expect, it } from "vitest"

import {
  csrfErrorResponse,
  getCsrfTokenFromCookie,
  validateCsrfToken,
} from "@/lib/csrf"
import { csrfCookieName, generateCsrfToken } from "@/lib/csrf-cookie-name"

function makeRequest(headers: Record<string, string>): Request {
  return new Request("http://localhost/api/v1/social/posts", {
    method: "POST",
    headers,
  })
}

describe("validateCsrfToken (T028)", () => {
  it("aceita cookie e header iguais", () => {
    const token = generateCsrfToken()
    const request = makeRequest({
      cookie: `csrf-token=${token}`,
      "x-csrf-token": token,
    })
    expect(validateCsrfToken(request)).toBe(true)
  })

  it("rejeita cookie e header diferentes", () => {
    const request = makeRequest({
      cookie: `csrf-token=${generateCsrfToken()}`,
      "x-csrf-token": generateCsrfToken(),
    })
    expect(validateCsrfToken(request)).toBe(false)
  })

  it("rejeita ausência de cookie ou header", () => {
    expect(validateCsrfToken(makeRequest({ "x-csrf-token": "abc" }))).toBe(
      false,
    )
    expect(validateCsrfToken(makeRequest({ cookie: "csrf-token=abc" }))).toBe(
      false,
    )
  })

  it("getCsrfTokenFromCookie extrai o token mesmo com outros cookies", () => {
    const token = generateCsrfToken()
    const request = makeRequest({
      cookie: `session=xyz; ${csrfCookieName()}=${token}; other=1`,
    })
    expect(getCsrfTokenFromCookie(request)).toBe(token)
  })

  it("tolera cookie header sem espaço após ';' e com espaços extras", () => {
    const token = generateCsrfToken()
    const request = makeRequest({
      cookie: `session=xyz;${csrfCookieName()}= ${token} `,
    })
    expect(getCsrfTokenFromCookie(request)).toBe(token)
  })
})

describe("csrfErrorResponse (T028/T041)", () => {
  it("retorna 403 com code canônico CSRF_TOKEN_INVALID e requestId", async () => {
    const response = csrfErrorResponse("req-42")
    expect(response.status).toBe(403)
    const body = await response.json()
    expect(body).toEqual({
      error: {
        code: "CSRF_TOKEN_INVALID",
        message: "Token CSRF inválido ou ausente",
      },
      meta: { requestId: "req-42" },
    })
  })
})
