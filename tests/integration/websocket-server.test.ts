// @vitest-environment node
import { generateKeyPairSync } from "node:crypto"
import type { AddressInfo } from "node:net"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { Socket as ClientSocket } from "socket.io-client"

import {
  createSocketServer,
  type SocketServerHandle,
} from "../../socket-service/src/server"
import { resetRealtimeBus, publishAuthKick } from "../../socket-service/src/bus"
import {
  connectClient,
  joinRoom,
  leaveRoom,
  signToken,
  testEnv,
  waitDisconnect,
} from "./websocket-harness"

const getCachedTokenVersionMock = vi.hoisted(() => vi.fn())
vi.mock("../../socket-service/src/redis-auth", () => ({
  getCachedTokenVersion: getCachedTokenVersionMock,
  configureRedisAuth: vi.fn(),
}))

describe("socket-service server (T066)", () => {
  let handle: SocketServerHandle
  let port: number
  const clients: ClientSocket[] = []

  beforeEach(async () => {
    // Sem REDIS_URL no process.env: bus em memória + sem redis adapter
    delete process.env.REDIS_URL
    await resetRealtimeBus()
    getCachedTokenVersionMock.mockReset()
    getCachedTokenVersionMock.mockResolvedValue(null)
    handle = await createSocketServer({
      env: testEnv,
      revalidateIntervalMs: 250,
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
  })

  it("responde GET /health com 200 e status ok", async () => {
    const res = await fetch(`http://127.0.0.1:${port}/health`)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ status: "ok" })
  })

  it("conecta com token RS256 valido e auto-entra em user:/feed: rooms", async () => {
    const token = await signToken("usr_victim_guard")
    const { socket, error } = await connectClient(port, token)
    clients.push(socket)
    expect(error).toBeUndefined()
    expect(socket.connected).toBe(true)

    const serverSocket = handle.io.sockets.sockets.get(socket.id!)
    expect(serverSocket).toBeDefined()
    expect(serverSocket!.rooms.has("user:usr_victim_guard")).toBe(true)
    expect(serverSocket!.rooms.has("feed:usr_victim_guard")).toBe(true)
    expect(serverSocket!.data.userId).toBe("usr_victim_guard")
  })

  it("rejeita conexao sem token", async () => {
    const { socket, error } = await connectClient(port)
    clients.push(socket)
    expect(error).toBeDefined()
    expect(error!.message).toContain("Unauthorized")
  })

  it("rejeita token assinado por outra chave", async () => {
    const other = generateKeyPairSync("rsa", { modulusLength: 2048 })
    const token = await signToken("usr_x", { key: other.privateKey })
    const { socket, error } = await connectClient(port, token)
    clients.push(socket)
    expect(error).toBeDefined()
    expect(error!.message).toContain("Unauthorized")
  })

  it("aceita room:join de post: via ack e nega comment: sem endpoint (S2)", async () => {
    const own = await createSocketServer({
      env: testEnv,
      // Verificador injetado: post: visível; comment: sem endpoint (T077)
      roomAccess: {
        verify: async (input) => input.room.startsWith("post:"),
      },
    })
    try {
      const ownPort = (own.httpServer.address() as AddressInfo).port
      const token = await signToken("usr_joiner")
      const { socket, error } = await connectClient(ownPort, token)
      clients.push(socket)
      expect(error).toBeUndefined()

      const res = await joinRoom(socket, "post:p1")
      expect(res).toEqual({ ok: true })

      const serverSocket = own.io.sockets.sockets.get(socket.id!)
      expect(serverSocket!.rooms.has("post:p1")).toBe(true)

      // S2: comment: sem endpoint de verificação → fail-closed nega
      expect(await joinRoom(socket, "comment:c1")).toEqual({
        ok: false,
        error: "room_forbidden",
      })

      const leave = await leaveRoom(socket, "post:p1")
      expect(leave.ok).toBe(true)
      expect(own.io.sockets.sockets.get(socket.id!)!.rooms.has("post:p1")).toBe(
        false,
      )
    } finally {
      await own.close()
    }
  })

  it("recusa room:join de user:/feed: de terceiros (anti-spoof)", async () => {
    const token = await signToken("usr_attacker")
    const { socket, error } = await connectClient(port, token)
    clients.push(socket)
    expect(error).toBeUndefined()

    const res = await joinRoom(socket, "user:usr_outro")
    expect(res.ok).toBe(false)
    expect(res.error).toBe("room_forbidden")

    const serverSocket = handle.io.sockets.sockets.get(socket.id!)
    expect(serverSocket!.rooms.has("user:usr_outro")).toBe(false)
    // as próprias rooms autorais continuam presentes
    expect(serverSocket!.rooms.has("user:usr_attacker")).toBe(true)
  })

  it("kick: publishAuthKick desconecta o socket do usuário alvo", async () => {
    const token = await signToken("usr_kick_target")
    const { socket, error } = await connectClient(port, token)
    clients.push(socket)
    expect(error).toBeUndefined()
    expect(socket.connected).toBe(true)

    const disconnected = new Promise<string>((resolve) => {
      socket.on("disconnect", (reason: string) => resolve(reason))
    })
    await publishAuthKick("usr_kick_target")

    const reason = await Promise.race([
      disconnected,
      new Promise<string>((_, reject) =>
        setTimeout(() => reject(new Error("timeout")), 3000),
      ),
    ])
    expect(reason).toBeDefined()
    expect(socket.connected).toBe(false)
  })

  it("kick de outro usuário não derruba a conexão", async () => {
    const token = await signToken("usr_stays")
    const { socket, error } = await connectClient(port, token)
    clients.push(socket)
    expect(error).toBeUndefined()

    const disconnected = vi.fn()
    socket.on("disconnect", disconnected)
    await publishAuthKick("usr_other")
    await new Promise((resolve) => setTimeout(resolve, 150))
    expect(disconnected).not.toHaveBeenCalled()
    expect(socket.connected).toBe(true)
  })

  it("revalidação: tokenVersion divergente no cache derruba a conexão", async () => {
    getCachedTokenVersionMock.mockResolvedValueOnce(1) // handshake: match
    const token = await signToken("usr_revoke_me", { tokenVersion: 1 })
    const { socket, error } = await connectClient(port, token)
    clients.push(socket)
    expect(error).toBeUndefined()
    expect(socket.connected).toBe(true)

    // bumpTokenVersion do token-service espelhou 2 — claim 1 está revogada
    getCachedTokenVersionMock.mockResolvedValue(2)
    await waitDisconnect(socket)
    expect(socket.connected).toBe(false)
  })

  it("revalidação: socket com token expirado é desconectado", async () => {
    const token = await signToken("usr_expires", { expiresInSec: 1 })
    const { socket, error } = await connectClient(port, token)
    clients.push(socket)
    expect(error).toBeUndefined()
    expect(socket.connected).toBe(true)

    await waitDisconnect(socket)
    expect(socket.connected).toBe(false)
  })
})

