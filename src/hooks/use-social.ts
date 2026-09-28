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

const notificationsEnvelopeSchema = z.object({
  data: z.array(notificationSchema),
  pagination: z
    .object({
      nextCursor: z.string().nullable().optional(),
      hasMore: z.boolean().optional(),
      unreadCount: z.number().int().min(0).optional(),
    })
    .passthrough(),
})

const notificationsFlatSchema = z.object({
  notifications: z.array(notificationSchema),
  nextCursor: z.string().nullable().optional(),
  unreadCount: z.number().int().min(0).optional(),
})

const notificationsPageSchema = z.union([
  notificationsEnvelopeSchema,
  notificationsFlatSchema,
])

export type NotificationsPage = {
  notifications: SocialNotification[]
  nextCursor?: string | null | undefined
  unreadCount?: number | undefined
}

function toNotificationsPage(payload: unknown): NotificationsPage {
  const page = notificationsPageSchema.parse(payload)
  if ("data" in page) {
    return {
      notifications: page.data,
      nextCursor: page.pagination.nextCursor,
      unreadCount: page.pagination.unreadCount,
    }
  }
  return page
}

/**
 * Notificações do usuário com paginação por cursor (T082/US-023).
 * Aceita os dois shapes documentados: envelope `{ data, pagination }`
 * (docs/04-api/social.md) e flat `{ notifications, unreadCount, nextCursor }`
 * (T082 do plano) — normaliza para `NotificationsPage`.
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
      return toNotificationsPage(res.data).unreadCount ?? 0
    },
    refetchInterval: 60_000,
  })
}
