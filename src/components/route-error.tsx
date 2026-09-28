"use client"

import { useEffect } from "react"

import Link from "next/link"

import * as Sentry from "@sentry/nextjs"

import { AlertTriangle, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"

export interface RouteErrorProps {
  error: Error & { digest?: string }
  reset: () => void
}

/**
 * Fallback compartilhado dos `error.tsx` do App Router (T039/US-020).
 * `reset` re-renderiza a rota; o digest (se houver) aparece em produção.
 */
export function RouteError({ error, reset }: RouteErrorProps) {
  useEffect(() => {
    console.error("[route-error]", error)
    // Erros engolidos por error boundary não chegam ao onerror global do SDK —
    // captura explícita aqui (no-op sem DSN, gate do F4).
    Sentry.captureException(error)
  }, [error])

  return (
    <div
      className="flex min-h-[50vh] items-center justify-center p-4"
      role="alert"
    >
      <div className="w-full max-w-md space-y-4 text-center">
        <AlertTriangle className="mx-auto h-12 w-12 text-destructive" />
        <div className="space-y-2">
          <h2 className="text-xl font-semibold">Algo deu errado</h2>
          <p className="text-muted-foreground">
            Não foi possível carregar esta página. Tente novamente.
          </p>
        </div>
        <Button onClick={reset} className="mx-auto w-full max-w-xs">
          <RefreshCw className="mr-2 h-4 w-4" />
          Tentar novamente
        </Button>
        <p className="text-sm">
          <Link
            href="/"
            className="text-primary underline-offset-4 hover:underline"
          >
            Voltar ao início
          </Link>
        </p>
        {error.digest && (
          <p className="text-xs text-muted-foreground">
            Código do erro: {error.digest}
          </p>
        )}
      </div>
    </div>
  )
}
