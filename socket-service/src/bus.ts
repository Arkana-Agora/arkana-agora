import { EventEmitter } from "node:events"
import Redis from "ioredis"

import { logger } from "./lib/logger"
import { createRedisUrlResolver } from "./lib/redis-url"

// Event Bus entre Next.js e socket-service (docs/02-architecture/
// architecture.md §6.4): Redis Pub/Sub quando REDIS_URL existe (dev com
// docker compose e produção), EventEmitter in-process quando não existe
// (testes — os dois lados correm no mesmo processo).

export const REALTIME_CHANNEL = "realtime:events"
// Canal de revogação de acesso (Crítico 5): token-service publica o
// userId quando tokenVersion muda (logout/revogação/soft-delete) e o
// socket-service desconecta as sockets daquele usuário.
export const AUTH_KICK_CHANNEL = "auth:kicks"

export interface RealtimeMessage {
  event: string
  rooms: string[]
  payload: unknown
}

type Handler = (message: RealtimeMessage) => void
type KickHandler = (userId: string) => void

const handlers = new Set<Handler>()
const kickHandlers = new Set<KickHandler>()
const memoryBus = new EventEmitter()
memoryBus.setMaxListeners(0)
const MEMORY_EVENT = "realtime"
const MEMORY_KICK_EVENT = "auth-kick"

let pubClient: Redis | null = null
let subClient: Redis | null = null
let redisReady: Promise<Redis> | null = null
let busConnectAttempts = 0

// Reconexão do sub fora do request path: o retryStrategy fail-fast não
// reconecta (e não deve — o publish nunca pode pendurar), mas o sub do
// socket-service não publica nada e ficaria permanentemente mudo depois
// de um ECONNRESET (observado no E2E T075). O close/end do sub agenda
// uma nova tentativa com backoff; o próximo publish/subscribe também
// refaz a conexão (ensureRedis detecta cliente morto).
let reconnectTimer: ReturnType<typeof setTimeout> | null = null
let reconnectFailures = 0
let busShuttingDown = false

function registerSubCloseHandler(sub: Redis): void {
  const onClose = (): void => scheduleBusReconnect(sub)
  sub.on("close", onClose)
  sub.on("end", onClose)
}

function scheduleBusReconnect(sub: Redis): void {
  if (busShuttingDown || reconnectTimer !== null) return
  // Só ignora o sub obsoleto quando um sub NOVO já está vivo
  // (subClient !== null && sub !== subClient). Com subClient zerado por
  // discardDeadClients(), o sub antigo É o reconector desejado — comparar
  // `sub !== subClient` incondicionalmente matava a cadeia na 1ª falha
  // (arquitetura C-1): backoff 1s→30s/máx 5 falhas nunca executava.
  if (subClient !== null && sub !== subClient) return
  const delay =
    reconnectFailures === 0
      ? 1000
      : Math.min(1000 * 2 ** reconnectFailures, 30_000)
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null
    if (busShuttingDown) return
    if (subClient !== null && sub !== subClient) return
    void ensureRedis().then(
      () => {
        reconnectFailures = 0
      },
      () => {
        reconnectFailures++
        if (reconnectFailures <= 5 && !busShuttingDown) {
          scheduleBusReconnect(sub)
        }
      },
    )
  }, delay)
}

// Fonte única (revisão K): quando o socket-service configura o bus com
// a env validada (createSocketServer), process.env é ignorado — inclusive
// quando a env configurada não tem REDIS_URL (memória). Sem configuração
// explícita (lado Next/token-service), cai em process.env. Helper
// compartilhado com redis-auth (revisão de consistência).
const busRedisUrl = createRedisUrlResolver()

export function configureBusRedis(url: string | undefined): void {
  busRedisUrl.configure(url)
}

function resolveRedisUrl(): string | undefined {
  return busRedisUrl.resolve()
}

function hasRedis(): boolean {
  return Boolean(resolveRedisUrl())
}

// Fail-fast (Crítico 4): espelha src/lib/redis.ts — sem fila offline,
// 1 retry de comando, sem retry de conexão, com timeouts explícitos para
// o publish nunca pendurar o request path (rotas aguardam o emit).
export function createBusRedisClient(url: string): Redis {
  return new Redis(url, {
    lazyConnect: true,
    enableOfflineQueue: false,
    maxRetriesPerRequest: 1,
    retryStrategy: () => null,
    commandTimeout: 2000,
    connectTimeout: 3000,
  })
}

