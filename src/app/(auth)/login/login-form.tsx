"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { signIn } from "next-auth/react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Eye, EyeOff } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { loginSchema, type LoginInput } from "@/lib/validators/auth"
import { useSafeCallbackUrl } from "@/hooks/use-safe-callback-url"
import { useAuthStore } from "@/stores/auth-store"

const SERVER_ERROR_MESSAGES: Record<string, string> = {
  AUTH_INVALID_CREDENTIALS: "E-mail ou senha invalidos",
  AUTH_ACCOUNT_SUSPENDED: "Sua conta esta suspensa",
  AUTH_ACCOUNT_LOCKED: "Conta bloqueada temporariamente",
  AUTH_RATE_LIMITED: "Muitas tentativas de login tente novamente em instantes",
  VALIDATION_ERROR: "Dados de entrada invalidos",
}

export function LoginForm() {
  const router = useRouter()
  const login = useAuthStore((state) => state.login)
  const refreshSession = useAuthStore((state) => state.refreshSession)
  const [showPassword, setShowPassword] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  const callbackUrl = useSafeCallbackUrl() ?? "/dashboard"

  useEffect(() => {
    // Mount-only guard: never trust the persisted isAuthenticated flag alone
    // (stale zustand state with an expired Auth.js cookie caused a
    // /login ↔ /dashboard redirect loop). Validate against the server once
    // and only redirect when the session is actually live.
    let active = true
    void refreshSession().then((ok) => {
      // Fail-safe: refreshSession() resolves true whenever /refresh returns
      // 200, even with no user payload. Only redirect when the store marks
      // the session as authenticated, so a bare 200 cannot bounce the user
      // off /login into an unauthenticated app shell.
      const authenticated = useAuthStore.getState().isAuthenticated
      if (active && ok && authenticated) {
        router.replace(callbackUrl)
      }
    })
    return () => {
      active = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only; callbackUrl read from the render that mounted the form
  }, [])

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  })

  async function handleGoogleSignIn() {
    try {
      await signIn("google", { callbackUrl })
    } catch (err) {
      if (!(err instanceof Error && err.message === "NEXT_REDIRECT")) {
        setServerError("Erro ao entrar com Google")
      }
    }
  }

  async function onSubmit(data: LoginInput) {
    setServerError(null)
    try {
      await login(data.email.trim(), data.password)
      router.replace(callbackUrl)
    } catch (err) {
      if (err instanceof Error && err.message === "AUTH_EMAIL_NOT_VERIFIED") {
        router.replace(
          `/verify-email?email=${encodeURIComponent(data.email.trim())}`,
        )
        return
      }
      const stateMessage =
        err instanceof Error ? SERVER_ERROR_MESSAGES[err.message] : undefined
      setServerError(stateMessage ?? "Erro ao fazer login")
    }
  }

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
          <p
            id="email-error"
            role="alert"
            className="text-sm font-medium text-destructive"
          >
            {errors.email.message}
          </p>
        )}
      </div>

      <div className="grid gap-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="password">Senha</Label>
          <Link
            href="/forgot-password"
            className="text-xs text-muted-foreground hover:text-primary"
          >
            Esqueci minha senha
          </Link>
        </div>
        <div className="relative">
          <Input
            id="password"
            data-testid="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            placeholder="Sua senha"
            className="pr-10"
            aria-invalid={!!errors.password}
            aria-describedby={errors.password ? "password-error" : undefined}
            {...register("password")}
          />
          <button
            type="button"
            onClick={() => setShowPassword((prev) => !prev)}
            aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
            className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground"
          >
            {showPassword ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </button>
        </div>
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

      {serverError && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {serverError}
        </p>
      )}

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Entrando..." : "Entrar"}
      </Button>

      <div className="relative my-1 text-center text-xs text-muted-foreground">
        <span className="relative z-10 bg-card px-2">ou</span>
        <span className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-border" />
      </div>

      <Button
        type="button"
        variant="outline"
        disabled={isSubmitting}
        onClick={handleGoogleSignIn}
      >
        Entrar com Google
      </Button>

      <div className="flex flex-col items-center gap-1 text-sm">
        <Link
          href="/magic-link"
          className="text-muted-foreground hover:text-primary"
        >
          Entrar com magic link
        </Link>
        <Link href="/register" className="text-primary hover:underline">
          Criar conta
        </Link>
      </div>
    </form>
  )
}
