"use client"

import { cn } from "@/lib/utils"
import { useNotifications } from "@/components/social/notifications-provider"
import { isAppNavActive } from "@/lib/navigation"
import { History, Home, Newspaper, SquarePen, User } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"

const NAV_ITEMS = [
  { href: "/dashboard", label: "Home", icon: Home },
  { href: "/feed", label: "Feed", icon: Newspaper },
  { href: "/tirar", label: "Tirar", icon: SquarePen },
  { href: "/minhas-tiragens", label: "Histórico", icon: History },
  { href: "/perfil", label: "Perfil", icon: User },
] as const

export function MobileNav() {
  const pathname = usePathname()
  const { unreadCount } = useNotifications()

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 md:hidden"
      role="navigation"
      aria-label="Navegação principal"
    >
      <div className="flex h-16 items-center justify-around">
        {NAV_ITEMS.map((item) => {
          // Revisão UX: matching exato apagava o tab ativo em subrotas
          // (/tiragem/:id, /perfil/...) — reutiliza a mesma semântica do
          // AppHeader (isAppNavActive).
          const isActive = isAppNavActive(pathname, item.href)
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center gap-1 px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground",
              )}
              aria-current={isActive ? "page" : undefined}
            >
              {/* Revisão U: indicador de não-lidas no tab mobile — o
                  AppHeader (md+) é hidden no mobile. */}
              <span className="relative">
                <Icon className="h-5 w-5" aria-hidden="true" />
                {item.href === "/dashboard" && unreadCount > 0 ? (
                  <span
                    aria-label={`${unreadCount} notificações não lidas`}
                    data-testid="unread-notifications-badge-mobile"
                    className="absolute -right-2.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground"
                  >
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                ) : null}
              </span>
              <span>{item.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
