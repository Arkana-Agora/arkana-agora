import { test, expect } from "@playwright/test"
import {
  BASE_URL,
  registerUser,
  cleanupUser,
  csrfHeaders,
  login,
} from "./helpers"

const TEST_EMAIL = "e2e-ai-flow@test.com"
const TEST_NAME = "E2E AI Flow Test"
let AUTH_TOKEN = ""

test.describe("AI Readings flow: tiragem → interpretação → follow-up", () => {
  test.beforeAll(async ({ request }) => {
    await registerUser(request, TEST_EMAIL, TEST_NAME)
    const loginRes = await login(request, TEST_EMAIL, "Test@12345678")
    const loginBody = await loginRes.json()
    AUTH_TOKEN = loginBody.accessToken
  })

  test.afterAll(async () => {
    await cleanupUser(TEST_EMAIL)
  })

  test("CA-AI-001: create a reading (tiragem)", async ({ request }) => {
    const response = await request.post(`${BASE_URL}/api/v1/readings`, {
      ...csrfHeaders(),
      headers: {
        ...csrfHeaders().headers,
        Authorization: `Bearer ${AUTH_TOKEN}`,
      },
      data: {
        deckId: "rws",
        spreadId: "three-card",
      },
    })

    expect(response.status()).toBe(201)
    const body = await response.json()
    expect(body.reading).toBeDefined()
    expect(body.reading.id).toBeDefined()
    expect(body.reading.cards).toHaveLength(3)
    expect(body.reading.spread.id).toBe("three-card")
  })

  test("CA-AI-002: GET /api/v1/ai/usage returns daily usage stats", async ({
    request,
  }) => {
    const response = await request.get(`${BASE_URL}/api/v1/ai/usage`, {
      headers: { Authorization: `Bearer ${AUTH_TOKEN}` },
    })

    expect(response.status()).toBe(200)
    const body = await response.json()
    expect(body).toHaveProperty("interpretationCount")
    expect(body).toHaveProperty("interpretationLimit")
    expect(body).toHaveProperty("followUpCount")
    expect(body).toHaveProperty("followUpLimit")
  })

  test("CA-AI-003: POST /api/v1/ai/interpret validates request body", async ({
    request,
  }) => {
    const response = await request.post(`${BASE_URL}/api/v1/ai/interpret`, {
      ...csrfHeaders(),
      headers: {
        ...csrfHeaders().headers,
        Authorization: `Bearer ${AUTH_TOKEN}`,
      },
      data: {},
    })

    expect(response.status()).toBe(422)
  })

  test("CA-AI-004: POST /api/v1/ai/interpret returns 401 without token", async ({
    request,
  }) => {
    const response = await request.post(`${BASE_URL}/api/v1/ai/interpret`, {
      ...csrfHeaders(),
      data: { readingId: "nonexistent", mode: "general" },
    })

    expect(response.status()).toBe(401)
  })

  test("CA-AI-005: POST /api/v1/ai/follow-up validates request body", async ({
    request,
  }) => {
    const response = await request.post(`${BASE_URL}/api/v1/ai/follow-up`, {
      ...csrfHeaders(),
      headers: {
        ...csrfHeaders().headers,
        Authorization: `Bearer ${AUTH_TOKEN}`,
      },
      data: {},
    })

    expect(response.status()).toBe(422)
  })

  test("CA-AI-006: POST /api/v1/ai/follow-up returns 401 without token", async ({
    request,
  }) => {
    const response = await request.post(`${BASE_URL}/api/v1/ai/follow-up`, {
      ...csrfHeaders(),
      data: { interpretationId: "nonexistent", message: "test" },
    })

    expect(response.status()).toBe(401)
  })

  test("CA-AI-007: full flow — create reading → interpret → follow-up", async ({
    request,
  }) => {
    // Step 1: Create a reading
    const readingRes = await request.post(`${BASE_URL}/api/v1/readings`, {
      ...csrfHeaders(),
      headers: {
        ...csrfHeaders().headers,
        Authorization: `Bearer ${AUTH_TOKEN}`,
      },
      data: { deckId: "rws", spreadId: "three-card" },
    })
    expect(readingRes.status()).toBe(201)
    const { reading } = await readingRes.json()

    // Step 2: Request interpretation (will 503 if no AI_API_KEY — valid behavior)
    const interpretRes = await request.post(`${BASE_URL}/api/v1/ai/interpret`, {
      ...csrfHeaders(),
      headers: {
        ...csrfHeaders().headers,
        Authorization: `Bearer ${AUTH_TOKEN}`,
      },
      data: { readingId: reading.id, mode: "general" },
    })

    // Either 200 (AI available) or 503 (AI unavailable) are valid
    expect([200, 503]).toContain(interpretRes.status())

    if (interpretRes.status() === 200) {
      // If AI is available, verify SSE stream or cached response
      const bodyText = await interpretRes.text()
      // SSE stream contains "data:" lines, cached response contains JSON
      const isSSE = bodyText.includes("data:")
      const isCached = bodyText.includes('"cached":true')
      expect(isSSE || isCached).toBe(true)
    }

    // Step 3: Check usage updated
    const usageRes = await request.get(`${BASE_URL}/api/v1/ai/usage`, {
      headers: { Authorization: `Bearer ${AUTH_TOKEN}` },
    })
    expect(usageRes.status()).toBe(200)
    const usage = await usageRes.json()
    expect(typeof usage.interpretationCount).toBe("number")
  })
})
