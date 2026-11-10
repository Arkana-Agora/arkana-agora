"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query"
import { z } from "zod"
import { formatDistanceToNow } from "date-fns"
import { ptBR } from "date-fns/locale"
import { Button } from "@/components/ui/button"
import { useSession } from "next-auth/react"
import authApi from "@/lib/api"
import {
  Heart,
  MessageSquare,
  UserPlus,
  Gift,
  MoreHorizontal,
} from "lucide-react"

const notificationTypeIconMap = {
  like: Heart,
  comment: MessageSquare,
  follow: UserPlus,
  gift: Gift,
  mention: MessageSquare,
  system: MoreHorizontal,
} as const

type NotificationType = keyof typeof notificationTypeIconMap

type NotificationData =
  | { type: "like"; postId: string }
  | { type: "comment"; postId: string; commentId: string }
  | { type: "follow"; userId: string }
  | { type: "gift"; giftId: string; fromUserId: string }
  | { type: "mention"; postId: string }
  | { type: "system"; data: Record<string, unknown> }

interface Notification {
  id: string
  type: NotificationType
  message: string
  data: NotificationData
  isRead: boolean
  createdAt: string
}

const notificationsEnvelopeSchema = z.object({
  data: z.object({
    notifications: z.array(
      z.discriminatedUnion("type", [
        z.object({
          id: z.string(),
          type: z.literal("like"),
          message: z.string(),
          data: z.object({ type: z.literal("like"), postId: z.string() }),
          isRead: z.boolean(),
          createdAt: z.string(),
        }),
        z.object({
          id: z.string(),
          type: z.literal("comment"),
          message: z.string(),
          data: z.object({
            type: z.literal("comment"),
            postId: z.string(),
            commentId: z.string(),
          }),
          isRead: z.boolean(),
          createdAt: z.string(),
        }),
        z.object({
          id: z.string(),
          type: z.literal("follow"),
          message: z.string(),
          data: z.object({ type: z.literal("follow"), userId: z.string() }),
          isRead: z.boolean(),
          createdAt: z.string(),
        }),
        z.object({
          id: z.string(),
          type: z.literal("gift"),
          message: z.string(),
          data: z.object({
            type: z.literal("gift"),
            giftId: z.string(),
            fromUserId: z.string(),
          }),
          isRead: z.boolean(),
          createdAt: z.string(),
        }),
        z.object({
          id: z.string(),
          type: z.literal("mention"),
          message: z.string(),
          data: z.object({ type: z.literal("mention"), postId: z.string() }),
          isRead: z.boolean(),
          createdAt: z.string(),
        }),
        z.object({
          id: z.string(),
          type: z.literal("system"),
          message: z.string(),
          data: z.object({
            type: z.literal("system"),
            data: z.record(z.unknown()),
          }),
          isRead: z.boolean(),
          createdAt: z.string(),
        }),
      ]),
    ),
    unreadCount: z.number(),
  }),
  pagination: z.object({
    nextCursor: z.string().nullable().optional(),
  }),
})

