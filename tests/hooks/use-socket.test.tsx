// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const ioMock = vi.hoisted(() => vi.fn())
const apiGetMock = vi.hoisted(() => vi.fn())
const resolveTokenMock = vi.hoisted(() => vi.fn())

vi.mock("socket.io-client", () => ({ io: ioMock }))
vi.mock("@/lib/api", () => ({ default: { get: apiGetMock } }))
vi.mock("@/lib/auth-refresh", () => ({
  resolveAccessToken: resolveTokenMock,
}))

import { useSocket, resetSocketManagerForTests } from "@/hooks/use-socket"

interface FakeSocket {
  on: ReturnType<typeof vi.fn>
  emit: ReturnType<typeof vi.fn>
  disconnect: ReturnType<typeof vi.fn>
  connect: ReturnType<typeof vi.fn>
  connected: boolean
  active: boolean
  handlers: Map<string, Array<(payload: unknown) => void>>
}

function makeFakeSocket(): FakeSocket {
  const handlers = new Map<string, Array<(payload: unknown) => void>>()
  return {
    handlers,
    connected: false,
    // true = socket subscreve o Manager (erros de transporte — o
    // Manager reconecta sozinho); false = destroy() do CONNECT_ERROR
    // de namespace (sem auto-retry — religação manual, arquitetura C-2)
    active: true,
    on: vi.fn((event: string, cb: (payload: unknown) => void) => {
      const list = handlers.get(event) ?? []
      list.push(cb)
      handlers.set(event, list)
    }),
    emit: vi.fn(),
    disconnect: vi.fn(),
    connect: vi.fn(),
  }
}

function fire(socket: FakeSocket, event: string, payload?: unknown): void {
  for (const cb of socket.handlers.get(event) ?? []) {
    cb(payload)
  }
}

function makeJwt(sub: string): string {
  return `hdr.${btoa(JSON.stringify({ sub }))}.sig`
}

async function flush(times = 10): Promise<void> {
  await act(async () => {
    for (let i = 0; i < times; i += 1) {
      await Promise.resolve()
    }
  })
}

