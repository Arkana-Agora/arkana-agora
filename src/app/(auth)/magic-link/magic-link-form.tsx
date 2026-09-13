"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2, Mail, Send } from "lucide-react"
import Link from "next/link"
import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { magicLinkSchema, type MagicLinkInput } from "@/lib/validators/auth"
import { useAuthStore, type MagicLinkErrorCode } from "@/stores/auth-store"

const RESEND_COOLDOWN_SECONDS = 60

const SERVER_ERROR_MESSAGES: Partial<Record<MagicLinkErrorCode, string>> = {
  AUTH_MAGIC_LINK_RATE_LIMIT: "Muitos magic links solicitados, tente novamente mais tarde",
  NETWORK_ERROR: "Erro ao enviar magic link",
  UNEXPECTED_RESPONSE: "Resposta inesperada do servidor",
  UNKNOWN_ERROR: "Erro inesperado, tente novamente",
}

function getErrorMessage(code?: MagicLinkErrorCode): string {
  return (code ? SERVER_ERROR_MESSAGES[code] : SERVER_ERROR_MESSAGES.UNKNOWN_ERROR) ?? "Erro ao enviar magic link"
}

export function MagicLinkForm() {
  const sendMagicLink = useAuthStore((state) => state.sendMagicLink)
  const [serverError, setServerError] = useState<string | null>(null)
  const [sendSuccess, setSendSuccess] = useState(false)
  const [isResending, setIsResending] = useState(false)
  const [countdown, setCountdown] = useState(0)

  const {
    register,
    getValues,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<MagicLinkInput>({
    resolver: zodResolver(magicLinkSchema),
    defaultValues: { email: "" },
  })

  useEffect(() => {
    if (countdown <= 0) return
    const timer = setTimeout(() => setCountdown((value) => value - 1), 1000)
    return () => clearTimeout(timer)
  }, [countdown])

  const handleSuccess = () => {
    setSendSuccess(true)
    setCountdown(RESEND_COOLDOWN_SECONDS)
  }

  async function sendRequest(email: string) {
    setServerError(null)
    const result = await sendMagicLink(email)
    if (result.success) {
      handleSuccess()
      return
    }
    setServerError(getErrorMessage(result.code))
  }

  async function onSubmit(data: MagicLinkInput) {
    await sendRequest(data.email)
  }

  async function handleResend() {
    const email = getValues("email").trim()
    if (!email) return
    setIsResending(true)
    try {
      await sendRequest(email)
    } finally {
      setIsResending(false)
    }
  }

  const isSending = isSubmitting || isResending
  const resendDisabled = countdown > 0 || isSending
  const resendLabel =
    countdown > 0 ? `Reenviar em ${countdown}s` : "Enviar link novamente"

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4" noValidate>
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
          <p id="email-error" role="alert" className="text-sm font-medium text-destructive">
            {errors.email.message}
          </p>
        )}
      </div>

      {!sendSuccess && (
        <p className="text-sm text-muted-foreground">
          Enviamos um link de acesso para seu email
        </p>
      )}

      {serverError && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {serverError}
        </p>
      )}

      <Button type="submit" disabled={isSending}>
        {isSending ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Enviando...
          </>
        ) : (
          <>
            <Send className="mr-2 h-4 w-4" />
            Enviar link
          </>
        )}
      </Button>

      {sendSuccess && (
        <>
          <div
            role="status"
            className="flex flex-col items-center gap-2 p-4 rounded-lg bg-green-50 border border-green-200"
          >
            <Mail
              data-testid="envelope-icon"
              className="h-12 w-12 text-green-500 animate-pulse"
              aria-hidden="true"
            />
            <p className="text-center font-medium text-green-700">
              Verifique sua caixa de entrada
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={handleResend}
            disabled={resendDisabled}
            className="w-full"
          >
            {resendLabel}
          </Button>
        </>
      )}

      <p className="text-center text-sm text-muted-foreground">
        Ja possui uma conta?{" "}
        <Link href="/login" className="text-primary hover:underline">
          Entrar
        </Link>
      </p>
    </form>
  )
}