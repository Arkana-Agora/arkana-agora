"use client"

import { ProfileHeader } from "@/components/profile/profile-header"
import { ProfileStats } from "@/components/profile/profile-stats"
import { ProfileAstrology } from "@/components/profile/profile-astrology"
import type { PublicProfile } from "@/hooks/use-profile"

interface PublicProfileClientProps {
  profile: PublicProfile
}

export function PublicProfileClient({ profile }: PublicProfileClientProps) {
  return (
    <main className="max-w-2xl mx-auto p-4 space-y-6">
      <ProfileHeader profile={profile} />
      <ProfileStats />
      <ProfileAstrology
        sunSign={profile.astrology?.sunSign ?? null}
        personalArcana={profile.astrology?.personalArcana ?? null}
        kinMaya={profile.astrology?.kinMaya ?? null}
      />
    </main>
  )
}
