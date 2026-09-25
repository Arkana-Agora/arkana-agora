import { PrivacySettings } from "@/components/profile/privacy-settings"
import { BackLink } from "@/components/layout/back-link"

export default function ProfilePrivacyPage() {
  return (
    <main className="mx-auto max-w-2xl space-y-6 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Privacidade</h1>
        <BackLink href="/perfil" />
      </div>
      <p className="text-sm text-muted-foreground">
        Controle quem pode ver seu perfil, estatísticas e arcano pessoal.
      </p>
      <PrivacySettings />
    </main>
  )
}
