// @vitest-environment node
import { EventEmitter } from "node:events"
import type { Redis } from "ioredis"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const prismaMock = vi.hoisted(() => ({
  follow: { findMany: vi.fn() },
}))

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }))

import {
  publishRealtime,
  subscribeRealtime,
  publishAuthKick,
  subscribeAuthKick,
  resetRealtimeBus,
  isRedisAttemptPendingForTests,
  createBusRedisClient,
  configureBusRedis,
  injectBusClientsForTests,
  busConnectAttemptsForTests,
  handleBusRawForTests,
  AUTH_KICK_CHANNEL,
  REALTIME_CHANNEL,
} from "../../socket-service/src/bus"
import {
  emitNewPost,
  emitLikeUpdated,
  emitCommentAdded,
  emitCommentLikeUpdated,
  emitFollowUpdate,
  emitNotification,
  emitGiftReceived,
} from "../../socket-service/src/emitters"

type BusMessage = {
  event: string
  rooms: string[]
  payload: unknown
}

function collect(): { messages: BusMessage[]; stop: () => void } {
  const messages: BusMessage[] = []
  const stop = subscribeRealtime((msg) => messages.push(msg))
  return { messages, stop }
}

describe("realtime bus (memória, sem REDIS_URL)", () => {
  beforeEach(() => {
    resetRealtimeBus()
    delete process.env.REDIS_URL
  })

  afterEach(() => {
    resetRealtimeBus()
  })

  it("publishRealtime entrega a mensagem aos assinantes", async () => {
    const { messages, stop } = collect()
    await publishRealtime({
      event: "like-updated",
      rooms: ["post:p1"],
      payload: { postId: "p1", newCount: 2 },
    })
    expect(messages).toHaveLength(1)
    expect(messages[0]).toEqual({
      event: "like-updated",
      rooms: ["post:p1"],
      payload: { postId: "p1", newCount: 2 },
    })
    stop()
  })

  it("unsubscribe para de receber mensagens", async () => {
    const { messages, stop } = collect()
    stop()
    await publishRealtime({
      event: "notification",
      rooms: ["user:u1"],
      payload: {},
    })
    expect(messages).toHaveLength(0)
  })

  it("publishAuthKick entrega userId aos assinantes e obedece unsubscribe", async () => {
    const kicks: string[] = []
    const stop = subscribeAuthKick((userId) => kicks.push(userId))
    await publishAuthKick("usr_9")
    expect(kicks).toEqual(["usr_9"])
    stop()
    await publishAuthKick("usr_10")
    expect(kicks).toEqual(["usr_9"])
  })

  it("mensagem crua malformada ou com tipos errados é descartada (revisão R2)", () => {
    const { messages, stop } = collect()

    // JSON inválido
    handleBusRawForTests(REALTIME_CHANNEL, "{nao-e-json")
    // presenca mas tipos errados: event nao-string
    handleBusRawForTests(
      REALTIME_CHANNEL,
      JSON.stringify({ event: 123, rooms: ["post:p1"], payload: {} }),
    )
    // rooms como string
    handleBusRawForTests(
      REALTIME_CHANNEL,
      JSON.stringify({
        event: "like-updated",
        rooms: "post:p1",
        payload: {},
      }),
    )
    // rooms com item nao-string
    handleBusRawForTests(
      REALTIME_CHANNEL,
      JSON.stringify({
        event: "like-updated",
        rooms: ["post:p1", 42],
        payload: {},
      }),
    )
    // rooms vazio broadcastaria para todas as sockets no relay
    handleBusRawForTests(
      REALTIME_CHANNEL,
      JSON.stringify({ event: "like-updated", rooms: [], payload: {} }),
    )
    // sem payload
    handleBusRawForTests(
      REALTIME_CHANNEL,
      JSON.stringify({ event: "like-updated", rooms: ["post:p1"] }),
    )

    expect(messages).toHaveLength(0)
    stop()
  })

  it("mensagem crua válida chega aos handlers; kick cru entrega userId", () => {
    const { messages, stop } = collect()
    const kicks: string[] = []
    const stopKick = subscribeAuthKick((userId) => kicks.push(userId))

    handleBusRawForTests(
      REALTIME_CHANNEL,
      JSON.stringify({
        event: "like-updated",
        rooms: ["post:p1"],
        payload: { postId: "p1", newCount: 3 },
      }),
    )
    handleBusRawForTests(AUTH_KICK_CHANNEL, "usr_7")

    expect(messages).toHaveLength(1)
    expect(messages[0]).toEqual({
      event: "like-updated",
      rooms: ["post:p1"],
      payload: { postId: "p1", newCount: 3 },
    })
    expect(kicks).toEqual(["usr_7"])
    stop()
    stopKick()
  })
})

