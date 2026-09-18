import type { Metadata } from "next"
import { cookies } from "next/headers"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { ThemeToggle } from "@/components/theme-toggle"
import { generateCsrfToken } from "@/lib/csrf"
import { LoginForm } from "./login-form"

export const metadata: Metadata = {
  title: "Entrar — Arkana Agora",
}

export default async function LoginPage() {
  const token = generateCsrfToken()
  const cookieStore = await cookies()
  const IS_PRODUCTION = process.env.NODE_ENV === "production"
  const cookieName = IS_PRODUCTION ? "__Host-csrf-token" : "csrf-token"
  cookieStore.set(cookieName, token, {
    httpOnly: false,
    secure: IS_PRODUCTION,
    sameSite: "strict",
    path: "/",
    maxAge: 60 * 60 * 24,
  })

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Entrar</CardTitle>
          <CardDescription>
            Acesse com seu e-mail ou conta Google para continuar.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LoginForm />
        </CardContent>
      </Card>
    </main>
  )
}
