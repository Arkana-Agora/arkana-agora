"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { useAuthStore } from "@/stores/auth-store"

/**
 * Full logout: revokes refresh session server-side, clears Auth.js cookies,
 * clears zustand state + caches, then navigates to /login.
 * Replaces the dashboard server-action `signOut` which left the refresh
 * family valid and localStorage populated.
 */
export function LogoutButton() {
  const router = useRouter()
  const logout = useAuthStore((state) => state.logout)
  const [pending, setPending] = useState(false)

  async function handleClick() {
    setPending(true)
    try {
      await logout()
    } catch {
      // melhor esforco: a navegacao no finally acontece mesmo se o logout
      // lancar (evita unhandled rejection no navegador)
    } finally {
      setPending(false)
      router.replace("/login")
      router.refresh()
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      disabled={pending}
      onClick={handleClick}
    >
      {pending ? "Saindo..." : "Sair"}
    </Button>
  )
}