describe("fail-fast do Redis (Crítico 4)", () => {
  afterEach(async () => {
    await resetRealtimeBus()
    delete process.env.REDIS_URL
  })

  it("publish com Redis fora falha rápido e libera nova tentativa", async () => {
    await resetRealtimeBus()
    process.env.REDIS_URL = "redis://127.0.0.1:6390" // porta fechada

    const started = Date.now()
    await publishRealtime({
      event: "like-updated",
      rooms: ["post:p1"],
      payload: { postId: "p1", newCount: 1 },
    })
    expect(Date.now() - started).toBeLessThan(4000)
    // promise rejeitada não fica cacheada — a próxima tentativa refaz a conexão
    expect(isRedisAttemptPendingForTests()).toBe(false)

    const started2 = Date.now()
    await publishRealtime({
      event: "like-updated",
      rooms: ["post:p1"],
      payload: { postId: "p1", newCount: 2 },
    })
    expect(Date.now() - started2).toBeLessThan(4000)

    // após a falha, o bus de memória volta a entregar normalmente
    delete process.env.REDIS_URL
    const { messages, stop } = collect()
    await publishRealtime({
      event: "notification",
      rooms: ["user:u1"],
      payload: { id: "n1", type: "follow", message: "oi" },
    })
    expect(messages).toHaveLength(1)
    stop()
  }, 15_000)

  it("cliente do bus nasce com opções fail-fast", () => {
    const client = createBusRedisClient("redis://127.0.0.1:6390")
    try {
      expect(client.options.lazyConnect).toBe(true)
      expect(client.options.enableOfflineQueue).toBe(false)
      expect(client.options.maxRetriesPerRequest).toBe(1)
      expect(client.options.commandTimeout).toBeGreaterThan(0)
      expect(client.options.connectTimeout).toBeLessThanOrEqual(3000)
      expect(client.options.retryStrategy?.(1)).toBeNull()
    } finally {
      client.disconnect()
    }
  })
})