export default function NotificationsPage() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { data: session } = useSession()
  const [filter, setFilter] = useState<"all" | "unread">("all")

  const query = useInfiniteQuery({
    queryKey: ["notifications"],
    queryFn: async ({ pageParam }) => {
      const res = await authApi.get("/social/notifications", {
        params: pageParam ? { cursor: pageParam } : {},
      })
      return notificationsEnvelopeSchema.parse(res.data)
    },
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.pagination.nextCursor ?? undefined,
  })

  const markAsReadMutation = useMutation({
    mutationFn: async (id: string) => {
      await authApi.patch(`/social/notifications/${id}/read`)
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  })

  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      await authApi.patch("/social/notifications/read-all")
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  })

  const allNotifications = (query.data?.pages ?? []).flatMap(
    (page) => page.data.notifications,
  )
  const filteredNotifications =
    filter === "unread"
      ? allNotifications.filter((n) => !n.isRead)
      : allNotifications

  const unreadCount = allNotifications.filter((n) => !n.isRead).length

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.isRead) {
      markAsReadMutation.mutate(notification.id)
    }

    const data = notification.data

    switch (data.type) {
      case "like":
      case "comment":
      case "mention":
        router.push(`/post/${data.postId}`)
        break
      case "follow":
        router.push(`/perfil/${data.userId}`)
        break
      case "gift":
        router.push("/presentes")
        break
      default:
        router.push("/notificacoes")
    }
  }

  const getIconForType = (type: Notification["type"]) => {
    const Icon = notificationTypeIconMap[type]
    return <Icon className="h-5 w-5" />
  }

  if (!session) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8 text-center">
        <p className="text-muted-foreground">
          Por favor, faca login para ver suas notificacoes.
        </p>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Notificacoes</h1>
        <p className="text-muted-foreground mt-1">
          Acompanhe as atividades na sua conta
        </p>
      </div>

      <div className="mb-4 flex items-center gap-2">
        <Button
          variant={filter === "all" ? "default" : "outline"}
          onClick={() => setFilter("all")}
        >
          Todas
        </Button>
        <Button
          variant={filter === "unread" ? "default" : "outline"}
          onClick={() => setFilter("unread")}
        >
          Nao lidas{" "}
          {unreadCount > 0 && (
            <span className="ml-1 px-1.5 py-0.5 text-xs font-medium bg-primary text-primary-foreground rounded-full">
              {unreadCount}
            </span>
          )}
        </Button>
        {unreadCount > 0 && (
          <Button
            variant="outline"
            onClick={() => markAllAsReadMutation.mutate()}
            disabled={markAllAsReadMutation.isPending}
          >
            Marcar todas como lidas
          </Button>
        )}
      </div>

      {query.isLoading ? (
        <div className="flex min-h-[40vh] items-center justify-center">
          <svg
            className="h-8 w-8 animate-spin text-primary"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          <span className="sr-only">Carregando notificacoes...</span>
        </div>
      ) : filteredNotifications.length === 0 ? (
        <div className="text-center py-12">
          <svg
            className="h-12 w-12 mx-auto text-muted-foreground/50"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.38a2 2 0 011 1.732V5a2 2 0 10-4 0v1.38c-.57 0-1.098.332-1.417.83L10 14.172V15a2 2 0 01-2 2h-2l3 3z"
            />
          </svg>
          <p className="mt-4 text-muted-foreground">
            {filter === "unread"
              ? "Todas as notificacoes foram lidas"
              : "Nenhuma notificacao por enquanto"}
          </p>
        </div>
      ) : (
        <>
          <ul
            className="space-y-2"
            role="list"
            aria-label="Lista de notificacoes"
          >
            {filteredNotifications.map((notification) => (
              <li
                key={notification.id}
                onClick={() => handleNotificationClick(notification)}
                className={`group relative flex items-start gap-3 p-4 rounded-xl border transition-colors cursor-pointer ${
                  !notification.isRead
                    ? "bg-primary/5 border-primary/20"
                    : "border-border hover:bg-muted/50"
                }`}
                data-testid={`notification-${notification.id}`}
              >
                <div className="relative flex-shrink-0">
                  {getIconForType(notification.type)}
                  {!notification.isRead && (
                    <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-primary" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground">
                    {notification.message}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(notification.createdAt), {
                      addSuffix: true,
                      locale: ptBR,
                    })}
                  </p>
                </div>
                {!notification.isRead && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      markAsReadMutation.mutate(notification.id)
                    }}
                    className="flex-shrink-0 p-1 rounded-full hover:bg-muted transition-colors"
                    aria-label="Marcar como lida"
                  >
                    <svg
                      className="h-4 w-4 text-muted-foreground"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 12h14"
                      />
                    </svg>
                  </button>
                )}
              </li>
            ))}
          </ul>

          {query.hasNextPage && (
            <div className="mt-4 text-center">
              <Button
                variant="outline"
                onClick={() => void query.fetchNextPage()}
                disabled={query.isFetchingNextPage}
              >
                Carregar mais
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