describe("useSocket (T072)", () => {
  let fake: FakeSocket

  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    fake = makeFakeSocket()
    ioMock.mockReturnValue(fake)
    resolveTokenMock.mockResolvedValue(makeJwt("usr_me"))
    apiGetMock.mockResolvedValue({
      data: { data: { posts: [], notifications: [], unreadCount: 0 } },
    })
    resetSocketManagerForTests()
  })

  afterEach(() => {
    resetSocketManagerForTests()
    vi.useRealTimers()
  })

  it("conecta com token e backoff 1s→30s", async () => {
    renderHook(() => useSocket({}))
    await flush()
    expect(ioMock).toHaveBeenCalled()

    const [url, opts] = ioMock.mock.calls[0] as [
      string,
      Record<string, unknown>,
    ]
    expect(url).toBe("http://localhost:3003")
    // auth é função (revisão J) — frescor do token coberto no teste dedicado
    expect(typeof opts.auth).toBe("function")
    expect(opts.transports).toEqual(["websocket"])
    expect(opts.reconnectionDelay).toBe(1000)
    expect(opts.reconnectionDelayMax).toBe(30000)
  })

  it("connect não emite room:join (auto-join é do servidor — revisão V1)", async () => {
    renderHook(() => useSocket({}))
    await flush()
    expect(ioMock).toHaveBeenCalled()

    act(() => {
      fake.connected = true
      fire(fake, "connect")
    })

    // servidor.ts:177 entra sozinho em user:/feed: e o handler room:join
    // recusa essas rooms (anti-spoof) — emitir daqui é código morto.
    expect(fake.emit).not.toHaveBeenCalled()
  })

  it("repassa eventos tipados aos listeners registrados", async () => {
    const onNotification = vi.fn()
    const onNewPost = vi.fn()
    renderHook(() =>
      useSocket({ notification: onNotification, "new-post": onNewPost }),
    )
    await flush()

    act(() => {
      fire(fake, "notification", { id: "n1", type: "follow", message: "oi" })
      fire(fake, "new-post", { postId: "p1", authorId: "u1", preview: "x" })
    })

    expect(onNotification).toHaveBeenCalledWith({
      id: "n1",
      type: "follow",
      message: "oi",
    })
    expect(onNewPost).toHaveBeenCalledWith({
      postId: "p1",
      authorId: "u1",
      preview: "x",
    })
  })

  it("useSocket não expõe status/joinRoom/leaveRoom (revisão V1)", async () => {
    const { result } = renderHook(() => useSocket({}))
    await flush()

    // consumidores reais (use-feed, notifications-provider) chamam o hook
    // como statement — a API observável é só `handlers`.
    expect(result.current).toBeUndefined()
  })

  it("handler que lança não derruba os demais listeners (revisão V1)", async () => {
    const bad = vi.fn(() => {
      throw new Error("boom")
    })
    const good = vi.fn()
    renderHook(() => useSocket({ notification: bad }))
    renderHook(() => useSocket({ notification: good }))
    await flush()

    act(() => {
      fire(fake, "notification", { id: "n1", type: "follow", message: "oi" })
    })

    expect(bad).toHaveBeenCalled()
    // a exceção do primeiro subscriber não pode impedir o segundo
    expect(good).toHaveBeenCalledWith({
      id: "n1",
      type: "follow",
      message: "oi",
    })
  })

  it("fallback polling 30s: posts/notificações viram eventos", async () => {
    const onNewPost = vi.fn()
    const onNotification = vi.fn()
    renderHook(() =>
      useSocket({ "new-post": onNewPost, notification: onNotification }),
    )
    await flush()
    // socket nunca conecta (fake.connected continua false)

    apiGetMock.mockResolvedValue({
      data: {
        data: {
          posts: [{ id: "p9", authorId: "u2", content: "ola mundo" }],
          notifications: [
            { id: "n1", type: "follow", message: "seguiu", isRead: false },
          ],
          unreadCount: 1,
        },
      },
    })

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000)
    })

    expect(apiGetMock).toHaveBeenCalledWith(
      expect.stringContaining("/social/polling/posts?since="),
    )
    expect(apiGetMock).toHaveBeenCalledWith(
      expect.stringContaining("/social/polling/notifications?since="),
    )
    expect(onNewPost).toHaveBeenCalledWith({
      postId: "p9",
      authorId: "u2",
      preview: "ola mundo",
    })
    expect(onNotification).toHaveBeenCalledWith({
      id: "n1",
      type: "follow",
      message: "seguiu",
    })
  })

  it("polling não roda quando conectado", async () => {
    renderHook(() => useSocket({}))
    await flush()
    expect(ioMock).toHaveBeenCalled()

    act(() => {
      fake.connected = true
      fire(fake, "connect")
    })

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000)
    })
    expect(apiGetMock).not.toHaveBeenCalled()
  })

  it("cursor por endpoint: não avança quando aquele endpoint falha", async () => {
    renderHook(() => useSocket({}))
    await flush()

    const sinceOf = (index: number): string => {
      const call = apiGetMock.mock.calls[index]
      const url = (call?.[0] ?? "") as string
      return new URL(url, "http://x").searchParams.get("since") ?? ""
    }

    // poll1: posts ok, notifications falha
    apiGetMock.mockResolvedValueOnce({
      data: { data: { posts: [], notifications: [] } },
    })
    apiGetMock.mockRejectedValueOnce(new Error("500"))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000)
    })
    const postsSince1 = sinceOf(0)
    const notifsSince1 = sinceOf(1)

    // poll2: ambos ok
    apiGetMock.mockResolvedValue({
      data: { data: { posts: [], notifications: [] } },
    })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000)
    })
    const postsSince2 = sinceOf(2)
    const notifsSince2 = sinceOf(3)

    // posts avançou (deu certo); notifications NÃO avançou (falhou no poll1)
    expect(postsSince2).not.toBe(postsSince1)
    expect(notifsSince2).toBe(notifsSince1)

    // poll3: notifications teve sucesso no poll2 → agora avança
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000)
    })
    const notifsSince3 = sinceOf(5)
    expect(notifsSince3).not.toBe(notifsSince1)
  })

  it("cursor avança para o timestamp de ENVIO, não da resposta", async () => {
    renderHook(() => useSocket({}))
    await flush()

    let resolvePosts!: (value: unknown) => void
    let resolveNotifs!: (value: unknown) => void
    apiGetMock.mockReturnValueOnce(
      new Promise((resolve) => {
        resolvePosts = resolve
      }),
    )
    apiGetMock.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveNotifs = resolve
      }),
    )

    // envio em t=30s; resposta só chega em t=35s
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000)
    })
    const sentAtMs = Date.now()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000)
    })
    await act(async () => {
      resolvePosts({ data: { data: { posts: [], notifications: [] } } })
      resolveNotifs({ data: { data: { posts: [], notifications: [] } } })
      await Promise.resolve()
    })

    // próximo poll (t=60s) deve usar o cursor de t=30s (envio), não t=35s
    await act(async () => {
      await vi.advanceTimersByTimeAsync(25_000)
    })
    const nextCall = apiGetMock.mock.calls[2]
    const nextSince = new URL(
      (nextCall?.[0] ?? "") as string,
      "http://x",
    ).searchParams.get("since")
    expect(nextSince).toBe(new Date(sentAtMs).toISOString())
  })

  it("unmount desconecta e para o polling", async () => {
    const { unmount } = renderHook(() => useSocket({}))
    await flush()
    expect(ioMock).toHaveBeenCalled()

    unmount()
    expect(fake.disconnect).toHaveBeenCalled()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000)
    })
    expect(apiGetMock).not.toHaveBeenCalled()
  })

  it("auth é função: cada tentativa busca token fresco (revisão J)", async () => {
    renderHook(() => useSocket({}))
    await flush()
    expect(ioMock).toHaveBeenCalled()

    const [, opts] = ioMock.mock.calls[0] as [string, Record<string, unknown>]
    expect(typeof opts.auth).toBe("function")
    const authFn = opts.auth as (cb: (data: unknown) => void) => void

    const creds: unknown[] = []
    authFn((data) => creds.push(data))
    await flush()
    expect(creds).toEqual([{ token: makeJwt("usr_me") }])

    // 2ª tentativa (reconexão): token novo, não o congelado
    resolveTokenMock.mockResolvedValueOnce(makeJwt("usr_renovado"))
    authFn((data) => creds.push(data))
    await flush()
    expect(creds[1]).toEqual({ token: makeJwt("usr_renovado") })
  })

  it("falha em resolveAccessToken não rejeita e religa com backoff (revisão J + arquitetura C-2)", async () => {
    resolveTokenMock.mockRejectedValueOnce(new Error("refresh falhou"))
    renderHook(() => useSocket({}))
    await flush()
    await flush()

    // sem socket imediato e sem unhandled rejection
    expect(ioMock).not.toHaveBeenCalled()
    // religa com backoff (1s) enquanto a sessão quiser realtime
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000)
    })
    expect(ioMock).toHaveBeenCalledTimes(1)
    // fallback de polling segue vivo mesmo sem socket conectado
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000)
    })
    expect(apiGetMock).toHaveBeenCalled()
  })

  it("rejeição de namespace religa com backoff (arquitetura C-2)", async () => {
    renderHook(() => useSocket({}))
    await flush()
    expect(ioMock).toHaveBeenCalledTimes(1)

    // CONNECT_ERROR de namespace → destroy() → subs limpos → active=false
    fake.active = false
    act(() => {
      fire(fake, "connect_error", new Error("Unauthorized"))
    })
    expect(fake.connect).not.toHaveBeenCalled()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(999)
    })
    expect(fake.connect).not.toHaveBeenCalled()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1)
    })
    expect(fake.connect).toHaveBeenCalledTimes(1)

    // sucesso religa o backoff: a próxima falha volta a 1s
    act(() => {
      fake.connected = true
      fire(fake, "connect")
    })
    fake.connected = false
    fake.active = false
    act(() => {
      fire(fake, "connect_error", new Error("Unauthorized"))
    })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000)
    })
    expect(fake.connect).toHaveBeenCalledTimes(2)
  })

  it("rate_limited espera a janela do limiter (60s) antes de religar", async () => {
    renderHook(() => useSocket({}))
    await flush()
    fake.active = false
    act(() => {
      fire(fake, "connect_error", new Error("rate_limited"))
    })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(59_000)
    })
    expect(fake.connect).not.toHaveBeenCalled()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000)
    })
    expect(fake.connect).toHaveBeenCalledTimes(1)
  })

  it("connect_error de transporte (active=true) não dispara retry manual", async () => {
    // o Manager já reconecta sozinho com reconnectionDelay/backoff —
    // um retry manual duplicaria as tentativas contra o limiter
    renderHook(() => useSocket({}))
    await flush()
    act(() => {
      fire(fake, "connect_error", new Error("transport error"))
    })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(31_000)
    })
    expect(fake.connect).not.toHaveBeenCalled()
  })

  it("unmount durante o retry pendente não religa", async () => {
    const { unmount } = renderHook(() => useSocket({}))
    await flush()
    fake.active = false
    act(() => {
      fire(fake, "connect_error", new Error("Unauthorized"))
    })
    unmount()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000)
    })
    expect(fake.connect).not.toHaveBeenCalled()
  })

  it("epóque: unmount durante o resolve aborta a criação do socket (revisão J)", async () => {
    let resolveToken!: (value: string) => void
    resolveTokenMock.mockReturnValueOnce(
      new Promise<string>((resolve) => {
        resolveToken = resolve
      }),
    )

    const { unmount } = renderHook(() => useSocket({}))
    await flush()
    expect(ioMock).not.toHaveBeenCalled()

    unmount()
    resolveToken(makeJwt("usr_me"))
    await flush()
    expect(ioMock).not.toHaveBeenCalled()
    expect(fake.disconnect).not.toHaveBeenCalled()
  })
  it("cursor usa o MAIS ANTIGO entre envio e serverTime (revisao S)", async () => {
    renderHook(() => useSocket({}))
    await flush()

    let resolvePosts!: (value: unknown) => void
    let resolveNotifs!: (value: unknown) => void
    apiGetMock.mockReturnValueOnce(
      new Promise((resolve) => {
        resolvePosts = resolve
      }),
    )
    apiGetMock.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveNotifs = resolve
      }),
    )

    // envio em t=30s; resposta em t=35s com serverTime do servidor
    // ANTERIOR ao envio (relogio do servidor atrasado)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000)
    })
    const sentAtMs = Date.now()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000)
    })
    const serverTimeOlder = new Date(sentAtMs - 500).toISOString()
    await act(async () => {
      resolvePosts({
        data: {
          data: { posts: [], notifications: [] },
          serverTime: serverTimeOlder,
        },
      })
      resolveNotifs({
        data: {
          data: { posts: [], notifications: [] },
          serverTime: serverTimeOlder,
        },
      })
      await Promise.resolve()
    })

    await act(async () => {
      await vi.advanceTimersByTimeAsync(25_000)
    })
    const nextSince = new URL(
      (apiGetMock.mock.calls[2]?.[0] ?? "") as string,
      "http://x",
    ).searchParams.get("since")
    // mais antigo = serverTime (29.5s), n�o o sentAt (30s): nunca pula janela
    expect(nextSince).toBe(serverTimeOlder)
    expect(nextSince).not.toBe(new Date(sentAtMs).toISOString())
  })

  it("serverTime do servidor � frente (relogio adiantado) mant�m o sentAt", async () => {
    renderHook(() => useSocket({}))
    await flush()

    let resolvePosts!: (value: unknown) => void
    let resolveNotifs!: (value: unknown) => void
    apiGetMock.mockReturnValueOnce(
      new Promise((resolve) => {
        resolvePosts = resolve
      }),
    )
    apiGetMock.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveNotifs = resolve
      }),
    )

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000)
    })
    const sentAtMs = Date.now()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000)
    })
    const serverTimeNewer = new Date(sentAtMs + 60_000).toISOString()
    await act(async () => {
      resolvePosts({
        data: {
          data: { posts: [], notifications: [] },
          serverTime: serverTimeNewer,
        },
      })
      resolveNotifs({
        data: {
          data: { posts: [], notifications: [] },
          serverTime: serverTimeNewer,
        },
      })
      await Promise.resolve()
    })

    await act(async () => {
      await vi.advanceTimersByTimeAsync(25_000)
    })
    const nextSince = new URL(
      (apiGetMock.mock.calls[2]?.[0] ?? "") as string,
      "http://x",
    ).searchParams.get("since")
    // mais antigo = sentAt (envio), n�o o serverTime futuro
    expect(nextSince).toBe(new Date(sentAtMs).toISOString())
  })

  it("envelope malformado conta como falha: cursor não avança e não dispara evento (R2)", async () => {
    const onNewPost = vi.fn()
    renderHook(() => useSocket({ "new-post": onNewPost }))
    await flush()

    let resolvePosts!: (value: unknown) => void
    apiGetMock.mockReturnValueOnce(
      new Promise((resolve) => {
        resolvePosts = resolve
      }),
    )
    apiGetMock.mockResolvedValueOnce({
      data: { data: { notifications: [], unreadCount: 0 } },
    })

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000)
    })
    const since1 = new URL(
      (apiGetMock.mock.calls[0]?.[0] ?? "") as string,
      "http://x",
    ).searchParams.get("since")

    // ciclo 1: posts com forma errada (array vira string) — cast silencioso
    // avançaria o cursor e dispararia evento com postId sujo
    await act(async () => {
      resolvePosts({ data: { data: { posts: "nao-e-array" } } })
      await Promise.resolve()
    })
    expect(onNewPost).not.toHaveBeenCalled()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000)
    })
    const since2 = new URL(
      (apiGetMock.mock.calls[2]?.[0] ?? "") as string,
      "http://x",
    ).searchParams.get("since")
    // falha de validação não pode consumir a janela
    expect(since2).toBe(since1)
  })

  it("pagina cheia (50) drena com `until` sem avancar o since (revisao I-1)", async () => {
    const onNewPost = vi.fn()
    renderHook(() => useSocket({ "new-post": onNewPost }))
    await flush()

    const urlOf = (index: number): URL =>
      new URL((apiGetMock.mock.calls[index]?.[0] ?? "") as string, "http://x")

    const makePosts = (n: number, baseMs: number, prefix = "p"): unknown[] =>
      Array.from({ length: n }, (_, i) => ({
        id: `${prefix}${i}`,
        authorId: "u1",
        content: "conteudo",
        createdAt: new Date(baseMs - i * 1000).toISOString(),
      }))
    const makeNotifs = (n: number, baseMs: number): unknown[] =>
      Array.from({ length: n }, (_, i) => ({
        id: `n${i}`,
        type: "follow",
        message: "msg",
        createdAt: new Date(baseMs - i * 1000).toISOString(),
      }))

    const t0 = Date.now()
    const oldest1 = new Date(t0 - 49_000).toISOString()
    const oldest2 = new Date(t0 - 109_000).toISOString()

    // poll1: AMBOS os endpoints devolvem pagina cheia (50)
    apiGetMock.mockResolvedValueOnce({
      data: { data: { posts: makePosts(50, t0) } },
    })
    apiGetMock.mockResolvedValueOnce({
      data: { data: { notifications: makeNotifs(50, t0) } },
    })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000)
    })
    const sentAtMs1 = Date.now()
    expect(urlOf(0).searchParams.get("until")).toBeNull()
    const since1 = urlOf(0).searchParams.get("since")
    const notifSince1 = urlOf(1).searchParams.get("since")

    // poll2: posts ainda cheio (backlog >50) — until desce (min) e o
    // since continua travado; notifs drena (10 < 50) e avanca sozinho
    apiGetMock.mockResolvedValueOnce({
      data: { data: { posts: makePosts(50, t0 - 60_000, "e") } },
    })
    apiGetMock.mockResolvedValueOnce({
      data: { data: { notifications: makeNotifs(10, t0 - 50_000) } },
    })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000)
    })
    expect(urlOf(2).searchParams.get("until")).toBe(oldest1)
    expect(urlOf(2).searchParams.get("since")).toBe(since1)
    expect(urlOf(3).searchParams.get("until")).toBe(oldest1)
    expect(urlOf(3).searchParams.get("since")).toBe(notifSince1)

    // poll3: posts drenado (10 < 50) — until limpo e since avanca para o
    // cursor do poll1 (cobre eventos criados durante a janela travada)
    apiGetMock.mockResolvedValueOnce({
      data: { data: { posts: makePosts(10, t0 - 150_000, "d") } },
    })
    apiGetMock.mockResolvedValueOnce({
      data: { data: { notifications: [] } },
    })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000)
    })
    expect(urlOf(4).searchParams.get("until")).toBe(oldest2)
    expect(urlOf(4).searchParams.get("since")).toBe(since1)
    expect(urlOf(5).searchParams.get("until")).toBeNull()
    expect(urlOf(5).searchParams.get("since")).not.toBe(notifSince1)
    // linhas drenadas chegam como eventos
    expect(onNewPost).toHaveBeenCalledWith({
      postId: "d0",
      authorId: "u1",
      preview: "conteudo",
    })

    // poll4: janela esgotada — until limpo e since avanca de verdade
    apiGetMock.mockResolvedValueOnce({ data: { data: { posts: [] } } })
    apiGetMock.mockResolvedValueOnce({
      data: { data: { notifications: [] } },
    })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000)
    })
    expect(urlOf(6).searchParams.get("until")).toBeNull()
    expect(urlOf(6).searchParams.get("since")).toBe(
      new Date(sentAtMs1).toISOString(),
    )
    expect(urlOf(6).searchParams.get("since")).not.toBe(since1)
    expect(urlOf(7).searchParams.get("until")).toBeNull()
  })

  it("re-acquire durante o resolve religa o connect (race de epoch)", async () => {
    // StrictMode/refresh: effect monta (connect pendurado no resolve do
    // token), cleanup libera (epoch++), novo effect re-adquire enquanto o
    // resolve antigo ainda está no ar — sem religação o socket nunca nasce.
    let releaseResolve!: (token: string) => void
    resolveTokenMock.mockReturnValueOnce(
      new Promise<string>((resolve) => {
        releaseResolve = resolve
      }),
    )

    const first = renderHook(() => useSocket({}))
    await flush()
    expect(ioMock).not.toHaveBeenCalled()

    first.unmount() // release: epoch++, connectWanted=false
    resolveTokenMock.mockResolvedValue(makeJwt("usr_me"))
    renderHook(() => useSocket({})) // re-adquire: connect bloqueado em connecting
    await flush()
    expect(ioMock).not.toHaveBeenCalled()

    releaseResolve(makeJwt("usr_me")) // connect1 aborta por epoch -> religa
    await flush()
    expect(ioMock).toHaveBeenCalled()
  })

  it("unmount definitivo durante o resolve não religa (sem socket zumbi)", async () => {
    let releaseResolve!: (token: string) => void
    resolveTokenMock.mockReturnValueOnce(
      new Promise<string>((resolve) => {
        releaseResolve = resolve
      }),
    )

    const { unmount } = renderHook(() => useSocket({}))
    await flush()
    unmount() // último release: connectWanted=false

    releaseResolve(makeJwt("usr_me"))
    await flush()
    expect(ioMock).not.toHaveBeenCalled()
  })
})

