"use client"

import { useState } from "react"
import Link from "next/link"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Eye, EyeOff, CheckCircle } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { registerSchema, type RegisterInput } from "@/lib/validators/auth"
import {
  getPasswordStrength,
  MAX_SCORE,
  STRENGTH_LABELS,
  STRENGTH_BAR_COLORS,
} from "@/lib/password-strength"
import { useAuthStore } from "@/stores/auth-store"

const SERVER_ERROR_MESSAGES: Record<string, string> = {
  AUTH_EMAIL_ALREADY_EXISTS: "E-mail ja cadastrado",
  VALIDATION_ERROR: "Dados de entrada invalidos",
}

export function RegisterForm() {
  const register = useAuthStore((state) => state.register)
  const [showPassword, setShowPassword] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const [registrationSuccess, setRegistrationSuccess] = useState(false)

  const {
    register: registerField,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      passwordConfirmation: "",
      acceptTerms: false,
    },
  })

  const password = watch("password")
  const strength = password.length > 0 ? getPasswordStrength(password) : null

  async function onSubmit(data: RegisterInput) {
    setServerError(null)
    try {
      await register(data)
      setRegistrationSuccess(true)
    } catch (err) {
      const stateMessage =
        err instanceof Error ? SERVER_ERROR_MESSAGES[err.message] : undefined
      setServerError(stateMessage ?? "Erro ao criar conta")
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4" noValidate>
      <div className="grid gap-2">
        <Label htmlFor="name">Nome de exibicao</Label>
        <Input
          id="name"
          type="text"
          autoComplete="name"
          maxLength={50}
          placeholder="Seu nome"
          aria-invalid={!!errors.name}
          aria-describedby={errors.name ? "name-error" : undefined}
          {...registerField("name")}
        />
        {errors.name && (
          <p
            id="name-error"
            role="alert"
            className="text-sm font-medium text-destructive"
          >
            {errors.name.message}
          </p>
        )}
      </div>

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
          {...registerField("email")}
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
        <Label htmlFor="password">Senha</Label>
        <div className="relative">
          <Input
            id="password"
            data-testid="password"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            placeholder="Sua senha"
            className="pr-10"
            aria-invalid={!!errors.password}
            aria-describedby={errors.password ? "password-error" : undefined}
            {...registerField("password")}
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
        {strength && (
          <div className="grid gap-1">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-border">
              <div
                className={`h-full rounded-full transition-all ${STRENGTH_BAR_COLORS[strength.label]}`}
                style={{ width: `${(strength.score / MAX_SCORE) * 100}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Forca da senha: {STRENGTH_LABELS[strength.label]}
            </p>
          </div>
        )}
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
        <Label htmlFor="passwordConfirmation">Confirmar senha</Label>
        <Input
          id="passwordConfirmation"
          data-testid="passwordConfirmation"
          type="password"
          autoComplete="new-password"
          placeholder="Confirme sua senha"
          aria-invalid={!!errors.passwordConfirmation}
          aria-describedby={
            errors.passwordConfirmation
              ? "passwordConfirmation-error"
              : undefined
          }
          {...registerField("passwordConfirmation")}
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

      <div className="grid gap-2">
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            className="mt-1"
            aria-invalid={!!errors.acceptTerms}
            aria-describedby={
              errors.acceptTerms ? "acceptTerms-error" : undefined
            }
            {...registerField("acceptTerms")}
          />
          <span>Aceito os Termos de Uso e a Politica de Privacidade</span>
        </label>
        {errors.acceptTerms && (
          <p
            id="acceptTerms-error"
            role="alert"
            className="text-sm font-medium text-destructive"
          >
            {errors.acceptTerms.message}
          </p>
        )}
      </div>

      {serverError && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {serverError}
        </p>
      )}

      {registrationSuccess && (
        <div className="flex items-center gap-2 text-sm text-emerald-600">
          <CheckCircle className="h-4 w-4 flex-shrink-0" />
          <span>Conta criada! Verifique seu e-mail para ativar.</span>
        </div>
      )}

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Criando conta..." : "Criar conta"}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        Ja possui uma conta?{" "}
        <Link href="/login" className="text-primary hover:underline">
          Entrar
        </Link>
      </p>
    </form>
  )
}
