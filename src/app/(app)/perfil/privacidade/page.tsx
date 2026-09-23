import { PrivacySettings } from "@/components/profile/privacy-settings"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"

export default function ProfilePrivacyPage() {
  return (
    <main className="mx-auto max-w-2xl space-y-6 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Privacidade</h1>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/perfil">
            <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
            Voltar
          </Link>
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">
        Controle quem pode ver seu perfil, estatísticas e arcano pessoal.
      </p>
      <PrivacySettings />
    </main>
  )
}
