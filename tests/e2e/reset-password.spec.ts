import { test, expect } from "@playwright/test"
import {
  BASE_URL,
  csrfHeaders,
  getTokenByEmail,
  registerUser,
  cleanupUser,
} from "./helpers"

const TEST_EMAIL = "e2e-reset-password@test.com"
const NEW_PASSWORD = "NewTest@12345678"
const TEST_NAME = "E2E Reset Password User"

test.describe("Fluxo: forgot password → reset password", () => {
  test.beforeAll(async ({ request }) => {
    await registerUser(request, TEST_EMAIL, TEST_NAME)
  })

  test.afterAll(async () => {
    await cleanupUser(TEST_EMAIL)
  })

  test("CA-AUTH-010: solicitar redefinição de senha retorna 200", async ({
    request,
  }) => {
    const response = await request.post(
      `${BASE_URL}/api/v1/auth/forgot-password`,
      {
        ...csrfHeaders(),
        data: { email: TEST_EMAIL },
      },
    )

    expect(response.status()).toBe(200)
    const body = await response.json()
    expect(body.message).toContain("redefinir")
  })

  test("CA-AUTH-011: redefinir senha com token válido retorna 200", async ({
    request,
  }) => {
    await request.post(`${BASE_URL}/api/v1/auth/forgot-password`, {
      ...csrfHeaders(),
      data: { email: TEST_EMAIL },
    })

    const token = await getTokenByEmail(TEST_EMAIL, "PASSWORD_RESET")
    const response = await request.post(
      `${BASE_URL}/api/v1/auth/reset-password`,
      {
        data: {
          token,
          password: NEW_PASSWORD,
          passwordConfirmation: NEW_PASSWORD,
        },
      },
    )

    expect(response.status()).toBe(200)
    const body = await response.json()
    expect(body.message).toContain("sucesso")
  })

  test("CA-AUTH-012: login com nova senha retorna 200", async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/v1/auth/login`, {
      ...csrfHeaders(),
      data: { email: TEST_EMAIL, password: NEW_PASSWORD },
    })

    expect(response.status()).toBe(200)
    const body = await response.json()
    expect(body).toHaveProperty("accessToken")
    expect(body.user.email).toBe(TEST_EMAIL)
  })

  test("CA-AUTH-013: redefinir senha com token inválido retorna 401", async ({
    request,
  }) => {
    const response = await request.post(
      `${BASE_URL}/api/v1/auth/reset-password`,
      {
        data: {
          token: "invalid-token-123",
          password: NEW_PASSWORD,
          passwordConfirmation: NEW_PASSWORD,
        },
      },
    )

    expect(response.status()).toBe(401)
    const body = await response.json()
    expect(body.error.code).toBe("AUTH_RESET_TOKEN_INVALID")
  })

  test("CA-AUTH-014: redefinir senha com senhas diferentes retorna 422", async ({
    request,
  }) => {
    const response = await request.post(
      `${BASE_URL}/api/v1/auth/reset-password`,
      {
        data: {
          token: "some-token",
          password: NEW_PASSWORD,
          passwordConfirmation: "DifferentPassword123!",
        },
      },
    )

    expect(response.status()).toBe(422)
    const body = await response.json()
    expect(body.error.code).toBe("VALIDATION_ERROR")
  })
})
