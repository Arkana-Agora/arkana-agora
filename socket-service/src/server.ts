import { createServer, type Server as HttpServer } from "node:http"
import { Server, type DefaultEventsMap } from "socket.io"
import type { z } from "zod"

import { verifySocketToken } from "./auth"
import { realtimeEventSchemas } from "./event-schemas"
import {
  configureBusRedis,
  subscribeAuthKick,
  subscribeRealtime,
  type RealtimeMessage,
} from "./bus"
import type { SocketEnv } from "./lib/env"
import { logger } from "./lib/logger"
import { allowHandshake, resolveClientIp } from "./handshake-limit"
import { configureRedisAuth, getCachedTokenVersion } from "./redis-auth"
import { verifyRoomAccess, type RoomAccessResult } from "./room-access"

// Revisão R2: o `declare module "socket.io" { interface SocketData }` criava
// uma interface ÓRFÃ — o socket.io não exporta `SocketData`; é o 4º genérico
// de `Server`/`Socket` (default `any`), então `socket.data` ficava `any` e o
// código dependia de casts (`as string`). Os genéricos em `new Server<...>`
// ligam o dado de verdade e eliminam os casts.
export interface SocketData {
  userId: string
  tokenExpiresAt: number
  tokenVersion: number
  accessToken: string
  clientRooms: Set<string>
}

// Servidor Socket.io standalone (plano T066 / ADR-007): porta via
// SOCKET_PORT (default 3003), CORS restrito à AUTH_URL, auth RS256 no
// handshake e rooms autorais user:{id}/feed:{id} entradas automaticamente.
// Rooms post:/comment: são sob demanda (room:join/room:leave com ack);
// user:/feed: de terceiros são recusadas (anti-spoof — só o servidor entra).

export interface SocketServerHandle {
  io: Server
  httpServer: HttpServer
  close: () => Promise<void>
}

interface JoinAck {
  ok: boolean
  error?: string
}

const CLIENT_JOIN_ROOM = /^(post|comment):[A-Za-z0-9_-]+$/

function parseAck(callback: unknown): ((ack: JoinAck) => void) | null {
  return typeof callback === "function"
    ? (callback as (ack: JoinAck) => void)
    : null
}

