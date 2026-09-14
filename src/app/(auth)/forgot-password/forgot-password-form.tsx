"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2, Send } from "lucide-react"
import Link from "next/link"
import { useState } from "react"
import { useForm } from "react-hook-form"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  forgotPasswordSchema,
  type ForgotPasswordInput,
} from "@/lib/validators/auth"
import { useAuthStore, type ForgotPasswordErrorCode } from "@/stores/auth-store"

const SERVER_ERROR_MESSAGES: Partial<Record<ForgotPasswordErrorCode, string>> =
  {
    AUTH_FORGOT_RATE_LIMIT:
      "Muitos pedidos de recuperacao de senha, tente novamente mais tarde",
    VALIDATION_ERROR: "E-mail invalido",
    NETWORK_ERROR: "Erro ao enviar link de recuperacao",
    UNEXPECTED_RESPONSE: "Resposta inesperada do servidor",
    UNKNOWN_ERROR: "Erro inesperado, tente novamente",
  }

function getErrorMessage(code?: ForgotPasswordErrorCode): string {
  return (
    (code
      ? SERVER_ERROR_MESSAGES[code]
      : SERVER_ERROR_MESSAGES.UNKNOWN_ERROR) ??
    "Erro ao enviar link de recuperacao"
  )
}

export function ForgotPasswordForm() {
  const forgotPassword = useAuthStore((state) => state.forgotPassword)
  const [serverError, setServerError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  })

  async function onSubmit(data: ForgotPasswordInput) {
    setServerError(null)
    const result = await forgotPassword(data.email)
    if (result.success) {
      setSuccessMessage(result.message ?? null)
      return
    }
    setServerError(getErrorMessage(result.code))
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4" noValidate>
      {successMessage ? (
        <div
          role="status"
          aria-live="polite"
          className="flex flex-col items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-4"
        >
          <Send className="h-8 w-8 text-green-500" aria-hidden="true" />
          <p className="text-center font-medium text-green-700">
            {successMessage}
          </p>
          <Link href="/login" className="text-sm text-primary hover:underline">
            Voltar ao login
          </Link>
        </div>
      ) : (
        <>
          <div className="grid gap-2">
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              maxLength={254}
              placeholder="voce@email.com"
              aria-invalid={!!errors.email}
              aria-describedby={errors.email ? "email-error" : undefined}
              {...register("email")}
            />
            {errors.email && (
              <p
                id="email-error"
                role="alert"
                className="text-sm font-medium text-destructive"
              >
                {errors.email.message}
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
                Enviando...
              </>
            ) : (
              <>
                <Send className="mr-2 h-4 w-4" />
                Enviar link de recuperacao
              </>
            )}
          </Button>

          <p className="text-center text-sm text-muted-foreground">
            Lembrou a senha?{" "}
            <Link href="/login" className="text-primary hover:underline">
              Entrar
            </Link>
          </p>
        </>
      )}
    </form>
  )
}
