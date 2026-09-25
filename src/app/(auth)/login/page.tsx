import type { Metadata } from "next"
import { Suspense } from "react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { ThemeToggle } from "@/components/theme-toggle"
import { AuthSessionBridge } from "@/hooks/use-safe-callback-url"
import { LoginForm } from "./login-form"

export const metadata: Metadata = {
  title: "Entrar — Arkana Agora",
}

export default function LoginPage() {
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
          <Suspense fallback={null}>
            <AuthSessionBridge />
            <LoginForm />
          </Suspense>
        </CardContent>
      </Card>
    </main>
  )
}
