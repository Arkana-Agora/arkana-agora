import {
  expect,
  test,
  type APIRequestContext,
  type Page,
} from "@playwright/test"

import {
  BASE_URL,
  cleanupUser,
  csrfHeaders,
  ensureProfile,
  attachSession,
  getUserByEmail,
  prisma,
  registerUser,
  TEST_PASSWORD,
} from "./helpers"

// T075 — realtime social com 2 contexts de navegador (US-020/AC):
// 1. post de A → pill "N novos posts" no feed de B (WS, <30s do fallback);
// 2. follow de A em B → badge de notificação no AppHeader de B (WS);
// 3. WS bloqueado → fallback polling T071 entrega a pill; reconexão
//    posterior recupera a entrega (backoff 1s→30s do T072);
// 4. like/comment de B em post de A → notification + badge no AppHeader de A
//    via WS (T076/T077, rotas da Phase 3); gift segue fixme (T120 pendente).
// Reconnect puro (drop → re-join de rooms) é coberto em
// tests/integration/websocket.test.ts (T074).

const EMAIL_AUTHOR = "e2e-realtime-author@test.com"
const EMAIL_FOLLOWER = "e2e-realtime-follower@test.com"

async function uiLogin(page: Page, email: string): Promise<void> {
  // Contextos frescos abrem o AnalyticsConsentBanner (backdrop z-50 que
  // intercepta cliques) — pré-salva a decisão antes de qualquer navegação.
  await page.addInitScript(() => {
    localStorage.setItem("analytics-consent", "false")
  })
  await page.goto("/login")
  await page.getByLabel(/e-?mail/i).fill(email)
  // getByLabel(/senha/i) casa também o aria-label do botão "Mostrar senha"
  await page.getByTestId("password").fill(TEST_PASSWORD)
  await page.getByRole("button", { name: "Entrar", exact: true }).click()
  await page.waitForURL(/\/dashboard/, { timeout: 15_000 })
}

async function createPostViaApi(
  request: APIRequestContext,
  token: string,
  content: string,
): Promise<number> {
  const csrf = csrfHeaders()
  const res = await request.post(`${BASE_URL}/api/v1/social/posts`, {
    headers: { ...csrf.headers, Authorization: `Bearer ${token}` },
    data: { type: "text", content },
  })
  return res.status()
}

async function createAuthorPost(
  request: APIRequestContext,
  token: string,
  author: string,
  content: string,
): Promise<string> {
  const csrf = csrfHeaders()
  const res = await request.post(`${BASE_URL}/api/v1/social/posts`, {
    headers: { ...csrf.headers, Authorization: `Bearer ${token}` },
    data: { type: "text", content },
  })
  expect(res.status()).toBe(201)
  const post = await prisma.post.findFirst({
    where: { authorId: author, content },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  })
  if (!post) throw new Error("post e2e de realtime nao foi encontrado")
  return post.id
}

