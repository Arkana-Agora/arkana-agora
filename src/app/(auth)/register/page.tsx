import { ThemeToggle } from "@/components/theme-toggle"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { generateCsrfToken } from "@/lib/csrf"
import type { Metadata } from "next"
import { cookies } from "next/headers"
import { RegisterForm } from "./register-form"

export const metadata: Metadata = {
  title: "Criar conta — Arkana Agora",
}

export default async function RegisterPage() {
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
          <CardTitle>Criar conta</CardTitle>
          <CardDescription>
            Crie sua conta para comecar a explorar o universo do tarot.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RegisterForm />
        </CardContent>
      </Card>
    </main>
  )
}
