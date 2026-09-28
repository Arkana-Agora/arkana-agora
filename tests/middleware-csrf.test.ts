import { beforeEach, describe, expect, it, vi } from "vitest"

const loggerWarn = vi.hoisted(() => vi.fn())

vi.mock("@/lib/logger", () => ({
  logger: { warn: loggerWarn, info: vi.fn(), error: vi.fn() },
}))

import { enforceCsrf, needsCsrf } from "@/lib/middleware/csrf"
import { generateCsrfToken } from "@/lib/csrf-cookie-name"

function request(
  method: string,
  headers: Record<string, string> = {},
): Request {
  return new Request("http://localhost/api/v1/social/posts", {
    method,
    headers,
  })
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe("needsCsrf (T041)", () => {
  it("métodos inseguros exigem CSRF; seguros não", () => {
    expect(needsCsrf("POST")).toBe(true)
    expect(needsCsrf("PATCH")).toBe(true)
    expect(needsCsrf("PUT")).toBe(true)
    expect(needsCsrf("DELETE")).toBe(true)
    expect(needsCsrf("post")).toBe(true) // case-insensitive
    expect(needsCsrf("GET")).toBe(false)
    expect(needsCsrf("HEAD")).toBe(false)
    expect(needsCsrf("OPTIONS")).toBe(false)
  })
})

describe("enforceCsrf (T041)", () => {
  it("GET passa sem validar nada", () => {
    expect(enforceCsrf(request("GET"), "req-1")).toBeNull()
    expect(loggerWarn).not.toHaveBeenCalled()
  })

  it("POST sem cookie/header → 403 CSRF_TOKEN_INVALID com log", async () => {
    const response = enforceCsrf(request("POST"), "req-2")

    expect(response).not.toBeNull()
    expect(response!.status).toBe(403)
    const body = await response!.json()
    expect(body.error.code).toBe("CSRF_TOKEN_INVALID")
    expect(body.meta.requestId).toBe("req-2")
    expect(loggerWarn).toHaveBeenCalledWith(
      expect.objectContaining({ reqId: "req-2", reason: "token_mismatch" }),
      "csrf_failure",
    )
  })

  it("POST com Origin cross-site → 403 mesmo com token válido (defesa em profundidade)", async () => {
    const token = generateCsrfToken()
    const response = enforceCsrf(
      request("POST", {
        origin: "https://evil.example",
        cookie: `csrf-token=${token}`,
        "x-csrf-token": token,
      }),
      "req-5",
    )

    expect(response!.status).toBe(403)
    const body = await response!.json()
    expect(body.error.code).toBe("CSRF_TOKEN_INVALID")
    expect(loggerWarn).toHaveBeenCalledWith(
      expect.objectContaining({ reason: "origin_mismatch" }),
      "csrf_failure",
    )
  })

  it("POST com Origin same-origin + token válido → OK", () => {
    const token = generateCsrfToken()
    const response = enforceCsrf(
      request("POST", {
        origin: "http://localhost",
        cookie: `csrf-token=${token}`,
        "x-csrf-token": token,
      }),
      "req-6",
    )

    expect(response).toBeNull()
  })

  it("POST com cookie ≠ header → 403", async () => {
    const response = enforceCsrf(
      request("POST", {
        cookie: `csrf-token=${generateCsrfToken()}`,
        "x-csrf-token": generateCsrfToken(),
      }),
      "req-3",
    )

    expect(response!.status).toBe(403)
  })

  it("POST com cookie = header → OK", () => {
    const token = generateCsrfToken()
    const response = enforceCsrf(
      request("PATCH", {
        cookie: `csrf-token=${token}`,
        "x-csrf-token": token,
      }),
      "req-4",
    )

    expect(response).toBeNull()
    expect(loggerWarn).not.toHaveBeenCalled()
  })
})
