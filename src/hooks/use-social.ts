"use client"

import { useInfiniteQuery, useQuery } from "@tanstack/react-query"
import { z } from "zod"

import authApi from "@/lib/api"

const notificationSchema = z.object({
  id: z.string(),
  type: z.string(),
  isRead: z.boolean(),
  createdAt: z.string(),
  message: z.string().optional(),
  actor: z.unknown().optional(),
  resource: z.unknown().optional(),
  data: z.unknown().optional(),
})

export type SocialNotification = z.infer<typeof notificationSchema>

// Contrato real e ÚNICO da rota T082 (src/app/api/v1/social/notifications/route.ts:72-76):
// `{ data: { notifications, unreadCount }, pagination: { nextCursor } }` —
// `unreadCount` e `pagination` SEMPRE presentes. União estreitada para o
// envelope canônico por decisão S2-18 (review 2026-10-12): shape divergente
// (flat ou data-array dos rascunhos antigos) é quebra de contrato e falha
// ruidosa no parse — não silencia badge como antes.
const notificationsEnvelopeSchema = z.object({
  data: z.object({
    notifications: z.array(notificationSchema),
    unreadCount: z.number().int().min(0),
  }),
  pagination: z.object({
    nextCursor: z.string().nullable(),
  }),
})

export type NotificationsPage = {
  notifications: SocialNotification[]
  nextCursor: string | null
  unreadCount: number
}

function toNotificationsPage(payload: unknown): NotificationsPage {
  const { data, pagination } = notificationsEnvelopeSchema.parse(payload)
  return {
    notifications: data.notifications,
    nextCursor: pagination.nextCursor,
    unreadCount: data.unreadCount,
  }
}

/**
 * Notificações do usuário com paginação por cursor (T082/US-023).
 * Parser estrito do envelope canônico S2-18
 * `{ data: { notifications, unreadCount }, pagination: { nextCursor } }`
 * (route.ts:72-76) — normaliza para `NotificationsPage`.
 */
export function useNotifications(cursor?: string | null) {
  return useInfiniteQuery({
    queryKey: ["notifications", cursor ?? null],
    queryFn: async ({ pageParam }) => {
      const res = await authApi.get("/social/notifications", {
        params: pageParam ? { cursor: pageParam } : {},
      })
      return toNotificationsPage(res.data)
    },
    initialPageParam: cursor ?? null,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  })
}

/**
 * Badge de não-lidas (T038/T073) — não há endpoint dedicado documentado:
 * usa `GET /social/notifications` (T082) com `limit=1&unreadOnly=true` e
 * lê `unreadCount` da página. Poll curto mantém o badge quente.
 */
export function useUnreadCount() {
  return useQuery({
    queryKey: ["notifications", "unread-count"],
    queryFn: async () => {
      const res = await authApi.get("/social/notifications", {
        params: { limit: 1, unreadOnly: true },
      })
      return toNotificationsPage(res.data).unreadCount
    },
    refetchInterval: 60_000,
  })
}

const followListItemSchema = z.object({
  userId: z.string(),
  name: z.string(),
  username: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  isFollowing: z.boolean().optional(),
})

const followListPageSchema = z.object({
  data: z.array(followListItemSchema),
  pagination: z.object({ nextCursor: z.string().nullable() }),
})

export type FollowListItem = z.infer<typeof followListItemSchema>
export type FollowListSide = "followers" | "following"

/**
 * Listas de followers/following (T044/T045/T048) no envelope S2-18
 * `{ data, pagination: { nextCursor } }`, com busca `?q=` e cursor.
 */
export function useFollowList(
  username: string,
  side: FollowListSide,
  q: string,
  enabled = true,
) {
  return useInfiniteQuery({
    queryKey: ["follows", username, side, q],
    enabled: enabled && !!username,
    queryFn: async ({ pageParam }) => {
      const res = await authApi.get(`/users/${username}/${side}`, {
        params: {
          ...(pageParam ? { cursor: pageParam } : {}),
          ...(q ? { q } : {}),
        },
      })
      return followListPageSchema.parse(res.data)
    },
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.pagination.nextCursor ?? undefined,
  })
}