describe("produção sem NEXT_PUBLIC_WS_URL (C1 revisão nextjs)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    apiGetMock.mockResolvedValue({
      data: { data: { posts: [], notifications: [], unreadCount: 0 } },
    })
    resolveTokenMock.mockResolvedValue(makeJwt("usr_me"))
  })

  afterEach(() => {
    resetSocketManagerForTests()
    vi.useRealTimers()
    vi.unstubAllEnvs()
    vi.resetModules()
    vi.restoreAllMocks()
  })

  it("desliga o realtime (sem io()) e avisa no console", async () => {
    vi.stubEnv("NODE_ENV", "production")
    vi.stubEnv("NEXT_PUBLIC_WS_URL", "")
    vi.spyOn(console, "error").mockImplementation(() => {})
    vi.resetModules()
    // import fresco: o SOCKET_URL é resolvido no load do módulo
    const { useSocket } = await import("@/hooks/use-socket")
    const { unmount } = renderHook(() => useSocket({}))
    await flush()

    expect(ioMock).not.toHaveBeenCalled()
    expect(
      vi
        .mocked(console.error)
        .mock.calls.some((call) =>
          call.map(String).join(" ").includes("NEXT_PUBLIC_WS_URL"),
        ),
    ).toBe(true)

    // polling continua vivo mesmo com o realtime desabilitado
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000)
    })
    expect(apiGetMock).toHaveBeenCalled()
    unmount()
  })
})
