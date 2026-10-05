// @vitest-environment node
import { generateKeyPairSync } from "node:crypto"
import type { AddressInfo } from "node:net"
import { SignJWT } from "jose"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { io as ioClient, type Socket as ClientSocket } from "socket.io-client"

const pinoWarnMock = vi.hoisted(() => vi.fn())
vi.mock("pino", () => ({
  pino: () => ({
    warn: pinoWarnMock,
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}))

import {
  createSocketServer,
  type SocketServerHandle,
} from "../../socket-service/src/server"
import type { SocketEnv } from "../../socket-service/src/lib/env"
import { resetRealtimeBus } from "../../socket-service/src/bus"
import { resetHandshakeLimitForTests } from "../../socket-service/src/handshake-limit"

const { publicKey, privateKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
})

const JWT_PUBLIC_KEY = publicKey.export({
  type: "spki",
  format: "pem",
}) as string

const testEnv: SocketEnv = {
  SOCKET_PORT: 0,
  AUTH_URL: "http://localhost:3000",
  JWT_PUBLIC_KEY,
  ACCESS_TOKEN_TTL_SECONDS: 900,
}

async function signToken(sub: string): Promise<string> {
  return new SignJWT({ tokenVersion: 1, role: "USER", plan: "FREE" })
    .setProtectedHeader({ alg: "RS256" })
    .setSubject(sub)
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + 300)
    .sign(privateKey)
}

function connectClient(
  port: number,
  token?: string,
): Promise<{ socket: ClientSocket; error?: Error }> {
  return new Promise((resolve) => {
    const socket = ioClient(`http://127.0.0.1:${port}`, {
      ...(token !== undefined ? { auth: { token } } : {}),
      transports: ["websocket"],
      reconnection: false,
      timeout: 3000,
    })
    socket.on("connect", () => resolve({ socket }))
    socket.on("connect_error", (err: Error) => resolve({ socket, error: err }))
  })
}

describe("handshake rate limit + logs de falha (importante/segurança)", () => {
  let handle: SocketServerHandle
  let port: number
  const clients: ClientSocket[] = []

  beforeEach(async () => {
    delete process.env.REDIS_URL
    await resetRealtimeBus()
    resetHandshakeLimitForTests()
    pinoWarnMock.mockClear()
    handle = await createSocketServer({
      env: testEnv,
      handshakeRateLimit: { max: 3, windowMs: 60_000 },
    })
    const address = handle.httpServer.address() as AddressInfo
    port = address.port
  })

  afterEach(async () => {
    for (const socket of clients.splice(0)) {
      socket.disconnect()
    }
    await handle.close()
    await resetRealtimeBus()
    resetHandshakeLimitForTests()
  })

  it("4ª tentativa de handshake na mesma janela é bloqueada", async () => {
    const token = await signToken("usr_rl")
    for (let i = 0; i < 3; i += 1) {
      const { socket, error } = await connectClient(port, token)
      clients.push(socket)
      expect(error).toBeUndefined()
    }

    const { socket, error } = await connectClient(port, token)
    clients.push(socket)
    expect(error).toBeDefined()
    expect(error!.message).toContain("rate_limited")
  })

  it("falha de auth loga warn estruturado com ip e reason", async () => {
    const { socket, error } = await connectClient(port)
    clients.push(socket)
    expect(error).toBeDefined()
    expect(error!.message).toContain("Unauthorized")

    expect(pinoWarnMock).toHaveBeenCalledWith(
      { ip: expect.any(String), reason: "token_ausente" },
      "[socket-auth] handshake recusado",
    )
  })
})
