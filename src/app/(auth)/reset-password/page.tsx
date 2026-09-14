import { ThemeToggle } from "@/components/theme-toggle"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import type { Metadata } from "next"
import Link from "next/link"
import { ResetPasswordForm } from "./reset-password-form"

export const metadata: Metadata = {
  title: "Redefinir senha — Arkana Agora",
}

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>
}) {
  const { token } = await searchParams
  const trimmedToken = token?.trim() ?? ""
  const hasToken = trimmedToken.length > 0

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Redefinir senha</CardTitle>
          <CardDescription>
            {hasToken
              ? "Defina uma nova senha para sua conta."
              : "Link de redefinicao de senha invalido"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {hasToken ? (
            <ResetPasswordForm token={trimmedToken} />
          ) : (
            <div className="flex flex-col items-center gap-2 text-center">
              <p className="text-sm text-muted-foreground">
                Solicite um novo link de recuperacao para continuar.
              </p>
              <Link
                href="/forgot-password"
                className="text-sm text-primary hover:underline"
              >
                Solicitar novo link
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  )
}
