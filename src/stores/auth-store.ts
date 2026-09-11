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
}

type LoginResponse =
  | { accessToken: string; user: User }
  | { error: { code: string; message: string } }

export type { User }

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
    try {
      const res = await fetch("/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      })
      const data = (await res.json()) as LoginResponse

      if (res.ok && "user" in data) {
        set({ user: data.user, isAuthenticated: true })
        return
      }

      if ("error" in data) {
        set({ error: data.error.message })
        throw new Error(data.error.code)
      }

      throw new Error("UNKNOWN_ERROR")
    } catch (err) {
      if (err instanceof Error && err.message !== "AUTH_EMAIL_NOT_VERIFIED") {
        set((state) => ({ error: state.error ?? "Erro ao fazer login" }))
      }
      throw err
    } finally {
      set({ isLoading: false })
    }
  },

  clearError: () => set({ error: null }),
}))
