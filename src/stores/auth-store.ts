"use client"

import type { RegisterInput } from "@/lib/validators/auth"
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

type RegisterUser = {
  id: string
  name: string
  email: string
  emailVerified: string | null
}

type RegisterResponse =
  | { user: RegisterUser; message: string }
  | { error: { code: string; message: string } }

export type { User }

function isRegisterSuccess(
  data: RegisterResponse,
): data is { user: RegisterUser; message: string } {
  return "user" in data
}

function isRegisterError(
  data: RegisterResponse,
): data is { error: { code: string; message: string } } {
  return "error" in data
}

interface AuthState {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null
  login: (email: string, password: string) => Promise<void>
  register: (data: RegisterInput) => Promise<void>
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

  register: async (data: RegisterInput) => {
    set({ isLoading: true, error: null })
    try {
      const csrfToken = document.cookie
        .split("; ")
        .find((row) => row.startsWith("__Host-csrf-token="))
        ?.split("=")[1]

      const res = await fetch("/api/v1/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": csrfToken ?? "",
        },
        body: JSON.stringify(data),
      })
      const responseData = (await res.json()) as RegisterResponse

      if (res.ok && isRegisterSuccess(responseData)) {
        return
      }

      if (isRegisterError(responseData)) {
        set({ error: responseData.error.message })
        throw new Error(responseData.error.code)
      }

      throw new Error("UNEXPECTED_RESPONSE")
    } catch (err) {
      if (err instanceof Error && err.message !== "AUTH_EMAIL_ALREADY_EXISTS") {
        set((state) => ({ error: state.error ?? "Erro ao criar conta" }))
      }
      throw err
    } finally {
      set({ isLoading: false })
    }
  },

  clearError: () => set({ error: null }),
}))
