"use client"

import { useEffect, useRef } from "react"
import { getSession } from "next-auth/react"
import { io, type ExtendedError, type Socket } from "socket.io-client"
import { z } from "zod"

import api from "@/lib/api"
import { resolveAccessToken } from "@/lib/auth-refresh"
import { postPreview } from "@/lib/social/post-preview"
import {
  POLLING_DEFAULT_SINCE_MS,
  POLLING_TAKE,
} from "@/lib/social/polling-window"
import { resolveSocketUrl } from "@/lib/socket-url"
import type { RealtimeEventMap, RealtimeEventName } from "@socket/src/emitters"

// Hook de realtime social (plano T072): conecta no socket-service
// (ADR-007) com access token RS256, entra nas rooms autorais
// user:{id}/feed:{id} no connect, aceita rooms post:/comment: sob
// demanda, reconecta com backoff 1s→30s e cai no fallback de polling
// (T071) a cada 30s enquanto desconectado.

export type SocketHandlers = {
  [K in keyof RealtimeEventMap]?: (payload: RealtimeEventMap[K]) => void
}

// Documentado em docs/02-architecture/deployment.md (NEXT_PUBLIC_WS_URL)
// e .env.example — resolveSocketUrl valida (revisão P): vazio em dev →
// default de dev; vazio em produção → null (realtime desabilitado, sem
// token para localhost — C1 revisão nextjs); protocolo inválido → erro
// ruidoso.
const SOCKET_URL = resolveSocketUrl(process.env.NEXT_PUBLIC_WS_URL)
if (SOCKET_URL === null) {
  console.error(
    "[realtime] NEXT_PUBLIC_WS_URL ausente no build de produção — " +
      "realtime desabilitado (nenhum token é enviado a localhost); o " +
      "fallback de polling cobre posts/notificações. Defina a variável " +
      "ANTES de `next build` (inlined no bundle; ver " +
      "docs/02-architecture/deployment.md).",
  )
}
const POLL_INTERVAL_MS = 30_000

// Revisão L: objeto com `satisfies Record<RealtimeEventName, true>` é
// exaustivo nos dois sentidos — evento novo no RealtimeEventMap sem entrada
// aqui (ou entrada órfã) não compila.
const EVENT_NAMES = {
  "new-post": true,
  "like-updated": true,
  "comment-added": true,
  "comment-like-updated": true,
  "follow-update": true,
  notification: true,
  "gift-received": true,
} as const satisfies Record<RealtimeEventName, true>

const EVENT_LIST = Object.keys(EVENT_NAMES) as RealtimeEventName[]

type HandlerRecord = { handlers: SocketHandlers }

let socket: Socket | null = null
let acquireCount = 0
let connecting = false
// Epóque (revisão J): conecta só se ninguém liberou/enquanto o token
// resolvia — evita socket zumbi pós-unmount/logout.
let connectEpoch = 0
// Revisão Y (E2E T075): acquire/release durante o resolve do token
// (StrictMode monta → cleanup → re-monta) abortava o connect1 por epoch
// enquanto o connect2 batia no guard `connecting` — socket nunca nascia.
// `connectWanted` + religação no finally fecham a corrida; religa SÓ
// quando o epoch mudou (release real), então token-null/unmount não
// entram em loop.
let connectWanted = false
// Arquitetura C-2: religação agendada — o socket.io NÃO religa sozinho
// depois de um CONNECT_ERROR de namespace (destroy() limpa os subs;
// só erros de TRANSPORTE caem no backoff do Manager), e a resolução do
// token sem resultado também não tem retry natural.
let reconnectTimer: ReturnType<typeof setTimeout> | null = null
let reconnectFailures = 0
let pollTimer: ReturnType<typeof setInterval> | null = null
// Cursor por endpoint (Crítico 3 + revisão I-1): um poll só avança o
// cursor do endpoint que deu certo — o MAIS ANTIGO entre o timestamp de
// ENVIO e o `serverTime` da resposta (revisão S, ver `pollingCursor`);
// falha em um lado nunca descarta a janela do outro nem pula itens
// criados durante o fetch. Página cheia (>= POLLING_TAKE) trava o
// `since` e drena o backlog com `until` antes de avançar.
interface PollCursor {
  /** Janela aberta (exclusive de `until` quando não nulo). */
  since: string
  /** Teto da janela — não nulo enquanto houver backlog para drenar. */
  until: string | null
  /**
   * Cursor avançado quando a página veio cheia — só vira `since` quando
   * a drenagem termina (< POLLING_TAKE), cobrindo o que foi criado
   * durante a janela travada.
   */
  pending: string | null
}

