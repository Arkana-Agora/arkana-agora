"use client"

import { cn } from "@/lib/utils"
import { useNotifications } from "@/components/social/notifications-provider"
import type { AppNavHref } from "@/lib/navigation"
import { isAppNavActive } from "@/lib/navigation"
import {
  Bell,
  History,
  Home,
  Newspaper,
  Sparkles,
  SquarePen,
  User,
} from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"

const NAV_ITEMS: ReadonlyArray<{
  href: AppNavHref
  label: string
  icon: typeof Home
}> = [
  { href: "/dashboard", label: "Home", icon: Home },
  { href: "/feed", label: "Feed", icon: Newspaper },
  { href: "/tirar", label: "Tirar", icon: SquarePen },
  { href: "/minhas-tiragens", label: "Histórico", icon: History },
  { href: "/meu-arcano", label: "Meu Arcano", icon: Sparkles },
  { href: "/perfil", label: "Perfil", icon: User },
]

export function AppHeader() {
  const pathname = usePathname()
  const { unreadCount } = useNotifications()

  return (
    <header className="sticky top-0 z-40 hidden border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 md:block">
      <nav
        className="mx-auto flex h-14 max-w-5xl items-center gap-6 px-4"
        role="navigation"
        aria-label="Navegação principal"
      >
        <Link
          href="/dashboard"
          className="font-bold tracking-tight hover:text-primary"
        >
          Arkana Ágora
        </Link>
        <div className="flex flex-1 items-center gap-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon
            const active = isAppNavActive(pathname, item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-secondary text-secondary-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
                aria-current={active ? "page" : undefined}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                {item.label}
              </Link>
            )
          })}
        </div>
        {unreadCount > 0 ? (
          <span
            aria-label={`${unreadCount} notificações não lidas`}
            data-testid="unread-notifications-badge"
            className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-semibold text-primary-foreground"
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        ) : (
          <Bell className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        )}
      </nav>
    </header>
  )
}
