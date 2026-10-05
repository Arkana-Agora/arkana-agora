// Harness compartilhado dos testes de integração WebSocket (revisão X) —
// keypair/env, assinatura de JWT RS256 e helpers de cliente. Extraído de
// websocket{,-server,-relay}.test.ts (~150 linhas duplicadas).
import { generateKeyPairSync, type KeyObject } from "node:crypto"
import { SignJWT } from "jose"
import { io as ioClient, type Socket as ClientSocket } from "socket.io-client"

import type { SocketEnv } from "../../socket-service/src/lib/env"

const { publicKey, privateKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
})

export const JWT_PUBLIC_KEY = publicKey.export({
  type: "spki",
  format: "pem",
}) as string

export const testEnv: SocketEnv = {
  SOCKET_PORT: 0,
  AUTH_URL: "http://localhost:3000",
  JWT_PUBLIC_KEY,
  ACCESS_TOKEN_TTL_SECONDS: 900,
}

export async function signToken(
  sub: string,
  options: {
    key?: KeyObject
    tokenVersion?: number
    expiresInSec?: number
  } = {},
): Promise<string> {
  const { key = privateKey, tokenVersion = 1, expiresInSec = 300 } = options
  return new SignJWT({ tokenVersion, role: "USER", plan: "FREE" })
    .setProtectedHeader({ alg: "RS256" })
    .setSubject(sub)
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + expiresInSec)
    .sign(key)
}

export function connectClient(
  port: number,
  token?: string,
  opts: { reconnection?: boolean } = {},
): Promise<{ socket: ClientSocket; error?: Error }> {
  return new Promise((resolve) => {
    const socket = ioClient(`http://127.0.0.1:${port}`, {
      ...(token !== undefined ? { auth: { token } } : {}),
      transports: ["websocket"],
      reconnection: opts.reconnection ?? false,
      reconnectionDelay: 50,
      reconnectionDelayMax: 100,
      timeout: 3000,
    })
    socket.on("connect", () => resolve({ socket }))
    socket.on("connect_error", (err: Error) => resolve({ socket, error: err }))
  })
}

export function joinRoom(
  socket: ClientSocket,
  room: string,
): Promise<{ ok: boolean; error?: string }> {
  return new Promise((resolve) => {
    socket.emit("room:join", room, (res: { ok: boolean; error?: string }) =>
      resolve(res),
    )
    setTimeout(() => resolve({ ok: false, error: "timeout" }), 3000)
  })
}

export function leaveRoom(
  socket: ClientSocket,
  room: string,
): Promise<{ ok: boolean; error?: string }> {
  return new Promise((resolve) => {
    socket.emit("room:leave", room, (res: { ok: boolean; error?: string }) =>
      resolve(res),
    )
    setTimeout(() => resolve({ ok: false, error: "timeout" }), 3000)
  })
}

export function waitDisconnect(
  socket: ClientSocket,
  ms = 4000,
): Promise<string> {
  return Promise.race([
    new Promise<string>((resolve) => {
      socket.on("disconnect", (reason: string) => resolve(reason))
    }),
    new Promise<string>((_, reject) =>
      setTimeout(() => reject(new Error("timeout")), ms),
    ),
  ])
}

export function waitForEvent<T>(
  socket: ClientSocket,
  event: string,
  emit: () => Promise<void>,
  timeoutMs = 3000,
): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const received: T[] = []
    const timer = setTimeout(
      () => reject(new Error(`timeout esperando ${event}`)),
      timeoutMs,
    )
    socket.on(event, (payload: T) => {
      received.push(payload)
      clearTimeout(timer)
      resolve(received)
    })
    void emit().catch(reject)
  })
}