test.describe("T075: realtime social — 2 browsers", () => {
  test.describe.configure({ mode: "serial" })

  let authorToken = ""
  let followerToken = ""
  let followerId = ""
  let authorId = ""

  test.beforeAll(async ({ request }) => {
    await registerUser(request, EMAIL_AUTHOR, "E2E Realtime Author")
    await registerUser(request, EMAIL_FOLLOWER, "E2E Realtime Follower")

    const author = await getUserByEmail(EMAIL_AUTHOR)
    const follower = await getUserByEmail(EMAIL_FOLLOWER)
    if (!author || !follower) {
      throw new Error("usuarios e2e de realtime nao foram criados")
    }
    authorId = author.id
    followerId = follower.id

    await ensureProfile(authorId, { username: "e2e_rt_author" })
    await ensureProfile(followerId, { username: "e2e_rt_follower" })

    // Relação B segue A direto no DB (sem emit): garante rooms do
    // emitNewPost sem consumir cota de follow nem gerar notificação.
    const existing = await prisma.follow.findFirst({
      where: { followerId, followingId: authorId },
    })
    if (!existing) {
      await prisma.follow.create({
        data: { followerId, followingId: authorId },
      })
    }

    authorToken = (await attachSession(request, EMAIL_AUTHOR)).accessToken
    followerToken = (await attachSession(request, EMAIL_FOLLOWER)).accessToken
  })

  test.afterAll(async () => {
    // Retry logic for transient database connection issues during cleanup
    const retryCleanup = async (
      fn: () => Promise<void>,
      retries = 3,
      delay = 1000,
    ) => {
      for (let i = 0; i < retries; i++) {
        try {
          await fn()
          return
        } catch (e) {
          if (i === retries - 1) throw e
          await new Promise((r) => setTimeout(r, delay * (i + 1)))
        }
      }
    }

    await retryCleanup(async () => {
      await prisma.post.deleteMany({ where: { authorId } })
    })
    await retryCleanup(async () => {
      await prisma.followReward.deleteMany({
        where: {
          OR: [
            { followerId, followingId: authorId },
            { followerId: authorId, followingId: followerId },
          ],
        },
      })
    })
    await retryCleanup(async () => {
      await prisma.follow.deleteMany({
        where: {
          OR: [
            { followerId: { in: [authorId, followerId] } },
            { followingId: { in: [authorId, followerId] } },
          ],
        },
      })
    })
    await retryCleanup(async () => {
      await prisma.notification.deleteMany({
        where: { userId: { in: [authorId, followerId] } },
      })
    })
    await retryCleanup(async () => {
      await cleanupUser(EMAIL_AUTHOR)
    })
    await retryCleanup(async () => {
      await cleanupUser(EMAIL_FOLLOWER)
    })
  })

  test("post criado por A aparece no feed de B como pill '1 novo post' via WebSocket", async ({
    browser,
  }) => {
    const ctxAuthor = await browser.newContext()
    const ctxFollower = await browser.newContext()
    const pageAuthor = await ctxAuthor.newPage()
    const pageFollower = await ctxFollower.newPage()

    try {
      // B (seguidor) com o feed aberto
      await uiLogin(pageFollower, EMAIL_FOLLOWER)
      await pageFollower.goto("/feed")
      await expect(pageFollower.getByTestId("feed-container")).toBeVisible()

      // A cria o post pela UI (composer real)
      await uiLogin(pageAuthor, EMAIL_AUTHOR)
      await pageAuthor.goto("/feed")
      await pageAuthor
        .getByRole("button", { name: /O que voce quer compartilhar\?/i })
        .click()
      const content = `post realtime e2e ${Date.now()}`
      await pageAuthor.getByRole("textbox").fill(content)
      await pageAuthor.getByRole("button", { name: "Publicar" }).click()
      await expect(pageAuthor.getByTestId("feed-container")).toBeVisible({
        timeout: 15_000,
      })

      // < 30s (intervalo do fallback) → caminho WebSocket comprovado
      await expect(pageFollower.getByTestId("feed-pill")).toHaveText(
        /1 novo post/,
        { timeout: 15_000 },
      )
    } finally {
      await ctxAuthor.close()
      await ctxFollower.close()
    }
  })

  test("follow de A em B dispara notification e badge '1' no AppHeader de B via WebSocket", async ({
    browser,
    request,
  }) => {
    const ctxAuthor = await browser.newContext()
    const ctxFollower = await browser.newContext()
    const pageAuthor = await ctxAuthor.newPage()
    const pageFollower = await ctxFollower.newPage()

    try {
      await uiLogin(pageFollower, EMAIL_FOLLOWER)
      await pageFollower.goto("/dashboard")
      await expect(
        pageFollower.getByRole("navigation", {
          name: /navega[çc][aã]o principal/i,
        }),
      ).toBeVisible()
      await expect(
        pageFollower.getByTestId("unread-notifications-badge"),
      ).toHaveCount(0)

      // A segue B pela rota T043 (emite follow-update + notification)
      await uiLogin(pageAuthor, EMAIL_AUTHOR)
      const csrf = csrfHeaders()
      const res = await request.post(
        `${BASE_URL}/api/v1/social/follow/${followerId}`,
        {
          headers: {
            ...csrf.headers,
            Authorization: `Bearer ${authorToken}`,
          },
        },
      )
      expect(res.status()).toBe(201)

      // Provider só incrementa via evento WS (carga inicial é one-shot)
      await expect(
        pageFollower.getByTestId("unread-notifications-badge"),
      ).toHaveText("1", { timeout: 15_000 })
      // revisão U: mobile tem badge própria (testid -mobile, aria-label
      // igual) — selecionar pelo testid evita strict mode violation
      await expect(
        pageFollower.getByTestId("unread-notifications-badge"),
      ).toBeVisible()
    } finally {
      // remove o follow A→B para não vazar estado entre execuções
      await prisma.followReward.deleteMany({
        where: { followerId: authorId, followingId: followerId },
      })
      await prisma.follow.deleteMany({
        where: { followerId: authorId, followingId: followerId },
      })
      await prisma.notification.deleteMany({ where: { userId: followerId } })
      await ctxAuthor.close()
      await ctxFollower.close()
    }
  })

  test("WebSocket bloqueado → fallback polling 30s entrega a pill; reconexão recupera", async ({
    browser,
    request,
  }, testInfo) => {
    test.setTimeout(180_000)

    const ctx = await browser.newContext()
    const page = await ctx.newPage()
    // diagnóstico anexado quando o teste falha (flake de polling)
    const dbg: string[] = []
    page.on("console", (message) => {
      if (message.type() === "error" || message.type() === "warning") {
        dbg.push(
          `${new Date().toISOString()} [console:${message.type()}] ${message.text().slice(0, 220)}`,
        )
      }
    })
    page.on("pageerror", (error) => {
      dbg.push(
        `${new Date().toISOString()} [pageerror] ${String(error).slice(0, 300)}`,
      )
    })
    page.on("response", (response) => {
      if (response.url().includes("/social/polling/")) {
        const at = new Date().toISOString()
        void response
          .text()
          .then((body) => {
            dbg.push(
              `${at} [poll ${response.status()}] ${response.url().slice(-80)} body=${body.slice(0, 300)}`,
            )
          })
          .catch(() => {
            dbg.push(
              `${at} [poll ${response.status()}] ${response.url().slice(-80)} body=<unreadable>`,
            )
          })
      }
    })
    let wsAllowed = false
    // handshake observável: só frames chegam quando routeWebSocket permite
    // (tentativas bloqueadas morrem sem frame) — prova que o socket reconectou.
    let resolveConnected: (() => void) | undefined
    const reconnected = new Promise<void>((resolve) => {
      resolveConnected = resolve
    })
    page.on("websocket", (ws) => {
      if (!ws.url().includes("localhost:3003")) return
      ws.on("framereceived", () => resolveConnected?.())
    })
    await page.routeWebSocket(/localhost:3003/, (ws) => {
      if (wsAllowed) {
        ws.connectToServer()
      } else {
        void ws.close()
      }
    })

    try {
      await uiLogin(page, EMAIL_FOLLOWER)
      dbg.push(`${new Date().toISOString()} [step] login done`)
      await page.goto("/feed")
      await expect(page.getByTestId("feed-container")).toBeVisible()
      dbg.push(`${new Date().toISOString()} [step] feed visible`)

      const content = `post fallback e2e ${Date.now()}`
      const status = await createPostViaApi(request, authorToken, content)
      expect(status).toBe(201)
      dbg.push(`${new Date().toISOString()} [step] post created 201`)

      // primeira rodada do intervalo de 30s do hook (T072/T071) — a janela
      // inicial de 5min do cursor (INITIAL_CURSOR) pode trazer posts de testes
      // anteriores do arquivo, então a pill é ancorada no valor observado.
      const pill = page.getByTestId("feed-pill")
      await expect(pill).toHaveText(/^\d+ novos? posts?$/, {
        timeout: 60_000,
      })
      const before = Number(
        (await pill.textContent())?.match(/^\d+/)?.[0] ?? "0",
      )
      expect(before).toBeGreaterThan(0)

      // reconexão (backoff 1s→30s do T072): permite o WS e espera o
      // handshake — enquanto conectado, o polling fica suprimido, então a
      // entrega do próximo post só pode vir pelo WebSocket.
      wsAllowed = true
      await reconnected

      const second = `post reconnect e2e ${Date.now()}`
      const secondStatus = await createPostViaApi(request, authorToken, second)
      expect(secondStatus).toBe(201)

      await expect(pill).toHaveText(`${before + 1} novos posts`, {
        timeout: 60_000,
      })
    } catch (error) {
      await testInfo.attach("polling-dbg", {
        body: dbg.join("\n") || "(sem eventos capturados)",
        contentType: "text/plain",
      })
      throw error
    } finally {
      await ctx.close()
    }
  })

  test("like de B em post de A dispara notification e badge '1' no AppHeader de A via WebSocket (T076)", async ({
    browser,
    request,
  }) => {
    const ctx = await browser.newContext()
    const page = await ctx.newPage()
    const csrf = csrfHeaders()
    let postId = ""
    try {
      await uiLogin(page, EMAIL_AUTHOR)
      await page.goto("/dashboard")
      await expect(
        page.getByRole("navigation", {
          name: /navega[çc][aã]o principal/i,
        }),
      ).toBeVisible()
      await expect(page.getByTestId("unread-notifications-badge")).toHaveCount(
        0,
      )

      postId = await createAuthorPost(
        request,
        authorToken,
        authorId,
        `like realtime e2e ${Date.now()}`,
      )

      const likeRes = await request.post(
        `${BASE_URL}/api/v1/social/posts/${postId}/like`,
        {
          headers: {
            ...csrf.headers,
            Authorization: `Bearer ${followerToken}`,
          },
        },
      )
      expect(likeRes.status()).toBe(200)

      // Provider só incrementa via evento WS (carga inicial é one-shot)
      await expect(page.getByTestId("unread-notifications-badge")).toHaveText(
        "1",
        { timeout: 15_000 },
      )
    } finally {
      await prisma.postLike.deleteMany({ where: { postId } })
      await prisma.notification.deleteMany({ where: { userId: authorId } })
      if (postId) await prisma.post.deleteMany({ where: { id: postId } })
      await ctx.close()
    }
  })

  test("comment de B em post de A dispara notification e badge '1' no AppHeader de A via WebSocket (T077)", async ({
    browser,
    request,
  }) => {
    const ctx = await browser.newContext()
    const page = await ctx.newPage()
    const csrf = csrfHeaders()
    let postId = ""
    try {
      await uiLogin(page, EMAIL_AUTHOR)
      await page.goto("/dashboard")
      await expect(
        page.getByRole("navigation", {
          name: /navega[çc][aã]o principal/i,
        }),
      ).toBeVisible()
      await expect(page.getByTestId("unread-notifications-badge")).toHaveCount(
        0,
      )

      postId = await createAuthorPost(
        request,
        authorToken,
        authorId,
        `comment realtime e2e ${Date.now()}`,
      )

      const commentRes = await request.post(
        `${BASE_URL}/api/v1/social/posts/${postId}/comments`,
        {
          headers: {
            ...csrf.headers,
            Authorization: `Bearer ${followerToken}`,
          },
          data: { content: "comentario realtime e2e" },
        },
      )
      expect(commentRes.status()).toBe(201)

      // Provider só incrementa via evento WS (carga inicial é one-shot)
      await expect(page.getByTestId("unread-notifications-badge")).toHaveText(
        "1",
        { timeout: 15_000 },
      )
    } finally {
      await prisma.comment.deleteMany({ where: { postId } })
      await prisma.notification.deleteMany({ where: { userId: authorId } })
      if (postId) await prisma.post.deleteMany({ where: { id: postId } })
      await ctx.close()
    }
  })

  test.fixme("gift dispara notification real-time (T120 — gift na Phase 3)", async () => {})
})
