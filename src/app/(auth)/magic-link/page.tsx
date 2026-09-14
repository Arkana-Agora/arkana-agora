import { ThemeToggle } from "@/components/theme-toggle"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import type { Metadata } from "next"
import { MagicLinkForm } from "./magic-link-form"

export const metadata: Metadata = {
  title: "Magic Link — Arkana Agora",
}

export default function MagicLinkPage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Magic Link</CardTitle>
          <CardDescription>
            Enviaremos um link de acesso para seu email.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <MagicLinkForm />
        </CardContent>
      </Card>
    </main>
  )
}
