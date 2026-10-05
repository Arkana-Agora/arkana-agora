// @vitest-environment node
import type { AddressInfo } from "node:net"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import type { Socket as ClientSocket } from "socket.io-client"

import {
  createSocketServer,
  type SocketServerHandle,
} from "../../socket-service/src/server"
import { resetRealtimeBus } from "../../socket-service/src/bus"
import { emitLikeUpdated } from "../../socket-service/src/emitters"
import {
  connectClient,
  joinRoom,
  signToken,
  testEnv,
} from "./websocket-harness"

describe("bus relay: emitter → servidor → cliente (T066/T070)", () => {
  let handle: SocketServerHandle
  let port: number
  const clients: ClientSocket[] = []

  beforeEach(async () => {
    delete process.env.REDIS_URL
    await resetRealtimeBus()
    handle = await createSocketServer({
      env: testEnv,
      // S2: verificador injetado — relay não depende da API do Next
      roomAccess: { verify: async () => true },
    })
    port = (handle.httpServer.address() as AddressInfo).port
  })

  afterEach(async () => {
    for (const socket of clients.splice(0)) {
      socket.disconnect()
    }
    await handle.close()
    await resetRealtimeBus()
  })

  it("emitLikeUpdated chega a quem está na room post:{id}", async () => {
    const { socket: inRoom } = await connectClient(
      port,
      await signToken("usr_a"),
    )
    const { socket: outRoom } = await connectClient(
      port,
      await signToken("usr_b"),
    )
    clients.push(inRoom, outRoom)
    await joinRoom(inRoom, "post:p1")

    const receivedIn: unknown[] = []
    const receivedOut: unknown[] = []
    inRoom.on("like-updated", (payload: unknown) => receivedIn.push(payload))
    outRoom.on("like-updated", (payload: unknown) => receivedOut.push(payload))

    await emitLikeUpdated({ postId: "p1", newCount: 7 })

    await new Promise((r) => setTimeout(r, 150))
    expect(receivedIn).toEqual([{ postId: "p1", newCount: 7 }])
    expect(receivedOut).toEqual([])
  })

  it("emitNewPost chega ao seguidor nas rooms user:/feed: autorais", async () => {
    const { socket: follower } = await connectClient(
      port,
      await signToken("usr_f"),
    )
    const { socket: other } = await connectClient(
      port,
      await signToken("usr_o"),
    )
    clients.push(follower, other)

    const received: unknown[] = []
    const otherReceived: unknown[] = []
    follower.on("new-post", (payload: unknown) => received.push(payload))
    other.on("new-post", (payload: unknown) => otherReceived.push(payload))

    // sem prisma no relay: mock via publish direto do emitter é coberto no
    // realtime-bus; aqui validamos o caminho room → socket.
    const { publishRealtime } = await import("../../socket-service/src/bus")
    await publishRealtime({
      event: "new-post",
      rooms: ["user:usr_f", "feed:usr_f"],
      payload: { postId: "p1", authorId: "usr_x", preview: "oi" },
    })

    await new Promise((r) => setTimeout(r, 150))
    expect(received).toEqual([
      { postId: "p1", authorId: "usr_x", preview: "oi" },
    ])
    expect(otherReceived).toEqual([])
  })

  it("rooms vazias não entregam para ninguém (guard do relay)", async () => {
    const { socket: a } = await connectClient(port, await signToken("usr_e1"))
    const { socket: b } = await connectClient(port, await signToken("usr_e2"))
    clients.push(a, b)

    const receivedA: unknown[] = []
    const receivedB: unknown[] = []
    a.on("like-updated", (payload: unknown) => receivedA.push(payload))
    b.on("like-updated", (payload: unknown) => receivedB.push(payload))

    const { publishRealtime } = await import("../../socket-service/src/bus")
    await publishRealtime({
      event: "like-updated",
      rooms: [],
      payload: { postId: "p1", newCount: 1 },
    })

    await new Promise((r) => setTimeout(r, 150))
    expect(receivedA).toEqual([])
    expect(receivedB).toEqual([])
  })

  it("relay ignora eventos fora do allowlist (revisao N)", async () => {
    const { socket: client } = await connectClient(
      port,
      await signToken("usr_allow"),
    )
    clients.push(client)

    const received: unknown[] = []
    client.on("mystery-event", (payload: unknown) => received.push(payload))

    const { publishRealtime } = await import("../../socket-service/src/bus")
    await publishRealtime({
      event: "mystery-event",
      rooms: ["user:usr_allow"],
      payload: { qualquer: true },
    })

    await new Promise((r) => setTimeout(r, 150))
    expect(received).toEqual([])
  })

  it("relay valida payload contra o schema do evento (revisao N)", async () => {
    const { socket: client } = await connectClient(
      port,
      await signToken("usr_val"),
    )
    clients.push(client)
    await joinRoom(client, "post:p1")

    const received: unknown[] = []
    client.on("like-updated", (payload: unknown) => received.push(payload))

    const { publishRealtime } = await import("../../socket-service/src/bus")
    await publishRealtime({
      event: "like-updated",
      rooms: ["post:p1"],
      payload: { postId: "p1", newCount: "sete" },
    })
    await publishRealtime({
      event: "like-updated",
      rooms: ["post:p1"],
      payload: { postId: "p1", newCount: 7 },
    })

    await new Promise((r) => setTimeout(r, 150))
    expect(received).toEqual([{ postId: "p1", newCount: 7 }])
  })
})