async function connectRedis(): Promise<Redis> {
  busConnectAttempts++
  const url = resolveRedisUrl() as string
  const pub = createBusRedisClient(url)
  pub.on("error", (err: Error) => {
    logger.warn({ err }, "[realtime-bus] erro no pub Redis")
  })
  let sub: Redis | null = null
  try {
    await pub.connect()
    sub = pub.duplicate()
    sub.on("error", (err: Error) => {
      logger.warn({ err }, "[realtime-bus] erro no sub Redis")
    })
    sub.on("message", handleBusMessage)
    registerSubCloseHandler(sub)
    await sub.connect()
    await sub.subscribe(REALTIME_CHANNEL, AUTH_KICK_CHANNEL)
    pubClient = pub
    subClient = sub
    return pub
  } catch (err) {
    // Tentativa falhou: destroi os sockets parciais e deixa o próximo
    // chamado refazer a conexão (redisReady é limpo em ensureRedis).
    try {
      sub?.disconnect()
    } catch {
      // já fechado
    }
    try {
      pub.disconnect()
    } catch {
      // já fechado
    }
    throw err
  }
}

// Um cliente cujo retryStrategy devolveu null (fail-fast) nunca
// reconecta sozinho: depois de ECONNRESET/fechamento ele fica morto para
// sempre e todo publish seguinte falharia ("Connection is closed"),
// deixando o bus permanentemente mudo (observado no E2E T075). O estado
// "end"/"close" detecta a morte e o próximo uso refaz a conexão.
function isBusClientDead(client: Redis | null): boolean {
  if (client === null) return false
  return client.status === "end" || client.status === "close"
}

function discardDeadClients(): void {
  const pub = pubClient
  const sub = subClient
  pubClient = null
  subClient = null
  redisReady = null
  try {
    void sub?.quit().catch(() => {
      // já fechado
    })
  } catch {
    // já fechado
  }
  try {
    void pub?.quit().catch(() => {
      // já fechado
    })
  } catch {
    // já fechado
  }
}

async function ensureRedis(): Promise<Redis | null> {
  if (!hasRedis()) return null
  if (redisReady !== null) {
    const settled: Redis | null = await redisReady.catch(() => null)
    if (isBusClientDead(settled) || isBusClientDead(subClient)) {
      discardDeadClients()
    }
  }
  if (redisReady === null) {
    const attempt = connectRedis()
    redisReady = attempt
    // Promise rejeitada nunca fica cacheada: com Redis fora, a próxima
    // chamada refaz a tentativa em vez de herdar a falha antiga.
    void attempt.catch(() => {
      if (redisReady === attempt) redisReady = null
    })
  }
  return redisReady
}

/** Testes: true enquanto há tentativa de conexão Redis em andamento. */
export function isRedisAttemptPendingForTests(): boolean {
  return redisReady !== null
}

/** Testes: injeta clientes pub/sub (ex.: mortos) e conta tentativas. */
export function injectBusClientsForTests(pub: Redis, sub: Redis): void {
  pubClient = pub
  subClient = sub
  redisReady = Promise.resolve(pub)
  registerSubCloseHandler(sub)
}

/** Testes: quantas tentativas de conexão o bus fez. */
export function busConnectAttemptsForTests(): number {
  return busConnectAttempts
}

function safeParse(raw: string): RealtimeMessage | null {
  try {
    const parsed: unknown = JSON.parse(raw)
    // Revisão R2: validar TIPOS, não só presença das chaves — um `rooms`
    // como string/objeto escaparia do guard `rooms.length === 0` do relay
    // e viraria broadcast inesperado; `event` não-string cairia no
    // allowlist como undefined. Forma correta: event string, rooms array
    // de strings não-vazias e payload presente.
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "event" in parsed &&
      typeof parsed.event === "string" &&
      "rooms" in parsed &&
      Array.isArray(parsed.rooms) &&
      parsed.rooms.length > 0 &&
      parsed.rooms.every(
        (room: unknown) => typeof room === "string" && room.length > 0,
      ) &&
      "payload" in parsed
    ) {
      return {
        event: parsed.event,
        rooms: parsed.rooms as string[],
        payload: parsed.payload,
      }
    }
  } catch {
    // mensagem malformada — descarta
  }
  return null
}

