import { ThemeToggle } from "@/components/theme-toggle"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import type { Metadata } from "next"
import { Suspense } from "react"
import { VerifyEmailForm } from "./verify-email-form"

export const metadata: Metadata = {
  title: "Verificar email — Arkana Agora",
}

export default function VerifyEmailPage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Verificar email</CardTitle>
          <CardDescription>
            Verifique seu email e insira o token recebido.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Suspense fallback={null}>
            <VerifyEmailForm />
          </Suspense>
        </CardContent>
      </Card>
    </main>
  )
}
