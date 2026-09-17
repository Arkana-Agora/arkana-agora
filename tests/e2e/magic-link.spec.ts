import { test, expect } from "@playwright/test"
import {
  BASE_URL,
  prisma,
  csrfHeaders,
  getTokenByEmail,
  registerUser,
  cleanupUser,
} from "./helpers"

const TEST_EMAIL = "e2e-magic-link@test.com"
const TEST_NAME = "E2E Magic Link User"

test.describe("Fluxo: magic link", () => {
  test.beforeAll(async ({ request }) => {
    await registerUser(request, TEST_EMAIL, TEST_NAME)
  })

  test.afterAll(async () => {
    await cleanupUser(TEST_EMAIL)
  })

  test("CA-AUTH-006: solicitar magic link para email existente retorna 200", async ({
    request,
  }) => {
    const response = await request.post(`${BASE_URL}/api/v1/auth/magic-link`, {
      ...csrfHeaders(),
      data: { email: TEST_EMAIL },
    })

    expect(response.status()).toBe(200)
    const body = await response.json()
    expect(body.message).toContain("Magic link")
  })

  test("CA-AUTH-007: verificar magic link com token válido retorna 200 e seta cookie", async ({
    request,
  }) => {
    await request.post(`${BASE_URL}/api/v1/auth/magic-link`, {
      ...csrfHeaders(),
      data: { email: TEST_EMAIL },
    })

    const token = await getTokenByEmail(TEST_EMAIL, "MAGIC_LINK")
    const response = await request.post(
      `${BASE_URL}/api/v1/auth/magic-link/verify`,
      { data: { token } },
    )

    expect(response.status()).toBe(200)
    const body = await response.json()
    expect(body).toHaveProperty("accessToken")
    expect(body).toHaveProperty("user")
    expect(body.user.email).toBe(TEST_EMAIL)

    const cookies = response.headers()["set-cookie"] ?? ""
    expect(cookies).toContain("refreshToken=")
    expect(cookies).toContain("HttpOnly")
  })

  test("CA-AUTH-008: magic link com token inválido retorna 401", async ({
    request,
  }) => {
    const response = await request.post(
      `${BASE_URL}/api/v1/auth/magic-link/verify`,
      { data: { token: "invalid-token-123" } },
    )

    expect(response.status()).toBe(401)
    const body = await response.json()
    expect(body.error.code).toBe("AUTH_MAGIC_TOKEN_INVALID")
  })

  test("CA-AUTH-009: magic link com token expirado retorna 410", async ({
    request,
  }) => {
    const vt = await prisma.verificationToken.create({
      data: {
        identifier: TEST_EMAIL,
        token: `expired-e2e-${Date.now()}`,
        type: "MAGIC_LINK",
        expiresAt: new Date(Date.now() - 60_000),
      },
    })

    const response = await request.post(
      `${BASE_URL}/api/v1/auth/magic-link/verify`,
      { data: { token: vt.token } },
    )

    expect(response.status()).toBe(410)
    const body = await response.json()
    expect(body.error.code).toBe("AUTH_MAGIC_TOKEN_EXPIRED")
  })
})
