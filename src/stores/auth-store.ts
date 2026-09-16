"use client"

import type { RegisterInput, ResetPasswordInput } from "@/lib/validators/auth"
import { getSession, signIn, signOut } from "next-auth/react"
import { create } from "zustand"
import { persist, createJSONStorage } from "zustand/middleware"

export type UserRole = "USER" | "PROFESSIONAL" | "ADMIN"

interface User {
  id: string
  name: string
  email: string
  displayName: string | null
  role: UserRole
  plan: string
  avatar: string | null
  emailVerified: boolean
}

// C9: user parcial guardado no login com email nao verificado (sem role/plan etc.)
type StoredUser = User | PartialUser

export interface PartialUser {
  email: string
  emailVerified: false
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

export type VerifyEmailErrorCode =
  | "AUTH_EMAIL_VERIFY_INVALID"
  | "AUTH_EMAIL_VERIFY_EXPIRED"
  | "VALIDATION_ERROR"
  | "NETWORK_ERROR"
  | "UNEXPECTED_RESPONSE"
  | "UNKNOWN_ERROR"

export type VerifyEmailResult =
  | { success: true; message?: string }
  | {
      success: false
      code: VerifyEmailErrorCode
      message?: string
    }

export type VerifyMagicLinkErrorCode =
  | "AUTH_MAGIC_TOKEN_INVALID"
  | "AUTH_MAGIC_TOKEN_EXPIRED"
  | "VALIDATION_ERROR"
  | "NETWORK_ERROR"
  | "UNEXPECTED_RESPONSE"
  | "UNKNOWN_ERROR"

export type VerifyMagicLinkResult =
  | { success: true; user: User }
  | {
      success: false
      code: VerifyMagicLinkErrorCode
      message?: string
    }

export type { User }

// S12/decision: API auth success (login/verifyMagicLink) does not include emailVerified
// in the user payload -> the boolean derives as true when absent; if it is ever present,
// derive from `user.emailVerified !== null`.
function toStoredUser(userData: User): User {
  return { ...userData, emailVerified: userData.emailVerified ?? true }
}

// Rehydration guard: persisted localStorage is untrusted input (old/corrupted/tampered).
function isStoredUser(value: unknown): value is StoredUser {
  if (typeof value !== "object" || value === null) return false
  const v = value as { email?: unknown; emailVerified?: unknown }
  if (typeof v.email !== "string" || typeof v.emailVerified !== "boolean") {
    return false
  }
  return v.emailVerified === false || "role" in v
}

const KNOWN_ERROR_CODES = {
  magicLink: [
    "AUTH_MAGIC_LINK_RATE_LIMIT",
    "VALIDATION_ERROR",
    "NETWORK_ERROR",
    "UNEXPECTED_RESPONSE",
    "UNKNOWN_ERROR",
  ] as const,
  forgotPassword: [
    "AUTH_FORGOT_RATE_LIMIT",
    "VALIDATION_ERROR",
    "NETWORK_ERROR",
    "UNEXPECTED_RESPONSE",
    "UNKNOWN_ERROR",
  ] as const,
  resetPassword: [
    "AUTH_RESET_TOKEN_INVALID",
    "AUTH_RESET_TOKEN_EXPIRED",
    "VALIDATION_ERROR",
    "NETWORK_ERROR",
    "UNEXPECTED_RESPONSE",
    "UNKNOWN_ERROR",
  ] as const,
  verifyEmail: [
    "AUTH_EMAIL_VERIFY_INVALID",
    "AUTH_EMAIL_VERIFY_EXPIRED",
    "VALIDATION_ERROR",
    "NETWORK_ERROR",
    "UNEXPECTED_RESPONSE",
    "UNKNOWN_ERROR",
  ] as const,
  verifyMagicLink: [
    "AUTH_MAGIC_TOKEN_INVALID",
    "AUTH_MAGIC_TOKEN_EXPIRED",
    "VALIDATION_ERROR",
    "NETWORK_ERROR",
    "UNEXPECTED_RESPONSE",
    "UNKNOWN_ERROR",
  ] as const,
} as const

type KnownErrorCodeCategory = keyof typeof KNOWN_ERROR_CODES

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

function normalizeErrorCode<T extends string>(
  code: string,
  knownCodes: readonly T[],
): T {
  return knownCodes.includes(code as T) ? (code as T) : ("UNKNOWN_ERROR" as T)
}

async function authFetch<TErrorCode extends string>(
  endpoint: string,
  body: Record<string, unknown>,
  category: KnownErrorCodeCategory,
  successCheck: (data: unknown) => boolean,
  networkErrorMessage: string = "Erro de conexão",
): Promise<
  | { success: true; message: string }
  | { success: false; code: TErrorCode; message: string; retryAfter?: number }
> {
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    let data: unknown
    try {
      data = await res.json()
    } catch {
      return {
        success: false,
        code: "UNEXPECTED_RESPONSE" as TErrorCode,
        message: "Resposta inesperada do servidor",
      }
    }

    if (res.ok && successCheck(data)) {
      const message = (data as { message?: string }).message
      return {
        success: true,
        message: message ?? "Operação realizada com sucesso",
      }
    }

    const errorData = parseErrorResponse(data)
    if (errorData) {
      return {
        success: false,
        code: normalizeErrorCode<TErrorCode>(
          errorData.code,
          KNOWN_ERROR_CODES[category] as unknown as readonly TErrorCode[],
        ),
        message: errorData.message,
        ...(errorData.retryAfter !== undefined
          ? { retryAfter: errorData.retryAfter }
          : {}),
      }
    }

    return {
      success: false,
      code: "UNEXPECTED_RESPONSE" as TErrorCode,
      message: "Resposta inesperada do servidor",
    }
  } catch (err) {
    if (err instanceof TypeError) {
      return {
        success: false,
        code: "NETWORK_ERROR" as TErrorCode,
        message: networkErrorMessage,
      }
    }
    return {
      success: false,
      code: "UNKNOWN_ERROR" as TErrorCode,
      message: networkErrorMessage,
    }
  }
}

