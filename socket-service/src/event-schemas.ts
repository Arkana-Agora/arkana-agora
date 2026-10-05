import { z } from "zod"

import type { RealtimeEventName } from "./emitters"

// Revisão L: schema Zod do payload de cada evento do RealtimeEventMap.
// `satisfies Record<RealtimeEventName, …>` torna o conjunto EXAUSTIVO —
// adicionar um evento em RealtimeEventMap sem schema (ou sobrar schema)
// vira erro de compilación. O `emit()` valida antes do publish: payload
// inválido é descartado com warn em vez de ir ao wire.

const id = z.string().min(1)

export const realtimeEventSchemas = {
  "new-post": z.object({
    postId: id,
    authorId: id,
    preview: z.string().nullable(),
  }),
  "like-updated": z.object({
    postId: id,
    newCount: z.number(),
  }),
  "comment-added": z.object({
    postId: id,
    commentId: id,
    authorName: z.string(),
    text: z.string(),
  }),
  "comment-like-updated": z.object({
    commentId: id,
    postId: id,
    newCount: z.number(),
  }),
  "follow-update": z.object({
    followerId: id,
    followingId: id,
    isFollowing: z.boolean(),
  }),
  notification: z.object({
    id,
    type: z.string().min(1),
    message: z.string(),
    data: z.unknown().optional(),
  }),
  "gift-received": z.object({
    toUserId: id,
    fromUserId: id,
    giftId: id,
    giftName: z.string(),
  }),
} as const satisfies Record<RealtimeEventName, z.ZodType>
