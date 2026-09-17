import { test, expect } from "@playwright/test"
import {
  BASE_URL,
  TEST_PASSWORD,
  csrfHeaders,
  registerUser,
  cleanupUser,
  login,
} from "./helpers"

const TEST_EMAIL = "e2e-flow-test@test.com"
const TEST_NAME = "E2E Flow Test User"

test.describe("Fluxo completo: cadastro → verificação → login → logout", () => {
  test.beforeAll(async ({ request }) => {
    await registerUser(request, TEST_EMAIL, TEST_NAME)
  })

  test.afterAll(async () => {
    await cleanupUser(TEST_EMAIL)
  })

  test("CA-AUTH-001: cadastro com credenciais válidas retorna 201", async ({
    request,
  }) => {
    const response = await request.post(`${BASE_URL}/api/v1/auth/register`, {
      ...csrfHeaders(),
      data: {
        name: TEST_NAME,
        email: `e2e-register-${Date.now()}@test.com`,
        password: TEST_PASSWORD,
        passwordConfirmation: TEST_PASSWORD,
        acceptTerms: true,
      },
    })

    expect(response.status()).toBe(201)
    const body = await response.json()
    expect(body.message).toContain("verificacao")
  })

  test("CA-AUTH-002: login com credenciais válidas retorna accessToken e seta cookie refreshToken", async ({
    request,
  }) => {
    const response = await login(request, TEST_EMAIL, TEST_PASSWORD)

    expect(response.status()).toBe(200)
    const body = await response.json()
    expect(body).toHaveProperty("accessToken")
    expect(body).toHaveProperty("user")
    expect(body.user.email).toBe(TEST_EMAIL)

    const cookies = response.headers()["set-cookie"] ?? ""
    expect(cookies).toContain("refreshToken=")
    expect(cookies).toContain("HttpOnly")
    expect(cookies).toContain("SameSite=Strict")
  })

  test("CA-AUTH-003: token de acesso é válido e contém dados do usuário", async ({
    request,
  }) => {
    const loginResponse = await login(request, TEST_EMAIL, TEST_PASSWORD)

    expect(loginResponse.status()).toBe(200)
    const loginBody = await loginResponse.json()
    expect(loginBody).toHaveProperty("accessToken")
    expect(loginBody.user).toHaveProperty("email", TEST_EMAIL)
    expect(loginBody.user).toHaveProperty("role", "USER")
    expect(loginBody.user).toHaveProperty("plan", "FREE")
  })

  test("CA-AUTH-004: logout invalida refresh token e limpa cookie", async ({
    request,
  }) => {
    const loginResponse = await login(request, TEST_EMAIL, TEST_PASSWORD)

    const loginBody = await loginResponse.json()
    const accessToken = loginBody.accessToken

    const cookies = loginResponse.headers()["set-cookie"] ?? ""
    const refreshTokenMatch = cookies.match(/refreshToken=([^;]+)/)
    expect(refreshTokenMatch).toBeTruthy()
    const refreshToken = refreshTokenMatch?.[1] ?? ""

    const logoutResponse = await request.post(
      `${BASE_URL}/api/v1/auth/logout`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Cookie: `refreshToken=${refreshToken}`,
        },
      },
    )

    expect(logoutResponse.status()).toBe(200)
    const logoutBody = await logoutResponse.json()
    expect(logoutBody.message).toContain("Sessao")

    const refreshResponse = await request.post(
      `${BASE_URL}/api/v1/auth/refresh`,
      {
        headers: {
          Cookie: `refreshToken=${refreshToken}`,
        },
      },
    )

    expect(refreshResponse.status()).toBe(401)
  })

  test("CA-AUTH-005: tentativa de login com senha incorreta retorna 401", async ({
    request,
  }) => {
    const response = await login(request, TEST_EMAIL, "WrongPassword123!")

    expect(response.status()).toBe(401)
    const body = await response.json()
    expect(body.error.code).toBe("AUTH_INVALID_CREDENTIALS")
  })
})