const INITIAL_CURSOR = (): PollCursor => ({
  since: new Date(Date.now() - POLLING_DEFAULT_SINCE_MS).toISOString(),
  until: null,
  pending: null,
})
let postsCursor: PollCursor = INITIAL_CURSOR()
let notificationsCursor: PollCursor = INITIAL_CURSOR()

const subscriptions = new Set<HandlerRecord>()

// Revisão V1: exceção em um subscriber não pode derrubar os demais nem
// escapar para o callback do socket.io (que encerraria o loop do evento).
function dispatch(name: keyof RealtimeEventMap, payload: unknown): void {
  for (const record of subscriptions) {
    const handler = record.handlers[name]
    if (handler !== undefined) {
      try {
        ;(handler as (value: unknown) => void)(payload)
      } catch {
        // handler com bug — próximo subscriber ainda recebe o evento
      }
    }
  }
}

function clearReconnectTimer(): void {
  if (reconnectTimer !== null) {
    clearTimeout(reconnectTimer)
    reconnectTimer = null
  }
}

// Backoff 1s→30s (espelha reconnectionDelay/reconnectionDelayMax do
// Manager): sem teto de tentativas — desistir seria morte silenciosa do
// realtime (o bug que C-2 corrige); com 30s de teto o custo é 1
// handshake/30s enquanto a sessão quiser realtime.
function nextReconnectDelay(): number {
  const delay = Math.min(1000 * 2 ** reconnectFailures, 30_000)
  reconnectFailures += 1
  return delay
}

// target null = religar do zero (token sem resultado/falha);
// target = socket destruído pelo CONNECT_ERROR de namespace.
function scheduleReconnect(target: Socket | null, delay: number): void {
  if (reconnectTimer !== null) return
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null
    if (!connectWanted) return
    if (target === null) {
      if (socket === null) void connect()
      return
    }
    if (socket === target && !target.connected) target.connect()
  }, delay)
}

async function connect(): Promise<void> {
  if (connecting || socket !== null) return
  // Produção sem NEXT_PUBLIC_WS_URL: realtime desabilitado (aviso no
  // load do módulo) — o polling de 30s continua sendo o fallback.
  if (SOCKET_URL === null) return
  connecting = true
  const startEpoch = connectEpoch
  try {
    const token = await resolveAccessToken(async () => {
      const session = await getSession()
      return session?.accessToken ?? null
    })
    // Liberou/resetou durante o resolve — não cria socket zumbi.
    if (startEpoch !== connectEpoch) return
    if (token === null) {
      // Sem sessão resolvida: religa com backoff enquanto a sessão
      // quiser realtime (cookie pode voltar — arquitetura C-2, caso (a)).
      if (connectWanted) scheduleReconnect(null, nextReconnectDelay())
      return
    }
    // `auth` como função (revisão J): socket.io chama a cada tentativa
    // de (re)conexão — token fresco em vez do valor congelado, então a
    // religação após expirar/revogar não entra em loop de 401.
    let currentToken = token
    const next = io(SOCKET_URL, {
      auth: (cb: (data: Record<string, unknown>) => void) => {
        void resolveAccessToken(async () => {
          const session = await getSession()
          return session?.accessToken ?? null
        })
          .then((fresh) => {
            if (fresh !== null) currentToken = fresh
            cb({ token: currentToken })
          })
          .catch(() => cb({ token: currentToken }))
      },
      transports: ["websocket"],
      reconnectionDelay: 1000,
      reconnectionDelayMax: 30_000,
    })
    socket = next
    for (const name of EVENT_LIST) {
      next.on(name, (payload: unknown) => dispatch(name, payload))
    }
    // Arquitetura C-2: erros de TRANSPORTE já têm backoff no Manager
    // (reconnectionDelay/reconnectionDelayMax, `next.active` true); o
    // que não religa é o CONNECT_ERROR de namespace — destroy() limpa
    // os subs e o socket fica mudo até alguém chamar connect(). O auth
    // é função (revisão J): cada tentativa busca token fresco.
    // `rate_limited` espera a janela do limiter (60s) para não
    // martelar o cesto de 60 handshakes/min.
    next.on("connect_error", (err: ExtendedError) => {
      if (!connectWanted || socket !== next) return
      if (next.active) return
      const delay =
        err.message === "rate_limited" ? 60_000 : nextReconnectDelay()
      scheduleReconnect(next, delay)
    })
    next.on("connect", () => {
      reconnectFailures = 0
    })
    // Revisão V1: sem auto-join client-side — server.ts:177 entra sozinho
    // em user:{id}/feed:{id} no handshake e recusa essas rooms no
    // room:join (anti-spoof); post:/comment: não têm uso produtivo (YAGNI).
  } catch {
    // resolveAccessToken/io falharam (revisão J): sem unhandled
    // rejection — religa com backoff enquanto a sessão quiser realtime
    // (arquitetura C-2); o fallback de polling cuida da janela.
    if (connectWanted && socket === null) {
      scheduleReconnect(null, nextReconnectDelay())
    }
  } finally {
    connecting = false
    if (connectWanted && socket === null && startEpoch !== connectEpoch) {
      void connect()
    }
  }
}