describe("auto-recuperação de conexão morta (ECONNRESET)", () => {
  afterEach(async () => {
    await resetRealtimeBus()
    delete process.env.REDIS_URL
  })

  type DeadClient = {
    status: string
    publish: () => number
    quit: () => Promise<void>
    disconnect: () => void
    dead: boolean
  }

  function makeDeadClient(): DeadClient {
    return Object.assign(new EventEmitter(), {
      status: "end",
      publish() {
        this.dead = true
        throw new Error("Connection is closed")
      },
      quit: () => Promise.resolve(),
      disconnect() {},
      dead: false,
    })
  }

  it("cliente pub morto: descarta e refaz a tentativa de conexão", async () => {
    await resetRealtimeBus()
    // porta fechada: a nova tentativa falha rápido (fail-fast preservado)
    configureBusRedis("redis://127.0.0.1:6390")
    const deadPub = makeDeadClient()
    const deadSub = makeDeadClient()
    injectBusClientsForTests(
      deadPub as unknown as Redis,
      deadSub as unknown as Redis,
    )
    const attemptsBefore = busConnectAttemptsForTests()

    await publishRealtime({
      event: "like-updated",
      rooms: ["post:p1"],
      payload: { postId: "p1", newCount: 1 },
    })

    // RED: hoje o cliente morto é herdado e nenhum reconnect é tentado
    expect(busConnectAttemptsForTests()).toBeGreaterThan(attemptsBefore)
  }, 10_000)

  it("sub morto com pub vivo também refaz a conexão", async () => {
    await resetRealtimeBus()
    configureBusRedis("redis://127.0.0.1:6390")
    const deadSub = makeDeadClient()
    const alivePub = makeDeadClient()
    alivePub.status = "ready"
    alivePub.publish = () => 1
    injectBusClientsForTests(
      alivePub as unknown as Redis,
      deadSub as unknown as Redis,
    )
    const attemptsBefore = busConnectAttemptsForTests()

    await publishRealtime({
      event: "like-updated",
      rooms: ["post:p1"],
      payload: { postId: "p1", newCount: 1 },
    })

    expect(busConnectAttemptsForTests()).toBeGreaterThan(attemptsBefore)
  }, 10_000)

  it("close do sub agenda reconexão automática (sem publish no processo)", async () => {
    vi.useFakeTimers()
    try {
      await resetRealtimeBus()
      configureBusRedis("redis://127.0.0.1:6390")
      const sub = Object.assign(new EventEmitter(), {
        status: "ready",
        quit: () => Promise.resolve(),
        publish: () => 1,
      })
      const pub = makeDeadClient()
      pub.status = "ready"
      pub.publish = () => 1
      injectBusClientsForTests(pub as unknown as Redis, sub as unknown as Redis)
      const attemptsBefore = busConnectAttemptsForTests()

      // como o ioredis real: o status muda para "close" ao fechar
      sub.status = "close"
      sub.emit("close")
      await vi.advanceTimersByTimeAsync(1500)

      expect(busConnectAttemptsForTests()).toBeGreaterThan(attemptsBefore)
    } finally {
      vi.useRealTimers()
      await resetRealtimeBus()
    }
  })

  async function waitFor(
    cond: () => boolean,
    timeoutMs: number,
  ): Promise<void> {
    const start = Date.now()
    while (!cond()) {
      if (Date.now() - start > timeoutMs) {
        throw new Error(`condicao nao alcancada em ${timeoutMs}ms`)
      }
      await new Promise((resolve) => setTimeout(resolve, 50))
    }
  }

  it("2a tentativa de reconexao acontece mesmo se a 1a falhar (arquitetura C-1)", async () => {
    // A cadeia scheduleBusReconnect -> ensureRedis -> falha -> reschedule
    // morria na 1a falha: o guard `sub !== subClient` via o sub ANTIGO
    // contra subClient ja zerado por discardDeadClients() e retornava —
    // o sub ficava mudo para sempre (1 tentativa, nao as 5 dos docs).
    await resetRealtimeBus()
    configureBusRedis("redis://127.0.0.1:6390")
    const sub = Object.assign(new EventEmitter(), {
      status: "ready",
      quit: () => Promise.resolve(),
      publish: () => 1,
    })
    const pub = makeDeadClient()
    pub.status = "ready"
    pub.publish = () => 1
    injectBusClientsForTests(pub as unknown as Redis, sub as unknown as Redis)
    const attemptsBefore = busConnectAttemptsForTests()

    sub.status = "close"
    sub.emit("close")

    // 1a tentativa: conecta contra a porta fechada e falha rapido
    await waitFor(() => busConnectAttemptsForTests() > attemptsBefore, 5_000)
    // 2a tentativa: so acontece se a cadeia de retry sobreviver a 1a falha
    await waitFor(
      () => busConnectAttemptsForTests() > attemptsBefore + 1,
      7_000,
    )
  }, 15_000)

  it("após a tentativa falhar, o próximo publish tenta de novo (não trava)", async () => {
    await resetRealtimeBus()
    configureBusRedis("redis://127.0.0.1:6390")
    injectBusClientsForTests(
      makeDeadClient() as unknown as Redis,
      makeDeadClient() as unknown as Redis,
    )
    await publishRealtime({
      event: "like-updated",
      rooms: ["post:p1"],
      payload: { postId: "p1", newCount: 1 },
    })
    const attemptsAfterFirst = busConnectAttemptsForTests()

    await publishRealtime({
      event: "like-updated",
      rooms: ["post:p1"],
      payload: { postId: "p1", newCount: 2 },
    })

    expect(busConnectAttemptsForTests()).toBeGreaterThan(attemptsAfterFirst)
  }, 10_000)
})

