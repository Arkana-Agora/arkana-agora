"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2, Mail } from "lucide-react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useCallback, useEffect, useRef, useState } from "react"
import { useForm } from "react-hook-form"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

import { verifyEmailSchema, type VerifyEmailInput } from "@/lib/validators/auth"
import { useAuthStore, type VerifyEmailErrorCode } from "@/stores/auth-store"

const RESEND_COOLDOWN_SECONDS = 60
const REDIRECT_DELAY_MS = 2500

const SERVER_ERROR_MESSAGES: Record<VerifyEmailErrorCode, string> = {
  AUTH_EMAIL_VERIFY_INVALID: "Token de verificação de email inválido",
  AUTH_EMAIL_VERIFY_EXPIRED:
    "Token de verificação de email expirado, solicite um novo email de verificação",
  VALIDATION_ERROR: "Dados de entrada inválidos",
  NETWORK_ERROR: "Erro ao verificar email",
  UNEXPECTED_RESPONSE: "Resposta inesperada do servidor",
  UNKNOWN_ERROR: "Erro inesperado, tente novamente",
}

function getErrorMessage(code?: VerifyEmailErrorCode): string {
  return code
    ? SERVER_ERROR_MESSAGES[code]
    : SERVER_ERROR_MESSAGES.UNKNOWN_ERROR
}

function getSuccessMessage(message?: string): string {
  return message ?? "Email verificado com sucesso"
}

export function VerifyEmailForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get("token")

  const verifyEmail = useAuthStore((state) => state.verifyEmail)
  const resendVerifyEmail = useAuthStore((state) => state.resendVerifyEmail)

  const [serverError, setServerError] = useState<string | null>(null)
  const [isSuccess, setIsSuccess] = useState(false)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [isResending, setIsResending] = useState(false)
  const [countdown, setCountdown] = useState(0)
  const isResendingRef = useRef(false)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<VerifyEmailInput>({
    resolver: zodResolver(verifyEmailSchema),
    defaultValues: { token: token ?? "" },
  })

  useEffect(() => {
    if (countdown <= 0) return

    let isMountedRef = true
    const timer = setTimeout(() => {
      if (isMountedRef) {
        setCountdown((value) => value - 1)
      }
    }, 1000)

    return () => {
      clearTimeout(timer)
      isMountedRef = false
    }
  }, [countdown])

  const verifyRef = useRef(false)

  const handleSuccess = useCallback(
    (message?: string) => {
      setIsSuccess(true)
      setSuccessMessage(getSuccessMessage(message))
      setTimeout(() => router.push("/login"), REDIRECT_DELAY_MS)
    },
    [router],
  )

  const verifyRequest = useCallback(
    async (tokenValue: string) => {
      setServerError(null)
      const result = await verifyEmail(tokenValue)
      if (result.success) {
        handleSuccess(result.message)
        return
      }
      setServerError(getErrorMessage(result.code))
    },
    [verifyEmail, handleSuccess],
  )

  useEffect(() => {
    if (verifyRef.current || !token || isSuccess) return
    verifyRef.current = true
    verifyRequest(token)
  }, [token, isSuccess, verifyRequest])

  async function onSubmit(data: VerifyEmailInput) {
    await verifyRequest(data.token)
  }

  async function handleResend() {
    if (isResendingRef.current) return
    isResendingRef.current = true
    setIsResending(true)
    const email = searchParams.get("email")
    if (!email) {
      setServerError("E-mail não encontrado na URL")
      setIsResending(false)
      isResendingRef.current = false
      return
    }
    try {
      setServerError(null)
      const result = await resendVerifyEmail(email)
      if (result.success) {
        setCountdown(RESEND_COOLDOWN_SECONDS)
      } else {
        setServerError(getErrorMessage(result.code))
      }
    } finally {
      setIsResending(false)
      isResendingRef.current = false
    }
  }

  const isSending = isSubmitting || isResending
  const resendDisabled = countdown > 0 || isSending
  const resendLabel =
    countdown > 0 ? `Reenviar em ${countdown}s` : "Enviar email novamente"

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <div className="space-y-2">
          <Label htmlFor="token">Token de verificação</Label>
          <Input
            id="token"
            type="text"
            autoComplete="one-time-code"
            placeholder="Cole o token aqui"
            aria-invalid={!!errors.token}
            aria-describedby={errors.token ? "token-error" : undefined}
            {...register("token")}
            disabled={isSuccess}
          />
          {errors.token && (
            <p
              id="token-error"
              role="alert"
              className="text-sm font-medium text-destructive"
            >
              {errors.token.message}
            </p>
          )}
        </div>

        {serverError && (
          <Alert variant="destructive">
            <AlertTitle>Erro</AlertTitle>
            <AlertDescription>{serverError}</AlertDescription>
          </Alert>
        )}

        <Button type="submit" disabled={isSending || isSuccess}>
          {isSending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Verificando...
            </>
          ) : (
            <>
              <Mail className="mr-2 h-4 w-4" />
              Verificar email
            </>
          )}
        </Button>
      </form>

      {isSuccess && (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center gap-2">
              <Mail
                className="h-12 w-12 text-green-500 animate-pulse"
                aria-hidden="true"
              />
              <p className="text-center font-medium text-green-700">
                {successMessage}
              </p>
              <p className="text-sm text-muted-foreground">
                Redirecionando para o login...
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {!isSuccess && (
        <Button
          type="button"
          variant="outline"
          onClick={handleResend}
          disabled={resendDisabled}
          className="w-full"
        >
          {resendLabel}
        </Button>
      )}

      <p className="text-center text-sm text-muted-foreground">
        Ja possui uma conta?{" "}
        <Link href="/login" className="text-primary hover:underline">
          Entrar
        </Link>
      </p>
    </div>
  )
}
