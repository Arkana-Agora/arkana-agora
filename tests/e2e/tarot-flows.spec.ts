import { test, expect } from "@playwright/test"
import {
  BASE_URL,
  registerUser,
  cleanupUser,
  attachSession,
  csrfHeaders,
} from "./helpers"

const TEST_EMAIL = "e2e-tarot-flows@test.com"
const TEST_NAME = "E2E Tarot Flows"

test.describe("Tarot flows: home → tirar → reading detail → arcana UI", () => {
  test.describe.configure({ mode: "serial" })
  let session: { accessToken: string; cookies: string }

  test.beforeAll(async ({ request }) => {
    await registerUser(request, TEST_EMAIL, TEST_NAME)
    session = await attachSession(request, TEST_EMAIL)
  })

  test.afterAll(async () => {
    await cleanupUser(TEST_EMAIL)
  })

  test("T065-A: /dashboard is the logged-in home with Tarot do Dia", async ({
    page,
  }) => {
    await page.goto("/login")
    await page.getByLabel(/e-?mail/i).fill(TEST_EMAIL)
    await page.getByLabel(/senha/i).fill("Test@12345678")
    await page.getByRole("button", { name: /entrar|logar|login/i }).click()

    await page.waitForURL(/\/dashboard/, { timeout: 15_000 })
    await expect(page).toHaveURL(/\/dashboard/)
    await expect(
      page.getByRole("heading", { name: "Tarot do Dia" }),
    ).toBeVisible()
    await expect(page.getByRole("link", { name: "Tirar cartas" })).toBeVisible()
    await expect(page.getByRole("link", { name: "Meu perfil" })).toBeVisible()
  })

  test("T065-B: create reading via API and reading session draws cards", async ({
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
    expect(body.reading.cards[0]).toHaveProperty("cardId")
    expect(body.reading.cards[0]).toHaveProperty("positionIndex")
    expect(body.reading.cards[0]).toHaveProperty("isReversed")
  })

  test("T065-C: /tirar renders reading session entry points", async ({
    page,
  }) => {
    await page.goto("/login")
    await page.getByLabel(/e-?mail/i).fill(TEST_EMAIL)
    await page.getByLabel(/senha/i).fill("Test@12345678")
    await page.getByRole("button", { name: /entrar|logar|login/i }).click()
    await page.waitForURL(/\/dashboard/, { timeout: 15_000 })

    await page.goto("/tirar")
    await expect(page).toHaveURL(/\/tirar/)
    await expect(
      page.getByRole("heading", { name: "Escolha o baralho" }),
    ).toBeVisible({ timeout: 15_000 })
  })

  test("T065-D: reading detail loads with AI panel mount point", async ({
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
    expect(create.status()).toBe(201)
    const { reading } = (await create.json()) as {
      reading: { id: string }
    }

    const get = await request.get(`${BASE_URL}/api/v1/readings/${reading.id}`, {
      headers: { Authorization: `Bearer ${session.accessToken}` },
    })
    expect(get.status()).toBe(200)
    const body = (await get.json()) as { reading: { cards: unknown[] } }
    expect(body.reading.cards).toHaveLength(3)
  })

  test("T065-E: OG image endpoint returns PNG for reading", async ({
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
    const { reading } = (await create.json()) as { reading: { id: string } }

    const og = await request.get(
      `${BASE_URL}/api/v1/readings/${reading.id}/og-image`,
      { headers: { Authorization: `Bearer ${session.accessToken}` } },
    )
    expect(og.status()).toBe(200)
    expect(og.headers()["content-type"]).toContain("image/png")
    const buf = await og.body()
    expect(buf.length).toBeGreaterThan(100)
    expect(buf[0]).toBe(0x89)
    expect(buf[1]).toBe(0x50)
    expect(buf[2]).toBe(0x4e)
    expect(buf[3]).toBe(0x47)
  })

  test("T065-F: decks and spreads APIs power the draw UI", async ({
    request,
  }) => {
    const decks = await request.get(`${BASE_URL}/api/v1/decks`)
    const decksBody = (await decks.json()) as { decks?: unknown[] } | unknown[]
    const list = Array.isArray(decksBody)
      ? decksBody
      : ((decksBody as { decks?: unknown[] }).decks ?? [])
    expect(list.length).toBeGreaterThan(0)

    const cards = await request.get(`${BASE_URL}/api/v1/decks/rws/cards`)
    expect(cards.status()).toBe(200)
    const cardsBody = (await cards.json()) as { cards: unknown[] }
    expect(cardsBody.cards.length).toBeGreaterThan(0)
  })
})
