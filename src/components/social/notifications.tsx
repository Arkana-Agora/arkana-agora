"use client"

import { Bell } from "lucide-react"
import { useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import { useUnreadCount, useNotifications } from "@/hooks/use-social"
import { useSocket } from "@/hooks/use-socket"
import authApi from "@/lib/api"
import { formatRelativeTime } from "@/lib/social/relative-time"

const TYPE_LABELS: Record<string, string> = {
  follow: "Novo seguidor",
  like: "Curtida",
  comment: "Comentário",
  gift: "Presente",
  mention: "Menção",
  horoscope: "Horóscopo",
}

/**
 * NotificationsDropdown (T086/US-023): trigger com bell + badge unread
 * (T073/`useUnreadCount`), lista tipo/mensagem/timestamp ao abrir e
 * mark-as-read por item (`PATCH /social/notifications/:id/read`, T083).
 *
 * - Lista via React Query (`useNotifications`, envelope S2-18 da T082).
 * - Badge via `useUnreadCount` (poll `limit=1&unreadOnly=true` a cada 60s) e
 *   invalidação imediata no evento WS `notification` (realtime T073).
 * - Badge preserva `data-testid="unread-notifications-badge"` e o aria-label
 *   `${count} notificações não lidas` (T073/E2E).
 * - Mark-as-read invalida queries para atualizar badge e lista.
 */
export function NotificationsDropdown() {
  const { data: unreadCount = 0 } = useUnreadCount()
  const queryClient = useQueryClient()
  const { data: notificationsPage, isLoading, isError } = useNotifications()
  const [open, setOpen] = useState(false)

  // Realtime (T073/E2E T075): evento WS `notification` (ou o poll de 30s do
  // fallback, que re-dispara o mesmo evento) invalida as queries de badge e
  // lista na hora — sem esperar o refetchInterval de 60s do useUnreadCount.
  useSocket({
    notification: () => {
      void queryClient.invalidateQueries({ queryKey: ["notifications"] })
    },
  })

  // Flatten pages into a single array
  const notifications =
    notificationsPage?.pages.flatMap((page) => page.notifications) ?? []

  function toggleOpen() {
    const next = !open
    setOpen(next)
  }

  async function markAsRead(id: string) {
    const target = notifications.find((item) => item.id === id)
    if (!target || target.isRead) return
    try {
      await authApi.patch(`/social/notifications/${id}/read`)
      // Invalida tanto a lista quanto o contador de não-lidas
      void queryClient.invalidateQueries({ queryKey: ["notifications"] })
    } catch {
      toast.error("Não foi possível marcar como lida. Tente novamente.")
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        aria-label="Notificações"
        aria-expanded={open}
        data-testid="notifications-trigger"
        onClick={toggleOpen}
        className="relative inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:text-foreground transition-colors"
      >
        <Bell className="h-4 w-4" aria-hidden="true" />
        {unreadCount > 0 && (
          <span
            aria-label={`${unreadCount} notificações não lidas`}
            data-testid="unread-notifications-badge"
            className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-semibold text-primary-foreground"
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          data-testid="notifications-dropdown"
          className="absolute right-0 z-50 mt-2 w-80 rounded-lg border border-border bg-background p-2 shadow-lg"
        >
          <p className="px-2 py-1 text-sm font-semibold">Notificações</p>
          {isLoading ? (
            <p className="px-2 py-3 text-sm text-muted-foreground">
              Carregando...
            </p>
          ) : isError ? (
            <p className="px-2 py-3 text-sm text-muted-foreground">
              Não foi possível carregar as notificações.
            </p>
          ) : notifications.length === 0 ? (
            <p className="px-2 py-3 text-sm text-muted-foreground">
              Nenhuma notificação
            </p>
          ) : (
            <ul className="max-h-96 space-y-1 overflow-y-auto">
              {notifications.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    data-testid={`notification-${item.id}`}
                    onClick={() => void markAsRead(item.id)}
                    className="flex w-full items-start gap-2 rounded-md px-2 py-2 text-left hover:bg-secondary transition-colors"
                  >
                    <span className="flex-1">
                      <span className="block text-xs font-medium text-primary">
                        {TYPE_LABELS[item.type] ?? item.type}
                      </span>
                      <span className="block text-sm">{item.message}</span>
                      <span className="block text-xs text-muted-foreground">
                        {formatRelativeTime(item.createdAt)}
                      </span>
                    </span>
                    {!item.isRead && (
                      <span
                        data-testid={`notification-unread-${item.id}`}
                        aria-label="Não lida"
                        className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary"
                      />
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
