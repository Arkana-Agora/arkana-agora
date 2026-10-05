import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const publishMock = vi.hoisted(() => vi.fn())
const warnMock = vi.hoisted(() => vi.fn())

vi.mock("../../socket-service/src/bus", () => ({
  publishRealtime: publishMock,
}))
vi.mock("@/lib/prisma", () => ({
  prisma: { follow: { findMany: vi.fn().mockResolvedValue([]) } },
}))
vi.mock("@/lib/logger", () => ({ logger: { warn: warnMock } }))

import {
  emitCommentAdded,
  emitGiftReceived,
  emitLikeUpdated,
  emitNewPost,
} from "../../socket-service/src/emitters"
import { realtimeEventSchemas } from "../../socket-service/src/event-schemas"
import type { RealtimeEventName } from "../../socket-service/src/emitters"

// Revisao L: payload de cada evento do RealtimeEventMap tem schema Zod
// (validado no publish) e o conjunto de schemas é exaustivo — adicionar
// um evento sem schema vira erro de compilacao.

describe("realtimeEventSchemas (revisao L)", () => {
  it("cobre exatamente todos os nomes de RealtimeEventMap", () => {
    expect([...Object.keys(realtimeEventSchemas)].sort()).toEqual(
      [
        "comment-added",
        "comment-like-updated",
        "follow-update",
        "gift-received",
        "like-updated",
        "new-post",
        "notification",
      ].sort(),
    )
    const names: RealtimeEventName[] = [
      "new-post",
      "like-updated",
      "comment-added",
      "comment-like-updated",
      "follow-update",
      "notification",
      "gift-received",
    ]
    for (const name of names) {
      expect(realtimeEventSchemas[name]).toBeDefined()
    }
  })

  it("valida payloads corretos e rejeita payloads inválidos", () => {
    expect(
      realtimeEventSchemas["new-post"].safeParse({
        postId: "p1",
        authorId: "u1",
        preview: null,
      }).success,
    ).toBe(true)
    expect(
      realtimeEventSchemas["new-post"].safeParse({ postId: "p1" }).success,
    ).toBe(false)
    expect(
      realtimeEventSchemas["like-updated"].safeParse({
        postId: "p1",
        newCount: "sete",
      }).success,
    ).toBe(false)
    expect(
      realtimeEventSchemas.notification.safeParse({
        id: "n1",
        type: "follow",
        message: "oi",
        data: { extra: true },
      }).success,
    ).toBe(true)
  })
})

describe("emit valida payload antes do publish (revisao L)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it("payload válido é publicado normalmente", async () => {
    await emitLikeUpdated({ postId: "p1", newCount: 3 })
    expect(publishMock).toHaveBeenCalledWith({
      event: "like-updated",
      rooms: ["post:p1"],
      payload: { postId: "p1", newCount: 3 },
    })
  })

  it("payload inválido é descartado com warn, sem publish", async () => {
    await emitLikeUpdated({
      postId: "p1",
      newCount: "sete",
    } as unknown as { postId: string; newCount: number })
    expect(publishMock).not.toHaveBeenCalled()
    expect(warnMock).toHaveBeenCalled()
  })

  it("emitNewPost com input inválido não publica", async () => {
    await emitNewPost({
      authorId: "u1",
      postId: "p9",
      preview: 123 as unknown as string | null,
    })
    expect(publishMock).not.toHaveBeenCalled()
  })

  it("emitCommentAdded mantém contrato completo no payload", async () => {
    await emitCommentAdded({
      postId: "p1",
      commentId: "c1",
      authorName: "Ana",
      text: "oi",
      postAuthorId: "u9",
    })
    expect(publishMock).toHaveBeenCalledWith({
      event: "comment-added",
      rooms: ["post:p1", "user:u9"],
      payload: {
        postId: "p1",
        commentId: "c1",
        authorName: "Ana",
        text: "oi",
      },
    })
  })

  it("emitGiftReceived mantém toUserId no payload", async () => {
    await emitGiftReceived({
      toUserId: "u1",
      fromUserId: "u2",
      giftId: "g1",
      giftName: "Vela",
    })
    expect(publishMock).toHaveBeenCalledWith({
      event: "gift-received",
      rooms: ["user:u1"],
      payload: {
        toUserId: "u1",
        fromUserId: "u2",
        giftId: "g1",
        giftName: "Vela",
      },
    })
  })
})
