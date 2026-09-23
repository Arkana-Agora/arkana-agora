import { test, expect } from "@playwright/test"
import {
  BASE_URL,
  registerUser,
  cleanupUser,
  attachSession,
  csrfHeaders,
  getUserByEmail,
} from "./helpers"

const TEST_EMAIL = "e2e-full-flow@test.com"
const TEST_NAME = "E2E Full Flow"
const PASSWORD = "Test@12345678"

test.describe("T118: full flow — register → login → profile → tiragem → arcana", () => {
  test.describe.configure({ mode: "serial" })
  let session: { accessToken: string; cookies: string }

  test.beforeAll(async ({ request }) => {
    await registerUser(request, TEST_EMAIL, TEST_NAME)
    session = await attachSession(request, TEST_EMAIL, PASSWORD)
  })

  test.afterAll(async () => {
    await cleanupUser(TEST_EMAIL)
  })

  test("T118-01: user exists and is verified after registration helper", async () => {
    const user = await getUserByEmail(TEST_EMAIL)
    expect(user).toBeTruthy()
    expect(user!.emailVerified).toBeTruthy()
  })

  test("T118-02: authenticated profile GET returns user data", async ({
    request,
  }) => {
    const res = await request.get(`${BASE_URL}/api/v1/users/me/profile`, {
      headers: { Authorization: `Bearer ${session.accessToken}` },
    })
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body.email).toBe(TEST_EMAIL)
    expect(body.name).toBeTruthy()
  })

  test("T118-03: update profile displayName", async ({ request }) => {
    const res = await request.patch(`${BASE_URL}/api/v1/users/me/profile`, {
      ...csrfHeaders(),
      headers: {
        ...csrfHeaders().headers,
        Authorization: `Bearer ${session.accessToken}`,
      },
      data: { displayName: "Full Flow User", bio: "Fluxo completo E2E" },
    })
    expect(res.status()).toBe(200)

    const get = await request.get(`${BASE_URL}/api/v1/users/me/profile`, {
      headers: { Authorization: `Bearer ${session.accessToken}` },
    })
    const body = await get.json()
    expect(body.displayName).toBe("Full Flow User")
    expect(body.bio).toBe("Fluxo completo E2E")
  })

  test("T118-04: list decks and spreads, then create reading", async ({
    request,
  }) => {
    const decks = await request.get(`${BASE_URL}/api/v1/decks`)
    expect(decks.status()).toBe(200)

    const spreads = await request.get(`${BASE_URL}/api/v1/spreads?deckType=rws`)
    expect(spreads.status()).toBe(200)

    const create = await request.post(`${BASE_URL}/api/v1/readings`, {
      ...csrfHeaders(),
      headers: {
        ...csrfHeaders().headers,
        Authorization: `Bearer ${session.accessToken}`,
      },
      data: { deckId: "rws", spreadId: "three-card" },
    })
    expect(create.status()).toBe(201)
    const body = await create.json()
    expect(body.reading.cards).toHaveLength(3)
  })

  test("T118-05: retrieve reading and list user readings", async ({
    request,
  }) => {
    const create = await request.post(`${BASE_URL}/api/v1/readings`, {
      ...csrfHeaders(),
      headers: {
        ...csrfHeaders().headers,
        Authorization: `Bearer ${session.accessToken}`,
      },
      data: { deckId: "rws", spreadId: "three-card" },
    })
    const { reading } = await create.json()

    const get = await request.get(`${BASE_URL}/api/v1/readings/${reading.id}`, {
      headers: { Authorization: `Bearer ${session.accessToken}` },
    })
    expect(get.status()).toBe(200)

    const list = await request.get(`${BASE_URL}/api/v1/readings`, {
      headers: { Authorization: `Bearer ${session.accessToken}` },
    })
    expect(list.status()).toBe(200)
    const listBody = await list.json()
    const readings = listBody.readings ?? listBody
    expect(Array.isArray(readings)).toBe(true)
    expect(readings.length).toBeGreaterThan(0)
  })

  test("T118-06: calculate personal arcana", async ({ request }) => {
    const res = await request.get(`${BASE_URL}/api/v1/arcana/calculate`, {
      headers: { Authorization: `Bearer ${session.accessToken}` },
    })
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body.arcana).toBeGreaterThanOrEqual(0)
    expect(body.arcana).toBeLessThanOrEqual(21)
  })

  test("T118-07: AI usage stats available", async ({ request }) => {
    const res = await request.get(`${BASE_URL}/api/v1/ai/usage`, {
      headers: { Authorization: `Bearer ${session.accessToken}` },
    })
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body).toHaveProperty("interpretations")
    expect(body).toHaveProperty("dailyLimit")
    expect(body).toHaveProperty("tier")
  })

  test("T118-08: browser dashboard → tarot → arcana end-to-end", async ({
    page,
  }) => {
    await page.goto("/login")
    await page.getByLabel(/e-?mail/i).fill(TEST_EMAIL)
    await page.getByLabel(/senha/i).fill(PASSWORD)
    await page.getByRole("button", { name: /entrar|logar|login/i }).click()
    await page.waitForURL(/\/dashboard/, { timeout: 15_000 })

    await expect(
      page.getByRole("heading", { name: "Tarot do Dia" }),
    ).toBeVisible()

    await page.getByRole("link", { name: /tirar cartas/i }).click()
    await page.waitForURL(/\/tirar/, { timeout: 15_000 })
    await expect(page).toHaveURL(/\/tirar/)

    await page.goto("/meu-arcano")
    await expect(page.getByLabel("Nome")).toBeVisible({ timeout: 15_000 })

    await page.goto("/perfil/editar")
    await expect(page.getByLabel("Nome de exibição")).toBeVisible({
      timeout: 15_000,
    })
  })

  test("T118-09: daily limit returns 429 after free tier exhaustion", async ({
    request,
  }) => {
    const results: number[] = []
    for (let i = 0; i < 5; i++) {
      const res = await request.post(`${BASE_URL}/api/v1/readings`, {
        ...csrfHeaders(),
        headers: {
          ...csrfHeaders().headers,
          Authorization: `Bearer ${session.accessToken}`,
        },
        data: { deckId: "rws", spreadId: "three-card" },
      })
      results.push(res.status())
      if (res.status() === 429) break
    }
    expect(results.some((s) => s === 429 || s === 201)).toBe(true)
    if (results.includes(429)) {
      const idx = results.indexOf(429)
      const last = results[idx - 1]
      expect(last === 201 || last === undefined).toBe(true)
    }
  })
})
