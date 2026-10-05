// @vitest-environment node
// T074 — suíte de integração WebSocket: auth, rooms, eventos e reconexão.
// Auth/rooms/eventos já têm cobertura granular em
// websocket-server.test.ts / websocket-relay.test.ts; aqui validamos o
// ciclo completo de reconexão (T072/T066). O contrato de fallback
// (T071/T072) é coberto em polling.test.ts e use-socket.test.tsx.
// Helpers compartilhados: websocket-harness.ts (revisão X).
import type { AddressInfo } from "node:net"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import type { Socket as ClientSocket } from "socket.io-client"

import {
  createSocketServer,
  type SocketServerHandle,
} from "../../socket-service/src/server"
import { resetRealtimeBus } from "../../socket-service/src/bus"
import { emitNotification } from "../../socket-service/src/emitters"
import {
  connectClient,
  joinRoom,
  signToken,
  testEnv,
  waitDisconnect,
  waitForEvent,
} from "./websocket-harness"

describe("T074 — WebSocket integration: auth/rooms/events/reconnect", () => {
  let handle: SocketServerHandle
  let port: number
  const clients: ClientSocket[] = []

  beforeEach(async () => {
    delete process.env.REDIS_URL
    await resetRealtimeBus()
    handle = await createSocketServer({ env: testEnv })
    port = (handle.httpServer.address() as AddressInfo).port
  })

  afterEach(async () => {
    for (const socket of clients.splice(0)) {
      socket.disconnect()
    }
    await handle.close()
    await resetRealtimeBus()
  })

  it("auth: rejeita token expirado e aceita token valido", async () => {
    const expired = await connectClient(
      port,
      await signToken("usr_e", { expiresInSec: -60 }),
    )
    clients.push(expired.socket)
    expect(expired.error).toBeDefined()
    expect(expired.error!.message).toContain("Unauthorized")

    const valid = await connectClient(port, await signToken("usr_ok"))
    clients.push(valid.socket)
    expect(valid.error).toBeUndefined()
    expect(valid.socket.connected).toBe(true)
  })

  it("rooms: ack de join/leave e recusa de room de terceiros (S2)", async () => {
    const { socket } = await connectClient(port, await signToken("usr_rooms"))
    clients.push(socket)

    // comment: não tem endpoint de verificação (T077) → fail-closed
    // nega o join (S2 — revisão 2026-10-04).
    const denied = await joinRoom(socket, "comment:c1")
    expect(denied).toEqual({ ok: false, error: "room_forbidden" })

    const spoof = await joinRoom(socket, "feed:usr_outro")
    expect(spoof).toEqual({ ok: false, error: "room_forbidden" })
  })

  it("events: emitNotification chega só à room do destinatário", async () => {
    const target = await connectClient(port, await signToken("usr_tgt"))
    const bystander = await connectClient(port, await signToken("usr_by"))
    clients.push(target.socket, bystander.socket)

    const received = await waitForEvent<unknown>(
      target.socket,
      "notification",
      () =>
        emitNotification({
          userId: "usr_tgt",
          notification: { id: "n1", type: "follow", message: "oi" },
        }),
    )
    expect(received).toEqual([{ id: "n1", type: "follow", message: "oi" }])
    expect(bystander.socket.connected).toBe(true)
  })

  it("reconnect: drop do servidor → cliente reconecta, re-entra nas rooms e volta a receber eventos", async () => {
    const token = await signToken("usr_re")
    const { socket, error } = await connectClient(port, token, {
      reconnection: true,
    })
    clients.push(socket)
    expect(error).toBeUndefined()

    const firstId = socket.id
    const firstServer = handle.io.sockets.sockets.get(firstId!)
    expect(firstServer).toBeDefined()

    // Drop abrupto do transporte no servidor (sem packet DISCONNECT do
    // socket.io — motivo "transport close" → auto-reconnect do cliente)
    const engine = firstServer!.conn as unknown as {
      transport: { socket?: { terminate?: () => void; destroy?: () => void } }
    }
    const waitReconnect = new Promise<void>((resolve) => {
      socket.once("connect", () => resolve())
      setTimeout(resolve, 3000)
    })
    const disconnected = waitDisconnect(socket)
    if (engine.transport.socket?.terminate) {
      engine.transport.socket.terminate()
    } else {
      engine.transport.socket?.destroy?.()
    }
    await disconnected
    await waitReconnect
    expect(socket.connected).toBe(true)
    expect(socket.id).not.toBe(firstId)

    // Nova sessão recebe auto-join das rooms autorais
    const secondServer = handle.io.sockets.sockets.get(socket.id!)
    expect(secondServer).toBeDefined()
    expect(secondServer!.rooms.has("user:usr_re")).toBe(true)
    expect(secondServer!.rooms.has("feed:usr_re")).toBe(true)

    // Eventos voltam a fluir na nova sessão
    const received = await waitForEvent<unknown>(socket, "notification", () =>
      emitNotification({
        userId: "usr_re",
        notification: { id: "n2", type: "like", message: "curtiu" },
      }),
    )
    expect(received).toEqual([{ id: "n2", type: "like", message: "curtiu" }])
  })
})
