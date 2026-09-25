import { test, expect } from "@playwright/test"
import {
  BASE_URL,
  registerUser,
  cleanupUser,
  attachSession,
  ensureProfile,
  getUserByEmail,
  csrfHeaders,
} from "./helpers"

const TEST_EMAIL = "e2e-auth-ui@test.com"
const TEST_NAME = "E2E Auth UI"

test.describe("T117: auth UI, profile, arcana UI (browser)", () => {
  test.describe.configure({ mode: "serial" })

  test.beforeAll(async ({ request }) => {
    await registerUser(request, TEST_EMAIL, TEST_NAME)
  })

  test.afterAll(async () => {
    await cleanupUser(TEST_EMAIL)
  })

  test("T117-AUTH: login page renders form and submits", async ({ page }) => {
    await page.goto("/login")
    await expect(page).toHaveURL(/\/login/)
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible()

    const emailField = page.getByLabel(/e-?mail/i)
    const passwordField = page.getByLabel(/senha/i)
    await expect(emailField).toBeVisible()
    await expect(passwordField).toBeVisible()

    await emailField.fill(TEST_EMAIL)
    await passwordField.fill("Test@12345678")
    await page.getByRole("button", { name: /entrar|logar|login/i }).click()

    await page.waitForURL(/\/dashboard/, { timeout: 15_000 })
    await expect(page).toHaveURL(/\/dashboard/)
  })

  test("T117-AUTH: login page shows error on wrong password", async ({
    page,
  }) => {
    await page.goto("/login")
    await page.getByLabel(/e-?mail/i).fill(TEST_EMAIL)
    await page.getByLabel(/senha/i).fill("WrongPassword1!")
    await page.getByRole("button", { name: /entrar|logar|login/i }).click()

    await expect(
      page.getByText(/inválid|credencial|senha|erro/i).first(),
    ).toBeVisible({ timeout: 15_000 })
    await expect(page).toHaveURL(/\/login/)
  })

  test("T117-PROFILE: profile edit page renders and saves", async ({
    page,
  }) => {
    await page.goto("/login")
    await page.getByLabel(/e-?mail/i).fill(TEST_EMAIL)
    await page.getByLabel(/senha/i).fill("Test@12345678")
    await page.getByRole("button", { name: /entrar|logar|login/i }).click()
    await page.waitForURL(/\/dashboard/, { timeout: 15_000 })

    await page.goto("/perfil/editar")
    await expect(page).toHaveURL(/\/perfil\/editar/)
    await expect(page.getByLabel("Nome de exibição")).toBeVisible({
      timeout: 15_000,
    })
    await expect(page.getByLabel("Username")).toBeVisible()
    await expect(page.getByLabel("Bio")).toBeVisible()

    const displayName = page.getByLabel("Nome de exibição")
    await displayName.fill(`${TEST_NAME} Updated`)
    await page.getByRole("button", { name: "Salvar" }).click()

    await expect(page.getByText(/salvo às/i)).toBeVisible({ timeout: 15_000 })
  })

  test("T117-PROFILE: privacy page renders selects", async ({ page }) => {
    await page.goto("/login")
    await page.getByLabel(/e-?mail/i).fill(TEST_EMAIL)
    await page.getByLabel(/senha/i).fill("Test@12345678")
    await page.getByRole("button", { name: /entrar|logar|login/i }).click()
    await page.waitForURL(/\/dashboard/, { timeout: 15_000 })

    await page.goto("/perfil/privacidade")
    await expect(page).toHaveURL(/\/perfil\/privacidade/)
    await expect(page.getByText("Visibilidade do perfil")).toBeVisible({
      timeout: 15_000,
    })
    await expect(page.getByText("Quem pode me seguir")).toBeVisible()
    await expect(page.getByText("Quem pode comentar")).toBeVisible()

    const visibility = page
      .getByText("Visibilidade do perfil")
      .locator("..")
      .locator("select")
      .first()
    await visibility.selectOption("private")
    await page.getByRole("button", { name: "Salvar privacidade" }).click()
    await expect(page.getByTestId("privacy-saved")).toBeVisible({
      timeout: 15_000,
    })
  })

  test("T117-PROFILE: public profile page loads after username set", async ({
    page,
    request,
  }) => {
    const user = await getUserByEmail(TEST_EMAIL)
    expect(user).toBeTruthy()
    await ensureProfile(user!.id, { username: "e2e_profile_user" })

    const res = await request.get(
      `${BASE_URL}/api/v1/users/e2e_profile_user/profile`,
    )
    expect(res.status()).toBe(200)
    const body = (await res.json()) as { username: string }
    expect(body.username).toBe("e2e_profile_user")

    await page.goto("/perfil/e2e_profile_user")
    await expect(page).toHaveURL(/\/perfil\/e2e_profile_user/)
  })

  test("T117-ARCANA: arcana calculator page renders and calculates", async ({
    page,
  }) => {
    await page.goto("/login")
    await page.getByLabel(/e-?mail/i).fill(TEST_EMAIL)
    await page.getByLabel(/senha/i).fill("Test@12345678")
    await page.getByRole("button", { name: /entrar|logar|login/i }).click()
    await page.waitForURL(/\/dashboard/, { timeout: 15_000 })

    await page.goto("/meu-arcano")
    await expect(page).toHaveURL(/\/meu-arcano/)
    await expect(page.getByLabel("Nome")).toBeVisible({ timeout: 15_000 })

    // prefill via useMyProfile (authApi) — o nome salvo chega de forma assincrona
    await expect(page.getByLabel("Nome")).toHaveValue(TEST_NAME, {
      timeout: 15_000,
    })

    await page.getByLabel("Nome").fill(TEST_NAME)
    await page.getByLabel("Data de nascimento").fill("1990-06-15")
    await page.getByRole("button", { name: /calcular/i }).click()

    await expect(
      page
        .getByRole("button", { name: /interpretar com ia/i })
        .or(page.getByText(/significado|elemento|planeta/i).first()),
    ).toBeVisible({ timeout: 15_000 })
  })

  test("T117-API: profile update via API persists privacy merge", async ({
    request,
  }) => {
    const session = await attachSession(request, TEST_EMAIL)
    const res = await request.patch(`${BASE_URL}/api/v1/users/me/privacy`, {
      ...csrfHeaders(),
      headers: {
        ...csrfHeaders().headers,
        Authorization: `Bearer ${session.accessToken}`,
      },
      data: { statsVisibility: "private", whoCanComment: "following" },
    })
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body.message).toBe("Privacidade atualizada")
  })
})