export async function createSocketServer(options: {
  env: SocketEnv
  /** Intervalo da revalidação periódica (exp + tokenVersion). Testes usam valores baixos. */
  revalidateIntervalMs?: number
  /** Limite de tentativas de handshake por IP (default 60/min). */
  handshakeRateLimit?: { max: number; windowMs: number }
  /** Revisão M: visibilidade de room + cap de rooms por socket. */
  roomAccess?: {
    verify?: (input: {
      userId: string
      room: string
      token: string
    }) => RoomAccessResult | Promise<RoomAccessResult>
    maxRooms?: number
  }
}): Promise<SocketServerHandle> {
  const { env } = options
  const revalidateIntervalMs = options.revalidateIntervalMs ?? 60_000
  const rateLimit = options.handshakeRateLimit
  // Cap de rooms cliente-joináveis por socket (revisão M): limita o
  // crescimento de memória do adapter por conexão.
  const maxClientRooms = options.roomAccess?.maxRooms ?? 100
  const verifyRoom =
    options.roomAccess?.verify ??
    ((input: { userId: string; room: string; token: string }) =>
      verifyRoomAccess({
        room: input.room,
        token: input.token,
        authUrl: env.AUTH_URL,
      }))

  // Fonte única (revisão K): bus, espelho de tokenVersion e adapter leem
  // a env VALIDADA do Zod — process.env não é consultado por nenhum deles
  // depois deste ponto (inclui REDIS_URL ausente → memória/sem adapter).
  configureBusRedis(env.REDIS_URL)
  configureRedisAuth(env.REDIS_URL)

  const httpServer = createServer((req, res) => {
    const url = req.url ?? ""
    if (url.startsWith("/health")) {
      res.writeHead(200, { "Content-Type": "application/json" })
      res.end('{"status":"ok"}')
      return
    }
    if (url.startsWith("/socket.io")) {
      return // engine.io responde (listener anexado depois)
    }
    res.writeHead(404, { "Content-Type": "application/json" })
    res.end('{"error":"not_found"}')
  })

  const socketServer = new Server<
    DefaultEventsMap,
    DefaultEventsMap,
    DefaultEventsMap,
    SocketData
  >(httpServer, {
    cors: {
      origin: env.AUTH_URL,
      methods: ["GET", "POST"],
    },
  })

  // Redis adapter para multi-instância só quando a env VALIDADA tem
  // REDIS_URL (fonte única — revisão K; process.env nunca é lido aqui).
  let adapterClose: (() => Promise<void>) | null = null
  if (env.REDIS_URL) {
    const { default: Redis } = await import("ioredis")
    const { createAdapter } = await import("@socket.io/redis-adapter")
    const pub = new Redis(env.REDIS_URL)
    const sub = pub.duplicate()
    // ioredis avisa "missing 'error' handler" se ninguém escuta o evento
    pub.on("error", (err: Error) => {
      logger.warn({ err }, "[socket-adapter] erro no Redis pub do adapter")
    })
    sub.on("error", (err: Error) => {
      logger.warn({ err }, "[socket-adapter] erro no Redis sub do adapter")
    })
    socketServer.adapter(createAdapter(pub, sub))
    adapterClose = async () => {
      await sub.quit()
      await pub.quit()
    }
  }

  socketServer.use(async (socket, next) => {
    const ip = resolveClientIp(
      socket.handshake.headers as
        Record<string, string | string[] | undefined> | undefined,
      socket.handshake.address,
    )
    if (!allowHandshake(ip, rateLimit ?? {})) {
      logger.warn({ ip }, "[socket-auth] handshake rate-limited")
      next(new Error("rate_limited"))
      return
    }
    try {
      const token: unknown = socket.handshake.auth?.token
      if (typeof token !== "string" || token.length === 0) {
        throw new Error("token_ausente")
      }
      const claims = await verifySocketToken(
        token,
        env.JWT_PUBLIC_KEY,
        env.ACCESS_TOKEN_TTL_SECONDS,
      )
      socket.data.userId = claims.userId
      socket.data.tokenExpiresAt = claims.tokenExpiresAt
      socket.data.tokenVersion = claims.tokenVersion
      // Revisão M: Bearer para o verificador de visibilidade de rooms.
      socket.data.accessToken = token
      next()
    } catch (err) {
      // Motivo vai só para o log do servidor — a mensagem enviada ao
      // cliente continua genérica ("Unauthorized").
      logger.warn(
        { ip, reason: err instanceof Error ? err.message : "unknown" },
        "[socket-auth] handshake recusado",
      )
      next(new Error("Unauthorized"))
    }
  })

  // Revogação instantânea (Crítico 5): token-service publica o userId
  // quando tokenVersion muda; aqui as sockets do usuário são derrubadas
  // (todas as instâncias via adapter — disconnectSockets é adapter-aware).
  const unsubscribeKick = subscribeAuthKick((userId: string) => {
    socketServer.in(`user:${userId}`).disconnectSockets(true)
  })

  socketServer.on("connection", (socket) => {
    const userId = socket.data.userId
    socket.data.clientRooms = new Set<string>()
    void socket.join([`user:${userId}`, `feed:${userId}`])

    socket.on("room:join", (room: unknown, callback: unknown) => {
      const ack = parseAck(callback)
      if (typeof room !== "string" || !CLIENT_JOIN_ROOM.test(room)) {
        ack?.({ ok: false, error: "room_forbidden" })
        return
      }
      const joined = socket.data.clientRooms
      // Re-join idempotente: não consome vaga nem refaz a checagem.
      if (joined.has(room)) {
        ack?.({ ok: true })
        return
      }
      if (joined.size >= maxClientRooms) {
        ack?.({ ok: false, error: "room_cap" })
        return
      }
      // Revisão M: visibilidade via API. S2 (fail-closed): só `true`
      // abre o join — false, null ou erro do verificador negam com
      // room_forbidden (incerteza nunca vira acesso; polling cobre).
      void (async () => {
        let allowed: RoomAccessResult
        try {
          allowed = await verifyRoom({
            userId,
            room,
            token: socket.data.accessToken,
          })
        } catch {
          allowed = false
        }
        if (!allowed) {
          ack?.({ ok: false, error: "room_forbidden" })
          return
        }
        // Re-checks síncronos pós-await (S2): outro room:join em voo
        // pode ter consumido a vaga ou já entrado nesta room enquanto o
        // verificador rodava (corrida check-then-act). A reserva da
        // vaga é feita ANTES do await de socket.join para fechar a
        // janela entre checagem e adição.
        if (joined.has(room)) {
          ack?.({ ok: true })
          return
        }
        if (joined.size >= maxClientRooms) {
          ack?.({ ok: false, error: "room_cap" })
          return
        }
        joined.add(room)
        try {
          await socket.join(room)
          ack?.({ ok: true })
        } catch {
          joined.delete(room)
          ack?.({ ok: false, error: "room_error" })
        }
      })()
    })

    socket.on("room:leave", (room: unknown, callback: unknown) => {
      const ack = parseAck(callback)
      if (typeof room !== "string" || !CLIENT_JOIN_ROOM.test(room)) {
        ack?.({ ok: false, error: "room_forbidden" })
        return
      }
      socket.data.clientRooms.delete(room)
      void socket.leave(room)
      ack?.({ ok: true })
    })
  })

  // Event Bus → rooms: cada mensagem publicada (emit* em emitters.ts)
  // é repassada às rooms alvo em TODAS as instâncias (adapter).
  // `to(rooms).emit` faz a união das salas num único broadcast — um
  // cliente em user:{id} E feed:{id} recebe UMA vez (dedupe do adapter).
  // Guard de rooms vazias é obrigatório: `to([]).emit` broadcastaria
  // para TODAS as sockets conectadas (revisão Phase 2.5).
  // Revisão N: allowlist + schema na fronteira do relay — mensagem do
  // bus com evento desconhecido ou payload inválido nunca chega ao
  // wire (defesa em profundidade: o emit() já valida no publish).
  const unsubscribe = subscribeRealtime((message: RealtimeMessage) => {
    if (message.rooms.length === 0) return
    const schema = (
      realtimeEventSchemas as Record<string, z.ZodType | undefined>
    )[message.event]
    if (schema === undefined) {
      logger.warn(
        { event: message.event },
        "[realtime-relay] evento fora do allowlist ignorado",
      )
      return
    }
    const parsed = schema.safeParse(message.payload)
    if (!parsed.success) {
      logger.warn(
        { event: message.event, issues: parsed.error.issues },
        "[realtime-relay] payload invalido ignorado",
      )
      return
    }
    socketServer.to(message.rooms).emit(message.event, parsed.data)
  })

  await new Promise<void>((resolve, reject) => {
    const onError = (err: Error) => reject(err)
    httpServer.once("error", onError)
    httpServer.listen(env.SOCKET_PORT, () => {
      httpServer.off("error", onError)
      resolve()
    })
  })

  // Revalidação periódica (Crítico 5): além do kick instantâneo, cada
  // tick confere (a) exp do token handshakeado e (b) tokenVersion no
  // espelho Redis — protege contra kick perdido (Redis fora no momento
  // do bump). Cache miss é fail-open (documentado em redis-auth.ts).
  let revalidating = false
  const revalidateTimer = setInterval(() => {
    if (revalidating) return
    revalidating = true
    void (async () => {
      const now = Date.now()
      for (const socket of socketServer.sockets.sockets.values()) {
        const { userId, tokenExpiresAt, tokenVersion } = socket.data
        if (typeof tokenExpiresAt === "number" && now > tokenExpiresAt) {
          socket.disconnect(true)
          continue
        }
        const cached = await getCachedTokenVersion(userId)
        if (cached !== null && cached !== tokenVersion) {
          socket.disconnect(true)
        }
      }
    })()
      .catch(() => undefined)
      .finally(() => {
        revalidating = false
      })
  }, revalidateIntervalMs)

  const close = async (): Promise<void> => {
    clearInterval(revalidateTimer)
    unsubscribe()
    unsubscribeKick()
    await new Promise<void>((resolve) => {
      socketServer.close(() => resolve())
    })
    if (adapterClose !== null) {
      await adapterClose()
    }
  }

  return { io: socketServer, httpServer, close }
}
