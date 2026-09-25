"use client"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { getInitials } from "@/lib/utils"
import type { PublicProfile } from "@/hooks/use-profile"

interface ProfileHeaderProps {
  profile: PublicProfile
  isOwn?: boolean
  onEdit?: () => void
  headingLevel?: "h1" | "h2"
}

export function ProfileHeader({
  profile,
  isOwn,
  onEdit,
  headingLevel = "h1",
}: ProfileHeaderProps) {
  const Heading = headingLevel === "h2" ? "h2" : "h1"

  return (
    <div className="flex items-start gap-4">
      <Avatar className="h-20 w-20">
        <AvatarImage src={profile.avatarUrl ?? undefined} alt={profile.name} />
        <AvatarFallback>{getInitials(profile.name)}</AvatarFallback>
      </Avatar>

      <div className="flex-1 min-w-0">
        <Heading className="text-2xl font-bold truncate">
          {profile.name}
        </Heading>
        {profile.username && (
          <p className="text-muted-foreground">@{profile.username}</p>
        )}
        {profile.bio && (
          <p className="mt-2 text-sm line-clamp-3">{profile.bio}</p>
        )}
      </div>

      {isOwn && onEdit && (
        <Button variant="outline" size="sm" onClick={onEdit}>
          Editar perfil
        </Button>
      )}
    </div>
  )
}
