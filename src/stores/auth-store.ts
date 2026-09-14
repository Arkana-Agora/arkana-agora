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

export type MagicLinkErrorCode =
  | "AUTH_MAGIC_LINK_RATE_LIMIT"
  | "VALIDATION_ERROR"
  | "NETWORK_ERROR"
  | "UNEXPECTED_RESPONSE"
  | "UNKNOWN_ERROR"

export type MagicLinkResult =
  | { success: true; message?: string }
  | {
      success: false
      code: MagicLinkErrorCode
      message?: string
      retryAfter?: number
    }

export type { User }

const KNOWN_MAGIC_LINK_CODES: MagicLinkErrorCode[] = [
  "AUTH_MAGIC_LINK_RATE_LIMIT",
  "VALIDATION_ERROR",
  "NETWORK_ERROR",
  "UNEXPECTED_RESPONSE",
  "UNKNOWN_ERROR",
]

function normalizeMagicLinkCode(code: string): MagicLinkErrorCode {
  return (KNOWN_MAGIC_LINK_CODES as string[]).includes(code)
    ? (code as MagicLinkErrorCode)
    : "UNKNOWN_ERROR"
}

interface AuthState {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null
  login: (email: string, password: string) => Promise<void>
  register: (data: RegisterInput) => Promise<void>
  sendMagicLink: (email: string) => Promise<MagicLinkResult>
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

      if (res.ok && "user" in responseData) {
        return
      }

      if ("error" in responseData) {
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

  sendMagicLink: async (email: string) => {
    const trimmed = email.trim()
    if (!trimmed) {
      set({ error: "E-mail obrigatório" })
      return {
        success: false,
        code: "VALIDATION_ERROR",
        message: "E-mail obrigatório",
      }
    }

    set({ isLoading: true, error: null })
    try {
      const res = await fetch("/api/v1/auth/magic-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed }),
      })
      let data: unknown
      try {
        data = await res.json()
      } catch {
        set({ error: "Resposta inesperada do servidor" })
        return {
          success: false,
          code: "UNEXPECTED_RESPONSE",
          message: "Resposta inesperada do servidor",
        }
      }

      if (
        res.ok &&
        typeof data === "object" &&
        data !== null &&
        "message" in data
      ) {
        return { success: true, message: (data as { message: string }).message }
      }

      if (typeof data === "object" && data !== null && "error" in data) {
        const { code, message, retryAfter } = (
          data as {
            error: { code: string; message: string; retryAfter?: number }
          }
        ).error
        set({ error: message })
        return {
          success: false,
          code: normalizeMagicLinkCode(code),
          message,
          ...(retryAfter !== undefined ? { retryAfter } : {}),
        }
      }

      return {
        success: false,
        code: "UNEXPECTED_RESPONSE",
        message: "Resposta inesperada do servidor",
      }
    } catch (err) {
      const message = "Erro ao enviar magic link"
      set({ error: message })
      if (err instanceof TypeError) {
        return { success: false, code: "NETWORK_ERROR", message }
      }
      return { success: false, code: "UNKNOWN_ERROR", message }
    } finally {
      set({ isLoading: false })
    }
  },

  clearError: () => set({ error: null }),
}))
