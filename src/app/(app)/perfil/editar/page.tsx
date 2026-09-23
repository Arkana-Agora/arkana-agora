"use client"

import { ProfileEditForm } from "@/components/profile/profile-edit-form"
import { AvatarUpload } from "@/components/profile/avatar-upload"
import { useMyProfile } from "@/hooks/use-profile"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"

function ProfileEditContent() {
  const { data: profile } = useMyProfile()

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Avatar</h2>
        <AvatarUpload
          currentAvatarUrl={profile?.avatarUrl ?? null}
          userName={profile?.displayName ?? profile?.name ?? ""}
        />
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Dados pessoais</h2>
        <ProfileEditForm />
      </section>
    </div>
  )
}

export default function ProfileEditPage() {
  return (
    <main className="mx-auto max-w-2xl space-y-6 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Editar perfil</h1>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/perfil">
            <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
            Voltar
          </Link>
        </Button>
      </div>
      <ProfileEditContent />
    </main>
  )
}
