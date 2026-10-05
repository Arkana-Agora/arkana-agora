import { prisma } from "@/lib/prisma"
import { logger } from "@/lib/logger"
import { publishRealtime } from "./bus"
import { realtimeEventSchemas } from "./event-schemas"

// [fronteira I-c] Carregado APENAS pelo Next.js (rotas importam
// @socket/src/emitters; o alias @/ resolve no app). NAO faz parte do
// runtime closure do socket-service — a imagem Docker copia so
// socket-service/ e o closure nunca importa este arquivo como valor
// (event-schemas so usa `import type`) — ver
// tests/unit/socket-service-boundary.test.ts.

// Event emitters do realtime social (plano T070). São chamados pelas
// rotas do Next.js (T088 e afins) e publicam no Event Bus
// (socket-service/src/bus.ts); o socket-service assina e repassa para as
// rooms. Fire-and-forget: nunca lançam — falha de bus/DB não pode derrubar
// a ação de negócio que disparou o emit.

export interface NewPostEvent {
  postId: string
  authorId: string
  preview: string | null
}

export interface LikeUpdatedEvent {
  postId: string
  newCount: number
}

export interface CommentAddedEvent {
  postId: string
  commentId: string
  authorName: string
  text: string
}

export interface CommentLikeUpdatedEvent {
  commentId: string
  postId: string
  newCount: number
}

export interface FollowUpdateEvent {
  followerId: string
  followingId: string
  isFollowing: boolean
}

export interface NotificationEvent {
  id: string
  type: string
  message: string
  data?: unknown
}

export interface GiftReceivedEvent {
  fromUserId: string
  giftId: string
  giftName: string
}

export interface RealtimeEventMap {
  "new-post": NewPostEvent
  "like-updated": LikeUpdatedEvent
  "comment-added": CommentAddedEvent
  "comment-like-updated": CommentLikeUpdatedEvent
  "follow-update": FollowUpdateEvent
  notification: NotificationEvent
  "gift-received": GiftReceivedEvent & { toUserId: string }
}

export type RealtimeEventName = keyof RealtimeEventMap

// Revisão R2: payload tipado por evento (`RealtimeEventMap[E]`) — passar a
// forma errada para um evento vira erro de compilação em vez de warn em
// runtime (o zod continua validando na fronteira).
async function emit<E extends RealtimeEventName>(
  event: E,
  rooms: string[],
  payload: RealtimeEventMap[E],
): Promise<void> {
  // Revisão L: valida contra o schema do evento — payload inválido nunca
  // chega ao wire (descarta com warn; fire-and-forget preservado).
  const parsed = realtimeEventSchemas[event].safeParse(payload)
  if (!parsed.success) {
    logger.warn(
      { event, issues: parsed.error.issues },
      "[realtime] payload invalido descartado",
    )
    return
  }
  await publishRealtime({ event, rooms, payload: parsed.data })
}

// Teto de fan-out por new-post (Citico 6): alem disso o conjunto de
// rooms cresce sem controle (1 seguidor = 2 rooms) e o relay faria
// fetchSockets por sala em cada instancia. Seguidores alem do teto
// recebem o post via feed refresh/polling (T071) - degradacao aceita.
const MAX_FANOUT_FOLLOWERS = 500

export async function emitNewPost(input: {
  authorId: string
  postId: string
  preview: string | null
}): Promise<void> {
  try {
    // T070/T088: rooms dos SEGUIDORES do autor — quem segue o autor recebe
    // new-post nas rooms autorais user:{followerId}/feed:{followerId}.
    const followers = await prisma.follow.findMany({
      where: { followingId: input.authorId },
      select: { followerId: true },
      orderBy: { followerId: "asc" },
      take: MAX_FANOUT_FOLLOWERS,
    })
    if (followers.length >= MAX_FANOUT_FOLLOWERS) {
      logger.warn(
        { authorId: input.authorId, max: MAX_FANOUT_FOLLOWERS },
        "[realtime] fan-out de new-post no teto - excedentes via polling",
      )
    }
    const rooms = new Set<string>()
    for (const follower of followers.slice(0, MAX_FANOUT_FOLLOWERS)) {
      rooms.add(`user:${follower.followerId}`)
      rooms.add(`feed:${follower.followerId}`)
    }
    await emit("new-post", [...rooms], {
      postId: input.postId,
      authorId: input.authorId,
      preview: input.preview,
    })
  } catch (err) {
    logger.warn(
      { err, authorId: input.authorId },
      "[realtime] emitNewPost falhou",
    )
  }
}

export async function emitLikeUpdated(input: {
  postId: string
  newCount: number
}): Promise<void> {
  await emit("like-updated", [`post:${input.postId}`], {
    postId: input.postId,
    newCount: input.newCount,
  })
}

export async function emitCommentAdded(input: {
  postId: string
  commentId: string
  authorName: string
  text: string
  postAuthorId?: string
}): Promise<void> {
  const rooms = [`post:${input.postId}`]
  if (input.postAuthorId !== undefined) {
    rooms.push(`user:${input.postAuthorId}`)
  }
  await emit("comment-added", rooms, {
    postId: input.postId,
    commentId: input.commentId,
    authorName: input.authorName,
    text: input.text,
  })
}

export async function emitCommentLikeUpdated(input: {
  commentId: string
  postId: string
  newCount: number
}): Promise<void> {
  await emit("comment-like-updated", [`post:${input.postId}`], {
    commentId: input.commentId,
    postId: input.postId,
    newCount: input.newCount,
  })
}

export async function emitFollowUpdate(input: {
  followerId: string
  followingId: string
  isFollowing: boolean
}): Promise<void> {
  await emit("follow-update", [`user:${input.followingId}`], {
    followerId: input.followerId,
    followingId: input.followingId,
    isFollowing: input.isFollowing,
  })
}

export async function emitNotification(input: {
  userId: string
  notification: NotificationEvent
}): Promise<void> {
  await emit("notification", [`user:${input.userId}`], input.notification)
}

export async function emitGiftReceived(input: {
  toUserId: string
  fromUserId: string
  giftId: string
  giftName: string
}): Promise<void> {
  await emit("gift-received", [`user:${input.toUserId}`], {
    toUserId: input.toUserId,
    fromUserId: input.fromUserId,
    giftId: input.giftId,
    giftName: input.giftName,
  })
}
