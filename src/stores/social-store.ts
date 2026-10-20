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

interface SocialState {
  /** Overlay por postId — o feed em si é dos hooks useFeed (NÃO feedPosts). */
  postLikes: Record<string, PostLikeOverlay>
  /** Overlay de like de comentário por commentId. */
  commentLikes: Record<string, CommentLikeOverlay>
  /** Comentários novos por postId (dedup por id) — base da CommentSection. */
  postComments: Record<string, SocialComment[]>
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
   */
  pruneSyncedComments: (postId: string, syncedIds: string[]) => void
  /** Limpa todos os overlays — chamado no logout/deleteAccount. */
  resetSocialOverlays: () => void
}

const initialState: SocialState = {
  postLikes: {},
  commentLikes: {},
  postComments: {},
}

/**
 * SocialStore (T087/US-023) — **apenas client state** (plano):
 * Helpers otimistas (`updatePostLike`/`updateCommentLike`/`addCommentToPost`).
 *
 * - `NÃO feedPosts`: a lista de posts é dos hooks `useFeed` (React Query).
 * - `NÃO unreadCount`/`notifications`: badge via `useUnreadCount` (polling),
 *   lista via `useNotifications` (React Query).
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

  pruneSyncedComments: (postId: string, syncedIds: string[]) =>
    set((state: SocialState) => {
      const current = state.postComments[postId]
      if (!current || current.length === 0) return state
      const synced = new Set(syncedIds)
      const remaining = current.filter(
        (comment: SocialComment) => !synced.has(comment.id),
      )
      if (remaining.length === current.length) return state
      return {
        postComments: { ...state.postComments, [postId]: remaining },
      }
    }),

  resetSocialOverlays: () => set(() => ({ ...initialState })),
}))
