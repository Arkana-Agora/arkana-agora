import { auth, signOut } from "@/auth/auth"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { ThemeToggle } from "@/components/theme-toggle"
import { DailyTarot } from "@/components/tarot/daily-tarot"
import Link from "next/link"

export default async function DashboardPage() {
  const session = await auth()
  const displayName = session?.user?.name ?? session?.user?.email

  return (
    <main className="mx-auto max-w-4xl space-y-8 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Olá, {displayName}</h1>
          <p className="text-muted-foreground">
            Sessão autenticada — bem-vindo de volta.
          </p>
        </div>
        <ThemeToggle />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <DailyTarot />

        <Card>
          <CardHeader>
            <CardTitle>Conta</CardTitle>
            <CardDescription>Gerencie sua sessão e perfil.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button variant="outline" asChild>
              <Link href="/perfil">Meu perfil</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/tirar">Tirar cartas</Link>
            </Button>
            <form
              action={async () => {
                "use server"
                await signOut({ redirectTo: "/login" })
              }}
            >
              <Button type="submit" variant="outline">
                Sair
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
