"use client"

import { create } from "zustand"

interface User {
  id: string
  name: string
  email: string
  displayName: string | null
  role: string
  plan: string
  avatar: string | null
  emailVerified: boolean
}

interface AuthState {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null
  login: (email: string, password: string) => Promise<void>
  clearError: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,

  login: async (email: string, password: string) => {
    set({ isLoading: true, error: null })
    const res = await fetch("/api/v1/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    })
    const data = await res.json()

    if (res.ok) {
      set({
        user: data.user,
        isAuthenticated: true,
        isLoading: false,
      })
      return
    }

    set({ isLoading: false })

    if (data.error?.code === "AUTH_EMAIL_NOT_VERIFIED") {
      if (data.user) {
        set({ user: data.user, isAuthenticated: false })
      }
      throw new Error("AUTH_EMAIL_NOT_VERIFIED")
    }

    set({ error: data.error?.message ?? "Erro ao fazer login" })
    throw new Error(data.error?.code ?? "UNKNOWN_ERROR")
  },

  clearError: () => set({ error: null }),
}))