describe("room:join - visibilidade e cap (revisao M)", () => {
  const extraClients: ClientSocket[] = []

  afterEach(async () => {
    for (const socket of extraClients.splice(0)) {
      socket.disconnect()
    }
  })

  it("verify=false nega join de post: com room_forbidden", async () => {
    const h = await createSocketServer({
      env: testEnv,
      roomAccess: { verify: async () => false },
    })
    try {
      const port = (h.httpServer.address() as AddressInfo).port
      const { socket } = await connectClient(port, await signToken("usr_vis"))
      extraClients.push(socket)
      expect(await joinRoom(socket, "post:p1")).toEqual({
        ok: false,
        error: "room_forbidden",
      })
    } finally {
      await h.close()
    }
  })

  it("cap de rooms por socket: room_cap e libera vaga ao sair", async () => {
    const h = await createSocketServer({
      env: testEnv,
      roomAccess: { verify: async () => true, maxRooms: 2 },
    })
    try {
      const port = (h.httpServer.address() as AddressInfo).port
      const { socket } = await connectClient(port, await signToken("usr_cap"))
      extraClients.push(socket)

      expect(await joinRoom(socket, "post:a")).toEqual({ ok: true })
      expect(await joinRoom(socket, "post:b")).toEqual({ ok: true })
      expect(await joinRoom(socket, "post:c")).toEqual({
        ok: false,
        error: "room_cap",
      })

      expect(await leaveRoom(socket, "post:a")).toEqual({ ok: true })
      expect(await joinRoom(socket, "post:d")).toEqual({ ok: true })
    } finally {
      await h.close()
    }
  })

  it("re-join da mesma room e idempotente e nao consome vaga", async () => {
    const h = await createSocketServer({
      env: testEnv,
      roomAccess: { verify: async () => true, maxRooms: 1 },
    })
    try {
      const port = (h.httpServer.address() as AddressInfo).port
      const { socket } = await connectClient(port, await signToken("usr_idem"))
      extraClients.push(socket)

      expect(await joinRoom(socket, "post:a")).toEqual({ ok: true })
      expect(await joinRoom(socket, "post:a")).toEqual({ ok: true })
      expect(await joinRoom(socket, "post:b")).toEqual({
        ok: false,
        error: "room_cap",
      })
    } finally {
      await h.close()
    }
  })

  it("verify=null nega join com room_forbidden (fail-closed — S2)", async () => {
    const h = await createSocketServer({
      env: testEnv,
      roomAccess: { verify: async () => null },
    })
    try {
      const port = (h.httpServer.address() as AddressInfo).port
      const { socket } = await connectClient(port, await signToken("usr_null"))
      extraClients.push(socket)
      expect(await joinRoom(socket, "post:p1")).toEqual({
        ok: false,
        error: "room_forbidden",
      })
    } finally {
      await h.close()
    }
  })

  it("dois room:join em voo nao ultrapassam o cap (corrida check-then-act — S2)", async () => {
    let started = 0
    let release: () => void = () => {}
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const h = await createSocketServer({
      env: testEnv,
      roomAccess: {
        verify: async () => {
          started += 1
          if (started === 2) release()
          await gate
          return true
        },
        maxRooms: 1,
      },
    })
    try {
      const port = (h.httpServer.address() as AddressInfo).port
      const { socket } = await connectClient(port, await signToken("usr_race"))
      extraClients.push(socket)

      const both = Promise.all([
        joinRoom(socket, "post:a"),
        joinRoom(socket, "post:b"),
      ])
      const results = await both
      expect(results.filter((r) => r.ok === true)).toHaveLength(1)
      expect(results.filter((r) => r.error === "room_cap")).toHaveLength(1)
    } finally {
      await h.close()
    }
  })
})
