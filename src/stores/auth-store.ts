"use client"

import type { RegisterInput, ResetPasswordInput } from "@/lib/validators/auth"
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

export type ForgotPasswordErrorCode =
  | "AUTH_FORGOT_RATE_LIMIT"
  | "VALIDATION_ERROR"
  | "NETWORK_ERROR"
  | "UNEXPECTED_RESPONSE"
  | "UNKNOWN_ERROR"

export type ForgotPasswordResult =
  | { success: true; message?: string }
  | {
      success: false
      code: ForgotPasswordErrorCode
      message?: string
    }

export type ResetPasswordErrorCode =
  | "AUTH_RESET_TOKEN_INVALID"
  | "AUTH_RESET_TOKEN_EXPIRED"
  | "VALIDATION_ERROR"
  | "NETWORK_ERROR"
  | "UNEXPECTED_RESPONSE"
  | "UNKNOWN_ERROR"

export type ResetPasswordResult =
  | { success: true; message?: string }
  | {
      success: false
      code: ResetPasswordErrorCode
      message?: string
    }

export type { User }

const KNOWN_MAGIC_LINK_CODES = [
  "AUTH_MAGIC_LINK_RATE_LIMIT",
  "VALIDATION_ERROR",
  "NETWORK_ERROR",
  "UNEXPECTED_RESPONSE",
  "UNKNOWN_ERROR",
] as const

const KNOWN_FORGOT_PASSWORD_CODES = [
  "AUTH_FORGOT_RATE_LIMIT",
  "VALIDATION_ERROR",
  "NETWORK_ERROR",
  "UNEXPECTED_RESPONSE",
  "UNKNOWN_ERROR",
] as const

const KNOWN_RESET_PASSWORD_CODES = [
  "AUTH_RESET_TOKEN_INVALID",
  "AUTH_RESET_TOKEN_EXPIRED",
  "VALIDATION_ERROR",
  "NETWORK_ERROR",
  "UNEXPECTED_RESPONSE",
  "UNKNOWN_ERROR",
] as const

function parseErrorResponse(
  data: unknown,
): { code: string; message: string; retryAfter?: number } | null {
  if (!data || typeof data !== "object" || !("error" in data)) {
    return null
  }
  const error = (data as { error: unknown }).error
  if (!error || typeof error !== "object") {
    return null
  }
  if (!("code" in error) || typeof error.code !== "string") {
    return null
  }
  if (!("message" in error) || typeof error.message !== "string") {
    return null
  }
  return {
    code: error.code,
    message: error.message,
    ...("retryAfter" in error && typeof error.retryAfter === "number"
      ? { retryAfter: error.retryAfter }
      : {}),
  }
}

function normalizeAuthErrorCode(
  code: string,
  knownCodes: readonly string[],
): string {
  return knownCodes.includes(code) ? code : "UNKNOWN_ERROR"
}

function normalizeMagicLinkCode(code: string): MagicLinkErrorCode {
  return normalizeAuthErrorCode(
    code,
    KNOWN_MAGIC_LINK_CODES,
  ) as MagicLinkErrorCode
}

function normalizeForgotPasswordCode(code: string): ForgotPasswordErrorCode {
  return normalizeAuthErrorCode(
    code,
    KNOWN_FORGOT_PASSWORD_CODES,
  ) as ForgotPasswordErrorCode
}

function normalizeResetPasswordCode(code: string): ResetPasswordErrorCode {
  return normalizeAuthErrorCode(
    code,
    KNOWN_RESET_PASSWORD_CODES,
  ) as ResetPasswordErrorCode
}

