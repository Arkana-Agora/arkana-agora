import { ThemeToggle } from "@/components/theme-toggle"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import type { Metadata } from "next"
import { RegisterForm } from "./register-form"

export const metadata: Metadata = {
  title: "Criar conta — Arkana Agora",
}

export default function RegisterPage() {
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