// Roteia uma mensagem crua do sub (canal + payload) — usado pelo listener
// "message" do ioredis e pelos testes (sem Redis real).
function handleBusMessage(channel: string, raw: string): void {
  if (channel === AUTH_KICK_CHANNEL) {
    dispatchKick(raw)
    return
  }
  if (channel !== REALTIME_CHANNEL) return
  dispatch(safeParse(raw))
}

/** Testes: entrega uma mensagem crua como o sub faria. */
export function handleBusRawForTests(channel: string, raw: string): void {
  handleBusMessage(channel, raw)
}

function dispatch(message: RealtimeMessage | null): void {
  if (message === null) return
  for (const handler of handlers) {
    handler(message)
  }
}

function dispatchKick(userId: string): void {
  if (userId.length === 0) return
  for (const handler of kickHandlers) {
    handler(userId)
  }
}

export async function publishRealtime(message: RealtimeMessage): Promise<void> {
  // Fire-and-forget: uma falha de bus nunca deve derrubar a ação de
  // negócio que disparou o emit (criação de post, follow etc.).
  try {
    const pub = await ensureRedis()
    if (pub !== null) {
      await pub.publish(REALTIME_CHANNEL, JSON.stringify(message))
    } else {
      memoryBus.emit(MEMORY_EVENT, message)
    }
  } catch (err) {
    logger.warn({ err, event: message.event }, "[realtime-bus] publish falhou")
  }
}

export function subscribeRealtime(handler: Handler): () => void {
  handlers.add(handler)
  const onMemory = (message: RealtimeMessage) => handler(message)
  memoryBus.on(MEMORY_EVENT, onMemory)
  // Garante assinatura Redis mesmo se o publisher ainda não existir.
  void ensureRedis().catch((err: unknown) => {
    logger.warn({ err }, "[realtime-bus] subscribe falhou")
  })
  return () => {
    handlers.delete(handler)
    memoryBus.off(MEMORY_EVENT, onMemory)
  }
}

// Publica o kick de revogação (token-service → socket-service). Assim
// como publishRealtime: falha de bus nunca derruba a ação de negócio.
export async function publishAuthKick(userId: string): Promise<void> {
  if (userId.length === 0) return
  try {
    const pub = await ensureRedis()
    if (pub !== null) {
      await pub.publish(AUTH_KICK_CHANNEL, userId)
    } else {
      memoryBus.emit(MEMORY_KICK_EVENT, userId)
    }
  } catch (err) {
    logger.warn({ err, userId }, "[realtime-bus] kick publish falhou")
  }
}

export function subscribeAuthKick(handler: KickHandler): () => void {
  kickHandlers.add(handler)
  const onMemory = (userId: string) => handler(userId)
  memoryBus.on(MEMORY_KICK_EVENT, onMemory)
  void ensureRedis().catch((err: unknown) => {
    logger.warn({ err }, "[realtime-bus] subscribe de kick falhou")
  })
  return () => {
    kickHandlers.delete(handler)
    memoryBus.off(MEMORY_KICK_EVENT, onMemory)
  }
}

export async function resetRealtimeBus(): Promise<void> {
  busShuttingDown = true
  if (reconnectTimer !== null) {
    clearTimeout(reconnectTimer)
    reconnectTimer = null
  }
  busRedisUrl.reset()
  handlers.clear()
  kickHandlers.clear()
  memoryBus.removeAllListeners(MEMORY_EVENT)
  memoryBus.removeAllListeners(MEMORY_KICK_EVENT)
  const pending = redisReady
  redisReady = null
  // Espera a tentativa terminar antes de capturar os clientes: se ela
  // concluir agora, os sockets criados são feitos logo abaixo.
  if (pending !== null) {
    try {
      await pending
    } catch {
      // tentativa de conexão que falhou — sockets já foram destruídos
    }
  }
  const pub = pubClient
  const sub = subClient
  pubClient = null
  subClient = null
  try {
    await sub?.quit()
    await pub?.quit()
  } catch {
    // clientes já fechados
  }
  busShuttingDown = false
  reconnectFailures = 0
}
