"use client"

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react"

import api from "@/lib/api"
import { POLLING_DEFAULT_SINCE_MS } from "@/lib/social/polling-window"
import { useSocket } from "@/hooks/use-socket"

// Contexto global de notificações não lidas (plano T073): unreadCount
// inicial via polling (T071) e incremento a cada evento `notification`
// do WebSocket (T072/fallback), com dedup por id — WS e polling podem
// reentregar a mesma notificação na janela de sobreposição (falha de
// cursor/reconnect). Marcação de lida chega na Fase 3 (T083).

interface NotificationsContextValue {
  unreadCount: number
  setUnreadCount: Dispatch<SetStateAction<number>>
}

const NotificationsContext = createContext<NotificationsContextValue>({
  unreadCount: 0,
  setUnreadCount: () => undefined,
})

// Bounded: só o suficiente para dedup da janela corrente.
const SEEN_IDS_CAP = 500

interface PollingBody {
  data?: {
    unreadCount?: number
    notifications?: Array<{ id: string }>
  }
}

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const [unreadCount, setUnreadCount] = useState(0)
  const seenIdsRef = useRef<Set<string>>(new Set())
  const seenQueueRef = useRef<string[]>([])

  // Retorna true se o id já foi contado (dedup). Marca novos ids.
  const markSeen = (id: string): boolean => {
    const seen = seenIdsRef.current
    if (seen.has(id)) return true
    seen.add(id)
    seenQueueRef.current.push(id)
    if (seenQueueRef.current.length > SEEN_IDS_CAP) {
      const evicted = seenQueueRef.current.shift()
      if (evicted !== undefined) seen.delete(evicted)
    }
    return false
  }

  useSocket({
    notification: (payload) => {
      if (typeof payload?.id === "string" && markSeen(payload.id)) return
      setUnreadCount((count) => count + 1)
    },
  })

  useEffect(() => {
    let cancelled = false
    const since = encodeURIComponent(
      new Date(Date.now() - POLLING_DEFAULT_SINCE_MS).toISOString(),
    )
    api
      .get(`/social/polling/notifications?since=${since}`)
      .then((res) => {
        const body = res as unknown as { data?: PollingBody }
        const data = body.data?.data
        if (cancelled) return
        // Semeia o dedup com o baseline: um re-dispatch do mesmo item
        // (sobreposição WS×polling) não pode contar de novo.
        for (const item of data?.notifications ?? []) {
          if (typeof item?.id === "string") markSeen(item.id)
        }
        const count = data?.unreadCount
        if (typeof count === "number") {
          setUnreadCount((current) => Math.max(current, count))
        }
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <NotificationsContext.Provider value={{ unreadCount, setUnreadCount }}>
      {children}
    </NotificationsContext.Provider>
  )
}

export function useNotifications(): NotificationsContextValue {
  return useContext(NotificationsContext)
}
