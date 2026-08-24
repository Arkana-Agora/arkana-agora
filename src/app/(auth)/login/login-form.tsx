"use client"

import { useState } from "react"
import type { FormEvent } from "react"
import { signIn } from "next-auth/react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type Status = "idle" | "loading" | "sent" | "error"

const EMAIL_SEND_ERROR =
  "Não foi possível enviar o link de acesso. Tente novamente."

export function LoginForm() {
  const [email, setEmail] = useState("")
  const [status, setStatus] = useState<Status>("idle")
  const [error, setError] = useState<string | null>(null)

  async function handleEmailSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setStatus("loading")
    setError(null)
    try {
      const result = await signIn("email", {
        email: email.trim(),
        redirect: false,
        callbackUrl: "/dashboard",
      })
      if (result?.error) {
        setStatus("error")
        setError(EMAIL_SEND_ERROR)
      } else {
        setStatus("sent")
      }
    } catch {
      setStatus("error")
      setError(EMAIL_SEND_ERROR)
    }
  }

  async function handleGoogleSignIn() {
    setStatus("loading")
    setError(null)
    try {
      await signIn("google", { callbackUrl: "/dashboard" })
    } catch {
      setStatus("error")
      setError("Não foi possível entrar com o Google. Tente novamente.")
    }
  }

  if (status === "sent") {
    return (
      <p className="text-sm text-muted-foreground">
        Enviamos um link de acesso para <strong>{email}</strong>. Verifique sua
        caixa de entrada.
      </p>
    )
  }

  return (
    <form onSubmit={handleEmailSubmit} className="grid gap-4">
      <div className="grid gap-2">
        <Label htmlFor="email">E-mail</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          maxLength={254}
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="voce@email.com"
          aria-invalid={status === "error" || undefined}
          aria-describedby={status === "error" ? "login-error" : undefined}
        />
      </div>

      {status === "error" && (
        <p
          id="login-error"
          className="text-sm font-medium text-destructive"
          role="alert"
        >
          {error}
        </p>
      )}

      <Button type="submit" disabled={status === "loading"}>
        {status === "loading" ? "Enviando..." : "Enviar link de acesso"}
      </Button>

      <div className="relative my-1 text-center text-xs text-muted-foreground">
        <span className="relative z-10 bg-card px-2">ou</span>
        <span className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-border" />
      </div>

      <Button
        type="button"
        variant="outline"
        disabled={status === "loading"}
        onClick={handleGoogleSignIn}
      >
        Entrar com Google
      </Button>
    </form>
  )
}
