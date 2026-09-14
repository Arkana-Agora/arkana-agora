"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { KeyRound, Loader2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  resetPasswordFormSchema,
  type ResetPasswordFormInput,
} from "@/lib/validators/auth"
import { useAuthStore, type ResetPasswordErrorCode } from "@/stores/auth-store"

const REDIRECT_DELAY_MS = 2000
const DEFAULT_SUCCESS_MESSAGE = "Senha redefinida com sucesso"

const SERVER_ERROR_MESSAGES: Record<ResetPasswordErrorCode, string> = {
  AUTH_RESET_TOKEN_INVALID: "Link de redefinicao de senha invalido",
  AUTH_RESET_TOKEN_EXPIRED:
    "Sessao de redefinicao expirada, solicite um novo link",
  VALIDATION_ERROR: "Dados de entrada invalidos",
  NETWORK_ERROR: "Erro ao redefinir a senha",
  UNEXPECTED_RESPONSE: "Resposta inesperada do servidor",
  UNKNOWN_ERROR: "Erro inesperado, tente novamente",
}

function getErrorMessage(code?: ResetPasswordErrorCode): string {
  return code
    ? SERVER_ERROR_MESSAGES[code]
    : SERVER_ERROR_MESSAGES.UNKNOWN_ERROR
}

export function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter()
  const resetPassword = useAuthStore((state) => state.resetPassword)
  const [serverError, setServerError] = useState<string | null>(null)
  const [isSuccess, setIsSuccess] = useState(false)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordFormInput>({
    resolver: zodResolver(resetPasswordFormSchema),
    defaultValues: { password: "", passwordConfirmation: "" },
  })

  useEffect(() => {
    if (!isSuccess) return
    window.history.replaceState(window.history.state, "", "/reset-password")
    const timer = setTimeout(() => router.replace("/login"), REDIRECT_DELAY_MS)
    return () => clearTimeout(timer)
  }, [isSuccess, router])

  async function onSubmit(data: ResetPasswordFormInput) {
    setServerError(null)
    const result = await resetPassword({
      token,
      password: data.password,
      passwordConfirmation: data.passwordConfirmation,
    })
    if (result.success) {
      setIsSuccess(true)
      setSuccessMessage(result.message || DEFAULT_SUCCESS_MESSAGE)
      return
    }
    setServerError(getErrorMessage(result.code))
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4" noValidate>
      {isSuccess ? (
        <div
          role="status"
          aria-live="polite"
          className="flex flex-col items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-4"
        >
          <KeyRound className="h-8 w-8 text-green-500" aria-hidden="true" />
          <p className="text-center font-medium text-green-700">
            {successMessage}
          </p>
          <p className="text-sm text-muted-foreground">
            Redirecionando para o login...
          </p>
        </div>
      ) : (
        <>
          <div className="grid gap-2">
            <Label htmlFor="password">Nova senha</Label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              placeholder="Pelo menos 8 caracteres"
              aria-invalid={!!errors.password}
              aria-describedby={errors.password ? "password-error" : undefined}
              {...register("password")}
            />
            {errors.password && (
              <p
                id="password-error"
                role="alert"
                className="text-sm font-medium text-destructive"
              >
                {errors.password.message}
              </p>
            )}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="passwordConfirmation">Confirmar nova senha</Label>
            <Input
              id="passwordConfirmation"
              type="password"
              autoComplete="new-password"
              aria-invalid={!!errors.passwordConfirmation}
              aria-describedby={
                errors.passwordConfirmation
                  ? "passwordConfirmation-error"
                  : undefined
              }
              {...register("passwordConfirmation")}
            />
            {errors.passwordConfirmation && (
              <p
                id="passwordConfirmation-error"
                role="alert"
                className="text-sm font-medium text-destructive"
              >
                {errors.passwordConfirmation.message}
              </p>
            )}
          </div>

          {serverError && (
            <p role="alert" className="text-sm font-medium text-destructive">
              {serverError}
            </p>
          )}

          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Redefinindo...
              </>
            ) : (
              <>
                <KeyRound className="mr-2 h-4 w-4" />
                Redefinir senha
              </>
            )}
          </Button>
        </>
      )}
    </form>
  )
}
