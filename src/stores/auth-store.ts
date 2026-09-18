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

export interface AuthSuccessMessage {
  success: true
  message?: string
}

export interface AuthFailureMessage<TErrorCode extends string> {
  success: false
  code: TErrorCode
  message: string
  retryAfter?: number
}

export type AuthResult<TErrorCode extends string> =
  AuthSuccessMessage | AuthFailureMessage<TErrorCode>

export type MagicLinkErrorCode =
  | "AUTH_MAGIC_LINK_RATE_LIMIT"
  | "VALIDATION_ERROR"
  | "NETWORK_ERROR"
  | "UNEXPECTED_RESPONSE"
  | "UNKNOWN_ERROR"

export type MagicLinkResult = AuthResult<MagicLinkErrorCode>

export type ForgotPasswordErrorCode =
  | "AUTH_FORGOT_RATE_LIMIT"
  | "VALIDATION_ERROR"
  | "NETWORK_ERROR"
  | "UNEXPECTED_RESPONSE"
  | "UNKNOWN_ERROR"

export type ForgotPasswordResult = AuthResult<ForgotPasswordErrorCode>

export type ResetPasswordErrorCode =
  | "AUTH_RESET_TOKEN_INVALID"
  | "AUTH_RESET_TOKEN_EXPIRED"
  | "VALIDATION_ERROR"
  | "NETWORK_ERROR"
  | "UNEXPECTED_RESPONSE"
  | "UNKNOWN_ERROR"

export type ResetPasswordResult = AuthResult<ResetPasswordErrorCode>

export type VerifyEmailErrorCode =
  | "AUTH_EMAIL_VERIFY_INVALID"
  | "AUTH_EMAIL_VERIFY_EXPIRED"
  | "VALIDATION_ERROR"
  | "NETWORK_ERROR"
  | "UNEXPECTED_RESPONSE"
  | "UNKNOWN_ERROR"

export type VerifyEmailResult = AuthResult<VerifyEmailErrorCode>

export type VerifyMagicLinkErrorCode =
  | "AUTH_MAGIC_TOKEN_INVALID"
  | "AUTH_MAGIC_TOKEN_EXPIRED"
  | "VALIDATION_ERROR"
  | "NETWORK_ERROR"
  | "UNEXPECTED_RESPONSE"
  | "UNKNOWN_ERROR"

export type VerifyMagicLinkResult =
  { success: true; user: User } | AuthFailureMessage<VerifyMagicLinkErrorCode>

export type { User }

const VALID_ROLES: readonly UserRole[] = ["USER", "PROFESSIONAL", "ADMIN"]

// S12/decision: API auth success (login/verifyMagicLink) omits emailVerified.
// Ausente -> true (S12); presente -> usa o boolean real (null conta como false).
type AuthUserPayload = Omit<User, "emailVerified"> & {
  emailVerified?: boolean | null
}

function toStoredUser(userData: AuthUserPayload): User {
  return {
    ...userData,
    emailVerified:
      userData.emailVerified === undefined
        ? true
        : userData.emailVerified === true,
  }
}

function getCsrfTokenFromBrowser(): string {
  const isSecure = window.location.protocol === "https:"
  const csrfCookieName = isSecure ? "__Host-csrf-token" : "csrf-token"
  return (
    document.cookie
      .split("; ")
      .find((row) => row.startsWith(`${csrfCookieName}=`))
      ?.split("=")
      .slice(1)
      .join("=") ?? ""
  )
}

// Guard de reidratacao: localStorage e input nao confiavel (antigo/corrompido/adulterado).
function isStoredUser(value: unknown): value is StoredUser {
  if (typeof value !== "object" || value === null) return false
  const v = value as Record<string, unknown>
  if (typeof v.email !== "string" || typeof v.emailVerified !== "boolean") {
    return false
  }
  if (v.emailVerified === false) {
    // PartialUser (C9): apenas email + emailVerified
    return true
  }
  return (
    typeof v.id === "string" &&
    typeof v.name === "string" &&
    (typeof v.displayName === "string" || v.displayName === null) &&
    typeof v.role === "string" &&
    VALID_ROLES.includes(v.role as UserRole) &&
    typeof v.plan === "string" &&
    (typeof v.avatar === "string" || v.avatar === null)
  )
}