// Revisão R2: envelope do polling validado com zod (mesmo contrato de
// `pollingPostsEnvelopeSchema` em use-feed) — o cast `as unknown as`
// engolia resposta malformada (proxy/bug de rota): posts vira string,
// o cursor avançava e eventos sujos eram disparados. Forma errada =
// falha (cursor NÃO avança, sem eventos).
const pollingItemSchema = z.object({
  id: z.string(),
  authorId: z.string(),
  content: z.string().nullish(),
  createdAt: z.string().optional(),
})

const pollingEnvelopeSchema = z.object({
  serverTime: z.string().optional(),
  data: z.object({
    posts: z.array(pollingItemSchema).optional(),
    notifications: z
      .array(
        z.object({
          id: z.string(),
          type: z.string(),
          message: z.string(),
          data: z.unknown().optional(),
          createdAt: z.string().optional(),
        }),
      )
      .optional(),
  }),
})

function isSocketConnected(): boolean {
  return socket !== null && socket.connected
}

// Revisão S: o cursor avança para o MAIS ANTIGO entre o timestamp de
// ENVIO (relógio do cliente, capturado antes do fetch) e o `serverTime`
// do envelope (relógio do servidor, capturado antes da query). Qualquer
// skew — cliente à frente, servidor à frente ou instâncias com relógios
// divergentes — só encolhe a janela (re-fetch, dedup resolve), nunca
// pula itens (gap). Sem `serverTime` (servidor antigo) cai no sentAt.
function pollingCursor(sentAt: string, serverTime: string | undefined): string {
  if (serverTime === undefined) return sentAt
  const serverMs = Date.parse(serverTime)
  if (Number.isNaN(serverMs)) return sentAt
  return serverMs < Date.parse(sentAt) ? serverTime : sentAt
}

function oldestCreatedAt(
  rows: Array<{ createdAt?: string | undefined }>,
): string | undefined {
  let oldestIso: string | undefined
  let oldestMs = Number.POSITIVE_INFINITY
  for (const row of rows) {
    if (typeof row.createdAt !== "string") continue
    const ms = Date.parse(row.createdAt)
    if (Number.isNaN(ms) || ms >= oldestMs) continue
    oldestMs = ms
    oldestIso = row.createdAt
  }
  return oldestIso
}

// Revisão I-1: página cheia (>= POLLING_TAKE) = backlog — o `since`
// trava no cursor do poll que começou a drenagem e o `until` desce para
// o createdAt mais antigo da resposta (páginas cheias consecutivas
// continuam descendo via min). O `since` só avança quando a drenagem
// termina (< POLLING_TAKE), cobrindo eventos criados durante a janela
// travada. Falha na resposta não toca no cursor.
function advanceCursor(
  cursor: PollCursor,
  rowsLength: number,
  sentAt: string,
  serverTime: string | undefined,
  oldest: string | undefined,
): PollCursor {
  const advanced = pollingCursor(sentAt, serverTime)
  if (rowsLength < POLLING_TAKE) {
    return { since: cursor.pending ?? advanced, until: null, pending: null }
  }
  const until =
    oldest !== undefined &&
    (cursor.until === null || Date.parse(oldest) < Date.parse(cursor.until))
      ? oldest
      : (cursor.until ?? oldest ?? null)
  return {
    since: cursor.since,
    until,
    pending: cursor.pending ?? advanced,
  }
}