interface AuthState {
  user: StoredUser | null
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null
  refreshInFlight: Promise<boolean> | null
  login: (email: string, password: string) => Promise<void>
  register: (data: RegisterInput) => Promise<void>
  sendMagicLink: (email: string) => Promise<MagicLinkResult>
  forgotPassword: (email: string) => Promise<ForgotPasswordResult>
  resetPassword: (data: ResetPasswordInput) => Promise<ResetPasswordResult>
  verifyEmail: (token: string) => Promise<VerifyEmailResult>
  resendVerifyEmail: (email: string) => Promise<VerifyEmailResult>
  verifyMagicLink: (token: string) => Promise<VerifyMagicLinkResult>
  loginWithGoogle: () => void
  logout: () => Promise<void>
  deleteAccount: (email: string) => Promise<void>
  refreshSession: () => Promise<boolean>
  clearError: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (rawSet, get) => {
      let errorTimer: ReturnType<typeof setTimeout> | null = null

      const set: (
        partial:
          | AuthState
          | Partial<AuthState>
          | ((state: AuthState) => AuthState | Partial<AuthState>),
      ) => void = (partial) => {
        rawSet(partial)

        const nextError = get().error
        if (errorTimer) clearTimeout(errorTimer)
        errorTimer =
          nextError == null
            ? null
            : setTimeout(() => rawSet({ error: null }), 5000)
      }

      return {
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
        refreshInFlight: null,

        login: async (email: string, password: string) => {
          set({ isLoading: true, error: null })
          try {
            const res = await fetch("/api/v1/auth/login", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ email, password }),
            })
            const data = await res.json()

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
              if (userData.user && typeof userData.user === "object") {
                const storedUser = toStoredUser(userData.user)
                set({
                  user: storedUser,
                  isAuthenticated:
                    storedUser != null && storedUser.emailVerified,
                })
                return
              }
            }

            const errorData = parseErrorResponse(data)
            if (errorData) {
              set({ error: errorData.message })
              if (errorData.code === "AUTH_EMAIL_NOT_VERIFIED") {
                set({
                  user: { email: email.trim(), emailVerified: false },
                  isAuthenticated: false,
                })
              }
              throw new Error(errorData.code)
            }