// Extrai o payload de sucesso comum a login/verifyMagicLink (accessToken + user).
function parseAuthSuccessPayload(data: unknown): AuthUserPayload | null {
  if (
    data &&
    typeof data === "object" &&
    "accessToken" in data &&
    typeof data.accessToken === "string" &&
    "user" in data &&
    typeof data.user === "object" &&
    data.user !== null
  ) {
    return (data as { accessToken: string; user: AuthUserPayload }).user
  }
  return null
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

function normalizeErrorCode(
  code: string,
  knownCodes: readonly string[],
): string {
  return knownCodes.includes(code) ? code : "UNKNOWN_ERROR"
}

function hasMessage(data: unknown): data is { message: string } {
  return (
    data !== null &&
    typeof data === "object" &&
    "message" in data &&
    typeof (data as Record<string, unknown>).message === "string"
  )
}

function asAuthFailure<TErrorCode extends string>(
  data: unknown,
  category: KnownErrorCodeCategory,
  fallbackMessage: string,
): AuthFailureMessage<TErrorCode> {
  const errorData = parseErrorResponse(data)
  if (errorData) {
    return {
      success: false,
      code: normalizeErrorCode(
        errorData.code,
        KNOWN_ERROR_CODES[category],
      ) as TErrorCode,
      message: errorData.message,
      ...(errorData.retryAfter !== undefined
        ? { retryAfter: errorData.retryAfter }
        : {}),
    }
  }
  return {
    success: false,
    code: "UNEXPECTED_RESPONSE" as TErrorCode,
    message: fallbackMessage,
  }
}

// Bearer para endpoints autenticados: sessao Auth.js -> access token validado.
async function getAccessToken(): Promise<string | null> {
  const session = await getSession()
  const accessToken = (session as { accessToken?: string } | null)?.accessToken
  return typeof accessToken === "string" ? accessToken : null
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

    return asAuthFailure<TErrorCode>(
      data,
      category,
      "Resposta inesperada do servidor",
    )
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
        const prevError = get().error
        rawSet(partial)

        const nextError = get().error
        if (nextError == null) {
          if (errorTimer) clearTimeout(errorTimer)
          errorTimer = null
          return
        }
        if (prevError !== nextError) {
          if (errorTimer) clearTimeout(errorTimer)
          errorTimer = setTimeout(() => rawSet({ error: null }), 5000)
        }
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
            const csrfToken = getCsrfTokenFromBrowser()

            const res = await fetch("/api/v1/auth/login", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "x-csrf-token": csrfToken ?? "",
              },
              body: JSON.stringify({ email, password }),
            })
            let data: unknown
            try {
              data = await res.json()
            } catch {
              set({ error: "Erro ao fazer login" })
              throw new Error("NETWORK_ERROR")
            }

            if (res.ok) {
              const payload = parseAuthSuccessPayload(data)
              if (payload) {
                const storedUser = toStoredUser(payload)
                set({
                  user: storedUser,
                  isAuthenticated: storedUser.emailVerified,
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
            const csrfToken = getCsrfTokenFromBrowser()

            const res = await fetch("/api/v1/auth/register", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "x-csrf-token": csrfToken ?? "",
              },
              body: JSON.stringify(registerData),
            })
            let responseData: unknown
            try {
              responseData = await res.json()
            } catch {
              set({ error: "Erro ao criar conta" })
              throw new Error("NETWORK_ERROR")
            }

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
              hasMessage,
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
              hasMessage,
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
              hasMessage,
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

          // Nao usa isLoading global: nao bloqueia a tela durante a verificacao
          return authFetch<VerifyEmailErrorCode>(
            "/api/v1/auth/verify-email",
            { token: trimmed },
            "verifyEmail",
            hasMessage,
            "Erro ao verificar email",
          )
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

          // Nao usa isLoading global: nao bloqueia a tela durante o reenvio
          return authFetch<VerifyEmailErrorCode>(
            "/api/v1/auth/verify-email/resend",
            { email: trimmed },
            "verifyEmail",
            hasMessage,
            "Erro ao reenviar email de verificação",
          )
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

            if (res.ok) {
              const payload = parseAuthSuccessPayload(data)
              if (payload) {
                const storedUser = toStoredUser(payload)
                set({
                  user: storedUser,
                  isAuthenticated: storedUser.emailVerified,
                })
                return { success: true, user: storedUser }
              }
            }

            return asAuthFailure<VerifyMagicLinkErrorCode>(
              data,
              "verifyMagicLink",
              "Resposta inesperada do servidor",
            )
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
                const serverUser =
                  "user" in data &&
                  typeof data.user === "object" &&
                  data.user !== null
                    ? (data.user as AuthUserPayload)
                    : null
                if (serverUser) {
                  const storedUser = toStoredUser(serverUser)
                  set({
                    user: storedUser,
                    isAuthenticated: storedUser.emailVerified,
                  })
                } else {
                  // Fallback: servidor retornou accessToken mas sem user
                  // (nao deveria happen apos F1; limpa por seguranca)
                  set({
                    user: null,
                    isAuthenticated: false,
                  })
                }
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

          executeRefresh()
            .then((result) => {
              set({ refreshInFlight: null })
              resolveOuter!(result)
            })
            .catch(() => {
              set({ refreshInFlight: null })
              resolveOuter!(false)
            })

          set({ refreshInFlight: promise })
          return promise
        },

        loginWithGoogle: () => {
          set({ isLoading: true, error: null })
          void signIn("google", { callbackUrl: "/dashboard" }).catch((err) => {
            if (!(err instanceof Error && err.message === "NEXT_REDIRECT")) {
              set({ error: "Erro ao entrar com Google", isLoading: false })
            }
          })
        },

        logout: async () => {
          set({ isLoading: true, error: null })
          try {
            const accessToken = await getAccessToken()
            if (accessToken) {
              await fetch("/api/v1/auth/logout", {
                method: "POST",
                headers: { Authorization: `Bearer ${accessToken}` },
              })
            }
          } catch {
            // melhor esforco: mesmo sem revogar no servidor, encerra a sessao local
          } finally {
            try {
              await signOut({ redirect: false })
            } catch {
              // melhor esforco: Auth.js pode falhar; encerra o estado local abaixo
            }
            set({ user: null, isAuthenticated: false, isLoading: false })
          }
        },

        deleteAccount: async (email: string) => {
          set({ isLoading: true, error: null })
          try {
            const accessToken = await getAccessToken()
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
              body: JSON.stringify({ email: email.trim().toLowerCase() }),
            })
            if (!res.ok) {
              set({ error: "Erro ao excluir conta", isLoading: false })
              return
            }
            try {
              await signOut({ redirect: false })
            } catch {
              // conta ja excluida; encerra o estado local abaixo mesmo assim
            }
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