interface AuthState {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null
  login: (email: string, password: string) => Promise<void>
  register: (data: RegisterInput) => Promise<void>
  sendMagicLink: (email: string) => Promise<MagicLinkResult>
  forgotPassword: (email: string) => Promise<ForgotPasswordResult>
  resetPassword: (data: ResetPasswordInput) => Promise<ResetPasswordResult>
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
      const res: Response = await fetch("/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      })
      const data: unknown = await res.json()

      if (
        res.ok &&
        data &&
        typeof data === "object" &&
        "accessToken" in data &&
        typeof data.accessToken === "string" &&
        "user" in data &&
        typeof data.user === "object" &&
        data.user !== null
      ) {
        const userData = data as { accessToken: string; user: User }
        set({ user: userData.user, isAuthenticated: true })
        return
      }

      const errorData = parseErrorResponse(data)
      if (errorData) {
        set({ error: errorData.message })
        throw new Error(errorData.code)
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

  register: async (registerData: RegisterInput) => {
    set({ isLoading: true, error: null })
    try {
      const csrfToken = document.cookie
        .split("; ")
        .find((row) => row.startsWith("__Host-csrf-token="))
        ?.split("=")[1]

      const res: Response = await fetch("/api/v1/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": csrfToken ?? "",
        },
        body: JSON.stringify(registerData),
      })
      const responseData: unknown = await res.json()

      if (
        res.ok &&
        responseData &&
        typeof responseData === "object" &&
        "user" in responseData &&
        "message" in responseData
      ) {
        return
      }

      const errorData = parseErrorResponse(responseData)
      if (errorData) {
        set({ error: errorData.message })
        throw new Error(errorData.code)
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
        data &&
        typeof data === "object" &&
        "message" in data &&
        typeof data.message === "string"
      ) {
        return { success: true, message: data.message }
      }

      const errorData = parseErrorResponse(data)
      if (errorData) {
        set({ error: errorData.message })
        return {
          success: false,
          code: normalizeMagicLinkCode(errorData.code),
          message: errorData.message,
          ...(errorData.retryAfter !== undefined
            ? { retryAfter: errorData.retryAfter }
            : {}),
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

  forgotPassword: async (email: string) => {
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
      const res = await fetch("/api/v1/auth/forgot-password", {
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
        data &&
        typeof data === "object" &&
        "message" in data &&
        typeof data.message === "string"
      ) {
        return { success: true, message: data.message }
      }

      const errorData = parseErrorResponse(data)
      if (errorData) {
        set({ error: errorData.message })
        return {
          success: false,
          code: normalizeForgotPasswordCode(errorData.code),
          message: errorData.message,
        }
      }

      return {
        success: false,
        code: "UNEXPECTED_RESPONSE",
        message: "Resposta inesperada do servidor",
      }
    } catch (err) {
      const message = "Erro ao enviar link de recuperacao"
      set({ error: message })
      if (err instanceof TypeError) {
        return { success: false, code: "NETWORK_ERROR", message }
      }
      return { success: false, code: "UNKNOWN_ERROR", message }
    } finally {
      set({ isLoading: false })
    }
  },

  resetPassword: async (data: ResetPasswordInput) => {
    const token = data.token.trim()
    if (!token) {
      set({
        error: "Link de redefinicao de senha invalido",
      })
      return {
        success: false,
        code: "AUTH_RESET_TOKEN_INVALID",
        message: "Link de redefinicao de senha invalido",
      }
    }

    set({ isLoading: true, error: null })
    try {
      const res = await fetch("/api/v1/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          password: data.password,
          passwordConfirmation: data.passwordConfirmation,
        }),
      })
      let responseData: unknown
      try {
        responseData = await res.json()
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
        responseData &&
        typeof responseData === "object" &&
        "message" in responseData &&
        typeof responseData.message === "string"
      ) {
        return { success: true, message: responseData.message }
      }

      const errorData = parseErrorResponse(responseData)
      if (errorData) {
        set({ error: errorData.message })
        return {
          success: false,
          code: normalizeResetPasswordCode(errorData.code),
          message: errorData.message,
        }
      }

      return {
        success: false,
        code: "UNEXPECTED_RESPONSE",
        message: "Resposta inesperada do servidor",
      }
    } catch (err) {
      const message = "Erro ao redefinir a senha"
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