async function pollOnce(): Promise<void> {
  if (isSocketConnected()) return
  const sentAt = new Date().toISOString()
  const queryString = (cursor: PollCursor): string =>
    `since=${encodeURIComponent(cursor.since)}${
      cursor.until === null ? "" : `&until=${encodeURIComponent(cursor.until)}`
    }`

  const [postsRes, notificationsRes] = await Promise.all([
    api
      .get(`/social/polling/posts?${queryString(postsCursor)}`)
      .then((res) => pollingEnvelopeSchema.parse(res.data))
      .catch(() => null),
    api
      .get(`/social/polling/notifications?${queryString(notificationsCursor)}`)
      .then((res) => pollingEnvelopeSchema.parse(res.data))
      .catch(() => null),
  ])

  const posts = postsRes?.data.posts ?? []
  const notifications = notificationsRes?.data.notifications ?? []

  // Avança só o cursor do endpoint com sucesso — o mais antigo entre
  // envio e serverTime (revisão S), nunca o instante da resposta — e
  // drena o backlog de página cheia sem pular janela (revisão I-1).
  // Resposta malformada vira null (revisão R2): cursor intocado.
  if (postsRes !== null) {
    postsCursor = advanceCursor(
      postsCursor,
      posts.length,
      sentAt,
      postsRes.serverTime,
      oldestCreatedAt(posts),
    )
  }
  if (notificationsRes !== null) {
    notificationsCursor = advanceCursor(
      notificationsCursor,
      notifications.length,
      sentAt,
      notificationsRes.serverTime,
      oldestCreatedAt(notifications),
    )
  }

  // Conectou durante o poll — o WebSocket já entregou o que importa.
  if (isSocketConnected()) return

  for (const post of posts) {
    dispatch("new-post", {
      postId: post.id,
      authorId: post.authorId,
      preview: postPreview(post.content),
    })
  }

  for (const notification of notifications) {
    const payload: RealtimeEventMap["notification"] = {
      id: notification.id,
      type: notification.type,
      message: notification.message,
    }
    if (notification.data !== undefined && notification.data !== null) {
      payload.data = notification.data
    }
    dispatch("notification", payload)
  }
}

function acquire(): void {
  acquireCount += 1
  if (acquireCount !== 1) return
  connectWanted = true
  void connect()
  pollTimer = setInterval(() => {
    void pollOnce()
  }, POLL_INTERVAL_MS)
}

function release(): void {
  acquireCount = Math.max(0, acquireCount - 1)
  if (acquireCount !== 0) return
  connectWanted = false
  connectEpoch += 1
  clearReconnectTimer()
  reconnectFailures = 0
  if (pollTimer !== null) {
    clearInterval(pollTimer)
    pollTimer = null
  }
  if (socket !== null) {
    socket.disconnect()
    socket = null
  }
}

/**
 * Revisão T: derruba o singleton realtime (socket, polling, cursors) na
 * saída da sessão — logout/deleteAccount garantem que a sessão seguinte
 * nasce limpa, sem eventos/polls do usuário anterior. Não mexe em
 * `subscriptions` (hooks React vivos) nem em `acquireCount` (o unmount
 * normal reconcilia via `release`).
 */
export function resetRealtimeClient(): void {
  connectEpoch += 1
  connectWanted = false
  connecting = false
  clearReconnectTimer()
  reconnectFailures = 0
  if (pollTimer !== null) {
    clearInterval(pollTimer)
    pollTimer = null
  }
  if (socket !== null) {
    socket.disconnect()
    socket = null
  }
  postsCursor = INITIAL_CURSOR()
  notificationsCursor = INITIAL_CURSOR()
}

/** Testes: derruba o singleton entre os casos. */
export function resetSocketManagerForTests(): void {
  if (pollTimer !== null) {
    clearInterval(pollTimer)
    pollTimer = null
  }
  if (socket !== null) {
    socket.disconnect()
    socket = null
  }
  subscriptions.clear()
  acquireCount = 0
  connectWanted = false
  connecting = false
  connectEpoch += 1
  clearReconnectTimer()
  reconnectFailures = 0
  postsCursor = INITIAL_CURSOR()
  notificationsCursor = INITIAL_CURSOR()
}

export function useSocket(handlers: SocketHandlers = {}): void {
  const recordRef = useRef<HandlerRecord>({ handlers })

  useEffect(() => {
    recordRef.current.handlers = handlers
  }, [handlers])

  useEffect(() => {
    const record = recordRef.current
    subscriptions.add(record)
    acquire()
    return () => {
      subscriptions.delete(record)
      release()
    }
  }, [])
}
