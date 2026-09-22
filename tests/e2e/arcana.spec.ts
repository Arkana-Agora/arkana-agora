import { test, expect } from "@playwright/test"
import {
  BASE_URL,
  registerUser,
  cleanupUser,
  csrfHeaders,
  login,
} from "./helpers"

const TEST_EMAIL = "e2e-arcana@test.com"
const TEST_NAME = "E2E Arcana Test"
let AUTH_TOKEN = ""

test.describe("Meu Arcano: cálculo → detalhe → interpretação", () => {
  test.beforeAll(async ({ request }) => {
    await registerUser(request, TEST_EMAIL, TEST_NAME)
    const loginRes = await login(request, TEST_EMAIL, "Test@12345678")
    const loginBody = await loginRes.json()
    AUTH_TOKEN = loginBody.accessToken
  })

  test.afterAll(async () => {
    await cleanupUser(TEST_EMAIL)
  })

  test("CA-ARC-001: GET /api/v1/arcana/calculate returns personal arcana", async ({
    request,
  }) => {
    const response = await request.get(`${BASE_URL}/api/v1/arcana/calculate`, {
      headers: { Authorization: `Bearer ${AUTH_TOKEN}` },
    })

    expect(response.status()).toBe(200)
    const body = await response.json()
    expect(body.arcana).toBeGreaterThanOrEqual(0)
    expect(body.arcana).toBeLessThanOrEqual(21)
    expect(body.arcanaData).toBeDefined()
    expect(body.arcanaData.name).toBeDefined()
    expect(body.name).toBe(TEST_NAME)
  })

  test("CA-ARC-002: GET /api/v1/arcana/calculate returns 401 without token", async ({
    request,
  }) => {
    const response = await request.get(`${BASE_URL}/api/v1/arcana/calculate`)
    expect(response.status()).toBe(401)
  })

  test("CA-ARC-003: POST /api/v1/ai/arcana-interpret validates body", async ({
    request,
  }) => {
    const response = await request.post(
      `${BASE_URL}/api/v1/ai/arcana-interpret`,
      {
        ...csrfHeaders(),
        headers: {
          ...csrfHeaders().headers,
          Authorization: `Bearer ${AUTH_TOKEN}`,
        },
        data: {},
      },
    )
    expect(response.status()).toBe(422)
  })

  test("CA-ARC-004: POST /api/v1/ai/arcana-interpret returns 401 without token", async ({
    request,
  }) => {
    const response = await request.post(
      `${BASE_URL}/api/v1/ai/arcana-interpret`,
      {
        ...csrfHeaders(),
        data: { arcanaNumber: 5, mode: "general" },
      },
    )
    expect(response.status()).toBe(401)
  })

  test("CA-ARC-005: full arcana flow — calculate → interpret", async ({
    request,
  }) => {
    // Step 1: Calculate personal arcana
    const calcRes = await request.get(`${BASE_URL}/api/v1/arcana/calculate`, {
      headers: { Authorization: `Bearer ${AUTH_TOKEN}` },
    })
    expect(calcRes.status()).toBe(200)
    const calcBody = await calcRes.json()
    expect(calcBody.arcanaData.name).toBeDefined()

    // Step 2: Interpret the arcana (may 503 without AI key — valid)
    const interpretRes = await request.post(
      `${BASE_URL}/api/v1/ai/arcana-interpret`,
      {
        ...csrfHeaders(),
        headers: {
          ...csrfHeaders().headers,
          Authorization: `Bearer ${AUTH_TOKEN}`,
        },
        data: { arcanaNumber: calcBody.arcana, mode: "general" },
      },
    )

    expect([200, 503]).toContain(interpretRes.status())

    if (interpretRes.status() === 200) {
      const bodyText = await interpretRes.text()
      const isSSE = bodyText.includes("data:")
      expect(isSSE).toBe(true)
    }
  })
})
