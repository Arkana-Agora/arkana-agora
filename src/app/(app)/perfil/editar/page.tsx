"use client"

import { ProfileEditForm } from "@/components/profile/profile-edit-form"
import { AvatarUpload } from "@/components/profile/avatar-upload"
import { BackLink } from "@/components/layout/back-link"
import { useMyProfile } from "@/hooks/use-profile"

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
        <BackLink href="/perfil" />
      </div>
      <ProfileEditContent />
    </main>
  )
}