describe("emitters (T070)", () => {
  beforeEach(() => {
    resetRealtimeBus()
    delete process.env.REDIS_URL
    prismaMock.follow.findMany.mockReset()
  })

  afterEach(() => {
    resetRealtimeBus()
  })

  it("emitNewPost publica new-post nas rooms user:/feed: de cada seguidor", async () => {
    prismaMock.follow.findMany.mockResolvedValue([
      { followerId: "u2" },
      { followerId: "u3" },
    ])
    const { messages, stop } = collect()

    await emitNewPost({ authorId: "u1", postId: "p9", preview: "Bom dia" })

    // T070/T088: rooms dos SEGUIDORES do autor (quem segue o autor),
    // não das pessoas que o autor segue. take = teto de fan-out (Crítico 6).
    expect(prismaMock.follow.findMany).toHaveBeenCalledWith({
      where: { followingId: "u1" },
      select: { followerId: true },
      orderBy: { followerId: "asc" },
      take: 500,
    })
    expect(messages).toHaveLength(1)
    expect(messages[0]!.event).toBe("new-post")
    expect(new Set(messages[0]!.rooms)).toEqual(
      new Set(["user:u2", "feed:u2", "user:u3", "feed:u3"]),
    )
    expect(messages[0]!.payload).toEqual({
      postId: "p9",
      authorId: "u1",
      preview: "Bom dia",
    })
    stop()
  })

  it("fonte unica: configureBusRedis(undefined) força memoria mesmo com process.env (revisao K)", async () => {
    const { configureBusRedis, subscribeRealtime, publishRealtime } =
      await import("../../socket-service/src/bus")
    process.env.REDIS_URL = "redis://localhost:6379"
    try {
      configureBusRedis(undefined)
      const received: unknown[] = []
      subscribeRealtime((message) => received.push(message))
      await publishRealtime({
        event: "like-updated",
        rooms: [],
        payload: { postId: "p1", newCount: 1 },
      })
      expect(received).toHaveLength(1)
    } finally {
      delete process.env.REDIS_URL
    }
  })

  it("fonte unica: configureBusRedis(url) usa a URL configurada, não process.env (revisao K)", async () => {
    const { configureBusRedis, subscribeRealtime, publishRealtime } =
      await import("../../socket-service/src/bus")
    delete process.env.REDIS_URL
    configureBusRedis("redis://127.0.0.1:1")
    const received: unknown[] = []
    subscribeRealtime((message) => received.push(message))
    await publishRealtime({
      event: "like-updated",
      rooms: [],
      payload: { postId: "p1", newCount: 1 },
    })
    await new Promise((r) => setTimeout(r, 100))
    // tenta Redis (url configurada) e falha — NÃO cai na memória
    expect(received).toHaveLength(0)
  })

  it("emitNewPost sem seguidores publica sem rooms", async () => {
    prismaMock.follow.findMany.mockResolvedValue([])
    const { messages, stop } = collect()
    await emitNewPost({ authorId: "u1", postId: "p9", preview: null })
    expect(messages[0]!.rooms).toEqual([])
    stop()
  })

  it("emitNewPost limita o fan-out a 500 seguidores (take)", async () => {
    prismaMock.follow.findMany.mockResolvedValue(
      Array.from({ length: 501 }, (_, i) => ({ followerId: `u${i}` })),
    )
    const { messages, stop } = collect()

    await emitNewPost({ authorId: "u1", postId: "p9", preview: null })

    expect(prismaMock.follow.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 500 }),
    )
    // 500 seguidores × (user:{id} + feed:{id})
    expect(messages[0]!.rooms).toHaveLength(1000)
    stop()
  })

  it("emitLikeUpdated publica na room post:{id}", async () => {
    const { messages, stop } = collect()
    await emitLikeUpdated({ postId: "p1", newCount: 5 })
    expect(messages[0]).toEqual({
      event: "like-updated",
      rooms: ["post:p1"],
      payload: { postId: "p1", newCount: 5 },
    })
    stop()
  })

  it("emitCommentAdded publica na room do post + user room do autor do post", async () => {
    const { messages, stop } = collect()
    await emitCommentAdded({
      postId: "p1",
      commentId: "c1",
      authorName: "Ana",
      text: "lindo!",
      postAuthorId: "u9",
    })
    expect(new Set(messages[0]!.rooms)).toEqual(new Set(["post:p1", "user:u9"]))
    expect(messages[0]!.payload).toEqual({
      postId: "p1",
      commentId: "c1",
      authorName: "Ana",
      text: "lindo!",
    })
    stop()
  })

  it("emitCommentAdded sem postAuthorId publica só na room do post", async () => {
    const { messages, stop } = collect()
    await emitCommentAdded({
      postId: "p1",
      commentId: "c1",
      authorName: "Ana",
      text: "oi",
    })
    expect(messages[0]!.rooms).toEqual(["post:p1"])
    stop()
  })

  it("emitCommentLikeUpdated publica na room post:{postId}", async () => {
    const { messages, stop } = collect()
    await emitCommentLikeUpdated({
      commentId: "c1",
      postId: "p1",
      newCount: 3,
    })
    expect(messages[0]!.rooms).toEqual(["post:p1"])
    expect(messages[0]!.event).toBe("comment-like-updated")
    stop()
  })

  it("emitFollowUpdate publica na room user:{followingId}", async () => {
    const { messages, stop } = collect()
    await emitFollowUpdate({
      followerId: "u1",
      followingId: "u2",
      isFollowing: true,
    })
    expect(messages[0]).toEqual({
      event: "follow-update",
      rooms: ["user:u2"],
      payload: { followerId: "u1", followingId: "u2", isFollowing: true },
    })
    stop()
  })

  it("emitNotification publica na room user:{userId}", async () => {
    const { messages, stop } = collect()
    await emitNotification({
      userId: "u7",
      notification: { id: "n1", type: "follow", message: "seguiu você" },
    })
    expect(messages[0]).toEqual({
      event: "notification",
      rooms: ["user:u7"],
      payload: { id: "n1", type: "follow", message: "seguiu você" },
    })
    stop()
  })

  it("emitGiftReceived publica na room user:{toUserId}", async () => {
    const { messages, stop } = collect()
    await emitGiftReceived({
      toUserId: "u5",
      fromUserId: "u6",
      giftId: "g1",
      giftName: "Vela",
    })
    expect(messages[0]!.rooms).toEqual(["user:u5"])
    expect(messages[0]!.event).toBe("gift-received")
    stop()
  })
})
