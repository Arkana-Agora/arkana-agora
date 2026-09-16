"use client"

import { AlertCircle } from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"
import { useEffect, useRef, useState } from "react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useAuthStore } from "@/stores/auth-store"

const SERVER_ERROR_MESSAGES = {
  AUTH_MAGIC_TOKEN_INVALID: "Token de magic link inválido",
  AUTH_MAGIC_TOKEN_EXPIRED: "Token de magic link expirado",
  VALIDATION_ERROR: "Dados de entrada inválidos",
  NETWORK_ERROR: "Erro ao verificar magic link",
  UNEXPECTED_RESPONSE: "Resposta inesperada do servidor",
  UNKNOWN_ERROR: "Erro inesperado, tente novamente",
} as const

type ServerErrorCode = keyof typeof SERVER_ERROR_MESSAGES

function getErrorMessage(code?: string): string {
  if (!code) return SERVER_ERROR_MESSAGES.UNKNOWN_ERROR
  return (
    SERVER_ERROR_MESSAGES[code as ServerErrorCode] ??
    SERVER_ERROR_MESSAGES.UNKNOWN_ERROR
  )
}

function LoadingState() {
  return <LoadingState />
}

export default function MagicLinkCallbackPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get("token") ?? ""
  const verifyMagicLink = useAuthStore((state) => state.verifyMagicLink)

  const [serverError, setServerError] = useState<string | null>(null)
  const [isVerifying, setIsVerifying] = useState(true)
  const startedRef = useRef(false)

  useEffect(() => {
    if (startedRef.current) return
    startedRef.current = true

    async function verifyMagicLinkToken() {
      if (!token) {
        setServerError("Token não fornecido na URL")
        setIsVerifying(false)
        return
      }

      try {
        const result = await verifyMagicLink(token)
        if (result.success) {
          router.push("/dashboard")
          return
        }
        setServerError(getErrorMessage(result.code))
      } catch (err) {
        if (err instanceof TypeError) {
          setServerError("Erro ao conectar ao servidor")
        } else {
          setServerError("Erro inesperado, tente novamente")
        }
      } finally {
        setIsVerifying(false)
      }
    }

    verifyMagicLinkToken()
  }, [token, router, verifyMagicLink])

  if (isVerifying) {
    return <LoadingState />
  }

  if (serverError) {
    return (
      <main className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle>Erro ao verificar magic link</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" aria-hidden="true" />
              <AlertTitle>Erro</AlertTitle>
              <AlertDescription>{serverError}</AlertDescription>
            </Alert>
            <div className="space-y-2">
              <p className="text-sm text-center text-muted-foreground">
                Tente solicitar um novo magic link ou faça login com email e
                senha.
              </p>
              <Button onClick={() => router.push("/login")} className="w-full">
                Ir para login
              </Button>
              <Button
                variant="outline"
                onClick={() => router.push("/magic-link")}
                className="w-full"
              >
                Solicitar novo magic link
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    )
  }

  return <LoadingState />
}
