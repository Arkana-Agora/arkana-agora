"use client"

import { create } from "zustand"

/**
 * Comentário serializado (shape do serializer T077/T078 — `content`, não
 * `text`).
 */
export interface SocialComment {
  id: string
  postId: string
  content: string
  likeCount: number
  /**
   * Revsao R6: o `liked` de comentario existia so no client. Enviado pelo
   * GET /comments; opcional porque comentarios otimistas nao o carregam.
   * `| undefined` explicito exigido por `exactOptionalPropertyTypes` (o
   * `.optional()` do Zod produz `undefined` explicito).
   */
  viewerHasLiked?: boolean | undefined
  parentCommentId: string | null
  createdAt: string
  author: {
    id: string
    name: string
    displayName: string | null
    avatar: string | null
  }
  replies?: SocialComment[]
}

/** Overlay otimista de like por postId (plano:95 "optimistic helpers"). */
export interface PostLikeOverlay {
  liked: boolean
  likeCount: number
}

/** Overlay otimista de like de comentário por commentId. */
export interface CommentLikeOverlay {
  liked: boolean
  likeCount: number
}

/** Notificação otimista para atualização imediata de UI. */
export interface NotificationOptimistic {
  id: string
  isRead: boolean
}

interface SocialState {
  /** Overlay por postId — o feed em si é dos hooks useFeed (NÃO feedPosts). */
  postLikes: Record<string, PostLikeOverlay>
  /** Overlay de like de comentário por commentId. */
  commentLikes: Record<string, CommentLikeOverlay>
  /** Comentários novos por postId (dedup por id) — base da CommentSection. */
  postComments: Record<string, SocialComment[]>
  /** Overlay de notificações para atualização otimista de leitura. */
  notifications: Record<string, { id: string; isRead: boolean }>
  /** Contagem otimista de notificações não lidas. */
  unreadCount: number
}

interface SocialActions {
  updatePostLike: (
    postId: string,
    liked: boolean | undefined,
    likeCount: number,
  ) => void
  updateCommentLike: (
    commentId: string,
    liked: boolean | undefined,
    likeCount: number,
  ) => void
  addCommentToPost: (postId: string, comment: SocialComment) => void
  /**
   * Limpa o overlay de likes de posts — chamado quando `["feed"]`
   * refetcha, para a verdade do servidor (contadores/liked) vencer o
   * `overlay ?? server`.
   */
  clearPostOverlays: () => void
  /**
   * Remove da lista otimista de UM post os comentários que o refetch de
   * `["comments", postId]` já trouxe do servidor (agora redundantes — o dedup
   * de render já os esconde, mas a lista cresceria sem limite). Comentários
   * otimistas ainda ausentes do refetch são preservados, então não há flicker
   * nem corrida com um POST em voo.
   * Apenas remove comentários com createdAt ANTES do mais antigo no refetch,
   * para evitar race com comentários otimistas recém-criados.
   */
  pruneSyncedComments: (
    postId: string,
    syncedIds: string[],
    oldestSyncedCreatedAt?: string,
  ) => void
  /** Limpa todos os overlays — chamado no logout/deleteAccount. */
  resetSocialOverlays: () => void
  /** Marca notificação como lida (otimista). */
  markNotificationAsRead: (notificationId: string) => void
  /** Define contagem de não-lidas (otimista). */
  setUnreadCount: (count: number) => void
  /** Marca todas as notificações como lidas (otimista). */
  markAllNotificationsAsRead: () => void
  /** Limpa overlay de notificações antigas (chamado periodicamente). */
  clearNotificationsOverlay: (maxAge: number) => void
}

const initialState: SocialState = {
  postLikes: {},
  commentLikes: {},
  postComments: {},
  notifications: {},
  unreadCount: 0,
}

/**
 * SocialStore (T087/US-023) — **apenas client state** (plano):
 * Helpers otimistas (`updatePostLike`/`updateCommentLike`/`addCommentToPost`).
 *
 * - `NÃO feedPosts`: a lista de posts é dos hooks `useFeed` (React Query).
 * - `NÃO unreadCount`/`notifications` como source of truth: badge via `useUnreadCount` (polling),
 *   lista via `useNotifications` (React Query).
 * - Overlays otimistas para notificações para evitar flicker na UI.
 * - Sem `persist`: estado efêmero.
 */
export const useSocialStore = create<SocialState & SocialActions>()((set) => ({
  ...initialState,

  updatePostLike: (
    postId: string,
    liked: boolean | undefined,
    likeCount: number,
  ) =>
    set((state: SocialState) => ({
      postLikes: {
        ...state.postLikes,
        [postId]: {
          liked: liked ?? state.postLikes[postId]?.liked ?? false,
          likeCount,
        },
      },
    })),

  updateCommentLike: (
    commentId: string,
    liked: boolean | undefined,
    likeCount: number,
  ) =>
    set((state: SocialState) => ({
      commentLikes: {
        ...state.commentLikes,
        [commentId]: {
          liked: liked ?? state.commentLikes[commentId]?.liked ?? false,
          likeCount,
        },
      },
    })),

  addCommentToPost: (postId: string, comment: SocialComment) =>
    set((state: SocialState) => {
      const list = state.postComments[postId] ?? []
      if (list.some((item: SocialComment) => item.id === comment.id))
        return state
      return {
        postComments: {
          ...state.postComments,
          [postId]: [...list, comment],
        },
      }
    }),

  clearPostOverlays: () => set(() => ({ postLikes: {} })),

  pruneSyncedComments: (
    postId: string,
    syncedIds: string[],
    oldestSyncedCreatedAt?: string,
  ) =>
    set((state: SocialState) => {
      const current = state.postComments[postId]
      if (!current || current.length === 0) return state
      const synced = new Set(syncedIds)
      const remaining = current.filter((comment: SocialComment) => {
        if (!synced.has(comment.id)) return true
        // Only prune if we have a timestamp and the comment is older than
        // the oldest in the server response (prevents race with optimistic
        // comments created after the refetch started)
        if (oldestSyncedCreatedAt && comment.createdAt) {
          return comment.createdAt > oldestSyncedCreatedAt
        }
        return false
      })
      if (remaining.length === current.length) return state
      return {
        postComments: { ...state.postComments, [postId]: remaining },
      }
    }),

  resetSocialOverlays: () => set(() => ({ ...initialState })),

  markNotificationAsRead: (notificationId: string) =>
    set((state: SocialState) => ({
      notifications: {
        ...state.notifications,
        [notificationId]: { id: notificationId, isRead: true },
      },
    })),

  setUnreadCount: (count: number) => set({ unreadCount: count }),

  markAllNotificationsAsRead: () =>
    set((state: SocialState) => {
      const updatedNotifications: Record<
        string,
        { id: string; isRead: boolean }
      > = {}
      for (const id of Object.keys(state.notifications)) {
        updatedNotifications[id] = { id, isRead: true }
      }
      return {
        notifications: updatedNotifications,
        unreadCount: 0,
      }
    }),

  // Clear notifications older than maxAge ms to prevent unbounded growth
  clearNotificationsOverlay: () =>
    set((state: SocialState) => {
      const keys = Object.keys(state.notifications)
      if (keys.length <= 500) return state
      // Keep only the 500 most recent
      const sortedIds = keys.sort().slice(-500)
      const limited: Record<string, { id: string; isRead: boolean }> = {}
      for (const id of sortedIds) {
        const notif = state.notifications[id]
        if (notif) limited[id] = notif
      }
      return { notifications: limited }
    }),
}))
