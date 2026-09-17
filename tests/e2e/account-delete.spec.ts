import { test, expect } from "@playwright/test"
import {
  BASE_URL,
  TEST_PASSWORD,
  registerUser,
  cleanupUser,
  login,
} from "./helpers"

const TEST_EMAIL = "e2e-delete-account@test.com"
const TEST_NAME = "E2E Delete Account User"

test.describe("Fluxo: exclusão de conta (LGPD)", () => {
  test.beforeAll(async ({ request }) => {
    await cleanupUser(TEST_EMAIL)
    await registerUser(request, TEST_EMAIL, TEST_NAME)
  })

  test.afterAll(async () => {
    await cleanupUser(TEST_EMAIL)
  })

  test("CA-AUTH-015: exclusão de conta com token válido retorna 200", async ({
    request,
  }) => {
    const loginResponse = await login(request, TEST_EMAIL, TEST_PASSWORD)

    const loginBody = await loginResponse.json()
    const accessToken = loginBody.accessToken

    const response = await request.delete(`${BASE_URL}/api/v1/auth/account`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      data: { email: TEST_EMAIL },
    })

    expect(response.status()).toBe(200)
    const body = await response.json()
    expect(body.message).toContain("exclusao")
    expect(body.message).toContain("dias")
  })

  test("CA-AUTH-016: login após exclusão de conta retorna 403", async ({
    request,
  }) => {
    const response = await login(request, TEST_EMAIL, TEST_PASSWORD)

    expect(response.status()).toBe(403)
    const body = await response.json()
    expect(body.error.code).toBe("AUTH_ACCOUNT_SUSPENDED")
  })

  test("CA-AUTH-017: exclusão de conta sem token retorna 401", async ({
    request,
  }) => {
    const response = await request.delete(`${BASE_URL}/api/v1/auth/account`)

    expect(response.status()).toBe(401)
    const body = await response.json()
    expect(body.error.code).toBe("AUTH_TOKEN_INVALID")
  })

  test("CA-AUTH-018: exclusão de conta com token inválido retorna 401", async ({
    request,
  }) => {
    const response = await request.delete(`${BASE_URL}/api/v1/auth/account`, {
      headers: { Authorization: "Bearer invalid-token-123" },
    })

    expect(response.status()).toBe(401)
    const body = await response.json()
    expect(body.error.code).toBe("AUTH_TOKEN_INVALID")
  })
})