            throw new Error("UNKNOWN_ERROR")
          } catch (err) {
            if (
              err instanceof Error &&
              err.message !== "AUTH_EMAIL_NOT_VERIFIED"
            ) {
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

            const res = await fetch("/api/v1/auth/register", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "x-csrf-token": csrfToken ?? "",
              },
              body: JSON.stringify(registerData),
            })
            const responseData = await res.json()

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
            if (
              err instanceof Error &&
              err.message !== "AUTH_EMAIL_ALREADY_EXISTS"
            ) {
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
            const result = await authFetch<MagicLinkErrorCode>(
              "/api/v1/auth/magic-link",
              { email: trimmed },
              "magicLink",
              (data): boolean =>
                data !== null &&
                typeof data === "object" &&
                "message" in data &&
                typeof (data as Record<string, unknown>).message === "string",
              "Erro ao enviar magic link",
            )
            if (!result.success) {
              set({ error: result.message })
            }
            return result
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
            const result = await authFetch<ForgotPasswordErrorCode>(
              "/api/v1/auth/forgot-password",
              { email: trimmed },
              "forgotPassword",
              (data): boolean =>
                data !== null &&
                typeof data === "object" &&
                "message" in data &&
                typeof (data as Record<string, unknown>).message === "string",
              "Erro ao enviar link de recuperacao",
            )
            if (!result.success) {
              set({ error: result.message })
            }
            return result
          } finally {
            set({ isLoading: false })
          }
        },

        resetPassword: async (data: ResetPasswordInput) => {
          const token = data.token.trim()
          if (!token) {
            set({ error: "Link de redefinicao de senha invalido" })
            return {
              success: false,
              code: "AUTH_RESET_TOKEN_INVALID",
              message: "Link de redefinicao de senha invalido",
            }
          }

          set({ isLoading: true, error: null })
          try {
            const result = await authFetch<ResetPasswordErrorCode>(
              "/api/v1/auth/reset-password",
              {
                token,
                password: data.password,
                passwordConfirmation: data.passwordConfirmation,
              },
              "resetPassword",
              (data): boolean =>
                data !== null &&
                typeof data === "object" &&
                "message" in data &&
                typeof (data as Record<string, unknown>).message === "string",
              "Erro ao redefinir a senha",
            )
            if (!result.success) {
              set({ error: result.message })
            }
            return result
          } finally {
            set({ isLoading: false })
          }
        },

        verifyEmail: async (token: string) => {
          const trimmed = token.trim()
          if (!trimmed) {
            return {
              success: false,
              code: "AUTH_EMAIL_VERIFY_INVALID",
              message: "Token de verificação de email inválido",
            }
          }

          try {
            const result = await authFetch<VerifyEmailErrorCode>(
              "/api/v1/auth/verify-email",
              { token: trimmed },
              "verifyEmail",
              (data): boolean =>
                data !== null &&
                typeof data === "object" &&
                "message" in data &&
                typeof (data as Record<string, unknown>).message === "string",
              "Erro ao verificar email",
            )
            return result
          } finally {
            // Don't set global isLoading for this action
          }
        },

        resendVerifyEmail: async (email: string) => {
          const trimmed = email.trim()
          if (!trimmed) {
            return {
              success: false,
              code: "VALIDATION_ERROR",
              message: "E-mail obrigatório",
            }
          }

          try {
            const result = await authFetch<VerifyEmailErrorCode>(
              "/api/v1/auth/verify-email/resend",
              { email: trimmed },
              "verifyEmail",
              (data): boolean =>
                data !== null &&
                typeof data === "object" &&
                "message" in data &&
                typeof (data as Record<string, unknown>).message === "string",
              "Erro ao reenviar email de verificação",
            )
            return result
          } finally {
            // Don't set global isLoading for this action
          }
        },

        verifyMagicLink: async (token: string) => {
          const trimmed = token.trim()
          if (!trimmed) {
            return {
              success: false,
              code: "AUTH_MAGIC_TOKEN_INVALID",
              message: "Token de magic link inválido",
            }
          }

          try {
            const res = await fetch("/api/v1/auth/magic-link/verify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify({ token: trimmed }),
            })
            let data: unknown
            try {
              data = await res.json()
            } catch {
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
              "accessToken" in data &&
              typeof data.accessToken === "string" &&
              "user" in data &&
              typeof data.user === "object" &&
              data.user !== null
            ) {
              const userData = data as { accessToken: string; user: User }
              if (userData.user && typeof userData.user === "object") {
                const storedUser = toStoredUser(userData.user)
                set({
                  user: storedUser,
                  isAuthenticated:
                    storedUser != null && storedUser.emailVerified,
                })
                return { success: true, user: storedUser }
              }
            }

            const errorData = parseErrorResponse(data)
            if (errorData) {
              return {
                success: false,
                code: normalizeErrorCode<VerifyMagicLinkErrorCode>(
                  errorData.code,
                  KNOWN_ERROR_CODES.verifyMagicLink as readonly VerifyMagicLinkErrorCode[],
                ),
                message: errorData.message,
              }
            }

            return {
              success: false,
              code: "UNEXPECTED_RESPONSE",
              message: "Resposta inesperada do servidor",
            }
          } catch (err) {
            if (err instanceof TypeError) {
              return {
                success: false,
                code: "NETWORK_ERROR",
                message: "Erro ao verificar magic link",
              }
            }
            return {
              success: false,
              code: "UNKNOWN_ERROR",
              message: "Erro ao verificar magic link",
            }
          }
        },

        refreshSession: () => {
          const { refreshInFlight } = get()
          if (refreshInFlight) return refreshInFlight

          let resolveOuter: (value: boolean) => void
          const promise = new Promise<boolean>((resolve) => {
            resolveOuter = resolve
          })

          const executeRefresh = async () => {
            set({ isLoading: true, error: null })
            try {
              const controller = new AbortController()
              const timeoutId = setTimeout(() => controller.abort(), 10000)

              const res = await fetch("/api/v1/auth/refresh", {
                method: "POST",
                credentials: "include",
                signal: controller.signal,
              })
              clearTimeout(timeoutId)

              let data: unknown
              try {
                data = await res.json()
              } catch {
                set({
                  user: null,
                  isAuthenticated: false,
                  error: "Resposta inesperada do servidor",
                })
                return false
              }

              if (
                res.ok &&
                data &&
                typeof data === "object" &&
                "accessToken" in data &&
                typeof data.accessToken === "string"
              ) {
                const currentUser = get().user
                set({
                  isAuthenticated:
                    currentUser != null && currentUser.emailVerified === true,
                })
                return true
              }

              const errorData = parseErrorResponse(data)
              set({
                user: null,
                isAuthenticated: false,
                error: errorData?.message ?? "Sessao expirada",
              })
              return false
            } catch (err) {
              if (err instanceof TypeError) {
                set({ error: "Erro ao reconectar sessao" })
                return false
              }
              set({
                user: null,
                isAuthenticated: false,
                error: "Sessao expirada",
              })
              return false
            } finally {
              set({ isLoading: false })
            }
          }

          executeRefresh().then((result) => {
            set({ refreshInFlight: null })
            resolveOuter!(result)
          })

          set({ refreshInFlight: promise })
          return promise
        },

        loginWithGoogle: () => {
          void signIn("google", { callbackUrl: "/dashboard" }).catch((err) => {
            if (!(err instanceof Error && err.message === "NEXT_REDIRECT")) {
              set({ error: "Erro ao entrar com Google" })
            }
          })
        },

        logout: async () => {
          set({ isLoading: true, error: null })
          try {
            const session = await getSession()
            const accessToken = (session as { accessToken?: string } | null)
              ?.accessToken
            if (accessToken) {
              await fetch("/api/v1/auth/logout", {
                method: "POST",
                headers: { Authorization: `Bearer ${accessToken}` },
              })
            }
          } catch {
            // melhor esforco: mesmo sem revogar no servidor, encerra a sessao local
          } finally {
            await signOut({ redirect: false })
            set({ user: null, isAuthenticated: false, isLoading: false })
          }
        },

        deleteAccount: async (email: string) => {
          set({ isLoading: true, error: null })
          try {
            const session = await getSession()
            const accessToken = (session as { accessToken?: string } | null)
              ?.accessToken
            if (!accessToken) {
              set({
                error: "Sessao expirada, faca login novamente",
                isLoading: false,
              })
              return
            }
            const res = await fetch("/api/v1/auth/account", {
              method: "DELETE",
              headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ email: email.trim() }),
            })
            if (!res.ok) {
              set({ error: "Erro ao excluir conta", isLoading: false })
              return
            }
            await signOut({ redirect: false })
            set({ user: null, isAuthenticated: false, isLoading: false })
          } catch {
            set({ error: "Erro ao excluir conta", isLoading: false })
          }
        },

        clearError: () => set({ error: null }),
      }
    },
    {
      name: "arkana-auth",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ user: state.user }),
      merge: (persistedState, currentState) => {
        const persisted = persistedState as { user?: unknown } | undefined
        const user = isStoredUser(persisted?.user) ? persisted.user : null
        return {
          ...currentState,
          user,
          isAuthenticated: user != null && user.emailVerified,
        }
      },
    },
  ),
)
