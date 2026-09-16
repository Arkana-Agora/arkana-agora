"use client"

import { Skeleton } from "@/components/ui/skeleton"
import {
  useAuthStore,
  type PartialUser,
  type User,
  type UserRole,
} from "@/stores/auth-store"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"

function passesRole(
  user: User | PartialUser | null | undefined,
  requiredRole?: UserRole,
): boolean {
  return (
    !requiredRole ||
    (user != null && "role" in user && user.role === requiredRole)
  )
}

interface AuthGuardProps {
  children: React.ReactNode
  requiredRole?: UserRole
}

export function AuthGuard({ children, requiredRole }: AuthGuardProps) {
  const router = useRouter()
  const user = useAuthStore((s) => s.user)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const refreshSession = useAuthStore((s) => s.refreshSession)

  // Inicia sempre como "nao verificado": servidor (sem localStorage) e cliente
  // hidratam o mesmo skeleton; a sessao e validada no efeito pos-montagem,
  // evitando mismatch de hidratacao e confiando apenas apos validacao.
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    if (checked) return

    let cancelled = false
    refreshSession().finally(() => {
      if (!cancelled) setChecked(true)
    })

    return () => {
      cancelled = true
    }
  }, [checked, refreshSession])

  useEffect(() => {
    if (checked && (!isAuthenticated || !passesRole(user, requiredRole))) {
      router.replace("/login")
    }
  }, [checked, isAuthenticated, user, requiredRole, router])

  if (!checked) {
    return (
      <div
        role="status"
        aria-label="Verificando sessao"
        aria-busy="true"
        className="flex min-h-screen items-center justify-center p-4"
      >
        <Skeleton className="h-16 w-full max-w-sm" />
      </div>
    )
  }

  if (!isAuthenticated || !passesRole(user, requiredRole)) {
    return null
  }

  return <>{children}</>
}
