"use client"

import { ProfileHeader } from "@/components/profile/profile-header"
import { ProfileStats } from "@/components/profile/profile-stats"
import { ProfileAstrology } from "@/components/profile/profile-astrology"
import { Button } from "@/components/ui/button"
import type { PublicProfile } from "@/hooks/use-profile"
import Link from "next/link"

interface OwnProfileProps {
  profile: PublicProfile
}

export function OwnProfile({ profile }: OwnProfileProps) {
  return (
    <main className="mx-auto max-w-2xl space-y-6 p-4">
      <h1 className="text-2xl font-bold">Meu perfil</h1>

      <ProfileHeader profile={profile} headingLevel="h2" />
      <ProfileStats />
      <ProfileAstrology
        sunSign={profile.astrology?.sunSign ?? null}
        personalArcana={profile.astrology?.personalArcana ?? null}
        kinMaya={profile.astrology?.kinMaya ?? null}
      />

      <section className="flex flex-wrap gap-2">
        <Button asChild>
          <Link href="/perfil/editar">Editar perfil</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/perfil/privacidade">Privacidade</Link>
        </Button>
        {profile.username && (
          <Button variant="ghost" asChild>
            <Link href={`/perfil/${profile.username}`}>Ver perfil público</Link>
          </Button>
        )}
      </section>
    </main>
  )
}
